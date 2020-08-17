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
        choices: Object.values(process_1.Refactoring),
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
        // Java options
        .option("command", {
        describe: "Alloy command to run",
        type: "string"
    })
        .epilogue("TODO: epilogue").argv;
    var cliOpts = __assign(__assign({}, opts), { refactoring: opts.refactoring });
    // TODO: call java
    // TODO: pass "../../typescript.als" as model (using path.join?)
    process_1.tsdolly(cliOpts);
}
if (!module.parent) {
    main();
}
//# sourceMappingURL=main.js.map