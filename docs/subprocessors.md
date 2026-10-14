# Sub-processor register

Third parties that handle personal data for ActivityRoster. Centres are told before a new
one is added. Keep in step with `docs/compliance-spec.md` **and** the public page at
`/subprocessors`, which is rendered from `lib/legal/subprocessors.ts` (same rows, plus a dated
change list). To notify centres: Dev Center → Trust & compliance → Privacy requests →
"Sub-processor change notice" (test to yourself first; refuses to send with under 30 days'
notice).

| Sub-processor | Purpose | Data involved | Location | DPA | Transfer mechanism |
| --- | --- | --- | --- | --- | --- |
| Cloudflare, Inc. | Hosting (Workers), database (D1), file storage (R2), cache (KV), DNS, TLS | All platform data | EU (D1 western Europe, R2 EU jurisdiction); edge network worldwide for request handling | Cloudflare Data Processing Addendum (self-serve, in the dashboard under Account → Configurations → Compliance) | UK IDTA / EU SCCs within the DPA |
| Resend, Inc. | Transactional and outreach email | Recipient email addresses, email content (sign-in codes, invites, rota notices) | Domain region chosen in Resend; confirm EU (eu-west-1) | Resend DPA (resend.com/legal/dpa) | SCCs within the DPA |
| Stripe Payments Europe, Ltd. | Subscription billing | Billing contact name and email, invoices; card data never reaches us | EU/US | Stripe Data Processing Agreement (automatic with the account) | SCCs / UK addendum |
| Functional Software, Inc. (Sentry) | Error monitoring | Error traces with emails and tokens scrubbed before sending | EU ingest region | Sentry DPA (self-serve) | SCCs |
| Anthropic, PBC | Outreach agent: reads a prospect centre's public website and drafts B2B emails. Dev Center finance: reads the company's own supplier receipts (forwarded by the owner) for supplier, date and amount. **Never receives centre, staff or student data.** | Prospect business names, public website text, business contact names and roles; the company's own purchase receipts (may show the director's name and billing address) | US | Anthropic Commercial Terms / DPA; API data not used for training | SCCs / UK addendum |
| GitHub, Inc. (Microsoft) | Source code, CI, deploy automation | No personal data by policy (code and configuration only) | US/EU | GitHub DPA | SCCs |
| Have I Been Pwned (Troy Hunt) | Breached-password check | The first five characters of a password's SHA-1 hash only; never the password or any identifier | Cloudflare edge | Not a processor of personal data (k-anonymity) | n/a |
| Cloudflare DNS-over-HTTPS | Checks an email domain accepts mail before outreach | Domain names only | Cloudflare edge | Covered by Cloudflare's DPA | n/a |

| Better Stack, Inc. | External uptime monitoring and the public status page | None: it only fetches `/api/health` and the home page and holds Conor's contact details for alerts | EU/US | Better Stack DPA (self-serve) | SCCs |
| Backblaze, Inc. (B2 Cloud Storage) | Off-Cloudflare copy of encrypted nightly backups, object lock on (live since 3 October) | Encrypted database exports and document archives only; the key never leaves GitHub secrets and the password manager | EU (eu-central) | Backblaze DPA (self-serve) | SCCs |

| ActiveCampaign, LLC (Postmark) | **Backup** transactional and outreach email, used only when Resend fails | Recipient email addresses, email content (the same as Resend) | US (EU DPA and SCCs; Postmark processes in the US) | Postmark DPA (postmarkapp.com/dpa, self-serve) | SCCs / UK addendum |

| Google LLC (Firebase Cloud Messaging) | Phone notifications from the instructor app (Android and iPhone) | Device notification tokens; notification text (shift changes: course, day, time). No email, phone number or other profile data | US / worldwide | Firebase Data Processing and Security Terms (accept in Firebase console → Project settings → Privacy) | SCCs / UK addendum |
| Apple Inc. (APNs) | Delivers the notifications Firebase sends to iPhones | The same as Firebase | US / worldwide | Apple Developer Program License Agreement (data terms) | SCCs |

Firebase and APNs are listed ahead of use: they become live the day `FCM_SERVICE_ACCOUNT_JSON`
is set on the Worker. Conor tells customers (30 days' notice) before that day; until then the
app works and simply sends no phone notifications.

Postmark is listed ahead of use (P0-G): it becomes live the day `POSTMARK_SERVER_TOKEN`
is set. Conor tells customers before that day.

Last reviewed: 14 October 2026 (Firebase and APNs added, pending activation; Postmark pending activation).
