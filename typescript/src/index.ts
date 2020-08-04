import yargs = require("yargs");
import fs = require("fs");
import Ajv = require("ajv");
import _ = require("lodash");

import * as types from "./types";
import { Project, ts, Diagnostic } from "ts-morph";
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
    applyRefactorings: boolean;
    result: string;
    first?: number;
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
            describe: "List of refactorings to be analyzed",
            type: "string",
            array: true,
            default: [],
        })
        .option("applyRefactorings", {
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
    let solutions = solutionsRaw as types.Solutions;
    if (opts.first) {
        assert(
            opts.first >= 0,
            `Expected option 'first' to be a natural number, but it is ${opts.first}.`
        );
        solutions = solutions.slice(0, opts.first);
    }

    console.log(`${solutions.length} solutions will be analyzed`);
    const programs = solutions.map(buildProgram);
    const results = analyzePrograms(programs, opts);

    printResults(results, opts);
}

export interface Result {
    program: Program;
    refactors: RefactorInfo[];
}

interface Program {
    files: File[];
    diagnostics: Diagnostic[];
    errorMessage: string;
    hasError: boolean;
    compilerOptions: ts.CompilerOptions; // This is for sanity checking purposes.
}

interface File {
    fileName: string;
    text: string;
}

function printResults(results: Result[], opts: CliOpts): void {
    const aggregate = aggregateResults(results);

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

function aggregateResults(results: Result[]): AggregateResult {
    let compiling = 0;
    let totalRefactors = 0;
    for (const result of results) {
        if (!result.program.hasError) {
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
        analyzeProgram(
            program,
            index,
            opts.refactorings,
            opts.applyRefactorings,
            refactoringPred
        )
    );
}

function analyzeProgram(
    program: string,
    index: number,
    refactorings: CliOpts["refactorings"],
    applyRefactorings: CliOpts["applyRefactorings"],
    refactoringPred: NodePredicate
): Result {
    console.log(`Starting to analyze program ${index}`);
    // const filePath = `../output/programs/program_${index}.ts`;
    const filePath = "program.ts";
    const project = buildProject(program, filePath);
    const sourceFile = project.getSourceFileOrThrow(filePath);

    // Compiling info
    const diagnostics = sourceFile.getPreEmitDiagnostics();

    // Refactor info
    const refactorsInfo = getRefactorInfo(
        project,
        sourceFile.compilerNode,
        applyRefactorings,
        refactorings,
        refactoringPred
    );

    console.log(`Finished analyzing program ${index}`);
    return {
        program: projectToProgram(project),
        refactors: refactorsInfo,
    };
}

function projectToProgram(project: Project): Program {
    const files = project.getSourceFiles().map((file) => {
        return {
            fileName: file.getFilePath(),
            text: file.getFullText(),
        };
    });
    const diagnostics = project.getPreEmitDiagnostics();
    const hasError = diagnostics.length > 0;
    const errorMessage = project.formatDiagnosticsWithColorAndContext(
        diagnostics
    );
    return {
        files,
        diagnostics,
        errorMessage,
        hasError,
        compilerOptions: project.getCompilerOptions(),
    };
}

type NodePredicate = (_: ts.Node) => boolean;

interface RefactorInfo {
    name: string;
    action: string;
    triggeringRange: ts.TextRange;
    editInfo: ts.RefactorEditInfo;
    resultingProgram?: Program;
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
    applyRefactorings: boolean,
    enabledRefactorings: string[],
    pred: NodePredicate
): RefactorInfo[] {
    let refactorsInfo: RefactorInfo[] = [];
    visit(file);
    refactorsInfo = _.uniqWith(refactorsInfo, (a, b) =>
        _.isEqual(a.editInfo, b.editInfo)
    );

    if (applyRefactorings) {
        return refactorsInfo.map((refactorInfo) => {
            return {
                ...refactorInfo,
                resultingProgram: getRefactorResult(project, refactorInfo),
            };
        });
    }
    return refactorsInfo;

    function visit(node: ts.Node): void {
        if (pred(node)) {
            const refactorInfo = getApplicableRefactors(
                project,
                node
            ).filter((refactorInfo) =>
                enabledRefactorings.includes(refactorInfo.name)
            );
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
                            triggeringRange: { pos: node.pos, end: node.end },
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
        editInfo?.commands === undefined &&
            editInfo?.renameFilename === undefined,
        "We cannot deal with refactorings which include commands or file renames."
    );
    return editInfo;
}

function getRefactorResult(
    project: Project,
    refactorInfo: RefactorInfo
): Program {
    project = cloneProject(project);
    return projectToProgram(applyRefactorEdits(project, refactorInfo));
}

function applyRefactorEdits(
    project: Project,
    refactorInfo: RefactorInfo
): Project {
    refactorInfo.editInfo.edits.forEach((change) =>
        applyFileChange(project, change)
    );
    return project;
}

function cloneProject(project: Project): Project {
    const newProject = new Project({
        compilerOptions: project.getCompilerOptions(),
    });
    for (const file of project.getSourceFiles()) {
        newProject.createSourceFile(file.getFilePath(), file.getFullText());
    }

    return newProject;
}

function applyFileChange(
    project: Project,
    fileChange: ts.FileTextChanges
): void {
    if (fileChange.isNewFile) {
        const text = singleton(
            fileChange.textChanges,
            "Text changes for a new file should only have one change."
        ).newText;
        project.createSourceFile(fileChange.fileName, text);
    } else {
        const file = project.getSourceFileOrThrow(fileChange.fileName);
        file.applyTextChanges(fileChange.textChanges);
    }
}

function singleton<T>(arr: readonly T[], message?: string): T {
    if (arr.length != 1) {
        throw new Error(`Expected array to have exactly one item, but array has ${
            arr.length
        } items.
${message || ""}`);
    }

    return arr[0];
}

// // This implementation was copied from TypeScript's `ts.textChanges.applyChanges`.
// function applyChanges(text: string, changes: readonly ts.TextChange[]): string {
//     for (const change of changes) {
//         const { span, newText } = change;
//         text = `${text.substring(0, span.start)}${newText}${text.substring(
//             span.start + span.length
//         )}`;
//     }

//     return text;
// }

if (!module.parent) {
    main();
}
