import _ = require("lodash");

import { ts, Project } from "ts-morph";
import { performance } from "perf_hooks";
import { assert } from "console";

import { Program, projectToProgram } from "./process";

export enum Refactoring {
    ConvertParamsToDestructuredObject = "Convert parameters to destructured object",
    ConvertToTemplateString = "Convert to template string",
    GenerateGetAndSetAccessors = "Generate 'get' and 'set' accessors",
    ExtractSymbol = "Extract Symbol",
    MoveToNewFile = "Move to a new file",
}

export type NodePredicate = (_: ts.Node) => boolean;

export interface RefactorInfo {
    name: string;
    action: string;
    triggeringRange: ts.TextRange;
    editInfo: ts.RefactorEditInfo;
    resultingProgram?: Program;
    introducesError?: boolean;
}

export const REFACTOR_TO_PRED: Map<Refactoring, NodePredicate> = new Map([
    [Refactoring.ConvertParamsToDestructuredObject, isParameter],
    [Refactoring.ConvertToTemplateString, isStringConcat],
    [Refactoring.GenerateGetAndSetAccessors, isField],
    [Refactoring.ExtractSymbol, isCallOrLiteral],
    [Refactoring.MoveToNewFile, isTopLevelDeclaration],
]);

const USER_PREFERENCES = {
    allowTextChangesInNewFiles: true,
};

function isStringConcat(node: ts.Node) {
    return ts.isStringLiteral(node) && ts.isBinaryExpression(node.parent);
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

export function getRefactorInfo(
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
        USER_PREFERENCES
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
        USER_PREFERENCES
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
