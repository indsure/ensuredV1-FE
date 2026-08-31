# Public Marketing Site — UI/UX + Copy Audit

Scope: logged-out visitor experience. Root: `E:\Indsurefi\IndSure\frontend\client\src`
Paths below are relative to that root.
Audience lens: (a) Indian insurance agents 40+ evaluating a CRM, (b) consumers wanting a policy checked.

---

## Site-wide: Header / Nav / Mobile

### [SEVERITY: Critical] The agent/CRM audience has no marketing path — only a login link
- **Where:** `components/Header.tsx:12-24` (nav arrays), `components/Header.tsx:131-137` (Advisor Login)
- **Problem:** The entire header sells to consumers ("Analyze My Policy — Free"). The only agent-facing element is a small grey `Advisor Login` button that drops a *prospective* agent straight onto `/agent`, a login screen. An agent who has never signed up has nowhere to go: `/advisors-pricing` exists as a page but is linked from nowhere in `navLinks` or `toolsItems`. `Pricing` in the nav points to `/pricing`, the consumer plan page. A 40+ agent evaluating a CRM hits a login wall and leaves.
- **Fix:** Add a top-level "For Advisors" nav item pointing at `/advisors-pricing` (or a dedicated agent landing page), and relabel the login control so it reads as a returning-user action, not an evaluation entry point.

### [SEVERITY: High] Mobile menu is `overflow-hidden` and can exceed a small viewport with no way to scroll
- **Where:** `components/Header.tsx:159`, contents `components/Header.tsx:161-219`
- **Problem:** The open menu renders 4 nav links + a "Tools" label + 4 tool links + divider + 3 full-width buttons inside a container that is explicitly `overflow-hidden`, nested inside a `fixed` header. On a 375x667 device that stack (~13 rows at `py-3`) plus the ~72px header exceeds the viewport, so the bottom items (Log In, the primary sign-up CTA, Advisor Login) become unreachable — the header is fixed, so scrolling the page behind it does not bring them into view.
- **Fix:** Add `max-h-[calc(100vh-5rem)] overflow-y-auto` to an inner wrapper and animate the height on the outer element only.

### [SEVERITY: Medium] Two competing navigation systems on mobile
- **Where:** `components/MobileNav.tsx:7-12` vs `components/Header.tsx:12-24`
- **Problem:** A phone visitor gets a fixed bottom bar (Home / Calculator / Compare / Blog) *and* a hamburger menu with a different, larger set (How It Works, Why IndSure, Pricing, Blog, Tools…). Blog appears in both; Pricing and How It Works appear only in the hamburger; the bottom bar carries no sign-up action at all. Two mental models of "where things are" on one screen.
- **Fix:** Pick one primary mobile nav. If the bottom bar stays, give its last slot the primary CTA rather than duplicating Blog.

### [SEVERITY: Medium] Menu toggle missing `aria-expanded` / `aria-controls`
- **Where:** `components/Header.tsx:142-148`
- **Problem:** The hamburger carries only `aria-label="Toggle menu"`. A screen-reader user cannot tell whether the menu is open, and focus is not moved into it.
- **Fix:** Add `aria-expanded={mobileMenuOpen}` and `aria-controls` pointing at the menu container id; move focus to the first link on open.

### [SEVERITY: Low] "Tools" dropdown mixes a content page with actual tools; two labels are vague
- **Where:** `components/Header.tsx:19-24`
- **Problem:** `What We Check` (`/policychecker`) is an explainer page, not a tool, yet sits beside Calculator and Compare. `Find My Provider` is ambiguous — provider of what: insurer, hospital, advisor?
- **Fix:** Move "What We Check" under How It Works; rename "Find My Provider" to what it actually finds.

### [SEVERITY: Low] Dark-mode classes on the mobile bar only
- **Where:** `components/MobileNav.tsx:73`, `:87-88`
- **Problem:** `dark:bg-gray-800` / `dark:border-gray-700` exist only here; no other public page implements dark mode, so the bar alone would flip if a dark class ever lands on root.
- **Fix:** Drop the `dark:` variants until dark mode is a real site-wide feature.

---

## pages/home.tsx

### [SEVERITY: High] House-copy violation: "AI" is user-facing in the process steps
- **Where:** `pages/home.tsx:312` — `{ step: "02", title: "Decipher", desc: "AI extracts hidden clauses." }`
- **Problem:** Project standard forbids "AI" as a user-facing word on public pages; the vocabulary is "policy check" / "Sach assistant". This sits on the homepage in the most-scanned section.
- **Fix:** Rewrite as "We read every clause, including the fine print." or "Sach assistant pulls out the clauses that matter."

### [SEVERITY: High] Homepage is single-audience, and actively insults the second audience
- **Where:** `pages/home.tsx:98-353` (whole page); specifically `pages/home.tsx:265`
- **Problem:** Every headline, CTA, stat and section addresses a consumer with a policy. Line 265 then runs down the other audience outright: `{ title: "Biased Advice", desc: "Agents are incentivized to sell, not to analyze." }`. An insurance agent who lands on the homepage is told the product exists because people like them cannot be trusted, and finds no path to the agent product.
- **Fix:** Add an "Are you an advisor?" band near the bottom linking to advisor pricing, and retarget line 265 at the incentive structure rather than agents as a class (e.g. "Advice paid for by the seller, not by you").

### [SEVERITY: High] Unverifiable benchmark presented as product output
- **Where:** `pages/home.tsx:203` — `Top 15% of policyholders`
- **Problem:** This claims a score distribution across a population of policyholders. No such benchmark exists at this stage of the product. The "Illustrative example" badge sits at `:175`, above and outside the white card, so a scanning visitor reads the percentile as a real capability.
- **Fix:** Remove the percentile, or replace it with something the product actually computes. If kept, move the "Illustrative example" label inside the card.

### [SEVERITY: High] Hero stat strip mixes a policy stance with unsourced counts
- **Where:** `pages/home.tsx:152-156` — `₹0 / Commissions earned, ever`, `50+ / Risk checks per audit`, `10 / Insurers covered`, `63 / Plans indexed`
- **Problem:** Four items presented as one equivalent "trust strip", so the auditable-sounding counts (10 insurers, 63 plans) borrow credibility from the honest stance items. Nothing on the page says which insurers or plans, and "50+ risk checks" recurs at `:313` ("50+ risks checked instantly") with no definition anywhere on the page.
- **Fix:** Make each number clickable to the thing it counts (insurer list, plan index, `/policychecker` for the checks). Cut any number a visitor cannot verify.

### [SEVERITY: Medium] Primary CTA promises analysis, delivers a signup form
- **Where:** `pages/home.tsx:122-126`, `pages/home.tsx:341-345`, `components/Header.tsx:123-127`
- **Problem:** "Analyze My Policy — Free" describes the end state; the click lands on account creation. Three identical CTAs on one page all point at a registration wall, with no expectation-setting.
- **Fix:** Label honestly, or let the upload happen first and gate on results. At minimum add "Takes about 2 minutes. No card needed." beneath the button.

