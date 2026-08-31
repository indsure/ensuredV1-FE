# Consumer (D2C) UI/UX Audit — IndSure

Scope: the direct-to-consumer flow — an ordinary Indian policyholder uploads a policy PDF and gets a report.
Lens: non-expert, 40+, on a phone, anxious about coverage, being asked to hand over a personal document.
Root: `E:\Indsurefi\IndSure\frontend\client\src` (paths below are relative to that).

---

## 1. Upload flow (`components/PolicyUploadGate.tsx`, `lib/pendingUpload.ts`)

This component is the single entry point on both `/start` (`pages/start.tsx:416`) and `/policychecker` (`pages/policychecker.tsx:525`).

### [SEVERITY: Critical] "Upload a different file" does not actually discard the file — the old one gets analysed
- **Where:** `components/PolicyUploadGate.tsx:103-111` (and `lib/pendingUpload.ts:224,254`)
- **Problem:** The escape-hatch button only calls `setPending(null); setError(null)`. It never calls `clearPendingUpload()`, so the token stays in `sessionStorage`. Two concrete consequences: (a) reloading the page re-reads the token via the initialiser at line 31 and the discarded file reappears as "Your policy is ready to check"; (b) if the user clicks it, changes their mind and goes to `/signup` or `/login`, `claimPendingUpload()` reads `sessionStorage` directly and redeems **the file they just discarded**. Since analysis is metered "one policy of each type free forever", the user burns their one free health check on the wrong document and gets a report about a policy they deliberately rejected.
- **Fix:** Call `clearPendingUpload()` inside that onClick, and immediately re-open the file picker so "upload a different file" does what it says.

### [SEVERITY: Critical] Upload is lost if signup requires email confirmation
- **Where:** `lib/pendingUpload.ts:206,217` (sessionStorage) vs `pages/signup.tsx:355,367-376`
- **Problem:** The parked-upload token lives in `sessionStorage`, deliberately scoped to the tab. But when Supabase requires email confirmation, signup renders the "Check your inbox" screen (`signup.tsx:414-443`) and the user leaves to their mail app. The confirmation link (`emailRedirectTo: ${origin}/app`, line 355) opens in a **new tab or a different browser** — where `sessionStorage` is empty. The file they uploaded is silently orphaned; they arrive at an empty portfolio with no explanation and no prompt to re-upload. The whole "upload first, account second" premise collapses at exactly the moment it should pay off.
- **Fix:** Bind the pending token to the account server-side at signup time (pass it in the signUp metadata / bootstrap call), so redemption does not depend on the tab surviving. At minimum, put the token in `localStorage` with its own 24h expiry stamp, and show "we still have your file" on `/app`.

### [SEVERITY: High] A failed claim is swallowed — the user lands on an empty portfolio with no error
- **Where:** `pages/login.tsx:116-121`, `pages/signup.tsx:400-405`, `lib/pendingUpload.ts:270-282`
- **Problem:** `claimPendingUpload()` can return `{status:"failed", message}` or `{status:"needs_upgrade"}`. Both call sites only branch on `"started"`; every other outcome falls through to `setLocation("/app")`. The `message` is computed and thrown away. So a user who uploaded a policy, created an account specifically to see the result, and hit an expired/already-claimed token gets dropped into a portfolio with nothing in it and zero explanation of where their document went. This is the highest-anxiety moment in the product.
- **Fix:** Pass the claim outcome through to `/app` (query param or router state) and render an explicit banner: what happened, and a one-tap "upload it again" / "upgrade to continue".

### [SEVERITY: High] Accepted file types are wrong in the copy — photos are accepted but never advertised
- **Where:** `components/PolicyUploadGate.tsx:22` vs `:123-125,167`
- **Problem:** `ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt"` — images work. But every piece of visible copy says PDF only: "Upload the PDF your insurer sent you" (123) and the button reads "Choose your policy PDF" (167). Many Indian consumers only have a WhatsApp-forwarded photo or a phone snap of a printed policy; they will read this and bounce, believing they cannot use the product. The 10 MB cap is also stated only in the fine print *below* the button (line 186), i.e. after the decision point.
- **Fix:** "Choose your policy — PDF or a photo (max 10 MB)" on the button, and say photos are fine in the intro line.

### [SEVERITY: High] No handling or mention of password-protected PDFs
- **Where:** `components/PolicyUploadGate.tsx:37-64` (no local validation; error is whatever the server returns at line 52)
- **Problem:** Indian insurer policy PDFs are very commonly password-locked (DOB or policy number). Nothing anywhere in the flow warns about this, detects it client-side, or offers a "enter the PDF password" field. The user gets a generic server message ("We could not upload that file. Please try again.") and retries the identical file forever.
- **Fix:** Detect encryption client-side, and show a dedicated state: "This PDF is password-protected. Insurers usually use your date of birth (DDMMYYYY) or policy number." with either a password field or instructions to save an unlocked copy.

