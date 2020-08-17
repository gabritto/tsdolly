"use strict";
exports.__esModule = true;
exports.toposort = void 0;
var _ = require("lodash");
var console_1 = require("console");
var State;
(function (State) {
    State[State["Unvisited"] = 0] = "Unvisited";
    State[State["Visiting"] = 1] = "Visiting";
    State[State["Visited"] = 2] = "Visited";
})(State || (State = {}));
/**
 *
 * @param edges adjacency list
 * @returns list of vertex indices in topological order
 */
function toposort(edges) {
    var n = edges.length;
    var state = new Array(n);
    _.fill(state, 0 /* Unvisited */);
    var sort = [];
    for (var index = 0; index < state.length; index++) {
        if (state[index] === 0 /* Unvisited */) {
            visit(index);
        }
    }
    console_1.assert(sort.length === n);
    return sort;
    function visit(u) {
        if (state[u] === 2 /* Visited */)
            return;
        state[u] = 1 /* Visiting */;
        var neighbors = edges[u];
        for (var _i = 0, neighbors_1 = neighbors; _i < neighbors_1.length; _i++) {
            var v = neighbors_1[_i];
            if (state[v] === 1 /* Visiting */) {
                throw new Error("Found cycle between nodes " + u + " and " + v + ".");
            }
            visit(v);
        }
        sort.push(u);
        state[u] = 2 /* Visited */;
    }
}
exports.toposort = toposort;
//# sourceMappingURL=toposort.js.map