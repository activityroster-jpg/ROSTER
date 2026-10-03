# Incident log

Every incident, whether reported to a regulator or not.

| Date | Severity | What happened | Data involved | Centres affected | Reported to | Closed |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |
| 2026-10-03 | Major | Cloudflare Workers Builds deployed production from the working branch without migrations (INC-2026-10-03-1 below); fixed by Deploy production 23:21 UTC and disconnecting the integration | None | Any centre using the office between about 21:38 and 23:21 UTC | Nobody (no personal data involved) | 2026-10-03 |

## INC-2026-10-03-1 · Production deployed outside the change-management gate

- **Severity:** Major (centre pages likely failing for about 1 hour 40 minutes; no data lost, no data exposed).
- **Window:** 3 October 2026, about 21:38 UTC (Cloudflare built commit c78c75a) to 23:21 UTC ("Deploy production" of 5abdaf5 succeeded).
- **What happened:** Cloudflare's Git integration ("Workers Builds") was connected to the repository and deployed the production Worker on every push to the working branch, in parallel with the GitHub deploy workflow. It deploys code only. From c78c75a the code expected columns added by migrations 0045–0048 that production's database did not yet have, so any page reading the full organisation or settings row would have errored. Public pages and `/api/health` kept returning 200, so the uptime monitor did not alert.
- **How it was found:** the `Workers Builds: roster` check on commits in GitHub, and a read-only probe showing production and staging serving byte-identical builds while the GitHub deploy log said production was on an older commit.
- **Fix:** Conor pressed "Deploy production" (applied 0045–0048, redeployed, smoke test passed; bookmark recorded in `docs/runbooks/deploy.md`) and disconnected the Git integration on `roster` and `roster-staging`.
- **Follow-ups:** runbook section "Cloudflare Workers Builds must stay disconnected"; the probe workflow kept for future checks; consider an uptime check that signs in to a test centre so a broken tenant page alerts (Phase 2). The previous deploy-log row for 0c414fa stands; production between 21:38 and 23:21 ran whichever commit Cloudflare built last (b9e9b53 then 5abdaf5).
- **Customer notice:** none sent; no personal data was affected. If a centre reports errors in that window, this is the cause.
