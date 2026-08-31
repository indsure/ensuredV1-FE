# Agent Portal — Onboarding, Auth & Specialist Tools (UI/UX Audit)

Scope: `pages/agent/` auth + signup + microsite + multi-step tools, plus `components/auth/` and `components/calculator/`.
Lens: Indian insurance agents, 40+, mid-range Android, moderate English, WhatsApp-first.
All paths relative to `E:\Indsurefi\IndSure\frontend\client\src`.

---

## 1. Login — `pages/agent/LoginNew.tsx`

### [SEVERITY: High] Login failures show raw Supabase error strings
- **Where:** `pages/agent/LoginNew.tsx:27` (`setError(error.message)`)
- **Problem:** Whatever Supabase returns is printed verbatim — "Invalid login credentials", "Email not confirmed", "For security purposes, you can only request this after 44 seconds". These are developer strings: they do not tell a 40+ agent whether the email or the password was wrong, that they must click the confirmation email first, or that they should wait. Every other string on this page goes through `t()`; this one does not, so it also stays English when the agent has switched to Hindi.
- **Fix:** Map the handful of known Supabase codes to translated, actionable sentences ("Email or password is wrong. Try again, or tap Forgot password." / "Please open the confirmation email we sent to <email> first — [Resend]"). Never surface `error.message` directly.

### [SEVERITY: High] "This is a client account" dead-end has no link to the client portal
- **Where:** `pages/agent/LoginNew.tsx:42-47`
- **Problem:** The agent is told "Please sign in at the client portal" but is given no link, and the message is hardcoded English while the rest of the page is translated. They are silently signed out and left on the same form with no next step.
- **Fix:** Render the message through `t()` and include a button linking to `/login`.

### [SEVERITY: Medium] Enter key only submits from the password field
- **Where:** `pages/agent/LoginNew.tsx:159` (`onKeyDown` is on the password `Input` only); no `<form>` element wraps the fields
- **Problem:** Because there is no `<form>`, pressing Enter/Go from the email field does nothing. On Android the keyboard's "Go" key is the natural way to submit; from the email field it appears broken.
- **Fix:** Wrap in a `<form onSubmit={handleSignIn}>` and make the button `type="submit"`. Also gives browsers/password managers proper autofill-and-submit behaviour.

### [SEVERITY: Low] Error banner is not announced and does not take focus
- **Where:** `pages/agent/LoginNew.tsx:175-180`
- **Problem:** The red block appears below the fields with no `role="alert"`/`aria-live`. On a phone with the keyboard open it can be off-screen, so the agent taps Sign in repeatedly seeing nothing happen.
- **Fix:** Add `role="alert"` and scroll it into view when set (the shared `FieldError` in `components/auth/field.tsx:38-49` already does this correctly — reuse it).

---

## 2. Forgot password — `pages/agent/ForgotPassword.tsx`

### [SEVERITY: High] "Vault Key" / "Credential Recovery" jargon on the recovery path
- **Where:** `pages/agent/ForgotPassword.tsx:59-64` ("Lost your Vault Key?", "We'll dispatch a secured, single-use link"), `:78` ("Credential Recovery"), `:96` ("Credential Email"), `:85` ("set a new Vault Key"), `:119` ("Dispatching..."), `:90` ("Back to Portal")
- **Problem:** This is the screen an agent reaches when they are already stuck. Nothing on it uses the word "password". "Vault Key", "dispatch", "credential", "portal" are invented/high-register English for an audience with moderate English. An agent can read this whole page and not be sure it will reset their password.
- **Fix:** Plain words throughout: "Forgot your password?", "Enter the email you signed up with", "We will email you a link to set a new password", "Send link", "Back to login". Same rewrite is needed in `ResetPassword.tsx` (see below).

