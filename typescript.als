//sig Var {
//	type: lone Type
//}

-- Basics
sig Identifier {} -- TODO: should identifiers be different for each decl that has one? This is allowed in TS but might generate weird examples

-- Functions
abstract sig Declaration {}
sig FunctionDecl extends Declaration {
	name: one Identifier,
	parameters: set ParameterDecl
}

fact UniqueParameters {
	all f: FunctionDecl, p1, p2: f.parameters | p1 != p2 => p1.name != p2.name
	-- Parameters of a given function have different names
}

sig ParameterDecl {
	name: one Identifier,
	type: one Type, -- Must have a type annotation
	function: one FunctionDecl
}

fact ParameterFunction {
	all f: FunctionDecl, p: f.parameters | p.function = f
	-- `function` is the inverse of `parameters`
}

fact FunctionParameter {
	all p: ParameterDecl, f: p.function | p in f.parameters
}

-- Types
abstract sig Type {}
abstract sig PrimType extends Type {}
sig InterfaceType extends Type {}
sig ObjectLiteralType extends Type {}

one sig TInt extends PrimType {}
one sig TString extends PrimType {}

-- Testing
pred show {}
run show for 3 but exactly 1 FunctionDecl, exactly 2 ParameterDecl, exactly 2 Identifier