### [SEVERITY: High] No upload progress and no cancel on a 10 MB file over mobile data
- **Where:** `components/PolicyUploadGate.tsx:44,159-163`
- **Problem:** `setBusy(true)` swaps the button for a spinner reading "Uploading…". A 10 MB file on a patchy 4G connection is tens of seconds of an indeterminate spinner with no percentage, no bytes-sent, no cancel, and no timeout. The user cannot tell a slow upload from a hung one, and the only recovery is to reload — which (per the finding above) leaves state inconsistent.
- **Fix:** Use `XMLHttpRequest`/`fetch` with an upload progress handler, show a real percentage bar and a Cancel button, and fail with a clear message after a bounded timeout.

### [SEVERITY: Medium] Policy type is a set of unlabelled chips, defaults to Health, and cannot be changed after upload
- **Where:** `components/PolicyUploadGate.tsx:34,127-142,63`
- **Problem:** Three chips (Health / Term life / Vehicle) sit above the button with only an `aria-label="Policy type"` — no visible heading, so a sighted user may not register that this is a required choice; "Health" is pre-selected. The chosen type is baked into the upload (`form.append("type", type)`, line 48) and the callback is memoised on `type` (63). Once the file is parked, the type chip is gone from the UI entirely — there is no way to correct a mis-tagged vehicle policy without re-uploading. Because the free tier is "one policy of each type", a wrong tag silently consumes the wrong quota.
- **Fix:** Add a visible "What kind of policy is this?" label, and let the type be changed on the parked-file card before signup.

### [SEVERITY: Medium] Error text is not announced and has no retry affordance
- **Where:** `components/PolicyUploadGate.tsx:172-177`
- **Problem:** The error renders as a plain `<p>` with no `role="alert"`/`aria-live`, so screen-reader users get no notification. There is also no "Try again" button — the user has to work out that the main button is still the way back in.
- **Fix:** `role="alert"` on the container, and re-label the primary button "Try another file" while an error is showing.

### [SEVERITY: Low] No drag-and-drop on desktop
- **Where:** `components/PolicyUploadGate.tsx:144-170`
- **Problem:** The `<input type="file">` is `sr-only` and driven by a button click; there is no drop zone. Desktop users expect to drag a PDF onto the card.
- **Fix:** Wrap the card in drop handlers reusing the same `upload()` callback.

---

## 2. Signup / login wall (`pages/signup.tsx`, `pages/login.tsx`)

The wall itself is well-placed — the file is parked first and the account is asked for after (`PolicyUploadGate.tsx:86-92` explains why, and says "We have not read it yet"). The issues are in recovery paths.

### [SEVERITY: High] "Check your inbox" is a dead end — no resend, no way to fix a mistyped email
- **Where:** `pages/signup.tsx:414-443`
- **Problem:** After signup the only controls are "Go to sign in" (432) and a line saying to check spam (437). If the email was mistyped — very likely on a phone keyboard, and the field has no confirmation step — the user is permanently stuck: the address is taken, no mail will ever arrive, and there is no "resend" or "change email" action. Logging in will just fail with "Email not confirmed".
- **Fix:** Add "Resend the link" (with a cooldown) and "Use a different email" that returns to the form pre-filled.

### [SEVERITY: High] Raw Supabase error strings are shown to a non-technical Indian consumer
- **Where:** `pages/signup.tsx:358-359`, `pages/login.tsx:100-102`, `pages/reset-password.tsx:216-217`
- **Problem:** `setError(error.message)` surfaces the SDK's own English, e.g. "User already registered", "Invalid login credentials", "Email not confirmed", "New password should be different from the old password". These are developer strings: no explanation, no next action, and jarringly different in tone from the hand-written line right next to them ("That mobile number and password don't match an account.", login.tsx:80). Notably, "User already registered" offers no link to log in, and "Email not confirmed" offers no way to resend.
- **Fix:** Map the handful of known Supabase codes to plain sentences with an action link each, and fall back to one generic friendly message.

### [SEVERITY: High] Consumers with a work or custom-domain email are rejected and sent to the agent portal
- **Where:** `pages/signup.tsx:325-326` (`isPersonalEmail`)
- **Problem:** "Please use a personal email (Gmail, Outlook, Yahoo, iCloud…). Work email? That's the agent portal." A perfectly ordinary policyholder whose only email is `name@theirfirm.co.in` is told they belong in a product built for insurance agents. They have already uploaded their policy at this point, so this is a hard stop at the most invested moment. The allowlist will also reject legitimate Indian providers not on it (e.g. rediffmail, a BSNL address) depending on the list contents.
- **Fix:** Make this a soft warning ("Looks like a work email — is this for you personally, or are you an agent?") with a "Continue anyway" option, rather than a block.