### [SEVERITY: High] Labels and error text set at 10–11px uppercase
- **Where:** `pages/agent/ForgotPassword.tsx:96` (`text-[11px] sm:text-[10px] font-black ... uppercase tracking-widest`), `:108` (error at `text-[11px] font-bold uppercase`), `:123` (back link at 10px)
- **Problem:** The label shrinks on larger screens (`sm:text-[10px]`) — backwards. All-caps + wide letter-spacing at 10px is close to unreadable for 40+ eyes; the error message, the thing they most need to read, is the smallest text on the page.
- **Fix:** Minimum 14px, sentence case, normal tracking, for labels and errors. Same pattern repeats in `ResetPassword.tsx:130,162,182,208`.

### [SEVERITY: Medium] Success state offers no resend and no way to correct a typo'd email
- **Where:** `pages/agent/ForgotPassword.tsx:81-92`
- **Problem:** After sending, the only control is "Back to Portal". If the email never arrives (typo, wrong address, spam filter) the agent has to navigate back and re-find the screen. There is no "Didn't get it? Send again" and no "Wrong email? Change it".
- **Fix:** Add a "Send again" button (with a 60s cooldown) and an "Edit email" link that returns to the form with the value preserved.

### [SEVERITY: Medium] No language toggle on the recovery screens
- **Where:** `pages/agent/ForgotPassword.tsx` (whole file — no `LanguageToggle`), `pages/agent/ResetPassword.tsx` (same), vs `pages/agent/LoginNew.tsx:108`
- **Problem:** An agent who reads the login page in Hindi is dropped into English-only pages the moment they hit trouble.
- **Fix:** Render `LanguageToggle` on both, and route all strings through `t()`.

### [SEVERITY: Low] Build string and wrong-domain placeholder shown to users
- **Where:** `pages/agent/ForgotPassword.tsx:69` ("Standardized by Leading Insurers · v4.1.0-VITE"), `:103` (placeholder `advisor@indsure.ai`)
- **Problem:** "v4.1.0-VITE" is internal build metadata leaking into a customer-facing screen; the placeholder uses `indsure.ai` while the product is `indsure.in`, which can make an agent think they need a company email address.
- **Fix:** Drop the version string; use a neutral placeholder like `you@example.com`. Same version string is at `ResetPassword.tsx:121`.

---

## 3. Reset password — `pages/agent/ResetPassword.tsx`

### [SEVERITY: Medium] Password rules are hidden until the agent starts typing
- **Where:** `pages/agent/ResetPassword.tsx:193` (`{password && (...)}` gates the checklist), placeholder is `••••••••` at `:169`
- **Problem:** The agent chooses a password blind, then discovers after the fact that it needs an uppercase letter and a number. Same pattern in signup (`SignupStep1.tsx:498`).
- **Fix:** Show the three requirements greyed-out from the start and tick them as they are met.

### [SEVERITY: Medium] Confirm-password mismatch is only reported on submit
- **Where:** `pages/agent/ResetPassword.tsx:75-77` (checked inside `handleSubmit`)
- **Problem:** With the field masked and no live check, a typo is only revealed after tapping Update — and the error is rendered in 11px uppercase (`:208`).
- **Fix:** Compare live once `confirm` is non-empty and show an inline message under the field.

### [SEVERITY: Medium] Show/hide toggle has no label and a small hit area
- **Where:** `pages/agent/ResetPassword.tsx:171-177` (bare icon button, no `aria-label`, no `min-h`), same at `SignupStep1.tsx:490-496` and `SignupStep2` inputs
- **Problem:** A ~16px icon is a hard target on a phone for older users, and screen readers announce nothing. Login gets this right (`LoginNew.tsx:163-171` has `aria-label` + `min-h-11` + a "Show/Hide" word) — the reset and signup screens do not.
- **Fix:** Copy the login pattern: `min-h-11`, `aria-label`, and the visible word "Show"/"Hide".

### [SEVERITY: Medium] Confirm field is unmasked by the same toggle, silently
- **Where:** `pages/agent/ResetPassword.tsx:184` (`type={showPassword ? 'text' : 'password'}` on Confirm, but the toggle only sits on the first field)
- **Problem:** Tapping "show" on the top field also reveals the bottom one, with no control there — surprising, and a shoulder-surfing risk the agent did not opt into.
- **Fix:** Either give the confirm field its own toggle or label the single toggle as applying to both.

