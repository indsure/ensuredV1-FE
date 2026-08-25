# Plan — Homepage: show the product, not the problem

**Tier: T1** — copy and layout inside two existing surfaces (`pages/home.tsx`, `components/Header.tsx`).
No schema, no auth, no money. It *is* public claims, so the Claims Ledger (§6) and `npm run guard`
are mandatory.
**Scope, as set by the founder:** **homepage and header only.** No footer, no `/pricing`,
no `/agent` landing, no site-wide nav rework. Anything this uncovers elsewhere is logged in §8,
not fixed here.
**Branch:** `pr-6` (working tree already carries uncommitted 2026-08-23 data-loss fixes — commit
selectively, never `git add -A`).
**Design:** 6 artboards, new canvas `design/product-section/` — drawn before any `.tsx` is touched.
**Reference:** gumloop.com and paid.ai, both read live 2026-08-25; measurements in §3.

---

## 1. Goal

A visitor lands on `/` and, within one scroll, understands that IndSure is **two products**:

- **Advisor Portal** — the working portal an advisor runs their book from.
- **My Portfolio** — the private dashboard a policyholder keeps their own cover in.

Today the homepage spends its second section on a mock-up of a report and its third explaining
that insurance is confusing. One is the *problem*, which the visitor already knows, and the other
is a *drawing* of the output. Both go. In their place, the product itself — a working panel of each
portal, the way Gumloop shows a real agent run instead of a feature bullet. The advisor panel
carries a five-tab rail (Queue · Leads · Renewals · Compare · Claims); the visitor clicks through
the actual portal without an account.

Non-goal: turning the homepage into an advisor landing page. `/agent` already does that job
(`pages/agent/Landing.tsx`, 373 lines, its own top bar and CTAs). The homepage's job is to name
the two products and hand each audience the right door.

---

## 2. What exists today — verified, not assumed

| Fact | Where | Consequence |
|---|---|---|
| Homepage is 5 sections: hero → report preview (`#demo`) → problem cards → process → closing CTA | `pages/home.tsx:90-353` | **Two go** (§5). The page ends at four sections: hero → product → process → closing CTA |
| Problem cards are the section being replaced | `pages/home.tsx:255-290` | 4 cards: Complex by Design / Silent Gaps / Costly Overlaps / Biased Advice |
| `"Biased Advice — Agents are incentivized to sell, not to analyze."` | `pages/home.tsx:265` | The homepage insults the audience of one of the two products. Deleting this section retires the finding |
| `#demo` and `#how-it-works` anchors are referenced **only inside `home.tsx`** | grep across `src/**/*.tsx` | Sections can be removed without breaking a link from anywhere else on the site |
| `#demo` is the report-preview section, and **two CTAs point at it** — the hero's secondary and the closing CTA's secondary | `home.tsx:127`, `:346` → target `:170-253` | Deleting the report preview (founder call, 2026-08-25) orphans both buttons. They are re-pointed in the same commit — see §5 |
| Header nav is 4 links + a "Tools" dropdown; the only advisor element is a grey **Advisor Login** button | `components/Header.tsx:12-24`, `:132-136`, `:213-217` | A prospective advisor has no marketing path — audit finding `04-public-site.md`, Critical |
| That button goes to `/agent`, which is a **landing page**, not a login screen | `App.tsx:190` → `pages/agent/Landing.tsx` | The audit's "drops onto a login wall" is now stale; the destination is fine, the **label** is what's wrong |
| Advisor pricing is `/advisors/pricing`, linked from `Landing.tsx:124` only | `App.tsx:149` | Header can link it; not required to |
| A no-backend advisor demo exists and is linked from the advisor landing | `App.tsx:191` → `PlaygroundEntry.tsx`; commit `0a18f0c` | **The advisor card gets a real "see it working" CTA** — no signup, no mockup |
| The consumer portal is real: `/app` portfolio, `/api/me/portfolio`, upload, score ring, renewals | `App.tsx:297`, `pages/app/portfolio.tsx` | "My Portfolio" is a shippable product claim, not a promise |
| `product.md` still says consumer auth is a stub and lists no consumer portal | `product.md` — "What Is NOT Built Yet" | Stale doc — logged in §8, not fixed here |
| Header is `fixed`; `<main>` compensates with `pt-32` (128px) | `home.tsx:88` | Any header height change must move this number in the same commit |
| Guard fails the build on unsourced public numbers unless a `claim-source:` comment sits within 2 lines | `checks/guard.mjs:66-95` | Every figure in §6 ships with its annotation |
| Design tokens exist and are the only allowed colours | `index.css:22-63` — cream `#FAFAF8`, navy `#0B1120`, teal `#0D9488`, gold `#B45309`, hairline `#E2E8F0` | The reference sites get translated into these, never copied |

