import yargs = require("yargs");
import fs = require("fs");
import Ajv = require("ajv");

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

function objectsMap(objects: types.Node[]): Map<string, types.Node> {
    const objectMap = new Map<string, types.Node>();
    for (const object of objects) {
        objectMap.set(object.nodeId, object);
    }
    return objectMap;
}

function solutionToProgram(objectMap: Map<string, types.Node>) {
    const program = getOrThrow(objectMap, ENTRY_ID);
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