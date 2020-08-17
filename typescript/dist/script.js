"use strict";
exports.__esModule = true;
var fs = require("fs");
function inspectResults(path) {
    var results = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));
    return results;
}
function getErrorResults(results) {
    return results.filter(function (res) { return res.program.hasError; });
}
function prettyPrintError(result) {
    console.log("Program:\n\u001B[34m" + result.program + "\u001B[0m\nErrors:\n" + result.program.errors.map(function (e) { return e.messageText; }).join("\n"));
}
//# sourceMappingURL=script.js.map