# UI/UX Audit 02b — Agent signup step 2, microsite, and tools

Scope: `IndSure/frontend/client/src/pages/agent/{SignupStep2,SignupFlow,MyProfile,MyPage,Landing,Compare,CatalogCompare,AgentCalculator,PolicyValues,RiderDirectory}.tsx`, `components/calculator/CoverCalculator.tsx`, `components/auth/{AuthShell,field}.tsx`.
Paths below are relative to `E:\Indsurefi\IndSure\frontend\client\src`.

Design lens: Indian insurance agents, 40+, mid-range Android, moderate English, WhatsApp-first.

---

## SignupStep2.tsx — "Which insurers are you empanelled with?"

### [SEVERITY: Critical] No way back to Step 1, and Step 1 data is unreachable
- **Where:** `pages/agent/SignupStep2.tsx:128-358` (whole page — no Back control anywhere) and `pages/agent/SignupStep2.tsx:142-152` (the progress row renders "Your Details ✓" as a plain `<div>`, not a link/button)
- **Problem:** Once the agent lands on the empanelment step there is no Back button and the completed "Your Details" chip is not clickable. If they typed their name/phone/ARN wrong on Step 1 they cannot go fix it — the only exits are "Continue to Dashboard" or "I'll add these later". Correcting a typo means abandoning signup.
- **Fix:** Add a visible "← Back" button next to the heading, and make the "Your Details" step chip a real button returning to `/agent/signup` with the Step 1 values rehydrated.

### [SEVERITY: Critical] Selections are lost on refresh, back-navigation, or a dropped connection
- **Where:** `pages/agent/SignupStep2.tsx:46-51` (`useState` only — no localStorage/sessionStorage/query-param persistence anywhere in the file)
- **Problem:** All state (`search`, `selected`, `customInsurer`) is in-memory. An agent who picks 8 insurers then backgrounds the app, takes a call, or refreshes on a flaky mobile connection returns to an empty list and starts over. On a mid-range Android, Chrome discarding a backgrounded tab is routine.
- **Fix:** Persist `selected` to `localStorage` on every toggle and rehydrate on mount (the `useEffect` import at line 1 is already there and unused).

### [SEVERITY: High] Signup ends by dumping the agent on a cold dashboard with no next action
- **Where:** `pages/agent/SignupStep2.tsx:98` (`setLocation('/agent/dashboard')`) and `:101-103` (`handleSkip` → same destination)
- **Problem:** Both the finish and the skip path navigate straight to `/agent/dashboard` with no success confirmation and no onboarding hand-off. A brand-new agent has zero policies, customers and uploads — they arrive at an empty dashboard with no instruction on what to do first, and nothing tells them the empanelment even saved.
- **Fix:** Show a success confirmation ("Saved — 6 insurers added") and land them on a first-run state with one obvious primary action, e.g. "Upload your first policy". At minimum pass `?welcome=1` so the dashboard can render a first-run card.

### [SEVERITY: High] Right-hand panel promises three features the product does not ship
- **Where:** `pages/agent/SignupStep2.tsx:395-415`
- **Problem:** The panel says empanelment unlocks "Recommendations tailored to your insurer mix", "Commission tracking across all insurers in one place", and "Auto-filled forms for faster policy submissions". Commission tracking and insurer-specific auto-fill do not exist in the agent portal. An agent who signs up for commission tracking and cannot find it loses trust on day one — and this audience churns silently rather than complaining.
- **Fix:** State the real benefit only; label anything roadmap-only as "Coming soon" or drop it.

### [SEVERITY: High] Fabricated statistic presented as platform data
- **Where:** `pages/agent/SignupStep2.tsx:420-427`
- **Problem:** "Advisors who complete empanelment process 3x more policies in their first month." attributed to "IndSure Platform Analytics, 2026". No such analysis exists at this platform size. It is a pressure claim on a step the same page lets you skip, and it is quotable back at the company.
- **Fix:** Delete, or replace with a non-numeric truthful line.

### [SEVERITY: High] On a phone the Continue button sits below 24 full-width tiles, and the "sticky" footer is not actually pinned
- **Where:** `pages/agent/SignupStep2.tsx:129-132` (`min-h-screen`, not `h-screen`), `:179` (`flex-1 overflow-y-auto`), `:189` (`grid-cols-1 sm:grid-cols-2`), `:287` (`sticky bottom-0`)
- **Problem:** At 375px the grid is one column, so 24 insurers plus the "Add another insurer" tile stack as ~64px rows — roughly 1,600px of scrolling. Because the outer container is only `min-h-screen`, the nested `overflow-y-auto` list has no bounded height on mobile and the document itself scrolls, so the `sticky bottom-0` footer is not pinned to the viewport — it just sits at the end of the page. The agent must scroll the whole list to reach Continue.
- **Fix:** Make the footer a real fixed bottom bar below `lg` (`fixed inset-x-0 bottom-0`) with matching bottom padding on the list. Use two columns even at 375px — insurer names are short.

### [SEVERITY: Medium] The disabled Continue button makes the error message unreachable and gives no tap feedback
- **Where:** `pages/agent/SignupStep2.tsx:74-78` (error `'Please select at least one insurer to continue'`) vs `:334` (`disabled={loading || selected.length === 0}`)
- **Problem:** The button is disabled whenever nothing is selected, so the guard at line 75 can never fire — dead code. A 40+ user taps a greyed button, nothing happens, and the only explanation is small label text they may not read.
- **Fix:** Keep the button enabled so the tap surfaces the inline error (the forgiving pattern), or make the "I'll add these later" escape hatch equally prominent instead of a small grey link (`:351-356`).

### [SEVERITY: Medium] Re-running the step creates duplicate empanelment rows
- **Where:** `pages/agent/SignupStep2.tsx:90-96` (plain `.insert(rows)`, no upsert, no read of existing rows)
- **Problem:** The page never loads what the agent already has. Reaching this URL a second time (bookmark, browser back from the dashboard, re-signup) shows an empty selection and inserts a second copy of every insurer, so their profile lists each insurer twice.
- **Fix:** Load existing `empanelments` on mount to pre-select them, and upsert on `(agent_id, insurer_name)` instead of blind-inserting.

### [SEVERITY: Medium] Failure messages are dead ends with no recovery route
- **Where:** `pages/agent/SignupStep2.tsx:85` (`'Session expired. Please sign up again.'`) and `:93` (`'Failed to save empanelments. Please try again.'`)
- **Problem:** "Please sign up again" is plain text with no link, and it discards everything just selected. The generic save failure gives no clue whether to retry now or later, and the same button will fail identically if the phone is offline.
- **Fix:** Make the session-expired state a real link that preserves the selection, and offer "Skip for now, add these in Settings" on the save-failure path so a backend hiccup cannot block account creation.

