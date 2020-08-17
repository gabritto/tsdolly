import yargs = require("yargs");
import fs = require("fs");
import Ajv = require("ajv");
import _ = require("lodash");

import * as types from "./types";
import { Project, ts, Diagnostic as TsDiagnostic } from "ts-morph";
import { assert } from "console";
import { buildProject, buildProgram } from "./build";

type Object = { [key: string]: object };
type Schema = { definitions: Object };
const SCHEMA: Schema = JSON.parse(
    fs.readFileSync("schema/types.json", { encoding: "utf-8" })
);

interface CliOpts {
    solution: string;
    refactoring: Refactoring;
    applyRefactoring: boolean;
    result: string;
    skip?: number;
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
        .epilogue("TODO: epilogue").argv;

    const cliOpts = {
        ...opts,
        refactoring: opts.refactoring as Refactoring,
    };
    tsdolly(cliOpts);
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
    const total = solutions.length;
    solutions = sampleSolutions(solutions, opts);

    console.log(
        `${solutions.length} solutions from a total of ${total} will be analyzed`
    );
    const programs = solutions.map(buildProgram);
    const results = analyzePrograms(programs, opts);

    printResults(results, opts);
}

function sampleSolutions(
    solutions: types.Solutions,
    opts: Pick<CliOpts, "first" | "skip">
): types.Solutions {
    if (opts.first) {
        assert(
            opts.first > 0,
            `Expected option 'first' to be a positive integer, but it is ${opts.first}.`
        );
        assert(
            opts.first <= solutions.length,
            `Expected option 'first' to be at most the number of solutions (${solutions.length}), but it is ${opts.first}.`
        );
        return solutions.slice(0, opts.first);
    }
    if (opts.skip) {
        assert(
            opts.skip > 0,
            `Expected option 'skip' to be a positive integer, but it is ${opts.skip}.`
        );
        assert(
            opts.skip <= solutions.length,
            `Expected option 'skip' to be at most the number of solutions (${solutions.length}), but it is ${opts.skip}.`
        );
        return sample(solutions, opts.skip);
    }
    return solutions;
}

function sample(solutions: types.Solutions, skip: number): types.Solutions {
    const sampledSolutions: types.Solutions = [];
    for (let start = 0; start < solutions.length; start += skip) {
        const end = Math.min(start + skip, solutions.length);
        // We want an element between [start, end).
        const index = _.random(start, end - 1, false);
        sampledSolutions.push(solutions[index]);
    }
    return sampledSolutions;
}

export interface Result {
    program: Program;
    refactors: RefactorInfo[];
}

export interface Program {
    files: File[];
    errors: CompilerError[];
    hasError: boolean;
    compilerOptions: ts.CompilerOptions; // This is for sanity checking purposes.
}

export interface File {
    fileName: string;
    text: string;
}

