import _ = require("lodash");

import { ts, Project } from "ts-morph";
import * as types from "./types";
import { toposort } from "./toposort";
import { assert } from "console";

const COMPILER_OPTIONS = {
    strict: true,
    target: ts.ScriptTarget.Latest,
    noEmit: true,
};

export function buildProject(program: string, filePath: string): Project {
    const project = new Project({ compilerOptions: COMPILER_OPTIONS });
    project.createSourceFile(filePath, program);
    return project;
}

export function buildProgram(program: types.Program): string {
    const declarations = ts.createNodeArray(
        sortDeclarations(program.declarations).map(buildDeclaration)
    );
    const file = ts.createSourceFile(
        "program.ts",
        "",
        COMPILER_OPTIONS.target,
        /* setParentNodes */ false,
        ts.ScriptKind.TS
    ); // TODO: refactor to use same options

    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const result = printer.printList(
        ts.ListFormat.MultiLine,
        declarations,
        file
    );
    return result;
}

function sortDeclarations(
    declarations: types.Declaration[]
): types.Declaration[] {
    const n = declarations.length;
    const edges = new Array<number[]>(n);
    for (let d = 0; d < declarations.length; d++) {
        edges[d] = [];
        const decl = declarations[d];
        if (decl.nodeType === "ClassDecl" && decl.extend) {
            const parent = _.findIndex(
                declarations,
                (otherDecl) =>
                    otherDecl.nodeType === "ClassDecl" &&
                    otherDecl.nodeId === decl.extend!.nodeId
            );
            if (parent >= 0) {
                assert(
                    parent >= 0,
                    `Class ${getIdentifier(
                        decl.extend.name
                    )} should exist among declarations`
                );
                edges[d].push(parent);
            }
        }
    }

    const sort = toposort(edges);
    const sortedDeclarations: types.Declaration[] = [];
    for (const idx of sort) {
        sortedDeclarations.push(declarations[idx]);
    }

    assert(sortedDeclarations.length === declarations.length);
    return sortedDeclarations;
}

function buildDeclaration(declaration: types.Declaration): ts.Declaration {
    switch (declaration.nodeType) {
        case "FunctionDecl":
            return buildFunctionDecl(declaration);
        case "ClassDecl":
            return buildClassDecl(declaration);
    }
}

function buildFunctionDecl(
    functionDecl: types.FunctionDecl
): ts.FunctionDeclaration {
    const name = getIdentifier(functionDecl.name);
    const parameters: ts.ParameterDeclaration[] = functionDecl.parameters.map(
        buildParameterDecl
    );
    const body: ts.Block = buildBlock(functionDecl.body);

    return ts.createFunctionDeclaration(
        /* decorators */ undefined,
        /* modifiers */ undefined,
        /* asteriskToken */ undefined,
        /* name */ name,
        /* typeParameters */ undefined,
        /* parameters */ parameters,
        /* type */ undefined,
        /* body */ body
    );
}

function buildClassDecl(classDecl: types.ClassDecl): ts.ClassDeclaration {
    const name = getIdentifier(classDecl.name);
    const heritageClauses: ts.HeritageClause[] = [];
    if (classDecl.extend != null) {
        const parentClassName = getIdentifier(classDecl.extend.name);
        const parentClass = ts.createExpressionWithTypeArguments(
            /* typeArguments */ undefined,
            /* expression */ ts.createIdentifier(parentClassName)
        );
        const heritageClause = ts.createHeritageClause(
            /* token */ ts.SyntaxKind.ExtendsKeyword,
            /* types */ [parentClass]
        );
        heritageClauses.push(heritageClause);
    }

    const methods = classDecl.methods.map(buildMethodDecl);

    const fields = classDecl.fields.map(buildField);

    return ts.createClassDeclaration(
        /* decorators */ undefined,
        /* modifiers */ undefined,
        /* name */ name,
        /* typeParameters */ undefined,
        /* heritageClauses */ heritageClauses,
        /* members */ [...fields, ...methods]
    );
}

function buildField(field: types.Field): ts.PropertyDeclaration {
    const name = ts.createIdentifier(getIdentifier(field.name));
    const type = buildType(field.type);

    const modifiers = [];
    if (field.visibility) {
        modifiers.push(ts.createToken(ts.SyntaxKind.PrivateKeyword));
    }

    return ts.createProperty(
        /* decorators */ undefined,
        /* modifiers */ modifiers,
        /* name */ name,
        /* questionOrExclamationToken */ ts.createToken(
            ts.SyntaxKind.QuestionToken
        ),
        /* type */ type,
        /* initializer */ undefined
    );
}