### [SEVERITY: Medium] No confirm-password field on signup, and the rules contradict the reset page
- **Where:** `pages/signup.tsx:328,558,575` vs `pages/reset-password.tsx:196-201`
- **Problem:** Signup accepts any 6 characters, with no confirmation field — a typo behind the masked input locks the account out immediately, and the only recovery is the email-based reset. Worse, reset then demands 8 characters + an uppercase letter + a number. A user who signed up with `mypass` and later resets cannot re-use their own password, with no explanation of why the rules changed. Two different rulebooks for the same credential.
- **Fix:** One shared policy across both screens, and either add a confirm field or default the show/hide toggle to visible on signup.

### [SEVERITY: Medium] Neither auth screen is a `<form>`; Enter works on only one field
- **Where:** `pages/login.tsx:144-158` (no `onKeyDown`) vs `:188`; `pages/signup.tsx:466-479,490-503,521-533` vs `:556`
- **Problem:** The markup is `<div>`s with a `<Button onClick>`, so there is no implicit submit. Pressing Enter/Go in the identifier or email field does nothing — only the password field is wired. On an Android keyboard the "Go" key is right there and users will press it. It also weakens password-manager and autofill detection.
- **Fix:** Wrap in `<form onSubmit>` with `type="submit"` buttons.

### [SEVERITY: Medium] Password recovery is email-only, but login accepts a mobile number
- **Where:** `pages/login.tsx:143` vs `pages/forgot-password.tsx:83-94`
- **Problem:** Login's headline affordance is "Mobile number or email — use whichever you registered with". Someone who has only ever logged in with their mobile clicks "Forgot password?" and is asked for an email they may not remember choosing, with no note that the reset is email-only. The always-success response (line 45-46, correct for security) means a wrong email yields a confident "Check your email" and then nothing ever arrives.
- **Fix:** Add a line: "Reset links are sent by email — enter the email address on your account." Consider a hint on the success screen for what to do if no mail arrives.

### [SEVERITY: Medium] Forgot-password errors and success state are thin
- **Where:** `pages/forgot-password.tsx:97-101,55-72`
- **Problem:** The error banner has no `role="alert"` and no `aria-invalid` on the field; the email field has no format validation at all beyond emptiness (23), so a typo like `you@gmial` sails through to a false success. The success screen offers no "resend" and no "wrong email? try another".
- **Fix:** Basic format validation before submit, `role="alert"`, and a "Send again / use a different email" control on the success state.

### [SEVERITY: Medium] Password-rule checklist is colour-only and hidden until you start typing
- **Where:** `pages/reset-password.tsx:303-315`
- **Problem:** The whole checklist is gated behind `{password && ...}` — the rules are invisible until after the user has already guessed and typed something. When it does appear, met and unmet rules use the **same** `CheckCircle2` icon (311), distinguished purely by green vs grey (310). A red-green colour-blind user, or anyone on a phone in sunlight, sees three identical ticks and cannot tell which requirements are satisfied.
- **Fix:** Show the rules from the start (greyed), and change the *icon* — an empty circle for unmet, a filled tick for met — not just the colour.

### [SEVERITY: Low] Reset success auto-redirects after 1.6 s with no way to stop it
- **Where:** `pages/reset-password.tsx:222-223`
- **Problem:** `setTimeout(() => setLocation("/app"), 1600)` fires before a slower reader has finished the confirmation sentence, and there is no button to go now or stay.
- **Fix:** Show a "Go to my portfolio" button and lengthen or drop the timer.

---

## 3. The wait (`pages/processing.tsx`, `hooks/use-analysis.tsx`)

### [SEVERITY: High] Progress is theatre — the four steps run on fixed timers, not on the real job
- **Where:** `pages/processing.tsx:269-287` (timers at 500 / 3500 / 8500 / 15500 ms) vs `hooks/use-analysis.tsx:160-282` (the actual poll)
- **Problem:** The four "forensic" steps advance on `setTimeout`s that have nothing to do with the job. If the analysis finishes in 6 s the user sees the UI claim it is still "Parsing exclusions & sub-limits". If it takes 90 s — well within the 5-minute poll budget — the UI has been stuck on the last step ("Preparing coverage verdict") for over a minute with a rotating marketing line as the only sign of life, and the user cannot tell working from hung. There is no elapsed timer, no percentage and no ETA anywhere on the page; the only time signal is a collapsed accordion labelled "Why this takes a minute" (line 437), which sets a one-minute expectation the timers do not honour.
- **Fix:** Drive the step indicator from the real job status, and show elapsed time plus an honest "usually 30-60 seconds; longer for scanned documents" line above the fold.