### [SEVERITY: Medium] "See a Sample Analysis" scrolls to a mock-up, not a sample report
- **Where:** `pages/home.tsx:127-131`, `pages/home.tsx:346-350` (`href="#demo"`); target `pages/home.tsx:170-253`
- **Problem:** The secondary CTA at both conversion points promises a sample analysis and jumps to an animated illustration with three hard-coded bars. A visitor who wanted to judge output quality before signing up gets nothing to judge.
- **Fix:** Point at a real anonymised report, or relabel to "See what a report looks like".

### [SEVERITY: Medium] Jargon in the section that has to sell the output
- **Where:** `pages/home.tsx:177` (`Forensic Analysis`), `:180` (`bank-grade audit`), `:246` (`porting`, `proportionate deduction`)
- **Problem:** House voice is professional simple English for 40+ readers. "Forensic Analysis" and "bank-grade audit" are unverifiable marketing adjectives; "proportionate deduction" is undefined jargon in the single sentence meant to demonstrate value.
- **Fix:** "Forensic Analysis" → "What your report shows"; drop "bank-grade"; gloss proportionate deduction in half a line.

### [SEVERITY: Low] Decorative marquee is exposed to screen readers and ignores reduced motion
- **Where:** `pages/home.tsx:28-51`
- **Problem:** "Insurance Clarity / Finally" at `opacity-10` is purely decorative but is announced as content, and the infinite 30s animation does not respect `prefers-reduced-motion`.
- **Fix:** `aria-hidden="true"` on the wrapper; gate the animation on `prefers-reduced-motion`.

### [SEVERITY: Low] Trust-strip labels are tiny, muted, all-caps and wide-tracked
- **Where:** `pages/home.tsx:160` — `text-xs uppercase tracking-widest text-[var(--color-white-muted)]`
- **Problem:** ~12px muted grey all-caps on navy is the hardest combination for the stated 40+ audience, and it carries the qualifying text that makes the numbers mean anything.
- **Fix:** `text-sm`, sentence case, brighter foreground token.

---

## Site-wide: components/Footer.tsx

### [SEVERITY: High] Unverifiable superlative and an unsupported proof claim in the footer, on every page
- **Where:** `components/Footer.tsx:38-40` — "We replace confusion with forensic intelligence. / The only insurance audit engine engineered for the modern Indian policyholder."; `components/Footer.tsx:176` — "Built for Indian policy documents. Tested on real claim rejections."
- **Problem:** "The only" is a market-exclusivity claim with nothing behind it, and it appears on every single page of the site. "Tested on real claim rejections" asserts a validation methodology that is documented nowhere on the site — no case studies, no sample, no count. For an early-stage product these read as invented credibility, and they are the last thing a sceptical visitor reads.
- **Fix:** Drop "The only". Replace "Tested on real claim rejections" with something checkable, or cut it. If real rejection cases were studied, publish them and link the claim to that page.

### [SEVERITY: High] `/help` is routed but linked from nowhere — no Help or Contact route exists on the public site
- **Where:** `App.tsx:276` (`<Route path="/help" component={Help} />`); the only reference to the URL anywhere in the app is inside the page itself, `pages/help.tsx:93`
- **Problem:** Neither `components/Header.tsx` nor `components/Footer.tsx` links to `/help`. There is also no contact email, phone number, or "Contact us" link anywhere in the footer. A visitor with a question — a consumer unsure about privacy, or a 40+ agent who wants to speak to someone before paying — has no route to support other than the Grievance Officer legal page.
- **Fix:** Add "Help & Support" to the footer's link column and a contact email to the bottom bar. Consider a "Contact" item in the header for the agent audience.

### [SEVERITY: High] Social icon links have no accessible name, and open cross-origin without `rel`
- **Where:** `components/Footer.tsx:46-52`
- **Problem:** The anchors contain only an SVG icon. `social.name` is used as a React `key` but never rendered and never applied as `aria-label` or `title`, so a screen reader announces three unlabelled links. They also carry no `target`/`rel`, so LinkedIn/X/Instagram replace the site in the same tab with no `noopener`.
- **Fix:** Add `aria-label={social.name}`, plus `target="_blank" rel="noopener noreferrer"`.

### [SEVERITY: Medium] Footer bottom bar right-aligns everything on mobile
- **Where:** `components/Footer.tsx:172` — `flex flex-col md:flex-row justify-between items-end`
- **Problem:** `items-end` is unqualified, so in the mobile column layout the copyright, CIN and disclaimer all sit flush right against a left-aligned footer above them. The disclaimer block at `:178` additionally forces `text-right max-w-xs` at every breakpoint.
- **Fix:** `items-start md:items-end`, and `md:text-right` on the disclaimer.

### [SEVERITY: Medium] Legal links use raw `<a href>` inside a SPA, forcing a full page reload
- **Where:** `components/Footer.tsx:147`, `:152`, `:157`, `:162`
- **Problem:** Every other footer link uses wouter's `<Link>`; the four legal links use plain anchors. Clicking Privacy Policy tears down and re-downloads the whole app, which on a mid-range Indian phone on 4G is a multi-second blank screen — precisely for the visitor who was already nervous enough to check the privacy page.
- **Fix:** Convert all four to `<Link href=...>`.

### [SEVERITY: Medium] "Start Here" column is actually a sitemap, and it buries the advisor path
- **Where:** `components/Footer.tsx:76-139`
- **Problem:** A column headed "Start Here" holds eight items ranging from a CTA ("Start an Audit") to "Meet the Team" and two different pricing pages. "Pricing" and "Pricing (Advisors)" sit adjacent as sibling links with a parenthetical to tell them apart — the agent product's only discoverable entry point on the entire public site is a parenthesis in the footer.
- **Fix:** Split into "For you" and "For advisors" columns; label the advisor link "For insurance advisors", not "Pricing (Advisors)".

### [SEVERITY: Medium] Bottom-bar text is 10-11px, uppercase, wide-tracked, at 60-70% opacity on navy
- **Where:** `components/Footer.tsx:172` (`text-xs uppercase tracking-widest`), `:175` (`opacity-60 text-[11px] sm:text-[10px]`), `:176`, `:178` (`opacity-70`)
- **Problem:** The CIN, the "no commission" disclaimer and the IRDAI status — the three highest-trust facts on the page — are rendered in the least legible type on the site. `opacity-60` on `--color-white-muted` over navy will not clear WCAG AA. The 40+ target audience will simply not read it.
- **Fix:** Minimum 13px, sentence case, no opacity reduction on legal/trust text.

### [SEVERITY: Low] Dead icon imports
- **Where:** `components/Footer.tsx:2-9` — `Facebook`, `Youtube`, `Mail` imported, none used
- **Problem:** Suggests footer social/contact rows were removed and not cleaned up; `Mail` in particular hints at a contact link that was dropped.
- **Fix:** Remove the unused imports, or restore the contact email they were for.

