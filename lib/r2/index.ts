import { getEnv } from "@/lib/cf/bindings";
import { isGhostContext, type AnyTenantContext } from "@/lib/tenant/context";
import { GhostReadOnlyError } from "@/lib/auth/ghost";

/**
 * Org-scoped access to the private R2 documents bucket. Every key is prefixed
 * with `org_{organisationId}/` so a request can only ever address its own
 * tenant's files, and callers must go through these helpers (which build the key
 * from the TenantContext) rather than constructing keys by hand.
 */

function orgPrefix(ctx: AnyTenantContext): string {
  return `org_${ctx.organisationId}/`;
}

/** Build (and validate) a full object key inside the tenant's namespace. */
export function tenantKey(ctx: AnyTenantContext, relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, "");
  if (clean.includes("..")) throw new Error("Invalid object path");
  return `${orgPrefix(ctx)}${clean}`;
}

/** Assert a key belongs to the tenant before any read/delete. */
function assertScoped(ctx: AnyTenantContext, key: string): void {
  if (!key.startsWith(orgPrefix(ctx))) {
    throw new Error("Cross-tenant R2 access denied");
  }
}

export async function putDocument(
  ctx: AnyTenantContext,
  relativePath: string,
  body: ArrayBuffer | ReadableStream | string,
  httpMetadata?: R2HTTPMetadata,
): Promise<string> {
  if (isGhostContext(ctx)) throw new GhostReadOnlyError();
  const key = tenantKey(ctx, relativePath);
  await getEnv().DOCS.put(key, body, { httpMetadata });
  return key;
}

export async function getDocument(ctx: AnyTenantContext, key: string): Promise<R2ObjectBody | null> {
  assertScoped(ctx, key);
  return getEnv().DOCS.get(key);
}

export async function deleteDocument(ctx: AnyTenantContext, key: string): Promise<void> {
  if (isGhostContext(ctx)) throw new GhostReadOnlyError();
  assertScoped(ctx, key);
  await getEnv().DOCS.delete(key);
}

/** Delete every file stored under this centre's prefix (erasure). Returns how many went. */
export async function deleteAllDocuments(ctx: AnyTenantContext): Promise<number> {
  if (isGhostContext(ctx)) throw new GhostReadOnlyError();
  const bucket = getEnv().DOCS;
  const prefix = tenantKey(ctx, "");
  let removed = 0;
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    const keys = page.objects.map((o) => o.key);
    if (keys.length) { await bucket.delete(keys); removed += keys.length; }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return removed;
}

export async function listDocuments(ctx: AnyTenantContext, subPrefix = ""): Promise<R2Objects> {
  return getEnv().DOCS.list({ prefix: tenantKey(ctx, subPrefix) });
}
