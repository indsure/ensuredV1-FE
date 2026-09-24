# Advisor help pages + playground guided tour (T2)

Branch `help-and-tour`, worktree `E:\Indsurefi\_wt-help`, cut from `origin/pr-6` @ 19c8493. Ships to beta only.

## 1. Goal

An advisor, or someone deciding whether to become one, can read what every portal tool does and
how to use it (publicly and inside the portal), and a playground visitor gets walked through the
product step by step instead of being dropped on a dashboard.

## Scope (locked)

1. **Shared content** `client/src/lib/advisorGuide.ts`: the feature list and the how-to guides as
   data (i18n keys + the real `/agent/*` route each one lives at). One source, rendered twice.
2. **Shared components** `client/src/components/advisor-guide/FeatureGrid.tsx` and `HowToGuides.tsx`.
   Prop `mode: "public" | "portal"`. Portal links go to the real route. Public links go to
   `/agent/playground?go=<route>` ("See it in the demo").
3. **Public pages** `/advisors/features` and `/advisors/how-to-use` (siblings of `/advisors/pricing`),
   `Header`/`Footer` shell like the pricing page. Added to App.tsx, prerender `STATIC_ROUTES`, and the
   sitemap. Linked from the `/agent` landing nav (desktop row and the mobile second row).
