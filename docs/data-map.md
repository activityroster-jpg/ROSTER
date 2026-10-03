# Data map (record of processing activities, draft)

Built from the real schema (`lib/db/schema/*.ts`) on 3 October 2026. Two roles:
**processor** for each centre's data (the centre is controller) and **controller**
for ActivityRoster's own customer, website and prospect data. Retention periods are
in `docs/retention.md`. Sub-processors in `docs/subprocessors.md`.

## Centre data (ActivityRoster = processor)

| Table | What it holds | People | Sensitivity | Lawful basis (centre's) | Who sees it |
| --- | --- | --- | --- | --- | --- |
| `instructor` | Name, email, phone, employment type (employee/volunteer), status, notify preference | Staff and volunteers, some under 18 | Standard; higher for under-18s | Contract / legitimate interests | Admins; name only to colleagues |
| `qualification` | RYA and other certificate type, number, issue and expiry dates | Staff | Standard | Legal obligation (RYA recognition), contract | Admins; own record to the holder |
| `compliance_item` | DBS/PVG/AccessNI/Garda, first aid, safeguarding: reference, dates, verified flag, optional uploaded document | Staff | **High** (vetting status; the uploaded certificate may reveal criminal-offence data) | Legal obligation / substantial public interest (safeguarding) | Admins only; own record to the holder |
| `instructor_course_type` | Which courses each person can teach | Staff | Low | Contract | Admins, roster |
| `availability` | Days and slots a person can work | Staff | Low | Contract | Admins; own to the holder |
| `course`, `course_session`, `course_staff`, `course_role_requirement`, `course_equipment`, `course_location` | Courses, sessions, headcounts, who is rostered | Staff (students appear only as headcounts) | Low | Contract | Admins; own shifts to staff |
| `roster_week` | Published state of each week | – | Low | Contract | Admins |
| `time_entry`, `hours_record` | Clock in/out and worked minutes | Staff | Standard; a legal record for young workers | Legal obligation (working time), contract | Admins; own to the holder |
| `pay_rate` | Hourly or daily rates per person | Staff | Standard | Contract | Admins only |
| `leave_request` | Leave dates and reason | Staff | Standard (reasons may include health; a warning is planned) | Contract | Admins; own to the holder |
| `open_shift` | Shifts offered for cover and who claimed them | Staff | Low | Contract | Admins, staff |
| `notification` | In-app notices to a person | Staff | Low | Contract | The recipient |
| `onboarding_item`, `org_settings`, `session_slot`, `role_type`, `qualification_type`, `compliance_type`, `equipment_type`, `location_type`, `course_type*`, `equipment`, `location` | Configuration | – | None | – | Admins |
| `integration` | Connected calendar/accounting tokens (AES-GCM encrypted) | – | Secret | Contract | Nobody directly |
| `deletion_log` | One-way hash and summary of each anonymisation, so it can be re-applied after a restore | Nobody identifiable | Standard | Legal obligation (erasure) | Admins (via replay) |
| `audit_log` | Who changed what and when in the centre; append-only (database triggers) | Staff (actor), subjects of changes | Standard | Legitimate interests (accountability) | Admins (plain-English change log) |
| R2 bucket `activityroster-docs` | Uploaded certificate and vetting documents, keyed by centre | Staff | High | As `compliance_item` | Admins, via authenticated download only |

Held since P0-E (3 October 2026): dates of birth, parent or guardian details and
encrypted emergency contacts on `instructor`. Not held: student names, medical
information, photos. Exports that list children's working patterns (the young-worker
time register CSV) and views of guardian or emergency contacts are each written to
`audit_log`. The `rule_pack` table (control plane) holds legal figures only, no
personal data.

## ActivityRoster's own data (ActivityRoster = controller)

| Table | What it holds | People | Lawful basis | Retention |
| --- | --- | --- | --- | --- |
| `user`, `account`, `session`, `verification`, `two_factor` | Login identity, password hash, sessions, 2FA secrets, recovery email, PIN hash | Every signed-in person | Contract | Life of the account |
| `organisation`, `membership` | Centre record, Stripe ids, plan, status, who belongs to which centre and as what | Centre admins and staff | Contract | Life of the centre + 90 days |
| `webhook_event` | Stripe event ids for idempotency | – | Legitimate interests | 12 months |
| `security_event`, `trusted_device` | Logins, failures, new devices (IP, country, user agent) | Every signed-in person | Legitimate interests (security) | 12 months |
| `push_token` | Mobile push tokens | Instructors using the app | Contract | Until the app signs out |
| `lead` | Marketing-site enquiries (email, centre, message) | Prospective customers | Legitimate interests / consent | 24 months |
| `marketing_prospect`, `outreach_*` | Business contacts at centres and clubs, outreach history, do-not-email list | Business contacts (B2B) | Legitimate interests (B2B marketing); suppression list kept indefinitely | 24 months since last contact; suppression forever |
| `ai_usage` | Token counts and cost per Claude call | – | – | 24 months |
| `error_report` | Error messages with emails scrubbed, reporter's account id | Users who report | Legitimate interests | 12 months |
| `privacy_request` | Data requests and complaints from the public form | Requesters | Legal obligation | 3 years after closure |
| `finance_transaction`, `finance_settings`, `platform_pricing`, `platform_task`, `blog_post`, `call_*` | The owner's own books, pricing, tasks, blog, call bookings (name, email) | Owner; call bookers | Legal obligation (accounts) / contract | 6 years (accounts); 24 months (calls) |

## Flows out of the platform

| Flow | To | Data |
| --- | --- | --- |
| Transactional email | Resend | Recipient address, email body (codes, invites, notices; never contact lists or documents) |
| Billing | Stripe | Billing contact, amounts; card data only ever on Stripe's pages |
| Error reports | Sentry (EU) | Stack traces with emails and tokens scrubbed |
| Outreach research and drafting | Anthropic | Prospect business names, public website text, business contact names and roles. **Never centre data.** |
| Breached-password check | Have I Been Pwned | First five characters of the password's SHA-1 hash |
