# Cross-Cutting UI/UX Audit — IndSure Frontend

Scope: systemic patterns repeating across the whole app.
Root: `E:\Indsurefi\IndSure\frontend\client\src` (paths below are relative to this root).
Corpus: 225 `.tsx` + 72 `.ts` files.
Method: ripgrep counts, every finding spot-verified in context. Non-findings (things that turned out fine) are listed at the bottom so they don't get re-audited.

---

## 1. Internationalisation / Hindi

### [SEVERITY: Critical] Hindi exists but reaches ~3.5% of the app — the entire public site and consumer portal are English-only
- **Scale:** 8 of 225 `.tsx` files import from `@/i18n`. The other 217 are hardcoded English.
- **Where:**
  - `i18n/locales/en.json` / `i18n/locales/hi.json` — 310 keys each, so the *dictionary* is fully translated (no missing-key gaps).
  - Consumers of it: `components/agent/AgentLayout.tsx:10`, `components/agent/AgentTabBar.tsx:3`, `pages/agent/AgentUploads.tsx:11`, `pages/agent/DashboardNew.tsx:13`, `pages/agent/Landing.tsx:15`, `pages/agent/LoginNew.tsx:6`, `pages/agent/MyProfile.tsx:14`, `pages/advisor-page.tsx:25`.
  - Zero `@/i18n` imports anywhere under `pages/app/` (consumer portfolio), `pages/admin/`, `pages/blog/`, `pages/learn/`, `pages/compare/`, `pages/report/`, or any of the ~40 marketing pages (`home.tsx`, `pricing.tsx`, `policychecker.tsx`, `help.tsx`, `signup.tsx`, `login.tsx`, `vehicle.tsx`, `term.tsx`, `life.tsx`, …).
- **Problem:** The stated target user is a 40+ Hindi-speaking Indian agent. Today Hindi covers only the agent shell chrome (nav, tab bar, login, landing, uploads, dashboard, profile). The moment that user taps into Customers, Leads, Renewals, Claims, Policies, Calculator, Settings, or anything on the public site, the UI silently reverts to English. A half-translated product is arguably worse than an untranslated one — it sets an expectation it then breaks mid-task.
- **Fix:** Treat i18n coverage as a tracked number. Priority order: (1) the agent workflow pages that already sit behind the toggle (`Customers`, `Leads`, `Renewals`, `Claims`, `Policies`, `Settings`) — the toggle is already visible there via `AgentLayout`, so English text under a Hindi toggle is the most jarring case; (2) the consumer `pages/app/*` portfolio; (3) marketing. Add a lint rule or CI grep that fails on new bare string literals in JSX under `pages/agent/`.

### [SEVERITY: High] The language toggle is not discoverable outside the agent shell
- **Scale:** `LanguageToggle` is rendered in 3 places.
- **Where:** `components/agent/AgentLayout.tsx:10`, `pages/agent/Landing.tsx:15`, `pages/agent/LoginNew.tsx:6`.
- **Problem:** A Hindi-preferring visitor landing on `indsure.in` (home, pricing, policychecker, signup) has no way to switch language and no signal that Hindi exists at all. Discovery of the Hindi mode depends on the user first finding the agent landing page. Note that the two `setLanguage` hits in `components/SachAIChat.tsx:90` and `components/agent/DraftMessageDialog.tsx:42` are *unrelated* local state (chat reply language, WhatsApp draft language) — they do not drive the app locale, which is its own consistency trap: three different "language" concepts with three different controls.
- **Fix:** Put the global toggle in the public site header/footer too, and persist the choice (localStorage + `<html lang>`). Rename the two local ones ("Reply in", "Draft in") so they don't read as app-language controls.

---

## 2. Typography — the presbyopia problem

