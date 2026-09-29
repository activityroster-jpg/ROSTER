import type Stripe from "stripe";

/**
 * Stripe coupons & promotion codes.
 *
 * Coupons are created with deterministic ids and reused (retrieve-or-create), so
 * the same discount never spawns duplicates. A per-centre admin discount is
 * turned into a coupon and auto-applied at checkout; marketing promo codes wrap a
 * coupon in a shareable code.
 */

export type CouponSpec =
  | { kind: "percent"; percent: number }
  | { kind: "free_months"; months: number };

function couponId(spec: CouponSpec): string {
  return spec.kind === "free_months"
    ? `ar-free-${spec.months}m`
    : `ar-pct-${String(spec.percent).replace(/\./g, "_")}-forever`;
}

/** Retrieve (or create) the coupon for a spec; returns its id. */
export async function ensureCoupon(stripe: Stripe, spec: CouponSpec): Promise<string> {
  const id = couponId(spec);
  try {
    await stripe.coupons.retrieve(id);
    return id;
  } catch {
    if (spec.kind === "free_months") {
      await stripe.coupons.create({
        id,
        percent_off: 100,
        duration: "repeating",
        duration_in_months: spec.months,
        name: `${spec.months} month${spec.months === 1 ? "" : "s"} free`,
      });
    } else {
      await stripe.coupons.create({
        id,
        percent_off: spec.percent,
        duration: "forever",
        name: `${spec.percent}% off`,
      });
    }
    return id;
  }
}

/**
 * The coupon to auto-apply for a centre's admin-set discount, or null if none.
 * Free months takes precedence over a percentage discount.
 */
export async function couponForOrgDiscount(
  stripe: Stripe,
  opts: { discountPercent?: number | null; freeMonths?: number | null },
): Promise<string | null> {
  if (opts.freeMonths && opts.freeMonths > 0) return ensureCoupon(stripe, { kind: "free_months", months: Math.round(opts.freeMonths) });
  if (opts.discountPercent && opts.discountPercent > 0) return ensureCoupon(stripe, { kind: "percent", percent: opts.discountPercent });
  return null;
}

export interface PromoCodeRow {
  id: string;
  code: string;
  active: boolean;
  timesRedeemed: number;
  maxRedemptions: number | null;
  coupon: string;
}

/** Create a shareable promotion code backed by a coupon spec. */
export async function createPromotionCode(
  stripe: Stripe,
  opts: { spec: CouponSpec; code: string; maxRedemptions?: number },
): Promise<{ code: string }> {
  const coupon = await ensureCoupon(stripe, opts.spec);
  const pc = await stripe.promotionCodes.create({
    coupon,
    code: opts.code,
    active: true,
    ...(opts.maxRedemptions ? { max_redemptions: opts.maxRedemptions } : {}),
  });
  return { code: pc.code };
}

export async function listPromotionCodes(stripe: Stripe, limit = 50): Promise<PromoCodeRow[]> {
  const res = await stripe.promotionCodes.list({ limit });
  return res.data.map((p) => {
    const c = typeof p.coupon === "string" ? undefined : p.coupon;
    return {
      id: p.id,
      code: p.code,
      active: p.active,
      timesRedeemed: p.times_redeemed ?? 0,
      maxRedemptions: p.max_redemptions ?? null,
      coupon: c?.name ?? c?.id ?? "",
    };
  });
}
