"use strict";
exports.__esModule = true;
var yargs = require("yargs");
var fs = require("fs");
var Ajv = require("ajv");
var ts = require("typescript");
var SCHEMA = JSON.parse(fs.readFileSync("schema/types.json", { encoding: "utf-8" }));
var ENTRY_ID = "Program$0";
function main() {
    var args = yargs
        .usage("To do")
        .option("solution", {
        describe: "Path to file containing the Alloy metamodel solutions",
        type: "string",
        "default": "../output/alloySolutions.json"
    }).argv;
    tsdolly(args);
}
function tsdolly(args) {
    var solutionFile = fs.readFileSync(args.solution, { encoding: "utf-8" });
    var solutionsRaw = JSON.parse(solutionFile);
    console.log(JSON.stringify(solutionsRaw[0], undefined, 4));
    var ajv = new Ajv();
    ajv.addSchema(SCHEMA, "types");
    if (!ajv.validate({ $ref: "types#/definitions/Solutions" }, solutionsRaw)) {
        throw ajv.errors;
    }
    var solutions = solutionsRaw;
    console.log(solutions.length + " solutions found");
    var programs = solutions.map(buildProgram);
}
function buildProgram(program) {
    var declarations = ts.createNodeArray(program.declarations.map(buildDeclaration));
    var file = ts.createSourceFile("../output/program.ts", "", ts.ScriptTarget.Latest, /*setParentNodes*/ false, ts.ScriptKind.TS);
    var printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    var result = printer.printList(ts.ListFormat.MultiLine, declarations, file);
    // console.log(result);
    return result;
}
function buildDeclaration(declaration) {
    switch (declaration.nodeType) {
        case "FunctionDecl":
            return buildFunctionDecl(declaration);
    }
}
function buildFunctionDecl(functionDecl) {
    var name = getIdentifier(functionDecl.name);
    var parameters = functionDecl.parameters.map(buildParameterDecl);
    var body = buildBlock(functionDecl.body);
    return ts.createFunctionDeclaration(
    /* decorators */ undefined, 
    /* modifiers */ undefined, 
    /* asteriskToken */ undefined, 
    /* name */ name, 
    /* typeParameters */ undefined, 
    /* parameters */ parameters, // TODO: pass params
    /* type */ undefined, 
    /* body */ body);
}
function buildParameterDecl(parameterDecl) {
    var name = getIdentifier(parameterDecl.name);
    var type = buildType(parameterDecl.type);
    return ts.createParameter(
    /* decorators */ undefined, 
    /* modifiers */ undefined, 
    /* dotDotToken */ undefined, 
    /* name */ name, 
    /* questionToken */ undefined, 
    /* type */ type, 
    /* initializer */ undefined);
}
function buildType(type) {
    switch (type.nodeType) {
        case "TNumber":
        case "TString":
            return buildPrimType(type);
    }
}
function buildPrimType(type) {
    switch (type.nodeType) {
        case "TNumber":
            return ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
        case "TString":
            return ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    }
}
function buildBlock(block) {
    var statements = block.statements.map(buildStatement);
    return ts.createBlock(
    /* statements */ statements, 
    /* multiline */ true);
}
function buildStatement(statement) {
    switch (statement.nodeType) {
        case "ExpressionStatement":
            return buildExpressionStatement(statement);
    }
}
function buildExpressionStatement(expressionStatement) {
    var expression = buildExpression(expressionStatement.expression);
    return ts.createExpressionStatement(expression);
}
function buildExpression(expression) {
    switch (expression.nodeType) {
        case "VariableAccess":
            return buildVariableAccess(expression);
        case "AssignmentExpression":
            return buildAssignmentExpression(expression);
    }
}
function buildVariableAccess(variableAccess) {
    var identifier = getIdentifier(variableAccess.variable);
    return ts.createIdentifier(identifier);
}
function buildAssignmentExpression(assignmentExpression) {
    var left = buildVariableAccess(assignmentExpression.left);
    var right = buildExpression(assignmentExpression.right);
    return ts.createBinary(
    /* left */ left, 
    /* operator */ ts.SyntaxKind.EqualsToken, 
    /* right */ right);
}
function getIdentifier(identifier) {
    return identifier.nodeId; // TODO: prettify name; add pretty name generator to class (e.g. use alphabet letters...)
}
if (!module.parent) {
    main();
}
//# sourceMappingURL=index.js.map