### [SEVERITY: High] Sub-14px text is the app's default body size, not an exception
- **Scale:** 753 occurrences of `text-xs` (12px) across 130 of 225 files. Plus 386 hits of explicit `text-[10px]`–`text-[13px]`.
- **Where:**
  - `components/admin/AdminAgents.tsx:115-121` — a 7-column table whose headers are `text-[11px] sm:text-[10px]`, i.e. the text gets *smaller* on larger screens (the `sm:` breakpoint is min-width, so 10px is the desktop size and 11px the mobile one — almost certainly an inverted intent).
  - `components/admin/AdminAgents.tsx:213` — `text-[11px] sm:text-[10px]` on an "Empanelled Insurers" section heading.
  - 130 files is over half the codebase; `text-xs` is being used for real content (labels, values, statuses, helper copy), not just decoration.
- **Problem:** 10–12px on a budget Android in daylight is unreadable for a 40+ user with presbyopia. This is the single most repeated violation of the project's own stated design lens ("big, high-contrast").
- **Fix:** Raise the floor. Set `text-xs` to 13px and `text-sm` to 15px in the Tailwind theme (one config change lifts all 753 sites at once), then hunt the 386 arbitrary `text-[Npx]` values and delete anything below `text-[13px]`. Fix the inverted `sm:` in `AdminAgents.tsx` while you're there.

---

## 3. Colour contrast

Palette (`index.css:52-56`):
```
--color-text-main:      #0F172A
--color-text-secondary: #334155
--color-text-muted:     #64748B
```
`--color-text-muted` `#64748B` on white is **4.76:1** — it scrapes past WCAG AA for normal text (4.5:1) but *fails* AA when combined with the sub-14px sizes above at bold-adjacent weights, and fails AAA outright. On a tinted card background it drops below 4.5:1.

### [SEVERITY: High] `text-slate-400` is used 341 times and fails contrast on light backgrounds
- **Scale:** 341 occurrences of `text-slate-400` (`#94A3B8`), plus 57 `text-gray-400` (`#9CA3AF`), 56 `text-gray-500`, 33 `text-muted-foreground`.
- **Where:** all four below confirmed to sit on **white/near-white** backgrounds, not dark panels:
  - `components/admin/AdminAgents.tsx:115-121` — table headers, `text-slate-400` at 10px, inside a `bg-white rounded-3xl` card (`:110`). The compounding worst case: 2.85:1 *and* 10px.
  - `pages/GrievanceOfficer.tsx:150,154` — `text-xs text-gray-400` on the **field labels** "Name" and "Designation" of the statutory grievance-officer contact block. This is legally-required contact information rendered at 12px / 2.84:1.
  - `pages/CookiePolicy.tsx:89,96` and `pages/GrievanceOfficer.tsx:130,137` — "Last updated", "DPDP Act 2023 — Section 13", section headings.
  - `pages/agent/SettingsNew.tsx:153,157,168,192,196` — every form label on the Settings page is `text-[11px] sm:text-[10px] … text-slate-400`.
- **Problem:** `#94A3B8` on white is **2.85:1** — a clear WCAG AA failure for any text size. `#9CA3AF` (`text-gray-400`) on white is **2.84:1**, equally failing. 341+57 = ~398 sites where text is effectively invisible in daylight to the target demographic. Where these sit on dark navy panels they're fine; the failures above are all light-background. Note the pattern that makes this severe: the class is being applied preferentially to **labels and column headers** — the exact text a user needs to parse a form or table — while values get the darker treatment. The DPDP/grievance pages are a compliance concern as well as a usability one.
- **Fix:** Ban `text-slate-400`/`text-gray-400` on light backgrounds — the lightest acceptable slate on white is `text-slate-500` (`#64748B`, 4.76:1), and for 40+ users `text-slate-600` (`#475569`, 7.5:1) should be the muted default. Keep the 400-weights only for text on `navy-900`/`blue-800` panels. Worth an automated check since the two contexts share the same class name.

---

## 4. Feedback consistency

