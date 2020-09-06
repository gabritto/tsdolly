import yargs = require("yargs");
import fs = require("fs");
import Ajv = require("ajv");
import _ = require("lodash");
import path = require("path");
import StreamArray = require("stream-json/streamers/StreamArray");
//@ts-ignore
import { stringer } from "stream-json/jsonl/Stringer";
import Chain = require('stream-chain');

import { performance } from "perf_hooks";
import { Project, ts, Diagnostic as TsDiagnostic } from "ts-morph";
import { assert } from "console";
import { Transform, TransformCallback, pipeline } from "stream";

import { buildProject, buildProgram } from "./build";
import * as types from "./types";

type Object = { [key: string]: object };
type Schema = { definitions: Object };
const ROOT_DIR = path.join(path.resolve(__dirname), ".."); // "tsdolly/typescript" dir
const SCHEMA: Schema = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "schema", "types.json"), {
        encoding: "utf-8",
    })
);

export enum Refactoring {
    ConvertParamsToDestructuredObject = "Convert parameters to destructured object",
    ConvertToTemplateString = "Convert to template string",
    GenerateGetAndSetAccessors = "Generate 'get' and 'set' accessors",
    ExtractSymbol = "Extract Symbol",
    MoveToNewFile = "Move to a new file",
}

export interface CliOpts {
    solution: string;
    refactoring: Refactoring;
    applyRefactoring: boolean;
    result: string;
    skip?: number;
    first?: number;
    performance?: string;
}

export const CLI_OPTIONS = {
    solution: {
        describe: "Path to file containing the Alloy metamodel solutions",
        type: "string",
        demandOption: true,
    },
    refactoring: {
        describe: "Refactoring to be analyzed",
        choices: Object.values(Refactoring),
        demandOption: true,
    },
    applyRefactoring: {
        describe: "Whether we should apply available refactorings",
        type: "boolean",
        default: true,
    },
    result: {
        describe: "Path to file where results should be saved",
        type: "string",
        demandOption: true,
    },
    first: {
        describe: "Consider only the first n solutions",
        type: "number",
        conflicts: "skip",
    },
    skip: {
        describe:
            "If specified, only one out of every n solutions will be analyzed",
        type: "number",
        conflicts: "first",
    },
    performance: {
        describe:
            "Path to file where performance entries should be saved. \
            Performance entries will be discarded if unspecified.",
        type: "string",
    },
} as const;

function main(): void {
    const opts = yargs.usage("$0 [args]").options(CLI_OPTIONS).argv;
    process(opts);
}

export function process(opts: CliOpts): void {
    performance.mark("start_process");
    const input = fs.createReadStream(opts.solution, { encoding: "utf-8" });
    const jsonParser = StreamArray.withParser();
    const processor = new Process(opts);
    // const jsonStringer = stringer() as Transform;
    const jsonStringer = new Stringer({ writableObjectMode: true });
    const output = fs.createWriteStream(opts.result, { encoding: "utf-8" });
    const chain = new Chain([
        jsonParser, 
        processor.processObject, 
        jsonStringer
    ]);
    chain.on("error", (err: Error) => {
        console.error(`Chain failed: ${err.name}\n${err.message}\n${err.stack}`);
        throw err;
    })
    const stream = input.pipe(chain).pipe(output);
    // TODO: call processor.getAggregateResults on chain.finish
    stream.on("finish", () => {
        performance.mark("end_process");

        if (opts.performance) {
            const perfEntries = JSON.stringify(
                performance,
                /* replacer */ undefined,
                /* space */ 4
            );
            try {
                fs.writeFileSync(opts.performance, perfEntries, {
                    encoding: "utf-8",
                });
                console.log(`Performance entries written to ${opts.performance}`);
            } catch (error) {
                console.log(
                    `Error ${error} found while writing performance entries to file ${opts.performance}.\n\tEntries:\n${perfEntries}`
                );
            }
        }
    });
}

class Stringer extends Transform {
    private isFirst = true;
    _transform(obj: unknown, _encoding: BufferEncoding, callback: TransformCallback) {
        let str = JSON.stringify(obj, undefined, 4);
        if (this.isFirst) {
            str = "[" + str;
        }
        else {
            str = ",\n" + str;
        }

        this.isFirst = false;

        this.push(str);
        callback();
    }
    _flush() {
        this.push("\n]")
    }
}

class Process {
    private solutionCount: number = 0;
    private nextSample: number = -1;
    private ajv: Ajv.Ajv;
    private opts: CliOpts;
    private refactoringPred: NodePredicate;
    private compiling: number = 0;
    private refactorable: number = 0;

