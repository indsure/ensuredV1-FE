# Document-sourced policy rules at upload, without model calls

Tier **T2**. Branch `feat/policy-document-rules` (worktree `E:\Indsurefi\_wt-surrender`), on top
of `fix/surrender-value-honesty` @ `7cc919c`. No push, merge, deploy or production DB change.

Decisions taken (founder, 2026-10-01): GSV factor stored exactly as printed with a review flag
for rounding; OCR with tesseract.js + @napi-rs/canvas, English data from the
`@tesseract.js-data/eng` package (no run-time download); PGlite for the migration dry-run.

## Findings from the private reference (not in the repo)

40 pages, all with an embedded text layer, two-column contract pages. Your oracle matches the
document except:
1. GSV factor rounding: the clause gives an exact formula; the insurer's illustration (p.40)
   only matches whole-percent rounding (year 8: 5,00,080 printed vs 4,96,080 exact).
2. Survival-benefit deduction timing: the illustration deducts (year - 1) years of the annual
   survival benefit; the clause says "applicable till date".
3. Revival has its own printed interest (9.5% p.a.) and reset rule (Part D 3, p.18).
4. The foreclosure exemption for in-force / fully paid-up says "exceeding the surrender value".
5. Rupee sign is extracted as a backtick; Maturity Date is printed although Maturity Benefit is
   NA; Final Premium Due Date 04/03/2030; premiums stated excluding taxes.
Definitions (p.8): Policy Anniversary = anniversary of the Date of Risk Commencement; Policy
Year excludes the next anniversary day; Total Premiums Paid excludes extra, rider premiums and
taxes; Annualized Premium excludes taxes, riders, extra premiums and modal loadings.

## Design

### A. Text acquisition (`backend/server/services/policyDocs/textLayer.ts`, `ocr.ts`)
pdfjs per page; items keep x/y/width/height; lines rebuilt per column (split at the page's
widest vertical gap, not a fixed midpoint); page label from the printed "Page n of m" footer
when present. Page quality: chars, ratio of letters, replacement characters. Only failing
pages go to OCR, in a `worker_threads` worker with a time limit; page rendered with
@napi-rs/canvas. Limits: 25 MB, 80 pages, 120 s total, MIME + `%PDF-` magic check. Corrupt /
password / empty: typed errors. OCR results carry the engine's confidence, never used as
approval. Temp files: none (in-memory buffers).

### B. Registry (`registry.ts`, `adapters/`)
`PolicyAdapter { id, version, describe, identify(doc): Identification, parse(doc): ParsedPolicy }`.
`identifyDocument` runs every registered adapter; exactly one `supported` match wins; none →
`unsupported`; more than one, or conflicting UIN/option evidence → `needs_review`. First
adapter: `hdfc-click2achieve-101N186V02` (Dream Achiever / Early Income only). Another
version, option or benefit choice refuses.

### C. Parser output (`types.ts`, `formula.ts`)
Field = found | not_applicable | missing | unsupported | conflicting, each with SourceRef
(document id + sha256, PDF page, printed page, clause, excerpt <= 200 chars of contract text,
region box, method, parser id/version, time). Money in integer paise; rates in basis points;
fractions as BigInt numerator/denominator. Formulas are a typed AST (const, var, add, sub, mul,
div, max) evaluated with exact rationals; no strings executed. Customer identifiers (name,
address, policy number) are never extracted by the adapter.

### D. Storage (`migrations/025_policy_document_rules.sql` + `_down.sql`)
`policy_source_documents`, `policy_document_parses`, `policy_rule_facts` (append-only
revisions), `product_rule_sets` (no customer data; promotion explicit, starts draft),
`rule_review_events`. RLS on all five; append-only tables have no UPDATE/DELETE policy.
Backend handlers also scope every query to the JWT agent id. Dry-run on PGlite, including RLS
tests with a non-superuser role.