### [SEVERITY: High] Two toast systems are installed, and the second one's toasts are silently swallowed
- **Scale:** `useToast` (shadcn) used in 24 files; `sonner` used in 1 file. Only the shadcn `<Toaster />` is mounted.
- **Where:**
  - `App.tsx:5` imports `@/components/ui/toaster`, mounted at `App.tsx:137`.
  - `components/ui/sonner.tsx` exists and exports a `Toaster`, but **it is never imported by any page or by `App.tsx`** (verified: the only `sonner` references in the whole tree are its own definition file and one consumer).
  - `pages/hospitals.tsx:15` imports `{ toast } from "sonner"`, and `pages/hospitals.tsx:86` calls `toast.error("You can compare up to 4 locations at a time")`.
- **Problem:** **Confirmed dead feedback path.** A user on the Hospitals page who tries to compare a 5th location gets *no message at all* — the selection just silently refuses. The error is written, dispatched into an unmounted Sonner root, and discarded. Beyond this one bug, shipping two toast libraries means two visual languages for the same concept.
- **Fix:** Delete `components/ui/sonner.tsx` and the `sonner` dependency; convert `pages/hospitals.tsx:86` to `useToast`. (Mounting Sonner instead would fix the bug but institutionalise the inconsistency.)

### [SEVERITY: High] Native `alert()` / `confirm()` used for destructive and error flows
- **Scale:** 8 call sites across 5 files.
- **Where:**
  - `pages/agent/ClaimDetail.tsx:794` — `window.confirm("Delete "<doc>"? This cannot be undone.")` gating a **document deletion**.
  - `pages/agent/ClaimDetail.tsx:1362` — another `window.confirm` gate.
  - `pages/agent/PoliciesNew.tsx:207` — `alert("Delete failed. Please try again.")`; `:238` — `alert(e instanceof Error ? e.message : …)`.
  - `components/agent/SwitchModal.tsx:80` — `alert('Link copied to clipboard!')`; `components/PolicyAuditReport.tsx:113` — `alert('Sorry — we could not generate the PDF just now…')`.
  - `components/calculator/CoverCalculator.tsx:304` — `confirm("You have unsaved progress…")` on mount.
- **Problem:** Native dialogs are unstyled, untranslatable (they bypass i18n entirely, so a Hindi user gets English), unbrandeded, block the JS thread, and on Android render as a jarring OS chrome sheet with tiny buttons. `PoliciesNew.tsx:238` additionally surfaces a **raw thrown `Error.message`** to the user — likely to read as a stack-ish network string. Worst of all, the app already has `components/ui/confirmation-dialog.tsx` built and unused for exactly this.
- **Fix:** Replace all 8 with `confirmation-dialog.tsx` (for the 3 confirms) and `useToast` (for the 5 alerts). The clipboard one at `SwitchModal.tsx:80` should be a passive toast, never a modal.

### [SEVERITY: Medium] Raw error strings leak to the UI
- **Scale:** 17 references to `error.message` in `.tsx`; 2 render it directly into JSX.
- **Where:** `pages/agent/PoliciesNew.tsx:238`.
- **Problem:** Backend/browser exception text ("Failed to fetch", "Unexpected token < in JSON…") shown verbatim to a 40+ agent is meaningless and alarming.
- **Fix:** Map to a small set of human messages; log the raw one.

---

## 5. Loading consistency

### [SEVERITY: Medium] Three competing loading treatments, unevenly distributed
- **Scale:** spinner (`Loader2` / `animate-spin`) in 49 files; `Skeleton` in 10 files; literal `"Loading..."` text in 2 places; and an unknown number of fetches with no indicator.
- **Where:** the 49-vs-10 split is the finding — spinner is the de-facto default, skeletons appear in only 10 files, so the same kind of list renders differently depending on which page you're on.
- **Problem:** Perceived-performance inconsistency. A centred spinner on a data-heavy page reads as "frozen" to a non-technical user, where a skeleton reads as "arriving". Mixing them within one product makes load behaviour feel unpredictable.
- **Fix:** Pick one rule and write it down — skeletons for content regions with known shape (lists, tables, cards), spinner only for in-button submit states, and delete the two bare `"Loading..."` strings.

