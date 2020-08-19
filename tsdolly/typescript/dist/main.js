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
var process_1 = require("./process");
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
    },
    "count": {
        describe: "Count solutions instead of generating them",
        type: "boolean"
    }
};
var newProcessOpts = __assign(__assign({}, process_1.CLI_OPTIONS), { solution: null });
var OPTS = __assign(__assign({}, JAVA_OPTS), newProcessOpts);
function main() {
    var opts = yargs
        .usage("To do") // TODO: write usage
        .option(OPTS)
        .epilogue("TODO: epilogue").argv;
    var cliOpts = __assign(__assign({}, opts), { refactoring: opts.refactoring });
    // TODO: call java
    // TODO: pass "../../typescript.als" as model (using path.join?)
    // tsdolly(cliOpts);
}
function generateSolutions(opts) {
    // cp.execFileSync();
    return "";
}
if (!module.parent) {
    main();
}
//# sourceMappingURL=main.js.map