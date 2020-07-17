-- Basics
abstract sig Identifier {}
sig FunctionIdentifier extends Identifier {}
sig ParameterIdentifier extends Identifier {}



one sig Program {
	declarations: set Declaration
}

-- Declarations
abstract sig Declaration {} -- Top-level declarations. TODO: rethink this design if we want to have nested Declarations
fact DeclarationParent {
	all d: Declaration | one p: Program | d in p.declarations -- TODO: this is only for top-level decls
}

sig FunctionDecl extends Declaration {
	name: one FunctionIdentifier, -- TODO: should name belong to "Declaration"?
	parameters: set ParameterDecl,
	body: one Block --,
	-- returnType: lone Type -- Remove this to reduce compilation errors
}

fact UniqueFunctionNames { -- TODO: have "name" be part of Declaration and then place uniqueness constraint on name?
	all f1, f2: FunctionDecl | f1 != f2 => f1.name != f2.name
}

sig ParameterDecl {
	name: one ParameterIdentifier,
	type: one Type, -- Must have a type annotation (simplifying for strict mode use)
}

fact UniqueParameterNames {
	all f: FunctionDecl, p1, p2: f.parameters | p1 != p2 => p1.name != p2.name
	-- Parameters of a given function have different names
}

fact ParameterDeclParent {
	all p: ParameterDecl | one f: FunctionDecl | p in f.parameters
}

-- Statements & Expressions
sig Block {
	statements: set Statement
}

fact BlockParent {
	all b: Block | one f: FunctionDecl | b in f.body
}

abstract sig Statement {}

fact StatementParent {
	all s: Statement | one b: Block | s in b.statements
}

abstract sig Expression {}

fact ExpressionParent {
	all e: Expression {
		(one s: Statement | e in s.expression) or
		(one e_other: Expression | (e in e_other.left) or (e in e_other.right)) or
		(one c: FunctionCall | e in c.arguments)
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
	variable: one ParameterIdentifier
}

fact LeftVariableExists { -- TODO: refactor if we add another way to declare vars
	all a: AssignmentExpression | some p: ParameterDecl | a.left.variable = p.name
}

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

//sig BinaryExpression extends Expression {
//	left: one Expression,
//	right: one Expression,
//	operator: one Operator
//}

//abstract sig Operator {}
//one sig Assignment extends Operator {}

-- Types
abstract sig Type {}
abstract sig PrimType extends Type {}
one sig TNumber extends PrimType {}
one sig TString extends PrimType {}

// TODO: use this later for extract type refactoring
//sig InterfaceType extends Type {}
//sig ObjectLiteralType extends Type {}

-- Commands
pred default {}
run default for 3 but exactly 2 ParameterDecl, exactly 1 FunctionDecl, exactly 1 FunctionCall

pred ConvertFunction {
	all f: FunctionDecl {
		#f.parameters > 1
	}
}

run ConvertFunction for 2 but exactly 2 ParameterDecl, exactly 1 FunctionDecl, 3 Identifier


