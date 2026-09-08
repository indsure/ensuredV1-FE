# Effective Cover = what the policy can pay in ONE event

**Tier:** T2 (public-facing claim, scoring change, ships to beta)
**Date:** 2026-09-08
**Founder decision on record:** "Effective cover, that it can pay in 1 event."

## 1. Goal

The report's headline cover number, the NCAR adequacy ratio, the cover stack and the
PDF all state the same figure, computed in code from structured facts, and that figure
is what the policy can pay for a single hospitalisation.

## 2. Root cause (why this is a schema change, not a rule tweak)

The NEC rule at `promptTemplate.ts:238` turns on one fact: does the restore fire for the
SAME illness. `coverage_structure.restoration` has no field for it. It offers `exists`,
`type`, `restore_amount`, `trigger_conditions` (free prose), `actually_useful`, `remarks`.

So the model has nowhere to record that it counted a restore. The only way it can express
the decision is by inflating `total_effective_coverage`. Nothing can audit that, and three
separate model-authored numbers describe the same quantity with nothing forcing agreement:

- `coverage_structure.total_effective_coverage` -> the header
- `audit_score.nec` -> NCAR and the score
- `cover_stack.combined_effective_cover` -> the stack and the PDF

Report `1b520f0d` (ManipalCigna Lifetime Health, base 1Cr) shows the failure: header and
stack say 2.0Cr, NCAR 16.67x against RCT 6L implies nec = 1.0Cr. Same report, two answers.

## 3. Claims Ledger

| Claim shown to user | Source of truth | Verified |
|---|---|---|
| "Effective Cover Rs X" | `calculateEffectiveCoverage()` in `shared/policy.ts`, = base_sum_insured + no_claim_bonus.current_bonus + top-up only where deductible_achievable | pending |
| "NCAR N x" | `audit_score.nec / audit_score.rct`, nec forced equal to the above | pending |
| "Usable cover across all policies" | `cover_stack.combined_effective_cover`, forced consistent with the above | pending |
| Restoration line ("refilled without limit, same illness included") | `coverage_structure.restoration.{unlimited, same_illness_covered, triggers_on_first_claim}` extracted from wording, prose source retained in `trigger_conditions` | pending |

No claim ships without its structured field. Restoration prose alone is not a source.

## 4. Blast Radius

| Surface | Effect |
|---|---|
| `CoverageDiagnostic.tsx:90` stress test | Currently fed the 2-event number for a SINGLE-event test. This fix corrects it. More scenarios will correctly show as failing. |
| `PolicyPDFDocument.tsx:653` | Reads `cover_stack.combined_effective_cover` directly, so PDF and web can disagree today. Forced consistent. |
| `playground/seed.ts:187` | Already computes base + NCB with no restoration. Demo path and real path currently disagree; this makes them agree. No change needed. |
| `mock-data.ts:76,306,413` | Static fixtures. Recheck values against the new rule. |
| Public marketing copy | Grepped `pages/`. Only `blog-data.ts` uses "effective coverage" generically about gaps. No claim drift. |
| Stored `public_reports` (13 rows) | Frozen JSON, not rewritten. Old shared links keep the numbers they were issued with. Accepted: rewriting history would cost a paid re-run per report and change a number a customer was already shown. |
| Score comparability | PROMPT_VERSION 1.2.0 -> 1.3.0. Job rows stamp prompt_version, so comparisons split on that column as they did at 1.1.0 -> 1.2.0. |

## 5. Scoring consequence

Restoration leaves STEP 1. Under the ANTI-DOUBLE-COUNT RULE it needs exactly one home,
so it moves to STEP 4 (Coverage Quality Gap) as a small deduction:

| Restoration state | Penalty |
|---|---|
| Same-illness restore present | 0 |
| Unrelated-illness only | -2 |
| Absent entirely | -5 |

Conservative on purpose: small enough not to swing a verdict alone. This magnitude is the
one dial worth arguing about and is flagged for founder review, not escalated, because it
does not commit the company to a promise.

Expected effect: policies with NCAR far above 1.0 are unaffected (report `1b520f0d` scores
identically either way). Thin policies where a restore was carrying NCAR over 1.0 will
correctly drop, by up to ~18 points where the ratio crosses a band.

## 6. Unhappy paths

- Model omits the new booleans -> treat null as "not counted", never as true. Absence must
  never inflate cover.
- `restore_amount` typed `number | string` -> never used in arithmetic; only the booleans are.
- Top-up present but `deductible_achievable` null -> excluded. Current code adds top-ups
  unconditionally on `exists`, ignoring the bridge test, which contradicts the prompt. Fixed.
- Older stored reports lacking the new fields -> renderer must not crash. Fall back to base.

## 7. Reversibility

Prompt and code change only, no migration, no data written. Revert = revert the commit and
redeploy. Stored reports are untouched either way.

