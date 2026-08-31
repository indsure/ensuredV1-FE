# Plan — Data-loss fixes (Priority 1 of the 2026-08-23 audit)

**Tier: T2** — touches deletion paths and personal data. Full loop per `WORKFLOW.md`.
**Branch:** `pr-6` (working tree already carries unrelated WIP — commit selectively, never `git add -A`).

## 1. Goal

Stop the agent portal and consumer funnel from destroying user work, and make every
destructive control tell the truth about what it does.

## 2. Verification pass — before planning any fix

Every audit finding was re-read against source. **One Critical did not survive.**

| # | Audit claim | Verdict |
|---|---|---|
| 1 | `MyQueue` Dismiss hard-deletes the policy row | **Confirmed** — `.delete()` on `clients`, which holds policies |
| 2 | `PoliciesNew` delete never checks its result | **Confirmed** — `await supabase...delete()` with no `error` read; `catch` is unreachable. Also unscoped by `agent_id`, and uses `alert()` |
| 3 | `PolicyDetail` says "archives", hard-deletes | **Confirmed (partly)** — it does hard-delete, so "archives" is false. But the dialog's *share-link revocation* claim is **true**: `public_reports.client_id` is `ON DELETE CASCADE`. Only the wording is wrong |
| 4 | Leaving `/report` deletes the report | **FALSE POSITIVE** — `clearAuditState()` does clear it, but the cleanup is registered *after* the effect's early returns. On the session path the effect returns at `report.tsx:61`, so it never registers. Back works today. Dead code, latent hazard, not a live bug |
| 5 | "Upload a different file" keeps the old token | **Confirmed** — handler calls `setPending(null)` only; `sessionStorage` still holds the token, so signup redeems the discarded file |
| 6 | Upload orphaned when signup needs email confirmation | **Confirmed, but not fixable here** — see §6 |
| 7 | Calculator autosave disabled for agents | **Confirmed, and deliberate** — see §6 |
| 8 | `Compare` result lost on `reset()` | **Confirmed** — result is `useState` only, discarded with no confirmation |
| 9 | `SignupStep2` has no Back and no persistence | **Confirmed** |
| 10 | No delete anywhere in the consumer product | **Confirmed, but not fixable here** — see §6 |

The audit's `lib/pendingUpload.ts` line citations (`:206`, `:224`, `:254`) are wrong — the file
is 91 lines. Its `sessionStorage` choice is deliberate and documented in the file header.

## 3. Claims Ledger

Every user-visible assertion this change introduces or alters:

| Claim shown to user | Source of truth | Verified |
|---|---|---|
| "Removed from your queue. The policy is still in Policies." | `status='dismissed'` excluded by `MyQueue` filter `in('error','processing','pending')`; row still returned by the Policies query | 2026-08-23 |
| "Permanently delete this policy? This cannot be undone." | `supabase.from('clients').delete()` — a real hard delete | 2026-08-23 |
| "Share links will stop working." | `public_reports.client_id REFERENCES clients(id) ON DELETE CASCADE` (`setup_public_reports.sql:4`) | 2026-08-23 |
| "Your earlier file was discarded." | `clearPendingUpload()` removes the sessionStorage token | 2026-08-23 |

No new statistic, count, or capability claim is introduced.

## 4. Blast Radius

- **`status='dismissed'` is a new value on `clients.status`.** Safe: the column is
  `TEXT NOT NULL DEFAULT 'pending'` with **no CHECK constraint** (`002_individual_portfolio.sql:48`);
  the documented set is a comment, not an enforcement. No migration required.
- **Who reads `clients.status`?** `MyQueue` filters `in('error','processing','pending')` → dismissed
  rows drop out, which is the intent. Policies/Dashboard queries must be checked so a dismissed row
  does not silently vanish from the policy book — it must remain visible there.
- **Backend** writes only `pending|processing|done|error`; it never reads a status it did not write,
  so `dismissed` cannot confuse the pipeline. A re-run would move the row back to `processing`.
- **No public copy** describes dismiss/delete behaviour, so no marketing page goes stale.

## 5. Unhappy paths to exercise

Refresh mid-flow · browser Back · failed request (delete rejected by RLS) · empty state ·
375px · double-click the destructive button · dismiss then re-run the same policy.

## 6. Founder decisions — escalated, not guessed

These are **not** being fixed in this change. Each needs a decision from you:

