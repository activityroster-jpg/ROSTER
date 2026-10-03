# Sub-processor register

Third parties that handle personal data for ActivityRoster. Schools are told before a new
one is added. Keep in step with `docs/compliance-spec.md`.

| Sub-processor | Purpose | Data involved | Location | DPA | Transfer mechanism |
| --- | --- | --- | --- | --- | --- |
| Cloudflare, Inc. | Hosting (Workers), database (D1), file storage (R2), cache (KV), DNS, TLS | All platform data | EU (D1 western Europe, R2 EU jurisdiction); edge network worldwide for request handling | Cloudflare Data Processing Addendum (self-serve, in the dashboard under Account → Configurations → Compliance) | UK IDTA / EU SCCs within the DPA |
| Resend, Inc. | Transactional and outreach email | Recipient email addresses, email content (sign-in codes, invites, rota notices) | Domain region chosen in Resend; confirm EU (eu-west-1) | Resend DPA (resend.com/legal/dpa) | SCCs within the DPA |
| Stripe Payments Europe, Ltd. | Subscription billing | Billing contact name and email, invoices; card data never reaches us | EU/US | Stripe Data Processing Agreement (automatic with the account) | SCCs / UK addendum |
| Functional Software, Inc. (Sentry) | Error monitoring | Error traces with emails and tokens scrubbed before sending | EU ingest region | Sentry DPA (self-serve) | SCCs |
| Anthropic, PBC | Outreach agent: reads a prospect centre's public website and drafts B2B emails. **Never receives school users' or students' data.** | Prospect business names, public website text, business contact names and roles | US | Anthropic Commercial Terms / DPA; API data not used for training | SCCs / UK addendum |
| GitHub, Inc. (Microsoft) | Source code, CI, deploy automation | No personal data by policy (code and configuration only) | US/EU | GitHub DPA | SCCs |
| Have I Been Pwned (Troy Hunt) | Breached-password check | The first five characters of a password's SHA-1 hash only; never the password or any identifier | Cloudflare edge | Not a processor of personal data (k-anonymity) | n/a |
| Cloudflare DNS-over-HTTPS | Checks an email domain accepts mail before outreach | Domain names only | Cloudflare edge | Covered by Cloudflare's DPA | n/a |

| Backblaze, Inc. (B2 Cloud Storage), **recommended, pending account** | Off-Cloudflare copy of encrypted nightly backups, object lock on | Encrypted database exports and document archives only; the key never leaves GitHub secrets and the password manager | EU (eu-central) | Backblaze DPA (self-serve) | SCCs |

To be added when Phase 1 lands: the backup email provider (P0-G).

Last reviewed: 3 October 2026.
