import yargs = require("yargs");
import path = require("path");

import { tsdolly, Refactoring } from "./process";

function main(): void {
    const opts = yargs
        .usage("To do") // TODO: write usage
        .option("solution", {
            describe: "Path to file containing the Alloy metamodel solutions",
            type: "string",
            demandOption: true,
        })
        .option("refactoring", {
            describe: "List of refactorings to be analyzed",
            type: "string",
            choices: Object.values(Refactoring),
            demandOption: true,
        })
        .option("applyRefactoring", {
            describe: "Whether we should apply the refactorings available",
            type: "boolean",
            default: false,
        })
        .option("result", {
            describe: "Path to file where results should be saved",
            type: "string",
            default: "logs/results.json",
        })
        .option("first", {
            describe: "Consider only the first n solutions",
            type: "number",
            conflicts: "skip",
        })
        .option("skip", {
            describe:
                "Percentage of the solutions that will be sampled (using random sampling)",
            type: "number",
            conflicts: "first",
        })
        // Java options
        .option("command", {
            describe: "Alloy command to run",
            type: "string",
        })
        .epilogue("TODO: epilogue").argv;

    const cliOpts = {
        ...opts,
        refactoring: opts.refactoring as Refactoring,
    };
    // TODO: call java
    // TODO: pass "../../typescript.als" as model (using path.join?)
    tsdolly(cliOpts);
}

if (!module.parent) {
    main();
}
