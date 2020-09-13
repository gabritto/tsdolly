"use strict";
exports.__esModule = true;
exports.getRefactorInfo = exports.REFACTOR_TO_PRED = exports.Refactoring = void 0;
var _ = require("lodash");
var ts_morph_1 = require("ts-morph");
var perf_hooks_1 = require("perf_hooks");
var console_1 = require("console");
var process_1 = require("./process");
var Refactoring;
(function (Refactoring) {
    Refactoring["ConvertParamsToDestructuredObject"] = "Convert parameters to destructured object";
    Refactoring["ConvertToTemplateString"] = "Convert to template string";
    Refactoring["GenerateGetAndSetAccessors"] = "Generate 'get' and 'set' accessors";
    Refactoring["ExtractSymbol"] = "Extract Symbol";
    Refactoring["MoveToNewFile"] = "Move to a new file";
})(Refactoring = exports.Refactoring || (exports.Refactoring = {}));
exports.REFACTOR_TO_PRED = new Map([
    [Refactoring.ConvertParamsToDestructuredObject, isParameter],
    [Refactoring.ConvertToTemplateString, isStringConcat],
    [Refactoring.GenerateGetAndSetAccessors, isField],
    [Refactoring.ExtractSymbol, isCallOrLiteral],
    [Refactoring.MoveToNewFile, isTopLevelDeclaration],
]);
var USER_PREFERENCES = {
    allowTextChangesInNewFiles: true
};
function isStringConcat(node) {
    return ts_morph_1.ts.isStringLiteral(node) && ts_morph_1.ts.isBinaryExpression(node.parent);
}
function isParameter(node) {
    return ts_morph_1.ts.isParameter(node);
}
function isField(node) {
    return ts_morph_1.ts.isPropertyDeclaration(node);
}
function isCallOrLiteral(node) {
    return ts_morph_1.ts.isCallExpression(node) || ts_morph_1.ts.isLiteralExpression(node);
}
function isTopLevelDeclaration(node) {
    return ts_morph_1.ts.isFunctionDeclaration(node) || ts_morph_1.ts.isClassDeclaration(node);
}
function getRefactorInfo(project, program, file, applyRefactoring, enabledRefactoring, pred) {
    perf_hooks_1.performance.mark("start_getRefactorInfo");
    var refactorsInfo = [];
    visit(file);
    refactorsInfo = _.uniqWith(refactorsInfo, function (a, b) {
        return _.isEqual(a.editInfo, b.editInfo);
    });
    if (applyRefactoring) {
        // TODO: should we apply refactorings even when program has error?
        for (var _i = 0, refactorsInfo_1 = refactorsInfo; _i < refactorsInfo_1.length; _i++) {
            var refactorInfo = refactorsInfo_1[_i];
            refactorInfo.resultingProgram = getRefactorResult(project, refactorInfo);
            if (refactorInfo.resultingProgram.hasError && !program.hasError) {
                refactorInfo.introducesError = true;
            }
        }
    }
    perf_hooks_1.performance.mark("end_getRefactorInfo");
    return refactorsInfo;
    function visit(node) {
        if (pred(node)) {
            var refactorInfo = getApplicableRefactors(project, node).filter(function (refactorInfo) { return enabledRefactoring === refactorInfo.name; });
            refactorInfo.forEach(function (refactor) {
                refactor.actions.forEach(function (action) {
                    var edit = getEditInfo(project, node, refactor.name, action.name);
                    if (edit) {
                        refactorsInfo.push({
                            name: refactor.name,
                            action: action.name,
                            editInfo: edit,
                            triggeringRange: { pos: node.pos, end: node.end }
                        });
                    }
                });
            });
        }
        node.forEachChild(visit);
    }
}
exports.getRefactorInfo = getRefactorInfo;
function getApplicableRefactors(project, node) {
    var languageService = project.getLanguageService().compilerObject;
    return languageService.getApplicableRefactors(node.getSourceFile().fileName, node, USER_PREFERENCES);
}
function getEditInfo(project, node, refactorName, actionName) {
    var languageService = project.getLanguageService().compilerObject;
    var formatSettings = project.manipulationSettings.getFormatCodeSettings();
    var editInfo = languageService.getEditsForRefactor(node.getSourceFile().fileName, 
    /* formatOptions */ formatSettings, node, refactorName, actionName, USER_PREFERENCES);
    console_1.assert((editInfo === null || editInfo === void 0 ? void 0 : editInfo.commands) === undefined, "We cannot deal with refactorings which include commands.");
    return editInfo;
}
function getRefactorResult(project, refactorInfo) {
    project = cloneProject(project);
    return process_1.projectToProgram(applyRefactorEdits(project, refactorInfo));
}
function applyRefactorEdits(project, refactorInfo) {
    refactorInfo.editInfo.edits.forEach(function (change) {
        return applyFileChange(project, change);
    });
    return project;
}
function cloneProject(project) {
    var newProject = new ts_morph_1.Project({
        compilerOptions: project.getCompilerOptions()
    });
    for (var _i = 0, _a = project.getSourceFiles(); _i < _a.length; _i++) {
        var file = _a[_i];
        newProject.createSourceFile(file.getFilePath(), file.getFullText());
    }
    return newProject;
}
function applyFileChange(project, fileChange) {
    if (fileChange.isNewFile) {
        var text = singleton(fileChange.textChanges, "Text changes for a new file should only have one change.").newText;
        project.createSourceFile(fileChange.fileName, text);
    }
    else {
        var file = project.getSourceFileOrThrow(fileChange.fileName);
        file.applyTextChanges(fileChange.textChanges);
    }
}
function singleton(arr, message) {
    if (arr.length != 1) {
        throw new Error("Expected array to have exactly one item, but array has " + arr.length + " items.\n" + (message || ""));
    }
    return arr[0];
}
//# sourceMappingURL=refactor.js.map