### [SEVERITY: Medium] "Empanelment" is never glossed
- **Where:** `pages/agent/SignupStep2.tsx:150` (step label) and `:156-158` (heading)
- **Problem:** Experienced agents know the term but POSP-route and newer sub-agents often do not, and there is no one-line gloss. Nothing says whether to tick an insurer they sell through a broker rather than being directly empanelled.
- **Fix:** Add a plain-language subline: "Tick the companies whose policies you can sell. Not sure? Tick the ones whose policies you have sold before."

### [SEVERITY: Low] Custom insurer entry accepts near-duplicates and has no length guard
- **Where:** `pages/agent/SignupStep2.tsx:65-72` (`addCustomInsurer` — exact-match `includes` only)
- **Problem:** "LIC", "lic of india" and "L.I.C." all pass, so one insurer can end up as several rows. No max length, no internal-whitespace normalisation.
- **Fix:** Case-insensitive dedupe against `ALL_INSURERS` plus `selected`; suggest the canonical name on a fuzzy match.

### [SEVERITY: Low] Selected-chip tray is a 96px nested scroll area
- **Where:** `pages/agent/SignupStep2.tsx:297` (`max-h-24 overflow-y-auto`)
- **Problem:** Pick 10+ insurers and the confirmation chips become a tiny inner scrollbox stacked above another scrollbox on a phone. The agent cannot see at a glance what they picked, which defeats the summary.
- **Fix:** Show a count plus the first three chips and a "+7 more" expander.

### [SEVERITY: Low] Insurer tiles are toggles with no pressed state exposed
- **Where:** `pages/agent/SignupStep2.tsx:193-213`
- **Problem:** Selection is conveyed only by colour plus a small check icon; the `<button>` has no `aria-pressed`, so screen readers and high-contrast users get no state.
- **Fix:** Add `aria-pressed={isSelected}`.

---

## SignupFlow.tsx

### [SEVERITY: Low] Unknown signup URLs silently render Step 1
- **Where:** `pages/agent/SignupFlow.tsx:11` (`<Route component={AgentSignupStep1} />` catch-all)
- **Problem:** Any mistyped or stale path under the signup flow renders Step 1 while the address bar still shows the wrong URL, with no explanation of why they were bounced.
- **Fix:** Redirect the catch-all to `/agent/signup` so URL and content agree.

---

## AgentCalculator.tsx — Cover Calculator

### [SEVERITY: High] A finished calculation is lost on refresh and there is no history of past runs
- **Where:** `pages/agent/AgentCalculator.tsx:55` (`const [done, setDone] = useState<CoverCalculatorCompletion | null>(null)`) — the only store of the result
- **Problem:** The whole result (recommended cover, riders, reasoning, premium range) lives in component state. Refresh, tab discard, or navigating to Customers and back and the agent is staring at a blank wizard again — after answering the full questionnaire. There is no "recent calculations" list anywhere on the page, so even runs that *were* saved (they have a `uuid`) are unreachable once the screen is cleared: the agent's only copy is the share link they may or may not have copied.
- **Fix:** Rehydrate the last completed run from `calculator_reports` on mount (or from `sessionStorage`), and add a "Recent calculations" list so a saved report can be reopened.

### [SEVERITY: High] "New Calculation" and "Adjust Inputs" wipe the on-screen result with no confirmation
- **Where:** `pages/agent/AgentCalculator.tsx:148-154` (`resetRun`) and `:156-162` (`adjustInputs`), triggered from `:176-179` and `:333-340`
- **Problem:** "New Calculation" sits top-right, right next to the result, and clears everything on a single tap — no "are you sure", no undo. If the agent has not yet copied the share link or attached the report to a customer, the run is gone from the screen. On a phone this button is easy to hit by accident.
- **Fix:** Confirm before discarding an unsaved/unshared run, or make the reset non-destructive by keeping the last result reachable.

### [SEVERITY: High] "Report wasn't saved" is an unexplained dead end, and a token race can cause it
- **Where:** `pages/agent/AgentCalculator.tsx:328-332` (`Report wasn't saved — sharing unavailable for this run.`), caused by `done.uuid` being absent; `:50` + `:64-68` set `authToken` asynchronously and `:196` passes it straight into the wizard
- **Problem:** `authToken` starts `null` and is only filled after `supabase.auth.getSession()` resolves; the wizard is rendered immediately, so a run completed before the session resolves has no token to save with. The agent then finishes the whole questionnaire and gets a small grey italic line telling them sharing is unavailable — with no reason, no retry, and no way to recover the report. The WhatsApp button (`:311-317`) stays enabled and will send a message with no link.
- **Fix:** Hold the wizard (or the finish step) until the token resolves; on a save failure show a real "Retry save" button, and disable/relabel the share actions rather than leaving them live.

### [SEVERITY: Medium] The explanation of the number is silently truncated to four bullets
- **Where:** `pages/agent/AgentCalculator.tsx:295` (`r.reasoning.slice(0, 4)`)
- **Problem:** "Why this number" is the one part of the screen that turns a figure into something the agent can repeat to a client — and it is cut at four lines with no "show more" and no indication that anything was dropped. The agent cannot see the rest of the reasoning at all.
- **Fix:** Show all reasoning, or collapse the remainder behind an explicit "Show all reasons" toggle.

### [SEVERITY: Medium] Core output terms are never glossed
- **Where:** `pages/agent/AgentCalculator.tsx:226` and `:235-238` ("super top-up", "base cover"), `:240-243` ("Est. Annual Premium" range), `:250` ("Recommended Riders"), `:277-281` ("Gap — not in your lineup")
- **Problem:** The result screen is the artefact the agent uses in front of a client, and every headline term is bare. "Super top-up" in particular has a deductible mechanic that is exactly what a client will ask about, and there is no tooltip, no one-line gloss and no link to an explainer. "Gap — not in your lineup" is internal phrasing that reads as a defect rather than a sales opportunity.
- **Fix:** Add a tappable info icon per term with a one-sentence plain-English gloss (and a Hindi line where it exists elsewhere in the portal). Reword the gap badge to something like "You don't sell this yet".

### [SEVERITY: Medium] Premium range carries no "this is an estimate, not a quote" caveat
- **Where:** `pages/agent/AgentCalculator.tsx:240-243`
- **Problem:** A hard rupee range is rendered in the same visual weight as the cover figures, and the only hedge is the abbreviation "Est.". The agent will read this number out to a client; if the real quote comes in higher, the agent wears it. The share link (`:104`) puts the same figure in front of the client directly.
- **Fix:** Add an explicit line under the range: "Indicative only — actual premium depends on the insurer's underwriting."

