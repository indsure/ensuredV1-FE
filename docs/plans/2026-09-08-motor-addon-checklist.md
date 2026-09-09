# Motor add-on checklist from OCR: plan

Date: 2026-09-08
Tier: **T2** (new user-visible claim, goes to prod, agent shows it to a customer)
Status: **Phase 0 complete. Two insurers, two vehicle classes, both correct. GATE PASSED.
The §6 blocker is FIXED and sitting in the working tree. No product code for the checklist
yet: Phase 1 is cleared to start.**

---

## 1. Goal

An agent uploads a car or bike policy. Without any extra work, the policy page shows
which recommended add-ons that policy actually has, which it does not, and which it
could never have had, with the exact line from the document as proof of each tick.

## 2. The one-line feasibility answer

Yes, and it can be done with **zero extra Gemini spend**, because the seam already exists:

- `extractTextFromPDF` (`backend/server/routes.ts:558`) already produces the full plain
  text of the policy locally via pdf.js. No API call, no cost.
- `extractStructuredData` (`backend/server/services/dataExtraction.ts:39`) already
  receives that text and is the single choke point that all four upload/re-run routes
  call (`routes.ts:1965, 3790, 4799, 5443`).

So the detector runs inside that one function and every route inherits it for free.

## 3. Why the naive version lies

This is the part that decides whether the feature is an asset or an embarrassment.
Four concrete failure modes, each with a named mitigation:

**a) The wording booklet matches everything.**
If the uploaded PDF is the product wording rather than the schedule, it describes every
add-on the product sells. A keyword scan returns 10/10 on a policy that bought none.

> Mitigation: a match only counts as `present` if it sits next to a **rupee amount** or
> an explicit affirmative token (`Opted`, `Yes`, `Covered`, `Applicable`, a tick glyph).
> Prose mention alone is `not_found`, never a tick.

**b) The word appears in a clause that means the opposite.**
"Depreciation" appears in the depreciation-deduction table of essentially every motor
policy. "Personal Accident cover for owner-driver" is a statutory cover, not an add-on.
Several schedules print the add-ons **not** taken.

> Mitigation: per-add-on `negativeAliases`, plus section-scoped matching. Match inside
> the premium-computation / add-on block first; a whole-document hit downgrades to
> `check_manually` rather than promoting to `present`.

**c) Absence is not proof of absence.**
Some insurers declare an add-on only as a silent rupee line in the premium breakup, and
some only in an endorsement that is a separate PDF.

> Mitigation: three states, never two. `present` / `not_found` / `not_applicable`.
> The UI says "not found in this document", not "missing". Different words, different
> liability.

**d) A false gap on an old vehicle.**
An 8-year-old car scoring 4/10 forever is a meaningless number.

> Mitigation: the denominator is the **applicable** set, narrowed by coverage type and
> vehicle class. A third-party-only policy collapses the whole checklist to one honest
> sentence instead of a red scorecard.

> **Corrected by Phase 0. Vehicle age must NOT gate detection.** This plan originally
> proposed suppressing zero-dep past roughly 5 vehicle years and RTI past 3. The first
> real policy tested is a 2017 Tata Tigor, 8 years old, carrying Depreciation Waiver at
> a stated claim limit of UNLIMITED for Rs 4,394. The age gate would have printed
> "not applicable" over a cover the customer actually holds and pays for, which is a
> worse failure than the gap it was meant to prevent. Detection now always runs on the
> full catalog. Age is a hint for the recommendation text only, never a suppressor, and
> it is never stated as a rule, because thresholds are insurer-specific.

## 4. Claims Ledger

| Claim shown to user | Source of truth | Verified |
|---|---|---|
| "6 of 9 add-ons this vehicle can have" | count of `present` over count of applicable catalog entries, both computed in `motorAddOns.ts` | TODO |
| Each ✓ next to an add-on | the quoted matched line + its character offset in the extracted text, stored alongside the finding and shown on tap | TODO |
| "Not applicable: vehicle is 8 years old" | `manufacturing_year` from the document, minus today | TODO |
| Which add-ons are "recommended" | **TODO(claim): founder decision, see §9** | not set |
| Typical cost figures (if shown) | **TODO(claim): the existing `vehicle-rider-data.ts` cost ranges have no source. Do not display them until sourced.** | not set |