## 8. Founder decisions

- **Decided:** effective cover = single-event. On record above.
- **Decided:** one paid Gemini run authorised for verification. Spend it last, after the
  code path is proven deterministically.
- **Decided:** ships to beta (pr-6).
- **Flagged, not blocking:** the STEP 4 restoration magnitudes in section 5.

---

# Stage 2/3: CRITIQUE and DECISION LOG

Independent critic run against the diff without the rationale. 14 findings, all resolved.

| # | Finding | Resolution |
|---|---|---|
| F1 | **Critical.** The headline was recomputed client-side for EVERY report while the stack, NCAR and verdict beside it stayed stored, so the whole pre-1.3.0 archive would render 1.0Cr next to 2.0Cr: the exact defect this change removes. | **Fixed.** New `deriveCoverView` in shared/policy.ts derives every cover figure on the page from one number. Renderer and PDF both use it. Verified on the real stored report. |
| F2 | **Critical.** With no base sum insured, a percentage NCB of 50 became "Effective Cover Rs 50", driving ncar 0.0001, a 60-point penalty and INADEQUATE. The `base >= 100000` guard could not fire. | **Fixed.** Base <= 0 returns 0 ("not extracted") in both implementations; callers leave the report alone. Test added. |
| F3 | **High.** `Math.min(rawNcb, base)` turned a bad 5Cr bonus into a clean 2.0Cr headline on a 1Cr policy, and the test asserted it. | **Fixed.** Bonus above its `cap_percentage` (or base) is DROPPED, not clamped. The wrong test was rewritten. |
| F4 | **High.** Cover was lowered unconditionally but ncar/verdict/ratio were corrected only inside `enforceRequiredCover`, which early-returns when `identity.ages` is missing. | **Fixed.** `reconcileEffectiveCover` now derives ncar, penalty, stack ratio and verdict itself. |
| F5 | **High.** The correction was written to `confidence_notes`, which no renderer reads. | **Fixed.** `coverView.restated` drives a visible line under the headline. |
| F6 | **High.** `describeRestoration` asserted "refills once the cover is used up" from a null, i.e. fabricated a claim on every pre-1.3.0 report. | **Fixed.** Returns null unless the booleans are actually present, and stays silent when `actually_useful` is false. Sample and playground fixtures given real values. |
| F7 | **Medium.** Re-summing `other_cover` dropped any companion policy that omitted the optional `usable_today`, while the prose still listed it. | **Fixed.** Companion portion is now the delta between the stated stack and the stated total. Test rewritten to prove employer cover survives. |
| F8 | **Medium.** The PDF lost the restoration information the change promised to keep visible. | **Fixed.** PDF uses the same derivation and prints the restoration line. |
| F9 | **Medium.** The prompt said "You do NOT compute the NEC total" and "Set audit_score.nec to the sum" in consecutive sentences. | **Fixed.** Rewritten: components are the job, the total is a checksum. |
| F10 | **Medium.** STEP 4 priced no row for `same_illness_covered: null`, a reachable state. | **Fixed.** Unclear is priced as the weaker case (−2), with the reason stated. |
| F11 | **Low.** A comment named a test file that does not exist. | **Fixed.** |
| F12 | **Low.** The parity suite missed the four expressions written twice. | **Fixed.** Seven more cases: the cap rule, the percentage sentinel, absent base, absent NCB object, unbridged super top-up. |
| F13 | **Low.** The declared JSON contract lacked the three new fields. | **Fixed.** |
| F14 | **High.** `reconcileEffectiveCover` ran on motor and life reports, whose prompts define `total_effective_coverage` as the IDV and as sum assured plus riders. | **Fixed.** Server-side gated to `insuranceType === "health"`. Client-side, where no type marker exists on the report, the derivation only lowers a stored figure when a restoration can explain the gap; otherwise it leaves it alone. |

## Verification

- 113/113 backend tests, `npm run guard` PASS with no budget growth, both typechecks clean.
- Real stored report `1b520f0d` replayed: header, nec, stack and NCAR all land on 1Cr / 16.67 with no DB rewrite, restoration moved from Counted to Excluded, stale remarks suppressed.
- Non-health shape (larger stored total, no restoration) verified unchanged at 2.5Cr.

## ESCALATED, work stopped on this item

**There is one backend.** `api.indsure.in` serves both indsure.in and beta.indsure.in
(`queryClient.ts:20` is the hardcoded fallback base). So the backend half of this change
(prompt 1.3.0 + the reconciler) cannot go to beta without also changing production.

The frontend half is beta-only and safe on its own: `deriveCoverView` corrects reports at
read time, so beta shows single-event cover even while the backend still writes 1.2.0
output. Prod is unaffected because prod builds from main.

Founder decision required before the EC2 deploy, and before spending the single authorised
Gemini run (which can only test a deployed prompt).
