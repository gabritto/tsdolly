import fs = require("fs");
import { Result } from "./process";

function inspectResults(path: string): Result[] {
    const results = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));
    return results as Result[];
}

function getErrorResults(results: Result[]): Result[] {
    return results.filter((res) => res.program.hasError);
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
