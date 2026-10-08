# WhatsApp bot: base policy + super top-up as ONE check (2026-10-08)

Tier: **T2** (money: policy-check credits; ships to prod via EC2).
Status: PLAN, critiqued and FINALIZED (see decision log at the end, it overrides sections
2 to 5 where they differ). Nothing built.

## Trigger

Deep sent a base health policy and its super top-up to the bot. The bot ran 2 separate
checks, spent 2 credits, sent 2 reports, and never said whether they belong to the same
person.

Root cause (verified in code):

- `pdfIn` (whatsapp-bot/src/core/bot.ts:344) treats every PDF as its own job. One PDF = one
  `/api/agent/analyze` call = 1 credit.
- The engine ALREADY supports the combined check: `/api/agent/analyze` takes
  `companion_super_topup` beside `file` (backend/server/routes.ts:3761), reads both in one
  audit, and charges once (routes.ts:4138). The portal uses it; the bot never sends it
  (whatsapp-bot/src/engine.ts:177).
- `pdfInspect` (whatsapp-bot/src/core/pdfInspect.ts) can only say "health"; it has no idea
  what a super top-up is.
- Nothing anywhere compares the insured names on the two documents.

## 1. Goal

An advisor can send a base health policy and a super top-up (in either order) and get ONE
report covering both, for 1 policy check, with the bot telling them whether the two
documents name the same person.

## Founder decisions (taken 2026-10-08)

- Base + super top-up together = **1 credit** (same as the portal).
- **Ask, don't wait.** No silent hold timer; the bot asks a question.

## 2. Design

### 2a. Detection (free, regex on text the bot already extracts)

`pdfInspect.inspectPdf` gains `topUp: boolean` and `names: string[]`.

- `topUp`: true when the text says it is a super top-up / top-up product. Signals: "super
  top[- ]?up", "top[- ]?up (plan|policy|cover)", "aggregate deductible", "deductible" defined
  as an amount the insured must cross. Scored like `guessType`, needs 2+ signals, so a base
  policy that merely ADVERTISES a top-up does not trip it. A false positive costs one
  question, never a credit.
- `names`: the insured / proposer names, from labelled fields ("Proposer Name", "Name of
  the Proposer", "Insured Name", "Name of Insured", "Policyholder Name", the member table).
  Normalised: lowercased, titles dropped (Mr, Mrs, Ms, Shri, Smt, Dr), punctuation removed.
- `sameInsured(a, b)` -> `"match" | "mismatch" | "unknown"`. Match = some name on one shares
  first name AND surname with some name on the other (a family floater top-up lists several
  members). Unknown = either side found no name (scans, odd layouts).

### 2b. Conversation flow

Two new states: `AWAITING_TOPUP` (holding a base, asked about a top-up) and
`AWAITING_BASE` (holding a top-up, asked for its base). Both reuse the existing held-file
machinery (`pending.file`, `dropHeldFile`, the 15-minute AWAITING expiry).

**A. Health base PDF arrives** (health guess, not `topUp`):
> Got it: **Ramesh Kumar**'s health policy.
> Does Ramesh also have a super top-up policy? Send that PDF now and I'll check both
> together for 1 policy check. Or reply NO to check this one alone.

- Reply NO (or "alone", "nahi", "only this") -> run the base alone, as today.
- Super top-up PDF arrives -> name check (2c) -> one combined check.
- Another BASE health PDF arrives -> the held one runs alone ("Checking Ramesh's policy on
  its own."), and the new one gets the question. (Handles an advisor sending several
  policies in a row: only the last one waits.)
- A non-health / unclassifiable PDF arrives -> see 2d.
- Any other text -> re-ask once, short.

**B. Super top-up PDF arrives first** (`topUp`, nothing held):
> This looks like a super top-up for **Ramesh Kumar**. Send the base health policy too and
> I'll check both together for 1 policy check. Or reply ALONE to check the top-up by itself.

- Base PDF arrives -> name check (2c) -> one combined check (base = `file`, top-up =
  `companion_super_topup`).
- ALONE -> top-up checked on its own, as today.

**C. Top-up arrives while a base is held** (state A): name check, then one check.

### 2c. Same-person check

| Result | Bot says | Then |
|---|---|---|
| match | "Same person: Ramesh Kumar. Checking both together, 1 policy check." | run combined |
| mismatch | "These name different people: base policy is **Ramesh Kumar**, super top-up is **Suresh Rao**. Reply YES if they are the same family cover and should be checked together, or NO to check them separately (2 policy checks)." | YES = combined; NO = both run alone |
| unknown | "I couldn't read the names on one of these to confirm it's the same person. Checking both together as one cover, 1 policy check." | run combined |

Unknown proceeds without a question because the advisor already paired them on purpose
(they sent the top-up in reply to our question). The message says plainly that it was not
verified.

### 2d. Edge cases

- **Scanned / unguessable PDF while holding** (no text, so no `topUp`, no names): ask
  "Is this the super top-up for Ramesh? Reply YES to check them together, or NO and I'll
  ask what kind of policy it is." YES = combined (names unknown). NO = held base runs alone,
  new file goes to today's AWAITING_TYPE.
- **Non-health PDF (motor/life etc.) while holding**: held base runs alone, new file follows
  today's path.
- **Duplicate check**: today a re-sent PDF hits `AWAITING_DUP_CONFIRM` by its own hash. A
  combined check is a different check from either document alone, so when a top-up is being
  attached the duplicate check is skipped for the base. (This is also how Deep re-runs the
  case that triggered this: resend both, get one combined report.)
- **Timeout**: AWAITING_* already lapses after 15 minutes and drops the held file. Nothing
  is charged. On the advisor's next message after a lapse, say once: "I didn't hear back
  about Ramesh's policy, so I didn't check it. Send it again when ready." (Today a lapse is
  silent.)
