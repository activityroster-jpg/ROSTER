/**
 * Fit-to-roster: can this instructor be assigned?
 *
 * The RYA rule mirrored here: an instructor with ANY expired *mandatory*
 * compliance check (e.g. first aid) is BLOCKED from assignment — a ticket
 * lapses if first aid isn't current. Which checks are mandatory depends on the
 * org's jurisdiction + role, expressed as data (compliance_type.mandatory), not
 * code. Non-mandatory expiries are surfaced as warnings, not blocks.
 *
 * Pure function: caller supplies the instructor's compliance items and the set
 * of mandatory compliance types; this decides the outcome against a reference
 * date.
 */

export interface ComplianceRequirement {
  readonly complianceTypeId: string;
  readonly name: string;
  readonly mandatory: boolean;
  readonly expiryTracked: boolean;
}

export interface HeldCompliance {
  readonly complianceTypeId: string;
  /** "YYYY-MM-DD" or null if not tracked/never expires. */
  readonly expiryDate: string | null;
}

export type FitBlockReason =
  | { kind: "missing"; complianceTypeId: string; name: string }
  | { kind: "expired"; complianceTypeId: string; name: string; expiryDate: string };

export interface FitResult {
  readonly fit: boolean;
  readonly blocks: FitBlockReason[];
  readonly warnings: FitBlockReason[];
}

function parseDate(d: string): number {
  // Treat a bare date as end-of-day UTC so a certificate is valid through its
  // stated last day.
  return Date.parse(`${d}T23:59:59.999Z`);
}

/**
 * @param requirements the org's compliance types (mandatory ones gate fitness)
 * @param held         the instructor's current compliance items
 * @param asOf         reference instant (epoch ms), defaults to now
 * @param leadDays     warn this many days before a mandatory item expires
 */
export function evaluateFit(
  requirements: readonly ComplianceRequirement[],
  held: readonly HeldCompliance[],
  asOf: number = Date.now(),
  leadDays = 0,
): FitResult {
  const heldByType = new Map<string, HeldCompliance>();
  for (const h of held) heldByType.set(h.complianceTypeId, h);

  const blocks: FitBlockReason[] = [];
  const warnings: FitBlockReason[] = [];
  const leadMs = leadDays * 24 * 60 * 60 * 1000;

  for (const req of requirements) {
    const item = heldByType.get(req.complianceTypeId);

    if (!item) {
      if (req.mandatory) blocks.push({ kind: "missing", complianceTypeId: req.complianceTypeId, name: req.name });
      continue;
    }

    if (req.expiryTracked && item.expiryDate) {
      const expiry = parseDate(item.expiryDate);
      if (expiry < asOf) {
        const reason: FitBlockReason = {
          kind: "expired",
          complianceTypeId: req.complianceTypeId,
          name: req.name,
          expiryDate: item.expiryDate,
        };
        if (req.mandatory) blocks.push(reason);
        else warnings.push(reason);
      } else if (expiry < asOf + leadMs) {
        warnings.push({
          kind: "expired",
          complianceTypeId: req.complianceTypeId,
          name: req.name,
          expiryDate: item.expiryDate,
        });
      }
    }
  }

  return { fit: blocks.length === 0, blocks, warnings };
}
