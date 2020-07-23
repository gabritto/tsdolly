-- ===== Identifiers =====
sig FunctionIdentifier {}
sig ParameterIdentifier {}
sig ClassIdentifier {}
sig MethodIdentifier {}

fact IdentifierParent {
	(all i: FunctionIdentifier | one f: FunctionDecl | i = f.name)
	(all i: ParameterIdentifier | one p: ParameterDecl | i = p.name)
	(all i: ClassIdentifier | one c: ClassDecl | i = c.name)
	(all i: MethodIdentifier | one m: MethodDecl | i = m.name)
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
	methods: set MethodDecl
	-- TODO: constructor
	-- TODO: fields
}

fact ClassExtendNoCycle {
	all c: ClassDecl | c not in c.^extend
}

// Method
sig MethodDecl {
	name: one MethodIdentifier,
	parameters: set ParameterDecl,
	body: one Block
}

fact MethodParent {
	all m: MethodDecl | one c: ClassDecl | m in c.methods
}

// Parameters
sig ParameterDecl {
	name: one ParameterIdentifier,
	type: one Type, -- Must have a type annotation (simplifying for strict mode use)
}

fact ParameterDeclParent {
	all p: ParameterDecl { -- TODO: should this be `some` or `one`?
		(some f: FunctionDecl  | p in f.parameters)
		or (some m: MethodDecl | p in m.parameters)
	}
}

-- ===== Statements & Expressions =====
sig Block {
	statements: set Statement
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
pred default {
	no StringConcat
}
run default for 2

// TODO: Add info about which refactorings correspond to which preds
pred ConvertFunction {
	(some f: FunctionDecl | #f.parameters > 1) or (some m: MethodDecl | #m.parameters > 1)
}
run ConvertFunction for 2

pred ConvertToTemplateString {
	some StringConcat
	all s: StringConcat { -- TODO: should we have this?
		some v: VariableAccess | v in s.concat
	}
}
run ConvertToTemplateString for 2 but 3 StringLiteral, 3 VariableAccess



