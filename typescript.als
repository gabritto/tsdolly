-- ===== Identifiers =====
abstract sig Identifier {}
sig FunctionIdentifier extends Identifier {}
sig ParameterIdentifier extends Identifier {}
sig ClassIdentifier extends Identifier {}
sig MethodIdentifier extends Identifier {}

fact IdentifierParent {
	(all i: FunctionIdentifier | some f: FunctionDecl | i = f.name)
	(all i: ParameterIdentifier | some p: ParameterDecl | i = p.name)
	(all i: ClassIdentifier | some c: ClassDecl | i = c.name)
	(all i: MethodIdentifier | some m: MethodDecl | i = m.name)
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
	body: one Block --,
	-- returnType: lone Type -- Remove this to reduce compilation errors
}

fact UniqueFunctionNames { -- TODO: have "name" be part of Declaration and then place uniqueness constraint on name?
	all f1, f2: FunctionDecl | f1 != f2 => f1.name != f2.name
}

// Class
sig ClassDecl extends Declaration {
	name: one ClassIdentifier,
	extend: lone ClassDecl,
	methods: set MethodDecl
	-- TODO: constructor
	-- TODO: fields
}

fact UniqueClassNames {
	all c1, c2: ClassDecl | c1 != c2 => c1.name != c2.name
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

fact UniqueMethodNames {
	all c: ClassDecl, m1, m2: c.methods | m1 != m2 => m1.name != m2.name
}

fact MethodParent {
	all m: MethodDecl | one c: ClassDecl | m in c.methods
}

pred test {}
run test for 5 but exactly 2 MethodDecl, exactly 1 ClassDecl, exactly 2 MethodIdentifier

//sig ConstructorDecl {
//	parameters: set ParameterDecl,
//	body: one Block -- TODO: should have a special block with statements mentioning `this`, must call super?
//}

// Parameters
sig ParameterDecl {
	name: one ParameterIdentifier,
	type: one Type, -- Must have a type annotation (simplifying for strict mode use)
}

fact UniqueParameterNames {
	(all f: FunctionDecl, p1, p2: f.parameters | p1 != p2 => p1.name != p2.name) and
	(all m: MethodDecl, p1, p2: m.parameters | p1 != p2 => p1.name != p2.name)
}

fact ParameterDeclParent {
	all p: ParameterDecl { 
		(one f: FunctionDecl  | p in f.parameters) or
		(one m: MethodDecl | p in m.parameters)
	}
}

-- ===== Statements & Expressions =====
sig Block {
	statements: set Statement
}

fact BlockParent {
	all b: Block {
		(one f: FunctionDecl | b in f.body) or
		(one m: MethodDecl | b in m.body)
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
			(e in parent.expression) or (e in parent.left) or (e in parent.right) or (e in parent.arguments) or
			(e in parent.concat)
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

sig StringConcat extends Expression {
	concat: set (String + VariableAccess)
}

fact StringConcatSize {
	all s: StringConcat | #s.concat > 1
}

fact StringLiterals { // Alloy will use those literals
	none != "lorem" + "ipsum" + "dolor" + "sit" + "amet"
}

fact StringLiteralParent {
	all s: String | some c: StringConcat | s in c.concat
}

//sig BinaryExpression extends Expression {
//	left: one Expression,
//	right: one Expression,
//	operator: one Operator
//}

//abstract sig Operator {}
//one sig Assignment extends Operator {}

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
run default for 3

// TODO: Add info about which refactorings correspond to which preds
pred ConvertFunction {
	(
	all f: FunctionDecl {
		#f.parameters > 1
	}
	) and
	(
	all m: MethodDecl {
		#m.parameters > 1
	}
	)
}

pred ConvertToTemplateString {
	
}


run ConvertFunction for 3


