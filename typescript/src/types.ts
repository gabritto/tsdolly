import { string } from "yargs"

export type RawSolutions = RawObject[][];

export interface RawObject {
    type: string,
    id: string,
}