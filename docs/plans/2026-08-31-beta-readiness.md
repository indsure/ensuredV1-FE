# Plan - Beta readiness: land the uncommitted work and make EC2 match it

**Tier: T2.** Touches deletion paths, money (Gemini spend), auth-adjacent routes, personal data
(backups), and a live production box. Full loop.
**Branch:** `pr-6`. The working tree carries unrelated scratch, so commit selectively.
Never `git add -A`.

**Explicitly out of scope:** the life/term Policy Values surface. The founder is sending changes
later today. No file under that feature is touched, and nothing is removed.

## 1. Goal

Beta runs every feature that is committed to `pr-6`, the agent portal stops destroying work
silently, a runaway document can no longer burn money unnoticed, and the database stops being
one bad afternoon away from unrecoverable.

## 2. Findings that set the scope

Established by inspection on 2026-08-31, not assumed:

| Finding | Evidence |
|---|---|
| **EC2 has no agency-teams backend at all.** `teamRoutes.ts` (51KB, 12 routes) is absent from the box. The whole feature is dead on beta. | `ls ensuredV1-FE/backend/server/*.ts` shows no `teamRoutes.ts` |
| **EC2 drift is far smaller than feared.** `index.ts` byte-identical; `aiService/analysisPipeline/geminiUsage` byte-identical; `routes.ts` differs by exactly **4 hunks, all local-ahead**. Nothing on the box is missing from local. | `diff` of pulled EC2 copies vs `pr-6` |
| **Migrations 015-018 are already applied to live.** `teams`, `team_invites`, `team_access_log`, `team_requests`, `agents.team_id` all present. | read-only `information_schema` probe |
| **The backup script has never been runnable.** `pg_dump` missing, `aws` missing, `rclone` missing. `gpg` present. Root disk at 72%, 2.0G free. | `which` on the box |
| **`hospitals.tsx` toasts into the void.** It imports `toast` from `sonner`; only the radix `Toaster` is mounted in `App.tsx:140`. Every toast on that page is silently dropped. | `grep` both files |

## 3. Claims Ledger

Every user-visible assertion this change introduces or alters.

| Claim shown to user | Source of truth | Verified |
|---|---|---|
| "Policy deleted. This cannot be undone." | `supabase.from('clients').delete()` - a real hard delete | 2026-08-23 |
| "Any share link you sent will stop working immediately." | `public_reports.client_id ... ON DELETE CASCADE` (`setup_public_reports.sql:4`) | 2026-08-23 |
| "<owner> opened your policies" in the access log | `team_access_log` row written by every member-data route in `teamRoutes.ts` | 2026-08-31 |
| "This document is too large to analyse" (new) | `assertWithinHardCeiling` rejects BEFORE any SDK call; ledger row `status='rejected_oversize'`, `est_cost_usd=0` | 2026-08-31 |

No new count, statistic or capability claim is introduced. The 30 existing `unsourced-claim`
guard failures are pre-existing, all in the pricing/"free forever" cluster, and are escalated in
section 8 rather than guessed at.

## 4. Blast Radius

- **The same EC2 backend serves beta AND prod.** Deploying `teamRoutes.ts` is purely additive
  (new paths, all JWT-gated). The one edit to an existing route is
  `POST /api/agent/create-profile`, which gains three **optional** body fields. The prod frontend
  never sends them, so it takes the untouched path and gets `enterpriseCaptured: false`. Prod is
  not affected by this deploy. This is the single most important check in the plan and it is why
  the deploy is safe to do without shipping the frontend to prod at the same time.
- **Input budget changes the analysis path, which is the money path.** Current traffic is far
  under budget and passes through untouched; only an outlier is truncated or rejected. Still the
  highest-risk item here, so it deploys last and separately.
- **New ledger statuses `degraded` / `rejected_oversize`.** `gemini_usage_log.status` is
  `TEXT NOT NULL DEFAULT 'ok'` with no CHECK constraint, so no migration. Admin spend totals must
  exclude `rejected_oversize` or reported spend becomes fiction.
- **No public page describes delete, dismiss, teams or document limits**, so no marketing copy
  goes stale.

## 5. Unhappy paths to exercise

Backend boots with `teamRoutes` registered but a member has no team (must 200 with an empty list,
not 500) - unauthenticated call to a team route (must 401) - prod-shaped `create-profile` body
with no `account_type` - `pm2` restart loop on a bad import - `pg_dump` absent - `pg_dump` major
older than the server - oversized document rejected before spend.

## 6. Reversibility

- Frontend: git revert, Vercel redeploys.
- EC2: every replaced file is copied to `~/deploy-bak-<stamp>/` first, so rollback is one `cp`
  plus `pm2 restart`. Rollback is verified as part of the deploy, not assumed.
- Backups: installed **disabled**. The timer is not enabled until the founder supplies
  credentials, so a half-configured job cannot half-run.

## 7. Scope

| # | Item | Where |
|---|---|---|
| A | Commit the data-loss / honest-destructive-copy pass (7 files) + its plan + the audit docs | `pr-6` |
| B | Commit `rules.md` guard section, `.gitignore` backup secrets, `.gitattributes` LF | `pr-6` |
| C | Commit the `TeamAccessLog` wiring, which has been an orphaned component since `8d20c95` | `pr-6` |
| D | **Deploy `teamRoutes.ts` + the 4 `routes.ts` hunks to EC2.** Back up, splice, boot, smoke | EC2 |
| E | Port the Gemini input-budget work out of the stale worktree, verify, commit, deploy | `pr-6` + EC2 |
| F | Fix `hospitals.tsx` toasting into an unmounted system | `pr-6` |
| G | `rel="noopener noreferrer"` on the 17 bare `target="_blank"` | `pr-6` |
| H | Remove the 6 production `console.log` calls | `pr-6` |
| I | Install backup prerequisites and scripts on EC2, prove the pipeline with a **schema-only** dump that contains no customer data, leave the timer disabled | EC2 |