### [SEVERITY: Medium] Once attached to a customer, the link cannot be changed or removed
- **Where:** `pages/agent/AgentCalculator.tsx:347-357` — when `attachedTo` is set the UI renders text only; the `<select>` at `:361-375` is no longer rendered
- **Problem:** Attach the report to the wrong customer (one mis-tap in a native select, likely on a phone) and there is no way to detach or re-assign from this screen. The report is now sitting in the wrong client's portfolio.
- **Fix:** Keep a "Change" affordance next to the attached name.

### [SEVERITY: Low] Empty-customer state offers no way out
- **Where:** `pages/agent/AgentCalculator.tsx:377-381` (`Create a customer to attach calculations to their portfolio.`)
- **Problem:** The instruction names an action but gives no link — the agent has to work out where customers are created, and doing so loses the result (see the persistence finding above).
- **Fix:** Make it a button that creates the customer inline, or at minimum a link to `/agent/customers`.

### [SEVERITY: Low] Header row does not wrap at 375px
- **Where:** `pages/agent/AgentCalculator.tsx:168-181` (`flex items-center justify-between` with a `text-3xl` heading and a "New Calculation" button, no `flex-wrap`)
- **Problem:** On a narrow phone the large Playfair heading and the outlined button compete for one row; the button compresses and its label can clip.
- **Fix:** `flex-wrap` with the button on its own row below `sm`.

---

## Compare.tsx — Compare Policies (upload two wordings)

### [SEVERITY: Critical] A 20–40 second AI comparison is lost on refresh unless the agent remembers to press Save
- **Where:** `pages/agent/Compare.tsx:173` (`response` held only in `useState`), `:94-111` (saving is a separate, manual `Save & share with customer` action at `:129-136`)
- **Problem:** The comparison exists only in memory until the agent explicitly taps "Save & share". Refresh, an incoming call that discards the tab, or accidentally navigating away destroys a result that cost 40 seconds and a paid AI call, with no history screen to recover it. Nothing warns the agent that the result is unsaved.
- **Fix:** Save the report automatically as soon as the comparison returns and treat "share" as a separate step; or, failing that, warn on navigation while unsaved.

### [SEVERITY: High] "Compare again" destroys an unsaved result on one tap
- **Where:** `pages/agent/Compare.tsx:198-203` (`reset()` clears `response`, both files and the error) wired to `:210-212`
- **Problem:** The control is a small grey text link sitting directly beside the result heading, and it discards the comparison and both selected files instantly — no confirmation, no undo. It also clears the files, so "compare again" actually means "start completely over", which is not what the label promises.
- **Fix:** Confirm when the result is unsaved, and keep the two chosen files so "compare again" can mean "re-run" or "swap one side".

### [SEVERITY: High] No explanation of what a "policy wording" is, which is the most likely upload mistake
- **Where:** `pages/agent/Compare.tsx:77` (`Choose policy wording PDF`), `:228` (`Upload two policy wordings — we'll break them down side by side.`)
- **Problem:** Agents commonly have the policy *schedule* or certificate to hand, not the 60-page wording booklet. Nothing on the page distinguishes them or says where to get the wording, so the agent uploads the wrong document, waits 40 seconds, and gets a server-side failure they cannot interpret.
- **Fix:** One line under each slot: "This is the long terms-and-conditions booklet from the insurer's website, not the 1-page policy schedule." Ideally detect a too-short PDF and say so before spending the AI call.

### [SEVERITY: Medium] No client-side file validation — size, page count or emptiness
- **Where:** `pages/agent/Compare.tsx:32-42` (only `accept="application/pdf"`; `onPick` stores whatever is chosen) and `:182-190` (posts straight to the API)
- **Problem:** A phone-scanned 40 MB PDF uploads over 4G for a minute and then fails with whatever generic message the server returns. The agent has no idea the file was the problem.
- **Fix:** Check size and type at pick time and reject with a specific, actionable message.

### [SEVERITY: Medium] The long wait has no progress and no cancel
- **Where:** `pages/agent/Compare.tsx:271-282` (spinner plus static "This takes about 20–40 seconds")
- **Problem:** The stated 20–40s does not include the upload of two PDFs on a mid-range Android over mobile data, so the real wait is routinely longer than promised — which reads as "it has hung". There is no progress indicator, no upload percentage, and no way to cancel.
- **Fix:** Show upload progress separately from analysis, widen the estimate, and offer a cancel.

### [SEVERITY: Medium] No sample output before committing to a 40-second run
- **Where:** `pages/agent/Compare.tsx:284-292` — the "See a sample comparison" button is gated behind `isPlaygroundMode()`
- **Problem:** A real logged-in agent using the tool for the first time has no way to see what they will get. They must find two wording PDFs and wait, on faith. The worked example exists in the codebase but is shown only in demo mode.
- **Fix:** Show the sample comparison to signed-in agents too, clearly labelled as an example.

### [SEVERITY: Medium] The WhatsApp message cannot be reviewed or edited, and its language is fixed
- **Where:** `pages/agent/Compare.tsx:122-124` (hard-coded Hinglish text) used at `:155`
- **Problem:** The agent has no chance to see or change what will be sent in their name before WhatsApp opens; the tone and language are fixed regardless of who the client is. Agents with English-speaking or regional-language clients will have to delete and retype the message every time.
- **Fix:** Show the draft in an editable box before opening WhatsApp, with the language options used elsewhere in the portal.

### [SEVERITY: Low] Nothing says the shared report is publicly reachable
- **Where:** `pages/agent/Compare.tsx:92` (`/compare/report/<uuid>` link) and `:143-146` ("Saved — send this to your customer")
- **Problem:** The link needs no login (that is the point) but the UI never says so, and there is no way to revoke it later. An agent who forwards it into a group chat has no idea it stays open.
- **Fix:** Add "Anyone with this link can view it" next to the URL, and a revoke control.

---

## MyPage.tsx — the advisor's public microsite

This is the strongest screen in the scope: the purpose is explained in plain words (`:184-188`), the share links are pre-tagged, and the QR failure case is handled. The findings below are on top of that.

### [SEVERITY: High] The WhatsApp number — the entire point of the page — is never validated
- **Where:** `pages/agent/MyPage.tsx:122` (`whatsapp_number: whatsapp.replace(/\D/g, "").slice(-10) || null`) and the input at `:318-325` (no validation, no error display)
- **Problem:** Whatever the agent types is stripped of non-digits and silently truncated to the last 10 digits. Type 9 digits, or fat-finger an 11th, and the page saves a broken number with a success toast — every lead from the microsite then goes to a dead number and the agent has no way to know. `canPublish` at `:203` only checks that *some* digit exists, so a one-digit number publishes.
- **Fix:** Validate for exactly 10 digits starting 6–9, show the error inline under the field, and echo the saved number back as "+91 98XXX XXXXX" so the agent can eyeball it.