---

## 3. What the reference sites actually do — measured, not remembered

Both were opened and their computed styles read on 2026-08-25.

### gumloop.com — the header the founder called out

| Property | Measured | What we take |
|---|---|---|
| Header height | **53px**, `position: static`, solid white, transparent bottom border | Thin. Ours is a tall floating bar; going to ~56px is most of the effect |
| Nav | 14px / weight 500, centred, `6px 8px` padding | Adopt exactly; 14px/500 is our smallest allowed public size |
| Secondary CTA | White fill, hairline border, **h32**, radius **8px**, padding `0 14px` | Adopt the geometry |
| Primary CTA | Near-black `#111`, white text, same 32 × 8 × 14 geometry | Same geometry, **teal fill** — black is their brand, teal is ours |
| Nav item count | 5 (Solutions · Resources · Enterprise · Pricing · Careers) | We are at 4 + a dropdown; stay ≤ 5 |
| Section headings | 36px / 500 / `-0.9px` tracking / 1.25 line-height | Our `text-4xl md:text-5xl` serif is close; tighten the tracking |
| Page colour | White throughout, **one** near-black section | Directly relevant — see the colour decision in §5 |
| Section padding | 64–128px vertical | We use `py-14 sm:py-20 lg:py-24`; keep |
| Product sections | One-word eyebrow (Build / Collaborate / Optimize / Controls) → 36px two-line heading → one paragraph → **a rendered, working-looking product surface** | This is the whole idea. See §5 |

### paid.ai

| Property | Measured | What we take |
|---|---|---|
| Header | **57px, sticky, cream `#F2F2ED`** | Confirms a cream header is right — ours is `#FAFAF8`, within a hair of theirs |
| H2 | 48px / 600 / `-0.32px` | Our serif carries the weight instead |
| Sub-headings | 24px / **400** — full benefit sentences, not labels | Adopt for the three proof lines: sentences, not feature nouns |
| Eyebrow | Uppercase, small, tracked (`SECURITY`) | Matches our existing badge style at `home.tsx:174` |
| Section padding | 80px | Consistent with the above |

**The transferable lesson from both, stated plainly:** neither site explains a problem. Each names
a capability in two or three words, then *renders the product doing it*. Their panels are built
HTML — live tables, message rows, activity feeds — not screenshots. That is what makes them read as
software rather than a brochure, and it is why the reaction to Gumloop was about the whole site,
not one component.

---

## 4. Header — target spec

Only what changes. Everything unlisted stays.

| # | Change | Detail |
|---|---|---|
| H1 | Height to **56px** desktop / 60px mobile | Matches the measured references and our own `design/PublicHome.dc.html` (60px) |
| H2 | `pt-32` on `<main>` recomputed | `home.tsx:88` → `pt-24` (96px); verify no hero clipping at 375 / 768 / 1280 |
| H3 | Hairline bottom border appears **on scroll only** | `isScrolled` already exists at `Header.tsx:29-35`; it is not driving the border today |
| H4 | Nav 14px / 500, navy at 75%, full navy on hover | Replaces current sizing |
| H5 | **Add "For advisors"** to the right cluster → `/agent` | The missing advisor path. Text link, not a button |
| H6 | **Relabel "Advisor Login" → "Log in"**, beside "For advisors" | It reads as an evaluation entry point today; it is a returning-user action. Destination `/agent` unchanged |
| H7 | Primary CTA: teal `#0D9488`, white, **h36 · radius 8 · px 14 · 14px/600** | Gumloop geometry, our colour. h36 not h32 — 44px touch target on mobile |
| H8 | Secondary CTA: cream fill, 1px `#E2E8F0` | Gumloop's outline treatment |
| H9 | Mobile menu: `max-h-[calc(100vh-4rem)] overflow-y-auto` on an inner wrapper | Today `overflow-hidden` puts the sign-up CTA out of reach on a 375×667 screen — audit High, and it is in the file we are already opening |
| H10 | `aria-expanded` + `aria-controls` on the hamburger | Same reason |

