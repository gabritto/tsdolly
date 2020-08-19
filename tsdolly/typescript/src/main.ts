import yargs = require("yargs");
import path = require("path");
import cp = require("child_process");

import { tsdolly, Refactoring, CliOpts as ProcessOpts, CLI_OPTIONS as PROCESS_OPTS } from "./process";

type Solver = "SAT4J" | "MiniSat";
const SOLVERS: Solver[] = ["SAT4J", "MiniSat"];

interface JavaOpts {
    command?: string;
    model?: string;
    output?: string;
    solver?: Solver;
    count?: boolean;
}

const JAVA_OPTS = {
    "command": {
        describe: "Alloy command that should be run to generate solutions",
        type: "string",
    },
    "model": {
        describe: "Path to Alloy model file",
        type: "string",
    },
    "output": {
        describe: "Path of file where generated solutions should be saved",
        type: "string",
    },
    "solver": {
        describe: "SAT solver to be used in Alloy API",
        type: "string",
        choices: SOLVERS,
    },
    "count": {
        describe: "Count solutions instead of generating them",
        type: "boolean",
    }
} as const;

type NewProcessOpts = Omit<ProcessOpts, "solution">;
const newProcessOpts = { ...PROCESS_OPTS, solution: null } as Omit<typeof PROCESS_OPTS, "solution">;

const OPTS = { ...JAVA_OPTS, ...newProcessOpts };

function main(): void {
    const opts = yargs
        .usage("To do") // TODO: write usage
        .option(OPTS)
        .epilogue("TODO: epilogue").argv;

    const cliOpts = {
        ...opts,
        refactoring: opts.refactoring as Refactoring,
    };
    // TODO: call java
    // TODO: pass "../../typescript.als" as model (using path.join?)
    // tsdolly(cliOpts);
}

function generateSolutions(opts: JavaOpts): string {
    // cp.execFileSync();
    return "";
}

if (!module.parent) {
    main();
}
