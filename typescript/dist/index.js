"use strict";
exports.__esModule = true;
var yargs = require("yargs");
var fs = require("fs");
var Ajv = require("ajv");
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
        .option("refactorings", {
        describe: "List of refactorings to be applied",
        type: "string",
        array: true,
        "default": []
    })
        .option("result", {
        describe: "Path to file where results should be saved",
        type: "string",
        "default": "logs/results.json"
    }).argv;
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
    var programs = solutions.map(build_1.buildProgram);
    var results = analyzePrograms(programs, opts);
    printResults(results, opts);
}
function printResults(results, opts) {
    var aggregate = aggregateResults(results, opts.refactorings);
    console.log("Total programs: " + aggregate.total + "\nTotal programs that compile: " + aggregate.compiling + "\nCompiling rate: " + aggregate.compileRate * 100 + "%");
    if (opts.refactorings) {
        console.log("Average of available refactors: " + aggregate.refactorAvg);
    }
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
function aggregateResults(results, refactorings) {
    var compiling = 0;
    var totalRefactors = 0;
    for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
        var result = results_1[_i];
        if (!result.hasError) {
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
    var refactoringPred = buildPredicate(opts.refactorings);
    return programs.map(function (program, index) {
        return analyzeProgram(program, index, opts.refactorings, refactoringPred);
    });
}
function analyzeProgram(program, index, refactorings, refactoringPred) {
    console.log("Starting to analyze program " + index);
    var filePath = "../output/programs/program_" + index + ".ts";
    var project = build_1.buildProject(program, filePath);
    var sourceFile = project.getSourceFileOrThrow(filePath);
    // Compiling info
    var diagnostics = sourceFile.getPreEmitDiagnostics();
    // Refactor info
    var refactorsInfo = getRefactorInfo(project, sourceFile.compilerNode, refactorings, refactoringPred);
    console.log("Finished analyzing program " + index);
    return {
        path: sourceFile.getFilePath(),
        program: sourceFile.getFullText(),
        hasError: diagnostics.length > 0,
        errors: project.formatDiagnosticsWithColorAndContext(diagnostics),
        refactors: refactorsInfo
    };
}
var REFACTOR_TO_PRED = new Map([
    ["Convert to template string", isStringConcat],
    ["Convert parameters to destructured object", isFunctionLike],
]);
function isStringConcat(node) {
    return ts_morph_1.ts.isBinaryExpression(node); // TODO: can we add more checks to this?
}
function isFunctionLike(node) {
    return ts_morph_1.ts.isFunctionLike(node);
}
function buildPredicate(enabledRefactorings) {
    var preds = [];
    enabledRefactorings.forEach(function (refactoring) {
        var pred = REFACTOR_TO_PRED.get(refactoring);
        if (!pred) {
            throw new Error("Could not find node predicate for refactoring '" + refactoring + "'.\nTo try and apply a refactoring, you need to first implement a predicate over nodes.\nThe predicate specifies to which nodes we should consider applying the refactoring.");
        }
        preds.push(pred);
    });
    return function (node) {
        return preds.some(function (pred) { return pred(node); });
    };
}
function getRefactorInfo(project, file, enabledRefactorings, pred) {
    var refactorsInfo = [];
    visit(file);
    return refactorsInfo;
    function visit(node) {
        if (pred(node)) {
            var refactorInfo = getApplicableRefactors(project, node).filter(function (refactorInfo) {
                return enabledRefactorings.includes(refactorInfo.name);
            });
            // TODO: remove duplicates?
            refactorInfo.forEach(function (refactor) {
                refactor.actions.forEach(function (action) {
                    var edit = getEditInfo(project, node, refactor.name, action.name);
                    if (edit) {
                        refactorsInfo.push({
                            name: refactor.name,
                            action: action.name,
                            editInfo: edit,
                            range: { pos: node.pos, end: node.end }
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
    console_1.assert((editInfo === null || editInfo === void 0 ? void 0 : editInfo.commands) === undefined, "We cannot deal with refactorings which include commands.");
    return editInfo;
}
if (!module.parent) {
    main();
}
//# sourceMappingURL=index.js.map