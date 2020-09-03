-- ===== Identifiers =====
sig FunctionIdentifier {}
sig ParameterIdentifier {}
sig ClassIdentifier {}
sig MethodIdentifier {}
sig FieldIdentifier {}

fact IdentifierParent {
	(all i: FunctionIdentifier | one f: FunctionDecl | i = f.name)
	(all i: ClassIdentifier | one c: ClassDecl | i = c.name)
	(all i: ParameterIdentifier | some p: ParameterDecl | i = p.name)
	(all i: MethodIdentifier | some m: MethodDecl | i = m.name)
	(all i: FieldIdentifier | some f: Field | i = f.name)
}

-- ===== Program ====
one sig Program {
	declarations: set Declaration
}

-- ===== Declarations =====
abstract sig Declaration {} -- Top-level declarations.
fact DeclarationParent {
	all d: Declaration | one p: Program | d in p.declarations
}

// Function
sig FunctionDecl extends Declaration {
	name: one FunctionIdentifier,
	parameters: set ParameterDecl,
	body: one Block
}

// Class
sig ClassDecl extends Declaration {
	name: one ClassIdentifier,
	extend: lone ClassDecl,
	methods: set MethodDecl,
	fields: set Field,
}

fact ClassExtendNoCycle {
	all c: ClassDecl | c not in c.^extend
}

// Field
sig Field {
	name: one FieldIdentifier,
	type: one Type, -- Must have a type annotation (simplifying for strict mode use).
	visibility: lone Private
}
-- All fields will be considered optional to avoid non-initialization errors.

fact FieldParent {
	all f: Field | one c: ClassDecl | f in c.fields
}

-- Field names are unique given a class.
-- Field overriding is also disallowed as it would not impact the semantics.
-- This is because we only have primitive types,
-- and thus we could not change the type of a field when overriding it.
fact FieldUniqueName {
	all c: ClassDecl | all disj f1, f2: c.*extend.fields | f1.name != f2.name
}

assert FieldNoOverride {
	all disj c1, c2: ClassDecl | c1 in c2.*extend implies disj[c1.fields.name, c2.fields.name]
}
check FieldNoOverride for 5

one sig Private {}

// Method
sig MethodDecl {
	name: one MethodIdentifier,
	parameters: set ParameterDecl,
	body: one Block
}

fact MethodParent {
	all m: MethodDecl | one c: ClassDecl | m in c.methods
}

fact MethodDeclUniqueName {
	all c: ClassDecl | all disj m1, m2: c.methods | m1.name != m2.name
}

-- This is here to minimize compiler errors.
-- If method m1 overrides method m2, the type of m1 should be assignable to the type of m2.
-- The fact below is an approximation of that.
fact MethodDeclOverriding {
	all disj m1, m2: MethodDecl | m1.name = m2.name and m2.~methods in m1.~methods.^extend implies {
		m1.parameters.type = m2.parameters.type
		#m1.parameters = #m1.parameters
	}
}

// Parameters
sig ParameterDecl {
	name: one ParameterIdentifier,
	type: one Type, -- Must have a type annotation (simplifying for strict mode use)
}

fact ParameterDeclParent {
	all p: ParameterDecl {
		(some f: FunctionDecl  | p in f.parameters)
		or (some m: MethodDecl | p in m.parameters)
	}
}

fact ParameterDeclUniqueName {
	all f: FunctionDecl | all disj p1, p2: f.parameters | p1.name != p2.name
	all m: MethodDecl | all disj p1, p2: m.parameters | p1.name != p2.name
}

-- ===== Expressions =====
sig Block {
	expression: lone Expression -- Limit statements to avoid combinatorial explosion.
}

fact BlockParent {
	all b: Block {
		(one f: FunctionDecl | b in f.body)
		or (one m: MethodDecl | b in m.body)
	}
}

abstract sig Expression {}

fact ExpressionParent {
	all e: Expression {
		one parent: Expression + Block { 
			(e in parent.expression)
			// or (e in parent.left)
			// or (e in parent.right)
			// or (e in parent.arguments)
			or (e in parent.(FunctionCall <: arguments))
			or (e in parent.(FunctionCall <: arguments))
			or (e in parent.concat)
		}
	}
}

sig VariableAccess extends Expression {
	variable: one (ParameterIdentifier + FieldIdentifier)
}