---

## 6. Forms

### [SEVERITY: High] There is effectively no shared form stack — validation is ad-hoc `useState` everywhere
- **Scale:** `react-hook-form` is imported by exactly **1** file, and that file is the unused shadcn primitive `components/ui/form.tsx`. `zod` appears in exactly **1** file in the whole `src` tree: `lib/validation/calculator-validation.ts`. Meanwhile there are **194** `<Input>`/`<input>` elements.
- **Where:** `components/ui/form.tsx` (the RHF wrapper — dead code, no consumers), `components/ui/form-field.tsx`, `lib/validation/calculator-validation.ts` (the sole zod schema, calculator-only).
- **Problem:** 194 inputs across auth, upload, customer, lead, claim, profile, and settings flows are each hand-rolling their own state, their own validation trigger, and their own error rendering. This is the root cause of *inconsistent validation timing* — some fields will validate on change, some on blur, some only on submit, and errors will appear in different places with different styling on every screen. For a 40+ user filling a multi-field customer form, unpredictable error behaviour is a completion-rate killer.
- **Fix:** Adopt the already-present `react-hook-form` + `zod` stack for real. Migrate the highest-traffic forms first (signup/login, add-customer, add-lead, claim intake). Standardise on validate-on-blur + validate-on-submit, errors rendered inline below the field, never as a toast.

---

### [SEVERITY: High] Labels are never programmatically associated with their inputs
- **Scale:** 194 inputs app-wide; `<Label>`/`<label>` appears 159 times but the association is broken in the files sampled. Zero use of the `htmlFor`/`id` pairing.
- **Where:**
  - `pages/agent/SettingsNew.tsx:153-154`, `:157-158`, `:168-169`, `:192-193`, `:196-197` — every one is a bare `<label className="…">Full Name</label>` followed by a **sibling** `<Input>`. No `htmlFor`, and the label does not wrap the input, so there is no programmatic link at all. Includes the two password fields ("New Vault Password", "Confirm Credentials").
  - Same bare-sibling-`<label>` pattern in `pages/agent/MyPage.tsx`, `pages/agent/PolicyDetail.tsx`.
- **Problem:** A screen reader announces these as "edit text, blank" with no name — the user cannot tell which field they are in. It also kills the click-label-to-focus-field affordance, which matters disproportionately for older users with imprecise touch. The app has a `<Label>` component (`components/ui/label.tsx`) that would handle this; it's being bypassed in favour of raw `<label>`.
- **Fix:** Use the shadcn `<Label htmlFor="x">` + `<Input id="x">` pairing, or wrap. This is mechanical and worth doing in one sweep across all 194 inputs.

### [SEVERITY: High] Placeholder-as-label — the label vanishes as soon as the user types
- **Scale:** 4 files with `<Input>` and no `<Label>`/`aria-label` anywhere in the file: `pages/agent/CustomerDetail.tsx` (5 inputs), `pages/agent/SettingsNew.tsx` (5), `pages/agent/PolicyDetail.tsx` (4), `pages/agent/MyPage.tsx` (2).
- **Where:** `pages/agent/CustomerDetail.tsx:234-238` — the entire customer edit form is five inputs whose only naming is a `placeholder`: `"Full name *"`, `"Phone"`, `"Email"`, `"City"`, `"Notes"`.
- **Problem:** Placeholder text disappears on first keystroke. Reviewing or correcting a half-filled customer form, the user faces five unlabelled boxes and has to clear a field to remember what it was. Placeholder text is also rendered in the browser's low-contrast placeholder grey, so it fails contrast even while visible. Critically, at `:234` the **required-field marker `*` lives only in the placeholder** — once the user types, the only signal that Name is mandatory is gone.
- **Fix:** Add persistent visible labels above each input (properly associated per the finding above). Keep placeholders only for format hints ("e.g. 98765 43210"), never as the field name, and move the required marker into the label.

