import yargs = require("yargs");
import path = require("path");
import cp = require("child_process");

import {
    process,
    CliOpts as ProcessOpts,
    CLI_OPTIONS as PROCESS_OPTS,
} from "./process";
import { cwd } from "process";
import { performance } from "perf_hooks";

type Solver = "SAT4J" | "MiniSat";
const SOLVERS: Solver[] = ["SAT4J", "MiniSat"];

interface JavaOpts {
    command?: string;
    model?: string;
    output?: string;
    solver?: Solver;
}

const JAVA_OPTS = {
    command: {
        describe: "Alloy command that should be run to generate solutions",
        type: "string",
    },
    model: {
        describe: "Path to Alloy model file",
        type: "string",
    },
    output: {
        describe: "Path of file where generated solutions should be saved",
        type: "string",
    },
    solver: {
        describe: "SAT solver to be used in Alloy API",
        choices: SOLVERS,
    },
} as const;

const COUNT_OPTS = {
    command: JAVA_OPTS.command,
    model: JAVA_OPTS.model,
    solver: JAVA_OPTS.solver,
} as const;

type NewProcessOpts = Omit<ProcessOpts, "solution">;
const newProcessOpts: Omit<typeof PROCESS_OPTS, "solution"> = {
    refactoring: PROCESS_OPTS.refactoring,
    applyRefactoring: PROCESS_OPTS.applyRefactoring,
    result: PROCESS_OPTS.result,
    first: PROCESS_OPTS.first,
    skip: PROCESS_OPTS.skip,
    performance: PROCESS_OPTS.performance,
};

const OPTS = { ...JAVA_OPTS, ...newProcessOpts };

function main(): void {
    yargs
        .usage("$0 <cmd> [args]")
        .command(
            "count",
            "Count the number of solutions (TypeScript programs) that a command generates",
            COUNT_OPTS,
            count
        )
        .command(
            "generate",
            "Generate the TypeScript programs and test refactorings",
            OPTS,
            tsdolly
        ).argv;
}

function count(opts: Omit<JavaOpts, "output">): void {
    const javaDir = path.join(ROOT_DIR, "java");
    const args: string[] = [];
    if (opts.command) {
        args.push(`--command="${opts.command}"`);
    }
    if (opts.model) {
        args.push(`--model="${opts.model}"`);
    }
    if (opts.solver) {
        args.push(`--solver="${opts.solver}"`);
    }

    const command = `${path.join(
        javaDir,
        "gradlew"
    )} run --args="--count ${args.join(" ")}"`;
    const exec = cp.execSync(
        /* command */ command,
        /* options */ {
            encoding: "utf-8",
            cwd: javaDir,
            stdio: "inherit",
        }
    );
}

function tsdolly(opts: JavaOpts & NewProcessOpts): void {
    const solutionPath = generateSolutions(opts);
    process({ ...opts, solution: solutionPath });
}

const ROOT_DIR = path.join(path.resolve(__dirname), "..", "..");

function generateSolutions(opts: JavaOpts): string {
    performance.mark("start_generateSolutions");
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

    const command = `${path.join(javaDir, "gradlew")} run --args="${args.join(
        " "
    )}"`;

    const _ = cp.execSync(
        /* command */ command,
        /* options */ {
            encoding: "utf-8",
            cwd: javaDir,
            stdio: "inherit",
        }
    );

    let solutionsPath;
    if (opts.output) {
        solutionsPath = path.resolve(cwd(), opts.output);
    } else {
        solutionsPath = path.resolve(
            path.join(ROOT_DIR, "java"),
            path.join("..", "solutions", "solutions.json")
        );
    }

    performance.mark("end_generateSolutions");
    return solutionsPath;
}

if (!module.parent) {
    main();
}
