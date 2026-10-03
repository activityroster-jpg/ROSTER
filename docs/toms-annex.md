# Technical and organisational measures (draft annex to the DPA)

For solicitor review. Describes what is actually built as of 3 October 2026; items
marked *planned* are in `docs/compliance-plan.md` with a phase.

## 1. Confidentiality

- Access control: role-based (centre admin, instructor); server-side authorisation on every request; tenant isolation enforced in the data layer and tested on every deployment.
- Authentication: password policy (≥12 characters, breached-password screening), emailed sign-in confirmation per device, PIN re-authentication after inactivity, optional TOTP, new-device verification, rate limiting, generic error messages.
- Encryption in transit: TLS 1.2+ with HSTS. At rest: provider-level encryption on D1, R2 and KV; application-level AES-256-GCM for integration tokens; *planned* for emergency contacts and vetting status.
- Personnel: single operator (the company director) with 2FA on all provider accounts; no support login without a logged, read-only Ghost Mode session visible to the centre on request; production database access only for restores and incidents, logged.
- Sub-processors under DPA; register maintained.

## 2. Integrity

- Audit log of every roster, staff, settings and billing change; security event log for authentication events.
- Input validation and parameterised queries; dependency lockfile and automated update alerts.
- Change management: staging environment, automated tests including the isolation suite before any deploy, production deploy only on the operator's explicit approval, versioned additive migrations, rollback within minutes.

## 3. Availability and resilience

- Cloudflare's global network; no single server.
- D1 point-in-time recovery (30 days); *planned this phase:* nightly encrypted exports to EU storage with 30 daily and 12 monthly copies, an off-site copy with object lock, status email, quarterly restore tests.
- Printable rotas; *planned:* daily rota digest and emergency sheet; external uptime monitoring and status page.

## 4. Procedures for regular testing

- Automated test suite (domain rules, isolation, services) on every push.
- Quarterly restore test, logged.
- Annual review of this annex, the sub-processor register and security.txt expiry.
- *Planned (P2):* external penetration test.

## 5. Data subject rights and incident handling

- Public data-request form with automatic receipt and 30-day acknowledgement tracking; whole-centre data export on demand; deletion on cancellation after a 90-day export window.
- Incident runbook with severity table, 24-hour customer notification target and 72-hour regulator timeline; incident log.