### [SEVERITY: High] Unsaved edits are lost silently, and the photo has to be saved separately
- **Where:** `pages/agent/MyPage.tsx:49-57` (draft state), `:394-399` (a single Save button at the bottom of the card), `:148` (`toast({... title: "Photo updated", description: "Remember to save." })`)
- **Problem:** There is no dirty-state tracking and no navigation guard. The agent can change their name, city, languages and lines of business, tap the bottom-tab navigation, and lose the lot with no warning. Worse, the photo upload *succeeds* to storage but is only attached on Save — the toast literally asks the user to remember, which for this audience means orphaned photos and a page that still shows the old picture.
- **Fix:** Track dirty state, show an "Unsaved changes" bar with the Save button pinned to the bottom on mobile, and warn on navigate-away. Persist `photo_url` immediately on successful upload so the two steps cannot desync.

### [SEVERITY: Medium] The only route to getting a page is a `mailto:` link
- **Where:** `pages/agent/MyPage.tsx:193-195` (`<a href="mailto:hello@indsure.in?subject=Advisor%20page%20request">`)
- **Problem:** For an agent whose entire working life is WhatsApp, on an Android phone that may have no mail client configured, tapping "Request my page" can do literally nothing — no feedback, no fallback. This is the gate on the whole feature, so the failure is total and invisible.
- **Fix:** Make it a WhatsApp deep link to the support number (with the plain email shown as text underneath), or an in-app request button that writes a row and confirms with a toast.

### [SEVERITY: Medium] Name validation is a toast, not an inline field error
- **Where:** `pages/agent/MyPage.tsx:112-116` (`displayNameProblem` → destructive toast) vs the field at `:312-314`
- **Problem:** The error appears as a transient toast, typically at the opposite end of the screen from the input, and disappears on a timer. The auth forms in this codebase already fixed exactly this (`components/auth/field.tsx:3-12` documents the reasoning); My page did not get the same treatment.
- **Fix:** Reuse `FieldError` / `inputStateClass` from `components/auth/field.tsx` and show the problem under the name input.

### [SEVERITY: Medium] Published-but-no-traffic state gives no next step
- **Where:** `pages/agent/MyPage.tsx:249-259` (stat cards render 0 / 0 / "—") and `:262` (the "Where your visitors come from" card is hidden entirely when `totalViews === 0`)
- **Problem:** A freshly published page shows three zeroes and an em dash, then nothing. There is no "you haven't shared it yet — start here" nudge pointing at the share kit further down, which is the single action that would change those numbers.
- **Fix:** When `totalViews === 0`, replace the breakdown card with a one-line prompt and a button that scrolls to the share kit.

### [SEVERITY: Medium] No client-side check on the profile photo
- **Where:** `pages/agent/MyPage.tsx:293-303` (`accept="image/*"`, no size or dimension check before `uploadPhoto`)
- **Problem:** A photo straight off a mid-range Android camera is 4–8 MB. It uploads over mobile data with only a small spinner on the label, and any server-side rejection surfaces as the generic "Please try a different image" (`:150-154`) which does not tell the agent that the problem was size.
- **Fix:** Check size client-side, downscale in the browser before upload, and name the actual limit in the error.

### [SEVERITY: Low] "Best channel" shows the raw tracking token
- **Where:** `pages/agent/MyPage.tsx:253-257` (`value={bySource.length ? bySource[0][0] : "—"}`)
- **Problem:** The card displays the raw `utm_source` string (e.g. `qr`, `whatsapp`) rather than the friendly channel label used in the share kit, so the two halves of the same screen name the same thing differently.
- **Fix:** Map through `SHARE_CHANNELS` labels; render "No visits yet" instead of "—".

### [SEVERITY: Low] The campaign field rewrites what the agent types, with no explanation
- **Where:** `pages/agent/MyPage.tsx:478` (`e.target.value.replace(/[^\w-]/g, "-").toLowerCase()`)
- **Problem:** Typing "Diwali Offer" becomes "diwali-offer" character by character while the agent watches. The behaviour is correct but unexplained, and it looks like the field is malfunctioning.
- **Fix:** Keep the raw text in the box and normalise only in the generated URL, or add "spaces become dashes" to the hint.

### [SEVERITY: Low] Multi-select chips expose no pressed state
- **Where:** `pages/agent/MyPage.tsx:328-341` (locale), `:348-364` (lines of business), `:370-390` (languages)
- **Problem:** All three groups are `<button>` toggles conveying selection through colour only, with no `aria-pressed` and no check mark. In bright sunlight on a cheap LCD the teal-tinted "on" state against white is a subtle difference.
- **Fix:** Add `aria-pressed` plus a check icon on the selected chips.

### [SEVERITY: Low] Clipboard fallback puts an un-selectable URL in a toast
- **Where:** `pages/agent/MyPage.tsx:443-445` (`toast({... description: url })`)
- **Problem:** When the clipboard API is blocked — common in Android in-app webviews, exactly where this audience lives — the recovery is a toast showing the URL, which cannot be selected or copied and vanishes on a timer.
- **Fix:** Fall back to a persistent, selectable text field with the URL pre-selected.

---

## Landing.tsx — the advisor marketing page

### [SEVERITY: High] Fabricated testimonials with invented names, cities and hard numbers
- **Where:** `pages/agent/Landing.tsx:87-109` and rendered at `:294-308`
- **Problem:** Three named "advisors" — Rajesh Kumar (Indore), Priya Sharma (Pune), Amit Patel (Ahmedabad) — with emoji avatars and specific performance claims: "47 policies/month", "₹12L commission tracked", "320+ active clients". These are not real customers. The section is headed as real advisor testimonials, the numbers are precise enough to be checkable, and an emoji where a face should be is the tell that a prospective agent will notice. This is the same class of fabrication as the "3x more policies" line in SignupStep2.
- **Fix:** Remove the section until there are real, consented quotes. If social proof is needed now, use a truthful non-personified line.

### [SEVERITY: High] "Integrates with" implies insurer integrations that do not exist
- **Where:** `pages/agent/Landing.tsx:209-221` (`integrates_label` above LIC / HDFC Life / SBI Life / ICICI Prudential / Max Life / "+15 more")
- **Problem:** Presented as an integration strip, which an agent will read as "this connects to my insurer portals". The product reads PDFs; it does not integrate with insurers. "+15 more" adds a count to a claim that has no basis. Same problem as the commission-tracking promise at `:57-61`, which is repeated in the signup flow.
- **Fix:** Relabel to what is true ("Works with policies from ...") or drop the strip.

### [SEVERITY: High] The signup path is body text while "Log in" gets both primary buttons
- **Where:** `pages/agent/Landing.tsx:162-166` (hero primary button → `/agent/login`) vs `:169-174` (signup as a `<p>` inside a link, `text-sm text-slate-600`)
- **Problem:** On an acquisition page the new agent's action — sign up — is rendered as small grey sentence text under a large solid "Log in" button, with no button styling and a tap target the height of one line of 14px text. A 40+ user scanning for "how do I start" sees only Log in and Book a demo.
- **Fix:** Make "Create your account" the primary hero button and demote Log in to the nav (where it already exists at `:137-142`).

