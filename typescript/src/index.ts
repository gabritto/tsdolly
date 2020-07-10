import yargs = require("yargs");
import fs = require("fs");
import Ajv = require("ajv");
import ts = require("typescript");

import * as types from "./types";

type Object = { [key: string]: object };
type Schema = { definitions: Object };
const SCHEMA: Schema  = JSON.parse(fs.readFileSync("schema/types.json", { encoding: "utf-8" }));
const ENTRY_ID: string = "Program$0";

function main(): void {
    const args = yargs
        .usage("To do")
        .option("solution", {
            describe: "Path to file containing the Alloy metamodel solutions",
            type: "string",
            default: "../output/alloySolutions.json",
        }).argv;

    tsdolly(args);
}

function tsdolly(args: { solution: string }): void {
    const solutionFile = fs.readFileSync(args.solution, { encoding: "utf-8" });
    const solutionsRaw: unknown = JSON.parse(solutionFile);
    console.log(JSON.stringify((solutionsRaw as unknown[])[0], undefined, 4));
    const ajv = new Ajv();
    ajv.addSchema(SCHEMA, "types");
    if (!ajv.validate({ $ref: "types#/definitions/Solutions" }, solutionsRaw)) {
        throw ajv.errors;
    }
    const solutions = solutionsRaw as types.Solutions;
    console.log(`${solutions.length} solutions found`);
    const programs = solutions.map(buildProgram);
}

function buildProgram(program: types.Program): string {    
    const declarations = ts.createNodeArray(program.declarations.map(buildDeclaration));
    const file = ts.createSourceFile("../output/program.ts", "", ts.ScriptTarget.Latest, /*setParentNodes*/ false, ts.ScriptKind.TS);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

    const result = printer.printList(ts.ListFormat.MultiLine, declarations, file);
    // console.log(result);
    return result;
}

function buildDeclaration(declaration: types.Declaration): ts.FunctionDeclaration {
    switch (declaration.nodeType) {
        case "FunctionDecl":
            return buildFunctionDecl(declaration);
    }
}

function buildFunctionDecl(functionDecl: types.FunctionDecl): ts.FunctionDeclaration {
    const name = getIdentifier(functionDecl.name);
    const parameters: ts.ParameterDeclaration[] = functionDecl.parameters.map(buildParameterDecl);
    const body: ts.Block = buildBlock(functionDecl.body);

    return ts.createFunctionDeclaration(
        /* decorators */ undefined,
        /* modifiers */ undefined,
        /* asteriskToken */ undefined,
        /* name */ name,
        /* typeParameters */ undefined,
        /* parameters */ parameters, // TODO: pass params
        /* type */ undefined,
        /* body */ body
        );
}

function buildParameterDecl(parameterDecl: types.ParameterDecl): ts.ParameterDeclaration {
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
    const statements = block.statements.map(buildStatement);

    return ts.createBlock(
        /* statements */ statements,
        /* multiline */ true
    )
}

function buildStatement(statement: types.Statement): ts.Statement {
    switch (statement.nodeType) {
        case "ExpressionStatement":
            return buildExpressionStatement(statement);
    }
}

function buildExpressionStatement(expressionStatement: types.ExpressionStatement): ts.ExpressionStatement {
    const expression = buildExpression(expressionStatement.expression);

    return ts.createExpressionStatement(expression);
}

function buildExpression(expression: types.Expression): ts.Expression {
    switch (expression.nodeType) {
        case "VariableAccess":
            return buildVariableAccess(expression);
        case "AssignmentExpression":
            return buildAssignmentExpression(expression);
    }
}

function buildVariableAccess(variableAccess: types.VariableAccess): ts.Expression {
    const identifier = getIdentifier(variableAccess.variable);

    return ts.createIdentifier(identifier);
}

function buildAssignmentExpression(assignmentExpression: types.AssignmentExpression): ts.BinaryExpression {
    const left = buildVariableAccess(assignmentExpression.left);
    const right = buildExpression(assignmentExpression.right);

    return ts.createBinary(
        /* left */ left,
        /* operator */ ts.SyntaxKind.EqualsToken,
        /* right */ right
    );
}

function getIdentifier(identifier: types.Identifier): string {
    return identifier.nodeId; // TODO: prettify name; add pretty name generator to class (e.g. use alphabet letters...)
}

if (!module.parent) {
    main();
}