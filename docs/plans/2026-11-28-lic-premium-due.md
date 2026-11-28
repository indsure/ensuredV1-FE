# LIC Premium Due + Commission sheet upload (T2)

Tier T2: new surface, new tables (migration 043), personal data (LIC client names, policy numbers).

## 1. Goal

An LIC agent uploads the monthly Premium Due PDF and the Commission (CM) PDF LIC gives them, and IndSure
shows who has not paid yet, how late they are, and lets the agent send a WhatsApp reminder.
Where it shows (founder, 2026-11-28): **Policies > LIC** (new type above Others) and **Home**. Not Services.

## 2. How the sheets work (from the real samples in E:/Policiestotest/LIC)

- **Premium Due list** (`Premdue-YYYYMM-<agent>.pdf`): one row per policy with an unpaid instalment, including
  arrears back several months. Columns: S.No, PolicyNo, Name, D.o.C, Pln/Tm, Mod (Yly/Hly/Qly/Mly), FUP (MM/YYYY,
  first unpaid premium), Flg (FY/ST/LP/MT), InstPrem, Due (instalments owed), GST, TotPrem, EstCom.
  Footer: `Grand Total Premium : N`.
- **Commission sheet** (`CM-<branch>-<date>-<agent>.pdf`): summary (first year / renewal / bonus commission,
  TDS, net payable) and annexure-A, one row per premium LIC adjusted: Name, PolicyNo, Pln-Tm (Tm = chosen term),
  DueDt (the instalment paid), Risk Date, CBO, Adj.Date, Premium, Commission. Comes in batches
  ("1st batch of 11/2026"). Footer: `Grand Total Premium : 7,36,021.00 Commission : 44,137.10`.
- Sample check by hand: 73 due, 19 matched as paid, 54 pending, Rs 25,33,124 pending; CM extras = 2 new policies +
  3 paid early. A correct implementation must reproduce exactly these numbers on the samples.

## 3. Design

### Data (migration 043, server-only tables, RLS on with no browser policies)

- `lic_uploads` (id, agent_id, kind `due|commission`, period `YYYY-MM`, batch, lic_agent_code, file_sha256,
  row_count, totals jsonb, created_at). Unique (agent_id, file_sha256): the same file twice is refused, kindly.
- `lic_due_rows` (upload_id FK ON DELETE CASCADE, agent_id, policy_no, holder_name, doc date, plan_no, lic_term,
  mode `Y|H|Q|M`, fup `YYYY-MM`, flag, inst_prem, due_count, total_prem, est_comm).
- `lic_paid_rows` (upload_id FK ON DELETE CASCADE, agent_id, policy_no, holder_name, plan_no, term, due_date,
  risk_date, cbo, adj_date, premium, commission).

### Reading the PDF (no AI, no OCR, zero cost)

pdf.js text items grouped into lines by y position, then one strict regex per row type. The parse is
**refused** unless the rows add up to the sheet's own Grand Total (premium, and commission for CM). That check is
the guard against a silently wrong read. A PDF with no text (a scan or photo) is refused with "upload the PDF
from the LIC agent portal". Wrong sheet type for the chosen option is refused.

### Matching (computed on read, never stored)

- The current list = the latest Premium Due upload (highest period, newest upload).
- A due row is **paid** when the agent's commission rows hold that policy number with DueDt from the FUP month up
  to the due-list month, and their premium adds up to at least TotPrem. Some but less = **part paid**.
  Any commission upload counts (arrears paid late show up in a later batch; early payers show up before).
- Unpaid rows get a status for today (IST): due date = D.o.C day in the FUP month (clamped to month end).
  **Due** (before due date), **In grace** (up to 15 days for monthly, 30 for others; "cover on till <date>"),
  **Past grace** ("needs revival"). Sorted longest unpaid first.
- Commission rows with no matching due row are counted as "new policies" (risk date in the CM month) or
  "paid before the list" (the rest). Shown on the upload result only.

### Screens

