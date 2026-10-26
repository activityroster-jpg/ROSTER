import type { MembershipRole } from "@/lib/db/schema";
import { isOfficeRole } from "./rbac";

export interface GoMembership { organisationId: string; name: string; slug: string; role: MembershipRole; status: string; orgStatus: string }
export type GoTarget = "office" | "portal";
export type GoDecision =
  | { kind: "open"; url: string }
  | { kind: "choose"; target: GoTarget; centres: GoMembership[] }
  | { kind: "none"; target: GoTarget; pending: GoMembership[] };

/**
 * Where "/go" sends a signed-in person on the main site. The office is only for
 * office roles, so an instructor who asked for it (an invitation link, or the
 * sign-in page's default) is sent to their portal instead of a dead end. Only
 * with no centre at all does the page have to explain the two doors: join a
 * centre as an instructor, or create one.
 */
export function goDestination(all: GoMembership[], target: GoTarget, apex: string): GoDecision {
  const live = all.filter((m) => m.status === "active" && m.orgStatus !== "cancelled");
  const pending = all.filter((m) => m.status === "requested");
  const link = (m: GoMembership, t: GoTarget) => `https://${m.slug}.${apex}/${t}`;

  if (target === "office") {
    const office = live.filter((m) => isOfficeRole(m.role));
    if (office.length === 1) return { kind: "open", url: link(office[0]!, "office") };
    if (office.length > 1) return { kind: "choose", target, centres: office };
  }
  if (live.length === 1) return { kind: "open", url: link(live[0]!, "portal") };
  if (live.length > 1) return { kind: "choose", target: "portal", centres: live };
  return { kind: "none", target, pending };
}
