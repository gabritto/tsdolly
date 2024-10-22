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
var _ = require("lodash");
var ts_morph_1 = require("ts-morph");
var console_1 = require("console");
var build_1 = require("./build");
var SCHEMA = JSON.parse(fs.readFileSync("schema/types.json", { encoding: "utf-8" }));
function main() {
    var opts = yargs
        .usage("To do") // TODO: write usage
        .option("solution", {
        describe: "Path to file containing the Alloy metamodel solutions",
        type: "string",
        demandOption: true
    })
        .option("refactoring", {
        describe: "List of refactorings to be analyzed",
        type: "string",
        choices: Object.values(Refactoring),
        demandOption: true
    })
        .option("applyRefactoring", {
        describe: "Whether we should apply the refactorings available",
        type: "boolean",
        "default": false
    })
        .option("result", {
        describe: "Path to file where results should be saved",
        type: "string",
        "default": "logs/results.json"
    })
        .option("first", {
        describe: "Consider only the first n solutions",
        type: "number",
        conflicts: "skip"
    })
        .option("skip", {
        describe: "Percentage of the solutions that will be sampled (using random sampling)",
        type: "number",
        conflicts: "first"
    })
        .epilogue("TODO: epilogue").argv;
    var cliOpts = __assign(__assign({}, opts), { refactoring: opts.refactoring });
    tsdolly(cliOpts);
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
    var total = solutions.length;
    solutions = sampleSolutions(solutions, opts);
    console.log(solutions.length + " solutions from a total of " + total + " will be analyzed");
    var programs = solutions.map(build_1.buildProgram);
    var results = analyzePrograms(programs, opts);
    printResults(results, opts);
}
function sampleSolutions(solutions, opts) {
    if (opts.first) {
        console_1.assert(opts.first > 0, "Expected option 'first' to be a positive integer, but it is " + opts.first + ".");
        console_1.assert(opts.first <= solutions.length, "Expected option 'first' to be at most the number of solutions (" + solutions.length + "), but it is " + opts.first + ".");
        return solutions.slice(0, opts.first);
    }
    if (opts.skip) {
        console_1.assert(opts.skip > 0, "Expected option 'skip' to be a positive integer, but it is " + opts.skip + ".");
        console_1.assert(opts.skip <= solutions.length, "Expected option 'skip' to be at most the number of solutions (" + solutions.length + "), but it is " + opts.skip + ".");
        return sample(solutions, opts.skip);
    }
    return solutions;
}
function sample(solutions, skip) {
    var sampledSolutions = [];
    for (var start = 0; start < solutions.length; start += skip) {
        var end = Math.min(start + skip, solutions.length);
        // We want an element between [start, end).
        var index = _.random(start, end - 1, false);
        sampledSolutions.push(solutions[index]);
    }
    return sampledSolutions;
}
function printResults(results, opts) {
    var aggregate = aggregateResults(results);
    console.log("Total programs: " + aggregate.total + "\nTotal programs that compile: " + aggregate.compiling + "\nCompiling rate: " + aggregate.compileRate * 100 + "%");
    console.log("Average of available refactors: " + aggregate.refactorAvg);
    var jsonResults = JSON.stringify(results, 
    /* replacer */ undefined, 
    /* space */ 4);
    try {
        fs.writeFileSync(opts.result, jsonResults, { encoding: "utf8" });
        console.log("Results JSON written to " + opts.result);
    }
    catch (error) {
        console.log("Error " + error + " found while writing results to file " + opts.result + ".\n\tResults:\n " + jsonResults);
    }
}
function aggregateResults(results) {
    var compiling = 0;
    var totalRefactors = 0;
    for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
        var result = results_1[_i];
        if (!result.program.hasError) {
            compiling += 1;
        }
        if (result.refactors.length > 0) {
            totalRefactors += result.refactors.length;
        }
    }
    return {
        total: results.length,
        compiling: compiling,
        compileRate: compiling / results.length,
        refactorAvg: totalRefactors / results.length
    };
}
function analyzePrograms(programs, opts) {
    var refactoringPred = REFACTOR_TO_PRED.get(opts.refactoring);
    if (!refactoringPred) {
        throw new Error("Could not find node predicate for refactoring '" + opts.refactoring + "'.\nTo try and apply a refactoring, you need to first implement a predicate over nodes.\nThis predicate specifies to which nodes we should consider applying the refactoring.");
    }
    return programs.map(function (program, index) {
        return analyzeProgram(program, index, opts.refactoring, opts.applyRefactoring, refactoringPred);
    });
}
function analyzeProgram(programText, index, refactoring, applyRefactoring, refactoringPred) {
    console.log("Starting to analyze program " + index);
    // const filePath = `../output/programs/program_${index}.ts`;
    var filePath = "program.ts";
    var project = build_1.buildProject(programText, filePath);
    var sourceFile = project.getSourceFileOrThrow(filePath);
    var program = projectToProgram(project);
    // Refactor info
    var refactorsInfo = getRefactorInfo(project, program, sourceFile.compilerNode, applyRefactoring, refactoring, refactoringPred);
    console.log("Finished analyzing program " + index);
    return {
        program: program,
        refactors: refactorsInfo
    };
}
function projectToProgram(project) {
    var files = project.getSourceFiles().map(function (file) {
        return {
            fileName: file.getFilePath(),
            text: file.getFullText()
        };
    });
    var diagnostics = getCompilerError(project);
    var hasError = diagnostics.length > 0;
    return {
        files: files,
        errors: diagnostics,
        hasError: hasError,
        compilerOptions: project.getCompilerOptions()
    };
}
function getCompilerError(project) {
    var tsDiagnostics = project.getPreEmitDiagnostics().filter(function (d) { return d.getCategory() === ts_morph_1.ts.DiagnosticCategory.Error; });
    return tsDiagnostics.map(diagnosticToCompilerError);
}
function diagnosticToCompilerError(diagnostic) {
    var _a;
    var messageText = "";
    var msg = diagnostic.getMessageText();
    if (typeof msg === "string") {
        messageText = msg;
    }
    else {
        // If diagnostic message is a chain, we're only getting the first message.
        messageText = msg.getMessageText();
    }
    return {
        file: (_a = diagnostic.getSourceFile()) === null || _a === void 0 ? void 0 : _a.getFilePath(),
        code: diagnostic.getCode(),
        line: diagnostic.getLineNumber(),
        start: diagnostic.getStart(),
        length: diagnostic.getLength(),
        category: diagnostic.getCategory(),
        messageText: messageText
    };
}
var Refactoring;
(function (Refactoring) {
    Refactoring["ConvertParamsToDestructuredObject"] = "Convert parameters to destructured object";
    Refactoring["ConvertToTemplateString"] = "Convert to template string";
    Refactoring["GenerateGetAndSetAccessors"] = "Generate 'get' and 'set' accessors";
    Refactoring["ExtractSymbol"] = "Extract Symbol";
    Refactoring["MoveToNewFile"] = "Move to a new file";
})(Refactoring || (Refactoring = {}));
var REFACTOR_TO_PRED = new Map([
    [Refactoring.ConvertParamsToDestructuredObject, isParameter],
    [Refactoring.ConvertToTemplateString, isStringConcat],
    [Refactoring.GenerateGetAndSetAccessors, isField],
    [Refactoring.ExtractSymbol, isCallOrLiteral],
    [Refactoring.MoveToNewFile, isTopLevelDeclaration],
]);
function isStringConcat(node) {
    return ts_morph_1.ts.isBinaryExpression(node); // TODO: can we add more checks to this?
}
function isParameter(node) {
    return ts_morph_1.ts.isParameter(node);
}
function isField(node) {
    return ts_morph_1.ts.isPropertyDeclaration(node);
}
function isCallOrLiteral(node) {
    return ts_morph_1.ts.isCallExpression(node) || ts_morph_1.ts.isLiteralExpression(node);
}
function isTopLevelDeclaration(node) {
    return ts_morph_1.ts.isFunctionDeclaration(node) || ts_morph_1.ts.isClassDeclaration(node);
}
function getRefactorInfo(project, program, file, applyRefactoring, enabledRefactoring, pred) {
    var refactorsInfo = [];
    visit(file);
    refactorsInfo = _.uniqWith(refactorsInfo, function (a, b) {
        return _.isEqual(a.editInfo, b.editInfo);
    });
    if (applyRefactoring) {
        for (var _i = 0, refactorsInfo_1 = refactorsInfo; _i < refactorsInfo_1.length; _i++) {
            var refactorInfo = refactorsInfo_1[_i];
            refactorInfo.resultingProgram = getRefactorResult(project, refactorInfo);
            if (refactorInfo.resultingProgram.hasError && !program.hasError) {
                refactorInfo.introducesError = true;
            }
        }
    }
    return refactorsInfo;
    function visit(node) {
        if (pred(node)) {
            var refactorInfo = getApplicableRefactors(project, node).filter(function (refactorInfo) { return enabledRefactoring === refactorInfo.name; });
            refactorInfo.forEach(function (refactor) {
                refactor.actions.forEach(function (action) {
                    var edit = getEditInfo(project, node, refactor.name, action.name);
                    if (edit) {
                        refactorsInfo.push({
                            name: refactor.name,
                            action: action.name,
                            editInfo: edit,
                            triggeringRange: { pos: node.pos, end: node.end }
                        });
                    }
                });
            });
        }
        node.forEachChild(visit);
    }
}
function getApplicableRefactors(project, node) {
    var languageService = project.getLanguageService().compilerObject;
    return languageService.getApplicableRefactors(node.getSourceFile().fileName, node, 
    /* preferences */ undefined);
}
function getEditInfo(project, node, refactorName, actionName) {
    var languageService = project.getLanguageService().compilerObject;
    var formatSettings = project.manipulationSettings.getFormatCodeSettings();
    var editInfo = languageService.getEditsForRefactor(node.getSourceFile().fileName, 
    /* formatOptions */ formatSettings, node, refactorName, actionName, 
    /* preferences */ undefined);
    console_1.assert((editInfo === null || editInfo === void 0 ? void 0 : editInfo.commands) === undefined &&
        (editInfo === null || editInfo === void 0 ? void 0 : editInfo.renameFilename) === undefined, "We cannot deal with refactorings which include commands or file renames.");
    return editInfo;
}
function getRefactorResult(project, refactorInfo) {
    project = cloneProject(project);
    return projectToProgram(applyRefactorEdits(project, refactorInfo));
}
function applyRefactorEdits(project, refactorInfo) {
    refactorInfo.editInfo.edits.forEach(function (change) {
        return applyFileChange(project, change);
    });
    return project;
}
function cloneProject(project) {
    var newProject = new ts_morph_1.Project({
        compilerOptions: project.getCompilerOptions()
    });
    for (var _i = 0, _a = project.getSourceFiles(); _i < _a.length; _i++) {
        var file = _a[_i];
        newProject.createSourceFile(file.getFilePath(), file.getFullText());
    }
    return newProject;
}
function applyFileChange(project, fileChange) {
    if (fileChange.isNewFile) {
        var text = singleton(fileChange.textChanges, "Text changes for a new file should only have one change.").newText;
        project.createSourceFile(fileChange.fileName, text);
    }
    else {
        var file = project.getSourceFileOrThrow(fileChange.fileName);
        file.applyTextChanges(fileChange.textChanges);
    }
}
function singleton(arr, message) {
    if (arr.length != 1) {
        throw new Error("Expected array to have exactly one item, but array has " + arr.length + " items.\n" + (message || ""));
    }
    return arr[0];
}
if (!module.parent) {
    main();
}
//# sourceMappingURL=index.js.map