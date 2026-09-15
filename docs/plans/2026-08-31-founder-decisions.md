# Decision log - 2026-08-31

The eight items that were blocked on a founder decision, and what was decided. Recorded
because this is the part no git diff preserves.

| # | Question | Decision |
|---|---|---|
| 1 | Backup destination | **Cloudflare R2 as built.** Founder creates the account, bucket and token. Everything else is installed and proven |
| 2 | Consumer delete, promised on `/start`, does not exist | **Per-policy delete.** Removes the policy row, its analysis and the uploaded PDF. Account survives |
| 3 | "10,000+ analyzed" on `/life`, `/vehicle`, `/mission` vs **48** real analyses | **Delete the number, put a true non-numeric claim in its place** |
| 4 | "No signup required" on `/help` and `/vision`, false since the consumer gate | **Rewrite both to the truth**: free account, email only, one policy of each type free forever, no card |
| 5 | `SignupStep1` writes the agent's own details to sessionStorage, banned by rules.md | **Keep it, write the exception down.** Narrow commented guard exemption naming the key, plus clear the draft once signup completes |
| 6 | Cover calculator autosave | **Agent stays off** (warn-only, as shipped). **Consumer moves localStorage to sessionStorage** so health and income die with the tab on a shared machine |
| 7 | Upload orphaned when the confirmation email opens in another tab | **Claim by confirmed email.** Add `signup_email` to `pending_uploads`; no token travels in a URL |
| 8 | 148 sites where type shrinks on larger screens | **Kill the inversion, floor label type at 12px.** Verify with desktop and 375px screenshots |

## Corrected on the way in

**"Free forever" is true and needs no fix.** It was on the suspect list from an earlier note
claiming it contradicted a 30-day trial. It does not: `routes.ts:784` says free is limited by
slots, not time, and the comment above `TRIAL_DAYS` records that the constant no longer gates
anything. Verified before asking, so it was never put to the founder as a problem.

## Order of work

Public falsehoods first (3, 4), then the mechanical legibility pass (8), then the small
correctness items (5, 6), then the two schema changes (7, 1 backfill), then the largest build
(2). Backups (1) are unblocked only by the founder.
