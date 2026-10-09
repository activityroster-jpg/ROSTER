# Data protection impact assessment (draft)

For Conor and the solicitor to complete. Screening: processing includes data about
children (instructors aged 15 to 17) and vetting status, so a DPIA is appropriate.

## 1. Description of the processing

ActivityRoster rosters instructors at RYA sailing and watersports centres, tracks their
qualifications and vetting status, records worked hours and leave, and notifies them of
shifts. ActivityRoster is operated by ActiveRoster Ltd (registered in England & Wales,
company number 17505500, registered office 71-75 Shelton Street, London WC2H 9JQ).
Centres are controllers for their staff data; ActivityRoster is processor.
ActivityRoster is controller for customer accounts, billing, website enquiries and a
B2B prospect list. Full inventory: `docs/data-map.md`. Data stays in the UK/EU; sub-
processors in `docs/subprocessors.md`.

## 2. Necessity and proportionality

- Purpose: safe, lawful staffing of water-based activities (ratios, qualifications, safety cover) and employment administration.
- Lawful bases (centre): contract with staff; legal obligation (working time, RYA recognition, safeguarding); legitimate interests (operational records).
- Minimisation: no student medical data; staff medical notes are optional, short, encrypted and limited to emergency use (see risk table); no student personal data, no photos; headcounts instead of names; configuration data separate from personal data; unused `booking` table scheduled for removal.
- Retention: `docs/retention.md`.
- Rights: export, correction and deletion via the centre; public request form; privacy notices linked in-app; template notices for centres.

## 3. Risks

| Risk | Likelihood | Severity | Mitigation | Residual |
| --- | --- | --- | --- | --- |
| Cross-centre data exposure | Low | High | Structural tenant isolation, automated isolation tests on every deploy | Low |
| Account takeover of a centre admin | Medium | High | Password policy, breached-password check, emailed code per device, PIN, new-device check, rate limiting, change alerts | Low |
| Exposure of under-18 contact details to adults who don't need them | Medium today | High | *Planned P0-E:* date of birth, automatic under-18 flag, contact details hidden except admins/welfare | Low after P0-E |
| Vetting documents revealing criminal-offence data | Low | High | Admin-only, authenticated download, allow-listed types; *planned:* encryption, view logging | Low |
| Loss of data (provider failure, bad change) | Low | High | Time Travel, *planned:* nightly encrypted exports, off-site copy, restore tests, staging-first changes | Low after P0-C |
| Over-retention | Medium | Medium | Documented defaults; *planned Phase 2:* per-centre retention settings and scheduled deletion | Medium until Phase 2 |
| Email misdelivery or interception | Low | Medium | Minimal content in emails, links into the app, authenticated domain, planned separate subdomains | Low |
| Unlawful young-worker hours rostered | Medium | Medium | *Planned P0-F:* rules engine with jurisdiction packs, block-with-override default, disclaimer that the centre remains responsible | Low after P0-F |
| Exposure of staff medical notes (health data) | Low | High | Optional field; encrypted at rest; visible only with the Emergency & guardian contacts tick and on the emergency sheet, where each view and print is logged; included in export, wiped on erasure; centre collects with explicit consent | Low |
| B2B outreach contacting the wrong people | Low | Low | Prospect list separate from users; business contacts only; suppression list; sender identity and opt-out in every email | Low |

## 4. Consultation

- Data protection solicitor: review of this DPIA, terms, DPA, notices.
- Pilot centres: review of the under-18 defaults and the privacy notice templates.

## 5. Sign-off

| Item | Name | Date |
| --- | --- | --- |
| Measures approved by | | |
| Residual risks accepted by | | |
| DPO/solicitor advice | | |
| Next review | 12 months, or on adding medical fields, messaging, students or AI-driven rostering | |
