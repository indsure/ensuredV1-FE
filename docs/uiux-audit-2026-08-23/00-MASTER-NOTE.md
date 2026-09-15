# IndSure UI/UX Audit — Master Note

**Date:** 2026-08-23 · **Method:** 6 parallel read-only agent audits of `frontend/client/src` · **Scope:** 225 `.tsx` files

**Result: 355 findings — 24 Critical · 106 High · 152 Medium · 73 Low**

Detail files live beside this one. Every finding carries a `file:line` citation.

| File | Surface | Findings | C / H / M / L |
|---|---|---|---|
| `01-agent-core.md` | Agent CRM: dashboard, policies, customers, leads, queue, uploads, settings, claims | 87 | 3 / 26 / 41 / 17 |
| `02-agent-onboarding-tools.md` | Agent login, password recovery, signup step 1 | 26 | 1 / 8 / 13 / 4 |
| `02b-agent-tools.md` | Signup step 2, profile, microsite, Compare, Calculator, Rider Directory | 87 | 5 / 22 / 38 / 22 |
| `03-consumer-d2c.md` | Consumer upload → processing → report, portfolio, sharing | 51 | 4 / 17 / 24 / 10 |
| `04-public-site.md` | Marketing site, pricing, blog, legal, nav/footer | 84 | 10 / 25 / 32 / 17 |
| `05-cross-cutting.md` | Systemic: a11y, contrast, type, i18n, forms, feedback | 16 | 1 / 8 / 4 / 3 |

---

## Read this first

The audit did not mostly find design polish problems. It found three classes of issue that are more serious than UX debt:

1. **Silent data destruction** in the agent portal — buttons whose label, confirmation dialog and toast all disagree with what the code does.
2. **False statements shipping on the public site** — about privacy, pricing, data retention and traction. These are consumer-protection and DPDP exposure, not copywriting bugs.
3. **Systematic illegibility** for the stated target user (agents aged 40+) — sub-12px type and 2.85:1 contrast as the app's *default*, not its exception.

Everything else is ordinary and fixable. These three are not.

---

## Priority 1 — Data loss (fix before any UI work)

| # | Finding | Where |
|---|---|---|
| 1 | **"Dismiss" permanently deletes the policy record.** Button says Dismiss, confirm says Remove, toast says "Removed from queue" — the code runs `.delete()`. Agents tidying their queue destroy customer data believing they cleared a notification. | `pages/agent/MyQueue.tsx:96-114`, button `:295-302`, confirm `:278-293` |
| 2 | **Delete never checks its own result.** Supabase returns `{error}` rather than throwing, so the `catch` is dead code. The row disappears from the UI whether or not the delete succeeded, then reappears on refresh. No undo. | `pages/agent/PoliciesNew.tsx:201-212` |
| 3 | **Confirmation says "archives", code hard-deletes.** Promises recoverability that does not exist. | `pages/agent/PolicyDetail.tsx:606-614` vs `:342-359` |
| 4 | **Leaving the report deletes it.** `clearAuditState()` on unmount wipes `sessionStorage`, so pressing Back shows "Report Generation Failed / corrupted". | `pages/report.tsx:53,88-91` + `hooks/use-analysis.tsx:70-71` |
| 5 | **"Upload a different file" never discards the file.** The *discarded* file is what gets redeemed at signup — burning the user's one free slot on the wrong policy. | `components/PolicyUploadGate.tsx:103-111`, `lib/pendingUpload.ts:224,254` |
| 6 | **Pending upload lives in sessionStorage**, so when signup requires email confirmation and the link opens in a new tab, the file is orphaned. The upload-first premise collapses at its most common exit point. | `lib/pendingUpload.ts:206,217` vs `pages/signup.tsx:355,367-376` |
| 7 | **Autosave is deliberately disabled for agents** in the Cover Calculator (`if (embedded) return`). The consumer build of the same component saves and resumes; the agent loses a 7-step client profile on any refresh. | `components/calculator/CoverCalculator.tsx:300-301, 322-327` |
| 8 | **A 20–40s paid comparison is held in `useState` only** and wiped by `reset()` on one tap of a small grey link. `CatalogCompare` has no save/share path at all. | `Compare.tsx:173`, `:198-203` |
| 9 | **Signup step 2 has no Back button and no persistence** — a typo on step 1 is uncorrectable and 8 selected insurers vanish on refresh. | `SignupStep2.tsx:128-358`, `:46-51` |
| 10 | **No delete anywhere in the consumer product**, despite `/start` promising "you can delete them anytime". DPDP exposure. | `pages/start.tsx:377` vs `portfolio.tsx:949-1008`, `PolicyCard.tsx` |

