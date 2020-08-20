import yargs = require("yargs");
import path = require("path");
import cp = require("child_process");

import { process, Refactoring, CliOpts as ProcessOpts, CLI_OPTIONS as PROCESS_OPTS } from "./process";
import { cwd } from "process";
import { rootCertificates } from "tls";

type Solver = "SAT4J" | "MiniSat";
const SOLVERS: Solver[] = ["SAT4J", "MiniSat"];

interface JavaOpts {
    command?: string;
    model?: string;
    output?: string;
    solver?: Solver;
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
} as const;

type NewProcessOpts = Omit<ProcessOpts, "solution">;
const newProcessOpts: Omit<typeof PROCESS_OPTS, "solution"> = {
    refactoring: PROCESS_OPTS.refactoring,
    applyRefactoring: PROCESS_OPTS.applyRefactoring,
    result: PROCESS_OPTS.result,
    first: PROCESS_OPTS.first,
    skip: PROCESS_OPTS.skip,
};

const OPTS = { ...JAVA_OPTS, ...newProcessOpts };

function main(): void {
    const opts = yargs
        .usage('$0 [args]')
        .option(OPTS)
        .argv;

    const cliOpts = {
        ...opts,
        refactoring: opts.refactoring as Refactoring,
        solver: opts.solver as Solver,
    };
    tsdolly(cliOpts);
}

function tsdolly(opts: JavaOpts & NewProcessOpts) {
    const solutionPath = generateSolutions(opts);
    process({ ...opts, solution: solutionPath });
}

const ROOT_DIR = path.join(path.resolve(__dirname), "..", "..");

function generateSolutions(opts: JavaOpts): string {
    const javaDir = path.join(ROOT_DIR, "java");
    const args: string[] = [];
    if (opts.command) {
        args.push(`--command="${opts.command}"`);
    }
    if (opts.model) {
        args.push(`--model="${opts.model}"`);
    }
    if (opts.output) {
        args.push(`--output="${path.resolve(cwd(), opts.output)}"`);
    }
    if (opts.solver) {
        args.push(`--solver="${opts.solver}"`);
    }

    const command = `${path.join(javaDir, "gradlew")} run --args="${args.join(" ")}"`;

    const _ = cp.execSync(
        /* command */ command,
        /* options */ {
            encoding: "utf-8",
            cwd: javaDir,
        });
    
    if (opts.output) {
        return path.resolve(cwd(), opts.output)
    }
    return path.resolve(path.join(ROOT_DIR, "java"), path.join("..", "solutions", "solutions.json"));
}

if (!module.parent) {
    main();
}
