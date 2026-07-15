# Auth Pages Redesign Brief — `/signup` & `/login`

**Goal:** turn two flat, generic SaaS forms into *hot, mobile-first, consumer-grade* pages that convert Instagram traffic into signups — without breaking the anti-lead-farm promise.

**Status:** spec only. No code changed. Hand to designer/build against this.

---

## 0. First, the "leads" nuance (so we don't contradict ourselves)

We told users: **"No calls. No spam. No agent will ever contact you — we sell zero leads."** That's sacred.

So "bring leads" here means **acquisition**, not exploitation:
- ✅ Attract strangers from Instagram → they *choose* to sign up.
- ✅ Make the product so screenshot-worthy people share it.
- ❌ We still never sell/call/spam anyone.

The redesign leans into this as a *marketing weapon*: "the insurance tool that will never spam you" is itself the hook. Say it loud on the page.

---

## 1. Why the current pages are terrible (honest critique)

Both `/signup` and `/login` are:
- **Generic SaaS boilerplate** — centered white card, one input stack, one teal button. Looks like every Bootstrap template from 2016. Nothing says "IndSure," nothing says "India," nothing says "trust me with your policy."
- **Desktop-brained** — a lonely form floating in the middle of a big empty `#F0FFFE` void. On a phone (where 100% of IG traffic lands) it's a cramped, characterless box.
- **Zero emotional payoff** — no imagery, no faces, no social proof, no "why am I doing this," no delight. A cold form asking for your email with no reason to trust or want it.
- **No momentum from the ad** — someone taps an IG ad promising "find the hidden clauses in your policy" and lands on… "Create your free account. Full name (optional)." The story drops dead. No continuity between the ad's promise and the page.
- **No shareability** — nothing here is screenshottable. No moment worth posting.

Bottom line: it converts *intent you already have*. It does nothing to *create* intent or reduce the fear of handing over your details.

---

## 2. The vibe we're going for

Think **Cred / Groww / Fi Money / Zerodha** energy — Indian fintech that feels premium, calm, trustworthy, and a little bit cool — not "insurance website."

Design pillars:
- **Mobile-first, thumb-first.** Design the 390px screen *first*, desktop second. Big tap targets, single-column, form fields reachable by thumb, sticky CTA.
- **Warm + premium, not corporate.** Keep the teal (`#0D9488`) but pair it with depth: a dark hero panel, soft gradients, a real background (not flat cream). One tasteful accent illustration or a blurred dashboard peek behind glass.
- **Confidence through proof, not copy.** Numbers, a real (mock) score, faces/initials, the ₹0 badge.
- **Delight in the details.** Micro-animations on focus, a satisfying button press, a celebratory beat after signup.

---

## 3. Layout spec

### Mobile (primary — design this first)
Top-to-bottom, single column:
1. **Hero strip (dark, ~40% of first screen).** Logo top-left, a bold one-liner that *matches the ad* ("The fine print, decoded." / "Know exactly what your policy won't pay for."), and a blurred glass peek of the dashboard/score behind it. This is the continuity bridge from the IG ad.
2. **The card floats up over the hero** (rounded-top sheet, like Cred/Fi). This overlap is the "premium app" tell.
3. **Trust row** directly under the headline: `🔒 No spam` · `₹0 commission` · `~60-sec audit` — as pills.
4. **The form** — minimal (see §5). Big 52px inputs, big primary button.
5. **Social proof** — "Join 12,000+ Indians who found their coverage gaps" + 3–4 overlapping avatar initials.
6. **Sticky primary CTA** on scroll.

### Desktop
Classic **split screen**:
- **Left (55%, dark):** brand panel — headline, the blurred score/dashboard visual, 3 benefit bullets with icons, social proof, the ₹0 badge. This is the "why."
- **Right (45%, light):** the form. Clean, focused, minimal.

(We already have this exact split built for the *agent* `LoginNew.tsx` — reuse its skeleton, restyle for consumer.)

---

## 4. Copy (write it like a human, not a policy)

**Signup headline options:**
- "See what your policy *won't* pay for."
- "Your insurance, finally in plain English."
- "The fine print, decoded — free."

**Signup subhead:** "Upload your policies, get an unbiased audit in ~60 seconds, and keep everything in one private dashboard."

**Login headline:** "Welcome back." / "Your portfolio's waiting."

**The promise line (must appear on both, prominent):**
> 🔒 We'll never call you, message you, or sell your data. Ever. ₹0 commissions.

**Button microcopy:** not "Create free account" → try **"Analyze my policy — free →"** (matches the homepage CTA, keeps the story continuous). Login: **"Take me to my portfolio →"**.

**Field-level:** friendly placeholders ("you@email.com", "Create a password"), and a tiny reassurance under email: "No spam. We mean it."

---

