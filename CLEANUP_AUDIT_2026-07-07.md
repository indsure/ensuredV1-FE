# Redundant Files Audit — 2026-07-07

Full-codebase sweep for dead/redundant files. Method: import-graph check (a file is "orphaned"
if no other source file references its name), directory inspection, and git-tracking check.
**Nothing has been deleted** — this is the hit list. Items marked ⚠️ need a decision first.

Estimated reclaimable disk: **~2.5 GB** (mostly stray `node_modules`). Almost everything below
is git-tracked, so removal = `git rm -r` + commit.

## 1. Dead application directories (~2.1 GB)

| Path | Size | Verdict |
|---|---|---|
| `agentdashboardreview/` + `agentdashboardreview.zip` | 679 MB + 137 KB | Never deployed anywhere (confirmed against deploy reality). Zip is a duplicate of the extracted dir. |
| `indsure-ui/` | 538 MB | Abandoned Next.js comparison-tool experiment; superseded by the compare feature in `frontend/`. |
| `next-api/` | 470 MB | Stock create-next-app scaffold. Live backend is Express on EC2. Referenced only by the root `dev:all` script — remove it from there too. |
| `next-dashboard/` | 433 MB | Next.js scaffold superseded by `admin-app/`. Also only referenced in `dev:all`. |
| `admin-app/admin-dashboard/` | small | Dead static mockup (its api-logs page was fake data). The real admin app is `admin-app/src`. |
| `dashboard/` (inside IndSure) | 0 | Empty directory. |

⚠️ Note `attached_assets/` (561 MB, tracked) and `_pdf_inbox/` (325 MB, at repo parent) were
NOT classified as junk: `_pdf_inbox` holds insurer wording source PDFs; `attached_assets/v2final`
needs a look before touching.

## 2. Orphaned frontend source (never imported anywhere)

`frontend/client/src/`:

- `components/agent/UploadModal.tsx` ⚠️ — dead, **but the 2026-07-02 re-upload credit warning
  was built into it**, so that warning is not live. The rerun-credit copy in
  `pages/agent/PolicyDetail.tsx` IS live. Port the duplicate-upload warning to the real upload
  flow (`pages/agent/AgentUploads.tsx`) before deleting.
- `components/agent/AgentSummaryCard.tsx`, `components/agent/NotificationDropdown.tsx`,
  `components/agent/SwitchModal.tsx`
- `components/FindMyPolicy.tsx` + `hooks/usePolicySession.ts` ⚠️ — orphan chain that fronts the
  policy-fetch prototype (see §5). Delete or revive together with `backend/src/`.
- `components/AnalysisConfidence.tsx`, `components/CalculatorConfirmation.tsx`,
  `components/PDFPasswordModal.tsx`, `components/PDFReport.tsx`, `components/SkipToMain.tsx`,
  `components/TermInsuranceCalculator.tsx`, `components/UploadPolicy.tsx`,
  `components/VehicleInsuranceCalculator.tsx`, `components/WhyClaimsFail.tsx`
- `components/charts/bar-chart.tsx`, `components/charts/comparison-table.tsx`,
  `components/charts/donut-chart.tsx`
- `pages/blog/article-templates.ts` (superseded by `article-content.ts`)

## 3. Orphaned backend source

Truly dead (not imported):
- `server/lib/analyze-core.ts` — Phase-2 refactor placeholder, never wired.
- `server/utils/contextAssembler.ts`
- `server/types/master_audit_schema.ts`, `server/types/policy_schema_v2.ts`
- `server/validation/calculator-schemas.ts` ⚠️ — validation schemas that were never wired to the
  calculator endpoints. Consider **using** them instead of deleting.
- Dead import: `GoogleGenerativeAI` in `server/services/analysisPipeline.ts:2`.

Manual one-shot utilities in `server/` (standalone by design; archive rather than delete if unsure):
`inspect_db.ts`, `promote_admin.ts`, `repro_import.ts`, `setup_admin_db.ts`, `setup_leads_db.ts`,
`setup_notifications_db.ts`, `setup_public_reports_db.ts`, `setup_summaries_db.ts`,
`test_notification.ts`, `update_notifications_table.ts`

## 4. One-off scripts, logs, and outputs

**IndSure root (~35 files, all April-era):** `apply_fixes.py`, `apply_fixes_v2.py`,
`final_surgical_fix.py`, `create_dummy_pdfs.py`, `apply_rls.mjs`, `check_calculator_table.ts`,
`check_db.mjs`, `check_notifications_table.ts`, `check_schema.cjs`, `check_schema.ts`,
`db_script.cjs` + `db_script.js` (duplicates), `debug_agents.mjs`, `generate-admin-ui.mjs`,
`generate-ui.mjs`, `stub-ui.mjs`, `run_prompt1.mjs`, `get_dashboard_overview.mjs`,
`get_dashboard_overview_admin.mjs`, `get_db.mjs`, `get_json_dashboard.mjs`, `index.cjs`,
`list_policies.mjs`, `run_migration.js` + `run_migration.mjs` (duplicates), `run_setup_sql.js`,
`test-supabase.mjs`, `test-supabase2.mjs`, `test-supabase-schema.mjs`, `test_hospital_api.mjs`,
`test_report.mjs` — plus outputs: `output.html`, `output.json`, `output.txt`, `sach_debug.log`,
`dashboard_data.json`, `db_schema.json`, `error.txt` (in next-api)

