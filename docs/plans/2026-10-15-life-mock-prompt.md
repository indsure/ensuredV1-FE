# Life and motor "MOCK DATA ONLY" prompts: investigation and options

Date: 2026-10-16 (task logged 2026-10-15). Tier: T2 (public claims).
Code read: `origin/pr-6` at `f1c1a9c`, worktree `E:\_wtlife`, branch `claude/life-mock-prompt-investigation`.
Status: **investigation only. No code, prompt or data changed. No Gemini calls made.** Waiting on the founder.

---

## 1. Short answer

1. **Today, on pr-6 code, no real life or motor upload reaches the mock prompts.** Life, term and motor
   all go to the OCR data-entry lane (fields only, no score) before the pipeline is ever called. The two
   prompts are dead code: they can only fire for `insuranceType === "life"` or `"vehicle"`, and every
   caller either passes `"health"` or returns early for data-entry types (and `"vehicle"` is now a 400).
2. **It was live in the past.** From the initial commit (`0f8c6d5`, 2026-02-08, harshgour) until
   `cbbd1bd` (2026-07-15, "gated /api/me/* replaces anonymous analyzer"), the public, anonymous
   `/api/analyze` route passed `req.body.type` straight into `runAnalysisPipeline`. The public `/life`
   page sent `"life"` and `/vehicle` sent `"vehicle"`. So anyone who uploaded a life or vehicle policy on
   the public site in that window got a **fabricated report**: a fake score, a fake verdict, and lines
   like "Yes, 100% payout expected." Whether that window matches what was deployed on indsure.in depends
   on deploy dates I cannot see.
3. **Why it went in:** no commit explains it. It arrived in the initial commit with the wording
   "SAMPLE ... for UI/UX demonstration purposes only". It reads as a placeholder written to make the
   life/vehicle report screens render before a real engine existed, then left wired to real uploads.
   `f1e2255` (2026-06-24) touched both files but the diff is whitespace/line endings only (`git diff -w`
   is empty).
4. **The CSR numbers (98.5 life, 95.0 motor) are never shown anywhere.** No frontend file, PDF component
   or bot file reads `claim_settlement_ratio`. The health prompt and schema do not even have that field.
5. **A different, live public-claim problem turned up** (section 4): the public life and vehicle pages
   promise a "plain-language verdict" and show a sample report with real insurer names and a 99.2% CSR,
   but a signed-in user who uploads a life policy only gets a factsheet of read fields.

**Caveat on "today":** this is pr-6 source. EC2 runs splices (`analysisPipeline.ts` there is known to
differ, see the 2026-10-15 audit memory). I am blocked from EC2 and the prod DB, so the two checks in
section 5 are for Deep to run.

---

## 2. Code path, as it stands on pr-6

Prompt selection (the only consumer of both prompts):

- `backend/server/services/analysisPipeline.ts:791-793`: default `MASTER_AUDIT_PROMPT`; `"life"` picks
  `LIFE_INSURANCE_PROMPT`, `"vehicle"` picks `VEHICLE_INSURANCE_PROMPT`.
- `backend/server/routes.ts:11-12` imports both prompts but never uses them (dead imports).

Every call to `runAnalysisPipeline`:

| Call site | Route | What reaches the pipeline |
|---|---|---|
| `routes.ts:1852` | batch | hard-coded `"health"` |
| `routes.ts:4119` | `POST /api/agent/analyze` | only non-data-entry types; data-entry branch at `:3991` returns at `~:4048` |
| `routes.ts:5137` | `POST /api/me/analyze` (consumer) | data-entry branch at `:5090` returns first |
| `routes.ts:5933` | `POST /api/agent/clients/:id/rerun` | data-entry branch at `:5871` returns first |

Type gates:

- `backend/server/services/extractionFields.ts:33-41`: `DATA_ENTRY_TYPES` = motor, life, term, travel,
  property, fire, marine, contractor_all_risk. So `"life"` is always data entry.
- `SUPPORTED_INSURANCE_TYPES` = health + those. `"vehicle"` is not in it, so both upload routes 400 on it
  (`routes.ts:3820-3828`, `:5224-5231`). The comment at `routes.ts:3806` records that the client used to
  send `"vehicle"`.
- `POST /api/analyze` (anonymous) now returns 401 AUTH_REQUIRED (`routes.ts:1023`).
- Only theoretical leak on pr-6: the rerun route reads `clients.insurance_type` from the row. A legacy row
  stored as `"vehicle"` (from before the type allowlist) would not be a data-entry type and would be sent
  to the pipeline with `"vehicle"`, which picks the MOCK motor prompt and charges a credit. Section 5,
  check B, tells us whether any such row exists.