### [SEVERITY: Medium] Third-party Calendly CSS and JS load on every visit of a marketing page
- **Where:** `pages/agent/Landing.tsx:20-35`
- **Problem:** A stylesheet and a script are injected into `<head>` on mount for every visitor, whether or not they ever tap "Book a demo", on an audience explicitly on mid-range Android and often on mobile data. The stylesheet is render-affecting and both are third-party requests before any consent.
- **Fix:** Load the widget lazily on first tap of a demo button — the fallback at `:44-47` already handles the not-yet-loaded case, so the lazy path is essentially free.

### [SEVERITY: Low] The hero and pricing pages link to a signup URL that no route declares
- **Where:** `pages/agent/Landing.tsx:169` and `:328` (`/agent/signup/step1`); also `pages/advisors-pricing.tsx:42,64` and `pages/agent/LoginNew.tsx:192`
- **Problem:** `pages/agent/SignupFlow.tsx:9-11` only declares `/agent/signup` and `/agent/signup/empanelment`; `/agent/signup/step1` works purely because of the unlabelled catch-all at `:11`. It renders the right screen but the address bar shows a URL the app does not know about, and any tightening of that catch-all silently breaks the main signup entry point from four places.
- **Fix:** Point all four links at `/agent/signup`, or declare `step1` as a real route. (Note this constrains the SignupFlow catch-all fix above — the catch-all is currently load-bearing.)

---

## CatalogCompare.tsx — Compare from Catalog

### [SEVERITY: High] The instant comparison cannot be saved or sent to a customer
- **Where:** `pages/agent/CatalogCompare.tsx:254` (renders `ComparisonView` only) — there is no equivalent of `Compare.tsx`'s `ShareBar` (`pages/agent/Compare.tsx:86-165`) anywhere in this file
- **Problem:** This is the path the product actively pushes as the better one ("instant, no upload" — `pages/agent/Compare.tsx:233-245`), yet it dead-ends on screen. The agent cannot copy a link, cannot WhatsApp it, cannot save it against a customer. For a WhatsApp-first audience the whole point of a comparison is sending it, so they must go back and re-do the work through the slow upload path to get something shareable.
- **Fix:** Reuse `ShareBar` here.

### [SEVERITY: Medium] Every plan added or removed silently re-runs and blanks the comparison
- **Where:** `pages/agent/CatalogCompare.tsx:177-200` (auto-compare `useEffect` keyed on `selected`) with `:254` (`{!comparing && result && ...}`)
- **Problem:** Adding a third plan tears the current result off the screen and replaces it with a spinner; removing one does the same. Drop below two plans and `:179` clears the result outright with no warning. An agent who removes a plan to see the effect loses the comparison they were reading and must re-add to get it back.
- **Fix:** Keep the previous result visible (dimmed) while the new one loads, and debounce so rapid edits fire one request.

### [SEVERITY: Medium] "Upload instead" is hidden on phones
- **Where:** `pages/agent/CatalogCompare.tsx:219` (`className="hidden sm:flex ..."`)
- **Problem:** The only in-page route back to the upload comparison is hidden below the `sm` breakpoint — i.e. on exactly the devices this product is designed for. A mobile agent who finds their plan is not in the catalog has no visible way to switch to uploading a wording.
- **Fix:** Show it on mobile as a full-width secondary button under the builder.

### [SEVERITY: Medium] Catalog load failure has no retry
- **Where:** `pages/agent/CatalogCompare.tsx:147-160` (`setError("Could not load the catalog.")`) and the render at `:246`
- **Problem:** On a dropped mobile connection the page renders an empty builder plus one red line, and the only recovery is knowing to reload the browser. `MyPage.tsx:168` already uses a shared `InlineErrorState` with an `onRetry`; this screen does not.
- **Fix:** Use `InlineErrorState` with a retry that re-fetches the catalog.

### [SEVERITY: Low] The catalog's own quality signals are fetched and then thrown away
- **Where:** `pages/agent/CatalogCompare.tsx:10-18` (`CatalogItem` carries `confidence` and `status`) — neither is rendered in `AddPlanPicker` (`:88-103`) or `PlanCard` (`:115-136`)
- **Problem:** The agent picks from "pre-analysed" plans with no indication of how good the analysis is or whether a plan is withdrawn, then puts the output in front of a client.
- **Fix:** Surface low confidence and non-active status as a badge on the plan card.

---

## RiderDirectory.tsx

### [SEVERITY: Medium] Field labels are abbreviated to the point of ambiguity, in the smallest type on the page
- **Where:** `pages/agent/RiderDirectory.tsx:167-172` — `Field label="Waiting"`, `Field label="Survival"`, rendered at `:181` as `text-[11px] font-black uppercase tracking-widest text-slate-400`
- **Problem:** "Waiting" and "Survival" are truncations of "waiting period" and "survival period" — two clauses that decide whether a rider pays out. They are set at 11px, all-caps, wide-tracked, in slate-400 on white (roughly 3:1 contrast), which is the least readable combination on the screen for a 40+ user, and there is no gloss of what a survival period is.
- **Fix:** Use the full label, drop the all-caps tracking, and darken to at least slate-600. Add a one-line explanation of survival period.

### [SEVERITY: Medium] Nine-pixel text on the badges
- **Where:** `pages/agent/RiderDirectory.tsx:144` (`text-[11px] sm:text-[9px]`), and the same pattern in `pages/agent/AgentCalculator.tsx:259,273,278` and `pages/agent/CatalogCompare.tsx:87,119` (`sm:text-[10px]`)
- **Problem:** These badges deliberately shrink from 11px on mobile to 9–10px on larger screens — backwards, and 9px is below any legible floor for the stated audience. "★ Must Have" is a decision signal rendered in the smallest type in the product.
- **Fix:** Set a 12px floor everywhere and remove the `sm:` shrink.

### [SEVERITY: Low] A reference screen with no way to act on what you find
- **Where:** `pages/agent/RiderDirectory.tsx:132-175` (`RiderCard` renders text only)
- **Problem:** The agent finds the right rider and then has nothing to do with it — no copy-to-WhatsApp explanation for the client, no link into the calculator's rider recommendations, no way to mark a favourite. The directory is a dead end.
- **Fix:** Add a "Copy explanation for customer" action on each card, in the language options used elsewhere.

### [SEVERITY: Low] Filters are not in the URL and do not survive a reload
- **Where:** `pages/agent/RiderDirectory.tsx:22-24` (search/insurer/type all local `useState`)
- **Problem:** An agent who filters to one insurer, taps into another screen and comes back starts from "All insurers" again. Nothing is shareable either.
- **Fix:** Mirror the three filters in the query string.