### [SEVERITY: Medium] Auto-redirect after success with no manual continue
- **Where:** `pages/agent/ResetPassword.tsx:86-88` (`setTimeout(() => setLocation('/agent/dashboard'), 1800)`)
- **Problem:** 1.8s is barely enough to read "Password updated" on a slow phone; and if the agent backgrounds the tab or the timer is throttled they are stranded on the confirmation with no button. There is also no confirmation of *which* account was changed.
- **Fix:** Show a persistent "Continue to dashboard" button alongside the timer, and name the email that was updated.

---

## 4. Signup step 1 — `pages/agent/SignupStep1.tsx`

### [SEVERITY: Critical] The Continue button can be permanently disabled with no explanation
- **Where:** `pages/agent/SignupStep1.tsx:286-294` (`isFormValid` requires `inviteCodeStatus === 'valid'`), `:354` (`onBlur={validateInviteCode}` is the only trigger), `:550-561` (`disabled={loading || !isFormValid}`)
- **Problem:** The invite code is only checked on blur. An agent who pastes the code and fills the rest can end up with a grey, unresponsive Continue button and nothing on screen saying why — no list of what's missing, no message next to the button. `validateInviteCode` is also async, so there is a window where the button is dead after the tap. Worse: `inviteCodeStatus` starts at `'idle'`, and a restored sessionStorage draft (`:27-44`) repopulates the code field but NOT the status, so an agent returning to a saved draft sees a filled-in form and a permanently disabled button until they tap into and out of the code field.
- **Fix:** Validate the code on change (debounced) and re-validate on mount when a draft is restored; never leave the primary button disabled without a visible reason — either enable it and show field-level errors on submit, or render "Still needed: invite code, city" under it.

### [SEVERITY: High] Signup is hard-walled behind an invite code
- **Where:** `pages/agent/SignupStep1.tsx:345-384` (invite code is the first field and `required`), `:380` ("Don't have an invite code? Request access →" links to `/agent`)
- **Problem:** The first thing a new agent is asked for is a code most of them do not have; the escape hatch is a small 12px teal link that dumps them back on the marketing landing page rather than into a request form or WhatsApp. For a WhatsApp-first audience this is the highest-drop-off point in the whole product.
- **Fix:** Make the "no code" path a real button that opens WhatsApp prefilled ("Hi, I'd like an invite code for IndSure") — the number is already used at `:571`. Consider moving the code field last, so the agent has invested effort before hitting the wall.

### [SEVERITY: High] Auth errors during signup are raw and offer no recovery path
- **Where:** `pages/agent/SignupStep1.tsx:207` (`setError(authError?.message || 'Signup failed. Please try again.')`)
- **Problem:** The commonest failure — "User already registered" — is shown as-is, with no "Sign in instead" or "Reset your password" link. The agent is stuck in a form that will keep failing.
- **Fix:** Detect the already-registered case and render two buttons: Sign in, Forgot password.

### [SEVERITY: High] Draft autosave writes the plaintext password into sessionStorage
- **Where:** `pages/agent/SignupStep1.tsx:73-88` (`update()` persists the whole `form`, including `password`, to `indsure_signup_draft`), read back at `:27-44`
- **Problem:** The nice "Draft saved" affordance (`:330-337`) silently keeps the agent's chosen password in browser storage, readable by any script on the origin. On a shared shop/office machine — common for this audience — it survives until the tab closes.
- **Fix:** Strip `password` (and ideally the invite code) from the persisted object; restore everything else.

