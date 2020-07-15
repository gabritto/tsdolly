"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
    var results = programs.map(analyzeProgram);
    var jsonResults = JSON.stringify(results, /* replacer */ undefined, /* space */ 4);
    var compiling = count(results, function (r) { return !r.hasError; });
    console.log("Total programs: " + programs.length + "\nTotal programs that compile: " + compiling + "\nCompiling rate: " + compiling / programs.length * 100 + "%");
    console.log(jsonResults);
    // TODO: print reports
}
function count(arr, pred) {
    var total = 0;
    arr.forEach(function (elem) { if (pred(elem))
        total += 1; });
    return total;
}
function analyzeProgram(program) {
    var options = {
        strict: true,
        target: ts.ScriptTarget.Latest,
        noEmit: true
    };
    var defaultFileName = "file.ts";
    var defaultHost = ts.createCompilerHost(options);
    var host = __assign(__assign({}, defaultHost), { getSourceFile: function (fileName, languageVersion, onError, shouldCreateNewSourceFile) {
            if (fileName === defaultFileName) {
                return ts.createSourceFile(defaultFileName, program, languageVersion);
            }
            return defaultHost.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
        } });
    var tsProgram = ts.createProgram(/* fileNames */ [defaultFileName], options, host);
    var diagnostics = ts.getPreEmitDiagnostics(tsProgram);
    var formattedDiagnostics = ts.formatDiagnosticsWithColorAndContext(diagnostics, host);
    return {
        program: program,
        hasError: diagnostics.length > 0,
        errors: formattedDiagnostics
    };
    // TODO: try to apply some refactorings on programs that compile
}
function buildProgram(program) {
    var declarations = ts.createNodeArray(program.declarations.map(buildDeclaration));
    var file = ts.createSourceFile("../output/program.ts", "", ts.ScriptTarget.Latest, /*setParentNodes*/ false, ts.ScriptKind.TS); // TODO: refactor to use same options
    var printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    var result = printer.printList(ts.ListFormat.MultiLine, declarations, file);
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
    /* parameters */ parameters, 
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