---

## components/calculator/CoverCalculator.tsx — the 7-step wizard behind /agent/calculator

### [SEVERITY: Critical] Autosave and resume are switched off for agents — the consumer flow keeps them
- **Where:** `components/calculator/CoverCalculator.tsx:300-301` (`useEffect(() => { if (embedded) return; ...` — resume) and `:322-327` (`if (embedded) return;` — `saveProgress`)
- **Problem:** The consumer version of this exact wizard saves every answer to local storage and offers to resume. The agent version deliberately disables both. An agent seven answers into a client's profile who takes a phone call, gets their tab discarded, or fat-fingers a refresh loses everything and starts from "Where do you live?" — with the client sitting in front of them. The justification in the comment ("agent runs are short") does not hold on a mid-range Android where tab eviction is routine.
- **Fix:** Namespace the stored progress per surface (e.g. `calculator_progress_agent`) and enable autosave in embedded mode. That removes the leak the comment is worried about without giving up the recovery.

### [SEVERITY: High] Going back does not show the answer you previously gave
- **Where:** `components/calculator/CoverCalculator.tsx:329-332` (`useEffect(() => { setSelectedOption(null); ... }, [currentStepId])`) versus `:985` (`selected={selectedOption === label}`)
- **Problem:** Option-card selection is rendered from `selectedOption`, which is cleared on every step change, not from `inputs`. Press Back and the step you return to shows every card unselected even though the answer is stored. The agent cannot see what they chose, so they re-tap — which in embedded mode immediately advances again (`:427-430`), so "just checking what I picked" costs a forward jump.
- **Fix:** Derive the selected state from `inputs[currentStepId]` rather than from transient `selectedOption`.

### [SEVERITY: High] Options auto-advance instantly with no Next button, and Back is the faintest control on screen
- **Where:** `components/calculator/CoverCalculator.tsx:425-430` (embedded advances on tap with no delay) and `:997-1005` (the only other control on an option step is a `variant="ghost"` Back in muted grey)
- **Problem:** One mis-tap on a 4-card grid and the agent is on the next question with no confirmation and no undo, and the recovery control is deliberately styled to be low-contrast and low-emphasis. For a 40+ user on a phone, held one-handed, that is the wrong way round: the destructive-feeling action is instant, and the corrective one is the hardest to see.
- **Fix:** Give Back real button weight (outlined, same height as the option cards), and either keep the consumer's short confirm beat or add an explicit Next.

### [SEVERITY: High] Option cards are clickable `<div>`s — no keyboard, no role, no state
- **Where:** `components/calculator/CoverCalculator.tsx:85-93` (`<div onClick={onClick} className="cursor-pointer ...">`)
- **Problem:** Every choice in the wizard is a plain div. It cannot be reached by keyboard, exposes no button role and no selected state to assistive tech, and gets no focus ring. Selection is signalled by a teal tint plus a small check.
- **Fix:** Make it a `<button type="button">` with `aria-pressed`.

### [SEVERITY: Medium] "Step 1 of 6" can silently become "Step 1 of 7" mid-flow
- **Where:** `components/calculator/CoverCalculator.tsx:560` (`visibleStepIds` recomputed from current `inputs`) rendered at `:596-605`; the conditions are at `:181-195`
- **Problem:** `hospitalPreference` appears only if the agent answers "Zero financial shock" or lives in a Metro, and `recurringExpenses` depends on the family and risk answers. So the denominator of the progress counter changes as the agent answers — the wizard tells them they are on step 4 of 6, then step 5 of 7. That reads as the form growing while you fill it, which is the classic reason people abandon.
- **Fix:** Show the maximum possible step count, or switch to a non-numeric progress bar that cannot go backwards.

### [SEVERITY: Medium] Skipped questions get silent defaults that then appear on the review screen as answers
- **Where:** `components/calculator/CoverCalculator.tsx:368-374` (injects `hospitalPreference: "Any good hospital"` and `recurringExpenses: "None"` when the step is skipped) surfacing through `buildReviewRows` at `:247-248`
- **Problem:** The review screen lists "Hospital preference: Any good hospital" and "Recurring expenses: None" as though the agent chose them. They never saw the question. If the client actually has a chronic condition, the number is wrong and nothing signals that the assumption was made by the software.
- **Fix:** Mark auto-filled rows as assumptions ("Assumed — tap to change") so the agent can catch a wrong default.

### [SEVERITY: Medium] The loading screen narrates work the software does not do
- **Where:** `components/calculator/CoverCalculator.tsx:577` (`"Analysing 140+ Policy Combinations..."`) and `:582` (`Checking inflation data for ${inputs.cityTier}...`), with the artificial delay at `:478-480` whose own comment calls it "trust-building theatre"
- **Problem:** `calculateHealthCover` is a local deterministic function; no 140 policy combinations are analysed and no inflation data is fetched. An agent who repeats these lines to a client is passing on a claim about the product that is not true, and agents run this repeatedly so they will notice the "analysis" is instant.
- **Fix:** Say what actually happens ("Working out the cover need…").

### [SEVERITY: Medium] Spouse, children and parents' ages have no validation at all
- **Where:** `components/calculator/CoverCalculator.tsx:774-788` (spouse age), `:860-890` (father/mother age) — plain `parseInt`, no range check, no error display, contrast with `exactAge` which is validated at `:706-728` and `:449-461`
- **Problem:** Typing 6 instead of 65 for a parent silently changes the recommended cover and the premium range with no warning. Parents' ages are the single biggest driver of a family health premium, so this is where a typo does the most damage — and it is the one field with no guard.
- **Fix:** Apply the same `getAgeError` treatment and inline error to every age field.

### [SEVERITY: Medium] Required-field errors are reported one at a time, only on Continue
- **Where:** `components/calculator/CoverCalculator.tsx:449-466` (`confirmDetailedProfile` returns after the first problem it finds)
- **Problem:** On the longest step of the wizard the agent presses Next, gets told about the age, fixes it, presses Next again, and only then learns the income is missing. Two round trips for one screen.
- **Fix:** Validate all fields and show every error at once.

### [SEVERITY: Low] The review screen loses the progress indicator and does not announce itself as the last step
- **Where:** `components/calculator/CoverCalculator.tsx:596` (`{!isIntro && currentStepId !== "review" && ...}`)
- **Problem:** The counter disappears exactly when the agent most wants to know they are nearly done, and the review step's Edit affordances are 12px text links (`:927-932`) at the right edge of each row — small targets for a thumb.
- **Fix:** Keep a "Last step" marker and make Edit a proper icon button with a 44px hit area.

