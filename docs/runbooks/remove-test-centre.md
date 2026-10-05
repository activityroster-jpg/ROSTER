# Removing a test centre

For centres you set up yourself to try the platform out. A customer who is leaving
never goes this way: they get the 90-day export window (Dev Center → the centre →
Manage → set status to cancelled; erasure unlocks after 90 days).

## What it does

Straight away, with no export window:

- deletes the centre and every record in it (courses, staff, roster, payroll, change log);
- deletes its uploaded files (certificates, vetting documents);
- deletes the logins that belonged only to that centre, so the same emails can sign up again.

It keeps:

- any login that is also a member of another centre;
- your own Dev Center login, even if you were a member of the test centre;
- a record of the removal (who, when, which centre, how many logins) in the security log.

It refuses a centre that still has a live Stripe subscription. Cancel the subscription
in Stripe first, then remove the centre.

## How

1. Dev Center → Centres → open the centre.
2. Scroll to **Manage** → **Remove test centre**.
3. Tick **This is a test centre, not a customer**.
4. Type the centre's address (for example `harbourpoint`) and press **Remove test centre now**.
5. You land back on the Dev Center overview with a green confirmation.

## If it was a mistake

The removal cannot be undone from the Dev Center. D1 Time Travel can restore the whole
database to any minute in the last 30 days (`docs/runbooks/restore.md`); note the time
you pressed the button, which is also in the security log entry.
