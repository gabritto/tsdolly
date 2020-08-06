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

-- ===== Statements & Expressions =====
sig Block {
	statements: lone Statement -- Limit statements to avoid combinatorial explosion.
}

fact BlockParent {
	all b: Block {
		(one f: FunctionDecl | b in f.body)
		or (one m: MethodDecl | b in m.body)
	}
}

abstract sig Statement {}

fact StatementParent {
	all s: Statement | one b: Block | s in b.statements
}

abstract sig Expression {}

fact ExpressionParent {
	all e: Expression {
		one parent: Expression + Statement { 
			(e in parent.expression)
			or (e in parent.left)
			or (e in parent.right)
			or (e in parent.arguments)
			or (e in parent.concat)
		}
	}
}

sig ExpressionStatement extends Statement {
	expression: one Expression
}

sig AssignmentExpression extends Expression {
	left: one VariableAccess,
	right: one Expression
}

fact AssignmentExpressionNoCycle {
	all a: AssignmentExpression | a not in a.^right
}

sig VariableAccess extends Expression {
	variable: one (ParameterIdentifier + FieldIdentifier)
}

// A variable accessed in the scope of a function or method body should exist.
// That is, there should be a function/method parameter with that same identifier.
fact ValidVariableAccess {
	all f: FunctionDecl, v: VariableAccess {
		(v in f.body.statements.expression.*(left + right + arguments + concat)) implies (v.variable in f.parameters.name)
	}
	all m: MethodDecl, v: VariableAccess {
		(v in m.body.statements.expression.*(left + right + arguments + concat)) implies (
			(v.variable in m.parameters.name) or
			(v.variable in m.~methods.*extend.fields.name))
	}
}

pred testVar {
	some f: FieldIdentifier, v: VariableAccess | f in v.variable
}
run testVar for 2

sig FunctionCall extends Expression {
	name: one FunctionIdentifier,
	arguments: set VariableAccess
}

fact FunctionCalledExists {
	all c: FunctionCall | some f: FunctionDecl | c.name = f.name
}

fact FunctionCallArity {
	all c: FunctionCall, f: FunctionDecl | c.name = f.name => #c.arguments = #f.parameters
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

// TODO: use this later for extract type refactoring
//sig InterfaceType extends Type {}
//sig ObjectLiteralType extends Type {}

-- ===== Commands =====
pred default {}
run default for 2

// TODO: Add info about which refactorings correspond to which preds
pred ConvertFunction {
	(some f: FunctionDecl | #f.parameters > 1) or (some m: MethodDecl | #m.parameters > 1)
}
run ConvertFunction for 2 but 0 Field, 0 StringConcat

pred ConvertToTemplateString {
	one StringConcat
}
run ConvertToTemplateString for 2

pred CreateGetAndSetAccessor {
	some c: ClassDecl | #c.fields > 0
}
run CreateGetAndSetAccessor for 2 but 0 FunctionDecl, 0 StringConcat