// A variable accessed in the scope of a function or method body should exist.
// That is, there should be a function/method parameter or class field with that same identifier.
fact ValidVariableAccess {
	all f: FunctionDecl, v: VariableAccess {
		-- Variable is an existing parameter.
		(v in f.body.expression.*(FunctionCall <: arguments + MethodCall <: arguments + concat)) implies
			(v.variable in f.parameters.name)
	}
	all m: MethodDecl, v: VariableAccess {
		-- Variable is an existing...
		(v in m.body.expression.*(MethodCall <: arguments + FunctionCall <: arguments + concat)) implies (
			(v.variable in m.parameters.name) or -- Method parameter
			(v.variable in m.~methods.fields.name) or -- Class field
			(v.variable in m.~methods.^extend.fields.name and no v.variable.~name.visibility)) -- Non-private parent class field.
	}
}

sig FunctionCall extends Expression {
	name: one FunctionIdentifier,
	arguments: set VariableAccess
}

fact FunctionCalledExists {
	all c: FunctionCall | some f: FunctionDecl | c.name = f.name
}

-- Arity and types of arguments of function call should match those of function declaration.
-- Note that this does not guarantee the absence of compilation errors due to argument/parameter mismatch,
-- because the order of arguments matters but we are not encoding order of arguments/parameters in our model.
fact FunctionCallArguments {
	all c: FunctionCall, f: FunctionDecl | c.name = f.name implies {
		#c.arguments = #f.parameters
		c.arguments.variable.~(Field <: name + ParameterDecl <: name).(Field <: type + ParameterDecl <: type) = f.parameters.type
	}
}

sig MethodCall extends Expression {
	name: one MethodIdentifier,
	arguments: set VariableAccess
}

-- Defines where a method can be called.
fact MethodCalledExists {
	all mc: MethodCall | some m: MethodDecl {
		mc.name = m.name -- The method name exists.
		all m1: MethodDecl {
			mc in m1.body.expression implies { -- If method m is called inside a method declaration m1, then m was declared in m1's class' inheritance path.
				m in m1.~methods.*extend.methods
			}
		}
	}
	all c: MethodCall | c.~expression.~(MethodDecl <: body + FunctionDecl <: body) in MethodDecl -- Method calls can only appear in method bodies, not functions.
}

-- Arity and types of arguments of method call should match those of method declaration.
-- Note that this does not guarantee the absence of compilation errors due to argument/parameter mismatch,
-- because the order of arguments matters but we are not encoding order of arguments/parameters in our model.
fact MethodCallArguments {
	all c: MethodCall, m: MethodDecl | c.name = m.name implies {
		#c.arguments = #m.parameters
		c.arguments.variable.~(Field <: name + ParameterDecl <: name).(Field <: type + ParameterDecl <: type) = m.parameters.type
	}
}

lone sig StringConcat extends Expression {
	concat: set (StringLiteral + VariableAccess)
}

fact StringConcatSize {
	all s: StringConcat {
		#s.concat > 1
		#s.concat <= 3
	}
}

sig StringLiteral {}

fact StringLiteralParent {
	all s: StringLiteral | some c: StringConcat | s in c.concat
}

-- ===== Types =====
abstract sig Type {}
abstract sig PrimType extends Type {}
one sig TNumber extends PrimType {}
one sig TString extends PrimType {}

-- ===== Commands =====
pred default {}
run default for 2

pred small {}
run small for 1

/*
	Refactoring: Convert parameters to destructured object.
	Condition: there should be a function or method with at least 2 parameters.
*/
pred ConvertParamsToDestructuredObject {
	(some f: FunctionDecl | #f.parameters > 1) or (some m: MethodDecl | #m.parameters > 1)
}
run ConvertParamsToDestructuredObject for 2

/*
	Refactoring: Convert to template string.
	Condition: there should be a string concatenation expression.
*/
pred ConvertToTemplateString {
	one StringConcat
}
run ConvertToTemplateString for 2

/*
	Refactoring: Generate 'get' and 'set' accessors.
	Condition: there should be a class with at least one field.
*/
pred GenerateGetAndSetAccessor {
	some c: ClassDecl | #c.fields > 0
}
run GenerateGetAndSetAccessor for 2

/*
	Refactoring: Extract Symbol.
	Condition: there should be a method or function call, or a string literal, or a field access.
*/
pred ExtractSymbol {
	some (FunctionCall + MethodCall) or some StringLiteral or {
		some f: FieldIdentifier | some f.~variable
	}
}
run ExtractSymbol for 2

/*
	Refactoring: Move to a new file.
	Condition: there should be a top-level declaration (function or class declaration).
*/
pred MoveToNewFile {
	some (FunctionDecl + ClassDecl)
}
run MoveToNewFile for 2
