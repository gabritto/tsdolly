"use strict";
exports.__esModule = true;
var yargs = require("yargs");
var fs = require("fs");
var Ajv = require("ajv");
var schema = JSON.parse(fs.readFileSync("schema/types.json", { encoding: "utf-8" }));
function main() {
    var args = yargs
        .usage("To do")
        .option("solution", {
        describe: "Path to file containing the Alloy metamodel solutions",
        type: "string",
        "default": "../output/alloySolutions.json"
    }).argv;
    tsdolly(args);
}
function tsdolly(args) {
    var solutionFile = fs.readFileSync(args.solution, { encoding: "utf-8" });
    var solutionsRaw = JSON.parse(solutionFile);
    console.log(typeof schema);
    var ajv = new Ajv({ removeAdditional: true });
    ajv.addSchema(schema, "types");
    console.log(ajv.getSchema("types"));
    // const validate = ajv.compile(schema["definitions"]["RawSolutions"]);
    // const validate = 
    if (!ajv.validate({ $ref: "types#/definitions/RawSolutions" }, solutionsRaw)) {
        throw ajv.errors;
    }
    // if (!Array.isArray(solutionsRaw)) {
    //     throw new Error(`Expected a JSON array, got ${solutionsRaw}`);
    // }
    // solutionsRaw.forEach(solution => {
    //     if (!Array.isArray(solution)) {
    //         throw new Error(`Expected a JSON array, got ${solution}`);
    //     }
    // });
    // const solutionsJson: unknown[][] = solutionsRaw;
    // const solutionsMap = solutionsJson.map(objectsMap);
}
function objectsMap(objects) {
    return new Map();
    // const objectsMap = new Map<string, Object>();
    // objects.forEach(object => {
    //     if (typeof object !== "object" || object === null) {
    //         throw new Error(`Expected a JSON object, got ${object}`);
    //     }
    //     if ((object["type"]) {
    //     }
    //     objectsMap
    // })
    // return objectsMap;
}
if (!module.parent) {
    main();
}
//# sourceMappingURL=index.js.map