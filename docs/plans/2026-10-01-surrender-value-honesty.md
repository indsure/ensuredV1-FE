# Surrender value: stop showing cash that cannot be supported

Tier **T2** (money claims, public copy, personal data, backend route). Branch
`fix/surrender-value-honesty` in worktree `E:\Indsurefi\_wt-surrender`, cut from
`origin/pr-6` @ `9a28dac` (carries main's Hindi strings for the page and card). No push, no
merge, no deploy, no DB write, no Gemini call.

Baseline on that commit: backend tests 471/471, bot tests 145/145, backend/frontend/bot
typechecks clean, guard PASS (sub-14px type at its 797 budget, so every new string is 14px+).

Audit anchors re-checked against this commit: engine, params and book files are byte-identical
to the audited `c5ec23a`; the card and page are the main (i18n) versions the audit cited as
"main"; the PATCH route moved from 5608 to 5602. No other divergence.

## 1. Goal

An advisor (book, policy card, WhatsApp) only ever sees a rupee amount presented as money the
customer can get when the inputs behind it support it, and every amount says what it is based
on, as of when, gross or net, and what is missing.

## 2. Design

### 2.1 New pure modules (frontend `lib/`, zero non-relative imports, synced to the bot)

| File | Job |
|---|---|
| `policyNumbers.ts` | Strict grammar for rupees (`50000`, `50,000`, `5,00,000.50`, optional `Rs`/`Rs.`/`INR`/`₹` prefix, optional `/-`, optional `lakh`/`lac`/`crore`/`cr` suffix). Anything else is rejected with a reason, never stripped to digits. Strict `YYYY-MM-DD` dates (real calendar dates only; `03/04/2018` is rejected as ambiguous). Integers for years. Percent fields reject values strictly between 0 and 1 as "looks like a decimal, enter 7 for 7%" instead of converting. A byte-identical copy lives at `shared/policyNumbers.ts` for the backend, with a parity test. |
| `productRules.ts` | Versioned rule-set schema keyed by insurer + UIN (+ optional issue-date window): shape, acquisition years, GSV (base, explicit per-year factors, optional interpolation only if the rule states it, survival-benefit deduction flag), SSV (factor table on paid-up basic sum assured plus vested bonus; any other method is marked unsupported), selection (higher of / GSV only), loan (eligible after N years, max % of surrender value), citations, review status. `validateRuleSet()` checks bands (sorted, no overlap, no duplicates, 0..100), coverage and method. `VERIFIED_RULE_SETS` ships **empty**: no factors are invented. |
| `policyEvidence.ts` | Typed, versioned store at `extracted_data.value_evidence` (`schema: 1`): premium payments (amount, due date covered, paid on, origin `agent_entered`, confirmation `self_reported` or `insurer_document`, optional receipt reference text, `supersedes` for corrections so history is kept), loan status records (none confirmed / has loan with principal, interest or null, as-of date, origin), insurer quotes (surrender payable, loan available, policy status; amount, quote date, reference), an "inputs checked against the document" snapshot (invalidated if any checked field later changes), agent-entered rule set, plan-type override with source. `readEvidence()` validates and drops bad records with a reason; pure writers return a new store. Legacy `policy_parameters.outstandingLoan` is read as an unconfirmed loan principal with unknown interest. Legacy `source: "document"` blobs stay unverified. |
| `policyValuation.ts` | `valuePolicy(type, data, {asOf, ruleSets?})` returns per-value `ValueResult`s: `{amount | null, currency, asOf, basis, meaning, sources, missing[], conditions[], upperBound?}`. Basis: `insurer_quote`, `document_calculation`, `document_stated`, `unverified_reading`, `estimate`, `projection`, `not_applicable`, `unsupported`, `insufficient`. Values: surrender gross, deductions, surrender net payable (with shortfall), loan remaining, maturity, fund value (dated), premiums scheduled to date, premiums recorded paid, payment status, next-anniversary comparison. Reasons are codes, so the UI translates them (en/hi) and the bot prints English. |

`document_calculation` requires ALL of: a verified rule set for the policy's insurer + UIN, the
decision inputs confirmed by the agent against the document (snapshot matches), payment
records covering every scheduled instalment to date, and a known loan position. With the
registry empty, no real policy reaches it; tests inject synthetic rule sets.

Payment status never comes from the age of a date. Order: insurer-quoted status (dated) >
status stated in the document (dated, unverified) > payment records > "Payment status needs
checking". A passed scheduled date with no record gives "The premium date on file has passed",
never "lapsed" or "benefits reduced". No grace, 365-day, revival-window or acquisition default
is used for any decision. Revival amounts and deadlines are no longer shown; the card says to
ask the insurer.

Net = gross − loan principal − loan interest − sourced deductions, only when all are known.
Principal known, interest unknown: net is null, shown as "at most ₹X" on the card only, outside
totals. Deductions above gross: payable ₹0 plus a separate shortfall line, no claim that the
customer owes it. Loan remaining = max(limit − principal − interest, 0) only with a rule's loan
terms and a known loan position; never on a policy whose status is not confirmed in force.

Next anniversary (document calculations only, status recorded up to date, no loan or loan
interest known): required premiums = scheduled instalments due after today up to and including
the anniversary; difference = (next net + scheduled payouts in between) − current net −
required premiums. Wording is neutral ("After ₹50,000 in premiums, the calculated difference is
−₹1,500. Confirm with the insurer."). "Worth waiting" and the "jumps" action are deleted.

Maturity: the stated amount only (no fallback to death cover for any shape). ULIP: dated fund
value from a statement, never "cash now"; surrender only from an insurer quote.

Shape: explicit `plan_type` from the document or an agent override (source shown) is accepted;
a name-regex match is a "candidate" that shows as needs-confirmation; pension, annuity, whole
life and child plans are unsupported; no evidence is unknown, never term with ₹0.

### 2.2 The old schedule engine (`computePolicyValue`) becomes the illustration

Kept only for the card's collapsed "Illustration" section and never read by book, totals,
headlines or the bot. Changes: the generic GSV and SSV default tables and the generic year-7
ramp are removed (factors come from a rule set, an agent-entered table, or validated legacy
`policy_parameters` arrays via an explicit alias adapter that reports conflicts); the
yield-driven present-value SSV switch, `derivedRate`, loan/revival rates, revival quote,
365-day lapse and date-inferred acquisition are removed; the overdue note bug goes with the
status inference; money-back maturity has no sum-assured fallback; bad parameter shapes give a
validation reason instead of a throw. ULIP keeps its growth illustration, labelled
"Illustration at an assumed X% growth", outside every cash surface.

### 2.3 Surfaces

- **Book** `policyBook.ts` + `PolicyValues.tsx`: rows come from a new backend route (below);
  every life/term row is listed, including pending/failed extraction, missing data,
  unsupported and per-row errors, each with a reason and a next step. Totals: "Insurer quotes
  on file" and "Calculated from checked policy terms", each with count and oldest date; borrow
  likewise; an included/excluded reconciliation with reasons; "Not available" when nothing
  qualifies. Duplicates: same normalised policy number + insurer within the agent's rows is a
  confirmed duplicate counted once; same number with missing/different insurer is a possible
  duplicate, excluded from totals pending review. Nothing deleted.
- **Card** `PolicyValueChart.tsx` split into small components: summary tiles (basis badge,
  as-of, gross/net, missing reasons), evidence panel (record/correct payments, loan status,
  insurer quotes, "I checked these details against the policy document"), factor-table editor
  (agent-entered, validated, never certifies amounts), collapsed illustration. Parameter
  inputs save only on a real validated change; empty clears; invalid keeps the old value and
  shows an error; untouched blur saves nothing.
- **Bot** `crm.ts` `valueReply`: built from `valuePolicy`; quotes carry their date; borrow
  shows the remaining amount only; maturity only when stated, never "guaranteed"; always ends
  with "Confirm with the insurer before acting." New shared files added to the sync list and
  the parity test.

### 2.4 Backend (code prepared, not deployed)

- `GET /api/agent/policy-values` (new): `verifyJwt` agent id, `SELECT ... FROM clients WHERE
  agent_id = $1 AND insurance_type IN ('life','term')`. Handler logic in a testable function
  with a db interface; tenant tests with a fake db holding two agents. Playground mock added.
- `PATCH .../extracted-data`: `validateExtractedDataPatch()` (strict numbers/dates for known
  fields, size and shape bounds on `value_evidence` and `policy_parameters`, `_rev` stripped
  from client input), optional `expected_rev` optimistic concurrency (409 on mismatch; old
  clients that send none behave exactly as today), server increments `_rev`.
- Rerun (`/rerun`): keeps `value_evidence` and `_rev` instead of wiping them.
- Extraction: prompt no longer computes a future due date; it extracts the stated schedule,
  last premium due date, stated paid-to date and status (with as-of), UIN, issue date, basic
  sum assured, premium excluding taxes, taxes, rider premium, vested bonus (with date), loan
  balance/interest (with statement date), and `field_sources` (excerpt + claimed page per
  decision-driving field). Backend checks each excerpt appears in the extracted text and the
  value appears in the excerpt; claimed pages stay marked unverified. Coercion uses the strict
  grammar. New fields classified in `dataEntryShare` (not shared). Renewal reminders keep
  working: `getNextPremiumDate` derives a scheduled date from start date, frequency and PPT
  when no stated date exists (a reminder, never a status).

### 2.5 Copy (en + hi, docs, advisor features, bot)

Core line: "Each value shows what it is based on. We show a calculated amount only when the
needed policy terms and inputs are available. Missing information and projections are shown
separately. Confirm the final surrender or loan amount with the insurer before acting."
"Not estimated" is removed everywhere it appears.

## 3. Claims ledger

| Claim | Source of truth |
|---|---|
| "Quoted by the insurer on D" | `value_evidence.quotes[]` entered by the agent; labelled "entered by you" |
| "Calculated from checked policy terms" | verified rule set + inputs snapshot + payment records + loan position, all in `valuePolicy` |
| "Premiums recorded as paid" | `value_evidence.payments[]`; labelled self-reported unless insurer document |
| "The premium date on file has passed" | scheduled dates from start/frequency/PPT, or stated `next_premium_date` |
| Totals and counts | `computeBookTotals()` over the rows on screen |

## 4. Blast radius

Docs `/docs/surrender-value`; `pv.*`, `pvc.*`, `adv*.f_values_d` strings (en/hi); bot reply;
renewal reminder date (`getNextPremiumDate`, five callers); share whitelist; Excel export
(field lists); playground demo (life rows now show "needs" states; no fake evidence added to
the public seed); rerun path; the PATCH route (all data-entry types).

## 5. Unhappy paths

Refresh mid-entry, two tabs saving (409), failed save keeps the old value and says so, empty
book, all rows excluded, one malformed row, pending/failed extraction rows, 375px, Hindi long
strings, playground (no backend), backend route missing (error state with retry).

## 6. Reversibility

All writes are append/supersede records inside `extracted_data`; a correction keeps the
original. Code revert restores old behaviour; old clients ignore `value_evidence`.

## 7. Founder decisions (escalated, not guessed)

1. Whether the public playground should get demo quotes/payments so the page is not all
   "needs data" in the demo.
2. Which products to source first for the verified rule registry, and who reviews them.
3. Release order: backend route and PATCH change must reach EC2 before the frontend ships.
4. Extraction prompt change raises output tokens per life/term upload (excerpts).

## 8. Critique and finalize (decision log)

Independent critic (no access to this plan's rationale) returned 18 findings. Resolution:

| # | Finding | Resolution |
|---|---|---|
| 1 | No test plan; real policy number in the test file; old tests assert on deleted defaults | **Fixed**: section 9 below. Old anchor test rewritten against an explicit synthetic rule set; the real policy number is replaced by a redaction note (no history rewrite). |
| 2 | "Percent between 0 and 1 rejected" is an invented range and rejects real ULIP charges | **Fixed**: no magnitude rule. `parsePercent` accepts 0..100; the editor asks "Did you mean 0.07% or 7%?" for values under 1 and saves only after the person picks. Never converted. |
| 3 | Book actions `lapsed`, `overdue`, `underwater`, `steady` and "Surrenderable today" still claim unsupported things | **Fixed**: action set rebuilt from valuation states only (needs data, check payments, quote on file, calculated, term, unsupported, maturing by date, error, pending). Old actions and their strings removed. |
| 4 | Share page publishes "Next premium due" (model-computed) and fund value without its date; policy lists show red "Overdue" from date age | **Fixed**: share relabels the date as scheduled and shows fund value only with its date; life/term chips say "Premium date passed", not "Overdue". |
| 5 | Review form turns "1.5 lakh" into 1.5 | **Fixed**: form uses the strict grammar with a per-field error. |
| 6 | Payment history can be overwritten by stale or old clients; SELECT then UPDATE race | **Fixed**: server merges `value_evidence` record by record (never drops a stored record id), ignores `value_evidence` from clients that send no `expected_rev`, and the rev check sits in the UPDATE's WHERE clause. |
| 7 | Re-run drops evidence written while it runs, wipes `policy_parameters`, does not bump `_rev` | **Fixed**: final UPDATE merges the database's current `value_evidence` and `policy_parameters` in SQL and bumps `_rev`. |
| 8 | Release order: strict PATCH blocks saves on legacy bad values; prompt change empties `next_premium_date` for the old frontend | **Fixed**: PATCH validates only keys whose value changed. Backend fills `next_premium_date` from the stated date, else from the deterministic schedule, with `next_premium_date_basis` saying which. |
| 9 | Verification mixed with origin; agent-typed quote counted as "Insurer quotes" | **Fixed**: `ValueResult` carries `origin` and `verification` separately; subtotal is "Insurer quotes you entered". |
| 10 | Old insurer or issue-time status outranks newer payment records | **Fixed**: newest dated evidence wins; a status dated before a later scheduled due date with no record after it is "needs checking". |
| 11 | Illustration keeps invented defaults (80, 90, 105, 1.35, admin, mortality, 4%) | **Fixed**: every default removed; unset inputs show "needs input". |
| 12 | Guaranteed / vested bonus / future bonus / loyalty not separated; money-back bonus; death cover vs basic sum assured | **Fixed**: separate results; paid-up base uses basic sum assured only; future bonus and terminal/loyalty additions shown as "not included, not guaranteed". |
| 13 | Valuation date has no convention | **Fixed**: IST calendar date (`valuationDateIso`) on portal and bot; all date maths on ISO strings. |
| 14 | Tenant tests only on the GET; fake db limits; RLS on direct client UPDATE unknown | **Fixed** (tests for GET and PATCH with a fake db, limits stated); **Escalated**: live RLS (including whether the browser can UPDATE `clients` directly) is a release blocker until checked. |
| 15 | Anniversary-day instalment and loan interest wording ambiguous | **Fixed**: an instalment due on or before the next anniversary is a required premium and is in the next-year paid base once only; comparison only when the loan position is "no loan" (confirmed). |
| 16 | Disagreeing duplicates | **Fixed**: same identity with differing inputs is disputed and excluded from totals. |
| 17 | Payment currency; receipt is text, not a stored file | **Accepted**: currency kept; receipt file upload not built (no storage path chosen); stated as a gap. |
| 18 | One record per instalment makes document calculations unreachable | **Fixed**: a dated "premiums paid up to" record (self-reported or from an insurer document) covers every instalment due on or before that date. |

## 9. Tests (all synthetic; expected values worked by hand in comments)

- `policyNumbers.test.ts`: grammar, dates, IST valuation date across midnight, calendar, backend copy parity.
- `productRules.test.ts`: band validation (overlap, order, range, method, selection), interpolation only when declared, the anchor GSV column reproduced from an explicit synthetic rule set (formula stated in the test, no fitted constant).
- `policyEvidence.test.ts`: corrections keep history, voids, malformed records dropped with reasons, agent rules never "verified", legacy loan.
- `policyValuation.test.ts`: the matrix in the brief (net loan, remaining borrowing, unknown interest/balance, shortfall; anniversary −1,500 and the instalment, payout, limited-pay and unknown-schedule cases; status precedence; maturity no fallback; bonuses; ULIP; sparse savings plan; malformed factors; null vs zero; no default reaches a decision).
- `policyBook.test.ts`: every row visible with a reason, per-row isolation, totals reconcile, duplicates and disputes, nothing unverified in cash totals.
- `policyValueRoutes.test.ts`: GET and PATCH handlers with a two-agent fake db (A cannot read or update B), changed-key validation, record merge, `_rev` conflict.
- extraction tests: prompt no longer computes a future date; schedule fill with basis; citation checks; strict coercion; share classification of new fields.
- bot: `valueReply` contract (net borrowing, no maturity fallback, caveat line), shared-file parity.
- UI: no component-test harness exists in this repo (no vitest/testing-library); view-model functions are unit tested and the screens are checked in the browser with synthetic playground data at desktop and phone width in English and Hindi. Stated as a gap, not claimed.
