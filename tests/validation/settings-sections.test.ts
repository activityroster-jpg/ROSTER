import { describe, expect, it } from "vitest";
import { settingsPatch } from "@/lib/validation/settings-sections";

const form = (v: Record<string, string>) => (k: string) => (k in v ? v[k]! : null);

describe("settings saved one card at a time", () => {
  it("the checks card writes only the check columns", () => {
    const r = settingsPatch("checks", form({ enforceConflictChecks: "on", enforceAvailabilityChecks: "on" }));
    expect(r).toEqual({ ok: true, patch: { enforceLicenceChecks: false, enforceRatioChecks: false, enforceConflictChecks: true, enforceAvailabilityChecks: true, checkEquipmentQuantities: false, useKitRules: false } });
  });

  it("the digest card never touches the checks", () => {
    const r = settingsPatch("digest", form({ dailyDigestEnabled: "on", dailyDigestHour: "7" }));
    expect(r.ok && Object.keys(r.patch).sort()).toEqual(["dailyDigestEnabled", "dailyDigestHour"]);
  });

  it("basics validates and normalises", () => {
    const r = settingsPatch("basics", form({ alertLeadDays: "30", availabilityWeeksAhead: "6", currency: "GBP", holidayPayPercent: "", privacyNoticeUrl: "" }));
    expect(r).toEqual({ ok: true, patch: { alertLeadDays: 30, availabilityWeeksAhead: 6, currency: "GBP", holidayPayPercent: null, privacyNoticeUrl: null, staffManagedBy: "staff" } });
    expect(settingsPatch("basics", form({ alertLeadDays: "30", currency: "GBP", privacyNoticeUrl: "http://x.org" })).ok).toBe(false);
    // Who keeps availability: the office (no staff sign-up), or a made-up value refused.
    const office = settingsPatch("basics", form({ alertLeadDays: "30", currency: "GBP", staffManagedBy: "office" }));
    expect(office.ok && office.patch.staffManagedBy).toBe("office");
    expect(settingsPatch("basics", form({ alertLeadDays: "30", currency: "GBP", staffManagedBy: "parents" })).ok).toBe(false);
  });

  it("the young workers' hours card is gone: working hours are the centre's to manage", () => {
    expect(settingsPatch("young", form({ workingTimeMode: "warn" })).ok).toBe(false);
  });

  it("an unknown card is refused", () => {
    expect(settingsPatch("everything", form({})).ok).toBe(false);
  });
});
