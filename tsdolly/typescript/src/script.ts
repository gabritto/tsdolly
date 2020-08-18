import fs = require("fs");
import _ = require("lodash");

import { Result, CompilerError } from "./process";

export function getResults(path: string): Result[] {
    const results = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));
    return results as Result[];
}

export function filterErrorResults(results: Result[]): Result[] {
    return results.filter((res) => res.program.hasError);
}

export function getErrors(results: Result[]): CompilerError[] {
    return _.flatMap(results, (result) => result.program.errors);
}

export function getErrorsByCode(
    results: Result[]
): _.Dictionary<CompilerError[]> {
    const errors = getErrors(results);
    return _.groupBy(errors, (error) => error.code);
}

function prettyPrintError(result: Result) {
    console.log(
        `Program:\n\u001b[34m${
            result.program
        }\u001b[0m\nErrors:\n${result.program.errors
            .map((e) => e.messageText)
            .join("\n")}`
    );
}
