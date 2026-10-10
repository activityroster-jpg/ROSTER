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
- Minimisation: no medical data, no student personal data, no photos; headcounts instead of names; configuration data separate from personal data; unused `booking` table scheduled for removal.
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
| Unlawful young-worker hours rostered | Medium | Medium | The centre, as employer, is responsible for working-time law (Conor's decision, 10 Oct 2026: the P0-F rules engine was removed because it got in the way of rostering). Each person's rostered hours for the week show beside their name on the roster and on Availability, so long weeks are visible. The terms should say the centre remains responsible (solicitor review) | Centre's risk; Medium |
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
