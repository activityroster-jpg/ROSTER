/**
 * Single Drizzle schema for the whole platform: control-plane (global) plus
 * tenant-owned tables. One schema, one migration path (see drizzle.config.ts).
 */
export * from "./control-plane";
export * from "./tenant";

import * as controlPlane from "./control-plane";
import * as tenant from "./tenant";

/** The full schema object passed to `drizzle(client, { schema })`. */
export const schema = { ...controlPlane, ...tenant };
