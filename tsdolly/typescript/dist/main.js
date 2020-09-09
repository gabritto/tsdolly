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
var process_1 = require("process");
var perf_hooks_1 = require("perf_hooks");
var process_2 = require("./process");
var performance_1 = require("./performance");
var SOLVERS = ["SAT4J", "MiniSat"];
var JAVA_OPTS = {
    command: {
        describe: "Alloy command that should be run to generate solutions",
        type: "string"
    },
    model: {
        describe: "Path to Alloy model file",
        type: "string"
    },
    output: {
        describe: "Path of file where generated solutions should be saved",
        type: "string"
    },
    solver: {
        describe: "SAT solver to be used in Alloy API",
        choices: SOLVERS
    }
};
var COUNT_OPTS = {
    command: JAVA_OPTS.command,
    model: JAVA_OPTS.model,
    solver: JAVA_OPTS.solver
};
var newProcessOpts = {
    refactoring: process_2.CLI_OPTIONS.refactoring,
    applyRefactoring: process_2.CLI_OPTIONS.applyRefactoring,
    result: process_2.CLI_OPTIONS.result,
    first: process_2.CLI_OPTIONS.first,
    skip: process_2.CLI_OPTIONS.skip,
    performance: process_2.CLI_OPTIONS.performance
};
var OPTS = __assign(__assign({}, JAVA_OPTS), newProcessOpts);
function main() {
    yargs
        .usage("$0 <cmd> [args]")
        .command("count", "Count the number of solutions (TypeScript programs) that a command generates", COUNT_OPTS, count)
        .command("generate", "Generate the TypeScript programs and test refactorings", OPTS, tsdolly).argv;
}
function count(opts) {
    var javaDir = path.join(ROOT_DIR, "java");
    var args = [];
    if (opts.command) {
        args.push("--command=\"" + opts.command + "\"");
    }
    if (opts.model) {
        args.push("--model=\"" + opts.model + "\"");
    }
    if (opts.solver) {
        args.push("--solver=\"" + opts.solver + "\"");
    }
    var command = path.join(javaDir, "gradlew") + " run --args=\"--count " + args.join(" ") + "\"";
    var exec = cp.execSync(
    /* command */ command, 
    /* options */ {
        encoding: "utf-8",
        cwd: javaDir,
        stdio: "inherit"
    });
}
function tsdolly(opts) {
    if (opts.performance) {
        performance_1.registerPerformance(opts.performance);
    }
    var solutionPath = generateSolutions(opts);
    process_2.process(__assign(__assign({}, opts), { solution: solutionPath }));
}
var ROOT_DIR = path.join(path.resolve(__dirname), "..", "..");
function generateSolutions(opts) {
    perf_hooks_1.performance.mark("start_generateSolutions");
    var javaDir = path.join(ROOT_DIR, "java");
    var args = [];
    if (opts.command) {
        args.push("--command=\"" + opts.command + "\"");
    }
    if (opts.model) {
        args.push("--model=\"" + opts.model + "\"");
    }
    if (opts.output) {
        args.push("--output=\"" + path.resolve(process_1.cwd(), opts.output) + "\"");
    }
    if (opts.solver) {
        args.push("--solver=\"" + opts.solver + "\"");
    }
    var command = path.join(javaDir, "gradlew") + " run --args=\"" + args.join(" ") + "\"";
    var _ = cp.execSync(
    /* command */ command, 
    /* options */ {
        encoding: "utf-8",
        cwd: javaDir,
        stdio: "inherit"
    });
    var solutionsPath;
    if (opts.output) {
        solutionsPath = path.resolve(process_1.cwd(), opts.output);
    }
    else {
        solutionsPath = path.resolve(path.join(ROOT_DIR, "java"), path.join("..", "solutions", "solutions.json"));
    }
    perf_hooks_1.performance.mark("end_generateSolutions");
    return solutionsPath;
}
if (!module.parent) {
    main();
}
//# sourceMappingURL=main.js.map