**Open, needs a call (§9):** does the "Tools" dropdown survive? Three right-side items
(For advisors · Log in · Get started) plus four nav items plus a dropdown is more than either
reference carries.

---

## 4b. Hero — target spec (added 2026-08-25, founder call)

The hero today is a headline, a four-item stat strip and an infinite marquee. **It contains no
picture of the product.** Both reference sites give the fold to an enormous, sharp, layered
product shot; that is the single biggest difference between their fold and ours.

| # | Change | Detail |
|---|---|---|
| E0 | **Positioning: a tool for insurance, not a policy analyser** | Founder call. The fold must not read as "we analyse health policies". It shows the **workspace** (5 policies across health, term life, car, two-wheeler, travel, plus the personal-accident cover that is missing, plus total premium and an overlap), the **Cover Calculator** (₹1.9 Cr needed vs ₹1 Cr held), and **Sach** answering a question in a person's own words. Three tools, five policy types, one fold |
| E1 | **Add a stacked product shot below the copy** | Three overlapping windows in a rounded well, per E0. Built HTML, not screenshots |
| E1b | **No screen may appear twice on the page** | The hero owns the *decode* — the document appears nowhere else. My Portfolio (§5) owns the *dashboard* — policy list, score chips, renewal banner. Earlier drafts put the score ring in both; that repetition is the thing to avoid. The hero shows the workspace, the calculator and Sach; **the decode moved down to My Portfolio** (§5), where it is one capability among several |
| E1c | Clause text is written, not lifted | The document window reads like policy language and is labelled illustrative inside its own border. Do not paste any insurer's actual wording into a marketing page |
| E2 | **Delete the marquee** | `home.tsx:28-51`. Decorative, announced to screen readers, ignores `prefers-reduced-motion`. Retires an audit Low and frees the fold |
| E3 | **Delete the stat strip** | `home.tsx:152-156`. Three of its four numbers are unsourced (`50+ risk checks`, `10 insurers`, `63 plans`). `₹0 commissions earned, ever` survives as an inline trust line — it is a stance, not a count |
| E4 | Headline **"Your insurance, finally under control."** at 72px, tracking `-0.04em`, Playfair kept | The serif is what stops the page looking like every other site that copied Gumloop |
| E5 | Sub-headline names the breadth | "Health, term life, car, travel — every policy your family owns in one place. See what each one really covers, what it will not pay, and what renews next." |
| E6 | Secondary CTA repointed | `/policychecker` — see §5; `#demo` no longer exists |
| E7 | Windows carry the deeper shadow ramp | Same six-step recipe as the product panels, one step heavier: these sit *above* the page rather than in it |

**Open — the one real brand decision.** Light hero (cream `#FAFAF8`) or navy hero (`#0B1120`)?
The `Hero.dc.html` artboard carries a **Light / Navy toggle** so it can be judged rather than
argued. Recommendation: **light for the fold, navy kept for the closing CTA**, so the page opens
bright and lands dark — but this is the founder's call and the mockups show light because a
recommendation you cannot see is not a recommendation.

Every rupee figure inside a hero window is illustrative and labelled **inside** the window border.

---

## 4c. "How it works" — three cards, not four steps (added 2026-08-25)

`home.tsx:293-337` is four numbered circles: Upload → Decipher → Audit → Report. That describes a
**document pipeline**, not a product, and it is the second place the page reads as an analysis tool.
It is replaced by the Gumloop *"Optimize Your Agents"* block, measured from the live page:

| Element | Spec |
|---|---|
| Eyebrow | Small tinted label, teal on `rgba(13,148,136,0.12)`, 12px/700 |
| Heading | Serif 42px, `-0.03em` — "From chaos to clarity, in three steps" |
| Grid | **3** equal columns, 24px gap |
| Card | Illustration box `#F1F5F9`, radius 12, **300px tall**, quiet and mostly monochrome with one teal accent |
| Caption | **Below** the box, not inside it: bold lead-in in navy, then the sentence continues in `#64748B` |