1. **Consumer delete (audit #10).** `/start` promises "you can delete them anytime" and no delete
   exists. Needs a backend endpoint plus a decision: delete the policy row only, or the stored PDF
   and the account too? This is DPDP-facing — I will not guess the retention semantics.
2. **Upload orphaned by email confirmation (audit #6).** The token is deliberately in
   `sessionStorage` so it cannot resurface stale; opening the confirmation link in a new tab loses
   it. Fixing it properly means parking the upload against the signup email server-side, or passing
   the token through the redirect. Both are backend changes with a privacy trade-off.
3. **Agent calculator autosave (audit #7).** Enabling it would store a *customer's* health and
   income details in web storage — which `rules.md` explicitly bans. The current disabling is
   arguably correct. Interim fix below warns before losing work instead. Confirm you want it left off.
4. **`empanelments` vs `agents.partnered_companies`.** Signup writes one, the profile edits the
   other, and the calculator reads the second — so the signup answer is dead data. Which field is
   canonical?

## 7. Scope — what this change does

| # | Fix | File |
|---|---|---|
| A | Dismiss becomes non-destructive: `status='dismissed'`, truthful labels, and a note that the policy remains in Policies | `pages/agent/MyQueue.tsx` |
| B | Delete checks `error`, scopes to `agent_id`, refetches on failure, replaces `alert()` with a toast | `pages/agent/PoliciesNew.tsx` |
| C | Destructive copy tells the truth — drop "archives", state permanence and share-link revocation; scope to `agent_id` | `pages/agent/PolicyDetail.tsx` |
| D | "Upload a different file" clears the stored token | `components/PolicyUploadGate.tsx` |
| E | Confirm before discarding an unsaved comparison | `pages/agent/Compare.tsx` |
| F | Remove the misleading dead cleanup, with a comment explaining why it must not come back | `pages/report.tsx` |
| G | Back to step 1 without losing entered data | `pages/agent/SignupStep2.tsx` |
| H | Warn before navigating away from an in-progress agent calculation (no new storage) | `components/calculator/CoverCalculator.tsx` |

## 8. Reversibility

A is reversible by the user (the row survives; a re-run restores it). B and C remain genuine hard
deletes — the fix is that they now say so. D discards a token, and the server-side file expires in
24h regardless. F removes code that never ran. No migration, so rollback is a git revert.

## 9. Guard

`npm run guard` must show `unchecked-delete` at **0** and no rise in any WARN budget.

---

# Execution record — 2026-08-23

**Scope changed mid-flight.** The founder constrained this to UI/UX fixes, not product
changes. Fix A was re-scoped: the `status='dismissed'` soft-dismiss is a behaviour change, so
it was dropped. The button now tells the truth about the delete it already performs. The
soft-dismiss remains available as a separate, approvable product change.

## Shipped

| # | Fix | File | Note |
|---|---|---|---|
| A | `dismiss()` → `deletePolicy()`; button "Dismiss"→"Delete", confirm "Remove"→"Delete permanently?", toast now states it cannot be undone. Confirm control raised from 10-11px to 14px | `pages/agent/MyQueue.tsx` | Re-scoped: honest copy, not new behaviour |
| B | Delete now reads `{ error }`, scopes to `agent_id`, re-fetches on failure, toast replaces `alert()`. Second `alert()` on PDF download also replaced | `pages/agent/PoliciesNew.tsx` | The `catch` was unreachable — supabase-js resolves with `{error}` |
| C | `archivePolicy()` → `deletePolicy()`; dialog no longer claims "archives". Scoped to `agent_id` | `pages/agent/PolicyDetail.tsx` | Share-link revocation claim verified TRUE (cascade) and kept |
| D | "Upload a different file" now calls `clearPendingUpload()` | `components/PolicyUploadGate.tsx` | |
| E | Discarding an unsaved comparison now asks first | `pages/agent/Compare.tsx` | |
| F | Removed the unmount `clearAuditState()` + now-unused `useAnalysis` wiring | `pages/report.tsx` | **Upgraded from "dead code" — see below** |
| G | `beforeunload` guard on unsaved insurer selections | `pages/agent/SignupStep2.tsx` | Partial — see Not done |
| H | `beforeunload` guard on in-progress agent calculations | `components/calculator/CoverCalculator.tsx` | Autosave deliberately left off |

## Finding F was wrong in the plan, and worse than stated

The plan called audit #4 a false positive on the grounds that the cleanup never registers.
Half right. It never registers for a *valid* report — but the path where it DOES register is
the one with no id and no valid stored report, **which is exactly an analysis still running**.
`clearAuditState()` removes `IndSure_current_job` as well as `IndSure_report`, so opening
`/report` mid-analysis and navigating away destroyed the browser's only handle on the job:
both readers (`use-analysis.tsx:161`, `MobileNav.tsx:20`) came up empty, polling never resumed,
and the finished result was never written back. Live bug, now fixed.

## Not done — still open

- **A real Back on signup step 2.** The account is created before step 2, so Back is a flow
  change, not a UI fix. Escalated.
- The four founder decisions in §6 are unchanged and still blocking.
- **New finding, not fixed:** the CONSUMER calculator autosave writes wizard inputs — age,
  income, dependants, health — to `localStorage` (`calculator-storage.ts:139`). `rules.md`
  forbids personal data in web storage. Turning it off is a product change, so it is reported
  rather than actioned.

## Verification

- `npx tsc --noEmit` — **clean** (run from `frontend/`, confirmed correct project).
- `npm run guard` — **`unchecked-delete` now 0**, the stated exit criterion. Every WARN budget
  fell: sub-14px 988→986, low-contrast 397→395, native dialogs 8→6. None rose.
- Guard bug found and fixed in the process: the `unchecked-delete` rule scanned only forwards
  and scored the idiomatic `const { error: dErr } = await …delete()` as unchecked. Window now
  looks 4 lines back; regression-tested against the original bug shape, still caught.
- **Not browser-verified.** These paths are behind agent auth, and exercising the analysis
  flow would spend real Gemini credit. Correctness rests on typecheck, guard and code review.
- 204 guard FAILs remain, all pre-existing and outside this change set: 149 inverted-type-scale,
  30 unsourced-claim (the pricing/claims cluster awaiting founder decisions), 17
  blank-without-rel, 6 console-log, 1 pii-in-storage, 1 toaster-not-mounted.

Nothing committed. Working tree carries unrelated pre-existing WIP — commit selectively.
