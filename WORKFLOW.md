# WORKFLOW.md — Plan → Critique → Finalize → Execute

> Read with `rules.md`. `rules.md` says *what* the code must do. This says *how* work moves
> from idea to shipped, and where the critic sits.

## Why this exists

The 2026-08-23 audit found 355 UI/UX findings (24 Critical) in a codebase written almost
entirely by AI, in sessions that each looked successful at the time. The causes were not
carelessness — they were structural, and each one has a stage below that closes it:

| What went wrong | Stage that closes it |
|---|---|
| Placeholder content shipped as fact ("10,000+ Policies Decoded" vs ~46 real) | **Plan** — Claims Ledger |
| Copy stayed true to a product that changed underneath it ("no signup required") | **Plan** — Blast Radius |
| Each session optimised locally; whole-app invariants held by nobody | **Critique** — Standing Invariants |
| Only the happy path was ever exercised (dead `catch`, autosave off, wiped reports) | **Execute** — Unhappy Path Gate |
| Rules were written down and then decayed anyway | **Guard** — `npm run guard` |

**The last row is the important one.** `rules.md` already banned `console.log` in production
and storing policy data in `sessionStorage`. Both shipped anyway. A rule nobody verifies is a
preference. Every rule in this file that *can* be machine-checked **is**, in `checks/guard.mjs`.

---

## Tiering — pick this first

A four-stage gate on every change gets abandoned in a week. Match ceremony to risk.

| Tier | What it is | Loop |
|---|---|---|
| **T0 — Trivial** | Styling, copy fix, ≤2 files. No new user-visible promise, no data write, no delete. | Execute + Guard |
| **T1 — Standard** | A feature inside one existing surface. | Short Plan → inline Critique → Execute + Guard |
| **T2 — Heavy** | New surface, schema/migration, anything touching **deletion, money, public claims, auth, or personal data**. Anything going to prod. | Full loop, independent critic agent |

When unsure, go one tier up. Anything that would appear in a demo to an investor or a
regulator is T2.

---

## Stage 1 — PLAN

Written before any code. T1 can be a few lines in chat; T2 goes in `docs/plans/<date>-<slug>.md`.

**1. Goal** — one sentence. What can the user do after this that they cannot do now?

**2. Claims Ledger** — *the anti-fabrication gate.* List every user-visible assertion this
change introduces, with its source of truth:

| Claim shown to user | Source of truth | Verified |
|---|---|---|
| "46 policies analysed" | `SELECT count(*) FROM policy_analyses` | 2026-08-23 |
| "Free for 30 days" | `checkIndividualQuota` in routes.ts | 2026-08-23 |

**A claim with no source does not ship.** Not as a placeholder, not as lorem, not "we'll fix
it later". Write `TODO(claim)` and leave the slot visibly empty instead — an empty slot gets
noticed, a plausible fake number does not. This is the single rule that would have prevented
the worst of the audit.

**3. Blast Radius** — what does this change make *false or stale* elsewhere? Search the public
pages for anything describing the behaviour you are altering. Gating the policychecker behind
an account is what made "No signup required" a lie on three pages; nobody checked.

**4. Unhappy paths** — name the ones this feature must survive, before building:
refresh mid-flow · browser Back · failed request · empty state · slow 3G · 375px ·
email-confirmation round trip in a new tab.

**5. Reversibility** — what can this destroy, and how does the user undo it?

**6. Founder decisions** — anything that commits the company to a promise, a price, or a
retention policy. **Escalate, never guess.** Guessing is how the pricing page ended up
contradicting its own source comment.

---

## Stage 2 — CRITIQUE

A different posture, before code exists. The builder wants it to work; the critic assumes it
does not. For **T2, spawn an independent critic agent** that has not seen the plan's rationale
— only its output. For T1 it is an explicit separate pass, not a feeling.

Findings are stated as **failures with evidence** (`file:line`), never as suggestions.

### The Seven Sins — the standing checklist

1. **Fabricated proof.** Any number, testimonial, logo, count, or "trusted by" with no source.
2. **Claim drift.** Does this make an existing public statement false?
3. **Silent destruction.** For every delete/dismiss/remove: does the *label* match the *code*?
   Is the result checked? Is it reversible? Does the toast tell the truth?
4. **Lost work.** Refresh, Back, tab switch, new-tab auth round trip.
5. **Dead feedback.** Does failure reach the user in language they understand? Does success
   confirm? Is the toast system it uses actually mounted?
6. **Legibility floor.** Sub-14px content type, sub-4.5:1 contrast, sub-44px tap targets,
   English-only strings — measured against the 40+ agent lens, not against your own screen.
7. **Pattern propagation.** Am I copying a pattern I have not verified — *including my own from
   an earlier session?* `text-[11px] sm:text-[10px]` reached 19 sites in one file this way.

### Standing Invariants — true app-wide, not per-feature

- **Honesty** — every claim traces to a source of truth.
- **Reversibility** — nothing destroys user data without a real confirmation and a real undo.
- **Legibility** — 14px floor for content, 4.5:1 contrast, 44px targets.
- **Reachability** — every phone number is tap-to-call and tap-to-WhatsApp. Non-negotiable
  for this audience.
- **Language** — a string added to a translated surface is added to `hi.json` in the same
  commit, or the surface is honestly marked English-only.

---

## Stage 3 — FINALIZE

Resolve every critique item to exactly one of:

- **Fixed** — plan amended.
- **Accepted** — shipping anyway, with the reason written down.
- **Escalated** — founder decision required. Work stops on that item; the rest proceeds.

Then **lock the scope.** Anything discovered later becomes a new item, not a silent addition.
Output is a short decision log — the record of *why*, which is what no git diff preserves.

---

## Stage 4 — EXECUTE

Build to the locked plan. Then:

1. **Unhappy Path Gate** — actually exercise the paths named in Plan §4. Refresh the wizard.
   Press Back on the report. Kill the network mid-upload. The audit's worst bugs all survived
   because only the demo path was ever walked.
2. **`npm run guard`** — must pass. It is the part that survives forgetting.
3. **Update the Claims Ledger** if reality moved.
4. **Report honestly** — what shipped, what was skipped, what is still assumed. If a step was
   not done, say so.

---

## The Guard

```bash
cd IndSure && npm run guard
```

Machine-checks what can be machine-checked: fabricated-number patterns and unsourced claims on
public pages, `console.log` in shipped code, personal data in web storage, unchecked `.delete()`,
unmounted toast systems, sub-14px content type, low-contrast text tokens, inverted responsive
type, `target="_blank"` without `rel`, and the house copy rule ("AI"/"credits" as user-facing words).

It reports **FAIL** (blocks) and **WARN** (budgeted — the number must not grow). It cannot judge
whether a claim is *true*; only whether it is the *kind* of claim that needs a source. That
judgement stays in Stage 1.