### [SEVERITY: High] Raw developer error strings are shown to the consumer, in monospace
- **Where:** `pages/processing.tsx:471`, sourced from `hooks/use-analysis.tsx:141-143` and `:124-126`
- **Problem:** `{error || "Analysis failed to complete."}` renders in `font-mono`. The strings it renders include "Cannot connect to backend server. Please ensure the server is running." (`use-analysis.tsx:142-143`) and "Backend returned 402: …" (`use-analysis.tsx:124-126`). A 55-year-old policyholder is being told to start a server. The 402 case — out of free quota — is the most commercially important error in the product and it surfaces as an HTTP status code.
- **Fix:** Never surface `err.message` on this screen. Map status codes to consumer sentences, and give the quota case its own screen with an upgrade action rather than a red toast.

### [SEVERITY: High] "Try Again" throws the work away and sends the user back to re-upload
- **Where:** `pages/processing.tsx:472`
- **Problem:** On any failure the only button is "Try Again", which is `setLocation("/policychecker")` — the landing page with an empty uploader. The file the user already uploaded is not reused; they must find it on their phone and pick it again. For a transient failure this is pure lost work.
- **Fix:** Re-run the existing job (the server already has the file) and only fall back to re-upload if the document itself is the problem.

### [SEVERITY: High] The 5-minute timeout tells the user to try again while the job may still be running
- **Where:** `hooks/use-analysis.tsx:179` (`MAX_POLL_ELAPSED`), `:195-201`
- **Problem:** After 5 minutes the client gives up with "Analysis timed out. Please try again." It does not cancel the server-side job. A user who follows that instruction runs a second analysis of the same policy — and since the consumer tier is metered ("one policy of each type free forever"), the retry can consume the quota for a report that was about to appear anyway. Note also `jobStartTime` is set on effect mount (`:175`), so refreshing silently restarts the 5-minute clock.
- **Fix:** On timeout say "This is taking longer than usual — we'll keep working and your report will appear in your portfolio" and link to `/app`, rather than instructing a retry.

### [SEVERITY: Medium] The one privacy reassurance on the page is unreadable and uses words nobody knows
- **Where:** `pages/processing.tsx:461-466`
- **Problem:** "ANALYSIS IN ISOLATION • NO HUMAN REVIEW • PRIVATE ENCLAVE" is set at `text-[10px]`, `opacity-60`, all-caps monospace, absolutely positioned at the very bottom of a tall page. This is the reassurance an anxious person waiting on their health policy most needs, rendered as decorative fine print in language ("private enclave") an ordinary consumer will not parse. Contrast the clear, well-placed trust copy on `pages/start.tsx:375-379`.
- **Fix:** Promote it to a readable card near the spinner, in plain words: "Only you can see this. No person at IndSure reads your policy. You can delete it any time."

### [SEVERITY: Medium] The whole waiting screen speaks insurance-industry English
- **Where:** `pages/processing.tsx:235-248,410,421`
- **Problem:** "Stress-testing claim scenarios", "endorsement overrides", "Claim Failure Triggers", "silent sub-limits", "Time-Based Risks". The stated audience is 40+ non-experts. These phrases build a forensic mood but do not tell that person what is happening to their document.
- **Fix:** Same information in the register used on `/start`: "We're reading the small print about room rent, waiting periods, and what isn't covered."

### [SEVERITY: Medium] Body text gets smaller on larger screens and is 10-11px throughout
- **Where:** `pages/processing.tsx:328,359,376,435,462`
- **Problem:** Repeated `text-[11px] sm:text-[10px]` — the responsive step *reduces* the size. Combined with `opacity-60/70/80` on several of these, much of the page sits well below a comfortable size for the stated 40+ audience.
- **Fix:** 14px minimum for anything meant to be read; drop the opacity dimming.

### [SEVERITY: Low] Unused job handles — the page cannot act on the real job
- **Where:** `pages/processing.tsx:252`
- **Problem:** `currentJobId` and `checkJobStatus` are destructured and never used, which is why nothing on the page can show real progress, offer "check again now", or let the user leave and come back to this job.
- **Fix:** Use them: a manual "Check now" button and a resumable job link are both cheap here.

### [SEVERITY: Low] Refresh survives, but the page never says so
- **Where:** `hooks/use-analysis.tsx:160-161` (polling resumes from `sessionStorage.getItem("IndSure_current_job")`)
- **Problem:** Good news the user is never told: a refresh does resume. But nothing on `/processing` says "safe to wait, don't close this tab" or "it's safe to leave, we'll keep going", so an impatient user on a phone has no idea which is true. Because the handle is `sessionStorage`, closing the tab genuinely does lose the client's grip on the job.
- **Fix:** State it explicitly, and persist the job handle so a closed tab can be recovered from the portfolio.