### What a user sees on a life policy today

- **Advisor portal:** upload life/term, it is read into flat fields (`EXTRACTION_FIELDS.life`), the
  advisor reviews/edits them. No score, no verdict, no credit drawn (OCR allowance instead).
- **Consumer portfolio:** `frontend/client/src/pages/app/policy-detail.tsx:89-95,180` shows
  `PolicyFactsheet` (the read fields). The audit renderer is shown only if the row has a valid audit
  report, which a data-entry row does not.
- **Motor:** same lane, plus a deterministic score from `scoreFromExtractedData` (no Gemini, no mock).

### History

| Date | Commit | Effect |
|---|---|---|
| 2026-02-08 | `0f8c6d5` init (harshgour) | Both MOCK prompts present and wired. Public `/api/analyze` uses `req.body.type`. `/life` sends `"life"`, `/vehicle` sends `"vehicle"`. Agent uploads hard-coded `"health"` (`AgentUploads.tsx:97` at that time). |
| 2026-03-13 | `c61553f` "update" | Touches the `insuranceType === "life"` line (moved, still live). |
| 2026-06-11 | `e42f47a` | Agent route gets the data-entry lane. Life/motor from advisors stop reaching the pipeline. **Anonymous route unchanged**, still passes the type through. |
| 2026-06-24 | `f1e2255` | Whitespace-only rewrite of both prompt files. |
| 2026-07-15 | `cbbd1bd` | Anonymous analyzer replaced by gated `/api/me/*` with the data-entry branch. Last path to the MOCK prompts closed. |

So the exposure window in code is **2026-02-08 to 2026-07-15, public anonymous uploads of life and
vehicle policies only.**

---

## 3. Every place a fabricated number could reach a user

| Surface | Today (pr-6) | Past window (to 2026-07-15) |
|---|---|---|
| **Screen, advisor portal** | No. Life/motor are data entry. | No for life/motor (agent route sent "health" before June, data-entry after). |
| **Screen, consumer portfolio** | No. Factsheet only. `/api/me/*` did not exist before 2026-07-15, so no stored mock rows there. | n/a |
| **Screen, public anonymous report** | No. `/api/analyze` is 401; `report.tsx` no longer loads jobs by id. | **Yes.** Fake score, verdict label, "Yes, 100% payout expected." (`PolicyAuditReport.tsx:660`), fake rider remarks. The CSR value itself was never rendered. |
| **Raw API, old job ids** | `GET /api/analyze/status/:jobId` (`routes.ts:1032`) still serves non-agent jobs from `analysis_jobs`. A stored mock result would come back to anyone holding the UUID. DPDP cleanup (`index.ts:84-100`) should have deleted these (no `policy_id`, older than 90 days). **Unverified on EC2**, check A. | Same. |
| **PDF** | `PolicyPDFDocument` renders from the same report JSON; no reference to `claim_settlement_ratio`. Only reachable through `PolicyAuditReport`, which no life/motor row reaches. | Could have rendered the fake score/verdict if downloaded from a mock report. |
| **Share link** (`SharedReport.tsx`) | Shares client rows. Data-entry rows use the factsheet branch (`:214`). No mock rows. | n/a (shares are client rows, never anonymous jobs). |
| **WhatsApp bot** | `whatsapp-bot/` has no reference to `audit_score`, `analysis_result`, `final_verdict` or settlement ratio. No path. | n/a (bot started 2026-09-25). |
| **Sach AI** | `sachRetrieval.ts:337` reads `network_limitations` (would include a CSR if a stored report had one). Sach works off client-linked jobs, which never got mock output. | Low risk; anonymous jobs had no `policy_id`. |
| **CSR 98.5 / 95.0 specifically** | Never rendered on any screen, PDF, share or bot. Only lives in the model's JSON. | Same. |

---

## 4. Live public-claim issue found on the way (not in the original brief)

These are on prod today (frontend, public, no Gemini):

1. **The life and vehicle pages promise something the product does not do.**
   `en.json` `lobp.l_verdict`: "Get a verdict on whether your cover is enough, the gaps, and next steps."
   `lobp.l_a_how`: "...Then it turns them into a plain-language verdict." `lobp.l_1cr` says we work out
   whether the cover meets the family's needs. Same pattern in `lobp.v_*`. A signed-in user who uploads a
   life policy gets a factsheet, not a verdict. (Hindi strings mirror these.)