No tick ships without its quoted line. That rule is what makes this defensible when an
agent forwards the report to a customer.

## 5. Blast Radius

- `frontend/client/src/lib/data/vehicle-rider-data.ts` is a 7-entry, car-only,
  unsourced rider list used today only by `mock-data.ts`. The new catalog supersedes it.
  Either delete it or mark it demo-only, or the two will drift.
- `EXTRACTION_FIELDS.motor` exists twice, backend (`extractionFields.ts:75`) and frontend
  (`insuranceTypes.ts:61`), kept in sync by hand. Every field added below must be added
  to both in the same commit.
- Adding fields to the motor extraction prompt increases output tokens. Cap is currently
  32768 (`config/ai_config.ts:12`), so there is headroom, but the 2026-09-07 incident was
  exactly this: a cap sized against visible tokens while the model's thinking is billed
  against the same ceiling. Two extra motor fields are safe; note it, do not ignore it.
- `/compare?type=vehicle` and `pages/vehicle.tsx` are public marketing pages describing
  vehicle cover. Check nothing there becomes false.

## 6. Blocker found while planning: extracted_data is wiped on save, **FIXED 2026-09-08**

`ExtractedDataForm.tsx:31` filters `json` fields out of the field list, then
`save()` rebuilds the payload from **only that filtered list**, and the endpoint
(`routes.ts:5291`) does a whole-object **replace**, not a merge.

Consequence today, before this feature exists: clicking "Save details" on a **life or
term** policy silently destroys `policy_parameters`, the json blob the policy-value
chart reads. `PolicyValueChart.tsx:98` works around it by posting the whole object back;
the form does not.

This was a prerequisite. Any findings blob stored in `extracted_data` would have been
deleted the first time an agent corrected a typo.

**Fixed at the endpoint, not the form**, so every future caller is safe by construction:
`mergeExtractedData` in `services/extractionFields.ts`, applied in `routes.ts:5291`.
Shared columns are now derived from the merged blob rather than from the patch, which
closes a second latent bug: a partial save that omitted `insurer` would have written NULL
over the column. Pinned by `backend/server/tests/extractedDataMerge.test.ts`.

Verified: 118/118 backend tests pass, `npm run check` clean, `npm run guard` PASS with no
budget growth. Local and uncommitted on `pr-6`, alongside unrelated in-flight
surrender-value work that must not be swept into the same commit.

## 6b. Phase 0 results: Royal Sundaram Car Shield, run 2026-09-08

One car policy, 6 pages, 15,926 characters of real text layer, so it is READABLE and
never touches the scan path. Extraction was local pdf.js only. **Zero Gemini calls, zero
spend.**

**The document gives two independent channels, and they agree.**

1. A declared list: `Add-on Covers Opted   Consumable, DepreciationWaiverPremium,
   RoadSideAssistanceCover, KeyReplacementCover`.
2. A priced own-damage table where **every add-on line carries its IRDAI UIN**, e.g.
   `Depreciation Waiver ( IRDAN102A0011V03201213) (Claim Limit:UNLIMITED) 4394`. The UIN
   is a hard structural anchor, far stronger than matching prose, and it is a registered
   identifier that a canonical catalog can eventually be keyed on.

Result on this policy: **4 of 9 confirmed on both channels**, with a rupee amount as
evidence for each. Zero depreciation Rs 4,394, Consumables Rs 711.02, Roadside assistance
Rs 49, Key replacement Rs 128.70. The other five read `not_found`, correctly.

**Three things Phase 0 changed, that guessing would have got wrong:**

- **The naive version under-reports, which is worse than over-reporting.** The string
  "zero dep" appears **zero** times in this document. A checklist built on the obvious
  alias would have reported "no zero depreciation" on a policy holding *unlimited*
  zero-dep worth Rs 4,394, the single most expensive add-on on the schedule. Insurers
  name it "Depreciation Waiver", and Royal Sundaram writes it as one CamelCase token in
  the declared list. Normalising by squashing every non-alphanumeric character makes
  `DepreciationWaiverPremium`, `Depreciation Waiver` and `depreciation-waiver` the same
  string, so one alias covers all three forms.
- **The single-word aliases are landmines, now measured rather than assumed.** This
  document contains "Engine No." 3 times and "GST Invoice No." 4 times. A bare `engine`
  or `invoice` alias ticks Engine Protection and Return to Invoice on a policy that has
  neither. Aliases must be anchored multi-word phrases. The probe confirms both stay
  `not_found` with the anchored set.