### [SEVERITY: Low] The resume prompt uses a native `confirm()`
- **Where:** `components/calculator/CoverCalculator.tsx:304`
- **Problem:** Consumer surface only, but worth noting: a browser `confirm()` dialog says "localhost says…" or the bare domain, in English only, and answering it wrong destroys the saved progress immediately (`:315`).
- **Fix:** Replace with an in-page card offering Resume / Start fresh.

---

## MyProfile.tsx

### [SEVERITY: Critical] The insurers collected at signup are written to a different field than the one the profile edits — the signup answer is dead data
- **Where:** `pages/agent/SignupStep2.tsx:90-91` writes rows into the `empanelments` table from a 24-insurer life/health/general list (`:8-39`); `pages/agent/MyProfile.tsx:251-259` writes `agents.partnered_companies` from a *different*, health-only 28-company list (`:24-56`). `pages/agent/AgentCalculator.tsx:73-78` and `pages/agent/RiderDirectory.tsx:28-33` both read `partnered_companies`.
- **Problem:** SignupStep2 tells the agent "You can update this anytime from your profile" (`SignupStep2.tsx:160`) and promises the selection will tailor their recommendations. It does neither. The Companies tab opens empty regardless of what they ticked at signup, the two lists do not even use the same insurer names ("Star Health" vs "Star Health and Allied Insurance"), and the rider bias in the Cover Calculator and the Rider Directory ignores the signup answer entirely. The agent does the work twice, or more likely once — into a field nothing reads.
- **Fix:** Pick one store. Have signup write `partnered_companies` (or have the profile read/write `empanelments`), share a single canonical insurer list between the two screens, and prefill the Companies tab from whatever the agent already gave at signup.

### [SEVERITY: High] Every field label in the screen is 10px uppercase grey
- **Where:** `pages/agent/MyProfile.tsx:425,434,447,460,477,483,510,519` — all `text-[11px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest`; the same treatment is used for button text at `:359,494,534` and for the error message at `:529`
- **Problem:** Full name, Phone, City, Firm, New password, Confirm password — the labels on every input the agent has to fill — render at 10px on desktop, all-caps, wide-tracked, in slate-400 on white (about 3:1 contrast). All-caps also removes word-shape, which is exactly the cue that makes reading easier for older eyes and for readers with moderate English. Even the password error is set in tiny uppercase red.
- **Fix:** 13–14px, sentence case, slate-700 for labels; normal-case 14px for buttons and errors.

### [SEVERITY: High] Ticking 28 companies and then switching tabs silently discards the lot
- **Where:** `pages/agent/MyProfile.tsx:128` (`partnered` is local state), `:243-249` (`toggleCompany` never persists), `:332-345` (the tab switcher does no dirty check), `:414` (the profile tab is merely `hidden`)
- **Problem:** There is no dirty tracking. The agent works down 28 toggles, taps the "Profile" tab to check something, and everything they ticked is still in state — but a refresh, a back gesture, or a bottom-tab navigation throws it away with no warning. The same applies to the personal-details form.
- **Fix:** Warn on tab-switch and on navigation when unsaved, or autosave each toggle.

### [SEVERITY: Medium] The Save button for the companies list is at the top, above 28 items
- **Where:** `pages/agent/MyProfile.tsx:351-363` (Save in the header row) with the grid below at `:377-406`
- **Problem:** At 375px the list is one column of 28 cards. The agent scrolls all the way down ticking companies, finishes, and the Save button is off-screen above them — a scroll back up on a control they have no reason to expect there. Its label is also 10px uppercase.
- **Fix:** Sticky save bar at the bottom on mobile, showing the count of selected companies.

### [SEVERITY: Medium] "Profile updated" can be shown when half the update failed
- **Where:** `pages/agent/MyProfile.tsx:210-218` — the second `update({ phone_number, firm_name })` at `:216` is deliberately unchecked ("silently ignore if columns don't exist yet") and the success toast fires regardless
- **Problem:** If that write fails, the agent is told the profile was updated while their firm name and phone silently did not save. They will only find out later, if at all.
- **Fix:** Check the second result and report a partial failure honestly.

### [SEVERITY: Medium] Password change has no current-password check, no visibility toggle, and no strength feedback
- **Where:** `pages/agent/MyProfile.tsx:226-241` (only `length < 8` and a match check) and `:511-525` (two bare `type="password"` inputs)
- **Problem:** An unattended session can have its password changed without knowing the old one. For the user, the bigger issue is the two masked boxes with no show/hide: on a phone keyboard, typing a password twice with no way to see it is the classic cause of the "Passwords don't match" loop — and that error is rendered in 11px uppercase red (`:529`).
- **Fix:** Require the current password, add a show/hide eye toggle, and set the error in normal-case readable type.

### [SEVERITY: Medium] Phone number is stored exactly as typed, with no validation
- **Where:** `pages/agent/MyProfile.tsx:437-443` and the save at `:212`
- **Problem:** The placeholder shows "+91 98765 43210" but any string is accepted and saved to both `phone` and `phone_number`. Nothing checks length or digits, so a mistyped contact number silently persists.
- **Fix:** Normalise to 10 digits and validate inline.

### [SEVERITY: Medium] The Companies tab covers health insurers only
- **Where:** `pages/agent/MyProfile.tsx:24-56` (28 entries, all health) under a generic tab label (`:343`)
- **Problem:** Agents in this market typically carry life and motor as well — and SignupStep2 explicitly asked them about Life and General insurers. Here there is nowhere to record those, and no explanation of why the list stops at health.
- **Fix:** Either say the list is health-only and why, or extend it to the same lines the signup step offers.

### [SEVERITY: Low] The load error is captured and then thrown away
- **Where:** `pages/agent/MyProfile.tsx:196-198` (stores a specific message) versus `:272` (`<InlineErrorState onRetry={fetchAll} />` — no `message` prop)
- **Problem:** Whatever went wrong is replaced by the component's generic default, so the agent (and support) lose the one clue available.
- **Fix:** Pass `message={error}`.

### [SEVERITY: Low] The six-month activity chart has no empty state
- **Where:** `pages/agent/MyProfile.tsx:552-570`
- **Problem:** A new agent sees two flat lines at zero with an axis and a legend — visually indistinguishable from a broken chart.
- **Fix:** Render "No activity yet" in place of the chart when every point is zero.

---

## PolicyValues.tsx — Surrender values

Credit where due: the eight-column financial table uses the `table-cards` pattern with `data-label` attributes (`:178`, `:201-258`), so it reflows to cards on a phone instead of scrolling sideways — the right call for this audience.