### [SEVERITY: High] Account is created before step 2, but the draft is cleared and there is no way back
- **Where:** `pages/agent/SignupStep1.tsx:194-274` (Supabase user + `/api/agent/create-profile` + invite-code burn all happen here), `:267-272` (draft removed), `:274` (navigate to `/agent/signup/empanelment`)
- **Problem:** By the end of step 1 the account exists and the invite code has been consumed. If step 2 fails, is abandoned, or the phone dies, the agent cannot re-run step 1 (code now used, email now registered) and their saved draft is gone. The step indicator (`:312-321`) implies a two-step form; in reality step 1 is irreversible.
- **Fix:** Either defer account creation until the end of step 2, or relabel step 1's button ("Create account") and tell the agent on step 2 that their account already exists and they can finish later by logging in.

### [SEVERITY: Medium] Phone and City sit two-across on a 375px screen
- **Where:** `pages/agent/SignupStep1.tsx:418` (`grid grid-cols-2 gap-4` with no `sm:`/`md:` prefix)
- **Problem:** On a 375px phone each field is roughly 150px wide. The phone placeholder `+91 98765 43210` (`:428`) is truncated, and the city autocomplete dropdown (`:453-468`) is squeezed into that half-width column. Field labels wrap.
- **Fix:** `grid-cols-1 sm:grid-cols-2`.

### [SEVERITY: Medium] Inputs are 14px — iOS zooms the page on focus
- **Where:** `pages/agent/SignupStep1.tsx:296` (`inputClass` includes `text-sm`), applied to every field
- **Problem:** Under 16px, Safari zooms in the moment a field takes focus and the form lurches sideways mid-typing. The team already documented this exact hazard in `components/auth/field.tsx:52-59` and fixed it on the consumer forms — the agent signup never got the fix.
- **Fix:** `text-base` on all inputs here (and in `SignupStep2`).

### [SEVERITY: Medium] City dropdown rows are below the comfortable tap size and mouse-only
- **Where:** `pages/agent/SignupStep1.tsx:456-466` (`px-4 py-2.5` rows, `onClick` on a `div`, no keyboard handling, `onBlur` closes after a 200ms `setTimeout` at `:447`)
- **Problem:** ~40px rows in a half-width column, selectable only by tap; no arrow-key navigation; the blur/timeout race can close the list before the tap registers on a slow device.
- **Fix:** Use a real listbox (`role="option"`, `onMouseDown` instead of `onClick` to beat blur) with `min-h-11` rows.

### [SEVERITY: Medium] Password requirements appear only after typing; placeholder understates them
- **Where:** `pages/agent/SignupStep1.tsx:486` (placeholder "Min. 8 characters"), `:498-513` (checklist gated on `form.password`)
- **Problem:** The placeholder promises one rule; the real rule is three (length + uppercase + number, `:112-117`). The agent types an 8-character lowercase password, then finds out.
- **Fix:** State all three up front, above the field.

### [SEVERITY: Medium] Marketing claims on the signup panel are not supportable
- **Where:** `pages/agent/SignupStep1.tsx:607` ("Join 500+ Indian advisors"), `:622` ("Trusted across 200+ Indian cities"), `:628` ("99.9% uptime guarantee"), `:632-645` (named testimonial "Priya Sharma", "47 policies last month")
- **Problem:** These are specific, checkable claims sitting next to a Terms checkbox. If an agent later finds the numbers are aspirational, it undermines the one thing this product sells (honest policy checking). "99.9% uptime guarantee" is also a contractual word with no SLA behind it.
- **Fix:** Replace with claims you can defend, or make the testimonial clearly illustrative.

### [SEVERITY: Low] No language toggle on either signup step
- **Where:** `pages/agent/SignupStep1.tsx` (no `useLanguage`/`LanguageToggle` import at all), same for `SignupStep2.tsx`
- **Problem:** Login is bilingual; the longest, highest-stakes form in the funnel is English-only.
- **Fix:** Add the toggle and translate the labels.

### [SEVERITY: Low] Reassurance about the phone number only appears after a valid number is typed
- **Where:** `pages/agent/SignupStep1.tsx:471-473`
- **Problem:** "We'll only contact you for important account updates." renders only when `form.phone` is non-empty and valid — i.e. the reassurance arrives after the agent has already decided to hand over their number.
- **Fix:** Show it as static helper text under the field.
