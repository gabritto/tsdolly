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
var Chain = require("stream-chain");
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
    var input = fs.createReadStream(opts.solution, { encoding: "utf-8" });
    var jsonParser = StreamArray.withParser();
    var processor = new Process(opts);
    // const jsonStringer = stringer() as Transform;
    var jsonStringer = new Stringer({ writableObjectMode: true });
    var output = fs.createWriteStream(opts.result, { encoding: "utf-8" });
    var chain = new Chain([
        jsonParser,
        processor.processObject,
        jsonStringer
    ]);
    chain.on("error", function (err) {
        console.error("Chain failed: " + err.name + "\n" + err.message + "\n" + err.stack);
        throw err;
    });
    var stream = input.pipe(chain).pipe(output);
    // TODO: call processor.getAggregateResults on chain.finish
    stream.on("finish", function () {
        perf_hooks_1.performance.mark("end_process");
        if (opts.performance) {
            var perfEntries = JSON.stringify(perf_hooks_1.performance, 
            /* replacer */ undefined, 
            /* space */ 4);
            try {
                fs.writeFileSync(opts.performance, perfEntries, {
                    encoding: "utf-8"
                });
                console.log("Performance entries written to " + opts.performance);
            }
            catch (error) {
                console.log("Error " + error + " found while writing performance entries to file " + opts.performance + ".\n\tEntries:\n" + perfEntries);
            }
        }
    });
    console.log("OIIII");
}
exports.process = process;
var Stringer = /** @class */ (function (_super) {
    __extends(Stringer, _super);
    function Stringer() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
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
    Stringer.prototype._flush = function () {
        this.push("\n]");
    };
    return Stringer;
}(stream_1.Transform));
var Process = /** @class */ (function () {
    function Process(opts) {
        var _this = this;
        this.solutionCount = 0;
        this.nextSample = -1;
        this.compiling = 0;
        this.refactorable = 0;
        this.processObject = function (obj) {
            // TODO: add perf marks.
            var rawSolution = obj.value;
            if (!_this.ajv.validate({ $ref: "types#/definitions/Program" }, rawSolution)) {
                console.log("Validation error");
                throw new Error("Object: " + JSON.stringify(rawSolution, undefined, 4) + "\nAjv error: \n" + _this.ajv.errorsText());
            }
            var solution = rawSolution;
            var result = undefined;
            if (_this.shouldSample()) {
                console.log("Should sample");
                console.log("Solution #" + _this.solutionCount + " will be analyzed");
                result = _this.processProgram(solution);
            }
            // Update count
            _this.solutionCount += 1;
            return result;
        };
        this.ajv = new Ajv();
        this.ajv.addSchema(SCHEMA, "types");
        this.opts = validateOpts(opts);
        var refactoringPred = REFACTOR_TO_PRED.get(opts.refactoring);
        if (!refactoringPred) {
            throw new Error("Could not find node predicate for refactoring '" + opts.refactoring + "'.\nTo try and apply a refactoring, you need to first implement a predicate over nodes.\nThis predicate specifies to which nodes we should consider applying the refactoring.");
        }
        this.refactoringPred = refactoringPred;
    }
    Process.prototype.getAggregateResults = function () {
        return {
            total: this.solutionCount,
            compiling: this.compiling,
            compileRate: this.compiling / this.solutionCount,
            refactorable: this.refactorable,
            refactorableRate: this.refactorable / this.solutionCount
        };
    };
    Process.prototype.shouldSample = function () {
        if (this.opts.first) {
            return this.solutionCount < this.opts.first;
        }
        // TODO: this strategy means we could potentially not sample the last "chunk",
        // because `nextSample` could be larger than total solutions.
        if (this.opts.skip) {
            var chunkSize = this.opts.skip;
            if (this.solutionCount % chunkSize === 0) {
                this.nextSample = _.random(0, chunkSize - 1, false) + this.solutionCount;
            }
            return this.nextSample === this.solutionCount;
        }
        return true;
    };
    Process.prototype.processProgram = function (solution) {
        perf_hooks_1.performance.mark("start_buildProgram");
        var program = build_1.buildProgram(solution);
        perf_hooks_1.performance.mark("end_buildProgram");
        var result = analyzeProgram(program, this.solutionCount, this.opts.refactoring, this.opts.applyRefactoring, this.refactoringPred);
        this.aggregateResult(result);
        return result;
    };
    Process.prototype.aggregateResult = function (result) {
        if (!result.program.hasError) {
            this.compiling += 1;
        }
        if (result.refactors.length > 0) {
            this.refactorable += 1;
        }
    };
    return Process;
}());
function validateOpts(opts) {
    if (opts.first) {
        console_1.assert(opts.first > 0, "Expected option 'first' to be a positive integer, but it is " + opts.first + ".");
    }
    if (opts.skip) {
        console_1.assert(opts.skip > 0, "Expected option 'skip' to be a positive integer, but it is " + opts.skip + ".");
    }
    return opts;
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
    return ts_morph_1.ts.isBinaryExpression(node); // TODO: should we add more checks to this?
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
    main();
}
//# sourceMappingURL=process.js.map