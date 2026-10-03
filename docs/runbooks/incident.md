# Runbook: incidents

Keep a printed copy and one in Google Drive. Severity decides the clock.

| Severity | Example | Respond | Tell customers |
| --- | --- | --- | --- |
| Critical | Data breach, cross-centre data visible, full outage in season | Immediately | Status page within 1 hour, plus direct email to affected centres |
| Major | Sign-in, rota publishing or email broken | Within 2 hours | Status page updates until fixed |
| Minor | One feature bug | Next working day | Release notes |

## First 15 minutes

1. Write down the time, what you saw, and who reported it. Start an incident note.
2. If data may be exposed: contain first. Options, in order of least harm: roll back the
   Worker (Cloudflare → roster → Deployments → Rollback), pause a campaign, revoke a
   token (Cloudflare secrets, Stripe, Resend), suspend a centre (Dev Center), or put the
   site in maintenance (Phase 2 flag).
3. Preserve evidence: do not delete logs, rows or emails. Note the Time Travel bookmark.
4. Post on the status page: https://activity-roster.betteruptime.com (Better Stack → Status pages → Create incident). "We're aware of a problem with …, investigating".

## Assess (within the first hours)

- What data, which centres, how many people, how long, and is it still happening?
- Is it ActivityRoster's own data (customer accounts, billing, prospects: we are the
  controller) or a centre's data (we are the processor)?
- Record the answers in the incident note; update as you learn more.

## Notify

- **Centres (we are processor):** email affected centre admins without undue delay,
  target within 24 hours of knowing, with what happened, what data, what we've done, and
  what they may need to do. They decide on reporting to the ICO or the Irish DPC within
  72 hours; offer to help write it.
- **Our own data (we are controller):** if people are at risk, report to the ICO within
  72 hours (ico.org.uk/make-a-complaint/data-protection-complaints/ → "Report a breach").
  Tell the people affected if the risk is high.
- Record every incident in `docs/incident-log.md`, reported or not.

## Templates

**We're aware.** "We're investigating a problem affecting [sign-in / the rota /
email] since [time]. Your data is safe. Updates here every [30] minutes."

**Update.** "We've found the cause ([one line]) and are rolling out a fix. Next update
by [time]."

**Resolved.** "Fixed at [time]. Cause: [plain English]. Impact: [who, what, how long].
What we've changed so it doesn't recur: [one or two lines]. Sorry for the disruption."

**Breach notice to a centre.** "On [date] we discovered that [what]. The data involved
was [what], for [who]. We [contained it] at [time]. We recommend [action]. As the data
controller you may need to notify the ICO/DPC within 72 hours of us telling you; we can
help with the wording. Contact: privacy@activityroster.com."

## Contacts

- Status page: https://activity-roster.betteruptime.com · Better Stack alerts go to Conor by SMS and email
- Cloudflare support: dashboard → Support (Paid plan: email/chat)
- Resend: support@resend.com · Postmark: support@postmarkapp.com
- Tell everyone: Dev Center → Overview → Operations → Incident banner (one line, shows on the website, office and app with the status-page link). Pause editing while repairing data: the same card → Maintenance mode (office and app show “Back shortly” to everyone except platform admins; website and status page stay up). Switch both off when done.
- Deploy smoke test fails with 403 / `cf-mitigated: challenge`: Bot Fight Mode is on. Security → Bots → off, redeploy. See `docs/runbooks/deploy.md`.
- Email provider down: failover is automatic once `POSTMARK_SERVER_TOKEN` is set. To make Postmark primary for a while, set the Worker variable `MAIL_PRIMARY=postmark` (Workers & Pages → roster → Settings → Variables) and redeploy from GitHub; set it back afterwards. The Dev Center overview shows the last failover.
- Stripe: dashboard → Help
- Data protection solicitor: [name, phone]
- ICO breach line: 0303 123 1113 · Irish DPC: dataprotection.ie
