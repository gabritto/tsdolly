-- Basics
sig Identifier extends Expression {} -- TODO: should identifiers be different for each decl that has one? This is allowed in TS but might generate weird examples

one sig Program {
	declarations: set Declaration
}

//fun classes[pack:Package]: set Class {
//	pack.~package
//}
-- Declarations
abstract sig Declaration {}
fact {
	all d: Declaration | some p: Program | d in p.declarations
}

sig FunctionDecl extends Declaration {
	name: one Identifier, -- TODO: should name belong to "Declaration"?
	parameters: set ParameterDecl,
	body: one Block,
	returnType: lone Type
}

fact UniqueParameterNames {
	all f: FunctionDecl, p1, p2: f.parameters | p1 != p2 => p1.name != p2.name
	-- Parameters of a given function have different names
}

sig ParameterDecl {
	name: one Identifier,
	type: one Type, -- Must have a type annotation
	function: one FunctionDecl -- TODO: remove? parent
}

fact {
	function = ~parameters
}

sig Block {
	statements: set Statement
}

abstract sig Statement {}
abstract sig Expression {}

sig ExpressionStatement extends Statement {
	expression: one Expression
}

sig AssignmentExpression extends Expression {
	left: one LValue,
	right: one Expression
}

sig LValue extends Expression {
	variableAccess: one Identifier
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
sig InterfaceType extends Type {}
sig ObjectLiteralType extends Type {}
one sig TInt extends PrimType {}
one sig TString extends PrimType {}

-- Testing
pred show {}
//run show for 3 but exactly 1 FunctionDecl, exactly 2 ParameterDecl, exactly 2 Identifier
run show for 2 but exactly 2 ParameterDecl, exactly 1 FunctionDecl

