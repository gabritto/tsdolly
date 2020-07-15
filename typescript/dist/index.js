"use strict";
exports.__esModule = true;
var yargs = require("yargs");
var fs = require("fs");
var Ajv = require("ajv");
var ts_morph_1 = require("ts-morph");
var SCHEMA = JSON.parse(fs.readFileSync("schema/types.json", { encoding: "utf-8" }));
var COMPILER_OPTIONS = {
    strict: true,
    target: ts_morph_1.ts.ScriptTarget.Latest,
    noEmit: true
};
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
    var ajv = new Ajv();
    ajv.addSchema(SCHEMA, "types");
    if (!ajv.validate({ $ref: "types#/definitions/Solutions" }, solutionsRaw)) {
        throw ajv.errors;
    }
    var solutions = solutionsRaw;
    console.log(solutions.length + " solutions found");
    var programs = solutions.map(buildProgram);
    var results = analyzePrograms(programs);
    printResults(results);
}
;
function printResults(results) {
    var aggregate = aggregateResults(results);
    console.log("Total programs: " + aggregate.total + "\nTotal programs that compile: " + aggregate.compiling + "\nCompiling rate: " + aggregate.compileRate * 100 + "%\nAverage of available refactors: " + aggregate.refactorAvg);
    var jsonResults = JSON.stringify(results, /* replacer */ undefined, /* space */ 4);
    console.log("Results as JSON:\n\n" + jsonResults);
}
function aggregateResults(results) {
    var compiling = 0;
    var totalRefactors = 0;
    for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
        var result = results_1[_i];
        if (!result.hasError) {
            compiling += 1;
        }
        totalRefactors += result.refactors.length;
    }
    return {
        total: results.length,
        compiling: compiling,
        compileRate: compiling / results.length,
        refactorAvg: totalRefactors / results.length
    };
}
function buildProject(program, filePath) {
    var project = new ts_morph_1.Project({ compilerOptions: COMPILER_OPTIONS });
    project.createSourceFile(filePath, program);
    return project;
}
function analyzeProgram(program, index) {
    var filePath = "../output/programs/program_" + index + ".ts";
    var project = buildProject(program, filePath);
    var sourceFile = project.getSourceFileOrThrow(filePath);
    // Compiling info
    var diagnostics = sourceFile.getPreEmitDiagnostics();
    // Refactor info
    var refactors = new Set();
    for (var position = sourceFile.getStart(); position < sourceFile.getEnd(); position++) {
        var refactorsAtPosition = getApplicableRefactors(project, sourceFile, position);
        refactorsAtPosition.forEach(function (refactor) { return refactors.add(refactor.name); });
    }
    return {
        path: sourceFile.getFilePath(),
        program: sourceFile.getFullText(),
        hasError: diagnostics.length > 0,
        errors: project.formatDiagnosticsWithColorAndContext(diagnostics),
        refactors: Array.from(refactors)
    };
}
function analyzePrograms(programs) {
    return programs.map(analyzeProgram);
}
function getApplicableRefactors(project, file, position) {
    var languageService = project.getLanguageService();
    return languageService.compilerObject.getApplicableRefactors(file.getFilePath(), position, /* preferences */ undefined);
}
function buildProgram(program) {
    var declarations = ts_morph_1.ts.createNodeArray(program.declarations.map(buildDeclaration));
    var file = ts_morph_1.ts.createSourceFile("../output/program.ts", "", COMPILER_OPTIONS.target, /* setParentNodes */ false, ts_morph_1.ts.ScriptKind.TS); // TODO: refactor to use same options
    var printer = ts_morph_1.ts.createPrinter({ newLine: ts_morph_1.ts.NewLineKind.LineFeed });
    var result = printer.printList(ts_morph_1.ts.ListFormat.MultiLine, declarations, file);
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
    return ts_morph_1.ts.createFunctionDeclaration(
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
    return ts_morph_1.ts.createParameter(
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
            return ts_morph_1.ts.createKeywordTypeNode(ts_morph_1.ts.SyntaxKind.NumberKeyword);
        case "TString":
            return ts_morph_1.ts.createKeywordTypeNode(ts_morph_1.ts.SyntaxKind.StringKeyword);
    }
}
function buildBlock(block) {
    var statements = block.statements.map(buildStatement);
    return ts_morph_1.ts.createBlock(
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
    return ts_morph_1.ts.createExpressionStatement(expression);
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
    return ts_morph_1.ts.createIdentifier(identifier);
}
function buildAssignmentExpression(assignmentExpression) {
    var left = buildVariableAccess(assignmentExpression.left);
    var right = buildExpression(assignmentExpression.right);
    return ts_morph_1.ts.createBinary(
    /* left */ left, 
    /* operator */ ts_morph_1.ts.SyntaxKind.EqualsToken, 
    /* right */ right);
}
function getIdentifier(identifier) {
    return identifier.nodeId; // TODO: prettify name; add pretty name generator to class (e.g. use alphabet letters...)
}
if (!module.parent) {
    main();
}
//# sourceMappingURL=index.js.map