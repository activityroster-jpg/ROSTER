# Restore test log

A restore is rehearsed automatically every month (Actions → Restore rehearsal: a throwaway database, see `docs/runbooks/restore.md`); each run's row counts are in its run summary and the result is emailed. Log the first run, any failure, any manual drill and every real restore here.

| Date | Case (A/B/C) | Backup used | Target | Time taken | Result | Notes | Done by |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-05 | Rehearsal (Case B file, throwaway database) | `daily/2026-10-05.sql.gz.enc` (last night's) | Throwaway D1 in the EU, deleted afterwards | 4 s to load, 34 s end to end | Passed: every table's row count matched the file; newer migrations applied; integrity check ok | First run found that the raw export could not be loaded (tables listed alphabetically, so `account` came before `user`). Fixed in the restore and rehearsal workflows by re-ordering the file first (`.github/scripts/order-export.mjs`, with a test). Actions run 37262095662. | Claude Code |