## 5. Frictionless conversion (kill every extra tap)

IG users are impatient and on mobile. Reduce friction hard:
- **Drop "Full name" from signup entirely** (or collect it later, in-app). Email + password only. Every field removed = measurable lift.
- **Consider social login** — "Continue with Google" as the primary path (one tap, no password, no email-confirm friction). Evaluate against the current email-confirmation flow which adds a "check your inbox" dead-end that *loses IG users*.
- **Consider email magic-link / OTP** instead of password — fewer fields, feels modern, no "forgot password."
- **If we keep email confirmation:** make the "check your inbox" screen a *delightful* moment (illustration, "we sent you a link ✨", a resend button, and what happens next), not the current plain text.
- **Autofocus** the first field; big 52px inputs; numeric keyboards where relevant.

> Note: any auth-provider change (Google OAuth, magic link) is a real backend/Supabase config task, not just UI. Flag as a dependency, not a paint job.

---

## 6. Social proof & trust (the conversion engine)

Insurance = fear + skepticism. Beat it with proof, above the fold:
- **A live-feeling stat:** "12,000+ policies audited" / "₹40Cr+ in coverage gaps found." (Use real numbers once we have them; until then, honest phrasing like "Join early users…")
- **The ₹0 commission badge** — a visual seal, not just text. This is the differentiator.
- **A one-line testimonial** with a name + city ("'Found a room-rent cap I never knew about.' — Priya, Bangalore").
- **Trust marks:** "IRDAI-aligned", "Your data stays in India (RBI compliant)", "We delete nothing you don't want kept."
- **The anti-spam pledge** repeated near the button (the moment of hesitation).

---

## 7. The Instagram / shareability layer (how these pages *bring* signups)

The pages themselves won't go viral — but they must (a) convert ad traffic and (b) plug into shareable loops:

1. **Ad-to-page continuity.** Each IG ad creative should have a matching landing headline/visual (UTM-driven variants). The page's hero must feel like the ad's second frame. Build the signup page to accept a `?hook=` param that swaps the headline to match the ad.
2. **The shareable moment is the *score*, not the form.** The real viral loop lives post-signup: after an audit, generate a **beautiful, branded "Insurance Health Score" card** (e.g. "My cover scored 68/100 — found 3 gaps") designed to be screenshotted to IG Stories, with a subtle IndSure watermark + handle. *That* brings leads. The auth page just needs to get them in the door fast.
3. **Referral hook (later):** "Invite a friend, both get [X]." Surface a teaser on the post-signup screen.
4. **Sample-first path:** IG users are browsers. Keep a low-commitment "See a sample audit" escape hatch on the signup page (no account) — it warms them up, then re-asks for signup. (We already have `/report?sample=health`.)

> Reconcile with the promise: the viral loop is *user-initiated sharing*, not us blasting their contacts. Never auto-import contacts, never message on their behalf.

---

## 8. Motion & delight (the "hot" factor)

- Inputs: subtle scale/border-glow on focus.
- Button: satisfying press (scale-down) + loading state that feels alive.
- Post-signup: a quick confetti/checkmark beat before landing in the portfolio — makes the first impression feel like an *app*, not a form.
- Hero: gentle parallax / floating gradient blobs (we already use this pattern on `/life`).
- Keep it 60fps and tasteful — premium, not gimmicky.

---

## 9. Build checklist (for whoever implements)

- [ ] Mobile-first split: dark hero sheet + floating form card (overlap).
- [ ] Desktop: reuse `LoginNew.tsx` split-screen skeleton, consumer restyle.
- [ ] Headline swaps via `?hook=` param (ad continuity).
- [ ] Minimize fields: email + password only (drop name).
- [ ] Decide + spec: Google OAuth / magic-link vs current email+password+confirm (backend dependency).
- [ ] Trust pills + ₹0 badge + anti-spam pledge near CTA.
- [ ] Social proof block (stat + avatars + 1 testimonial).
- [ ] Delightful "check your inbox" + delightful post-signup beat.
- [ ] Sample-audit escape hatch retained.
- [ ] Consistent CTA copy with homepage ("Analyze my policy — free").
- [ ] Post-signup shareable Score Card (separate workstream — the actual lead engine).

---

## 10. Priority order (if we build incrementally)

1. **Mobile-first visual overhaul** of both pages (hero + form card + trust + proof). Biggest bang.
2. **Field reduction + delightful confirm/post-signup** (conversion lift).
3. **`?hook=` ad-continuity** + sample escape hatch (ties ads to page).
4. **Auth provider upgrade** (Google/magic-link) — backend dependency, evaluate.
5. **Shareable Score Card** — the real IG lead loop (separate, high-value).

---

*Everything above keeps the promise intact: we acquire by being good and shareable, never by harvesting, calling, or spamming. That constraint is the brand — put it on the page.*
