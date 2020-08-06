"use strict";
exports.__esModule = true;
exports.buildProgram = exports.buildProject = void 0;
var _ = require("lodash");
var ts_morph_1 = require("ts-morph");
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
    var declarations = ts_morph_1.ts.createNodeArray(program.declarations.map(buildDeclaration));
    var file = ts_morph_1.ts.createSourceFile("program.ts", "", COMPILER_OPTIONS.target, 
    /* setParentNodes */ false, ts_morph_1.ts.ScriptKind.TS); // TODO: refactor to use same options
    var printer = ts_morph_1.ts.createPrinter({ newLine: ts_morph_1.ts.NewLineKind.LineFeed });
    var result = printer.printList(ts_morph_1.ts.ListFormat.MultiLine, declarations, file);
    return result;
}
exports.buildProgram = buildProgram;
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
    return ts_morph_1.ts.createClassDeclaration(
    /* decorators */ undefined, 
    /* modifiers */ undefined, 
    /* name */ name, 
    /* typeParameters */ undefined, 
    /* heritageClauses */ heritageClauses, 
    /* members */ methods);
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
    var statements = block.statements.map(buildStatement);
    return ts_morph_1.ts.createBlock(/* statements */ statements, /* multiline */ true);
}
function buildStatement(statement) {
    switch (statement.nodeType) {
        case "ExpressionStatement":
            return buildExpressionStatement(statement);
    }
}
function buildExpressionStatement(expressionStatement) {
    var expression = buildExpression(expressionStatement.expression);
    return ts_morph_1.ts.createExpressionStatement(expression);
}
function buildExpression(expression) {
    switch (expression.nodeType) {
        case "VariableAccess":
            return buildVariableAccess(expression);
        case "AssignmentExpression":
            return buildAssignmentExpression(expression);
        case "FunctionCall":
            return buildFunctionCall(expression);
        case "StringConcat":
            return buildStringConcat(expression);
    }
}
function buildVariableAccess(variableAccess) {
    var identifier = getIdentifier(variableAccess.variable);
    return ts_morph_1.ts.createIdentifier(identifier);
}
function buildAssignmentExpression(assignmentExpression) {
    var left = buildVariableAccess(assignmentExpression.left);
    var right = buildExpression(assignmentExpression.right);
    return ts_morph_1.ts.createBinary(
    /* left */ left, 
    /* operator */ ts_morph_1.ts.SyntaxKind.EqualsToken, 
    /* right */ right);
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