function printResults(results: Result[], opts: CliOpts): void {
    const aggregate = aggregateResults(results);

    console.log(`Total programs: ${aggregate.total}
Total programs that compile: ${aggregate.compiling}
Compiling rate: ${aggregate.compileRate * 100}%`);
    console.log(`Average of available refactors: ${aggregate.refactorAvg}`);

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

export interface AggregateResult {
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
    const refactoringPred = REFACTOR_TO_PRED.get(opts.refactoring);
    if (!refactoringPred) {
        throw new Error(`Could not find node predicate for refactoring '${opts.refactoring}'.
To try and apply a refactoring, you need to first implement a predicate over nodes.
This predicate specifies to which nodes we should consider applying the refactoring.`);
    }
    return programs.map((program, index) =>
        analyzeProgram(
            program,
            index,
            opts.refactoring,
            opts.applyRefactoring,
            refactoringPred
        )
    );
}

function analyzeProgram(
    programText: string,
    index: number,
    refactoring: CliOpts["refactoring"],
    applyRefactoring: CliOpts["applyRefactoring"],
    refactoringPred: NodePredicate
): Result {
    console.log(`Starting to analyze program ${index}`);
    // const filePath = `../output/programs/program_${index}.ts`;
    const filePath = "program.ts";
    const project = buildProject(programText, filePath);
    const sourceFile = project.getSourceFileOrThrow(filePath);
    const program = projectToProgram(project);

    // Refactor info
    const refactorsInfo = getRefactorInfo(
        project,
        program,
        sourceFile.compilerNode,
        applyRefactoring,
        refactoring,
        refactoringPred
    );

    console.log(`Finished analyzing program ${index}`);
    return {
        program,
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
    const diagnostics = getCompilerError(project);
    const hasError = diagnostics.length > 0;
    return {
        files,
        errors: diagnostics,
        hasError,
        compilerOptions: project.getCompilerOptions(),
    };
}

export interface CompilerError {
    file?: string;
    code: number;
    line?: number;
    start?: number;
    length?: number;
    category: ts.DiagnosticCategory;
    messageText: string;
}

function getCompilerError(project: Project): CompilerError[] {
    const tsDiagnostics = project.getPreEmitDiagnostics().filter(d => d.getCategory() === ts.DiagnosticCategory.Error);
    return tsDiagnostics.map(diagnosticToCompilerError);
}

function diagnosticToCompilerError(diagnostic: TsDiagnostic): CompilerError {
    let messageText = "";
    const msg = diagnostic.getMessageText();
    if (typeof msg === "string") {
        messageText = msg;
    } else {
        // If diagnostic message is a chain, we're only getting the first message.
        messageText = msg.getMessageText();
    }

    return {
        file: diagnostic.getSourceFile()?.getFilePath(),
        code: diagnostic.getCode(),
        line: diagnostic.getLineNumber(),
        start: diagnostic.getStart(),
        length: diagnostic.getLength(),
        category: diagnostic.getCategory(),
        messageText,
    };
}

type NodePredicate = (_: ts.Node) => boolean;

interface RefactorInfo {
    name: string;
    action: string;
    triggeringRange: ts.TextRange;
    editInfo: ts.RefactorEditInfo;
    resultingProgram?: Program;
    introducesError?: boolean;
}

enum Refactoring {
    ConvertParamsToDestructuredObject = "Convert parameters to destructured object",
    ConvertToTemplateString = "Convert to template string",
    GenerateGetAndSetAccessors = "Generate 'get' and 'set' accessors",
    ExtractSymbol = "Extract Symbol",
    MoveToNewFile = "Move to a new file",
}

const REFACTOR_TO_PRED: Map<Refactoring, NodePredicate> = new Map([
    [Refactoring.ConvertParamsToDestructuredObject, isParameter],
    [Refactoring.ConvertToTemplateString, isStringConcat],
    [Refactoring.GenerateGetAndSetAccessors, isField],
    [Refactoring.ExtractSymbol, isCallOrLiteral],
    [Refactoring.MoveToNewFile, isTopLevelDeclaration],
]);

function isStringConcat(node: ts.Node) {
    return ts.isBinaryExpression(node); // TODO: can we add more checks to this?
}

function isParameter(node: ts.Node) {
    return ts.isParameter(node);
}

function isField(node: ts.Node) {
    return ts.isPropertyDeclaration(node);
}

function isCallOrLiteral(node: ts.Node) {
    return ts.isCallExpression(node) || ts.isLiteralExpression(node);
}

function isTopLevelDeclaration(node: ts.Node) {
    return ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node);
}

function getRefactorInfo(
    project: Project,
    program: Program,
    file: ts.SourceFile,
    applyRefactoring: boolean,
    enabledRefactoring: Refactoring,
    pred: NodePredicate
): RefactorInfo[] {
    let refactorsInfo: RefactorInfo[] = [];
    visit(file);
    refactorsInfo = _.uniqWith(refactorsInfo, (a, b) =>
        _.isEqual(a.editInfo, b.editInfo)
    );

    if (applyRefactoring) {
        for (const refactorInfo of refactorsInfo) {
            refactorInfo.resultingProgram = getRefactorResult(
                project,
                refactorInfo
            );
            if (refactorInfo.resultingProgram.hasError && !program.hasError) {
                refactorInfo.introducesError = true;
            }
        }
    }
    return refactorsInfo;

    function visit(node: ts.Node): void {
        if (pred(node)) {
            const refactorInfo = getApplicableRefactors(project, node).filter(
                (refactorInfo) => enabledRefactoring === refactorInfo.name
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

if (!module.parent) {
    main();
}