**backend/ root (~45 files):** `schema_*.txt` (5 schema dumps), `final_logs.txt`,
`server_logs.txt`, `error_response.json`, `test_*.mjs` (~10), `check_*.mjs` (~6),
`fix_db*.mjs`, `debug_share_token.mjs`, `find_working_policy.mjs`, `investigate_issues.mjs`,
`query_db.mjs`, `verify_db.ts`, `list_policies.ts` …
⚠️ Keep the `add_*` / `setup_*` / `apply_*` migration runners (they're the de-facto migration
history) or move them into `migrations/`. Keep `mint_login_link.mjs`, invite-code scripts,
`agent_e2e.mjs` if still used operationally.

**SQL one-offs at IndSure root:** `fix_analysis_jobs.sql`, `fix_leads_rls.sql`,
`fix_rls_policies.sql`, `setup_admin.sql`, `setup_notifications.sql`, `setup_public_reports.sql`,
`setup_signup_approval.sql`, `setup_summaries.sql` — applied long ago; fold into `migrations/`.

## 5. NOT redundant — looks dead but isn't

- **`backend/src/`** (index.ts on :3001, `routes/policy-fetch.ts`, Playwright session,
  insurer-config, selector detection) — a **live-quote/policy-fetch prototype**. Nothing imports
  it and no frontend page reaches it (only the orphaned `FindMyPolicy` chain), but it is the seed
  of the planned live quote feed. Decide: revive or park in a branch.
- `dashboard/` at repo parent (`E:\Indsurefi\dashboard`) — the Gemini spend dashboard,
  wired into `.claude/launch.json`.
- `load-test/k6-agent-flow.js`, `migrations/001_security_hardening.sql`, `shared/schema.ts`
  (drizzle), `backend/catalog_seed`, `backend/indsure-data`, `backend/indsure-scoring`.

## 6. Stale docs (~45 markdown files at IndSure root)

All April-era session artifacts: `AGENT_AUTH_FIX.md`, `SIGNUP_*.md` (×10), `SCORING_*.md` (×3),
`PHASE3_*.md` (×3), `CALCULATOR_*.md` (×3), `BUCKETING_*.md` (×2), `QUICK_START*.md` (×4),
`FIXES_*.md` (×2), `SACH_AI_*.md` (×2), `SHARE*_FIX.md` (×2), `NOTIFICATION_FIX.md`,
`BEFORE_AFTER_NOTIFICATION.md`, `BOOK_A_CALL_IMPLEMENTATION.md`, `COMPARE_TOOL_REFINEMENTS.md`,
`IMPLEMENTATION_SUMMARY.md`, `INVITE_CODES_ACTIVE.md`, `LEAD_COLLECTION_SYSTEM.md`,
`LIVE_LINKS.md`, `PRODUCTION_READY_SUMMARY.md`, `SETTINGS_FIXED.md`, `TESTING_GUIDE.md`,
`VISUAL_GUIDE.md`, `UPLOAD_401_FIX_SUMMARY.md`, `test-shared-report.md` …

Suggest: `mkdir docs/archive && git mv *.md` (keeping `README.md`, `ARCHITECTURE.md`,
`DATA_PROTECTION.md`, `CLIENT_DATA_PRIVACY_INVESTOR_BRIEF.md`, `GEMINI_CALL_SITES.md`,
`COMPARE_DEPLOY_HANDOFF.md`, `product.md`, `rules.md`, `tech.md`, `structure.md`).

## 7. Build artifacts & runtime files

- `frontend/dist/` (8.4 MB) and `backend/dist/` — build outputs; regenerate, don't track.
- `uploads/` at IndSure root and `backend/uploads/` (46 MB) — **runtime policy uploads on disk**.
- ⚠️ **Privacy flag:** `test_policies/Star_Health_Real_Policy.pdf` is a **real customer policy
  tracked in git history**. Under DPDP this shouldn't live in the repo. Remove and, when the repo
  is next migrated/made shareable, scrub history.
- Repo parent: `mockup-dashboard.html`, `indsure-dashboard.png` — June mockup artifacts (the
  `mockup` launch.json entry serves them; drop both together).

## 8. Duplicates already fixed in this audit

- Second `GEMINI_CALL_SITES.md` (backend/) merged back into the root one and deleted.
