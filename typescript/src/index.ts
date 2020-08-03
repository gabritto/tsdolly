import yargs = require("yargs");
import fs = require("fs");
import Ajv = require("ajv");

import * as types from "./types";
import { Project, SourceFile, ts, HeritageClause } from "ts-morph";
import { assert } from "console";
import { buildProject, buildProgram } from "./build";

type Object = { [key: string]: object };
type Schema = { definitions: Object };
const SCHEMA: Schema = JSON.parse(
    fs.readFileSync("schema/types.json", { encoding: "utf-8" })
);

interface CliOpts {
    solution: string;
    refactorings: string[];
    result: string;
}

function main(): void {
    const opts = yargs
        .usage("To do") // TODO: write usage
        .option("solution", {
            describe: "Path to file containing the Alloy metamodel solutions",
            type: "string",
            demandOption: true,
        })
        .option("refactorings", {
            describe: "List of refactorings to be applied",
            type: "string",
            array: true,
            default: [],
        })
        .option("result", {
            describe: "Path to file where results should be saved",
            type: "string",
            default: "logs/results.json",
        }).argv;

    tsdolly(opts);
}

function tsdolly(opts: CliOpts): void {
    const solutionFile = fs.readFileSync(opts.solution, { encoding: "utf-8" });
    const solutionsRaw: unknown = JSON.parse(solutionFile);
    const ajv = new Ajv();
    ajv.addSchema(SCHEMA, "types");
    if (!ajv.validate({ $ref: "types#/definitions/Solutions" }, solutionsRaw)) {
        throw ajv.errors;
    }
    const solutions = solutionsRaw as types.Solutions;
    console.log(`${solutions.length} solutions found`);
    const programs = solutions.map(buildProgram);
    const results = analyzePrograms(programs, opts);

    printResults(results, opts);
}

export interface Result {
    path: string;
    program: string;
    hasError: boolean;
    errors: string;
    refactors: RefactorInfo[];
}

function printResults(results: Result[], opts: CliOpts): void {
    const aggregate = aggregateResults(results, opts.refactorings);

    console.log(`Total programs: ${aggregate.total}
Total programs that compile: ${aggregate.compiling}
Compiling rate: ${aggregate.compileRate * 100}%`);
    if (opts.refactorings) {
        console.log(`Average of available refactors: ${aggregate.refactorAvg}`);
    }

    const jsonResults = JSON.stringify(
        results,
        /* replacer */ undefined,
        /* space */ 4
    );
    try {
        fs.writeFileSync(opts.result, jsonResults, { encoding: "utf8" });
        console.log(`Results JSON written to ${opts.result}`);
    } catch (error) {
        console.log(
            `Error ${error} found while writing results to file ${opts.result}.\n\tResults:\n ${jsonResults}`
        );
    }
}

interface AggregateResult {
    total: number;
    compiling: number;
    compileRate: number;
    refactorAvg?: number;
}

function aggregateResults(
    results: Result[],
    refactorings: CliOpts["refactorings"]
): AggregateResult {
    let compiling = 0;
    let totalRefactors = 0;
    for (const result of results) {
        if (!result.hasError) {
            compiling += 1;
        }
        if (result.refactors.length > 0) {
            totalRefactors += result.refactors.length;
        }
    }

    return {
        total: results.length,
        compiling,
        compileRate: compiling / results.length,
        refactorAvg: totalRefactors / results.length,
    };
}

function analyzePrograms(programs: string[], opts: CliOpts): Result[] {
    const refactoringPred = buildPredicate(opts.refactorings);
    return programs.map((program, index) =>
        analyzeProgram(program, index, opts.refactorings, refactoringPred)
    );
}

function analyzeProgram(
    program: string,
    index: number,
    refactorings: CliOpts["refactorings"],
    refactoringPred: NodePredicate
): Result {
    console.log(`Starting to analyze program ${index}`);
    const filePath = `../output/programs/program_${index}.ts`;
    const project = buildProject(program, filePath);
    const sourceFile = project.getSourceFileOrThrow(filePath);

    // Compiling info
    const diagnostics = sourceFile.getPreEmitDiagnostics();

    // Refactor info
    const refactorsInfo = getRefactorInfo(
        project,
        sourceFile.compilerNode,
        refactorings,
        refactoringPred
    );

    console.log(`Finished analyzing program ${index}`);
    return {
        path: sourceFile.getFilePath(),
        program: sourceFile.getFullText(),
        hasError: diagnostics.length > 0,
        errors: project.formatDiagnosticsWithColorAndContext(diagnostics),
        refactors: refactorsInfo,
    };
}

