import yargs = require("yargs");
import fs = require("fs");
import Ajv = require("ajv");
// import ts = require("typescript");

import * as types from "./types";
import { Project, SourceFile, ts, HeritageClause } from "ts-morph";

type Object = { [key: string]: object };
type Schema = { definitions: Object };
const SCHEMA: Schema  = JSON.parse(fs.readFileSync("schema/types.json", { encoding: "utf-8" }));
const COMPILER_OPTIONS = {
    strict: true,
    target: ts.ScriptTarget.Latest,
    noEmit: true,
};

function main(): void {
    const args = yargs
        .usage("To do") // TODO: write usage
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
    const ajv = new Ajv();
    ajv.addSchema(SCHEMA, "types");
    if (!ajv.validate({ $ref: "types#/definitions/Solutions" }, solutionsRaw)) {
        throw ajv.errors;
    }
    const solutions = solutionsRaw as types.Solutions;
    console.log(`${solutions.length} solutions found`);
    const programs = solutions.map(buildProgram);
    const results = analyzePrograms(programs);


    printResults(results);
}

interface Result {
    path: string,
    program: string,
    hasError: boolean,
    errors: string,
    refactors: string[], // Currently name of refactor. TODO: change this to have more info on refactors (e.g. action, position)
};

function printResults(results: Result[]): void {
    const aggregate = aggregateResults(results);

    console.log(`Total programs: ${aggregate.total}
Total programs that compile: ${aggregate.compiling}
Compiling rate: ${aggregate.compileRate * 100}%
Average of available refactors: ${aggregate.refactorAvg}`);

    const jsonResults = JSON.stringify(results, /* replacer */ undefined, /* space */ 4);
    console.log(`Results as JSON:\n\n${jsonResults}`);
}

interface AggregateResult {
    total: number,
    compiling: number,
    compileRate: number,
    refactorAvg: number,
}

function aggregateResults(results: Result[]): AggregateResult {
    let compiling = 0;
    let totalRefactors = 0;
    for (const result of results) {
        if (!result.hasError) {
            compiling += 1;
        }
        totalRefactors += result.refactors.length;
    }

    return {
        total: results.length,
        compiling,
        compileRate: compiling / results.length,
        refactorAvg: totalRefactors / results.length,
    }
}

function buildProject(program: string, filePath: string): Project {
    const project = new Project({ compilerOptions: COMPILER_OPTIONS });
    project.createSourceFile(filePath, program);
    return project;
}

function analyzeProgram(program: string, index: number): Result {
    console.log(`Starting to analyze program ${index}`);
    const filePath = `../output/programs/program_${index}.ts`;
    const project = buildProject(program, filePath);
    const sourceFile = project.getSourceFileOrThrow(filePath);

    // Compiling info
    const diagnostics = sourceFile.getPreEmitDiagnostics();

    // Refactor info
    const refactors: Set<string> = new Set();
    for (let position = sourceFile.getStart(); position < sourceFile.getEnd(); position++) {
        const refactorsAtPosition = getApplicableRefactors(project, sourceFile, position);
        refactorsAtPosition.forEach(refactor => refactors.add(refactor.name));
    }

    console.log(`Finished analyzing program ${index}`);
    return {
        path: sourceFile.getFilePath(),
        program: sourceFile.getFullText(),
        hasError: diagnostics.length > 0,
        errors: project.formatDiagnosticsWithColorAndContext(diagnostics),
        refactors: Array.from(refactors),
    };
}

function analyzePrograms(programs: string[]): Result[] {
    return programs.map(analyzeProgram);
}

function getApplicableRefactors(project: Project, file: SourceFile, position: number): ts.ApplicableRefactorInfo[] {
    const languageService = project.getLanguageService();
    return languageService.compilerObject.getApplicableRefactors(file.getFilePath(), position, /* preferences */ undefined);
}

function buildProgram(program: types.Program): string {    
    const declarations = ts.createNodeArray(program.declarations.map(buildDeclaration));
    const file = ts.createSourceFile("../output/program.ts", "", COMPILER_OPTIONS.target, /* setParentNodes */ false, ts.ScriptKind.TS); // TODO: refactor to use same options
    
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const result = printer.printList(ts.ListFormat.MultiLine, declarations, file);
    return result;
}

function buildDeclaration(declaration: types.Declaration): ts.Declaration {
    switch (declaration.nodeType) {
        case "FunctionDecl":
            return buildFunctionDecl(declaration);
        case "ClassDecl":
            return buildClassDecl(declaration);
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

    return ts.createClassDeclaration(
        /* decorators */ undefined,
        /* modifiers */ undefined,
        /* name */ name,
        /* typeParameters */ undefined,
        /* heritageClauses */ heritageClauses,
        /* members */ methods
    );
}

function buildMethodDecl(methodDecl: types.MethodDecl): ts.MethodDeclaration {
    const name = getIdentifier(methodDecl.name);
    const parameters: ts.ParameterDeclaration[] = methodDecl.parameters.map(buildParameterDecl);
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
        case "FunctionCall":
            return buildFunctionCall(expression);
        case "StringConcat":
            return buildStringConcat(expression);
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

function buildFunctionCall(functionCall: types.FunctionCall): ts.CallExpression {
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

function buildStringConcatWorker(strings: (types.StringLiteral | types.VariableAccess)[]): ts.Expression {
    if (strings.length === 0) {
        throw new Error("Expected at least one element in string concat array");
    }
    if (strings.length == 1) {
        const [s] = strings;
        return buildStringConcatElement(s);
    }

    const [s, ...rest] = strings;
    return ts.createBinary(
        /* left */ buildStringConcatElement(s),
        /* operator */ ts.SyntaxKind.PlusToken,
        /* right */ buildStringConcatWorker(rest)
    );
}

function buildStringConcatElement(s: types.StringLiteral | types.VariableAccess): ts.Expression {
    switch (s.nodeType) {
        case "StringLiteral":
            return buildStringLiteral(s);
        case "VariableAccess":
            return buildVariableAccess(s); // TODO: do we need to parenthesize those?
    }
}

function buildStringLiteral(stringLiteral: types.StringLiteral): ts.StringLiteral {
    return ts.createStringLiteral(stringLiteral.nodeId);
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

if (!module.parent) {
    main();
}