/**
 * Small config helpers safe to call from any context (server, client, static).
 * The apex domain is exposed as a build-time public var so it can be used in
 * both the marketing UI and links without needing the runtime binding.
 */
export const DEFAULT_APEX = "activityroster.com";

export function apexDomain(): string {
  // On the server the Worker var wins (staging and production share one build);
  // in the browser only the build-time public var exists.
  return process.env.APP_APEX_DOMAIN || process.env.NEXT_PUBLIC_APEX_DOMAIN || DEFAULT_APEX;
}

/**
 * The legal company behind the ActivityRoster product. Single source of truth for
 * the site footer, legal pages and email templates. `name` is the trading/product
 * name; `legalName` is the registered company shown where the law requires it.
 */
export const COMPANY = {
  name: "ActivityRoster",
  legalName: "ActiveRoster Ltd",
  companyNumber: "17505500",
  registeredIn: "England & Wales",
  addressLines: ["71-75 Shelton Street", "London", "WC2H 9JQ", "United Kingdom"],
  get addressInline() {
    return this.addressLines.join(", ");
  },
  /** "Registered in England & Wales, company number 17505500" */
  get registration() {
    return `Registered in ${this.registeredIn}, company number ${this.companyNumber}`;
  },
  /** The full statement the Companies Act asks for on letters, emails and the website. */
  get legalLine() {
    return `${this.legalName}. ${this.registration}. Registered office: ${this.addressInline}.`;
  },
};

/**
 * The public status page (Better Stack). Null hides every "status page" link,
 * so nobody lands on Better Stack's own home page; set the Worker variable
 * STATUS_PAGE_URL (or the constant below) to the page's real address.
 */
const STATUS_PAGE_DEFAULT: string | null = null;
export function statusPageUrl(): string | null {
  const v = (process.env.STATUS_PAGE_URL ?? "").trim() || STATUS_PAGE_DEFAULT;
  return v && /^https:\/\/[^\s"'<>]+$/.test(v) ? v : null;
}
