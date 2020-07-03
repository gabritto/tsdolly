export type Solutions = Node[][];

export interface Node {
    nodeId: string,
    nodeType: string
}

export interface Identifier extends Node {
    nodeType: "Identifier"
}

export interface Program extends Node {
    nodeType: "Program",
    declarations: SetIds
}

export type Declaration = FunctionDecl;

export interface FunctionDecl extends Node {
    nodeType: "FunctionDecl",
    name: Id,
    parameters: SetIds,
    body: Id,
    returnType: LoneId
}

export interface ParameterDecl extends Node {
    nodeType: "Parameter",
    name: Id,
    type: Id
}

export interface Block extends Node {
    nodeType: "Block",
    statements: SetIds
}

export type Statement = ExpressionStatement;

export interface ExpressionStatement extends Node {
    nodeType: "ExpressionStatement",
    expression: Id
}

export type Expression = AssignmentExpression | LValue;

export interface AssignmentExpression extends Node {
    nodeType: "AssignmentExpression",
    left: Id,
    right: Id
}

export interface LValue extends Node {
    nodeType: "LValue",
    variableAccess: Id
}

export type Type = PrimType | InterfaceType | ObjectLiteralType;

export type PrimType = TNumber | TString;

export interface InterfaceType extends Node {
    nodeType: "InterfaceType"
}

export interface ObjectLiteralType extends Node {
    nodeType: "ObjectLiteralType"
}

export interface TNumber extends Node {
    nodeType: "TNumber"
}

export interface TString extends Node {
    nodeType: "TString"
}

type Id = string;
type SetIds = string[];
type LoneId = string | null;
