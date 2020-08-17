import { PrivateIdentifier } from "ts-morph";

export type Solutions = Program[];

export interface Node {
    nodeId: string;
    nodeType: string;
}

// Identifiers
export type Identifier =
    | FunctionIdentifier
    | ParameterIdentifier
    | ClassIdentifier
    | MethodIdentifier
    | FieldIdentifier;

export interface FunctionIdentifier extends Node {
    nodeType: "FunctionIdentifier";
}

export interface ParameterIdentifier extends Node {
    nodeType: "ParameterIdentifier";
}

export interface ClassIdentifier extends Node {
    nodeType: "ClassIdentifier";
}

export interface MethodIdentifier extends Node {
    nodeType: "MethodIdentifier";
}

export interface FieldIdentifier extends Node {
    nodeType: "FieldIdentifier";
}

// Program
export interface Program extends Node {
    nodeType: "Program";
    declarations: Declaration[];
}

// Declarations
export type Declaration = FunctionDecl | ClassDecl;

// Function
export interface FunctionDecl extends Node {
    nodeType: "FunctionDecl";
    name: FunctionIdentifier;
    parameters: ParameterDecl[];
    body: Block;
}

// Class
export interface ClassDecl extends Node {
    nodeType: "ClassDecl";
    name: ClassIdentifier;
    extend?: ClassDecl;
    methods: MethodDecl[];
    fields: Field[];
}

// Field
export interface Field extends Node {
    nodeType: "Field";
    name: FieldIdentifier;
    type: Type;
    visibility?: Private;
}

export interface Private extends Node {
    nodeType: "Private";
}

// Method
export interface MethodDecl extends Node {
    nodeType: "MethodDecl";
    name: MethodIdentifier;
    parameters: ParameterDecl[];
    body: Block;
}

// Parameters
export interface ParameterDecl extends Node {
    nodeType: "ParameterDecl";
    name: ParameterIdentifier;
    type: Type;
}

// Statements & Expressions
export interface Block extends Node {
    nodeType: "Block";
    expression?: Expression;
}

export type Expression =
    // | AssignmentExpression
    VariableAccess | FunctionCall | StringConcat | MethodCall;

// export interface AssignmentExpression extends Node {
//     nodeType: "AssignmentExpression";
//     left: VariableAccess;
//     right: Expression;
// }

export interface VariableAccess extends Node {
    nodeType: "VariableAccess";
    variable: ParameterIdentifier;
}

export interface FunctionCall extends Node {
    nodeType: "FunctionCall";
    name: FunctionIdentifier;
    arguments: VariableAccess[];
}

export interface MethodCall extends Node {
    nodeType: "MethodCall";
    name: MethodIdentifier;
    arguments: VariableAccess[];
}

export interface StringConcat extends Node {
    nodeType: "StringConcat";
    concat: (StringLiteral | VariableAccess)[];
}

export interface StringLiteral extends Node {
    nodeType: "StringLiteral";
}

export type Type = PrimType; // | InterfaceType | ObjectLiteralType;

export type PrimType = TNumber | TString;

// export interface InterfaceType extends Node {
//     nodeType: "InterfaceType"
// }

// export interface ObjectLiteralType extends Node {
//     nodeType: "ObjectLiteralType"
// }

export interface TNumber extends Node {
    nodeType: "TNumber";
}

export interface TString extends Node {
    nodeType: "TString";
}
