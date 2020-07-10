export type Solutions = Program[];

export interface Node {
    nodeId: string,
    nodeType: string
}

export interface Identifier extends Node {
    nodeType: "Identifier"
}

export interface Program extends Node {
    nodeType: "Program",
    declarations: Declaration[]
}

export type Declaration = FunctionDecl;

export interface FunctionDecl extends Node {
    nodeType: "FunctionDecl",
    name: Identifier,
    parameters: ParameterDecl[],
    body: Block,
    // returnType: Maybe<Type>
}

export interface ParameterDecl extends Node {
    nodeType: "ParameterDecl",
    name: Identifier,
    type: Type
}

export interface Block extends Node {
    nodeType: "Block",
    statements: Statement[]
}

export type Statement = ExpressionStatement;

export interface ExpressionStatement extends Node {
    nodeType: "ExpressionStatement",
    expression: Expression
}

export type Expression = AssignmentExpression | VariableAccess;

export interface AssignmentExpression extends Node {
    nodeType: "AssignmentExpression",
    left: VariableAccess,
    right: Expression
}

export interface VariableAccess extends Node {
    nodeType: "VariableAccess",
    variable: Identifier
}

export type Type = PrimType // | InterfaceType | ObjectLiteralType;

export type PrimType = TNumber | TString;

// export interface InterfaceType extends Node {
//     nodeType: "InterfaceType"
// }

// export interface ObjectLiteralType extends Node {
//     nodeType: "ObjectLiteralType"
// }

export interface TNumber extends Node {
    nodeType: "TNumber"
}

export interface TString extends Node {
    nodeType: "TString"
}

type Maybe<T> = T | null;