---

## Site-wide: house-copy violations ("AI" / "credits")

### [SEVERITY: High] "AI" appears as a user-facing word on at least six public pages
- **Where:**
  - `pages/home.tsx:312` — "AI extracts hidden clauses."
  - `pages/vision.tsx:46` — "Cutting-edge AI that gets smarter every day."
  - `pages/vision.tsx:67` — "Launched AI-powered policy analysis platform"
  - `pages/vision.tsx:162` — "Insurance literacy is democratized through accessible, AI-powered tools"
  - `pages/help.tsx:24` — "Our AI extracts key coverage details…"
  - `pages/help.tsx:40` — "Our AI uses deterministic analysis based on IRDAI guidelines…"
  - `pages/life.tsx:52`, `:347`, `:448` — "We use AI to read your policy PDF clause-by-clause…", "Our AI reads every clause, every rider, every exclusion."
  - `pages/vehicle.tsx:48`, `:347`, `:448` — same pattern for motor
- **Problem:** Direct, repeated breach of the house rule that "AI" must not appear as a user-facing word (product vocabulary: "policy check", "Sach assistant"). `pages/help.tsx:40` is self-contradictory on top of that — "Our AI uses deterministic analysis" describes two opposite things in one sentence.
- **Fix:** Sweep all of the above to the approved vocabulary. `life.tsx` and `vehicle.tsx` carry the identical sentence three times each, so they are three edits per page.

### [SEVERITY: Medium] "Sach AI" vs "Sach assistant" — the product has two names
- **Where:** `pages/pricing.tsx:70`, `:86` use "Sach assistant"; `pages/PrivacyPolicy.tsx:41`, `:42`, `:71`, `:109` and `pages/TermsOfService.tsx:57`, `:100` use "Sach AI"
- **Problem:** A visitor comparing the pricing page against the terms sees two different product names and cannot tell whether they are the same feature. (Legal pages may legitimately need to name the underlying technology in section 4 of the Terms; the *feature name* still should not vary.)
- **Fix:** Standardise the feature name to "Sach assistant" everywhere, including legal pages; keep the technology disclosure in the Terms' AI-limitations section only.

---

## pages/pricing.tsx

### [SEVERITY: Critical] The page promises a free-forever plan; the file's own comment says the server enforces a 30-day trial
- **Where:** Copy: `pages/pricing.tsx:41-42` (`period: "forever"`), `:51` ("No expiry date. Stays free as long as you want it"), `:88` (comparison table row `Expires: Free "Never"`), `:101-103` (FAQ: "Is the free plan really free forever?" → "Yes. There is no trial clock and no card."). Contradicted by the source comment at `pages/pricing.tsx:13-16`: "The free tier below describes what checkIndividualQuota actually enforces: a 30-day full-access window from signup, one policy per line of business. It is a trial, not a standing free tier."
- **Problem:** If the server still enforces a 30-day window, the page states the opposite in four separate places including an explicit FAQ denial ("There is no trial clock"). A user signs up on the strength of "free forever" and loses access after a month. This is the single most damaging thing on the public site — it is a direct, checkable misrepresentation of the commercial terms.
- **Fix:** Verify `checkIndividualQuota` on the backend and make the four copy locations match it exactly. If it really is free forever, delete the stale comment at `:13-16` so the next person does not re-break it. Do not ship the two versions side by side.

### [SEVERITY: High] Prices give no GST treatment
- **Where:** `pages/pricing.tsx:39-44`, `:60-64`, `:106`, `:140`
- **Problem:** "₹99 a month", "₹999 a year" appear with no indication of whether GST is included or added at checkout. In India this is the first thing a buyer checks, and an unexpected 18% at payment is a standard abandon point. The FAQ covers monthly-vs-yearly (`:104-107`) but never touches tax.
- **Fix:** State "including GST" or "plus 18% GST" beside the price and add a tax line to the FAQ.

### [SEVERITY: High] "Unlimited consultation with our team" is an operational promise the business cannot presently keep
- **Where:** `pages/pricing.tsx:69`, `:87`, `:108-111`
- **Problem:** A ₹999/year plan promises unlimited human consultation on any question about the buyer's portfolio, qualified only by "fair use", which the FAQ defines as "not for running someone else's advice practice" — a limit about *who*, not *how much*. At current team size this is unfulfillable at any volume, and unfulfilled support promises are what generate the grievance cases the site has a whole page for.
- **Fix:** Bound it concretely ("up to 2 consultations a year", or "email support, answered within 2 working days") rather than "unlimited".

### [SEVERITY: Medium] The Free plan's actual hard limit — one health check, ever — is never stated on the card
- **Where:** Card: `pages/pricing.tsx:46-51`; table: `pages/pricing.tsx:80` (`Health policy checks — free: "1"`)
- **Problem:** The Free card lists "Full health policy check in plain language" with no quantity. Only the comparison table further down reveals it is one, and even there "1" carries no period, so a reader may take it as one per year against the Personal plan's "4 a year". The single most consequential limit on the free plan is the one the card omits.
- **Fix:** Put "One health policy check (one-time)" on the card, and make the table cell read "1, one-time".

### [SEVERITY: Medium] Hero price is hard-coded to the annual figure and does not follow the billing toggle
- **Where:** `pages/pricing.tsx:140` (`₹999 a year.`) vs the toggle at `:149-167`
- **Problem:** Switching to Monthly changes the cards to ₹99 but the headline above still reads "₹999 a year", so both figures are on screen at once with no relationship shown. A visitor scanning the headline takes ₹999 as the price of entry when a ₹99 monthly option exists.
- **Fix:** Bind the headline to the toggle state, or reword to "from ₹99 a month".

### [SEVERITY: Medium] Nothing on the page says how to pay, whether it renews, or how to cancel
- **Where:** whole of `pages/pricing.tsx`; FAQ `:91-120`
- **Problem:** Seven FAQs and none of them answer: which payment methods, does it auto-renew, can I get a refund, how do I cancel. For the 40+ audience the auto-renew question in particular is a hard blocker on entering card details.
- **Fix:** Add three FAQ entries — payment methods (UPI/cards), auto-renewal and how to turn it off, refund window.

### [SEVERITY: Low] Comparison table carries a row that says nothing
- **Where:** `pages/pricing.tsx:88` — `{ label: "Expires", free: "Never", paid: "Never" }`
- **Problem:** A comparison row where both columns read "Never" differentiates nothing and takes the last, most-read slot in the table.
- **Fix:** Remove it, or replace with a row that actually differs between the plans.