function buildMethodDecl(methodDecl: types.MethodDecl): ts.MethodDeclaration {
    const name = getIdentifier(methodDecl.name);
    const parameters: ts.ParameterDeclaration[] = methodDecl.parameters.map(
        buildParameterDecl
    );
    const body: ts.Block = buildBlock(methodDecl.body);

    return ts.createMethod(
        /* decorators */ undefined,
        /* modifiers */ undefined,
        /* asteriskToken */ undefined,
        /* name */ name,
        /* questionToken */ undefined,
        /* typeParameters */ undefined,
        /* parameters */ parameters,
        /* type */ undefined,
        /* body */ body
    );
}

function buildParameterDecl(
    parameterDecl: types.ParameterDecl
): ts.ParameterDeclaration {
    const name = getIdentifier(parameterDecl.name);
    const type = buildType(parameterDecl.type);

    return ts.createParameter(
        /* decorators */ undefined,
        /* modifiers */ undefined,
        /* dotDotToken */ undefined,
        /* name */ name,
        /* questionToken */ undefined,
        /* type */ type,
        /* initializer */ undefined
    );
}

function buildType(type: types.Type): ts.TypeNode {
    switch (type.nodeType) {
        case "TNumber":
        case "TString":
            return buildPrimType(type);
    }
}

function buildPrimType(type: types.PrimType): ts.TypeNode {
    switch (type.nodeType) {
        case "TNumber":
            return ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
        case "TString":
            return ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    }
}

function buildBlock(block: types.Block): ts.Block {
    let statements: ts.Statement[] = [];
    if (block.expression) {
        statements = [
            ts.createExpressionStatement(buildExpression(block.expression)),
        ];
    }
    return ts.createBlock(/* statements */ statements, /* multiline */ true);
}

function buildExpression(expression: types.Expression): ts.Expression {
    switch (expression.nodeType) {
        case "VariableAccess":
            return buildVariableAccess(expression);
        case "FunctionCall":
            return buildFunctionCall(expression);
        case "StringConcat":
            return buildStringConcat(expression);
        case "MethodCall":
            return buildMethodCall(expression);
    }
}

function buildVariableAccess(
    variableAccess: types.VariableAccess
): ts.Expression {
    const identifier = getIdentifier(variableAccess.variable);
    switch (variableAccess.variable.nodeType) {
        case "FieldIdentifier":
            return ts.createPropertyAccess(
                /* expression */ ts.createThis(),
                /* name */ ts.createIdentifier(identifier)
            );
        case "ParameterIdentifier":
            return ts.createIdentifier(identifier);
    }
}

function buildFunctionCall(
    functionCall: types.FunctionCall
): ts.CallExpression {
    const identifier = ts.createIdentifier(getIdentifier(functionCall.name));
    const args = functionCall.arguments.map(buildExpression);
    return ts.createCall(
        /* expression */ identifier,
        /* typeArguments */ undefined,
        /* argumentsArray */ args
    );
}

function buildStringConcat(stringConcat: types.StringConcat): ts.Expression {
    return buildStringConcatWorker(stringConcat.concat);
}

// Builds left-associative string/expression concatenation.
function buildStringConcatWorker(
    strings: (types.StringLiteral | types.VariableAccess)[]
): ts.Expression {
    if (strings.length === 0) {
        throw new Error("Expected at least one element in string concat array");
    }
    if (strings.length == 1) {
        const [s] = strings;
        return buildStringConcatElement(s);
    }

    const rest = _.initial(strings);
    const s = _.last(strings)!; // This cannot be undefined because strings.length > 1
    // const [s, ...rest] = strings;
    return ts.createBinary(
        /* left */ buildStringConcatWorker(rest),
        /* operator */ ts.SyntaxKind.PlusToken,
        /* right */ buildStringConcatElement(s)
    );
}

function buildStringConcatElement(
    s: types.StringLiteral | types.VariableAccess
): ts.Expression {
    switch (s.nodeType) {
        case "StringLiteral":
            return buildStringLiteral(s);
        case "VariableAccess":
            return buildVariableAccess(s); // TODO: do we need to parenthesize those?
    }
}

function buildStringLiteral(
    stringLiteral: types.StringLiteral
): ts.StringLiteral {
    return ts.createStringLiteral(stringLiteral.nodeId);
}

function buildMethodCall(methodCall: types.MethodCall): ts.CallExpression {
    const identifier = ts.createIdentifier(getIdentifier(methodCall.name));
    const args = methodCall.arguments.map(buildExpression);
    const thisExpression = ts.createPropertyAccess(
        /* expression */ ts.createThis(),
        /* name */ identifier
    );
    return ts.createCall(
        /* expression */ thisExpression,
        /* typeArguments */ undefined,
        /* argumentsArray */ args
    );
}

function getIdentifier(identifier: types.Identifier): string {
    // switch (identifier.nodeType) {
    //     case "FunctionIdentifier":
    //         return `function${identifier.nodeId}`
    //     case "ParameterIdentifier":
    //         return `param${identifier.nodeId}`
    // }
    return identifier.nodeId;
    // TODO: prettify names
}