4. **Portal page** `/agent/help` inside `AgentLayout`, two tabs (Features, How to use) via `?tab=`.
   Nav: a "Help" link in the Account block above Settings (reachable on mobile through the drawer
   that the tab bar's More button opens). In playground mode it also shows a "Take the tour" button.
5. **Guided tour** `client/src/components/agent/PlaygroundTour.tsx` + step data in
   `client/src/lib/playground/tour.ts`. Mounted in `AgentLayout`; renders nothing unless
   `isPlaygroundMode()`.
   - Entering the playground shows a welcome card: "Take the 2-minute tour" / "Explore on my own".
   - Steps: Dashboard, Check a Policy (uploads), a policy report (`pol-1`), Compare, Leads,
     Renewals (WhatsApp drafter), My Website, Finish (sign-up CTA).
   - Each step navigates to its route and shows a card: title, 1-2 plain sentences, "Step n of N",
     Back / Next / Skip. Desktop: optional ring highlight on the matching sidebar link, found by
     `a[href="<route>"]`, so no page component needs a `data-tour` attribute. If the target is
     absent (mobile, collapsed rail) there is no highlight, just the card, docked to the bottom on
     phones above the tab bar.
   - Tour position lives in sessionStorage (`indsure_playground_tour`), a step index only, never
     personal data. Survives refresh and route changes; cleared on Skip/Finish/Exit demo.
   - Banner gets a "Take the tour" button to restart.
   - `PlaygroundEntry` accepts `?go=` (allowlisted to known `/agent/*` routes, otherwise dashboard;
     no open redirect) and `?tour=1` to start the tour directly.
6. **i18n**: every new string in `en.json` and `hi.json` in the same commit.

**Out of scope:** Best practices page (founder wants it last, content to come from them). No new
tables, endpoints, or migrations. Reconciling pr-6 with main (see Blast Radius).

## 2. Claims Ledger

Every feature card and how-to step describes a route that exists today in App.tsx on pr-6, using the
button labels those screens already show. No numbers, prices, counts, testimonials or time claims,
except "2-minute tour" (8 short cards, a reading estimate, not a product promise).

| Claim | Source of truth |
|---|---|
| Check a policy: drop PDFs, press Check, report opens | `AgentUploads.tsx`, `uploads.drop_prompt`, `uploads.check_btn`, `uploads.view_results` |
| Password-protected PDFs must be unlocked first | `uploads.consent_title` flow |
| Share a report with the customer by link | `policy_detail.share_report` |
| Compare up to 4 catalogue plans; upload two wordings for others | `compare.cat_subtitle`, `compare.subtitle`, routes `/agent/compare`, `/agent/compare/quotes` |
| Save & share a comparison | `compare.save_share` |
| Leads have statuses New, Contacted, Interested, Won, Lost | `leads.status_*` |
| Renewals lists leads' policies by due date, soonest first (corrected by critique #6) | `LeadRenewals.tsx` buckets overdue / week / month / later, `lib/leadPolicies.ts` |
| Draft a WhatsApp message in a few ready kinds, WhatsApp opens, you tap send | `drafter.*`, used in Leads, Renewals, Policies |
| Export policies to Excel | `policies.export_excel` |
| Claims desk tracks health claims by status | `claims.status_*` |
| Cover Calculator produces a report you can send | landing `cap_calc_desc` (already public) |
| Surrender values for life policies | `pv.subtitle` |
| My Website: fill details, Publish, share link / Download QR | `mypage.publish`, `mypage.download_qr` |
| Insights: renewals by month, product mix, what checks found | `insights.*` |
| Needs Attention lists policies still processing or failed | `AgentLayout` queue query (`status in error,processing,pending`) |
| Team (agency owners) | `/agent/team`, nav shown only to owners |
| Rider Directory | `riders.subtitle` (no count quoted) |
| Checks and data entry are metered by plan | `uploads.uses_one_check`; copy says "your plan", links to /advisors/pricing, quotes no numbers |

House copy: no "AI", no "credits", no em dashes, simple English.

## 3. Blast Radius

- `/agent` landing nav gains links; nothing it says becomes false.
- `vercel.json` on pr-6 still has the catch-all rewrite, so the new public URLs resolve on beta.
  **main has since replaced it with an allowlist and a prerender check that fails the build for any
  App.tsx route that is neither prerendered nor allowlisted, and a single `data/seo-pages.ts` SEO
  table.** pr-6 and main have diverged (18 conflicting files, Hindi vs SEO work, both 2026-09-24).
  When pr-6 next merges to main, `/advisors/features` and `/advisors/how-to-use` need PAGE_SEO
  entries and `/agent/help` needs the app allowlist. Titles written now to main's limits
  (title <= 60, description <= 160, contains "IndSure") so the port is a copy.
- Existing `/help` (consumer FAQ) untouched; the new pages are advisor-specific. The portal Help page ends with a WhatsApp link to the team (`teamWaLink`).
- Playground: the tour only reads routes; if a seeded screen rots, the tour card still renders.

## 4. Unhappy paths

Refresh mid-tour (resumes the same step) · browser Back during tour (card follows the step, not the
URL; Back keeps working) · visitor clicks elsewhere mid-tour (card stays; Next returns them to the
step route) · 375px (card docks bottom above tab bar, 44px targets) · sidebar collapsed (no
highlight, card only) · Hindi toggle mid-tour · `?go=` with a junk or external value (falls back to
dashboard) · Exit demo mid-tour (tour state cleared) · tour never shown to a real signed-in advisor.

## 5. Reversibility

Read-only surfaces. Writes nothing but one sessionStorage key. Revert = revert the branch.

## 6. Founder decisions

- Resolved in chat 2026-09-24: features public AND in portal; best practices deferred; push to beta.
- None open for this scope. Best practices content will need the founder.

## Finalize: critique decision log (independent critic, 2026-09-24)

| # | Finding | Resolution |
|---|---|---|
| 1 | Finish "sign up" would hit the mock backend | **Fixed.** `endTour(); exitPlayground();` then a hard `window.location.href` to `/agent/signup/step1`. Verified: lands with both keys cleared. |
| 2 | Welcome card could reappear | **Fixed.** Only `PlaygroundEntry` sets `"welcome"`; Explore/close clear it. Verified: reload after Explore shows nothing. |
| 3 | Mobile anchors exist off-screen; logo matches dashboard href | **Fixed.** Lookup scoped to `aside nav`, logo excluded, ring only when the rect is on screen (both axes). |
| 4 | Targets appear after the group opens / chunk loads | **Fixed.** Ring re-measured every 500 ms and on resize. Verified on all 7 steps. |
| 5 | Back into `/agent/playground?tour=1` restarts the tour | **Fixed.** Entry redirects with `{ replace: true }`. |
| 6 | Renewals copy wrong (lead policies, not a 30-day list) | **Fixed.** Copy now says "your leads' policies coming up for renewal, soonest first", and the guide explains adding policies to a lead. |
| 7 | Prerender needs h1/intro; sitemap list | **Fixed.** STATIC_ROUTES entries with h1 + intro, two `writeSitemap` rows. `client/public/sitemap.xml` is overwritten by prerender at build, left alone. |
| 8 | Guard does not read locale JSON | **Fixed.** `pages/advisors-guide.tsx` added to `PUBLIC_PAGES`; a key check verified 291 keys in both locales, matching `{{vars}}`, no em dash / "AI" / "credit". |
| 9 | Sub-44px targets copied from neighbours | **Fixed** for every new control (`min-h-11`). **Accepted:** the two new links in the `/agent` landing nav rows copy the existing links' size; resizing that bar is out of scope. |
| 10 | Banner hardcoded, em dash, cramped at 375px | **Fixed.** Banner text moved to `playground.banner`/`playground.exit`; tour button is icon-only below `sm`. |
| 11 | Card layering vs drawer, tab bar, Sach bubble | **Fixed.** Card hidden while the drawer is open; `bottom-[76px]` above the tab bar below md; `md:bottom-24` clears the Sach bubble; z-55 so the bubble never covers Next. |
| 12 | Bounds, pol-1 deleted, exit clearing, go allowlist | **Fixed:** index bounds-checked; `exitPlayground()` clears the tour key; `?go=` is an exact-match set (junk and `/agent/playground` fall back to dashboard, verified). **Accepted:** if a visitor deletes pol-1 before step 3, that step shows the policy page's own not-found; the card and Next still work. |

Also found in execution: Hindi steps quoted English button names. Steps now take every button
label from the i18n key the button itself renders (`uiLabelVars`), so the guide reads the screen's
own words in both languages.
