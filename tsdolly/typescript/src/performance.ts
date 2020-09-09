import fs = require("fs");
import { PerformanceObserver } from "perf_hooks";

export function registerPerformance(path: string): void {
    try {
        fs.writeFileSync(path, "", {
            encoding: "utf-8",
        });
    } catch (error) {
        console.log(
            `Error ${error} found while cleaning contents of performance file ${path}.`
        );
    }

    new PerformanceObserver((list, observer) => {
        const perfEntries = list
            .getEntries()
            .map((entry) =>
                JSON.stringify(entry, /* replacer */ undefined, /* space */ 0)
            );
        try {
            // Performance will be a JSONL file
            fs.appendFileSync(path, "\n" + perfEntries.join("\n"), {
                encoding: "utf-8",
            });
            console.log(`Performance entries appended to ${path}`);
        } catch (error) {
            console.log(
                `Error ${error} found while writing performance entries to file ${path}.\n\tEntries:\n${perfEntries}`
            );
        }
    }).observe({ entryTypes: ["mark"], buffered: true });
}