---

## 7. Accessibility

### [SEVERITY: Medium] `focus:outline-none` without a replacement ring — keyboard focus disappears
- **Scale:** 43 occurrences; **37 of them are outside `components/ui/`** (i.e. in app code, not in shadcn primitives which legitimately pair it with `focus-visible:ring`).
- **Where:**
  - `pages/calculator-report.tsx:37` — `focus:outline-none` on an interactive info toggle with **no** `focus:ring` / `focus-visible:` replacement. Confirmed: the class list ends at `transition-colors focus:outline-none`.
  - `pages/hospitals.tsx:240` and `pages/hospitals.tsx:299` — these two *do* substitute `focus:border-[var(--color-teal-600)]`, which is a weaker but non-zero indicator; a border-colour change alone is a low-contrast focus signal.
- **Problem:** Keyboard and switch-access users lose all track of position. `calculator-report.tsx:37` is the clean violation — focus becomes completely invisible.
- **Fix:** Never ship bare `focus:outline-none`. Pair every instance with `focus-visible:ring-2 focus-visible:ring-offset-2`. A quick grep gate in CI catches regressions.

### [SEVERITY: Medium] No skip-to-content link
- **Scale:** 1 weak match, no real implementation.
- **Problem:** Screen-reader and keyboard users must tab through the full nav on every page load. On the agent portal with its sidebar, that's a long trip repeated on every navigation.
- **Fix:** Add a visually-hidden-until-focused `<a href="#main">` as the first focusable element in `App.tsx`, and give the main content region `id="main"`.

### [SEVERITY: Low] A handful of icon-only buttons lack `aria-label`
- **Scale:** 6 `size="icon"` buttons total; 2 confirmed missing a label. 71 `aria-label`s exist app-wide, so the pattern is *mostly* being followed.
- **Where:**
  - `components/Tabs.tsx:79` and `components/Tabs.tsx:89` — the tab scroll-left / scroll-right chevron buttons. Both are `size="icon"` with only a `<ChevronLeft/>` / `<ChevronRight/>` child and **no** `aria-label`.
  - Counter-example done correctly: `components/agent/ShareLinkPopover.tsx:50` has `aria-label="Share link"`.
- **Problem:** Announced as "button" with no name. Low severity only because it's 2 sites and they're supplementary scroll affordances, not primary actions.
- **Fix:** Add `aria-label="Scroll tabs left"` / `"…right"`.

### [SEVERITY: Low] `onClick` on non-interactive `<div>`/`<span>`
- **Scale:** 6 occurrences across 3 files — small enough that this is a spot fix, not a systemic pattern.
- **Where:** `components/agent/LeadPoliciesSection.tsx`, `pages/agent/ClaimDetail.tsx`.
- **Problem:** Not keyboard-reachable, not announced as actionable.
- **Fix:** Convert to `<button type="button">`, or add `role="button" tabIndex={0}` plus an Enter/Space handler.

---

## 8. Leftovers

### [SEVERITY: Low] Stray `console.log` in shipped code
- **Scale:** 6 occurrences.
- **Problem:** Minor — noise in the browser console, and a small risk of logging user/policy data on a shared machine.
- **Fix:** Strip via build config (`esbuild.drop` / terser `drop_console`) rather than hand-deleting.

**No `TODO`/`FIXME`/`HACK` comments in any `.tsx`** — 0 hits. Clean.

---

## Verified non-findings (do not re-audit)

These were investigated and came back clean; recording them so the finding list stays honest.