---

## 4. `/analyze` — the orphaned type-picker (`pages/analyze.tsx`)

### [SEVERITY: Medium] Promises "instant … in seconds" while the wait screen explains why it takes a minute
- **Where:** `pages/analyze.tsx:24,89-91` vs `pages/processing.tsx:437`
- **Problem:** "get instant analysis … all in seconds" sets an expectation the product then has to argue against on the very next screen. Over-promising the wait is the classic way to make a 45-second wait feel broken.
- **Fix:** One honest number, used everywhere: "about a minute".

### [SEVERITY: Medium] This page is visually a different product from the rest of the consumer flow
- **Where:** `pages/analyze.tsx:75,79,116,125,138` (hardcoded `#F0FFFE`, `#0F1419`, `#00B4D8`, `#EF4444`, plus `dark:` variants)
- **Problem:** Every other consumer screen uses the cream/teal/navy tokens (`var(--color-cream-main)`, `var(--color-teal-600)`, serif headings). `/analyze` is a cyan gradient hero with sans-serif bold headings and a dark-mode palette that appears nowhere else in this flow. Landing here mid-journey reads as a different site, which costs trust in a product asking for a health document.
- **Fix:** Restyle onto the tokens, or retire the page — `/start` and `/policychecker` already carry the uploader, which is the newer pattern.

### [SEVERITY: Medium] Cards are clickable `<div>`s with buttons nested inside
- **Where:** `pages/analyze.tsx:102-106,133-154`
- **Problem:** `<Card onClick={...}>` is not focusable, has no `role`, and cannot be activated by keyboard. The two real controls inside it need `e.stopPropagation()` (135, 146) to escape the parent handler — a fragile pattern where a slightly-off tap fires the wrong navigation.
- **Fix:** Make the card a plain container and let the `<a>`/`<Button>` inside be the only targets.

---

## 5. The report (`pages/report.tsx`)

### [SEVERITY: Critical] Navigating away from the report deletes it — Back shows "Report Generation Failed"
- **Where:** `pages/report.tsx:53,88-91` with `hooks/use-analysis.tsx:70-71`
- **Problem:** The report is read from `sessionStorage["IndSure_report"]` (line 53), and the effect's cleanup calls `clearAuditState()` (89-91), which does `sessionStorage.removeItem("IndSure_report")` (`use-analysis.tsx:71`). So the moment the user leaves `/report` — tapping the header logo, following any link inside the report, opening the footer privacy page — the report is destroyed. Pressing Back then lands on the red "Report Generation Failed" screen telling them their data is corrupted. The user has waited a minute, read half a report about their own health cover, tapped one link, and the product says the report is broken. It also cannot be reopened later or on another device.
- **Fix:** Do not clear the report on unmount. Load `/report` from the persisted policy record (it already exists for the portfolio) so Back and a bookmark both work.

### [SEVERITY: High] The failure screen blames the user's data in developer language and offers a quota-burning fix
- **Where:** `pages/report.tsx:122-131`
- **Problem:** "Report Generation Failed" / "The policy data found in your session matches an older format or is corrupted. Please run the audit again with the latest engine." — "session", "older format", "latest engine" mean nothing to a policyholder, and "run the audit again" costs another metered analysis. This screen is also the catch-all for a network failure fetching a saved report, so it fires when nothing is corrupt at all. The only button goes to `/policychecker`; there is no link back to `/app`, where the report may already be saved.
- **Fix:** Separate "we couldn't load it right now" (Retry + link to the portfolio) from a genuinely unreadable report, and drop the internal vocabulary.

### [SEVERITY: Medium] Errors are silently swallowed, so every failure looks identical
- **Where:** `pages/report.tsx:62-65,76-77,80-82`
- **Problem:** Three empty `else {}` / `catch {}` blocks. A network failure, a 404, a permissions error and a genuinely malformed report all collapse into the same red "corrupted" screen, so the user can never tell whether retrying would help.
- **Fix:** Keep the causes distinct and render the right recovery action for each.

---

## 6. Sharing a report (`pages/SharedReport.tsx`)

### [SEVERITY: High] The full report — score, verdict, zone — is dumped to the browser console
- **Where:** `pages/SharedReport.tsx:179-190,193,196,200`
- **Problem:** A `console.log` prints the shared report's structure plus `identity.assumed_zone`, `final_verdict.label` and `audit_score.score` on every load, in production. This is a personal health-insurance assessment written to the console of whatever (possibly shared) device opened the link, and it undercuts the "private" positioning the rest of the flow works hard to establish.
- **Fix:** Remove the logging, or gate it behind a dev-only flag.

