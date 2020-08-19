"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.buildProgram = exports.buildProject = void 0;
var _ = require("lodash");
var ts_morph_1 = require("ts-morph");
var toposort_1 = require("./toposort");
var console_1 = require("console");
var COMPILER_OPTIONS = {
    strict: true,
    target: ts_morph_1.ts.ScriptTarget.Latest,
    noEmit: true
};
function buildProject(program, filePath) {
    var project = new ts_morph_1.Project({ compilerOptions: COMPILER_OPTIONS });
    project.createSourceFile(filePath, program);
    return project;
}
exports.buildProject = buildProject;
function buildProgram(program) {
    var declarations = ts_morph_1.ts.createNodeArray(sortDeclarations(program.declarations).map(buildDeclaration));
    var file = ts_morph_1.ts.createSourceFile("program.ts", "", COMPILER_OPTIONS.target, 
    /* setParentNodes */ false, ts_morph_1.ts.ScriptKind.TS); // TODO: refactor to use same options
    var printer = ts_morph_1.ts.createPrinter({ newLine: ts_morph_1.ts.NewLineKind.LineFeed });
    var result = printer.printList(ts_morph_1.ts.ListFormat.MultiLine, declarations, file);
    return result;
}
exports.buildProgram = buildProgram;
function sortDeclarations(declarations) {
    var n = declarations.length;
    var edges = new Array(n);
    var _loop_1 = function (d) {
        edges[d] = [];
        var decl = declarations[d];
        if (decl.nodeType === "ClassDecl" && decl.extend) {
            var parent_1 = _.findIndex(declarations, function (otherDecl) {
                return otherDecl.nodeType === "ClassDecl" &&
                    otherDecl.nodeId === decl.extend.nodeId;
            });
            if (parent_1 >= 0) {
                console_1.assert(parent_1 >= 0, "Class " + getIdentifier(decl.extend.name) + " should exist among declarations");
                edges[d].push(parent_1);
            }
        }
    };
    for (var d = 0; d < declarations.length; d++) {
        _loop_1(d);
    }
    var sort = toposort_1.toposort(edges);
    var sortedDeclarations = [];
    for (var _i = 0, sort_1 = sort; _i < sort_1.length; _i++) {
        var idx = sort_1[_i];
        sortedDeclarations.push(declarations[idx]);
    }
    console_1.assert(sortedDeclarations.length === declarations.length);
    return sortedDeclarations;
}
function buildDeclaration(declaration) {
    switch (declaration.nodeType) {
        case "FunctionDecl":
            return buildFunctionDecl(declaration);
        case "ClassDecl":
            return buildClassDecl(declaration);
    }
}
function buildFunctionDecl(functionDecl) {
    var name = getIdentifier(functionDecl.name);
    var parameters = functionDecl.parameters.map(buildParameterDecl);
    var body = buildBlock(functionDecl.body);
    return ts_morph_1.ts.createFunctionDeclaration(
    /* decorators */ undefined, 
    /* modifiers */ undefined, 
    /* asteriskToken */ undefined, 
    /* name */ name, 
    /* typeParameters */ undefined, 
    /* parameters */ parameters, 
    /* type */ undefined, 
    /* body */ body);
}
function buildClassDecl(classDecl) {
    var name = getIdentifier(classDecl.name);
    var heritageClauses = [];
    if (classDecl.extend != null) {
        var parentClassName = getIdentifier(classDecl.extend.name);
        var parentClass = ts_morph_1.ts.createExpressionWithTypeArguments(
        /* typeArguments */ undefined, 
        /* expression */ ts_morph_1.ts.createIdentifier(parentClassName));
        var heritageClause = ts_morph_1.ts.createHeritageClause(
        /* token */ ts_morph_1.ts.SyntaxKind.ExtendsKeyword, 
        /* types */ [parentClass]);
        heritageClauses.push(heritageClause);
    }
    var methods = classDecl.methods.map(buildMethodDecl);
    var fields = classDecl.fields.map(buildField);
    return ts_morph_1.ts.createClassDeclaration(
    /* decorators */ undefined, 
    /* modifiers */ undefined, 
    /* name */ name, 
    /* typeParameters */ undefined, 
    /* heritageClauses */ heritageClauses, __spreadArrays(fields, methods));
}
function buildField(field) {
    var name = ts_morph_1.ts.createIdentifier(getIdentifier(field.name));
    var type = buildType(field.type);
    var modifiers = [];
    if (field.visibility) {
        modifiers.push(ts_morph_1.ts.createToken(ts_morph_1.ts.SyntaxKind.PrivateKeyword));
    }
    return ts_morph_1.ts.createProperty(
    /* decorators */ undefined, 
    /* modifiers */ modifiers, 
    /* name */ name, 
    /* questionOrExclamationToken */ ts_morph_1.ts.createToken(ts_morph_1.ts.SyntaxKind.QuestionToken), 
    /* type */ type, 
    /* initializer */ undefined);
}
function buildMethodDecl(methodDecl) {
    var name = getIdentifier(methodDecl.name);
    var parameters = methodDecl.parameters.map(buildParameterDecl);
    var body = buildBlock(methodDecl.body);
    return ts_morph_1.ts.createMethod(
    /* decorators */ undefined, 
    /* modifiers */ undefined, 
    /* asteriskToken */ undefined, 
    /* name */ name, 
    /* questionToken */ undefined, 
    /* typeParameters */ undefined, 
    /* parameters */ parameters, 
    /* type */ undefined, 
    /* body */ body);
}
function buildParameterDecl(parameterDecl) {
    var name = getIdentifier(parameterDecl.name);
    var type = buildType(parameterDecl.type);
    return ts_morph_1.ts.createParameter(
    /* decorators */ undefined, 
    /* modifiers */ undefined, 
    /* dotDotToken */ undefined, 
    /* name */ name, 
    /* questionToken */ undefined, 
    /* type */ type, 
    /* initializer */ undefined);
}
function buildType(type) {
    switch (type.nodeType) {
        case "TNumber":
        case "TString":
            return buildPrimType(type);
    }
}
function buildPrimType(type) {
    switch (type.nodeType) {
        case "TNumber":
            return ts_morph_1.ts.createKeywordTypeNode(ts_morph_1.ts.SyntaxKind.NumberKeyword);
        case "TString":
            return ts_morph_1.ts.createKeywordTypeNode(ts_morph_1.ts.SyntaxKind.StringKeyword);
    }
}
function buildBlock(block) {
    var statements = [];
    if (block.expression) {
        statements = [
            ts_morph_1.ts.createExpressionStatement(buildExpression(block.expression)),
        ];
    }
    return ts_morph_1.ts.createBlock(/* statements */ statements, /* multiline */ true);
}
function buildExpression(expression) {
    switch (expression.nodeType) {
        case "VariableAccess":
            return buildVariableAccess(expression);
        case "FunctionCall":
            return buildFunctionCall(expression);
        case "StringConcat":
            return buildStringConcat(expression);
        case "MethodCall":
            return buildMethodCall(expression);
    }
}
function buildVariableAccess(variableAccess) {
    var identifier = getIdentifier(variableAccess.variable);
    switch (variableAccess.variable.nodeType) {
        case "FieldIdentifier":
            return ts_morph_1.ts.createPropertyAccess(
            /* expression */ ts_morph_1.ts.createThis(), 
            /* name */ ts_morph_1.ts.createIdentifier(identifier));
        case "ParameterIdentifier":
            return ts_morph_1.ts.createIdentifier(identifier);
    }
}
function buildFunctionCall(functionCall) {
    var identifier = ts_morph_1.ts.createIdentifier(getIdentifier(functionCall.name));
    var args = functionCall.arguments.map(buildExpression);
    return ts_morph_1.ts.createCall(
    /* expression */ identifier, 
    /* typeArguments */ undefined, 
    /* argumentsArray */ args);
}
function buildStringConcat(stringConcat) {
    return buildStringConcatWorker(stringConcat.concat);
}
// Builds left-associative string/expression concatenation.
function buildStringConcatWorker(strings) {
    if (strings.length === 0) {
        throw new Error("Expected at least one element in string concat array");
    }
    if (strings.length == 1) {
        var s_1 = strings[0];
        return buildStringConcatElement(s_1);
    }
    var rest = _.initial(strings);
    var s = _.last(strings); // This cannot be undefined because strings.length > 1
    // const [s, ...rest] = strings;
    return ts_morph_1.ts.createBinary(
    /* left */ buildStringConcatWorker(rest), 
    /* operator */ ts_morph_1.ts.SyntaxKind.PlusToken, 
    /* right */ buildStringConcatElement(s));
}
function buildStringConcatElement(s) {
    switch (s.nodeType) {
        case "StringLiteral":
            return buildStringLiteral(s);
        case "VariableAccess":
            return buildVariableAccess(s); // TODO: do we need to parenthesize those?
    }
}
function buildStringLiteral(stringLiteral) {
    return ts_morph_1.ts.createStringLiteral(stringLiteral.nodeId);
}
function buildMethodCall(methodCall) {
    var identifier = ts_morph_1.ts.createIdentifier(getIdentifier(methodCall.name));
    var args = methodCall.arguments.map(buildExpression);
    var thisExpression = ts_morph_1.ts.createPropertyAccess(
    /* expression */ ts_morph_1.ts.createThis(), 
    /* name */ identifier);
    return ts_morph_1.ts.createCall(
    /* expression */ thisExpression, 
    /* typeArguments */ undefined, 
    /* argumentsArray */ args);
}
function getIdentifier(identifier) {
    // switch (identifier.nodeType) {
    //     case "FunctionIdentifier":
    //         return `function${identifier.nodeId}`
    //     case "ParameterIdentifier":
    //         return `param${identifier.nodeId}`
    // }
    return identifier.nodeId;
    // TODO: prettify names
}
//# sourceMappingURL=build.js.map