    constructor(opts: CliOpts) {
        this.ajv = new Ajv();
        this.ajv.addSchema(SCHEMA, "types");
        this.opts = validateOpts(opts);
        const refactoringPred = REFACTOR_TO_PRED.get(opts.refactoring);
        if (!refactoringPred) {
            throw new Error(`Could not find node predicate for refactoring '${opts.refactoring}'.
To try and apply a refactoring, you need to first implement a predicate over nodes.
This predicate specifies to which nodes we should consider applying the refactoring.`);
        }
        this.refactoringPred = refactoringPred;
    }

    private getAggregateResults(): AggregateResult {
        return {
            total: this.solutionCount,
            compiling: this.compiling,
            compileRate: this.compiling / this.solutionCount,
            refactorable: this.refactorable,
            refactorableRate: this.refactorable / this.solutionCount,
        };
    }

    processObject: (obj: { key: number, value: unknown}) => Result | undefined = (obj: { key: number, value: unknown}) => {
        // TODO: add perf marks.
        const rawSolution = obj.value; 
        if (
            !this.ajv.validate(
                { $ref: "types#/definitions/Program" },
                rawSolution
            )
        ) {
            console.log("Validation error");
            throw new Error(`Object: ${JSON.stringify(rawSolution, undefined, 4)}
Ajv error: \n${this.ajv.errorsText()}`);
        }
        const solution = rawSolution as types.Program;
        let result = undefined;
        if (this.shouldSample()) {
            console.log("Should sample");
            console.log(
                `Solution #${this.solutionCount} will be analyzed`
            );
            result = this.processProgram(solution);
        }
        // Update count
        this.solutionCount += 1;
        return result;
    }

    private shouldSample(): boolean {
        if (this.opts.first) {
            return this.solutionCount < this.opts.first;
        }

        // TODO: this strategy means we could potentially not sample the last "chunk",
        // because `nextSample` could be larger than total solutions.
        if (this.opts.skip) {
            const chunkSize = this.opts.skip;
            if (this.solutionCount % chunkSize === 0) {
                this.nextSample = _.random(0, chunkSize - 1, false) + this.solutionCount;
            }

            return this.nextSample === this.solutionCount;
        }

        return true;
    }

    private processProgram(solution: types.Program): Result {
        performance.mark("start_buildProgram");
        const program = buildProgram(solution);
        performance.mark("end_buildProgram");

        const result = analyzeProgram(
            program,
            this.solutionCount,
            this.opts.refactoring,
            this.opts.applyRefactoring,
            this.refactoringPred
        );
        this.aggregateResult(result);
        return result;
    }

    private aggregateResult(result: Result): void {
        if (!result.program.hasError) {
            this.compiling += 1;
        }
        if (result.refactors.length > 0) {
            this.refactorable += 1;
        }
    }
}

function validateOpts(opts: CliOpts): CliOpts {
    if (opts.first) {
        assert(
            opts.first > 0,
            `Expected option 'first' to be a positive integer, but it is ${opts.first}.`
        );
    }
    if (opts.skip) {
        assert(
            opts.skip > 0,
            `Expected option 'skip' to be a positive integer, but it is ${opts.skip}.`
        );
    }
    return opts;
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

export interface AggregateResult {
    total: number;
    compiling: number;
    compileRate: number;
    refactorable: number;
    refactorableRate: number;
}

function analyzeProgram(
    programText: string,
    index: number,
    refactoring: CliOpts["refactoring"],
    applyRefactoring: CliOpts["applyRefactoring"],
    refactoringPred: NodePredicate
): Result {
    performance.mark(`start_analyzeProgram`);
    console.log(`Starting to analyze program ${index}`);
    const filePath = "program.ts";
    const project = buildProject(programText, filePath);
    const program = projectToProgram(project);
    const sourceFile = project.getSourceFileOrThrow(filePath);

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
    performance.mark(`end_analyzeProgram`);
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
    const tsDiagnostics = project
        .getPreEmitDiagnostics()
        .filter((d) => d.getCategory() === ts.DiagnosticCategory.Error);
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

const REFACTOR_TO_PRED: Map<Refactoring, NodePredicate> = new Map([
    [Refactoring.ConvertParamsToDestructuredObject, isParameter],
    [Refactoring.ConvertToTemplateString, isStringConcat],
    [Refactoring.GenerateGetAndSetAccessors, isField],
    [Refactoring.ExtractSymbol, isCallOrLiteral],
    [Refactoring.MoveToNewFile, isTopLevelDeclaration],
]);

function isStringConcat(node: ts.Node) {
    return ts.isBinaryExpression(node); // TODO: should we add more checks to this?
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
    performance.mark(`start_getRefactorInfo`);
    let refactorsInfo: RefactorInfo[] = [];
    visit(file);
    refactorsInfo = _.uniqWith(refactorsInfo, (a, b) =>
        _.isEqual(a.editInfo, b.editInfo)
    );

    if (applyRefactoring) {
        // TODO: should we apply refactorings even when program has error?
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

    performance.mark(`end_getRefactorInfo`);
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
        editInfo?.commands === undefined,
        "We cannot deal with refactorings which include commands."
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
