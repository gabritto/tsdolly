"use strict";
exports.__esModule = true;
var yargs = require("yargs");
var fs = require("fs");
var Ajv = require("ajv");
var SCHEMA = JSON.parse(fs.readFileSync("schema/types.json", { encoding: "utf-8" }));
var ENTRY_ID = "Program$0";
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
    var ajv = new Ajv({ removeAdditional: true });
    ajv.addSchema(SCHEMA, "types");
    if (!ajv.validate({ $ref: "types#/definitions/Solutions" }, solutionsRaw)) {
        throw ajv.errors;
    }
    var solutionsJson = solutionsRaw;
    var solutionsMap = solutionsJson.map(objectsMap);
    console.log(solutionsMap.length + " solutions found");
    console.log(JSON.stringify(solutionsJson[0], undefined, 4));
}
function objectsMap(objects) {
    var objectMap = new Map();
    for (var _i = 0, objects_1 = objects; _i < objects_1.length; _i++) {
        var object = objects_1[_i];
        objectMap.set(object.nodeId, object);
    }
    return objectMap;
}
function solutionToProgram(objectMap) {
    var program = getOrThrow(objectMap, ENTRY_ID);
}
if (!module.parent) {
    main();
}
// Utility
function getOrThrow(map, key) {
    var value = map.get(key);
    if (value === undefined) {
        throw new Error("Key " + key + " not found");
    }
    return value;
}
//# sourceMappingURL=index.js.map