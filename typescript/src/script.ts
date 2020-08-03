import fs = require("fs");
import { Result } from "./index";

function inspectResults(path: string): Result[] {
    const results = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));
    return results as Result[];
}

function getErrorResults(results: Result[]): Result[] {
    return results.filter((res) => res.hasError);
}

function prettyPrintError(result: Result) {
    console.log(
        `Program:\n\u001b[34m${result.program}\u001b[0m\nError:${result.errors}`
    );
}
