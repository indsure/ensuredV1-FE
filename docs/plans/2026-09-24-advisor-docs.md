# Advisor docs at /docs (T2)

Worktree `E:\Indsurefi\_wt-help`, on top of `pr-6` @ 05cc722. Ships to beta only.

## 1. Goal

One shareable link (indsure.in/docs) that answers everything an advisor would ask, from "what is
this" to FAQs: onboarding, every screen explained with real screenshots, in simple English. It lives
in the site footer, so anyone we talk to has a reference point. Model: a GitBook help centre.

## Scope (locked)

- **Content as data** `client/src/docs/content.ts`: sections → pages → blocks (paragraph, heading,
  numbered steps, bullets, screenshot, tip/note/warning callout, FAQ list, related-page links). Plain
  data with no React imports, so `scripts/prerender.mjs` can bundle it with esbuild like blog data.
  Inline `**bold**` and `[text](/path)` only.
- **Docs shell** `pages/docs.tsx`, routes `/docs` and `/docs/:slug`:
  - site Header/Footer
  - a left sidebar of sections (sticky on desktop, a "Menu" drawer on phones)
  - search across page titles and text (client side)
  - an "On this page" list on wide screens
  - previous/next links and a "Copy link" button on every page and heading
  - an unknown slug renders the site's 404
- **Pages (about 25)**:
  - **Getting started:** Welcome, Create your account, Tour of the portal, Try the demo
  - **Customers and leads:** Customers, Leads, Renewals, WhatsApp messages
  - **Policies:** Check a policy, Read the report, Share with customers, Needs Attention, Policies list and Excel
  - **Tools:** Compare, Cover Calculator, Surrender value, Rider Directory, Claims, Insights
  - **Grow:** My Website, Team
  - **Account:** Settings and language, Plans and policy checks, Your data, FAQ, Get help
- **Screenshots** of the real portal captured from the playground (sample data only), by a script
  kept in the repo at `frontend/scripts/capture-docs-screens.mjs` so they can be re-shot when the UI
  changes. Desktop 1280x800 and a few phone 390x844, both at 2x, encoded to WebP by Chromium.
  Banner, chat bubble and tour hidden. Stored in `client/public/docs/`.
- **Links**: footer ("Advisor docs"), `/agent/help`, `/advisors/how-to-use`. (The `/agent` landing nav was left alone: it already carries five links.)
- **SEO**: every docs page prerendered with its own title, description, h1 and FULL article text in
  the static body; all in the sitemap.
- **English only.** Site chrome (header/footer) follows the language toggle; the docs body is English
  and the page says so in Hindi, the same pattern as blog and legal pages.

**Out of scope:** best practices (founder content), video, a CMS, feedback widgets needing a backend.

## 2. Claims Ledger

Rule: describe only what a screen shows today, name buttons by their English label, and quote no
prices. Pricing lives on /advisors/pricing and the docs link there.