The three:

1. **Bring it all in.** Illustration: faint policy tiles scattered around a centred white card —
   "₹1.6 Cr · 5 policies · 3 insurers".
2. **See what it actually does.** Illustration: a dashed orbit with Read → Check → Explain nodes
   around a card reading "62 pp. in 41 seconds".
3. **Stay ahead of it.** Illustration: a faint calendar grid with a today-line and a floating
   renewal notice — "Car insurance expires in 6 days. ₹8,400 due."

Step 3 is the one that carries the repositioning: reminders, comparison before buying, and help
when a claim is stuck are not analysis, and they are what makes this a tool people keep.

---

## 5. The product section — target spec

**Placement — revised 2026-08-25, founder call.** The product section becomes **slot 2, directly
after the hero**, and **two** sections are deleted, not one:

1. `home.tsx:255-290` — the problem cards.
2. `home.tsx:170-253` — **"What your report shows"**, the score-68 preview card.

The reason the second one goes: the My Portfolio panel now shows the same verdict — score, room
rent, waiting period — rendered from the real product instead of from three hard-coded bars. The
page was making its case twice, and the weaker of the two was the mock-up. The homepage goes from
five sections to four: hero → product → process → closing CTA.

**Consequence that must ship in the same commit.** `#demo` dies with that section, and two buttons
point at it: `home.tsx:127` (hero secondary) and `home.tsx:346` (closing CTA secondary). Both
become **"See everything we check" → `/policychecker`** — a real page that exists. Do not leave a
dead `href="#demo"` in either place, and do not relabel without repointing.

Open, for the founder: the site now has **no sample output** for a visitor who wants to judge
quality before signing up. `/policychecker` explains what is checked but shows no report. If a
real anonymised sample should exist, it needs its own home — that is a separate change, not this one.

**Structure — two stacked bands, one per product.**

```
┌ band ────────────────────────────────────────────────────────┐
│  FOR ADVISORS            ← eyebrow, 12px/600, .08em, teal    │
│  Advisor Portal          ← product name, serif 36–40px       │
│  One line on what it is  ← 18–20px, ≤46ch, sentence case     │
│                                                              │
│  ✓ three proof lines, full sentences (paid.ai pattern)       │
│                                                              │
│  [Primary CTA]  secondary text link →                        │
│                                                              │
│  ┌────────── rendered product surface ──────────┐            │
│  │  real screen, real component shapes,         │            │
│  │  "Illustrative" label INSIDE the panel       │            │
│  └──────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

- **Desktop:** 12-col. Copy 5 cols, surface 7. **Alternate sides** between bands — advisor copy
  left / surface right, portfolio surface left / copy right.
- **Mobile:** copy, then surface. The surface may bleed to the right edge and scroll-snap
  horizontally (Gumloop's full-bleed panel treatment) rather than shrink to illegibility.
- **Divider:** a hairline between the bands, not a colour change. The two must read as *one product
  story with two doors*, not as two unrelated sections.

**The two surfaces — built HTML, reusing screens already drawn:**

| Band | Surface shows | Source of the shapes |
|---|---|---|
| Advisor Portal | The morning triage list: renewals due, a policy row with its score chip, one WhatsApp draft action | `pages/agent/MyQueue.tsx`, `pages/agent/PoliciesNew.tsx`, and the artboard `design/Main.dc.html` ("Home — action first") — already drawn, reuse it |
| My Portfolio | One policy card with the score ring, and one clause line stated in rupees | `pages/app/portfolio.tsx`, `components/app/ScoreRing.tsx`, and `design/Portfolio.dc.html` + `design/ConsumerReport.dc.html` |

**CTAs — each goes somewhere real:**

| Band | Primary | Secondary |
|---|---|---|
| Advisor Portal | `Start free — no card` → `/agent/signup/step1` | `See the portal without signing up` → `/agent/playground` |
| My Portfolio | `Check my policy — free` → `/signup` | `See everything we check` → `/policychecker` |

The advisor secondary is the strongest thing on the page: a live portal, no account. It also
answers the standing audit complaint that "See a Sample Analysis" only scrolls to an animation.

**Colour rhythm — a real decision, not a detail.** The homepage currently alternates
navy → cream → navy → cream → navy. Gumloop is white throughout with exactly one near-black
section, and that restraint is much of why it reads as calm. **Recommendation:** run both product
bands on cream `#FAFAF8` and keep navy for the closing CTA only — taking the page from three navy
blocks to two. Flagged in §9, because it changes the feel of the whole page, not just this section.

