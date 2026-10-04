# Retention defaults

Centres change the centre-side periods under Office → Settings → Data retention (since
4 October 2026, plan P1-D). The sweep runs once a day per centre from the hourly tick:
records past their period enter a 14-day window with an email to every admin, then are
removed; former staff are anonymised rather than deleted. Each run is in the change log and
the deletion log, and is re-applied after a restore. Append-only protection on the change
log and security events (database triggers) allows deletion only once a row is older than
3 years / 12 months respectively, so retention and tamper-evidence coexist.

| Data | Default | Why | Notes |
| --- | --- | --- | --- |
| Staff profile (name, contact, qualifications) | Anonymised 12 months after the person was marked as left (configurable, minimum 1 month) | Seasonal instructors return each year; a year covers one winter | Admin reminded 14 days before deletion with a "keep" option |
| Young-worker time records (under-18 clock in/out and hours) | 3 years after the record | Irish employers must keep them; UK working-time records are kept 2 years | Follows the record, not the profile |
| Adult time records and payroll hours | 6 years | HMRC / Revenue payroll records | Exportable |
| Rota history (who was rostered where) | 3 years | Disputes, insurance, safeguarding queries | Headcounts only, no student names |
| Vetting status (DBS and equivalents) | While the person works there, then deleted with the profile | Store status only beyond the active period | Uploaded certificates deleted with the profile |
| Qualification records | While the person works there + 12 months | RYA recognition audits | |
| Leave requests | 2 years | HR disputes | |
| Audit log (centre change log) | 3 years (configurable upwards; the database refuses earlier deletion) | Accountability | Centres can export |
| Centre export after cancellation | Available 90 days, then everything deleted from live systems | Spec: leaving schools | Written confirmation emailed |
| Backups | Daily copies 30 days, monthly copies 12 months | Spec: DR | Deleted data ages out within 12 months; deletion log replayed after any restore |
| Security events, trusted devices | 12 months | Incident investigation | |
| Marketing prospects | 24 months since last contact | B2B legitimate interests | Do-not-email list kept indefinitely |
| Privacy requests | 3 years after closure | Evidence of compliance | |
| Error reports | 12 months | Debugging | Scrubbed of personal data |
| Finance records (owner's books) | 6 years | Companies House / HMRC | |

Longer periods may apply by law to incident reports and child-employment permits; a
centre that holds those sets its own period and documents it.