| Claim area | Source |
|---|---|
| Invite code required to sign up; "Request access" goes to /agent | `SignupStep1.tsx`, `signup.need_invite` |
| Sign-up steps: individual/agency, details, password rules, empanelment | `signup.*`, `signup2.*` |
| No email confirmation step | Supabase `/auth/v1/settings`: `mailer_autoconfirm: true` (read 2026-09-24, critique #5) |
| Free plan free forever, no card; checks vs data entry are separate allowances; upgrades via WhatsApp (no checkout) | `advp.a1`, `advp.a2`, `advisors-pricing.tsx` CTA comment |
| No commission, not a broker | `advp.a9` |
| Data: isolation per advisor, access audit log, retention | `DATA_PROTECTION.md` sections 1-4, and only what those say |
| Every feature description | the screen itself, captured and read while writing |

## 3. Blast Radius

Footer gains a link on every public page. `/advisors/how-to-use` stays as the short version and
links to the docs for detail. main has the SEO allowlist + PAGE_SEO (see the help-and-tour plan):
every `/docs/*` path must be added there at the next pr-6 → main merge, or main's build fails.

## 4. Unhappy paths

Unknown slug · deep link to a heading anchor · 375px (drawer, images scale, no sideways scroll) ·
search with no match · slow image load (fixed aspect ratio, lazy) · Hindi toggle (chrome only).

## 5. Reversibility

Static pages and images. Revert the commit.

## 6. Founder decisions

None needed to ship. Pricing numbers deliberately not restated. Best practices still pending.

## Finalize: critique decision log (independent critic, 2026-09-24)

| # | Finding | Resolution |
|---|---|---|
| 1 | `advp.a1` says a two-policy comparison costs 1 check; routes.ts `COMPARE_COST = 2`, catalogue compare free | **Fixed in docs** (sourced from routes.ts:3446 and the Compare Quotes screen, which says "Uses 2 policy checks"). **Escalated:** `advp.a1` on /advisors/pricing is itself wrong; flagged to the founder, not changed here. |
| 2 | DATA_PROTECTION.md mixes shipped and unconfirmed claims | **Fixed.** /docs/your-data states only: per-advisor isolation (section 1), never sold or shared (stated principle), HTTPS, unguessable share links showing a subset (section 6), Download my data (visible in Settings), team access log (visible in Team). No retention periods, no 24-hour deletion, no audit-log claim. |
| 3 | Seed data borrows real insurer, plan, hospital, TPA names beside invented scores; real-format phones and policy numbers | **Fixed.** Capture script rewrites them in the page before each screenshot (Sample Insurer A, Sample Plan A, Sample Hospital, Sample TPA, +91 90000 00000, SAMPLE/0000, SAMPLEUIN0000), and every image carries a "Sample data" badge. Verified by eye on report, compare, claims, renewals, customers. |
| 4 | Share links print localhost | **Fixed.** Capture script swaps the host for indsure.in (checked on the report and My Website shots). |
| 5 | Email confirmation unknown | **Fixed.** Read the public auth settings endpoint: `mailer_autoconfirm: true`. Docs say there is no email to confirm. |
| 6 | Hindi users see English docs | **Accepted with mitigation.** Body stays English (as blog/legal); a Hindi note appears when the site is in Hindi; Portal tour page says buttons sit in the same places with Hindi names. |
| 7 | Footer needs en+hi keys | **Fixed.** `site.f_docs` in both. |
| 8 | Soft 404 on this branch; main allowlist must list slugs | **Accepted** for beta (pr-6 still has the catch-all). The React route renders the real 404 page for an unknown slug (verified). At the main merge, list each /docs slug, never a wildcard. |
| 9 | Prerender needs own sitemap loop, relative imports, full text | **Fixed.** content.ts is pure data; esbuild bundles it; 27 pages written with the whole article, breadcrumb + FAQPage JSON-LD; sitemap rows added. Titles <= 60, descriptions <= 160 with "IndSure", checked by script. |
| 10 | Screenshots go stale silently | **Accepted.** Re-capture script lives in the repo; "Updated" date on every page; content.ts header says to re-read pages after re-shooting. No guard rule (file mtimes are not reliable in a git checkout). |
| 11 | Legibility on phones; heavy images; Sach bubble | **Fixed.** 18px body; every screenshot opens full size on tap; 1x and 2x WebP via srcset (1x set ~1.4 MB total); Sach hidden on /docs; drawer above the mobile nav; bottom padding for it. |
| 12 | Missing help/troubleshooting/last-updated/print | **Fixed.** Get help (WhatsApp + email + grievance), Troubleshooting page (invite code errors, session expired, uploads, empty renewals, WhatsApp), "Updated" date, print styles hide chrome. **Accepted:** search matches English words only. |

Also found while shooting: the Renewals card drafts with a ✍️ icon, and "Renewal reminder" is only offered for
customers' policies. Corrected the earlier how-to guide (`aguide.g_renewals_s3`), the tour line
(`tour.renewals_d`), and the upload step now says to choose the policy type first (`aguide.g_check_s2`).