### [SEVERITY: Medium] Every error state on the shared view assumes an insurance agent sent the link
- **Where:** `pages/SharedReport.tsx:234,303`
- **Problem:** "It may have been revoked by the agent or has expired" and "Please contact the agent who shared this link." When a consumer shares their own report with a spouse or child, the recipient is told to contact an agent who does not exist. The page chrome reads "Shared Policy Report" (324) with no indication of whose policy it is or who shared it.
- **Fix:** Neutral wording ("the person who shared this link"), and name the sharer and policy on the page.

### [SEVERITY: Medium] Nothing explains what sharing exposes
- **Where:** `pages/SharedReport.tsx:160` — `/api/shared/report/{token}` is fetched with plain `fetch` and no auth, so the link is a bearer credential
- **Problem:** Anyone the link is forwarded to can read the full analysis of the user's policy. Nothing in the consumer flow states this, states an expiry, or offers a visible revoke. For a health document forwarded on WhatsApp, that is a real privacy surprise.
- **Fix:** Before generating a link, confirm in plain words: "Anyone with this link can see this report. It expires in X days. You can turn it off any time," plus a visible list of active links with a revoke control.

### [SEVERITY: Low] The rate-limited and "unable to load" states are dead ends
- **Where:** `pages/SharedReport.tsx:271-290,292-311`
- **Problem:** "Please wait a moment before trying again" with no Retry button — the user must know to reload manually. The `report_not_ready` state does have one (257-262), so the inconsistency is visible on the same page.
- **Fix:** Give both states the same Retry button.

---

## 7. The portfolio (`pages/app/portfolio.tsx`, `components/app/PolicyCard.tsx`, `ScoreRing.tsx`, `portfolio-utils.ts`)

This is the strongest screen in the consumer product. Score interpretation is handled properly: `scoreVerdict()` and `scoreMeaning()` (`portfolio-utils.ts:356-365`) render as text right beside the dial (`portfolio.tsx:455,459`), the empty state is well written (`:764-778`), the upload panel reports **real** backend stages rather than a fake bar (`:207-210`), and the reminders toggle is a proper `role="switch"` (`:965-969`). The findings below are the gaps.

### [SEVERITY: Critical] There is no way to delete a policy or a document, despite the promise on the landing page
- **Where:** `pages/start.tsx:377` ("Your documents stay private, and you can delete them anytime") vs `pages/app/portfolio.tsx:949-1008` (the settings strip) and `components/app/PolicyCard.tsx` (no delete control anywhere in the file)
- **Problem:** The whole trust pitch rests on the user being able to withdraw their policy document. The portfolio's settings section offers exactly two things — a reminders toggle and a plan link. The policy card offers rename, set-renewal-date, download, open-report and ask-advisor, and nothing else. There is no delete-policy, no delete-account, no "remove my documents". The promise made before the user uploads is not honoured after they do, which is both a trust failure and a data-rights problem for an Indian consumer product handling health documents.
- **Fix:** Add a delete action on each policy card (with confirmation, stating that the PDF is removed too) and a "Delete my account and all my data" control in the settings strip.

### [SEVERITY: High] Only health policies get a full report — the other three types silently don't
- **Where:** `components/app/PolicyCard.tsx:56` — `const hasReport = p.status === "done" && p.insurance_type === "health";`
- **Problem:** The portfolio invites the user to add Health, Term, Life and Vehicle cover (`portfolio-utils.ts:295-320`, checklist at `portfolio.tsx:658-692`), and the card for each shows a score and flaws. But the "view the full report" affordance is gated to `insurance_type === "health"`. Someone who uploads their car or term policy — using up their one free slot for that type — gets a number and a couple of bullets, no full report, and no explanation of why this policy behaves differently from their health one. The product actively prompts them into a lesser outcome.
- **Fix:** Either enable the report for every analysed type, or say plainly on the type picker that full reports are currently health-only.

### [SEVERITY: High] Dropping a non-PDF into the portfolio uploader does nothing at all — no message
- **Where:** `pages/app/portfolio.tsx:231-232,272-277`
- **Problem:** The dropzone is configured `accept: { "application/pdf": [".pdf"] }`, and `onDrop` starts with `if (!files.length) return;`. `fileRejections` is never read. So when the user picks a JPG photo of their policy — or a `.docx`, or a file over the dropzone's own limits — react-dropzone hands back an empty accepted list and the app returns silently. No toast, no red text, nothing changes on screen. The user taps, picks a file, and the page just sits there. On mobile, where the OS file picker happily offers photos, this is the likely first attempt for many users.
- **Fix:** Read `fileRejections` and toast the specific reason, and accept images (the pre-signup gate already does).

