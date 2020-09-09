"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
exports.process = exports.CLI_OPTIONS = exports.Refactoring = void 0;
var yargs = require("yargs");
var fs = require("fs");
var Ajv = require("ajv");
var _ = require("lodash");
var path = require("path");
var StreamArray = require("stream-json/streamers/StreamArray");
var perf_hooks_1 = require("perf_hooks");
var ts_morph_1 = require("ts-morph");
var console_1 = require("console");
var stream_1 = require("stream");
var build_1 = require("./build");
var ROOT_DIR = path.join(path.resolve(__dirname), ".."); // "tsdolly/typescript" dir
var SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "schema", "types.json"), {
    encoding: "utf-8"
}));
var Refactoring;
(function (Refactoring) {
    Refactoring["ConvertParamsToDestructuredObject"] = "Convert parameters to destructured object";
    Refactoring["ConvertToTemplateString"] = "Convert to template string";
    Refactoring["GenerateGetAndSetAccessors"] = "Generate 'get' and 'set' accessors";
    Refactoring["ExtractSymbol"] = "Extract Symbol";
    Refactoring["MoveToNewFile"] = "Move to a new file";
})(Refactoring = exports.Refactoring || (exports.Refactoring = {}));
exports.CLI_OPTIONS = {
    solution: {
        describe: "Path to file containing the Alloy metamodel solutions",
        type: "string",
        demandOption: true
    },
    refactoring: {
        describe: "Refactoring to be analyzed",
        choices: Object.values(Refactoring),
        demandOption: true
    },
    applyRefactoring: {
        describe: "Whether we should apply available refactorings",
        type: "boolean",
        "default": true
    },
    result: {
        describe: "Path to file where results should be saved",
        type: "string",
        demandOption: true
    },
    first: {
        describe: "Consider only the first n solutions",
        type: "number",
        conflicts: "skip"
    },
    skip: {
        describe: "If specified, only one out of every n solutions will be analyzed",
        type: "number",
        conflicts: "first"
    },
    performance: {
        describe: "Path to file where performance entries should be saved. \
            Performance entries will be discarded if unspecified.",
        type: "string"
    }
};
function main() {
    var opts = yargs.usage("$0 [args]").options(exports.CLI_OPTIONS).argv;
    process(opts);
}
function process(opts) {
    perf_hooks_1.performance.mark("start_process");
    var input = fs.createReadStream(opts.solution, { encoding: "utf-8" }); // Input file stream
    var jsonParser = StreamArray.withParser(); // JSON strings to objects transform stream
    var processor = new Processor(opts); // TSDolly processing transform stream
    var jsonStringer = new Stringer(); // Objects to JSON array string stream
    var output = fs.createWriteStream(opts.result, { encoding: "utf-8" }); // Output file stream
    var stream = stream_1.pipeline(input, jsonParser, processor, jsonStringer, output, function (err) {
        if (err) {
            console.log("Pipeline failed");
            throw err;
        }
    });
    stream_1.finished(stream, function (err) {
        if (err) {
            console.log("Stream failed");
            throw err;
        }
        perf_hooks_1.performance.mark("end_process");
        printAggregateResults(processor.getAggregateResults());
        console.log("Results written to " + opts.result);
    });
    if (opts.performance) {
        registerPerformance(opts.performance);
    }
}
exports.process = process;
function registerPerformance(path) {
    try {
        fs.writeFileSync(path, "", {
            encoding: "utf-8"
        });
    }
    catch (error) {
        console.log("Error " + error + " found while cleaning contents of performance file " + path + ".");
    }
    new perf_hooks_1.PerformanceObserver(function (list, observer) {
        var perfEntries = list.getEntries().map(function (entry) { return JSON.stringify(entry, 
        /* replacer */ undefined, 
        /* space */ 0); });
        try {
            // Performance will be a JSONL file
            fs.appendFileSync(path, "\n" + perfEntries.join("\n"), {
                encoding: "utf-8"
            });
            console.log("Performance entries appended to " + path);
        }
        catch (error) {
            console.log("Error " + error + " found while writing performance entries to file " + path + ".\n\tEntries:\n" + perfEntries);
        }
    }).observe({ entryTypes: ["mark"], buffered: true });
}
var Stringer = /** @class */ (function (_super) {
    __extends(Stringer, _super);
    function Stringer() {
        var _this = _super.call(this, { writableObjectMode: true }) || this;
        _this.isFirst = true;
        return _this;
    }
    Stringer.prototype._transform = function (obj, _encoding, callback) {
        var str = JSON.stringify(obj, undefined, 4);
        if (this.isFirst) {
            str = "[" + str;
        }
        else {
            str = ",\n" + str;
        }
        this.isFirst = false;
        this.push(str);
        callback();
    };
    Stringer.prototype._flush = function (callback) {
        this.push("\n]");
        callback();
    };
    return Stringer;
}(stream_1.Transform));
var Processor = /** @class */ (function (_super) {
    __extends(Processor, _super);
    function Processor(opts) {
        var _this = _super.call(this, { writableObjectMode: true, readableObjectMode: true }) || this;
        _this.solutionCount = 0;
        _this.sampleCount = 0;
        _this.nextSample = -1;
        _this.compiling = 0;
        _this.refactorable = 0;
        _this.ajv = new Ajv();
        _this.ajv.addSchema(SCHEMA, "types");
        _this.opts = validateOpts(opts);
        var refactoringPred = REFACTOR_TO_PRED.get(opts.refactoring);
        if (!refactoringPred) {
            throw new Error("Could not find node predicate for refactoring '" + opts.refactoring + "'.\nTo try and apply a refactoring, you need to first implement a predicate over nodes.\nThis predicate specifies to which nodes we should consider applying the refactoring.");
        }
        _this.refactoringPred = refactoringPred;
        return _this;
    }
    Processor.prototype._transform = function (obj, _encoding, callback) {
        this.processObject(obj.value);
        callback();
    };
    Processor.prototype.getAggregateResults = function () {
        return {
            total: this.solutionCount,
            sampled: this.sampleCount,
            compiling: this.compiling,
            compileRate: this.compiling / this.sampleCount,
            refactorable: this.refactorable,
            refactorableRate: this.refactorable / this.sampleCount
        };
    };
    Processor.prototype.processObject = function (rawSolution) {
        if (!this.ajv.validate({ $ref: "types#/definitions/Program" }, rawSolution)) {
            throw new Error("Validation error.\nObject: " + JSON.stringify(rawSolution, undefined, 4) + "\nAjv error: \n" + this.ajv.errorsText());
        }
        var solution = rawSolution;
        if (this.shouldSample()) {
            console.log("Solution #" + this.solutionCount + " will be analyzed");
            this.sampleCount += 1;
            this.push(this.processProgram(solution)); // Push result to output of Transform Stream
        }
        // Update solution count
        this.solutionCount += 1;
    };
    Processor.prototype.shouldSample = function () {
        if (this.opts.first) {
            return this.solutionCount < this.opts.first;
        }
        // TODO: this strategy means we could potentially not sample the last "chunk",
        // because `nextSample` could be larger than total solutions.
        if (this.opts.skip) {
            var chunkSize = this.opts.skip;
            if (this.solutionCount % chunkSize === 0) {
                this.nextSample =
                    _.random(0, chunkSize - 1, false) + this.solutionCount;
            }
            return this.nextSample === this.solutionCount;
        }
        return true;
    };
    Processor.prototype.processProgram = function (solution) {
        perf_hooks_1.performance.mark("start_buildProgram");
        var program = build_1.buildProgram(solution);
        perf_hooks_1.performance.mark("end_buildProgram");
        var result = analyzeProgram(program, this.solutionCount, this.opts.refactoring, this.opts.applyRefactoring, this.refactoringPred);
        this.aggregateResult(result);
        return result;
    };
    Processor.prototype.aggregateResult = function (result) {
        if (!result.program.hasError) {
            this.compiling += 1;
        }
        if (result.refactors.length > 0) {
            this.refactorable += 1;
        }
    };
    return Processor;
}(stream_1.Transform));
function validateOpts(opts) {
    if (opts.first) {
        console_1.assert(opts.first > 0, "Expected option 'first' to be a positive integer, but it is " + opts.first + ".");
    }
    if (opts.skip) {
        console_1.assert(opts.skip > 0, "Expected option 'skip' to be a positive integer, but it is " + opts.skip + ".");
    }
    return opts;
}
function printAggregateResults(aggregate) {
    console.log("\nTotal programs: " + aggregate.total + "\nTotal programs sampled and analyzed: " + aggregate.sampled + "\nTotal programs that compile: " + aggregate.compiling + "\nCompiling rate: " + aggregate.compileRate * 100 + "%\nPrograms that can be refactored (refactorable): " + aggregate.refactorable + "\nRefactorable rate: " + aggregate.refactorableRate * 100 + "%\n");
}
function analyzeProgram(programText, index, refactoring, applyRefactoring, refactoringPred) {
    perf_hooks_1.performance.mark("start_analyzeProgram");
    console.log("Starting to analyze program " + index);
    var filePath = "program.ts";
    var project = build_1.buildProject(programText, filePath);
    var program = projectToProgram(project);
    var sourceFile = project.getSourceFileOrThrow(filePath);
    // Refactor info
    var refactorsInfo = getRefactorInfo(project, program, sourceFile.compilerNode, applyRefactoring, refactoring, refactoringPred);
    console.log("Finished analyzing program " + index);
    perf_hooks_1.performance.mark("end_analyzeProgram");
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
    var tsDiagnostics = project
        .getPreEmitDiagnostics()
        .filter(function (d) { return d.getCategory() === ts_morph_1.ts.DiagnosticCategory.Error; });
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
var REFACTOR_TO_PRED = new Map([
    [Refactoring.ConvertParamsToDestructuredObject, isParameter],
    [Refactoring.ConvertToTemplateString, isStringConcat],
    [Refactoring.GenerateGetAndSetAccessors, isField],
    [Refactoring.ExtractSymbol, isCallOrLiteral],
    [Refactoring.MoveToNewFile, isTopLevelDeclaration],
]);
function isStringConcat(node) {
    return ts_morph_1.ts.isStringLiteral(node) && ts_morph_1.ts.isBinaryExpression(node.parent);
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
    perf_hooks_1.performance.mark("start_getRefactorInfo");
    var refactorsInfo = [];
    visit(file);
    refactorsInfo = _.uniqWith(refactorsInfo, function (a, b) {
        return _.isEqual(a.editInfo, b.editInfo);
    });
    if (applyRefactoring) {
        // TODO: should we apply refactorings even when program has error?
        for (var _i = 0, refactorsInfo_1 = refactorsInfo; _i < refactorsInfo_1.length; _i++) {
            var refactorInfo = refactorsInfo_1[_i];
            refactorInfo.resultingProgram = getRefactorResult(project, refactorInfo);
            if (refactorInfo.resultingProgram.hasError && !program.hasError) {
                refactorInfo.introducesError = true;
            }
        }
    }
    perf_hooks_1.performance.mark("end_getRefactorInfo");
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
    console_1.assert((editInfo === null || editInfo === void 0 ? void 0 : editInfo.commands) === undefined, "We cannot deal with refactorings which include commands.");
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
    perf_hooks_1.performance.mark("start_main_process");
    main();
    perf_hooks_1.performance.mark("end_main_process");
}
//# sourceMappingURL=process.js.map