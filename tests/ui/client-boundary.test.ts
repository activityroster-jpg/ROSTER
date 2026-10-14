/**
 * Server code must never call a plain function exported from a "use client" file.
 * Next.js turns those exports into client references: the call type-checks and works
 * in `next dev`, but a production build throws "Attempted to call X() from the server"
 * and the page shows "Something went wrong" (this took down /privacy-request on
 * 14 Oct 2026). Components (PascalCase) and types are fine to import; shared helpers
 * and lists belong in a module without "use client".
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const ROOTS = ["app", "components", "lib"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const isClient = (src: string) => /^\s*(\/\/[^\n]*\n\s*)*["']use client["']/.test(src);

function resolve(spec: string, from: string): string | null {
  const base = spec.startsWith("@/") ? spec.slice(2) : spec.startsWith(".") ? normalize(join(dirname(from), spec)) : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext;
  return null;
}

describe("client/server boundary", () => {
  it("no server file imports a non-component function from a \"use client\" file", () => {
    const files = ROOTS.flatMap((r) => walk(r));
    const src = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
    const clientHelpers = new Map<string, Set<string>>();
    for (const [f, s] of src) {
      if (!isClient(s)) continue;
      const names = [...s.matchAll(/export\s+(?:async\s+)?(?:const|function|let)\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]!).filter((n) => !/^[A-Z]/.test(n));
      if (names.length) clientHelpers.set(f, new Set(names));
    }
    const problems: string[] = [];
    for (const [f, s] of src) {
      if (isClient(s)) continue;
      for (const m of s.matchAll(/import\s+(?!type\b)\{([^}]*)\}\s+from\s+["']([^"']+)["']/g)) {
        const target = resolve(m[2]!, f);
        const helpers = target ? clientHelpers.get(target) : undefined;
        if (!helpers) continue;
        const imported = m[1]!.split(",").map((x) => x.trim()).filter((x) => x && !x.startsWith("type ")).map((x) => x.split(/\s+as\s+/)[0]!);
        for (const name of imported) if (helpers.has(name)) problems.push(`${f} imports ${name}() from client file ${target}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