**Motion:** panels fade and rise on enter, gated on `prefers-reduced-motion` (the marquee at
`home.tsx:28-51` already ignores it; do not add a second offender).

**Accessibility:** the audience is 40+. No sub-14px type in this section, no muted grey on cream
for anything load-bearing, 44px minimum touch targets, panels `aria-hidden` where decorative and
labelled where not.

---

## 6. Claims Ledger — every user-visible assertion, with its source

Nothing here is new. Every line is already published on a pricing page and true of shipped code.

| Line | Source of truth | Verified |
|---|---|---|
| "Leads, renewals and your client book — free forever" | `advisors-pricing.tsx:33-42` (Free tier) | 2026-08-25 |
| "3 policy checks to try" | `advisors-pricing.tsx:36` | 2026-08-25 |
| "20 data-entry policies — motor, life, term, travel" | `advisors-pricing.tsx:37` | 2026-08-25 |
| "WhatsApp drafts in English, Hindi and Hinglish" | `advisors-pricing.tsx:39` | 2026-08-25 |
| "Cover Calculator with shareable reports" | `advisors-pricing.tsx:35` | 2026-08-25 |
| "One policy of each type — health, term life, vehicle. Free." | `pricing.tsx:46` | 2026-08-25 |
| "Room rent, co-pay, sub-limits and waiting periods, explained" | `pricing.tsx:48` | 2026-08-25 |
| "Renewal reminders 30 days before expiry" | `pricing.tsx:49` | 2026-08-25 |
| "Download your report as a PDF" | `pricing.tsx:50` | 2026-08-25 |
| Advisor surface: score chip, renewal row, queue row | Real components — `MyQueue.tsx`, `PoliciesNew.tsx` | 2026-08-25 |
| Portfolio surface: score ring, policy card | Real components — `app/portfolio.tsx`, `app/ScoreRing.tsx` | 2026-08-25 |

**Explicitly NOT carried into this section**, all previously flagged as unsourced:
`"Top 15% of policyholders"` (`home.tsx:203`), `"50+ risk checks"` (`:154`, `:313`),
`"10 insurers / 63 plans"` (`:155-156`). This section adds **zero** new numbers.

Every rupee figure or count inside a rendered panel carries
`{/* claim-source: illustrative — not a product output */}` and the panel is labelled
**Illustrative** *inside* its own border — the mistake at `home.tsx:174` was putting that badge
outside the card it qualified.

---

## 7. Word list

The public site says **advisor**, never "agent", for our own users (`Header.tsx:136`,
`/advisors/pricing`). "User Portal" is internal language and does not ship. The forbidden
user-facing word **"AI"** does not appear (it currently does, at `home.tsx:312` — out of scope,
logged in §8). Avoid "forensic", "bank-grade", "proportionate deduction" — all previously flagged
as jargon or unverifiable.

---

## 8. Blast radius — what this makes stale, in and out of scope

**In scope, fixed here:**
- The `"Biased Advice"` card and its insult to the audience of one of our two products — deleted
  with the section.
- The homepage's single-audience framing — the reason the advisor path was missing.
- Mobile menu overflow and the missing `aria-expanded` — same file, fixed while we are in it.
- **`"Top 15% of policyholders"` (`home.tsx:203`)** — leaves with the report-preview section that
  carried it. Previously logged as out of scope; now deleted outright.
- **The two `#demo` CTAs** — repointed at `/policychecker`, per §5.

**Out of scope, logged, deliberately not touched:**
- `product.md` describes consumer auth as a stub and lists no consumer portal. `/app` and
  `/api/me/portfolio` have shipped. The doc is wrong, and it is the file an assistant reads first.
