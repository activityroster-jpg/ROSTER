/**
 * The image social networks and search previews show for a page without one of
 * its own (public/og/activityroster.png, 1200×630). Pages that set their own
 * `openGraph` must pass it again: Next replaces the parent's openGraph object
 * rather than merging into it.
 */
export const OG_IMAGE = { url: "/og/activityroster.png", width: 1200, height: 630, alt: "ActivityRoster: RYA sailing school software for the people who run the centre" } as const;

/** Who the site is written for, in the words search engines and buyers use. */
export const AUDIENCE = "Principals, Chief Instructors, centre managers and club officers at RYA training centres, sailing schools and sailing clubs";

/** schema.org Audience, attached to the Organization, SoftwareApplication and articles. */
export const SCHEMA_AUDIENCE = { "@type": "BusinessAudience", name: "RYA training centres, sailing schools and sailing clubs", audienceType: "Principals, Chief Instructors, centre managers and club officers" } as const;
