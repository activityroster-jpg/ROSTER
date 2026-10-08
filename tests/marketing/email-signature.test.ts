import { describe, expect, it } from "vitest";
import { draftProspectEmail } from "@/lib/marketing";

describe("outreach email draft", () => {
  it("ends with the company signature, registered office included", () => {
    const { body } = draftProspectEmail({ name: "Yeadon Sailing Club", contactName: "Sam" });
    expect(body.startsWith("Hi Sam,")).toBe(true);
    expect(body.endsWith([
      "Kind regards,",
      "Conor",
      "",
      "ActivityRoster",
      "Compliance-aware rostering for sailing & watersports centres",
      "activityroster.com · hello@activityroster.com",
      "",
      "ActivityRoster is a trading name of ActiveRoster Ltd, registered in England & Wales, company number 17505500.",
      "Registered office: 71-75 Shelton Street, London WC2H 9JQ, United Kingdom.",
    ].join("\n"))).toBe(true);
  });
});
