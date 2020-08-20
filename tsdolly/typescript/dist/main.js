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
var path = require("path");
var cp = require("child_process");
var process_1 = require("./process");
var process_2 = require("process");
var SOLVERS = ["SAT4J", "MiniSat"];
var JAVA_OPTS = {
    "command": {
        describe: "Alloy command that should be run to generate solutions",
        type: "string"
    },
    "model": {
        describe: "Path to Alloy model file",
        type: "string"
    },
    "output": {
        describe: "Path of file where generated solutions should be saved",
        type: "string"
    },
    "solver": {
        describe: "SAT solver to be used in Alloy API",
        type: "string",
        choices: SOLVERS
    }
};
var newProcessOpts = {
    refactoring: process_1.CLI_OPTIONS.refactoring,
    applyRefactoring: process_1.CLI_OPTIONS.applyRefactoring,
    result: process_1.CLI_OPTIONS.result,
    first: process_1.CLI_OPTIONS.first,
    skip: process_1.CLI_OPTIONS.skip
};
var OPTS = __assign(__assign({}, JAVA_OPTS), newProcessOpts);
function main() {
    var opts = yargs
        .usage('$0 [args]')
        .option(OPTS)
        .argv;
    var cliOpts = __assign(__assign({}, opts), { refactoring: opts.refactoring, solver: opts.solver });
    tsdolly(cliOpts);
}
function tsdolly(opts) {
    var solutionPath = generateSolutions(opts);
    process_1.process(__assign(__assign({}, opts), { solution: solutionPath }));
}
var ROOT_DIR = path.join(path.resolve(__dirname), "..", "..");
function generateSolutions(opts) {
    var javaDir = path.join(ROOT_DIR, "java");
    var args = [];
    if (opts.command) {
        args.push("--command=\"" + opts.command + "\"");
    }
    if (opts.model) {
        args.push("--model=\"" + opts.model + "\"");
    }
    if (opts.output) {
        args.push("--output=\"" + path.resolve(process_2.cwd(), opts.output) + "\"");
    }
    if (opts.solver) {
        args.push("--solver=\"" + opts.solver + "\"");
    }
    var command = path.join(javaDir, "gradlew") + " run --args=\"" + args.join(" ") + "\"";
    var _ = cp.execSync(
    /* command */ command, 
    /* options */ {
        encoding: "utf-8",
        cwd: javaDir
    });
    if (opts.output) {
        return path.resolve(process_2.cwd(), opts.output);
    }
    return path.resolve(path.join(ROOT_DIR, "java"), path.join("..", "solutions", "solutions.json"));
}
if (!module.parent) {
    main();
}
//# sourceMappingURL=main.js.map