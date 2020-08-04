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
        .option("refactorings", {
        describe: "List of refactorings to be analyzed",
        type: "string",
        array: true,
        "default": []
    })
        .option("applyRefactorings", {
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
        type: "number"
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
    if (opts.first) {
        console_1.assert(opts.first >= 0, "Expected option 'first' to be a natural number, but it is " + opts.first + ".");
        solutions = solutions.slice(0, opts.first);
    }
    console.log(solutions.length + " solutions will be analyzed");
    var programs = solutions.map(build_1.buildProgram);
    var results = analyzePrograms(programs, opts);
    printResults(results, opts);
}
function printResults(results, opts) {
    var aggregate = aggregateResults(results);
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
    var refactoringPred = buildPredicate(opts.refactorings);
    return programs.map(function (program, index) {
        return analyzeProgram(program, index, opts.refactorings, opts.applyRefactorings, refactoringPred);
    });
}
function analyzeProgram(program, index, refactorings, applyRefactorings, refactoringPred) {
    console.log("Starting to analyze program " + index);
    // const filePath = `../output/programs/program_${index}.ts`;
    var filePath = "program.ts";
    var project = build_1.buildProject(program, filePath);
    var sourceFile = project.getSourceFileOrThrow(filePath);
    // Compiling info
    var diagnostics = sourceFile.getPreEmitDiagnostics();
    // Refactor info
    var refactorsInfo = getRefactorInfo(project, sourceFile.compilerNode, applyRefactorings, refactorings, refactoringPred);
    console.log("Finished analyzing program " + index);
    return {
        program: projectToProgram(project),
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
    var diagnostics = project.getPreEmitDiagnostics();
    var hasError = diagnostics.length > 0;
    var errorMessage = project.formatDiagnosticsWithColorAndContext(diagnostics);
    return {
        files: files,
        diagnostics: diagnostics,
        errorMessage: errorMessage,
        hasError: hasError,
        compilerOptions: project.getCompilerOptions()
    };
}
var REFACTOR_TO_PRED = new Map([
    ["Convert to template string", isStringConcat],
    ["Convert parameters to destructured object", isParameter],
]);
function isStringConcat(node) {
    return ts_morph_1.ts.isBinaryExpression(node); // TODO: can we add more checks to this?
}
function isParameter(node) {
    return ts_morph_1.ts.isParameter(node);
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
function getRefactorInfo(project, file, applyRefactorings, enabledRefactorings, pred) {
    var refactorsInfo = [];
    visit(file);
    refactorsInfo = _.uniqWith(refactorsInfo, function (a, b) { return _.isEqual(a.editInfo, b.editInfo); });
    if (applyRefactorings) {
        return refactorsInfo.map(function (refactorInfo) {
            return __assign(__assign({}, refactorInfo), { resultingProgram: getRefactorResult(project, refactorInfo) });
        });
    }
    return refactorsInfo;
    function visit(node) {
        if (pred(node)) {
            var refactorInfo = getApplicableRefactors(project, node).filter(function (refactorInfo) {
                return enabledRefactorings.includes(refactorInfo.name);
            });
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
// // This implementation was copied from TypeScript's `ts.textChanges.applyChanges`.
// function applyChanges(text: string, changes: readonly ts.TextChange[]): string {
//     for (const change of changes) {
//         const { span, newText } = change;
//         text = `${text.substring(0, span.start)}${newText}${text.substring(
//             span.start + span.length
//         )}`;
//     }
//     return text;
// }
if (!module.parent) {
    main();
}
//# sourceMappingURL=index.js.map