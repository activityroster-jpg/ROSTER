import { describe, expect, it } from "vitest";
import { evaluateFit, type ComplianceRequirement, type HeldCompliance } from "@/lib/domain";

const asOf = Date.UTC(2026, 0, 15); // 15 Jan 2026

const requirements: ComplianceRequirement[] = [
  { complianceTypeId: "first_aid", name: "First Aid", mandatory: true, expiryTracked: true },
  { complianceTypeId: "dbs", name: "DBS", mandatory: true, expiryTracked: false },
  { complianceTypeId: "reval", name: "Revalidation", mandatory: false, expiryTracked: true },
];

describe("evaluateFit", () => {
  it("blocks when a mandatory check is missing", () => {
    const held: HeldCompliance[] = [{ complianceTypeId: "first_aid", expiryDate: "2027-01-01" }];
    const r = evaluateFit(requirements, held, asOf);
    expect(r.fit).toBe(false);
    expect(r.blocks.some((b) => b.kind === "missing" && b.complianceTypeId === "dbs")).toBe(true);
  });

  it("blocks when a mandatory check has expired", () => {
    const held: HeldCompliance[] = [
      { complianceTypeId: "first_aid", expiryDate: "2025-12-31" }, // expired
      { complianceTypeId: "dbs", expiryDate: null },
    ];
    const r = evaluateFit(requirements, held, asOf);
    expect(r.fit).toBe(false);
    expect(r.blocks.some((b) => b.kind === "expired" && b.complianceTypeId === "first_aid")).toBe(true);
  });

  it("is fit when all mandatory checks are current", () => {
    const held: HeldCompliance[] = [
      { complianceTypeId: "first_aid", expiryDate: "2026-06-01" },
      { complianceTypeId: "dbs", expiryDate: null },
    ];
    const r = evaluateFit(requirements, held, asOf);
    expect(r.fit).toBe(true);
    expect(r.blocks).toHaveLength(0);
  });

  it("treats an expired NON-mandatory check as a warning, not a block", () => {
    const held: HeldCompliance[] = [
      { complianceTypeId: "first_aid", expiryDate: "2026-06-01" },
      { complianceTypeId: "dbs", expiryDate: null },
      { complianceTypeId: "reval", expiryDate: "2025-01-01" }, // expired, non-mandatory
    ];
    const r = evaluateFit(requirements, held, asOf);
    expect(r.fit).toBe(true);
    expect(r.warnings.some((w) => w.complianceTypeId === "reval")).toBe(true);
  });

  it("warns within the lead window before expiry", () => {
    const held: HeldCompliance[] = [
      { complianceTypeId: "first_aid", expiryDate: "2026-01-20" }, // 5 days away
      { complianceTypeId: "dbs", expiryDate: null },
    ];
    const r = evaluateFit(requirements, held, asOf, 30);
    expect(r.fit).toBe(true);
    expect(r.warnings.some((w) => w.complianceTypeId === "first_aid")).toBe(true);
  });
});