type NodePredicate = (_: ts.Node) => boolean;

interface RefactorInfo {
    name: string;
    action: string;
    range: ts.TextRange;
    editInfo: ts.RefactorEditInfo;
}

const REFACTOR_TO_PRED: Map<string, NodePredicate> = new Map([
    ["Convert to template string", isStringConcat],
    ["Convert parameters to destructured object", isParameter],
]);

function isStringConcat(node: ts.Node) {
    return ts.isBinaryExpression(node); // TODO: can we add more checks to this?
}

function isParameter(node: ts.Node) {
    return ts.isParameter(node);
}

function buildPredicate(enabledRefactorings: string[]): NodePredicate {
    const preds: NodePredicate[] = [];
    enabledRefactorings.forEach((refactoring) => {
        const pred = REFACTOR_TO_PRED.get(refactoring);
        if (!pred) {
            throw new Error(`Could not find node predicate for refactoring '${refactoring}'.
To try and apply a refactoring, you need to first implement a predicate over nodes.
The predicate specifies to which nodes we should consider applying the refactoring.`);
        }
        preds.push(pred);
    });

    return function (node) {
        return preds.some((pred) => pred(node));
    };
}

function getRefactorInfo(
    project: Project,
    file: ts.SourceFile,
    enabledRefactorings: string[],
    pred: NodePredicate
): RefactorInfo[] {
    const refactorsInfo: RefactorInfo[] = [];
    visit(file);
    return refactorsInfo;

    function visit(node: ts.Node): void {
        if (pred(node)) {
            const refactorInfo = getApplicableRefactors(
                project,
                node
            ).filter((refactorInfo) =>
                enabledRefactorings.includes(refactorInfo.name)
            );
            // TODO: remove duplicates?
            refactorInfo.forEach((refactor) => {
                refactor.actions.forEach((action) => {
                    const edit = getEditInfo(
                        project,
                        node,
                        refactor.name,
                        action.name
                    );
                    if (edit) {
                        refactorsInfo.push({
                            name: refactor.name,
                            action: action.name,
                            editInfo: edit,
                            range: { pos: node.pos, end: node.end }
                        });
                    }
                });
            });
        }

        node.forEachChild(visit);
    }
}

function getApplicableRefactors(
    project: Project,
    node: ts.Node
): ts.ApplicableRefactorInfo[] {
    const languageService = project.getLanguageService().compilerObject;
    return languageService.getApplicableRefactors(
        node.getSourceFile().fileName,
        node,
        /* preferences */ undefined
    );
}

function getEditInfo(
    project: Project,
    node: ts.Node,
    refactorName: string,
    actionName: string
): ts.RefactorEditInfo | undefined {
    const languageService = project.getLanguageService().compilerObject;
    const formatSettings = project.manipulationSettings.getFormatCodeSettings();
    const editInfo = languageService.getEditsForRefactor(
        node.getSourceFile().fileName,
        /* formatOptions */ formatSettings,
        node,
        refactorName,
        actionName,
        /* preferences */ undefined
    );
    assert(
        editInfo?.commands === undefined,
        "We cannot deal with refactorings which include commands."
    );
    return editInfo;
}

function applyRefactorEdits(project: Project, file: ts.SourceFile, refactorInfo: RefactorInfo): Project {
    const resultingProject = new Project();
}

function applyEditChanges(project: Project) {
    // TODO
}

function cloneProject(project: Project): Project {
    const newProject = new Project({ compilerOptions: project.getCompilerOptions() });
    for (const file of newProject.getSourceFiles()) {
        newProject.createSourceFile(file.getFilePath(), file.getText());
    }

    return newProject;
}

if (!module.parent) {
    main();
}