- `home.tsx:312` — `"AI extracts hidden clauses"` in the process steps. House-rule violation
  sitting one section below ours.
- The hero stat strip at `:152-156` ("50+ risk checks", "10 insurers / 63 plans") — still unsourced, still shipping.
- `/pricing` and `/advisors/pricing` do not link to each other, and the header's "Pricing" points
  only at the consumer one — while the homepage will now name two products.
- `useSEO` at `home.tsx:79-84` describes a consumer-only page. Two products arguably understated.
- Footer — untouched by instruction, though it still carries "The only insurance audit engine…".

---

## 9. Decisions needed at 5 — these change the mockups

1. **Product names.** `Advisor Portal` + `My Portfolio` (recommended — "My portfolio" is what the
   consumer app already calls itself, `design/canvas.json`), or `IndSure for Advisors` +
   `IndSure Personal` ("Personal" is the paid consumer tier name, `pricing.tsx:57`)?
2. **Stacked or tabbed?** Recommendation: **stacked**. A tab hides half the product from a scanner
   and from Google, and this page is prerendered. Tabs are Gumloop's move for five *use cases of
   one product* — we have two *products*.
3. **Do the problem cards die, or move?** Recommendation: die. `/why-indsure` exists and is the
   right home for the argument; moving them is a second file and outside "homepage and header".
4. **Colour rhythm** — both bands on cream, navy reserved for the closing CTA? (§5)
5. **Does the "Tools" dropdown survive the header?** (§4)
6. **Section heading.** The bands need one line above them. Candidate: "Two portals. One engine."
   — that one needs your voice, not mine.

---

## 10. Mockups to draw — `design/product-section/`

New canvas, same convention as `design/canvas.json` and `design/team-owner/canvas.json`.
Six artboards, one page (`public`). Mobile boards 390×844, desktop boards 1280 wide.

| # | File | Size | Shows |
|---|---|---|---|
| 1 | `HeaderDesktop.dc.html` | 1280×220 | Three stacked states: at rest (no border), scrolled (hairline + CTA), dropdown open. Every §4 measurement annotated |
| 2 | `HeaderMobile.dc.html` | 390×844 | Closed bar, and the open menu scrolled to its last item — proving the CTA is reachable on a 667px screen |
| 3 | `ProductDesktop.dc.html` | 1280×1400 | Both bands, alternating sides, at 1280 |
| 4 | `ProductMobile.dc.html` | 390×1500 | Both bands stacked, with the full-bleed scroll-snap surface |
| 5 | `SurfaceAdvisor.dc.html` | 780×520 | The advisor panel at full size — the piece that carries the section |
| 6 | `SurfacePortfolio.dc.html` | 780×520 | The portfolio panel at full size |

Plus a canvas annotation carrying §9's open questions, so the decisions sit beside the drawing
rather than in a document nobody opens.

**Drawing rules:** Playfair + Inter (the public vocabulary, `design/PublicHome.dc.html`); tokens
from `index.css` only; no lorem — every string is either from §6 or visibly illustrative; the
panels reuse shapes already drawn in `Main.dc.html`, `Portfolio.dc.html` and
`ConsumerReport.dc.html` rather than inventing a third visual language for the same screens.

---

## 11. Acceptance

- [ ] Six artboards drawn, canvas opens, §9 answered on the canvas
- [ ] `home.tsx` sections 2 and 3 deleted, product section inserted after the hero
- [ ] No `href="#demo"` remains; both CTAs land on `/policychecker`; `#how-it-works` still resolves
- [ ] `Header.tsx` H1–H10 applied; `pt-32` recomputed and checked at 375 / 768 / 1280
- [ ] Mobile menu reaches its last item on 375×667
- [ ] Every CTA lands on the route named in §5 — all four clicked, not assumed
- [ ] No new number on the page; every panel figure annotated and labelled Illustrative
- [ ] `npm run guard` passes, debt budgets not raised
- [ ] Hero: marquee and stat strip deleted, tool-led product shot in, Light/Navy settled
- [ ] Four-step process replaced by the three-card block; no screen appears twice on the page
- [ ] Reduced motion honoured; no sub-14px type added
