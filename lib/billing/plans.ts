import type { Plan } from "@/lib/db/schema";

export const PLAN_LABELS: Record<Plan, string> = {
  rostering: "Rostering",
  full: "Full",
};

export const BILLING_INTERVALS = ["monthly", "annual"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];
