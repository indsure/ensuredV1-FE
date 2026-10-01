# Deploying document-sourced policy rules (NOT approved, NOT executed)

Branch `feat/policy-document-rules` (on top of `fix/surrender-value-honesty`). Nothing here
has been run against Supabase, EC2 or Vercel. Each step needs the founder's explicit go-ahead.
A backup plus a dry-run is not permission to change production.

## What changes

| Layer | Change | Shared with prod? |
|---|---|---|
| Database | Migration 025: five new tables, additive only, RLS on with no policies | Yes: beta and prod share one Supabase |
| Backend (EC2) | `services/policyDocs/*`, `services/policyDocStore.ts`, `services/policyValueStore.ts`, `shared/*.ts` copies, `routes.ts` hunks (upload hook, re-run hook, four document-rules routes, plus the earlier branch's routes) | Yes: one backend serves both |
| Backend packages | `tesseract.js`, `@napi-rs/canvas`, `@tesseract.js-data/eng` (runtime); `@electric-sql/pglite` (dev only) | Yes |
| Frontend (Vercel) | Review panel, earlier branch's screens | Per branch |

## 0. Checks before anything (read-only)

1. Live RLS on `clients`: confirm RLS is on and the browser roles cannot SELECT or UPDATE
   other advisors' rows, and whether they can UPDATE their own rows directly (which would
   bypass the backend's save checks). This was never verified from here. **Release blocker.**
2. EC2: `node -v` (needs 18+, repo uses 22), `free -m`, `nproc`, `uname -m` (x64 or arm64 for
   the `@napi-rs/canvas` prebuilt binary), free disk in `/tmp`.
3. Confirm `gen_random_uuid()` and `hashtext()` exist (Postgres 13+; Supabase has both).

## 1. Backup (before the migration)

The nightly encrypted backup to R2 exists (see project notes). Before this migration:
1. Take an on-demand logical backup of the whole database to the same encrypted R2 target.
2. Record its object key, size and the time.
3. Restore it into a throwaway Postgres (not Supabase) and run
   `SELECT count(*) FROM clients; SELECT count(*) FROM agents;`, comparing with production.
   Only a backup that restores counts.

## 2. Dry-run (done locally; repeat on a copy before production)

Done on PGlite (in-process Postgres, throwaway), by `backend/server/tests/policyDocStore.test.ts`:
migration applies, all five tables have RLS on, a browser-side role reads zero rows and cannot
insert, composite keys hold, history is append-only, the down migration removes exactly the
five tables, and 025 re-applies after it.

Before production, repeat on the restored copy from step 1:
```
psql "$COPY_URL" -v ON_ERROR_STOP=1 -f migrations/025_policy_document_rules.sql
psql "$COPY_URL" -c "\d policy_rule_facts"
psql "$COPY_URL" -v ON_ERROR_STOP=1 -f migrations/025_policy_document_rules_down.sql
psql "$COPY_URL" -v ON_ERROR_STOP=1 -f migrations/025_policy_document_rules.sql
```

## 3. Approval

Founder signs off with: the backup key, the restore check result, the copy dry-run output,
and the RLS check from step 0.

## 4. Production order

1. Migration 025 on Supabase (additive; old code ignores the new tables).
2. Backend on EC2: install the three runtime packages (`npm ci` in `backend/`), copy the new
   files and splice the `routes.ts` hunks (never scp the whole file), restart pm2. Smoke:
   `GET /api/agent/clients/<a test policy>/document-rules` returns `{parse:null,...}`.
3. Frontend on the beta branch first; check by content in the lazy chunk ("Policy terms from
   the document"), not the entry hash. Then prod only after a separate approval.
4. Bot: re-sync shared files; no behaviour change from this branch.

## 5. Rollback

- Code: revert the frontend commits; restore the previous backend files on EC2 and restart.
  Old code never reads the new tables, so nothing breaks while they remain.
- Data: run `025_policy_document_rules_down.sql` only if no advisor review data needs keeping,
  or after exporting the five tables (`COPY ... TO`). It is irreversible for review history.
- Uploaded PDFs are untouched either way (same private bucket as before).

## Cost and load

No paid calls: the reader is local and makes no model or network request. OCR is CPU-heavy:
about 5 to 6 seconds per scanned page on the development machine, one page at a time per
process. A fully scanned 40-page policy could take several minutes on a small instance; it
runs in the background and does not block the upload response.