- **Amounts can be zero or negative, and neither means "bought".** The table also holds
  `Smart Save Pro` at **-207.52** (a discount scheme, priced negative) and `Smart Use` at
  **0** (bundled free). The rule "a rupee amount next to the name proves purchase" would
  tick both. Rule corrected: an amount at or below zero, absent from the declared list,
  is `check_manually`, never a tick.

**Known defect in the probe, to fix in Phase 1:** the UIN scan runs over the whole
document, so it also picks up the product's own UIN from the footer
(`UIN: IRDAN102RP0004V03201617`) as a phantom priced line. Harmless here because it
matches no catalog entry, but the scan must be scoped to the own-damage `ADD:` block.
Evidence strings also need cleaning before display: they currently carry the `ADD:`
prefix and stray parentheses.

### The bike policy: ICICI Lombard two-wheeler, run 2026-09-08

Honda Activa 125, brand new (2025), IDV Rs 85,000, 3 pages, 12,683 characters, readable.
A different insurer and a different vehicle class, which is what makes it the real test.

**Both channels that worked on Royal Sundaram are absent here.** The string "add-on"
appears **zero** times in the entire document, and the only IRDAI UIN present is the
product's own, repeated three times, with no per-add-on UINs. A detector built on the
first policy alone would have returned "unknown" and been useless on the second insurer.

**A third channel rescues it, and it is stronger than the other two.** The premium table
reads `Basic OD Premium 556.00 / Sub Total 556.00 / Total Own Damage Premium(A) 556.00`.
Total own-damage premium minus basic own-damage premium is **zero**, so there is no
add-on premium to be had. That is an arithmetic **proof** of absence, not a failure to
find words, and it is the difference between telling an agent "we could not find zero
depreciation" and telling them "this policy has no add-ons, here is the arithmetic".
Result: **0 of 9, `absent_proven`** on every line.