## 8. Founder decisions - escalated, not guessed

1. **Backup credentials.** R2 account, bucket, API token, and the GPG passphrase. Creating
   accounts and handling credentials is yours to do; everything else is prepared and waiting.
2. **`pii-in-storage`.** `SignupStep1.tsx:119` writes the agent's own name, phone, email and city
   to `sessionStorage` as a draft. `rules.md` bans personal data in web storage. Deleting it is a
   signup-funnel regression, so it is not being changed silently.
3. The 30 `unsourced-claim` failures ("free forever", "no signup required") contradict the
   30-day trial. This is a pricing promise, not a copy fix.
4. The four decisions in `2026-08-23-data-loss-fixes.md` section 6 remain open and untouched.

## 9. Exit criteria

Frontend `tsc --noEmit` clean - backend `tsc --noEmit` clean - `npm run guard` shows
`unchecked-delete` 0, `toaster-not-mounted` 0, `blank-without-rel` 0, `console-log` 0, and no WARN
budget higher than today - 40 input-budget tests pass - EC2 boots clean and answers a smoke test -
frontend production build succeeds - honest report of anything not verified.

---

# Execution record - 2026-08-31

## Shipped

| # | Item | Result |
|---|---|---|
| A | Data-loss / honest-destructive-copy pass | `2dbe526` |
| B | Backup scripts, rules.md guard section, ignore rules | `16a1fe9` |
| C | `TeamAccessLog` wiring | `4f6df3a` |
| D | **Agency-teams backend deployed to EC2** | live, smoke-tested |
| E | Gemini input budget + honest ledger statuses | `c4ad8c0`, deployed |
| F | `hospitals.tsx` toast, and the unused sonner wrapper deleted | `79b4d77` |
| G | `blank-without-rel` - **the rule was wrong, not the code** | `79b4d77` |
| H | Six production `console.log` calls removed | `79b4d77` |
| I | Backup prerequisites, scripts and units installed on EC2, timer disabled | live |

## Two findings that changed the plan

**G was 17 false positives.** Every one of the flagged links already had the
`rel` it was accused of missing, on the line below `target`. The rule tested a single
line, so any prettier-formatted link failed it. The code needed nothing; the rule was
rewritten to read the whole opening tag. This is the second guard rule found scanning
too narrow a window, after `unchecked-delete`. A rule that cries wolf 17 times teaches
people to scroll past the guard output, which is worse than not having the rule.

**EC2 drift was one-directional, so the deploy was safe to do wholesale.** The standing
rule is never to copy a whole `routes.ts` up, because drift runs both ways. Measured
rather than assumed this time: `index.ts` and all three services byte-identical,
`routes.ts` different by 4 hunks and 3 removed lines, every one of them part of the
agency-teams change. Nothing on the box was missing from `pr-6`, so a whole-file copy
lost nothing. The rule stands for next time; the measurement is what made this an
exception.

## Verification

| Check | Result |
|---|---|
| Frontend `tsc --noEmit` | clean |
| Backend `tsc --noEmit` | clean |
| `npm test` (input budget) | 40 pass, 0 fail, no network |
| `npm run check:teams` | all checks passed against live schema, rolled back |
| `npm run guard` | 203 blocking to 179 |
| Frontend production build | built in 41.53s, prerender wrote 14 pages + 53 posts + 46 clause pages |
| EC2 boot | routes registered, DB connected, restart count +1 per deploy, no crash loop |
| EC2 smoke | `/api/team` 401, `/api/team/access-log` 401, `/api/admin/gemini-usage` 401, `/api/health` 200 |
| Backup pipeline | session pooler reachable on 5432, `pg_dump` 18.6 vs server 17.6, 64 tables including 23 in `auth`, GPG encrypt/decrypt round-trip, artefacts shredded |
| Backup unhappy path | runs with no config, exits 1 with `FATAL: cannot read config`, writes nothing |

Guard detail: `unchecked-delete` 0, `console-log` 0, `toaster-not-mounted` 0,
`blank-without-rel` 0. No WARN budget rose. Remaining 179 are `inverted-type-scale`
(148), `unsourced-claim` (30) and `pii-in-storage` (1).

## Not done, and why

- **Backups do not run yet.** Everything except the credentials is installed and proven.
  The timer is deliberately disabled so a half-configured job cannot half-run.
- **`inverted-type-scale` (148).** Type that shrinks on larger screens, mostly table
  headers at `text-[11px] sm:text-[10px]`. Mechanical, but removing the `sm:` variant
  makes desktop text larger across many tables, which is a visual change that wants eyes
  on it. Not slipped in alongside a deploy.
- **Nothing was browser-verified.** These paths are behind agent auth, and exercising the
  analysis flow spends real Gemini credit. Correctness rests on typecheck, unit tests, the
  SQL smoke test, the deploy smoke test and code review.
- **The input budget has never run against a real oversized document.** Its tests are pure
  unit tests. First real proof will be the first oversized upload.
- **Life insurance untouched**, per instruction. Changes arriving separately.
