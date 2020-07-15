-- Basics
sig Identifier {} -- TODO: should identifiers be different for each node that has one? This is allowed in TS but might generate weird examples or increase complexity

one sig Program {
	declarations: set Declaration
}

-- Declarations
abstract sig Declaration {} -- Top-level declarations. TODO: rethink this design if we want to have nested Declarations
fact DeclarationParent {
	all d: Declaration | one p: Program | d in p.declarations -- TODO: this is only for top-level decls
}

sig FunctionDecl extends Declaration {
	name: one Identifier, -- TODO: should name belong to "Declaration"?
	parameters: set ParameterDecl,
	body: one Block --,
	-- returnType: lone Type -- Remove this to reduce compilation errors
}

fact UniqueParameterNames {
	all f: FunctionDecl, p1, p2: f.parameters | p1 != p2 => p1.name != p2.name
	-- Parameters of a given function have different names
}

fact UniqueFunctionNames { -- TODO: have "name" be part of Declaration and then place uniqueness constraint on name?
	all f1, f2: FunctionDecl | f1 != f2 => f1.name != f2.name
}

sig ParameterDecl {
	name: one Identifier,
	type: one Type, -- Must have a type annotation (simplifying for strict mode use)
}

fact ParameterDeclParent {
	all p: ParameterDecl | one f: FunctionDecl | p in f.parameters
}

sig Block {
	statements: set Statement
}

//sig FunctionBlock extends Block {
//	return: one Expression
//}

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
		(one s: Statement | e in s.expression) or (one e_other: Expression | (e in e_other.left) or (e in e_other.right))
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
	variable: one Identifier -- TODO: assert identifier is declared
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
// TODO: use this later for extract type refactoring
//sig InterfaceType extends Type {}
//sig ObjectLiteralType extends Type {}
one sig TNumber extends PrimType {}
one sig TString extends PrimType {}

-- Testing
pred show {}
//run show for 3 but exactly 1 FunctionDecl, exactly 2 ParameterDecl, exactly 2 Identifier
run show for 2 but exactly 2 ParameterDecl, exactly 1 FunctionDecl, 3 Identifier

