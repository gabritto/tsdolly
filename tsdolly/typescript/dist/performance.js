"use strict";
exports.__esModule = true;
exports.registerPerformance = void 0;
var fs = require("fs");
var perf_hooks_1 = require("perf_hooks");
function registerPerformance(path) {
    try {
        fs.writeFileSync(path, "", {
            encoding: "utf-8"
        });
    }
    catch (error) {
        console.log("Error " + error + " found while cleaning contents of performance file " + path + ".");
    }
    new perf_hooks_1.PerformanceObserver(function (list, observer) {
        var perfEntries = list
            .getEntries()
            .map(function (entry) {
            return JSON.stringify(entry, /* replacer */ undefined, /* space */ 0);
        });
        try {
            // Performance will be a JSONL file
            fs.appendFileSync(path, "\n" + perfEntries.join("\n"), {
                encoding: "utf-8"
            });
            console.log("Performance entries appended to " + path);
        }
        catch (error) {
            console.log("Error " + error + " found while writing performance entries to file " + path + ".\n\tEntries:\n" + perfEntries);
        }
    }).observe({ entryTypes: ["mark"], buffered: true });
}
exports.registerPerformance = registerPerformance;
//# sourceMappingURL=performance.js.map