**Data-integrity bug worth grouping here:** signup collects insurers into the `empanelments` table while the profile edits `agents.partnered_companies` from a *different, health-only* list — and the calculator and rider directory both read `partnered_companies`. The signup answer is dead data, despite the UI promising it tailors recommendations.
`SignupStep2.tsx:90-91` vs `MyProfile.tsx:251-259`, read by `AgentCalculator.tsx:73-78`, `RiderDirectory.tsx:28-33`

---

## Priority 2 — False and unverifiable public claims

Treat as its own workstream with legal review. Each is a factual statement contradicted by the shipping product or by live traction (~12 agents, 1 paying, ~46 analyses ever).

### Privacy and retention claims that are false
- "We don't store your personal information, policy details, or any uploaded documents" — `help.tsx:28`
- "Your documents are processed securely and deleted after analysis" — `how-it-works.tsx:74`, `:161-163`
- "No storage" claim contradicted by the stored 16-policy portfolio — `vision.tsx:53`

### Access and pricing claims that are false
- "No account needed to see your first result" / "Two minutes. No signup." — `how-it-works.tsx:25`, `:201`
- "No signup required. No BS." (also breaks the house copy rule) — `vision.tsx:301`
- "Never. We don't collect your phone number or email address." — `help.tsx:36`
- "Completely free… We don't charge for analysis" — `help.tsx:52`
- **Free-forever promised in four places** including an explicit FAQ denial ("There is no trial clock"), while the file's own comment says the server enforces a 30-day trial — `pricing.tsx:41-42, :51, :88, :101-103` vs the comment at `:13-16`

### Fabricated numbers and social proof
- **"10,000+ Policies Decoded"** — off by ~3 orders of magnitude — `mission.tsx:107-108`
- Roadmap claiming 2024 launch complete and "100K+ policy analyses" in progress — `vision.tsx:63-79`
- Fabricated testimonials with invented names, cities and hard numbers — `Landing.tsx:87-109`
- Fabricated platform statistic — `SignupStep2.tsx:420-427`
- "Integrates with" insurer strip implying integrations that do not exist — `Landing.tsx:209-221`
- "Most Popular" badge — fabricated social proof — `pricing.tsx`
- Unsourced "thousands of claims rejected every year"
- Promised features that do not ship: commission tracking, auto-filled forms
- Loading copy narrating analysis the code does not perform (its own comment calls it "theatre") — `CoverCalculator.tsx:577,582`

### Legal and contactability defects
- **Terms of Service jumps from section 6 to section 14** — liability, IP, termination and governing law are simply absent — `TermsOfService.tsx:152 → :165`
- All three legal documents dated 25 March 2025 (17 months stale)
- Support email is a dead domain, `contact@ensured.in` — `help.tsx:61-62, :166`
- Four different contact addresses site-wide, none of them a support address
- Grievance "registered address" is just "Nashik, Maharashtra, India"
- `/help` is routed but linked from nowhere — no Help or Contact route exists on the public site
- **404 ships developer scaffolding** — "Did you forget to add the page to the router?" — no header, footer or link back — `not-found.tsx:22`

The blog already had an honesty pass in July. These pages did not.

---

## Priority 3 — The 40+ agent audience is not actually served

The product's own design lens is "40+ Indian uncles: plain language, big text, WhatsApp-first." The code contradicts it in three systematic ways.

**Hindi is theatre.** `hi.json` is 100% complete (310/310 keys) but only **8 of 225 files** import from `@/i18n`. The public site, the whole consumer portal, and most agent workflow pages are hardcoded English. The language toggle appears to work and mostly does nothing. Half-translated is worse than untranslated. One screen renders raw i18n key strings in the sidebar on fallback.

**WhatsApp-first is not implemented where it matters.** Phone numbers are inert text across the entire customer and policy side — `CustomersNew.tsx:229`, `CustomerDetail.tsx:211`, `PolicyDetail.tsx:525`, `DashboardMobile.tsx:110` — even though Leads, Claims and LeadRenewals already do Call/WhatsApp correctly. `DashboardMobile.tsx`'s own header comment claims one-tap WhatsApp from each name; it was never built.

