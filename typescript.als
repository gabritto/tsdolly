-- ===== Identifiers =====
sig FunctionIdentifier {}
sig ParameterIdentifier {}
sig ClassIdentifier {}
sig MethodIdentifier {}
sig FieldIdentifier {}

fact IdentifierParent {
	(all i: FunctionIdentifier | one f: FunctionDecl | i = f.name)
	(all i: ParameterIdentifier | some p: ParameterDecl | i = p.name)
	(all i: ClassIdentifier | one c: ClassDecl | i = c.name)
	(all i: MethodIdentifier | some m: MethodDecl | i = m.name)
	(all i: FieldIdentifier | some f: Field | i = f.name)
}


-- ===== Program ====
one sig Program {
	declarations: set Declaration
}

-- ===== Declarations =====
abstract sig Declaration {} -- Top-level declarations. TODO: rethink this design if we want to have nested Declarations
fact DeclarationParent {
	all d: Declaration | one p: Program | d in p.declarations -- TODO: this is only for top-level decls
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
	-- TODO: constructor
}

fact ClassExtendNoCycle {
	all c: ClassDecl | c not in c.^extend
}

// Field
sig Field {
	name: one FieldIdentifier,
	type: one Type, -- Must have a type annotation (simplifying for strict mode use)
	visibility: lone Private
}

fact FieldParent {
	all f: Field | some c: ClassDecl | f in c.fields
}

fact FieldUniqueName {
	all c: ClassDecl | all disj f1, f2: c.*extend.fields | f1.name != f2.name
}

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

// sig AssignmentExpression extends Expression {
// 	left: one VariableAccess,
// 	right: one Expression
// }

// fact AssignmentExpressionNoCycle {
// 	all a: AssignmentExpression | a not in a.^right
// }

sig VariableAccess extends Expression {
	variable: one (ParameterIdentifier + FieldIdentifier)
}

// A variable accessed in the scope of a function or method body should exist.
// That is, there should be a function/method parameter with that same identifier.
fact ValidVariableAccess {
	all f: FunctionDecl, v: VariableAccess {
		// (v in f.body.statements.expression.*(left + right + arguments + concat)) implies (v.variable in f.parameters.name)
		(v in f.body.expression.*(FunctionCall <: arguments + concat)) implies (v.variable in f.parameters.name)
	}
	all m: MethodDecl, v: VariableAccess {
		// (v in m.body.statements.expression.*(left + right + arguments + concat)) implies (
		(v in m.body.expression.*(MethodCall <: arguments + concat)) implies (
			(v.variable in m.parameters.name) or
			(v.variable in m.~methods.*extend.fields.name))
	}
}

sig FunctionCall extends Expression {
	name: one FunctionIdentifier,
	arguments: set VariableAccess
}

fact FunctionCalledExists {
	all c: FunctionCall | some f: FunctionDecl | c.name = f.name
}

fact FunctionCallArity {
	all c: FunctionCall, f: FunctionDecl | c.name = f.name implies #c.arguments = #f.parameters
}

sig MethodCall extends Expression {
	name: one MethodIdentifier,
	arguments: set VariableAccess
}

fact MethodCalledExists {
	all mc: MethodCall | some m: MethodDecl {
		mc.name = m.name
		all m1: MethodDecl {
			mc in m1.body.expression implies {
				m in m1.~methods.*extend.methods
			}
		}
	}
}

fact MethodCallArity {
	all c: MethodCall, m: MethodDecl {
		c.name = m.name implies #c.arguments = #m.parameters
	}
}

pred methodCallTest {
	some m: MethodCall | #m.arguments > 0
}
run methodCallTest for 2

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

// TODO: use this later for extract type refactoring
//sig InterfaceType extends Type {}
//sig ObjectLiteralType extends Type {}

-- ===== Commands =====
pred default {}
run default for 1

// TODO: Add info about which refactorings correspond to which preds
pred ConvertFunction {
	(some f: FunctionDecl | #f.parameters > 1) or (some m: MethodDecl | #m.parameters > 1)
}
run ConvertFunction for 2 but 0 Field, 0 StringConcat

pred ConvertToTemplateString {
	one StringConcat
}
run ConvertToTemplateString for 1 but 2 Expression, 2 StringLiteral

// pred StrConc {
// 	some s: StringConcat, f: Field | f.name in s.concat.variable
// }
// run StrConc for 1 but 2 Expression

pred CreateGetAndSetAccessor {
	some c: ClassDecl | #c.fields > 0
}
run CreateGetAndSetAccessor for 2 but 1 Field, 0 FunctionDecl, 0 StringConcat