- **Out of checks**: unchanged; `enqueue` checks the balance before running. Combined = 1.
- **Bot restart mid-question**: the held file lives in tmp and the state in the backend
  conversation row, same as AWAITING_TYPE today. If tmp is gone, `T.resendFile()`.
- **Caption with a name** (`Ramesh 98xxxx`): still used for filing under a customer.
- **Queue**: a combined check is one QueueItem with an optional `companion: FileRef`.

### 2e. Report card

`reportCard` adds one line when a top-up was sent AND the engine actually read it:
"Checked together with the super top-up. Total cover is in the full report."

Source of truth for "actually read": `report_data.__companions[].read`, written by
routes.ts:4102. Needs a one-field addition to the bot's client summary
(backend/server/whatsapp/routes.ts, `companions`). If the top-up was sent but NOT read:
"I couldn't read the super top-up, so this report is for the base policy only." (The engine
never fails the audit on a bad companion, so without this the bot would claim a combined
report that isn't.)

### 2f. Files

| File | Change |
|---|---|
| whatsapp-bot/src/core/pdfInspect.ts | `topUp`, `names`, `sameInsured` |
| whatsapp-bot/src/core/bot.ts | 2 states, `pdfIn` branching, `onAwaiting` cases, `QueueItem.companion`, lapse notice |
| whatsapp-bot/src/engine.ts | `analyze` takes optional `companion` buffer -> `companion_super_topup` |
| whatsapp-bot/src/core/templates.ts | new lines; `received` reworded (it no longer always means "checking now") |
| whatsapp-bot/src/core/i18n.ts | Hinglish + Hindi for every new line |
| backend/server/whatsapp/routes.ts | `companions: [{kind, read}]` in client summary (ONE hunk; file has unrelated uncommitted WIP, do not sweep it) |
| whatsapp-bot/test/*.test.ts | flows below |
| docs (advisor /docs WhatsApp page) | mention sending both together |

No migration. No new Gemini call (detection and name matching are regex).

## 3. Claims Ledger

| Claim shown to advisor | Source of truth |
|---|---|
| "check both together for 1 policy check" | routes.ts:4138, one deduction per analyze request |
| "Same person: X" | `sameInsured` = match on names extracted from both PDFs |
| "These name different people: X / Y" | same, mismatch |
| "2 policy checks" (separately) | two analyze requests |
| "Checked together with the super top-up" | `__companions[].read === true` |
| "couldn't read the super top-up" | `__companions[].read === false` |
| "This looks like a super top-up" | `topUp` regex score (worded "looks like", it is a guess) |

## 4. Blast Radius

- `T.received` text "Checking this policy now" becomes false for flow A. Reworded.
- /docs WhatsApp assistant page and the connect-card guide describe "send a PDF, get a
  report". Still true; add one line about top-ups.
- Every health upload now gets one extra question. This is the cost of "ask, don't wait".
- Existing tests that send a health PDF and expect an immediate check must reply NO first.

## 5. Unhappy paths (each gets a test)

1. base -> NO -> 1 check
2. base -> top-up (names match) -> 1 combined check, companion sent
3. top-up -> base -> 1 combined check
4. base -> top-up (names differ) -> YES -> 1 combined; NO -> 2 checks
5. base -> base -> first runs alone, second asked
6. base -> scanned PDF -> YES / NO
7. base -> silence 15 min -> nothing charged, lapse notice on next message
8. base -> top-up with 0 checks left -> out-of-checks message, nothing run
9. top-up not readable by engine -> card says base only
10. Hindi / Hinglish replies ("nahi", "haan") work in both new states

## 6. Reversibility

No data destroyed. Worst case a pairing is wrong: the advisor re-sends the base alone (1
check). Rollback = redeploy the previous bot build; backend field is additive.

## 7. Deploy

Bot + one backend hunk -> EC2 via Deep's `_wa-deploy` DEPLOY .bat (Claude is blocked from
EC2). Splice the routes.ts hunk, never copy the whole file. Shared Supabase: no schema change.

## Open founder questions

1. **Refund the 2 credits** spent on the triggering test? (Admin action, Deep's call.)
2. **Lapse default** (proposed above): if the advisor never answers, NOTHING is checked and
   nothing charged, and they're told on their next message. Alternative: check the base
   alone after 15 minutes (spends a credit without a reply).

---

## Stage 2/3: Critique and decision log (2026-10-08)

Independent critic, read-only, verified against code. Every item resolved below. Where this
log differs from sections 2 to 5 above, THIS LOG WINS.

| # | Sev | Finding (evidence) | Resolution |
|---|---|---|---|
| 1 | Critical | Messages for one advisor run concurrently: each Baileys `messages.upsert` calls `handle` without waiting for the previous one (transport/baileys.ts:110-125); conversation save is last-write-wins (whatsapp/routes.ts:532-536); a test already fires 3 PDFs via `Promise.all` (test/bot.test.ts:130-142). Held files would be orphaned and states would race. | **Fixed.** Per-agent async mutex around `handle()` for document and text messages (same shape as the queue map, bot.ts:152). Test: base + top-up via `Promise.all` gives 1 combined check. |
| 2 | High | Top-ups sold under brand names (Health Recharge, Super Surplus, Extra Care Plus, Health Booster, Enhance) score as plain "health"; the "second base runs the first alone" rule would spend 2 credits again. | **Fixed.** While a base is held, ANY second health PDF gets: "Is this the super top-up for X? Reply YES to check together (1 check) or NO to check separately (2 checks)." Never auto-run. Brand-name list added to `topUp` detection as a hint only. |
| 3 | High | The duplicate check runs at arrival (bot.ts:382-386), before pairing; "a new PDF always starts a new flow" (bot.ts:351-354) deletes a held file; dup-YES (bot.ts:843) and the health type pick (bot.ts:837) enqueue directly, skipping the question. | **Fixed.** Pairing detection runs BEFORE the dup check. bot.ts:351-354 exempts the two new states. Dup-YES and the health type pick go to the top-up question instead of straight to enqueue. A top-up arriving during AWAITING_DUP_CONFIRM pairs with that held base. |
| 4 | High | The only sample (test_policies/Star_Health_Real_Policy.pdf, 428 pages) has NO insured/proposer labels in its text layer; the first 12 pages are a hospital list (pdfInspect.ts:109); joined text interleaves table headers with values (pdfInspect.ts:114). | **Fixed + Accepted.** Validate each captured name (letters only, 2 to 4 words, not a label word), scan up to 40 pages for name fields. Accepted: "unknown" will be the COMMON result. The "Same person: X" claim ships only after a fixture test passes on real kits from 3+ insurers (Deep to supply PDFs, or I pick from the corpus). |
| 5 | Medium | "Unknown means go ahead" could merge two different customers' policies into one report without consent. | **Fixed.** Unknown asks: "I couldn't read the names to confirm. Same person? Reply YES to check together, or NO to check separately." Costs a reply, not a credit. |
| 6 | Medium | Requiring both first name and surname to match flags "R. Kumar" / "KUMAR RAMESH" as different people. | **Fixed.** Mismatch only when NO name word overlaps. Initials, reordered names and surname-only overlap count as unknown (so the bot asks). |
| 7 | Medium | The backend reads companion PDFs as text only, with no OCR (routes.ts:683-688, 776; the error is swallowed at 4075). A scanned top-up always gives a base-only report. The comment at pdfInspect.ts:118 is wrong. | **Fixed.** If the top-up has too little text: "This super top-up is a scan and I can't read it. Reply YES to check the base policy alone (1 check), or send the insurer's original PDF." Comment at pdfInspect.ts:118 corrected. |
| 8 | Medium | On expiry `loadConv` resets `pending` to {} (bot.ts:284-287), so the held name is lost; `follow()` also calls `loadConv` (bot.ts:531), which would use up the lapse notice without showing it. | **Fixed.** On lapse, write a `lapsed: {name}` marker into the reset pending. Show it only from `onText` / `pdfIn`, then clear it. |
| 9 | Medium | `runItem` checks only the base file (bot.ts:455-461), so a missing top-up tmp silently gives a base-only check; the restart message says "send the PDF again", singular (bot.ts:576, templates.ts:118). | **Fixed.** Check both files exist before calling analyze. If either is missing, the resend message names both. |
| 10 | Low | Claims Ledger misses the two greeting lines that show a regex-extracted name. | **Fixed.** Added below. Names shown in Title Case; with no name: "Got it: a health policy." |
| 11 | Low | The question is asked even with 0 checks left. | **Fixed.** Check the balance first; at 0, show today's out-of-checks message and don't ask. |
| 12 | Low | No Hindi/Hinglish forms for ALONE; `localise` translates whole lines only (i18n.ts:462-468). | **Fixed.** Accept "sirf yeh", "akele", "alag", "सिर्फ यह", "अकेले", "अलग". One L() entry per line of every new multi-line message. |
| 13 | Low | `createJob` stores only the base sha (bot.ts:404). | **Fixed.** Store the companion sha in the job's existing free-form fields if one exists. If not, **Accepted** for v1: a later re-send of the top-up alone gets no duplicate warning, and no migration is added for this. |
| 14 | Low | ~14 bot tests + crm.test.ts:142 expect an immediate check; the fake `inspect` always returns "health"; `FakeEngine.analyze` (fakes.ts:115) has no companion. | **Fixed.** Rework those tests (send NO, or a fake inspect returning non-health); extend the fakes. Counted in the estimate. |

Verified OK by the critic: the companion field works with bot auth (routes.ts:819-828);
combined = ONE deduction, charged only on success (routes.ts:4136-4140); 25 MB per field
matches the bot's MAX_BYTES; companion reading is pdfjs text, no Gemini.

### Claims Ledger additions

| Claim | Source |
|---|---|
| "Got it: Ramesh Kumar's health policy." | validated name from `names`; omitted when none |
| "This looks like a super top-up for Ramesh Kumar." | `topUp` score + validated name; "looks like" because it is a guess |
| "This super top-up is a scan and I can't read it." | text length under MIN_TEXT, and routes.ts:683-688 (no OCR for companions) |

### Final flow (supersedes 2b/2c)

1. Health PDF in. 0 checks -> out-of-checks, stop. Otherwise inspect.
2. Nothing held: base -> ask "super top-up too? send it, or NO". Top-up -> ask "send the base, or ALONE".
3. Something held + a second health PDF (any kind, any order, incl. a duplicate) -> names:
   match -> "Same person: X. Checking both together, 1 check." ; mismatch or unknown -> ask
   YES (together) / NO (separately, 2 checks). A scanned top-up -> the item 7 message.
4. Something held + non-health PDF -> the held policy waits; the new file follows today's path.
   (Changed from "held runs alone": nothing runs without a reply.)
5. Silence 15 min -> nothing checked, nothing charged, lapse notice on the next message.

### Scope lock

In: super top-up only. Out (later items): corporate / Ayushman companions over WhatsApp,
a migration for the companion sha, refunding past double charges automatically.

### Still open for Deep

1. Refund the 2 credits from the test? (admin action)
2. Lapse default = nothing checked, nothing charged (recommended), or check the base alone?
3. Real policy kits (base + super top-up, 3+ insurers) for the name-matching fixture, or OK
   for me to pick them from the corpus folder.

---

## Stage 4: Build log (2026-10-08)

Founder answers: refund the 2 test credits (Deep, admin Agents page); a lapse checks
nothing and charges nothing; name fixtures from the corpus.

Built (uncommitted, in the _wt-wa worktree):

- Several PDFs at once: the held state is a LIST (`pending.held`), so a batch of 3 gets one
  question ("reply 1+2, or NO"). This replaces "a second base PDF runs the first alone".
- Same-person: names are SHOWN as read, and the bot always asks YES/NO. The "names match, no
  question" shortcut is NOT built: the corpus has policy WORDINGS only (no names), so there
  is no real-schedule fixture to verify it against (critique item 4 gate). Turn it on only
  after testing on real policy kits.
- Measured: top-up detection 25/29 top-ups, 2 false alarms in 487 base wordings (corpus).
  Name reader: 0 false names on 603 corpus wordings + 146 local insurer PDFs (prose such as
  "insured person for whom" was producing fake names until capitalisation + stopwords).
- Tests: 169/169 (22 new in test/topup.test.ts), guard PASS, bot tsc clean. Backend tsc
  errors are pre-existing, in unrelated files.
- Advisor docs: one paragraph added to /docs/whatsapp-assistant.