- **Responsive / fixed widths — clean.** The 29 hits for `w-[NNNpx]` above 360px are almost entirely `max-w-[…]` (a *cap*, not a floor — safe on a 375px phone) or breakpoint-gated (`sm:w-[450px]`). `components/ui/dialog.tsx:44` correctly uses `w-[calc(100%-2rem)] max-w-[400px]`. `components/SachAIChat.tsx:287` correctly uses `w-[95vw] md:w-[400px]`.
- **Tables — clean.** All 5 `min-w-[NNNpx]` hits are `md:`-gated and paired with the `table-cards` class (`pages/advisors-pricing.tsx:294`, `pages/agent/DashboardNew.tsx:566,687,763`, `pages/pricing.tsx:218`), so they collapse to cards on mobile rather than overflowing. 25 `<table>` elements vs 28 `overflow-x-auto` containers — coverage is adequate.
- **Image alt text — clean.** 13 `<img>` tags, 0 without `alt`.
- **Top-level error boundary — present and good.** `App.tsx:11` imports it, wrapping the entire router at `App.tsx:131-312`. `components/ErrorBoundary.tsx` implements both `getDerivedStateFromError` and `componentDidCatch`, and renders a real branded fallback ("Something went wrong" + retry + home) rather than a white screen. A second scoped boundary guards the calculator (`components/CalculatorErrorBoundary.tsx`, used at `components/calculator/CoverCalculator.tsx:594`). **No white-screen-of-death risk.**
- **Tap targets — mostly fine.** 0 matches for `h-6`/`h-7`/`h-8` on elements carrying `onClick` or `Button`. Only 6 `size="icon"` and 29 `size="sm"` in the entire app, and the icon buttons sampled (`ShareLinkPopover.tsx:50`, `Tabs.tsx:79/89`) use `h-8 w-8` or `h-12` — 32px is below the 44px ideal but these are secondary affordances, not primary CTAs. Not a systemic failure.
- **Hindi dictionary completeness — clean.** `en.json` and `hi.json` both have exactly 310 keys at 320 lines. The translation *file* has no gaps; the gap is entirely in adoption (see Finding 1).

---

## Summary table

| # | Severity | Finding |
|---|----------|---------|
| 1 | Critical | Hindi reaches only 8/225 files — public site + consumer portal English-only |
| 2 | High | Language toggle undiscoverable outside agent shell |
| 3 | High | 753 `text-xs` + 386 sub-14px arbitrary sizes carrying real content |
| 4 | High | `text-slate-400`/`gray-400` ×398 — 2.85:1 contrast, fails WCAG AA |
| 5 | High | Two toast systems; Sonner never mounted → confirmed silent dead error path |
| 6 | High | 8 native `alert()`/`confirm()` incl. destructive delete gates; bypass i18n |
| 7 | High | No shared form stack — 194 inputs, RHF+zod present but unused |
| 8 | High | Labels never associated with inputs (`htmlFor` used nowhere) |
| 9 | High | Placeholder-as-label in 4 files; required `*` vanishes on typing |
| 10 | Medium | Raw `error.message` rendered to users |
| 11 | Medium | Three loading treatments (49 spinner / 10 skeleton / 2 text) |
| 12 | Medium | 37 app-code `focus:outline-none`, at least one with no replacement ring |
| 13 | Medium | No skip-to-content link |
| 14 | Low | 2 icon-only buttons without `aria-label` (`Tabs.tsx:79,89`) |
| 15 | Low | 6 `onClick` on `<div>`/`<span>` across 3 files |
| 16 | Low | 6 stray `console.log` |

**Totals: 16 findings — 1 Critical, 8 High, 4 Medium, 3 Low.**

### Cross-theme observation

Three of the High findings converge on the same screen. `pages/agent/SettingsNew.tsx:153` is a single line that is simultaneously (a) 10px text, (b) `text-slate-400` at 2.85:1, (c) a `<label>` with no `htmlFor`, and (d) untranslated English under a Hindi-enabled shell. The agent-portal form pages are where the systemic issues compound worst, and they are exactly the screens the 40+ target user spends the most time in. If effort is limited, fixing the form pages fixes four themes at once.
