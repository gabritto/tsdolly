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
    var opts = yargs
        .usage("To do") // TODO: write usage
        .option("solution", {
        describe: "Path to file containing the Alloy metamodel solutions",
        type: "string",
        "default": "../output/alloySolutions.json"
    })
        .option("refactorings", {
        describe: "Check which refactorings can be applied",
        type: "boolean",
        "default": false
    })
        .option("result", {
        describe: "Path to file where results should be saved",
        type: "string",
        "default": "logs/results.json"
    })
        .argv;
    tsdolly(opts);
}
function tsdolly(opts) {
    var solutionFile = fs.readFileSync(opts.solution, { encoding: "utf-8" });
    var solutionsRaw = JSON.parse(solutionFile);
    var ajv = new Ajv();
    ajv.addSchema(SCHEMA, "types");
    if (!ajv.validate({ $ref: "types#/definitions/Solutions" }, solutionsRaw)) {
        throw ajv.errors;
    }
    var solutions = solutionsRaw;
    console.log(solutions.length + " solutions found");
    var programs = solutions.map(buildProgram);
    var results = analyzePrograms(programs, opts);
    printResults(results, opts);
}
;
function printResults(results, opts) {
    var aggregate = aggregateResults(results, opts.refactorings);
    console.log("Total programs: " + aggregate.total + "\nTotal programs that compile: " + aggregate.compiling + "\nCompiling rate: " + aggregate.compileRate * 100 + "%");
    if (opts.refactorings) {
        console.log("Average of available refactors: " + aggregate.refactorAvg);
    }
    var jsonResults = JSON.stringify(results, /* replacer */ undefined, /* space */ 4);
    try {
        fs.writeFileSync(opts.result, jsonResults, { encoding: "utf8" });
        console.log("Results JSON written to " + opts.result);
    }
    catch (error) {
        console.log("Error " + error + " found while writing results to file " + opts.result + ".\n\tResults:\n " + jsonResults);
    }
}
function aggregateResults(results, refactorings) {
    var compiling = 0;
    var totalRefactors = 0;
    for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
        var result = results_1[_i];
        if (!result.hasError) {
            compiling += 1;
        }
        if (refactorings) {
            totalRefactors += result.refactors.length; // TODO: get rid of bang, improve typing
        }
    }
    return {
        total: results.length,
        compiling: compiling,
        compileRate: compiling / results.length,
        refactorAvg: refactorings ? totalRefactors / results.length : undefined
    };
}
function buildProject(program, filePath) {
    var project = new ts_morph_1.Project({ compilerOptions: COMPILER_OPTIONS });
    project.createSourceFile(filePath, program);
    return project;
}
function analyzePrograms(programs, opts) {
    return programs.map(function (program, index) { return analyzeProgram(program, index, opts.refactorings); });
}
function analyzeProgram(program, index, refactorings) {
    console.log("Starting to analyze program " + index);
    var filePath = "../output/programs/program_" + index + ".ts";
    var project = buildProject(program, filePath);
    var sourceFile = project.getSourceFileOrThrow(filePath);
    // Compiling info
    var diagnostics = sourceFile.getPreEmitDiagnostics();
    // Refactor info
    var refactors = refactorings ? getApplicableRefactors(project, sourceFile) : undefined;
    console.log("Finished analyzing program " + index);
    return {
        path: sourceFile.getFilePath(),
        program: sourceFile.getFullText(),
        hasError: diagnostics.length > 0,
        errors: project.formatDiagnosticsWithColorAndContext(diagnostics),
        refactors: refactors ? Array.from(refactors) : undefined
    };
}
function getApplicableRefactors(project, file) {
    var refactors = new Set();
    var languageService = project.getLanguageService();
    for (var position = file.getStart(); position < file.getEnd(); position++) { // TODO: make this more efficient, node-based
        var refactorsAtPosition = languageService.compilerObject.getApplicableRefactors(file.getFilePath(), position, /* preferences */ undefined);
        refactorsAtPosition.forEach(function (refactor) { return refactors.add(refactor.name); });
    }
    return refactors;
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
        case "ClassDecl":
            return buildClassDecl(declaration);
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
function buildClassDecl(classDecl) {
    var name = getIdentifier(classDecl.name);
    var heritageClauses = [];
    if (classDecl.extend != null) {
        var parentClassName = getIdentifier(classDecl.extend.name);
        var parentClass = ts_morph_1.ts.createExpressionWithTypeArguments(
        /* typeArguments */ undefined, 
        /* expression */ ts_morph_1.ts.createIdentifier(parentClassName));
        var heritageClause = ts_morph_1.ts.createHeritageClause(
        /* token */ ts_morph_1.ts.SyntaxKind.ExtendsKeyword, 
        /* types */ [parentClass]);
        heritageClauses.push(heritageClause);
    }
    var methods = classDecl.methods.map(buildMethodDecl);
    return ts_morph_1.ts.createClassDeclaration(
    /* decorators */ undefined, 
    /* modifiers */ undefined, 
    /* name */ name, 
    /* typeParameters */ undefined, 
    /* heritageClauses */ heritageClauses, 
    /* members */ methods);
}
function buildMethodDecl(methodDecl) {
    var name = getIdentifier(methodDecl.name);
    var parameters = methodDecl.parameters.map(buildParameterDecl);
    var body = buildBlock(methodDecl.body);
    return ts_morph_1.ts.createMethod(
    /* decorators */ undefined, 
    /* modifiers */ undefined, 
    /* asteriskToken */ undefined, 
    /* name */ name, 
    /* questionToken */ undefined, 
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
        case "FunctionCall":
            return buildFunctionCall(expression);
        case "StringConcat":
            return buildStringConcat(expression);
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
function buildFunctionCall(functionCall) {
    var identifier = ts_morph_1.ts.createIdentifier(getIdentifier(functionCall.name));
    var args = functionCall.arguments.map(buildExpression);
    return ts_morph_1.ts.createCall(
    /* expression */ identifier, 
    /* typeArguments */ undefined, 
    /* argumentsArray */ args);
}
function buildStringConcat(stringConcat) {
    return buildStringConcatWorker(stringConcat.concat);
}
function buildStringConcatWorker(strings) {
    if (strings.length === 0) {
        throw new Error("Expected at least one element in string concat array");
    }
    if (strings.length == 1) {
        var s_1 = strings[0];
        return buildStringConcatElement(s_1);
    }
    var s = strings[0], rest = strings.slice(1);
    return ts_morph_1.ts.createBinary(
    /* left */ buildStringConcatElement(s), 
    /* operator */ ts_morph_1.ts.SyntaxKind.PlusToken, 
    /* right */ buildStringConcatWorker(rest));
}
function buildStringConcatElement(s) {
    switch (s.nodeType) {
        case "StringLiteral":
            return buildStringLiteral(s);
        case "VariableAccess":
            return buildVariableAccess(s); // TODO: do we need to parenthesize those?
    }
}
function buildStringLiteral(stringLiteral) {
    return ts_morph_1.ts.createStringLiteral(stringLiteral.nodeId);
}
function getIdentifier(identifier) {
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
//# sourceMappingURL=index.js.map