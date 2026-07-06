# Compare — Pre-Prod Deploy Handoff (2026-06-24)

For a fresh session whose only job is to **push the Compare frontend to pre-prod**.
The backend and database are ALREADY deployed and verified live — do not touch them.

## TL;DR
Only one step remains: **push the 3 committed frontend commits on `pr-6` to GitHub.** Vercel auto-deploys. Backend (EC2) + DB (Supabase) are already live and verified.

---

## The push (the only remaining step)
- Repo: `E:\Indsurefi\IndSure` (this is the git repo; `E:\Indsurefi` is NOT a repo).
- Branch: `pr-6`. Confirm 3 unpushed commits first:
  ```bash
  cd /e/Indsurefi/IndSure
  git log --oneline origin/pr-6..HEAD
  # expect: 7db2e1d (N-way + search-to-add picker), 32cac0d (landing), 5e51e96 (catalog page)
  ```
- Push with a fresh short-lived PAT (user supplies it; revoke after). Use the plain inline-PAT URL form (the one that works):
  ```bash
  git push https://<PAT>@github.com/indsure/ensuredV1-FE.git pr-6
  ```
  Mask the token in any echoed output. Vercel (`ensured-fe`) auto-builds on push.

## Do NOT
- Do NOT `git add` or commit the backend or local tooling. `git push` ships commits only, not the working tree — the uncommitted backend/tooling changes are expected and must stay local.
- Do NOT `git pull`/reset on the EC2 box. Do NOT scp/restart the backend (already current — see below).
- Do NOT commit: `backend/catalog_seed/`, `backend/load_catalog.mjs`, `backend/setup_*.mjs`, `backend/mint_login_link.mjs` (local ingestion tooling).

## Already done — VERIFIED, do not redo
- **Backend (EC2, `api.indsure.in`):** live and byte-identical to local (routes.ts, types/wordingProfile.ts, services/wordingCompare.ts). Verified via prod API: `GET /api/compare/catalog` → 401 unauthed / 63 plans authed; `POST /api/compare/from-catalog {uins:[...]}` 4-way works.
- **DB (shared Supabase, prod reads it):** `policy_catalog` = 63 comprehensive_health_indemnity + 4 top_up; `comparison_reports` table exists. Nothing to run.

## Post-deploy verification (after Vercel build finishes)
1. Log into the pre-prod **agent portal** → sidebar **Compare** (Grow group) → **"Compare from the catalog"** button.
2. Confirm "63 plans across 10 insurers"; add 2–4 plans via the "+ Add a plan" search → matrix + verdict render.
3. From a result, the **public share link** (`/compare/report/:uuid`) should open for a logged-out customer.
4. The PDF **upload** path (`/agent/compare`) should also still work.

## Known / QA backlog (NOT blocking pre-prod)
All catalog rows are `status: unverified`. A few medium-confidence rows carry `VERIFY` notes; 2 are OCR-garbled (ManipalCigna ProHealth Prime, Aditya Birla Activ Assure); 2 use placeholder UINs (`PENDING-TATAAIG-MEDICARE-LITE`, `PENDING-TATAAIG-HEALTH-SUPER-CHARGE`). Fine for testing; clean up before full prod.

## Context
Compare = agent-only paid feature. Two ways in: catalog pick (zero-AI, instant) and PDF upload (self-healing). Catalog built by Claude (no Gemini) from ~111 wordings across 10 insurers. More PDFs to be ingested later (drop into `_pdf_inbox/`, run the parallel-subagent recipe → `load_catalog.mjs`). Full detail in the `project-compare-feature` memory.
