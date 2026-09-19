/**
 * Domain rules as pure functions. No DB, no framework, no I/O — just the RYA
 * business logic (conflict, fit-to-roster, ratio & safety cover). Trivially
 * unit-tested and reused by both the office admin and the instructor portal.
 */
export * from "./time";
export * from "./conflict";
export * from "./fit";
export * from "./ratio";