1. **Policies > LIC** (`/agent/lic`, nav child above Others): month header, totals (due / paid / not paid),
   status chips (All / Past grace / In grace / Paid) and frequency chips, the list, a Remind button per row,
   an Upload button, and the upload history with Remove (confirm dialog, deletes that sheet's rows).
2. **Upload panel** on that page: pick Premium Due list or Commission sheet, choose PDF, see what was read
   (period, agent code, rows, and for CM: paid / new / early / still pending, commission earned, TDS, net).
3. **Home card**: only when the agent has a due list. "LIC premium due: N not paid, Rs X", past grace vs in grace,
   top 3 longest unpaid, "See all". Hidden otherwise, so nobody without LIC sees an empty card.
4. **Policies Overview**: a one-line LIC strip ("LIC: N policies on the due list, M not paid") linking to the LIC page.
   LIC rows are NOT merged into the Overview list in v1 (see Founder decisions).

Remind = `https://wa.me/?text=...` (the sheets carry no phone numbers, so WhatsApp asks who to send it to).
Plan names come from `shared/licPlans.ts` (the directory), term from CM when known, else Prem Due.

## 4. Claims Ledger

| Claim shown | Source of truth |
|---|---|
| "N policies not paid", "Rs X to collect" | due rows of latest due upload minus matched commission rows |
| "Paid" | commission row for that policy + instalment (LIC's own statement) |
| "In grace, cover on till <date>" | grace rule: monthly 15 days, others 30 (LIC policy conditions, founder research 2026-11-28) |
| "Past grace, needs revival" | same rule; we do NOT claim "cover has stopped" (a paid-up policy keeps reduced cover) |
| Plan name | `shared/licPlans.ts` (founder's LIC list) |
| Commission earned / TDS / net | the CM sheet's own summary block |
| "Checked against commission sheet, batch N (date)" | latest commission upload |

## 5. Blast radius

- Policies nav gets one child. Home gets one conditional card. Overview gets one conditional strip.
- No change to `clients`, Home totals, renewals, customers, or analysis. LIC data never enters `clients`.
- Docs / marketing: nothing describes LIC today, so nothing goes stale.

## 6. Unhappy paths

Wrong file type · scanned PDF · Prem Due chosen but CM uploaded (and reverse) · same file twice · totals do not
add up · upload fails mid-way (single transaction: all rows or none) · CM before any due list · empty state ·
refresh after upload · 375 px width · Hindi · playground (no backend: shows empty state, not an error loop).

## 7. Reversibility

Remove an upload: confirm dialog naming the sheet, deletes it and its rows in one transaction. Nothing else is
written. Re-upload restores it.

## 7b. Critique decision log (independent critic, 2026-11-28)

- Fixed: y-jitter grouping (2.5pt tolerance; all 73 + 24 sample rows read); S.No must run 1..N; totals must match.
- Fixed: same CM re-downloaded (new footer id, new hash) is refused by agent code + month + batch, and matching
  dedupes payments on policy + instalment date.
- Fixed: part-paid rows are late from the next unpaid instalment; "paid" judged by instalment count (GST-safe).
- Fixed: MT / LP rows are not told "needs revival"; every status carries "as per your LIC sheets, checked against
  batch N (date)"; we never claim "cover has stopped".
- Fixed: CM figures shown = annexure grand total commission, Income Tax, Net Payable; agent code read from the header.
- Fixed: LIC tables added to account deletion + export (AGENT_TABLES, test now 26).
- Fixed: delete is `WHERE id AND agent_id`, 404 otherwise; PDFs parsed in memory, never stored, no OCR/AI.
- Fixed: extras labelled "in this sheet but not on your current due list", not "paid early".
- Fixed: Prem Due "Tm" never shown (whole-life plans count to age 100); term shown only from a CM row.
- Accepted: team owners do not see members' LIC rows in v1.
- Decided from the plan: Overview gets a strip (LIC never enters `clients`); several agent codes allowed.

## 8. Founder decisions (escalated, defaults used so work can proceed)

1. LIC rows inside the Policies Overview list, or the one-line strip? Default: strip.
2. Free plan or paid-only? Default: open to all (like the plan directory).
3. Sheets from two different LIC agent codes in one account: default allowed, code shown per upload.
4. "Mark paid by hand" (paid at branch before the CM arrives): default left out of v1.
5. Client master list: later, as agreed.
