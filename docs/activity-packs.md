# Activity packs

One platform, one login, one app. What differs between an RYA centre / school
and a PADI dive centre is only the **starting set** a new centre
gets and the **words** it sees. That starting set is an *activity pack*
(`lib/packs`).

## What a pack holds

- the starting lists seeded on provisioning: session slots, roles, instructor
  types (certificates / ratings), expiring checks (per jurisdiction), kit,
  location types, course types;
- default settings (today: slot style);
- wording: the governing body's name, what certs are called, the course list's
  name, the "add all" buttons, the dashboard note.

The pack is read **once**, at provisioning, and in a handful of labels. After
that the centre owns its lists (deactivate-never-delete) and every feature
reads those rows, as before. Nothing in the roster, availability, checks, pay,
billing, app or Dev Center knows which pack a centre came from.

## Where the choice lives

- `organisation.activity_type` (migration 0081), chosen at sign-up
  (`LeadCapture`, `SlugClaim` → `trialSignupSchema` / `signupSchema` →
  `provisionCentre`). Every centre from before packs is `rya_centre`.
- `packFor(organisation.activityType)` gives the pack; unknown values fall back
  to the RYA centre.
- A centre that runs two activities adds the other pack's course list and
  instructor types from **Course setup → Run another kind of activity too?**
  (`addPackListsAction`).

## Adding a new kind of centre

1. Add the id to `ACTIVITY_TYPES` in `lib/db/schema/control-plane.ts`.
2. Write `lib/packs/<name>.ts` and register it in `lib/packs/index.ts`
   (`PACKS`), in the order it should appear at sign-up.
3. Add the option to the two sign-up forms' `ACTIVITY_TYPES` lists.
4. If the pack's schemes need a new qualification discipline, teach
   `schemeDiscipline` in `lib/services/teaching.ts` the words it uses.
5. `tests/packs/packs.test.ts` checks every pack automatically; add a seed test
   like `tests/services/padi-pack.test.ts`.
6. Sales page and guide sections for it come last, linked from the footer until
   it goes on the homepage tiles.
