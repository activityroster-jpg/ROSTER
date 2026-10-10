import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { can, type Permission } from "@/lib/auth/rbac";

/**
 * Role by route (audit Part E phase 2, tests): every office page, server action
 * and office API route must authorise through requireTenant with a permission
 * (or the owner / office-role gate), and no entry point may reach the
 * repositories any other way. The portal has its own,
 * narrower rules. This is a static scan of the source, so a new file that
 * forgets the gate fails CI.
 */

const ROOT = join(__dirname, "..", "..");
const ENTRY = /^(page\.tsx|route\.ts|actions\.ts|.*-actions\.ts|layout\.tsx)$/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (ENTRY.test(name)) out.push(p);
  }
  return out;
}

const callsOf = (src: string): string[] => [...src.matchAll(/requireTenant\(([^)]*)\)/g)].map((m) => m[1]!.replace(/\s+/g, " ").trim());
const permissionsOf = (calls: string[]): string[] => calls.flatMap((c) => [...c.matchAll(/permission: "([a-z.]+)"/g)].map((m) => m[1]!));
const rel = (p: string) => relative(ROOT, p).replace(/\\/g, "/");

/** Entry points that deliberately do not go through requireTenant, and why. */
const ALLOWED_WITHOUT_GATE: Record<string, string> = {
  "app/(app)/office/ghost-actions.ts": "leaves Ghost Mode; requireTenant refuses every action while ghosting, and the Dev Center session is checked instead",
  "app/(app)/portal/welcome/actions.ts": "first password after a magic link: Better Auth's own session, no tenant data touched",
};

describe("role by route", () => {
  const office = walk(join(ROOT, "app/(app)/office"));
  const api = walk(join(ROOT, "app/api/office"));
  const portal = walk(join(ROOT, "app/(app)/portal"));

  it("finds the entry points (a sanity check on the scan itself)", () => {
    expect(office.length).toBeGreaterThan(30);
    expect(api.length).toBeGreaterThan(5);
    expect(portal.length).toBeGreaterThan(10);
  });

  it("every office page, action and API route authorises with a permission, the owner gate or the office-role gate", () => {
    const bare: string[] = [];
    const missing: string[] = [];
    for (const file of [...office, ...api]) {
      const src = readFileSync(file, "utf8");
      const calls = callsOf(src);
      const r = rel(file);
      if (calls.length === 0) { if (!ALLOWED_WITHOUT_GATE[r]) missing.push(r); continue; }
      for (const c of calls) if (!/permission: "|owner: true|role: "admin"/.test(c)) bare.push(`${r}: requireTenant(${c})`);
    }
    expect(missing, "entry points with no requireTenant at all").toEqual([]);
    expect(bare, "office entry points gated only by membership (an instructor could open them)").toEqual([]);
  });

  it("each office area asks for the permission its feature toggle grants, so an office admin with nothing ticked is kept out", () => {
    const expected: Record<string, Permission[]> = {
      "app/(app)/office/finance": ["finance.view"],
      "app/(app)/office/timeclock": ["finance.view"],
      // Settings → Pay rates is payroll data: its tab and save action ask for the Payroll tick.
      "app/(app)/office/settings": ["settings.edit", "finance.view"],
      "app/(app)/office/change-log": ["settings.edit"],
      "app/(app)/office/onboarding": ["settings.edit"],
      "app/(app)/office/billing": ["billing.manage"],
      "app/(app)/office/trial-survey": ["billing.manage"],
      "app/(app)/office/rota": ["rota.view", "roster.edit"],
      "app/(app)/office/courses": ["roster.edit"],
      "app/(app)/office/course-setup": ["roster.edit"],
      "app/(app)/office/availability": ["roster.edit"],
      "app/(app)/office/leave": ["roster.edit"],
      "app/(app)/office/equipment": ["roster.edit"],
      "app/(app)/office/locations": ["roster.edit"],
      "app/(app)/office/integrations": ["roster.edit"],
      "app/(app)/office/import": ["roster.edit"],
      "app/(app)/office/staff/import": ["staff.edit"],
      "app/api/office/export": ["data.export"],
      "app/api/office/audit-export": ["data.export"],
      "app/api/office/finance": ["data.export"],
      "app/api/office/emergency-sheet": ["rota.view"],
      "app/api/office/rota.pdf": ["rota.view"],
    };
    const wrong: string[] = [];
    for (const [dir, allowed] of Object.entries(expected)) {
      for (const file of walk(join(ROOT, dir))) {
        const r = rel(file);
        if (dir === "app/(app)/office/staff" && r.includes("/staff/import/")) continue;
        const perms = permissionsOf(callsOf(readFileSync(file, "utf8")));
        for (const p of perms) if (!allowed.includes(p as Permission)) wrong.push(`${r} asks for ${p}`);
      }
    }
    expect(wrong).toEqual([]);
    // The staff area mixes four permissions on purpose; the owner gate guards office access.
    const staffActions = readFileSync(join(ROOT, "app/(app)/office/staff/actions.ts"), "utf8");
    // Pay rates moved to Settings → Pay rates (settings/pay-actions.ts, finance.view).
    expect(new Set(permissionsOf(callsOf(staffActions)))).toEqual(new Set(["staff.edit", "protected.view", "data.export"]));
    expect(callsOf(readFileSync(join(ROOT, "app/(app)/office/staff/access-actions.ts"), "utf8")).every((c) => /owner: true/.test(c))).toBe(true);
    expect(callsOf(readFileSync(join(ROOT, "app/(app)/office/page.tsx"), "utf8"))).toEqual(['{ permission: "office.view" }']);
  });

  it("every permission an office route asks for is denied to instructors, parents and a fresh office admin", () => {
    const used = new Set<string>();
    for (const file of [...office, ...api]) for (const p of permissionsOf(callsOf(readFileSync(file, "utf8")))) used.add(p);
    expect(used.size).toBeGreaterThan(5);
    for (const p of used) {
      expect(can("instructor", p as Permission), `instructor must not have ${p}`).toBe(false);
      expect(can("parent", p as Permission), `parent must not have ${p}`).toBe(false);
      if (p !== "office.view") expect(can({ role: "admin", features: [] }, p as Permission), `fresh office admin must not have ${p}`).toBe(false);
      expect(can("owner", p as Permission), `owner must have ${p}`).toBe(true);
    }
  });

  it("the portal uses only the membership gate, never an office permission", () => {
    const wrong: string[] = [];
    for (const file of portal) {
      const r = rel(file);
      const calls = callsOf(readFileSync(file, "utf8"));
      if (calls.length === 0 && !ALLOWED_WITHOUT_GATE[r]) wrong.push(`${r}: no requireTenant`);
      for (const c of calls) if (c !== "") wrong.push(`${r}: requireTenant(${c})`);
    }
    expect(wrong).toEqual([]);
  });

  it("no office or portal entry point reaches the repositories except through requireTenant", () => {
    const leaks: string[] = [];
    for (const file of [...office, ...api, ...portal]) {
      const r = rel(file);
      const src = readFileSync(file, "utf8");
      // A file may fetch the repositories only once requireTenant has authorised the request on that same path.
      if (/getRepositories\(|createTenantRepositories\(|new ControlPlaneRepository\(/.test(src) && callsOf(src).length === 0 && !ALLOWED_WITHOUT_GATE[r]) leaks.push(r);
    }
    expect(leaks).toEqual([]);
  });
});
