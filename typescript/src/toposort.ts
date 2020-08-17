import _ = require("lodash");
import { assert } from "console";

const enum State {
    Unvisited = 0,
    Visiting = 1,
    Visited = 2,
}

/**
 *
 * @param edges adjacency list
 * @returns list of vertex indices in topological order
 */
export function toposort(edges: number[][]): number[] {
    const n = edges.length;
    const state = new Array<State>(n);
    _.fill(state, State.Unvisited);

    const sort: number[] = [];

    for (let index = 0; index < state.length; index++) {
        if (state[index] === State.Unvisited) {
            visit(index);
        }
    }

    assert(sort.length === n);
    return sort;

    function visit(u: number) {
        if (state[u] === State.Visited) return;

        state[u] = State.Visiting;

        const neighbors = edges[u];
        for (const v of neighbors) {
            if (state[v] === State.Visiting) {
                throw new Error(`Found cycle between nodes ${u} and ${v}.`);
            }
            visit(v);
        }

        sort.push(u);
        state[u] = State.Visited;
    }
}
