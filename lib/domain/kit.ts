/**
 * Kit rules (decided 5 Oct: built, off by default). A course type can say what
 * kit a course needs: a fixed number ("1 safety boat") or a number for every
 * so many students ("1 Pico per 2 students", rounded up). When the centre
 * switches kit rules on, a new course's equipment is pre-filled from them and
 * the equipment-quantity check counts it. Pure.
 */
export interface KitRule {
  equipmentTypeId: string;
  quantity: number;
  /** null = fixed; N = `quantity` for every N students. */
  perStudents: number | null;
}

export function kitFromRules(rules: readonly KitRule[], students: number): { equipmentTypeId: string; quantity: number }[] {
  const out = new Map<string, number>();
  for (const r of rules) {
    const q = Math.max(0, Math.round(r.quantity));
    if (q === 0) continue;
    const n = r.perStudents && r.perStudents > 0 ? Math.ceil(Math.max(0, students) / r.perStudents) * q : q;
    if (n > 0) out.set(r.equipmentTypeId, (out.get(r.equipmentTypeId) ?? 0) + n);
  }
  return [...out].map(([equipmentTypeId, quantity]) => ({ equipmentTypeId, quantity })).sort((a, b) => a.equipmentTypeId.localeCompare(b.equipmentTypeId));
}

/** Validate rules from a form: known types only, sensible numbers, one line per type and kind. */
export function cleanKitRules(input: readonly { equipmentTypeId: string; quantity: number; perStudents?: number | null }[], knownTypes: ReadonlySet<string>): KitRule[] {
  const seen = new Set<string>();
  const out: KitRule[] = [];
  for (const r of input) {
    if (!knownTypes.has(r.equipmentTypeId)) continue;
    const quantity = Math.max(0, Math.min(100, Math.round(Number(r.quantity) || 0)));
    const perStudents = r.perStudents == null || Number(r.perStudents) <= 0 ? null : Math.max(1, Math.min(50, Math.round(Number(r.perStudents))));
    const key = `${r.equipmentTypeId}|${perStudents ?? "fixed"}`;
    if (quantity === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push({ equipmentTypeId: r.equipmentTypeId, quantity, perStudents });
  }
  return out;
}

/** "1 per 2 students" / "2" for the Course setup list. */
export function describeKitRule(r: KitRule, typeName: string): string {
  return r.perStudents ? `${r.quantity} × ${typeName} per ${r.perStudents} student${r.perStudents === 1 ? "" : "s"}` : `${r.quantity} × ${typeName}`;
}

/**
 * One line per equipment type for the top of the Equipment page:
 * "Picos: 12 (10 available, 2 in maintenance)". Tracked types count their
 * units; bulk types show the quantity owned. Pure.
 */
export function equipmentSummary(
  types: readonly { id: string; name: string; quantity: number | null; inventoryTracked: boolean }[],
  units: readonly { equipmentTypeId: string; status: string }[],
): string[] {
  const out: string[] = [];
  for (const t of [...types].sort((a, b) => a.name.localeCompare(b.name))) {
    const mine = units.filter((u) => u.equipmentTypeId === t.id && u.status !== "retired");
    if (mine.length) {
      const maint = mine.filter((u) => u.status === "maintenance").length;
      out.push(`${t.name}: ${mine.length}${maint ? ` (${mine.length - maint} available, ${maint} in maintenance)` : ""}`);
    } else if (t.quantity != null) {
      out.push(`${t.name}: ${t.quantity}`);
    }
  }
  return out;
}
