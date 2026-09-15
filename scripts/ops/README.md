# Operational scripts

Eight tools that survived the 2026-09-01 cleanup, out of roughly 115 loose
scripts that were sitting at the repo root and in `backend/`. The rest were
one-off DDL superseded by `migrations/`, or ad-hoc inspection written to answer
a question that has since been answered. They are archived at
`E:\Indsurefi\_archive\cleanup-2026-09-01\one-off-scripts\` and are in git
history.

These are the ones with a reason to exist tomorrow.

**Every script here reads a real database.** Each resolves the repo-root `.env`
from its own location rather than the working directory, so it can be run from
anywhere. Check which `DATABASE_URL` is in scope before running anything.

| Script | What it does |
| --- | --- |
| `apply_migration.mjs` | Applies one file from `migrations/`. **Always `--dry-run` first**: it wraps the file in a transaction and rolls back, proving the SQL applies cleanly against the real schema without persisting anything. |
| `load_catalog.mjs` | Loads the plan catalog from `backend/catalog_seed/` into `policy_catalog`. |
| `advisor_page_admin.mjs` | Allowlist tool for the per-advisor landing pages at `/a/<slug>`. |
| `add_invite.mjs` | Adds a single invite code. |
| `create_reusable_invite.mjs` | Creates an invite code usable more than once. |
| `check_invite_code.mjs` | Reports the state of one invite code. |
| `reactivate_invite.mjs` | Reactivates a spent code and makes it reusable. |
| `mint_login_link.mjs` | Dev helper: mints a magic-link verify URL. |

## Applying a migration

```bash
node scripts/ops/apply_migration.mjs migrations/021_whatever.sql --dry-run
node scripts/ops/apply_migration.mjs migrations/021_whatever.sql
```

`migrations/` is the record of what the live schema is. If you find yourself
writing a script here that creates or alters a table, write a migration instead:
that is exactly how the previous 115 accumulated, and how one of them ended up
recreating a table that had been renamed a month earlier.