### [SEVERITY: High] Accepted types and size limits contradict the pre-signup uploader
- **Where:** `pages/app/portfolio.tsx:234,274,866` (PDF only, max 25 MB) vs `components/PolicyUploadGate.tsx:21-22` (PDF + PNG/JPG/WEBP/TXT, max 10 MB)
- **Problem:** The same user, in the same journey, faces two different rulebooks: before signing up they can upload a 9 MB photo of their policy; after signing up the identical file is rejected (silently, per the finding above), while a 20 MB PDF that would have been refused before is now fine. Nothing explains the change.
- **Fix:** One accepted-types list and one size limit across both uploaders, stated the same way in both places.

### [SEVERITY: Medium] Locked (quota-exhausted) types can still be selected — the paywall only fires after the upload completes
- **Where:** `pages/app/portfolio.tsx:810-829` (lock icon), `:245-255` (403 handling)
- **Problem:** A type whose free slot is used renders a 12px `Lock` icon at 60% opacity (826) as the sole signal — no text, no disabled state, no tooltip. The chip is still selectable, the dropzone still accepts the file, the file is uploaded over mobile data, and only then does the server return 403 and the paywall banner appear. The user pays the upload before learning they cannot proceed.
- **Fix:** Show the limit as text on the chip ("Health · free slot used"), and surface the upgrade prompt on selection rather than after transfer.

### [SEVERITY: Medium] The hero "cover score" has no visible denominator and never says it is an average
- **Where:** `pages/app/portfolio.tsx:281-287,442`; `components/app/ScoreRing.tsx:61,86-92`; `components/app/PolicyCard.tsx:86-91`
- **Problem:** The dial shows a bare number with the word "cover score" beneath it. "Out of 100" exists only in the `aria-label` (`ScoreRing.tsx:61`) — sighted users never see a scale, so 68 could be out of 70 or out of 1000. The number is also a plain mean of every scored policy across unrelated lines of business (`portfolio.tsx:285-287`), so adding a strong motor policy raises a user's "cover score" despite their health cover being unchanged, and nothing on screen says the number is an average. The per-policy tile has the same problem (`PolicyCard.tsx:86-91`).
- **Fix:** Render "/100" beside the number, and label the hero figure as "average across your N policies".

### [SEVERITY: Medium] Severity in "Worth fixing" is encoded only as a coloured dot
- **Where:** `pages/app/portfolio.tsx:722` — `<span className={... ${scoreClasses(f.score).dot}} />`
- **Problem:** A 8px teal/gold/red dot is the only indication of how serious each flagged issue is. There is no text, no icon shape difference, and no legend anywhere on the page saying what the colours mean. Red-green colour-blind users (roughly 1 in 12 men — squarely the stated audience) see three identical grey dots. The score bands themselves (`portfolio-utils.ts:334-354`) are likewise defined purely as colour.
- **Fix:** Add a word or a distinct icon per band, and a one-line legend.

### [SEVERITY: Medium] Portfolio load failure shows an HTTP status code and offers no retry
- **Where:** `pages/app/portfolio.tsx:54,348,379-383`
- **Problem:** `throw new Error(\`Failed to load portfolio (${res.status})\`)` renders verbatim, e.g. "Failed to load portfolio (500)". There is no Retry button. Worse, because the skeleton guard is `if (!data && !loadErr)` (348), a failed load renders the **full hero** underneath the error — "Let's find out where you stand", zero policies, empty stats — so a user whose policies exist but failed to load is shown a portfolio that looks wiped.
- **Fix:** A dedicated error state with a Retry button, plain wording, and no fake-empty hero behind it.

### [SEVERITY: Medium] Analysis timeout in the portfolio also tells the user to re-upload
- **Where:** `pages/app/portfolio.tsx:184-189`
- **Problem:** Same pattern as `/processing`: after 5 minutes the client stops polling and toasts "Analysis timed out — Please try uploading again", while the server job may still finish. Following that advice on a free plan can consume the one free slot for that type.
- **Fix:** Say the analysis is still running and the card will update, rather than prompting a re-upload.

### [SEVERITY: Low] Escape does not cancel name editing
- **Where:** `pages/app/portfolio.tsx:394-395`
- **Problem:** `Escape` sets `editingName(false)`, but the input also has `onBlur={saveName}`, so unmounting on Escape still commits the draft. Escape saves instead of cancelling.
- **Fix:** Track an explicit cancel flag and skip the save.