### [SEVERITY: Low] The advisor cross-link is the last line on the page, in small grey text
- **Where:** `pages/pricing.tsx:287-292`
- **Problem:** "Are you an insurance agent or advisor? See advisor plans" sits below the closing CTA in `text-sm text-[var(--color-text-secondary)]` — an agent who reached the pricing page from the header's "Pricing" link must scroll past two plans, a nine-row table and seven consumer FAQs before learning they were on the wrong page.
- **Fix:** Put the audience switch at the *top* of the page, next to the "For you and your family" badge at `:135-137`.

---

## pages/not-found.tsx

### [SEVERITY: Critical] The 404 page ships developer placeholder text and offers no way back
- **Where:** `pages/not-found.tsx:22` — "Did you forget to add the page to the router?"; whole file `pages/not-found.tsx:1-28`
- **Problem:** Any visitor who mistypes a URL, follows a stale link, or lands on a removed blog post gets a bare card that asks *them* whether they forgot to add a page to the router. It is scaffolding copy that was never replaced. There is no link home, no search, no suggested pages, no `Header`, no `Footer` and no logo — the visitor is stranded with no navigation of any kind, and the page does not even look like IndSure (hard-coded `#F0FFFE` / blue-cyan-indigo blur blobs, `dark:` variants, none of which match the site's cream/navy/teal system).
- **Fix:** Rewrite the copy for a human ("We could not find that page."), render `<Header />` and `<Footer />` so the visitor keeps the site nav, add three explicit links (Home, How It Works, Blog) plus the primary CTA, and restyle onto the site's tokens.

---

## pages/advisors-pricing.tsx

### [SEVERITY: High] "Most Popular" badge is fabricated social proof
- **Where:** `pages/advisors-pricing.tsx:219-222`
- **Problem:** The Agent tier carries a "Most Popular" ribbon. With roughly a dozen agents on the platform and one paying, there is no popularity distribution to report — the badge exists purely to steer choice, and it is the exact kind of invented proof an investor or a sceptical advisor will test.
- **Fix:** Replace with an honest framing of the same nudge: "Recommended" or "Best for a full-time advisor".

### [SEVERITY: High] "Talk to us" and "Talk to Us for 15 minutes" both lead to a login screen
- **Where:** `pages/advisors-pricing.tsx:82-83` (Agency tier CTA → `/agent`), `pages/advisors-pricing.tsx:335-341` (closing CTA "Not sure which plan fits? Talk to us for 15 minutes…" → `/agent`)
- **Problem:** `/agent` is `AgentLanding` (`App.tsx:187`), the advisor login/landing route — not a contact form, not a calendar, not a phone number. The page's two highest-intent buttons, aimed squarely at the 40+ agent who wants to speak to a person before paying, deliver a sign-in screen instead. This is the conversion path for the entire agent business and it dead-ends.
- **Fix:** Point both at a real contact channel — a WhatsApp deep link, a phone number, or a booking form. For this audience a tap-to-WhatsApp button will outperform any form.

### [SEVERITY: High] The Founding 50 offer has no way to claim it
- **Where:** `pages/advisors-pricing.tsx:178-193`
- **Problem:** The banner offers "a full year at ₹4,999 (was ₹9,999) — half price, locked in forever" but contains no button and no link. The ₹4,999 price appears in no tier card and in no state of the billing toggle; the Agent card shows ₹9,999 annual regardless. A visitor who wants the offer has to guess that "Start free" is the route to it, and nothing tells them how many of the 50 places remain.
- **Fix:** Make the banner itself a CTA ("Claim a Founding 50 place"), and either show remaining places or drop the "50" framing.

### [SEVERITY: Medium] Two paid plans are sold substantially on a feature that does not exist
- **Where:** `pages/advisors-pricing.tsx:58` and `:78` ("Soon" badges), `:97` ("Live quotes … (coming soon)"), `:130-132` (FAQ), `:134-136` ("prices for new signups will go up" when it launches), `:189`, `:286`
- **Problem:** "Live premium quotes across insurers" is listed as a bullet inside the paid tiers' feature lists, appears as a row in the comparison table with allowances quoted for both paid plans, and is then used as the stated justification for a future price rise and for the Founding 50 urgency — six references across the page. Its limits are "announced at launch" and there is no date. The visitor is being asked to pay now, and to hurry, for capability that is not shipped.
- **Fix:** Move unbuilt features out of the tier bullet lists and the comparison table into a clearly separated "On the roadmap" block with no allowances quoted, and stop using it to justify urgency until a date exists.

### [SEVERITY: Medium] The billing toggle does nothing for the Agency tier, but still advertises "2 months free"
- **Where:** `pages/advisors-pricing.tsx:69-74` (`price` and `priceAnnual` both `₹799`, both periods `/ seat / month`) against the toggle label at `:207-209`
- **Problem:** Flipping to Annual displays "(2 months free)" beside the switch while the Agency card is unchanged at ₹799 / seat / month. An agency owner cannot tell whether the discount applies to them, and there is nothing on the card to say it does not.
- **Fix:** Either give Agency a real annual price or add an explicit "Annual billing available — talk to us" line on that card.

### [SEVERITY: Medium] The lines of business covered by data entry are listed three different ways
- **Where:** `pages/advisors-pricing.tsx:37` ("motor / life / term / travel"), `:94` ("motor / life / travel / property"), `:119` ("motor / life / term / travel")
- **Problem:** The card, the comparison table and the FAQ each name a different set. Term appears in two, property in one. An advisor deciding whether the tool handles their book cannot tell what it actually supports.
- **Fix:** Define the list once in a constant and render it in all three places.

### [SEVERITY: Medium] Billing toggle is inconsistent with the consumer page in both default and accessibility
- **Where:** `pages/advisors-pricing.tsx:156` (`useState(false)`) and `:198-206`, against `pages/pricing.tsx:125` (`useState(true)`) and `:153-159`
- **Problem:** The consumer page opens on Annual, the advisor page on Monthly, so the same control behaves differently on two pages a visitor may compare. The advisor toggle also drops the `role="switch"` and `aria-checked` that the consumer one has, so assistive tech gets an unlabelled state-less button.
- **Fix:** Same default on both; add `role="switch"` and `aria-checked={annual}` here too.

### [SEVERITY: Low] GST disclosure is present here but rendered as the smallest, faintest text on the page
- **Where:** `pages/advisors-pricing.tsx:263-265` — `text-center text-xs text-[var(--color-text-muted)]`
- **Problem:** "All prices in INR, inclusive of GST" is genuinely useful and is the one thing the consumer pricing page is missing — but it is set below the cards in muted 12px, easy to miss entirely.
- **Fix:** Move it inline beneath each price, or at least raise to `text-sm` in the main text colour. And port it to `pages/pricing.tsx`, which has no GST statement at all.

### [SEVERITY: Low] Price-justification copy asserts the advisor's economics
- **Where:** `pages/advisors-pricing.tsx:173-174` ("close one policy and it has paid for itself"), `:273-274` ("That's less than ₹100 to walk into a client meeting…The commission on a single closed policy covers your month many times over.")
- **Problem:** Both claims assume a commission size the site does not know and cannot know — it varies enormously by line of business and ticket size. For a term-life advisor writing small cases it is simply untrue.
- **Fix:** Soften to a conditional ("For most advisors, one closed policy covers the year") or attach the assumption.

---

## pages/how-it-works.tsx

### [SEVERITY: Critical] The page promises "No signup" twice — the product is gated behind an account
- **Where:** `pages/how-it-works.tsx:25` ("No account needed to see your first result"), `pages/how-it-works.tsx:201` ("Two minutes. No signup. Just clarity.")
- **Problem:** Every conversion path on the site sends the visitor to `/signup` (`pages/home.tsx:122`, `:341`, `components/Header.tsx:123`, `pages/pricing.tsx:54`, `:74`, `:282`), and `pages/pricing.tsx:13-16` describes a server-side quota keyed to signup. A visitor persuaded by "No signup" clicks the CTA on this very page and hits an account wall. That is the worst possible moment to break a promise — you have already won the visitor's attention and then contradicted yourself at the click.
- **Fix:** Remove both claims, or make the first check genuinely anonymous. If the wall stays, replace with "Create a free account — no card needed", which is still a strong offer.

### [SEVERITY: Critical] "We delete the source file" contradicts the product the rest of the site sells
- **Where:** `pages/how-it-works.tsx:74` ("Your documents are processed securely and deleted after analysis"), `pages/how-it-works.tsx:161-163` ("Once your report is generated, we delete the source file")
- **Problem:** `pages/pricing.tsx:49` promises "Renewal reminders 30 days before expiry", `:67` sells "Room for 12 more policies", and `:81` counts "Policies stored and tracked". A portfolio that stores 16 policies and watches their renewal dates is incompatible with deleting the source file after analysis. One of the two statements is wrong, and both are on the public site simultaneously — a privacy-conscious visitor who notices will not trust either.
- **Fix:** State the real retention behaviour once, matching the Privacy Policy's retention table, and reuse that exact wording on both pages.

### [SEVERITY: High] The primary CTA on this page goes to an explainer, and `/policychecker` has three different names
- **Where:** `pages/how-it-works.tsx:205` ("Check My Coverage" → `/policychecker`); same route labelled "What We Check" in `components/Header.tsx:20`, "Start an Audit / Upload your policy. Takes ~2 minutes." in `components/Footer.tsx:79-86`, and "See everything our audit checks" in `pages/home.tsx:182-185`
- **Problem:** One URL is presented under four different promises — two of them action verbs ("Check My Coverage", "Start an Audit") and two of them content labels ("What We Check", "See everything our audit checks"). A visitor cannot form a model of where that link goes, and someone who clicks "Start an Audit" expecting an upload box has no idea whether they arrived in the right place.
- **Fix:** Decide what `/policychecker` is. If it is the upload flow, rename it everywhere as an action; if it is an explainer, stop using action verbs for it and point the CTAs at the actual upload route.

### [SEVERITY: Medium] Heading order skips from `h1` to `h3`
- **Where:** `pages/how-it-works.tsx:102` (`h1`) then `:136` (`h3` for every step) with no intervening `h2`; identical pattern in `pages/why-indsure.tsx:49` (`h1`) → `:78` (`h3` pillars)
- **Problem:** The four step cards — the main content of the page — are the first headings after the `h1` and they are level 3. A screen-reader user navigating by heading gets a hole in the outline and cannot tell the steps are the page's primary structure.
- **Fix:** Add a visually-hidden `h2` above the steps section ("The four steps"), or promote the step titles to `h2`.

### [SEVERITY: Medium] Unverifiable "forensic-grade" and unsourced rejection-pattern claims
- **Where:** `pages/how-it-works.tsx:107-108` ("a forensic-grade audit before your coffee gets cold"), `:46` ("checked against known claim-rejection patterns"), `:48` ("50+ individual risk checks per policy")
- **Problem:** "Forensic-grade" is not a grade of anything. "Known claim-rejection patterns" implies a corpus of rejection data that is nowhere described. The "50+" figure appears on three pages (`home.tsx:154`, `:313`, here, `why-indsure.tsx:33`) and is never enumerated anywhere on the site.
- **Fix:** Drop "forensic-grade". Publish the check list — even a summarised one — and link every occurrence of "50+" to it. A visitor who can see the list will believe the number; one who cannot will discount everything else on the page too.

### [SEVERITY: Low] Timing claims are precise to the second but do not add up
- **Where:** `pages/how-it-works.tsx:21` (~30s), `:33` (~45s), `:45` (~15s), `:57` ("Ready instantly") = ~90 seconds, against `:70` ("Under 2 minutes end to end") and `:201` ("Two minutes")
- **Problem:** Minor, but the per-step precision invites the reader to add them up, and the totals quoted elsewhere are different numbers. Precision that does not reconcile reads as invented.
- **Fix:** Use ranges ("under a minute", "a couple of minutes") rather than second-level estimates.

---

## pages/why-indsure.tsx

### [SEVERITY: High] Unsourced "thousands of claims rejected every year" statistic
- **Where:** `pages/why-indsure.tsx:93` — "Every year, thousands of claims are rejected not because of fraud, but because of clauses buried in page 42 of a policy document"
- **Problem:** This is the emotional core of the whole page and it carries no source. IRDAI publishes claim repudiation data annually — citing it would make the point far stronger. Uncited, it is indistinguishable from a number that was made up to sell, on a page whose entire argument is that IndSure is the honest one.
- **Fix:** Cite the IRDAI annual report figure with a year and a link, or reword to a qualitative statement.

### [SEVERITY: Medium] Competitor disparagement that cannot be substantiated
- **Where:** `pages/why-indsure.tsx:11` ("That takes months of work most competitors won't do"), `:26` ("That's not a tagline, it's a structural constraint most of this industry can't claim")
- **Problem:** Two claims about what unnamed competitors do and cannot do. Neither is checkable, and in Indian insurance-adjacent marketing, unsubstantiated comparative claims are a real regulatory exposure as well as a credibility one.
- **Fix:** Make the positive case (what IndSure built, how long it took) and drop the comparison.

### [SEVERITY: Medium] The site's most agent-relevant argument sits on a consumer page with no agent CTA
- **Where:** `pages/why-indsure.tsx:19-22` ("Distribution" pillar: "We built for the channel that already reaches millions of Indian households: the insurance advisor… in agents' hands, with WhatsApp as the front door, not a CRM login") against the page's CTAs at `:116-121` (`/policychecker`, `/compare`)
- **Problem:** The one paragraph on the public site that explains the advisor product is buried as pillar three of four on a consumer trust page, and both CTAs beneath it are consumer actions. An agent who read that paragraph and wanted in has nowhere to click.
- **Fix:** Add a third CTA — "For advisors: see the plans" → `/advisors/pricing`.

### [SEVERITY: Medium] The "deterministic engine" claim contradicts the "AI" claims elsewhere
- **Where:** `pages/why-indsure.tsx:16` ("Our engine reads clause-by-clause, deterministically — the same policy produces the same audit every time") against `pages/help.tsx:40` ("Our AI uses deterministic analysis"), `pages/life.tsx:347` and `pages/vehicle.tsx:347` ("Our AI reads every clause…")
- **Problem:** A visitor reading two pages gets two incompatible descriptions of how the product works, and `help.tsx:40` manages to contain both in one sentence. Determinism is a strong, differentiating claim — pairing it with "AI" on other pages undermines it.
- **Fix:** Settle on one accurate description and use it everywhere. This is the same edit as the house-copy sweep on "AI".

### [SEVERITY: Low] Same four stats as the homepage, formatted differently
- **Where:** `pages/why-indsure.tsx:30-35` (`"0"`, "Commissions earned, ever") vs `pages/home.tsx:153` (`"₹0"`)
- **Problem:** A bare "0" for a rupee figure reads as a count, not an amount. The two pages also order the four stats differently, so they do not register as the same set.
- **Fix:** Extract the stat set to one shared constant, keep the ₹ symbol.

### [SEVERITY: Low] Vague CTA heading
- **Where:** `pages/why-indsure.tsx:111` — "Experience the Difference"
- **Problem:** Says nothing about what happens next; the two buttons beneath it do the actual work. On a page arguing for plain honesty, this is filler marketing language.
- **Fix:** "See what your own policy says."

---

## pages/help.tsx

> This page is unreachable from any nav (see the Footer section above). Every finding below is therefore latent — but the page is live at `/help`, is in the sitemap-eligible route table, and is what search traffic will land on.

### [SEVERITY: Critical] The only support email on the Help page points at a domain the company no longer uses
- **Where:** `pages/help.tsx:61-62` (`contact@ensured.in`) and `pages/help.tsx:166` (same address on the "Email Us" button)
- **Problem:** `ensured.in` is the retired V1 brand; the company is indsure.in. A visitor who follows the Help page's primary support route sends mail into a domain the business does not operate. Support requests silently vanish.
- **Fix:** Replace with a live indsure.in support mailbox and use the same address everywhere on the site.

### [SEVERITY: Critical] Four FAQ answers describe a product that no longer exists
- **Where:** `pages/help.tsx:28` ("Is my data stored? No… We don't store your personal information, policy details, or any uploaded documents"), `:36` ("Will I receive sales calls? Never. We don't collect your phone number or email address. There's no signup required"), `:52` ("Is the service free? Yes, our policy analysis service is completely free. We don't charge for analysis"), `:32` ("We support PDF format only")
- **Problem:** All four are contradicted by the current product and by other public pages. Signup is mandatory and collects an email (`components/Header.tsx:123`, `pages/pricing.tsx:54`); the portfolio stores up to 16 policies with renewal reminders (`pages/pricing.tsx:67`, `:81`); the service is priced at ₹99/month or ₹999/year (`pages/pricing.tsx:60-61`); and `pages/how-it-works.tsx:24`, `:82` say photos and scans are accepted, not PDF only. "The service is completely free" on a page that is one click from a paid pricing page is the kind of contradiction that ends up in a consumer complaint.
- **Fix:** Rewrite the whole FAQ set against the current product, then keep it in sync with `pricing.tsx` — ideally by sourcing the plan limits from one shared constant.

### [SEVERITY: Medium] Page is styled in the retired V1 visual language
- **Where:** `pages/help.tsx:81-88` (hard-coded `#F0FFFE` background, blue/cyan/teal/indigo blur blobs, `dark:` variants), `:99`, `:114` (`#1A3A52` / `#4A9B9E` gradients)
- **Problem:** Nothing here uses the site's design tokens (`--color-cream-main`, `--color-green-primary`, the serif display face). A visitor who navigates from any other page lands somewhere that does not look like the same product. `pages/not-found.tsx` and `pages/vision.tsx` share the identical stale styling.
- **Fix:** Restyle onto the token system used by `how-it-works.tsx` / `why-indsure.tsx`.

### [SEVERITY: Low] "Documentation / Read Docs" links to the blog
- **Where:** `pages/help.tsx:72-77`
- **Problem:** A support card promising documentation delivers a marketing blog index. A visitor with a how-do-I question gets articles about room-rent caps.
- **Fix:** Relabel to "Guides and articles", or write actual product docs.

---

## pages/mission.tsx

### [SEVERITY: Critical] "10,000+ Policies Decoded" is fabricated
- **Where:** `pages/mission.tsx:107-108`
- **Problem:** Rendered as a large hero statistic inside its own animated panel. The platform has run on the order of dozens of analyses in its lifetime. This is not an aspirational statement or a rounded figure — it is a specific counter, presented as achievement, off by roughly three orders of magnitude. Anyone who diligences the company will find it, and it discredits the genuinely honest claims elsewhere on the site (the zero-commission stance in particular).
- **Fix:** Delete it. If a number is wanted there, use one that is true and still meaningful — plans indexed, clauses codified, insurers covered.

---

## pages/vision.tsx

### [SEVERITY: Critical] The roadmap is stale and its targets are fictional
- **Where:** `pages/vision.tsx:63-79` — `{ year: "2024", achievement: "Launched AI-powered policy analysis platform", status: "completed" }`, `{ year: "2025", achievement: "Reach 100K+ policy analyses, expand to regional languages", status: "in-progress" }`
- **Problem:** The page presents a public roadmap whose most recent milestone is marked "in-progress" for a year that ended eight months ago, with a target of 100,000 analyses against an actual figure in the dozens. A visitor reads this as either "abandoned company" or "company that misses its stated goals by 4 orders of magnitude". Both are worse than having no roadmap page.
- **Fix:** Either refresh with honest, near-term commitments and real status, or remove the milestone timeline entirely.

### [SEVERITY: High] "No signup required. No BS." — false, and it breaks the house copy rule
- **Where:** `pages/vision.tsx:301`
- **Problem:** Signup is required everywhere on the site (see the how-it-works finding above). Separately, "No BS." is exactly the register the public-copy standard rules out — public pages are meant to read as professional simple English for a 40+ audience.
- **Fix:** "See what your own policy covers. Free to start."

### [SEVERITY: High] "No storage" claim, contradicted by the stored-portfolio product
- **Where:** `pages/vision.tsx:53-54` — "Zero Compromise / No sales. No storage. No bias. Ever."
- **Problem:** The third public page to promise non-storage (`how-it-works.tsx:74`, `help.tsx:28`) while `pricing.tsx` sells a 16-policy stored portfolio with renewal tracking. "Ever" makes it a permanent commitment the product already breaks.
- **Fix:** Replace with the accurate commitment ("Your documents are never sold or shared, and you can delete them at any time").

### [SEVERITY: Medium] The closing CTA sends the visitor back to the homepage
- **Where:** `pages/vision.tsx:305-311` — button labelled "Analyze Your Policy" wrapped in `<Link href="/">`
- **Problem:** The page's single conversion action returns to the page the visitor most likely came from, with no upload and no signup. It is a loop, not a funnel.
- **Fix:** Point at `/signup` (or the upload route), matching every other CTA on the site.

### [SEVERITY: Medium] Off-brand styling and gradient display text
- **Where:** `pages/vision.tsx:117` (`font-black bg-gradient-to-r … bg-clip-text text-transparent`), plus `dark:` variants throughout
- **Problem:** The `h1` is gradient-filled transparent text — it inherits none of the site's serif display treatment, it is the hardest kind of text to keep legible at AA contrast, and it renders as invisible if the background clip fails. The rest of the page uses the retired V1 palette (`#1A3A52`/`#4A9B9E`/`#3CBBA0`) rather than the token system.
- **Fix:** Restyle onto the site tokens; use solid colour for the headline.

---

## pages/team.tsx

### [SEVERITY: High] "A small crew of engineers, insurance domain experts, and advisor-support folks"
- **Where:** `pages/team.tsx:64-67`
- **Problem:** Directly under a heading that says "Three people", the page describes three additional staff functions — engineers (plural), insurance domain experts (plural), and an advisor-support team — "who read policy wordings for a living". At current team size this describes people who do not exist. It is a small embellishment, but it sits on the page whose entire job is establishing that these are real, trustworthy humans.
- **Fix:** Cut the paragraph, or make it honest and stronger: "Right now it is the three of us. We read the policy wordings ourselves."

### [SEVERITY: Medium] The site's only general contact route is a careers address
- **Where:** `pages/team.tsx:81-86` — a button labelled "Get in Touch" pointing at `mailto:careers@indsure.in`
- **Problem:** A generic "Get in Touch" label on a hiring mailbox. Combined with the unreachable `/help` page and the absence of any contact link in the footer, the practical result is that a customer or prospective advisor with a question emails the careers inbox — or gives up.
- **Fix:** Relabel to "See open roles" / "Email us about a role", and add a real support address to the footer.

### [SEVERITY: Low] Hard-coded team count in the headline
- **Where:** `pages/team.tsx:22-23` ("Three people, one fine-print problem") against the mapped `founders` array at `:33`
- **Problem:** The count is prose while the cards are data. Adding or removing a founder makes the headline wrong silently.
- **Fix:** Interpolate `founders.length`.

---

## pages/blog.tsx

### [SEVERITY: High] Category counts do not match what the filter returns
- **Where:** Counts computed at `pages/blog.tsx:47-53` (`p.insuranceType === X || p.category === X`) vs the filter at `:72` (`post.category === selectedCategory` only)
- **Problem:** A "Browse by Insurance Type" tile advertising "Health Insurance — 14 articles" filters on category alone, so any post matched only by `insuranceType` is counted but never shown. The visitor clicks a promise of 14 and gets fewer, with no explanation.
- **Fix:** Use the same predicate in both places.

### [SEVERITY: High] Featured posts are invisible in every filtered and searched view
- **Where:** `pages/blog.tsx:81` (`regularPosts = filteredPosts.filter(p => !p.featured)`), rendered at `:256`; the featured card at `:165` only renders when category is "All" and search is empty
- **Problem:** Featured articles — presumably the best ones — are excluded from the grid unconditionally, while the featured card is suppressed as soon as the visitor filters or searches. So a featured health article is unreachable from the Health category and does not appear in search results for its own title. The two counters on screen also disagree: `:137` reports `filteredPosts.length` ("Found N articles") while `:247` reports `regularPosts.length` ("Search Results (N)").
- **Fix:** Include featured posts in filtered/search results, and report one consistent count.

### [SEVERITY: Medium] Dates are formatted for a US reader, and grid cards omit the year
- **Where:** `pages/blog.tsx:196` (`toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })`) and `:277` (same, **without** `year`)
- **Problem:** An Indian audience is shown "Aug 23, 2026" rather than "23 Aug 2026". Worse, every card in the main grid shows only month and day — a post from two years ago is indistinguishable from one published this week, which for insurance content (rules change) is a real trust problem.
- **Fix:** Use `en-IN` and always include the year.

### [SEVERITY: Medium] No author on any listing card, despite the site's author-page infrastructure
- **Where:** `pages/blog.tsx:193-197` and `:274-278` render only read time and date; the `User` icon is imported at `:8` and never used; `/author/:slug` pages exist (`App.tsx:272`) and `pages/team.tsx:39` links to them
- **Problem:** Authorship is built but not surfaced where a reader decides whether to trust an article. For insurance advice — and for the E-E-A-T signals the author pages were built for — the byline is the credibility.
- **Fix:** Add the author name (linked to `/author/:slug`) to the featured card and the grid cards.

### [SEVERITY: Medium] Two overlapping category systems on one screen
- **Where:** `pages/blog.tsx:33-44` (10 filter pills: All, Health, Life, Vehicle, Home, Travel, Business, Education, Tips, Guide) vs `:46-54` (7 "Browse by Insurance Type" tiles)
- **Problem:** The pills and the tiles are different taxonomies with different labels for the same things ("Health" vs "Health Insurance") and different members ("General" is a tile but not a pill; "Tips"/"Guide"/"Education" are pills but not tiles). The visitor sees the same page offering two incompatible ways to slice it.
- **Fix:** One taxonomy. Use the tiles as the visual entry and the pills as the persistent filter, driven by the same list.

### [SEVERITY: Medium] A `<button>` nested inside an `<a>` on the featured card
- **Where:** `pages/blog.tsx:167` (`<Link>` wrapping the whole Card) containing the "Read Full Article" `<Button>` at `:198-201`
- **Problem:** Invalid HTML — interactive content inside an anchor. Screen readers announce it inconsistently and keyboard users get an ambiguous tab stop that does the same thing as its parent.
- **Fix:** Make the button a non-interactive styled `<span>`, or drop the outer link and link the title and button individually.

### [SEVERITY: Low] Empty state has no way out
- **Where:** `pages/blog.tsx:300-308`
- **Problem:** "No articles found. Try a different search or category." with no button to clear the search or reset to All — the visitor has to find and empty the search box themselves.
- **Fix:** Add a "Clear filters" button.

### [SEVERITY: Low] Double bottom spacer on mobile
- **Where:** `pages/blog.tsx:323` (`<div className="md:hidden h-16" />`) plus the spacer `MobileNav` already renders at `components/MobileNav.tsx:68-71`
- **Problem:** 128px of dead space below the footer on every phone.
- **Fix:** Remove the local spacer; `MobileNav` handles it.

---

## Legal pages (PrivacyPolicy / TermsOfService / CookiePolicy / GrievanceOfficer)

### [SEVERITY: Critical] The Terms of Service jump from section 6 to section 14 — seven sections are missing
- **Where:** `pages/TermsOfService.tsx:152` ("6. Acceptable use") followed immediately by `:165` ("14. Contact us")
- **Problem:** Sections 7 through 13 do not exist in the rendered page. In a standard ToS those are the sections covering fees and refunds, intellectual property, limitation of liability, indemnity, termination, governing law and dispute resolution — i.e. every clause that actually protects the company, on a site that now takes payments. A reader can see the numbering gap, so the document also *looks* unfinished.
- **Fix:** Write and insert the missing sections, or renumber. Given the site is now transacting, this needs legal review, not a renumber.

### [SEVERITY: High] All three legal documents are 17 months stale
- **Where:** `pages/PrivacyPolicy.tsx:8-9`, `pages/TermsOfService.tsx:8-9`, `pages/CookiePolicy.tsx:7` — all `LAST_UPDATED = "25 March 2025"`, displayed in each page's sticky header
- **Problem:** Since that date the product has added consumer accounts, a stored portfolio, paid plans, renewal emails, the Sach assistant and analytics with session replay. The Privacy Policy in particular describes data practices that predate most of what the platform now does, while prominently displaying a date that tells the reader it is out of date.
- **Fix:** Review and re-date all three against the current product, especially the retention table and the processors list.

### [SEVERITY: High] Four different contact addresses across the public site, none of them a support address
- **Where:** `pages/PrivacyPolicy.tsx:17`, `:125` and `pages/TermsOfService.tsx:142`, `:173` and `pages/CookiePolicy.tsx:205` (`tech@indsure.in`); `pages/GrievanceOfficer.tsx:17` and `pages/PrivacyPolicy.tsx:172` (`nikhil@indsure.in`); `pages/team.tsx:82` (`careers@indsure.in`); `pages/help.tsx:61` (`contact@ensured.in`, dead domain)
- **Problem:** A visitor with a question has to guess between an engineering address, a founder's personal address, a hiring address, and one on a domain the company retired. `pages/GrievanceOfficer.tsx:9` even carries a note to itself to create a dedicated grievance mailbox, which was never done — the statutory grievance channel is a person's individual inbox.
- **Fix:** Create `support@` and `grievance@` role mailboxes and use them consistently. A personal address as the statutory grievance contact is a continuity risk as well as a presentation one.

### [SEVERITY: High] The registered address is a city, not an address
- **Where:** `pages/GrievanceOfficer.tsx:18` — `REGISTERED_ADDRESS = "Nashik, Maharashtra, India"`
- **Problem:** Displayed under the heading "Address" in the Grievance Officer card, on the page that exists specifically to satisfy DPDP Act s.13. No street, no building, no PIN code — a data principal cannot serve anything on it, and the footer carries a CIN but no address either.
- **Fix:** Publish the full registered office address as filed with the MCA.

### [SEVERITY: High] Grievance form inputs have no programmatic labels
- **Where:** `pages/GrievanceOfficer.tsx:196-205` (name), `:209-219` (email), `:224-233` (phone), `:267-279` (details textarea)
- **Problem:** Every one of these is a `<label>` sibling with no `htmlFor` and an `<input>` with no `id`. Tapping the label does not focus the field — meaningful on a phone with small targets — and screen readers announce four unlabelled inputs. The radio and checkbox groups (`:242`, `:283`) *do* work because they wrap their inputs, which makes the inconsistency invisible in casual testing. Errors at `:206`, `:219`, `:263`, `:279` are also not wired via `aria-describedby`/`aria-invalid`.
- **Fix:** Add `id` + `htmlFor` pairs to all four, and connect the error text with `aria-describedby` and `aria-invalid`.

### [SEVERITY: Medium] Legal pages drop the site header, footer and navigation entirely
- **Where:** `pages/PrivacyPolicy.tsx:190-196`, `pages/TermsOfService.tsx:19-25`, `pages/CookiePolicy.tsx:83-89`, `pages/GrievanceOfficer.tsx:125-131` — each renders its own minimal bar with a "← Back to IndSure" link and nothing else
- **Problem:** A visitor who reaches the Privacy Policy from the footer loses all site navigation; the only routes onward are "back to home" and three sibling legal links at the very bottom of a long document. They cannot get to pricing, the blog, or sign-up without going home first. It also means these pages look like a different website.
- **Fix:** Render `<Header />` and `<Footer />` on all four, keeping the clean reading column inside them.

### [SEVERITY: Medium] Legal body text is 14px grey-600 in a single unbroken column
- **Where:** `pages/PrivacyPolicy.tsx:77` (`text-gray-600 text-sm leading-relaxed whitespace-pre-line`), same pattern in the other three
- **Problem:** The documents render as long runs of small grey text with no table of contents, no in-page anchors list, and no way to jump to a section — the Privacy Policy's own DPDP callout at `:59` links to `#your-rights`, proving anchors exist but are not exposed. For the 40+ audience this is a wall.
- **Fix:** Add a sticky section index (the `sections` array already has `id` and `title`), raise body text to 15-16px, and darken to `gray-700`.

### [SEVERITY: Low] Scaffolding comments and a wrong-domain placeholder still in the shipped files
- **Where:** `pages/GrievanceOfficer.tsx:1-9` ("Drop this file into your pages directory…", "BEFORE GOING LIVE — fill in the following placeholders", "e.g. grievance@ensured.in"), `pages/PrivacyPolicy.tsx:1-4`, `pages/TermsOfService.tsx:4` ("Update the Footer.tsx links from href='#'")
- **Problem:** Not user-visible, but the "before going live" checklist is still sitting at the top of a page that went live, and two of its four items (dedicated grievance mailbox, full registered address) are genuinely still unresolved — the comment is an accurate open bug report.
- **Fix:** Close the two outstanding items, then delete the comment blocks.

---

## Coverage note

Read in full for this audit: `home.tsx`, `pricing.tsx`, `advisors-pricing.tsx`, `how-it-works.tsx`, `why-indsure.tsx`, `blog.tsx`, `team.tsx`, `help.tsx`, `not-found.tsx`, `GrievanceOfficer.tsx`, `components/Header.tsx`, `components/Footer.tsx`, `components/MobileNav.tsx`, plus the structure, dates and contact details of `PrivacyPolicy.tsx`, `TermsOfService.tsx`, `CookiePolicy.tsx`, and the flagged sections of `mission.tsx` and `vision.tsx`.

**Not audited in full — recommend a follow-up pass:** `pages/advisor-page.tsx` (667 lines, the `/a/:slug` advisor microsite and its lead form), `pages/life.tsx`, `pages/term.tsx`, `pages/vehicle.tsx` (the three line-of-business landing pages, ~1,500 lines combined). Note that `life.tsx` and `vehicle.tsx` are already known to carry three "AI" copy violations each (lines 52/347/448 and 48/347/448 respectively), and both appear to be near-duplicates of one template, so findings on one will very likely apply to the other.
