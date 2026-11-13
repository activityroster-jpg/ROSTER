/**
 * The one-stop shop: what ActivityRoster does for a centre beyond the
 * off-the-shelf rostering platform. Centres asked for one supplier for the
 * website, bookings and the rest (feedback, Nov 2026), so these are offered
 * alongside the plans and quoted per centre ("contact us for pricing").
 * Shown on the home page, the pricing page and the contact page.
 */
export interface Service {
  id: string;
  title: string;
  body: string;
  /** Short line for compact lists. */
  short: string;
}

export const SERVICES: Service[] = [
  {
    id: "rostering",
    title: "Rostering & compliance platform",
    short: "The rostering platform, ready today",
    body: "The off-the-shelf part: rosters checked for instructor types, ratios and supervision, licences and vetting tracked, and an app for your team. Start free; flat monthly price.",
  },
  {
    id: "website",
    title: "Your centre's website",
    short: "Your centre's website, designed and built",
    body: "A fast, modern website for your school or club, designed and built by us, written so people searching for courses near you find it, and kept up to date.",
  },
  {
    id: "booking",
    title: "Booking system integration",
    short: "Booking system connected, or one set up",
    body: "We connect the booking system you already use so courses and numbers flow straight onto the roster, or set up online booking and payments if you don't have one yet.",
  },
  {
    id: "custom",
    title: "Built around how you run",
    short: "The platform changed to fit how you run",
    body: "Features added, removed or changed to match your centre: your screens, checks, roles and reports. Your data brought across and your team set up, on site if you like.",
  },
];

/** The custom-work services (everything but the off-the-shelf platform): priced on request. */
export const QUOTED_SERVICES = SERVICES.filter((s) => s.id !== "rostering");

/** Email subject line for a services enquiry. */
export const SERVICES_SUBJECT = "Websites, bookings and custom build for our centre";