Phrasing differs between insurers ("Basic OD Premium" against "Basic premium on
Vehicle"), so Phase 1 needs a small catalog of table phrasings, not one regex.

### A bike-only false positive that only a real bike policy would have shown

The Honda is sold as **"ACTIVA 125 DISC OBD2B Solo With Pillion"**. That is the seating
variant in the model name. A `pillion` alias ticks Pillion Rider Cover on a policy that
has none. The same document also has `Additional Accessories (Rs)` and
`Electrical / Electronic Accessories (Rs)` as IDV table headers, both valued 0.00, which
a loose `accessories` alias reads as an accessories cover.

Mitigation, now proven on both policies: mask the regions that describe the **vehicle**
rather than its **cover** (engine no., chassis no., invoice no./date, make/model) before
any matching runs. With masking, both stay correctly absent.

### The completeness self-check

On the car, the named add-on lines total Rs 5,075.20 and the NCB deduction is Rs -518.80,
against an own-damage headroom of Rs 4,556. **Unexplained: Rs 0.40**, which is rounding.
Every rupee of add-on premium the customer paid is accounted for by a named line.

This is worth building in as a standing check. When the unexplained remainder is
material, the catalog has a hole, and the honest output is "this policy carries Rs X of
add-on premium we could not name" rather than a quietly short list. It converts the
worst failure mode, silent under-reporting, into a visible one.

**Gate status: PASSED.** Two insurers, two vehicle classes, one policy with four add-ons
and one with none, both read correctly with evidence. Three channels, and neither of the
first two is present in both documents, which is the argument for keeping all three.
More insurers will still be wanted before the catalog is called complete, but there is
no longer a reason to hold Phase 1.

## 7. Build phases

### Phase 0: Probe. No product code. **This is the gate.**

A throwaway script in the scratchpad (not the repo) that takes the two PDFs, runs pdf.js
text extraction locally, and prints for each candidate add-on: matched or not, the
surrounding 120 characters, and whether a rupee amount or affirmative token sits next to
it. Also dumps the section headers it can find, so we learn what the real premium-table
structure looks like on these two insurers.

Zero Gemini calls. `extractTextFromPDF` is a pure local pdf.js read, so the probe costs
nothing. (It lives inside `routes.ts`, so importing it would boot the express app and the
DB pool. The probe duplicates its ~20 lines instead. If the feature proceeds, that
function should move to a service module.)

Output: a short report saying, per policy, what is reliably detectable and what is not.

**Decision gate.** If a car and a bike policy from two different insurers both yield
clean, evidence-backed detection, proceed. If detection only works by matching loose
prose, stop and say so, because the honest version of this feature would be guessing.

### Phase 1: Catalog and detector, pure and tested

- `shared/motorAddOns.ts`: two catalogs, `car` and `bike`, genuinely different sets
  (pillion and helmet cover on two-wheeler; engine protect, tyre, key replacement mostly
  four-wheeler). Each entry: `id`, `label`, `aliases[]`, `negativeAliases[]`,
  `eligibility`, `recommended`.
- `detectMotorAddOns(policyText, facts) -> { items: Finding[], applicable, present }`.
  Pure function, no I/O, no network. `Finding = { id, state, evidence, offset }`.
- Unit tests in `backend/server/tests/motorAddOns.test.ts` against text fixtures cut from
  the two real policies, with the policy number, registration, engine and chassis numbers
  and the holder's name scrubbed first. Fixtures go in `tests/fixtures/`, matching the
  existing pattern.
- Adversarial fixtures too: a wording booklet, a third-party-only policy, and a schedule
  that lists non-opted add-ons. These are the tests that stop failure modes (a) and (b)
  regressing.

### Phase 2: Wire in

- Add to `EXTRACTION_FIELDS.motor`, **both copies**: `vehicle_class`
  (two-wheeler / private car / commercial) and `add_on_covers` (text, what the model sees
  in the add-on block).
- The AI-read `add_on_covers` is a **reconciliation signal, not a source of truth**. If it
  names an add-on the deterministic pass did not confirm, the item becomes
  `check_manually`. It can never promote something to a tick on its own. That keeps every
  displayed claim traceable to a quoted line.
- Call the detector inside `extractStructuredData` and write `add_on_findings` into the
  returned data. All four routes inherit it with no route changes.
- Fix §6 first.

### Phase 3: UI

One card on `pages/agent/PolicyDetail.tsx`, in the `isDataEntry` branch beside
`ExtractedDataForm`, motor only. Three visual states, evidence on tap, applicable-only
denominator, vehicle-class override the agent can correct. Held to the 40+ agent lens:
14px floor, 44px targets, Hindi strings added to `hi.json` in the same commit.

### Phase 4: Not now

Renewal pitch ("your customer is missing engine protect, quote it"), portfolio-wide
gap rollup, customer-facing shared report. Each is a separate plan. Phase 4 is the actual
business value, which is a reason to get phases 0 to 3 honest.

## 8. Unhappy paths to exercise before calling it done

- Scanned photo of a policy. `extractTextFromPDF` throws `scanned_unreadable` under 200
  characters, so the card must not render an empty 0/9. It must say the document could not
  be read as text.
- Third-party-only policy. Whole checklist not applicable, one sentence, no red.
- Wording booklet uploaded instead of the schedule.
- Vehicle class wrong or unreadable. Card must ask rather than assume a car.
- `manufacturing_year` null. Eligibility gates cannot run, so gated items are
  `check_manually`, not `not_found`.
- Agent edits and saves the form (see §6), then reloads. Findings must survive.
- 375px width.

## 9. Founder decisions. Escalate, do not guess.

1. **Which add-ons are "recommended"**, separately for car and bike. This becomes a public
   claim the moment an agent forwards a report. Needs a stated basis.
2. **Is the score shown as a number at all?** "6 of 9" invites an agent to sell the other
   three. That may be exactly the point, or it may read as pressure selling.
3. **Does this reach the customer-facing shared report, or stay agent-only?**
4. **Do we display cost ranges?** The figures sitting in `vehicle-rider-data.ts` today
   have no source and must not be shown until they have one.

## 10. Reversibility

Additive. New shared module, two new extraction fields, one new card. No migration:
findings live in the existing `extracted_data` jsonb. Removing the feature is deleting the
card; stale findings in old rows are ignored, not shown. Nothing is deleted or overwritten
except by the §6 fix, which restores data that is currently being lost.

## 11. What I need from you

The two PDFs, one bike and one car. Ideally the **schedule / certificate**, not the
wording booklet, and if you have both formats for the same policy, send both, because that
is the exact case that breaks a naive version.
