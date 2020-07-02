import yargs = require("yargs");
import fs = require("fs");
import Ajv = require("ajv");

import * as types from "./types";

type Object = { [key: string]: object };
type Schema = { definitions: Object };
const schema: Schema  = JSON.parse(fs.readFileSync("schema/types.json", { encoding: "utf-8" }));

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
    ajv.addSchema(schema, "types");
    if (!ajv.validate({ $ref: "types#/definitions/RawSolutions" }, solutionsRaw)) {
        throw ajv.errors;
    }
    const solutionsJson = solutionsRaw as types.RawSolutions;
    const solutionsMap = solutionsJson.map(objectsMap);
}


function objectsMap(objects: types.RawObject[]): Map<string, Object> {
    return new Map(); // TODO
}


if (!module.parent) {
    main();
}