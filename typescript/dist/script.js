"use strict";
exports.__esModule = true;
var fs = require("fs");
function inspectResults(path) {
    var results = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));
    return results;
}
function getErrorResults(results) {
    return results.filter(function (res) { return res.hasError; });
}
function prettyPrintError(result) {
    console.log("Program:\n\u001B[34m" + result.program + "\u001B[0m\nError:" + result.errors);
}
//# sourceMappingURL=script.js.map