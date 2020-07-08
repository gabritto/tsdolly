import yargs = require("yargs");
import fs = require("fs");
import Ajv = require("ajv");
import ts = require("typescript");

import * as types from "./types";

type Object = { [key: string]: object };
type Schema = { definitions: Object };
const SCHEMA: Schema  = JSON.parse(fs.readFileSync("schema/types.json", { encoding: "utf-8" }));
const ENTRY_ID: string = "Program$0";

function main(): void {
    const args = yargs
        .usage("To do")
        .option("solution", {
            describe: "Path to file containing the Alloy metamodel solutions",
            type: "string",
            default: "../output/alloySolutions.json",
        }).argv;

    tsdolly(args);
}

function tsdolly(args: { solution: string }): void {
    const solutionFile = fs.readFileSync(args.solution, { encoding: "utf-8" });
    const solutionsRaw: unknown = JSON.parse(solutionFile);
    const ajv = new Ajv({ removeAdditional: true });
    ajv.addSchema(SCHEMA, "types");
    if (!ajv.validate({ $ref: "types#/definitions/Solutions" }, solutionsRaw)) {
        throw ajv.errors;
    }
    const solutionsJson = solutionsRaw as types.Solutions;
    const solutionsMap = solutionsJson.map(objectsMap);
    console.log(`${solutionsMap.length} solutions found`);
    console.log(JSON.stringify(solutionsJson[0], undefined, 4));
}

function solutionToProgram(objectMap: Map<string, types.Node>) {
    const program = getOrThrow(objectMap, ENTRY_ID);
}

class SolutionParser {
    private ajv: Ajv.Ajv;
    private objectMap: Map<string, types.Node>;

    constructor(objects: types.Node[]) {
        this.ajv = new Ajv({ removeAdditional: true }).addSchema(SCHEMA, "types");
        this.objectMap = SolutionParser.objectsMap(objects);
    }

    private static objectsMap(objects: types.Node[]): Map<string, types.Node> {
        const objectMap = new Map<string, types.Node>();
        for (const object of objects) {
            objectMap.set(object.nodeId, object);
        }
        return objectMap;
    }

    buildProgram(node: types.Node): undefined {
        // const project = new Project({
        //     compilerOptions: {
        //         strict: true
        //     }
        // });
        // const program = project.createSourceFile("../output/program.ts");
        // const functions = program.addFunctions();
        // const file = ts.createSourceFile("../output/program.ts", undefined, ts.ScriptTarget.Latest);
        const program = this.parseProgram(node);
        for (const declarationId of program.declarations) {
            // TODO: build declarations & create program
        }
    }

    buildDeclaration(node: types.Node): ts.Declaration {
        // TODO: implement
    }

    buildFunctionDecl(node: types.Node): ts.FunctionDeclaration {
        const functionNode = this.parseFunctionDecl(node);
        const name = this.getIdentifier(functionNode.name);
        const parameters: ts.ParameterDeclaration[] = [];
        for (const parameterId of functionNode.parameters) {
            const parameterNode = getOrThrow(this.objectMap, parameterId);
            parameters.push(this.buildParameterDecl(parameterNode));
        }

        const functionDecl = ts.createFunctionDeclaration(
            /* decorators */ undefined,
            /* modifiers */ undefined,
            /* asteriskToken */ undefined,
            /* name */ name,
            /* typeParameters */ undefined,
            /* parameters */ parameters, // TODO: pass params
            /* type */ undefined,
            /* body */ undefined
            );
        return functionDecl;
    }

    buildParameterDecl(node: types.Node): ts.ParameterDeclaration {
        const paramNode = this.parseParameterDecl(node);
        const param = ts.createParameter(/* TODO */);
        return param;
        // TODO: implement
    }

    private getIdentifier(nodeId: string): string {
        return nodeId; // TODO: prettify name; add pretty name generator to class (e.g. use alphabet letters...)
    }

    private parseProgram(node: types.Node): types.Program {
        if (!this.ajv.validate({ $ref: "types#/definitions/Program" }, node)) {
            throw this.ajv.errors;
        }

        return node as types.Program;
    }

    // private parseDeclaration(node: types.Node): types.Declaration {
    //     switch (node.nodeType) {
    //         case "FunctionDecl":
    //             return this.parseFunctionDecl(node);
    //     }

    //     throw new Error(unexpectedTypeMessage("Declaration", node.nodeType));
    // }

    private parseFunctionDecl(node: types.Node): types.FunctionDecl {
        if (!this.ajv.validate({ $ref: "types#/definitions/FunctionDecl" }, node)) {
            throw this.ajv.errors;
        }

        return node as types.FunctionDecl;
    }

    private parseParameterDecl(node: types.Node): types.ParameterDecl {
        if (!this.ajv.validate({ $ref: "types#/definitions/ParameterDecl" }, node)) {
            throw this.ajv.errors;
        }

        return node as types.ParameterDecl;
    }
}

function unexpectedTypeMessage(expectedType: string, gotType: string): string {
    return `Expected node of type '${expectedType}', got node of type ${gotType}`;
}


if (!module.parent) {
    main();
}

// Utility

function getOrThrow<K, V>(map: Map<K, V>, key: K): V {
    const value = map.get(key);
    if (value === undefined) {
        throw new Error(`Key ${key} not found`);
    }
    return value;
}