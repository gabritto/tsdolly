"use strict";
exports.__esModule = true;
exports.getErrorsByCode = exports.getErrors = exports.filterErrorResults = exports.getResults = void 0;
var fs = require("fs");
var _ = require("lodash");
function getResults(path) {
    var results = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));
    return results;
}
exports.getResults = getResults;
function filterErrorResults(results) {
    return results.filter(function (res) { return res.program.hasError; });
}
exports.filterErrorResults = filterErrorResults;
function getErrors(results) {
    return _.flatMap(results, function (result) { return result.program.errors; });
}
exports.getErrors = getErrors;
function getErrorsByCode(results) {
    var errors = getErrors(results);
    return _.groupBy(errors, function (error) { return error.code; });
}
exports.getErrorsByCode = getErrorsByCode;
//# sourceMappingURL=script.js.map