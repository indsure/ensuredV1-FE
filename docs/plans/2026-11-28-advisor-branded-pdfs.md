# Advisor-branded report PDFs (2026-11-28)

Tier: T2 (personal data on a shared link, goes to beta then prod).

## Goal
Every PDF that leaves the advisor portal looks like the advisor's own document: the advisor's
name and photo (from My Page) at the top, and IndSure only once, at the bottom of each page:
"~researched by IndSure".

## Surfaces (all four)
1. Policy audit PDF, advisor policy page (`pages/agent/PolicyDetail.tsx` -> `PolicyAuditReport` -> `PolicyPDFDocument`).
2. Policy audit PDF, shared link the client opens (`pages/SharedReport.tsx`, backend `GET /api/shared/report/:token`).
3. Cover calculation PDF, advisor calculator (`pages/agent/AgentCalculator.tsx` -> `CalculatorPDFDocument`).
4. Cover calculation PDF, shared calculator link (`pages/calculator-report.tsx`, backend `GET /api/calculator/report/:uuid`).

Consumer (D2C) downloads are unchanged: no advisor -> today's IndSure document.

## Design
- `PdfBrand = { name: string; photo: string | null }` (photo is a data URL, already fetched).
- Both documents take optional `brand`. When set:
  - Masthead: round photo (or initials circle when no photo) + advisor name, date on the right. No IndSure logo.
  - Running header (page 2+): advisor name instead of "INDSURE ...".
  - Footer every page: "~researched by IndSure" left, page number right. Nothing else.
  - Every other "IndSure" string removed: closing "Prepared by IndSure" line -> "Prepared by <advisor> on <date>";
    calculator footer "IndSure sells no insurance and earns no commission" dropped (false for an advisor);
    calculator disclaimer drops "Consult a licensed insurance advisor" (they are the advisor).
  - PDF metadata title/author = advisor; file name has no "indsure" (`<client>_policy_report.pdf`, `<client>_cover_calculation.pdf`).
- Name source: `agent_pages.display_name`, else `agents.full_name`, else `agents.name`. Photo: `agent_pages.photo_url`.
- Photo fetched to a data URL before render (`lib/pdfBrand.ts`); any failure -> initials, never a broken download.
- Backend: both public endpoints add `advisor: { name, photo_url } | null` via LEFT JOIN on the row's `agent_id`.
  Additive field; prod frontend ignores it. No schema change.

## Claims ledger
| Claim | Source |
|---|---|
| Advisor name on PDF | agent_pages.display_name / agents.full_name of the row's agent_id |
| Photo | agent_pages.photo_url (public bucket, uploaded by the advisor) |
| "~researched by IndSure" | founder wording, 2026-11-28 |

## Blast radius
- Shared links now reveal the advisor's name + photo to whoever holds the link. The advisor sent the link, and the photo bucket is already public. No phone, no slug.
- Web pages (shared report page, calculator report page) still show IndSure branding. Out of scope (downloads only); flag as follow-up.
- Backend change needs an EC2 splice (one backend serves prod + beta).

## Decisions
- Whose name: the person handing the report over. In the portal that is the signed-in advisor
  (RLS only lets them read their own My Page). On a share link it is the row's agent_id, and the
  share route only lets the owner create the link, so sender == owner there too. An agency owner
  downloading a member's policy in the portal gets the owner's letterhead.
- No usable name anywhere (page, full_name, name all blank) -> the IndSure document, never a blank letterhead.
- "Bottom of the page" = the footer line on every page.

## Verified 2026-11-28
- Node render from a real stored 1.6.0 audit + engine output: branded PDFs carry "IndSure" exactly once
  per page (footer), metadata is the advisor's; unbranded PDFs are text- and metadata-identical to pr-6.
- Browser (playground): avatar from a real image, initials fallback on a dead URL, Devanagari name drawn
  correctly; real "Download Report" produced `<client>_policy_report.pdf`, Info dict = advisor.
- tsc frontend: no new errors. Backend `npm run check` (real TypeScript, deps installed): only the pre-existing corporateRoutes.ts:197 error, identical before/after.
- Cross-origin JPEG (CORS *) -> round photo avatar, not initials. Supabase advisor-photos bucket answers Access-Control-Allow-Origin: *.
- 60-char advisor name + long insured list: masthead wraps, running header clipped to one line each side.
- guard PASS; full `npm run build` incl. prerender PASS.
- NOT verified: share-link endpoints against a real DB (needs the EC2 splice); portal calculator and both share pages not clicked.

## Unhappy paths
- No My Page row -> name from agents, initials.
- Photo 404 / CORS / timeout (5 s) -> initials.
- Advisor name very long -> wraps, does not overflow.
- Deleted agent -> advisor null -> IndSure document.

- 2026-11-28 founder ran the count on live Supabase: 0 audit reports and 0 calculator reports contain "IndSure" in their stored text.