### [SEVERITY: Low] Text as small as 8px, and several labels shrink on larger screens
- **Where:** `components/app/PolicyCard.tsx:89` (`text-[11px] sm:text-[8px]`), `:105,290,347`; `pages/app/portfolio.tsx:423,446,1046`; `components/app/ScoreRing.tsx:90`
- **Problem:** The "score" caption under every policy's number renders at **8px** on desktop. The `sm:` variant reducing size appears throughout the consumer app. For an audience described as 40+, much of the labelling is below legible.
- **Fix:** Set a 11-12px floor and remove the shrink-on-desktop variants.

### [SEVERITY: Low] The horizontal quick-action strip hides its scrollbar with no overflow cue
- **Where:** `pages/app/portfolio.tsx:521`
- **Problem:** Five chips scroll horizontally with `[scrollbar-width:none]` and no fade or arrow. At 375px the last chips ("Policies", "Ask an advisor") sit off-screen with nothing indicating more exists.
- **Fix:** A right-edge fade, or wrap the chips instead of scrolling them.

---

## 8. Policy detail (`pages/app/policy-detail.tsx`)

### [SEVERITY: High] A failed download fails silently
- **Where:** `pages/app/policy-detail.tsx:187` — `catch { /* best-effort */ }`
- **Problem:** The user taps Download, the spinner runs, then stops, and nothing happens. No file, no message, no reason. They will tap again and again. The portfolio page does this correctly with a destructive toast (`portfolio.tsx:159-160`), so the inconsistency is within the same product.
- **Fix:** Reuse the portfolio's toast handling.

### [SEVERITY: Medium] On mobile the header controls are unlabelled icons
- **Where:** `pages/app/policy-detail.tsx:229,236`
- **Problem:** Both action labels are `hidden sm:inline`, and neither button carries an `aria-label`. Below 640px — the primary device — the user sees a bare download glyph and a bare telephone glyph, and a screen reader announces nothing at all. The telephone one opens a "Talk to an advisor" dialog, which is not what a bare phone icon suggests.
- **Fix:** Add `aria-label` to both, and keep at least the phone action's text visible.

### [SEVERITY: Medium] The "Private to your account" reassurance is hidden on mobile
- **Where:** `pages/app/policy-detail.tsx:238-240` — `hidden md:inline-flex`
- **Problem:** The one privacy signal on the page showing the user's decoded health policy is suppressed below 768px, i.e. for essentially the entire target audience.
- **Fix:** Show it on mobile, even as a single line under the header.

### [SEVERITY: Medium] "Still being analyzed — check back in a moment" does not check back
- **Where:** `pages/app/policy-detail.tsx:278-280`
- **Problem:** The page fetches once on mount (192-206) and never polls. A user who opens a processing policy is told to check back but must know to pull-to-refresh; there is no Retry or auto-refresh button on this state — only "Back to portfolio".
- **Fix:** Poll while `status` is pending/processing, or add an explicit "Check now" button.

### [SEVERITY: Low] Raw `error_message` from the server is rendered to the user
- **Where:** `pages/app/policy-detail.tsx:277`
- **Problem:** Whatever the backend stored is printed verbatim. The policy card treats the same field more carefully, pairing it with a WhatsApp escape hatch (`components/app/PolicyCard.tsx:141-163`); this screen offers no such route.
- **Fix:** Mirror the card's treatment — plain fallback text plus the "Send it to our team" WhatsApp link.

### [SEVERITY: Low] `Meter` exposes no accessible value
- **Where:** `components/app/ScoreRing.tsx:128-135`
- **Problem:** The bar is two `div`s with no `role="progressbar"` or `aria-valuenow`. Where adjacent text carries the number (portfolio completeness, `portfolio.tsx:470`) this is harmless; on the renewal countdown bar (`portfolio.tsx:563`) the visual is the only encoding of how much of the 30-day window is left.
- **Fix:** Add `role="progressbar"` with `aria-valuenow`/`aria-valuemax`.

---

## Cross-cutting notes

- **Two different upload experiences.** Pre-signup (`PolicyUploadGate`) accepts images, caps at 10 MB, has no progress bar and fakes nothing; post-signup (`portfolio.tsx`) is PDF-only, caps at 25 MB, and reports honest backend stages. The wait screens likewise diverge: `/processing` fakes progress on timers while the portfolio reports real status. Same user, same task, three different behaviours.
- **The backend already detects locked and scanned PDFs** — `components/app/PolicyCard.tsx:149-151` names exactly those cases — yet nothing warns the user about them before they upload, which is where the warning would save the round trip.
- **Trust copy is excellent where it exists** (`pages/start.tsx:375-379`, `components/PolicyUploadGate.tsx:182-189`, `pages/signup.tsx:510-517`, `portfolio.tsx:1010-1013`) and absent or illegible where anxiety actually peaks: the waiting screen (`processing.tsx:461-466`), the mobile policy detail header (`policy-detail.tsx:238-240`), and anywhere near the share feature.

