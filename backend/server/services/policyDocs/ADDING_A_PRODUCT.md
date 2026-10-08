# Adding a product to the policy-terms reader

One adapter supports one observed layout of one product version (insurer + full UIN with its
version + plan option + benefit variant). A sample PDF bootstraps support for that layout
only, not for every policy sold under the brand.

## Checklist

1. **Get a private sample.** A real policy document for the exact UIN and version, option and
   benefit variant. Keep it outside the repo (for example `E:\Indsurefi\_private_ref`). Never
   commit it, log its text, or paste names, addresses, policy numbers, signatures or QR codes
   anywhere.
2. **Read it privately.** Use the text layer (`acquireText`) to find the schedule rows and the
   clauses for surrender, paid-up, revival, loans and grace. Note PDF page, printed page and
   clause numbers. Write down every number and formula as printed.
3. **Make synthetic fixtures.** Copy the layout, not the person: extend
   `tests/fixtures/policyDocs/template.mjs` (or add a sibling template) with placeholder
   identity rows and only the wording the reader needs. Regenerate with `generate.mjs`.
   Inspect each PDF's text and metadata before committing (the parser test does a leak check).
4. **Write the adapter** from `adapters/TEMPLATE.md`:
   - `identify()` must check the title, the exact UIN, the option and benefit, and a
     clause-heading fingerprint. Anything else returns `no_match` or `conflict`.
   - Read each field by exact wording; give every field a `SourceRef`.
   - Never default, never interpolate unless the clause states it, never repair OCR text.
   - Raise a `ReviewFlag` for anything the wording leaves open.
5. **Register it** with one `register(...)` line in `index.ts`. Nothing else changes.
6. **Tests:** golden digital fixture (every field and source), variant refusals (other
   version, option, missing UIN, conflicting values, altered formula), an OCR fixture, and
   numeric boundary tests for its formulas with hand-worked expected values.
7. **Check against the private sample** with a private script that prints only
   MATCH / MISMATCH (see `_private_ref/oracle_check.ts`).
8. **Advisor review.** An advisor checks the extracted rules and applicability. Different
   versions, variants, riders or layouts need their own samples; never guess missing tables.
9. Until then, documents for that product stay visible as **unsupported**, with the reason.