**The app is too small to read.** 753 `text-xs` plus 386 arbitrary sub-14px sizes carrying real content. `text-slate-400` used 341 times at **2.85:1 contrast** — below WCAG AA — applied preferentially to labels and table headers, including the statutory DPDP grievance-officer fields. Several screens use `text-[11px] sm:text-[10px]`, which makes text *shrink on larger screens* (`MyProfile.tsx` at 19 sites, `AdminAgents.tsx:115`). For presbyopic users on cheap phones in daylight this is the single highest-volume defect in the codebase.

**Highest-leverage single file:** `pages/agent/SettingsNew.tsx:153` violates four themes on one line — 10px type, 2.85:1 contrast, unassociated label, untranslated. The agent form pages are where everything compounds. Settings also has the worst microcopy in the app ("Account Orchestration", "New Vault Password").

---

## Priority 4 — Systemic patterns

- **Raw error strings reach end users everywhere.** Supabase and backend errors are rendered verbatim, including "Cannot connect to backend server. Please ensure the server is running." shown to consumers in monospace (`use-analysis.tsx:142`). Several destructive and error flows use native `alert()` / `confirm()`.
- **A toast system that silently swallows messages.** Sonner's `<Toaster>` is never mounted, yet `pages/hospitals.tsx:86` calls `toast.error(...)`. The user sees nothing on failure.
- **No shared form stack.** `react-hook-form` and `zod` are installed and used by zero real forms; all 194 inputs are ad-hoc `useState`. Labels never use `htmlFor`. Placeholder-as-label in 4 files, where the required-field marker disappears on first keystroke.
- **Progress is faked.** `/processing` runs four steps on hardcoded timers while the portfolio reports real backend stages.
- **Scope trap:** only health policies get a full report (`PolicyCard.tsx:56`), while the UI actively prompts users to add term/life/vehicle — and consumes a free slot for each.
- **Deployment inconsistency:** `PolicyDetail.tsx:281` Share Report uses a relative `/api/...` path while the rest of the portal uses `getApiBase()`. On the split-host deployment the core sales action fails from the detail page but works from the list — will present as a flaky bug in the field.
- **Silent upload rejection:** phone photos are rejected with no message (PDF-only, no `onDropRejected`); dropping a non-PDF into the portfolio uploader does nothing at all.
- **Console leakage:** the shared-report page logs score and verdict to the browser console in production (`SharedReport.tsx:179-190`).
- **Keyboard/screen-reader gaps:** option cards are clickable `<div>`s with no role or keyboard handling; social icons have no accessible name and open cross-origin without `rel`.
- **Draft autosave writes the plaintext password into sessionStorage** during agent signup.

---

## What is genuinely good

Worth recording so it does not get "fixed":

- **A real top-level error boundary** wraps the router with a branded fallback — no white-screen risk.
- **The responsive layer holds up.** Fixed-width and table greps were almost all false positives; the `table-cards` collapse pattern is applied properly (e.g. `PolicyValues.tsx`).
- **`components/auth/field.tsx`** does it right: inline errors and a 16px floor that prevents iOS zoom.
- **Consumer portfolio is the strongest screen in the product** — `scoreVerdict` / `scoreMeaning` give genuinely good plain-language score interpretation.
- **Trust copy on `/start` and the upload gate is well written** — the problem is that other pages contradict it.
- Zero TODO/FIXME and zero missing `alt` attributes across the codebase.

---

## Suggested sequence

1. **Stop the bleeding** — the 10 data-loss items above. Mostly small, individually cheap.
2. **Legal/claims pass** — delete or correct every false statement; restore the missing ToS sections; fix the dead support email. Needs a decision on what the product actually promises.
3. **Legibility floor** — one pass raising sub-14px content type and replacing `text-slate-400` on light backgrounds. Highest user-visible improvement per hour of the whole list.
4. **WhatsApp/Call on the customer side** — copy the pattern that already works in Leads.
5. **Decide on Hindi** — either finish it or remove the toggle. The current state is the worst option.

---

## Known gap

`advisor-page.tsx`, `life.tsx`, `term.tsx` and `vehicle.tsx` were not read in full — their "AI" copy-rule violations are logged, but they have not had a complete pass.
