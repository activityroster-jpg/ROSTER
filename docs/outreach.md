# Outreach agent (Dev Center → Outreach)

An Explee-style agent for the platform owner: pick an audience from the
Marketing list, write the pitch once, and it researches each centre, finds the
right person and address, writes a short personal email, follows up on a
schedule and stops on reply, bounce or opt-out.

## Pieces

| Piece | Where |
|---|---|
| Campaign / lead / message / suppression tables | `lib/db/schema/control-plane.ts` (migration 0039) |
| Research (fetch site, contact pages, AI summary + hooks) | `lib/outreach/research.ts` |
| Address check (MX / A lookup via Cloudflare DoH) | `lib/outreach/validate.ts` |
| Writer (AI draft or template, footer, opt-out link) | `lib/outreach/writer.ts` |
| Engine (research batches, due sends, caps, hours, Resend events) | `lib/outreach/engine.ts` |
| Dev Center UI | `app/admin/outreach/*`, `components/admin/Outreach*.tsx` |
| Heartbeat | `POST /api/outreach/tick` (header `x-outreach-secret`) |
| Resend webhook | `POST /api/webhooks/resend` (Svix-signed) |
| One-click opt-out | `GET|POST /u/<token>` |

## Secrets

| Name | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Research summaries and personalised drafts. Without it the agent still finds addresses by pattern and sends the templates as written. |
| `RESEND_API_KEY` | Sending (production only). The from-address must be on a verified Resend domain. |
| `RESEND_WEBHOOK_SECRET` | Verifies delivery / open / click / bounce / complaint events. Create the webhook in Resend pointing at `https://<apex>/api/webhooks/resend`. |
| `OUTREACH_CRON_SECRET` | Lets the pinger run the agent. Any long random string. |

Upload with `scripts/setup-secrets.sh` or `wrangler secret put <NAME>`.

## The hourly tick

OpenNext on Workers has no cron, so an external pinger drives the agent. The
repo ships one: `.github/workflows/outreach-tick.yml` runs at a quarter past
each hour, 07:00–17:00 UTC on weekdays. It needs a GitHub repository secret
named `OUTREACH_CRON_SECRET` with the same value as the Worker secret. Any
other uptime monitor can do the same job by calling
`POST https://activityroster.com/api/outreach/tick` with header
`x-outreach-secret`.

Each tick researches up to 10 new centres per running campaign and sends up to
25 due emails across campaigns, each campaign inside its own hours and daily
cap. Leads are claimed before sending, so overlapping ticks never double-send.
The "Run the agent now" and per-campaign buttons in the Dev Center call the same
code by hand.

## Guardrails

- B2B only: it writes to organisations about the roles people hold there.
- Every email has the sender's name, the company, a postal address, a plain
  opt-out link and `List-Unsubscribe` / `List-Unsubscribe-Post` headers.
- Replies, bounces, complaints and opt-outs stop the sequence and add the
  address to the do-not-email list, which every campaign checks before sending.
- Daily cap, UK working hours, weekdays-only by default, and a default 90-day
  exclusion for anyone emailed by any campaign.
- The writer is told to mention at most one detail it actually read on the
  site, never to invent names, numbers or claims, and never to pretend a prior
  relationship. You can preview any lead's next email before it goes.
- Research fetches go through the SSRF guard (`assertSafeFeedUrl`) and are
  capped in size and time.

## Marking outcomes

In a campaign, open a centre and press **They replied** or **Booked a demo**.
That stops the sequence, suppresses the address, and adds "email_sent" plus a
note to the prospect on the Marketing tab so both views agree.