### E. Review
Facts start `document_pending`. Only an explicit advisor action on a specific revision
confirms it; corrections append a revision; flags (rounding, rate-clause conflict, timing) are
resolved by an explicit decision with a reason. Re-parse with a new parser version adds new
pending revisions and never inherits approval; an advisor correction stays current.

### F. Calculation
`documentRules.ts` (frontend lib, shared to the bot) turns reviewed facts into results through
the existing gate: GSV floor (exact rationals; needs recorded premiums, deferral = No, rounding
flag resolved, labelled "GSV only, not the surrender value" while SSV is unavailable); paid-up
payouts; grace; loan and foreclosure rules as text. Surrender value, loan amount, loan interest,
revival amount: unavailable without SSV inputs / insurer rates / dated quote.

### G. Model isolation
`policyDocs/` imports nothing from `aiService`/`@google`. Test: stub every model entry point to
throw and run upload-to-review end to end. Gemini output for life/term never fills the
document fields; the valuation reads document facts for this path.

## Claims ledger, blast radius, unhappy paths
Claims: "From the policy document, page X" (SourceRef), "Pending your review" (fact state),
"Reviewed by you on D" (review event). Blast radius: upload route, re-run, policy card, docs.
Unhappy paths: scanned, mixed, corrupt, password, oversized, unknown layout, duplicate upload,
stale review tab, re-parse after review, one bad policy in the book.

## Critique and finalize (decision log)

| # | Finding | Resolution |
|---|---|---|
| 1 | Advisor-reviewed per-policy facts could be passed as a `verified` product rule set | **Fixed**: separate source `document_reviewed_by_advisor`; the product registry (`findVerifiedRuleSet`) is never fed from documents; test asserts it. |
| 2 | Backend pool bypasses RLS; stored `agent_id` copies can drift | **Fixed**: every handler query joins to `clients.agent_id`; composite foreign keys tie fact -> parse -> document to one policy; handler tests run the real SQL on PGlite with two advisors (read, write, review, re-parse). RLS is still written and tested, as defence in depth. |
| 3 | Gemini still runs on the same upload | **Fixed**: no model fallback for unsupported layouts; valuation of a document-path policy ignores Gemini-filled surrender fields; test runs ingestion with every model entry point stubbed to throw; re-run test. |
| 4 | Results not gated on all their dependencies | **Fixed**: each result lists the fact keys and flags it depends on; computed only when all are confirmed at their current revision and all flags resolved. |
| 5 | No revision/idempotency mechanism | **Fixed**: `expected_revision` -> 409; unique (client, sha256) and (document, parser, version); idempotency key on review events; per-policy advisory lock on parse. |
| 6 | Re-upload keeps a stale advisor correction silently | **Fixed**: a differing new document value against an advisor correction marks the field `conflicting`, showing both. |
| 7 | Excerpt privacy, document storage, promotion, logs | **Fixed**: excerpts only from adapter-matched label/value lines and clause text, never identity blocks; documents referenced in existing private storage, deleted with the policy (FK cascade); promotion is a pure stripping function with a test (no document id, hash or excerpt survives); route for it **escalated** (who may promote). Logs carry codes, never text. |
| 8 | No tests; oracle source | **Fixed**: synthetic fixtures generated from a clause template (digital, scanned, mixed) with Playwright; expected values hand-derived in comments. |
| 9 | OCR memory / cache | **Fixed**: one OCR worker per process with a queue, DPI and pixel caps, terminate on timeout, `cacheMethod: "none"`; deploy notes check the Linux canvas binary. |
| 10 | Deploy, backup, rollback, bot sync | **Fixed**: deploy doc with backup/rollback; down migration drops these tables (acceptable only before production data exists; stated); shared modules import-free and synced. |
| 11 | Identification too weak | **Fixed**: adapter checks a clause-heading fingerprint plus title and UIN; mismatch -> unsupported. |
| 12 | "GSV only" label as UI text | **Fixed**: typed `scope` field on the result. |