### [SEVERITY: High] A page that says "What to do" about a customer's money carries no advice disclaimer
- **Where:** `pages/agent/PolicyValues.tsx:181` (the `What to do` column), `:248-257` (per-row action badge and headline), `:266-270` (the only footnote, which is about the discontinued fund)
- **Problem:** The screen ranks a whole book by surrender value and IRR and puts a recommendation badge on each row. The Cover Calculator carries an explicit "not insurance or financial advice" line (`components/calculator/CoverCalculator.tsx:937-939`); this screen, which is far closer to actual advice about surrendering a policy, has none. An agent acting on "surrender" for a client whose real figures differ has nothing on screen telling them these are computed indications.
- **Fix:** Add the same disclaimer, and state that surrender values are computed estimates that the insurer must confirm.

### [SEVERITY: Medium] "Worked out from the policy documents, not estimated" overstates what the numbers are
- **Where:** `pages/agent/PolicyValues.tsx:94-97`
- **Problem:** The subtitle explicitly denies that these are estimates. Surrender values depend on insurer-specific bonus declarations and special surrender factors that a policy PDF does not contain, so the figures are necessarily modelled. Presenting them as documentary fact is the claim most likely to cause an agent to quote a wrong number to a client.
- **Fix:** "Calculated from each policy's premium, term and sum assured — confirm the exact figure with the insurer."

### [SEVERITY: Medium] The action badges are only explained when you filter to them
- **Where:** `pages/agent/PolicyValues.tsx:158-160` (`{filter !== "all" && <p>{ACTION_META[filter].blurb}</p>}`)
- **Problem:** In the default "All" view — the view the agent actually lives in — every row has a coloured action badge with no legend. The explanation exists but is reachable only by filtering to one action at a time.
- **Fix:** Show the blurbs as a short legend above the table, or make each badge tappable to reveal its meaning.

### [SEVERITY: Medium] Unglossed jargon in the most consequential columns
- **Where:** `pages/agent/PolicyValues.tsx:181` — `Year` renders as `7/20` (`:205-207`), `Return now` and `Return at maturity` are IRR (`:230-247`), and `:267` mentions "discontinued fund" and "lock-in"
- **Problem:** "Return now" is a good plain-English rename of IRR, but nothing says it is an annualised return, so a negative figure in amber has no explanation the agent can pass to a client. The bare `7/20` in a column headed "Year" is ambiguous — policy year out of term is not self-evident. "Discontinued fund" appears once, in a footnote at the very bottom, far from the asterisks it explains.
- **Fix:** Header tooltips, "Year 7 of 20" in full, and move the asterisk explanation next to the first row that uses it.

### [SEVERITY: Medium] Table rows are click handlers on `<tr>`
- **Where:** `pages/agent/PolicyValues.tsx:196-199` (`<tr onClick={() => setLocation(...)}>`)
- **Problem:** Not keyboard reachable, announced as a plain row by assistive tech, and cannot be long-pressed or middle-clicked to open in a new tab — so an agent cannot keep the list open while checking one policy.
- **Fix:** Put a real link in the client cell and keep the row click as an enhancement.

### [SEVERITY: Low] No way to send the number to the customer
- **Where:** `pages/agent/PolicyValues.tsx:248-258` (the row ends at a badge and a headline)
- **Problem:** The whole page is a list of reasons to call a client, on a product built around WhatsApp, and there is no share or copy action anywhere on it.
- **Fix:** A per-row "Message customer" action using the existing WhatsApp drafting pattern.

---

## components/auth/ (AuthShell.tsx, field.tsx)

`field.tsx` is exemplary — inline per-field errors, an explained required marker with a screen-reader equivalent (`:26-33`), and a documented 16px input floor to stop iOS zoom (`:52-59`). It is the pattern the rest of the portal should copy; `MyPage.tsx:112-116` and `MyProfile.tsx:528-530` notably do not.

### [SEVERITY: Low] Unsourced numeric claims in the shared auth panel
- **Where:** `components/auth/AuthShell.tsx:19-23` ("50+ risk checks per policy") and `:13-17` ("~60-sec audit")
- **Problem:** Both are specific, checkable claims shown on every auth page, with no basis given. "50+ risk checks" in particular is the sort of number that gets quoted back.
- **Fix:** Either substantiate them somewhere reachable or soften to a non-numeric claim.

### [SEVERITY: Low] Desktop-only benefits list
- **Where:** `components/auth/AuthShell.tsx:90` (`className="hidden lg:block ..."`)
- **Problem:** The three substantive reasons to sign up — zero commission, the risk checks, the privacy promise — are hidden on mobile, which the file's own comment identifies as where the traffic lands. Mobile visitors get only the three short pills.
- **Fix:** Show a condensed version below the form card on mobile rather than dropping the content.

---

## Cross-cutting

### [SEVERITY: High] Sub-12px type is used systematically, and it *shrinks* on larger screens
- **Where:** `pages/agent/MyProfile.tsx:101,291,296,310,313,359,370,373,400,425,434,447,460,477,483,494,510,519,534`; `pages/agent/RiderDirectory.tsx:144`; `pages/agent/PolicyValues.tsx:185,251`; `pages/agent/AgentCalculator.tsx:259,273,278`; `pages/agent/CatalogCompare.tsx:87,119`
- **Problem:** The pattern `text-[11px] sm:text-[10px]` (and `sm:text-[9px]`) appears across the portal: 11px on phones dropping to 9–10px on desktop. It is applied to field labels, status badges, table headers and button text — not decoration. For agents aged 40+ this is below comfortable reading size everywhere, and the direction is backwards (screens get bigger, text gets smaller).
- **Fix:** One pass replacing every `text-[9px|10px|11px]` with a 12px floor, and delete the `sm:` shrink modifiers.

### [SEVERITY: Medium] Two more instances of the same unbacked-claim pattern
- **Where:** `pages/agent/SignupStep2.tsx:420-427`, `pages/agent/Landing.tsx:87-109` and `:209-221`, `components/calculator/CoverCalculator.tsx:577,582`, `components/auth/AuthShell.tsx:21`
- **Problem:** Fabricated testimonials, an invented platform statistic, an integration strip for integrations that do not exist, loading copy narrating analysis that does not happen, and an unsourced "50+ risk checks". Individually each is small; together they form a house style of inventing numbers, and this audience talks to each other.
- **Fix:** One honesty pass across these five locations, applying the same standard the blog content already went through.

### [SEVERITY: Medium] No screen in this scope warns before discarding unsaved work
- **Where:** `pages/agent/SignupStep2.tsx:46-51`, `pages/agent/MyPage.tsx:49-57`, `pages/agent/MyProfile.tsx:121-135`, `pages/agent/Compare.tsx:173`, `pages/agent/AgentCalculator.tsx:55`, `components/calculator/CoverCalculator.tsx:322-327`
- **Problem:** Six separate screens hold meaningful work in component state with no persistence and no navigate-away guard. On a mid-range Android with a hardware back gesture and aggressive tab eviction, every one of them loses work routinely.
- **Fix:** A shared `useUnsavedChanges` hook that both blocks navigation and mirrors the draft to `sessionStorage`.

---