2. **The sample life report** (`frontend/client/src/lib/mock-data.ts:266`, shown at
   `/report?sample=life` from `/life` and `/term`) names **HDFC Life** ("typically settles claims within
   30 days"), an **ICICI** rider, and states **"Claim Settlement Ratio (99.2%)"**. No source. Our own rule
   (landing accuracy fix, 2026-09-25) is no real insurer names in demo panels. It also says "Served.
   Suicide now covered." which is an odd claim to show a family. The vehicle sample uses a real rider
   from `VEHICLE_RIDERS_DATABASE` too. I did not find a visible "sample" label in `report.tsx` (the
   `sourceRef` there only feeds analytics); I did not check the rendered page.

---

## 5. Checks for Deep (read-only, I cannot run them)

A. Any old mock results still stored:

```sql
SELECT count(*), min(created_at), max(created_at)
FROM analysis_jobs
WHERE policy_id IS NULL
  AND (result::text ILIKE '%Mock Data Simulation%' OR result::text ILIKE '%(Simulated)%');
```

(Column name `result` is my reading of `persistJob`; adjust if the table differs.) Non-zero means the
DPDP cleanup is not running on EC2, and those rows should be deleted.

B. Any legacy policy rows that the rerun route would send to the MOCK motor prompt:

```sql
SELECT insurance_type, count(*) FROM clients
WHERE insurance_type IS NOT NULL
  AND insurance_type NOT IN ('health','motor','life','term','travel','property','fire','marine','contractor_all_risk')
GROUP BY 1;
```

C. On EC2: `grep -n 'insuranceType === "life"\|isDataEntry' ~/…/backend/server/services/analysisPipeline.ts ~/…/backend/server/routes.ts`
to confirm the live splice has the same data-entry early returns.

---

## 6. Options for the founder

### Decision 1: what to do with the two MOCK prompts

**Option A (recommended): delete them.** Remove `lifeInsurancePrompt.ts`, `vehicleInsurancePrompt.ts`,
the two dead imports in `routes.ts`, and the two `if` lines in `analysisPipeline.ts`. Then add a guard in
`runAnalysisPipeline`: if the type is not `"health"`, return `failed` before any Gemini spend. This also
closes the legacy-row rerun path in check B. No prompt rewritten, no paid run needed, verifiable by
typecheck plus a unit test. Backend change, so EC2 deploy (Deep runs the .bat).

**Option B: build a real life audit prompt.** A genuine engine for term/life (sum assured adequacy,
riders, exclusions, Section 45, nominee). That is a new T2 feature with its own plan, claims ledger and
paid test runs (founder approval for Gemini spend). It should not reuse the health schema; most of the
health fields are "N/A" for life. Not a fix for this issue; do A first either way.

**Option C: keep the files, only null the CSR** (the "two-line fix"): change `"claim_settlement_ratio":
98.5` and `95.0` to `null`, and the remark to say it is not read from the policy. Honest, but it leaves
"SYSTEM MODE: MOCK DATA ONLY" and "BELIEVABLE but FAKE scores" one wiring change away from users. I do
not recommend stopping here. If you prefer the smallest diff, do C together with the guard from A.

### Decision 2: the public life and vehicle pages (section 4)

**Option D (recommended): make the pages say what we do today.** For life: "Upload your policy and we
read the key details (sum assured, riders, dates, nominee) into your portfolio, plus our calculator tells
you if the cover is enough." For vehicle: the read fields plus the motor score we do compute. Mark the
full life verdict as "coming soon". Replace the sample life report with a factsheet sample, or keep the
audit sample with made-up insurer names, no CSR figure, a clear "Sample" label, and the suicide line
removed.

**Option E: hide the "See a sample life/vehicle report" links** until a real life engine exists, and
soften the verdict copy. Smaller change, still honest.

Either D or E needs both `en.json` and `hi.json` updated, and is frontend-only (Vercel, beta first).

### Open questions only you can answer

1. A, B or C for the prompts?
2. D or E for the public pages, and should life be marketed as "coming soon" at all?
3. If check A finds stored mock reports: delete them, and do we owe anyone a note (they were anonymous,
   so there is likely no one to contact)?

Nothing will be changed until you pick.

---

## 7. Founder answer (2026-10-16)

Product scope, as stated by the founder:

- **Vehicle:** has a score (the existing motor score out of 100).
- **Term life:** no score.
- **Life:** a summary table (the data-entry factsheet).
- "That is all that is needed." No life audit engine is wanted, so **Option B is off the table.**

What this implies (still waiting on an explicit go-ahead before any change):

- **Prompts:** Option A. Delete both MOCK prompt files and add the health-only guard. Nothing in the
  scope above uses them.
- **Public pages:** Option D, worded to this scope. Life/term pages should promise the summary table and
  the calculator, not a verdict. The vehicle page should promise the score, and its sample should look
  like the real motor score, not a full health-style forensic audit. The sample life report (real
  insurer names, 99.2% CSR, suicide line) would be replaced by a sample summary table.

---

## 8. What was built (2026-10-16, founder said "do both")

**Backend**
- Deleted `lifeInsurancePrompt.ts` and `vehicleInsurancePrompt.ts`, plus their imports.
- `runAnalysisPipeline` refuses any type but `"health"` before any Gemini call. Covered by the new
  `tests/auditHealthOnly.test.ts` (8 cases, AIService stubbed to fail if it is reached).
- Rerun route (`POST /api/agent/clients/:id/rerun`): a legacy row whose type is neither health nor a
  data-entry type (for example `"vehicle"`) now gets a 409 before the credit check and before the paid
  OCR read.

**Public site (EN and HI)**
- `/report?sample=life|term|vehicle` now shows `SampleFactsheetReport`:
  - a "this is a sample" banner and the real `PolicyFactsheet` table, filled with made-up data
  - for motor, the real cover score and add-on checklist, computed by running `detectMotorAddOns` and
    `scoreMotorPolicy` on a made-up schedule (55/100, "Core cover, some add-ons")
  - the old fake audits `mockReportLife` and `mockReportVehicle` are deleted
- `/life`, `/vehicle` and `/term` copy now promises only the founder's scope:
  - life and term: a table, no score
  - vehicle: a table, the add-ons and a cover score
  - SEO titles and descriptions and the prerender intros now match the pages
  - `/term` was rewritten and is now bilingual (it was English-only)
- Links removed from `/life`, `/vehicle` and `/term`:
  - the calculator links: `/calculator?type=...` ignores the type and opens the **health** calculator
  - the comparer links: see E1
- The disabled "Download Report" button now goes to signup.

### Decision log (critic pass)

| # | Critic finding | Resolution |
|---|---|---|
| 1 | Life, term and vehicle pages linked to `LifeInsuranceComparer` / `VehicleInsuranceComparer`, which name real insurers, say "We've analyzed 20+ insurers", show "SYSTEM PICK" and a Buy button | **Fixed**: links removed from all three pages. The comparer pages themselves: **Escalated** (E1) |
| 2 | Rerun of a legacy `"vehicle"` row paid for OCR before the guard refused | **Fixed** (409 before credits and OCR) |
| 3 | "PDF only. Takes 10 seconds." contradicts "PDF, PNG, JPG"; "View sample report" | **Fixed** ("A PDF or a clear photo works.", "See a sample") |
| 3b | "IRDAI-aligned" chip has nothing behind it | **Escalated** (E2): a regulatory-sounding claim, founder's call |
| 4 | Contrast on `/term` (white on #00B4D8); 12px trust row | **Fixed** (darker gradient, white button, trust row at 14px) |
| 5 | Hindi: awkward `q_download`, "सेव", unglossed "ओन-डैमेज", stiff "पूर्णता" | **Fixed** |
| 6 | Sample dates used UTC (wrong day in India before 05:30); motor cover ended on the same day it started | **Fixed** (local dates, expiry is the day before) |
| 6b | `detectMotorAddOns` reports the commas as unrecognised add-ons | **Accepted** for now, not rendered. Follow-up (F3) |

### Escalated / follow-ups (not done here)

- **E1.** `/compare?type=life|term|vehicle` (`LifeInsuranceComparer.tsx`, `VehicleInsuranceComparer.tsx`) still
  makes unsourced claims about named insurers and has a Buy button. It can still be reached directly and
  from other pages. Decide: remove it, or source every number.
- **E2.** "IRDAI-aligned" on `/life` and `/vehicle`: what does it rest on?
- **F1.** The health sample (`mockReportCareSupreme`) names a real insurer. That is the same rule this
  change applied to life and vehicle.
- **F2.** The site footer says "the report you get is the one the policy deserves". For life and term
  there is no report, only a table.
- **F3.** In `shared/motorAddOns.ts`, `window.split(/([,\n]|\s{3,})/)` keeps the separators as pieces, so
  every comma lands in `unrecognisedDeclared`.
- **Deploy.** The backend change needs the EC2 deploy (Deep runs it; splice the hunks, never copy whole
  files). The frontend goes to beta with pr-6.

### Checks run

- Frontend `tsc` is clean.
- Backend `tsc`: the only errors are missing modules (`tesseract.js`, `pglite`, `uuid`) in files this
  change does not touch.
- `npm test`: 718 of 721 pass. The 3 failures are the same missing modules.
- `npm run guard`: PASS.
- Browser checks: the three sample pages, `/life`, `/vehicle` and `/term` at 375px (no horizontal
  scroll), and the vehicle page and sample in Hindi.
