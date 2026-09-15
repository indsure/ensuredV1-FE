# Agent Portal — UI/UX Audit (core working screens)

Scope: `IndSure/frontend/client/src/pages/agent/*` + `components/agent/*`.
Lens: Indian insurance agents, 40+, mid-range Android, moderate English, WhatsApp-first.
All paths relative to `E:\Indsurefi\IndSure\frontend\client\src`.

---

## Shell — AgentLayout / AgentTabBar

### [SEVERITY: High] Broken i18n fallback renders raw key strings in the sidebar
- **Where:** `components/agent/AgentLayout.tsx:42`, `:49-53`, `:60-63`
- **Problem:** Nav labels use `t("layout.analyze") ?? "Analyze"`. `AgentTabBar.tsx:19-24` documents that `t` echoes the key back when a string is missing, so `??` never fires. Any missing/untranslated key renders literally as `layout.analyze`, `layout.my_policies`, `layout.claims` in the navigation. In Hindi mode this is the most likely place to break, and the user sees developer strings instead of menu names. AgentTabBar has the correct `label()` helper; AgentLayout was never updated to use it.
- **Fix:** Export the `label(key, fallback)` helper from AgentTabBar (or a shared i18n util) and use it for every nav label in AgentLayout.

### [SEVERITY: Medium] Twelve nav items in four groups is a lot of surface for the target user
- **Where:** `components/agent/AgentLayout.tsx:35-67`
- **Problem:** Main/Grow/My Book/Account = 12 destinations, several with English-only product jargon ("Surrender Values", "Compare", "My Queue", "Rider Directory"). A 40+ agent has to learn what each means before the portal is usable. Two more items (Rider Directory, My Profile) hide inside an avatar dropdown (`:246-252`) that has no visual affordance suggesting it holds navigation.
- **Fix:** Add one-line Hindi/plain-English subtitles or rename ("Surrender Values" → "Policy ka paisa / What a policy is worth today"). Move Rider Directory and My Profile into the visible nav or into Settings rather than an avatar menu.

### [SEVERITY: Medium] Queue badge failure is a dead-end message with no retry
- **Where:** `components/agent/AgentLayout.tsx:203` (and the fetch at `:70-83`)
- **Problem:** If the count query fails, the sidebar shows "Queue badge unavailable" in small white/50 text, English-only, with no retry. The number silently stays at whatever it last was, and the poll keeps retrying invisibly every 10s (`:88`) so the message can flicker.
- **Fix:** Drop the string or make it a tappable "Refresh"; suppress the message while a retry is in flight.

### [SEVERITY: Medium] Tablet width (768–1023px) loses the bottom tab bar but keeps the drawer
- **Where:** `components/agent/AgentTabBar.tsx:37` (`md:hidden`) vs `AgentLayout.tsx:111-120` (sidebar is off-canvas until `lg`)
- **Problem:** Between 768px and 1023px there is no bottom bar and no visible sidebar, so every navigation costs a hamburger tap plus a drawer tap. Cheap Android tablets and large phones in landscape land exactly here.
- **Fix:** Change the tab bar breakpoint to `lg:hidden` so it matches the sidebar breakpoint.

### [SEVERITY: Low] "More" tab has no active/pressed state
- **Where:** `components/agent/AgentTabBar.tsx:59-67`
- **Problem:** The four Link tabs get a teal active colour; the More button is permanently slate-400 even while its drawer is open, so the user gets no confirmation the tap registered on a slow phone.
- **Fix:** Toggle the teal colour while `mobileOpen` is true (pass the state down).

### [SEVERITY: High] Phone list rows carry no Call / WhatsApp action
- **Where:** `components/agent/CustomersMobileList.tsx:73-114`, `components/agent/PoliciesMobileList.tsx:88-123`
- **Problem:** For a WhatsApp-first agent the single most common action from a customer or policy list is "message this person about their renewal". The mobile rows are one big button that only navigates to a detail screen; the phone number is rendered as plain text (`CustomersMobileList.tsx:91-93`) and is not tappable. Every outreach costs an extra screen load.
- **Fix:** Add a fixed-width WhatsApp and Call icon button (44x44) on the right of each row, next to the chevron, wired to `wa.me`/`tel:`.

### [SEVERITY: Medium] Mobile list empty states are a void, not a next step
- **Where:** `components/agent/PoliciesMobileList.tsx:72-78`, `components/agent/CustomersMobileList.tsx:56-63`
- **Problem:** A brand-new agent sees a bordered white box with one line of grey italic text and no button. Italic grey-400 on white is also the lowest-contrast text on the screen — hard to read on a cheap panel in daylight.
- **Fix:** Give both a heading, a plain-language sentence, and a primary action button ("Upload your first policy" / "Add a customer"). Use slate-600 non-italic.

### [SEVERITY: Low] Renewal and cover chips are English-only and untranslated
- **Where:** `components/agent/PoliciesMobileList.tsx:41-44`, `components/agent/CustomersMobileList.tsx:86`, `:98-103`, `:107`
- **Problem:** "Overdue", "Renews in 5 days", "No policies tagged", "policies", "cover", "Due 5 Sep" are hardcoded, so they stay English even after the agent flips the language toggle. "Tagged" is product jargon.
- **Fix:** Route these through `t()`; replace "No policies tagged" with "No policies linked yet".

### [SEVERITY: Low] Generic inline error text with no cause
- **Where:** `components/agent/InlineErrorState.tsx:4`
- **Problem:** Default message is the fragment "Failed to load —" followed by "Try again". No indication of what failed or whether it's a network problem. English only.
- **Fix:** Require a subject ("Could not load your policies. Check your internet and try again.") and translate.

---

## PoliciesNew.tsx — My Policies

### [SEVERITY: Critical] Delete never checks whether the delete succeeded — the row vanishes from the UI either way
- **Where:** `pages/agent/PoliciesNew.tsx:201-212`
- **Problem:** `await supabase.from("clients").delete().eq("id", id)` resolves with an `{ error }` object rather than throwing, so the `catch` at `:206` is effectively dead. On an RLS denial, a network stall or a server error the policy is still removed from `rows` at `:205` and the agent is told nothing — they believe it is gone, then it reappears on the next refresh. The reverse also bites: a genuinely deleted policy disappears with no undo and no confirmation message.
- **Fix:** Destructure `{ error }`, throw on it, keep the row on failure, show a real error. Add an undo toast or soft-delete — this is the only destructive action in the book and it is irreversible.

### [SEVERITY: High] Destructive confirm is a 10px inline button, not a dialog
- **Where:** `pages/agent/PoliciesNew.tsx:579-602`
- **Problem:** Tapping the trash icon swaps it for two `text-[10px] uppercase` buttons reading "Delete" / "Cancel" inside an already crowded action cluster. No sentence says what will be deleted or that it cannot be undone, the text is far below readable size for a 40+ user, and the Delete button lands roughly where the trash icon just was — a double tap destroys a policy.
- **Fix:** Use the shadcn AlertDialog with a full sentence naming the customer and insurer, 44px buttons, destructive styling on the confirm only.

### [SEVERITY: High] The whole screen is hardcoded English — the language toggle does nothing here
- **Where:** `pages/agent/PoliciesNew.tsx:292`, `:299`, `:311-319`, `:281-284`, `:404-411`, `:382-384`
- **Problem:** The file never imports `useLanguage`. Every string — "My Policies", "Total Analysed", "Should Switch", "Healthy", "Insured With", "Next Premium", "Recommendation", "Views", "Export to Excel" — is literal English. An agent who switched the portal to Hindi in the top bar lands on a fully English screen, which reads as a broken app.
- **Fix:** Route all copy through `t()`, and replace scoring jargon with plain phrasing: "Should Switch" to "Better cover available", "Healthy" to "Good cover".

### [SEVERITY: High] Errors surface as window.alert with raw server strings
- **Where:** `pages/agent/PoliciesNew.tsx:207`, `:238` (strings thrown at `:218`, `:224`)
- **Problem:** A failed PDF download shows a native Android alert box containing whatever the API returned, including developer text like "Not authenticated" or "Download failed". No retry, no explanation, and the alert blocks the whole app until dismissed.
- **Fix:** Use the app toast with a plain sentence and a "Try again" action; never render `body.error` verbatim.

### [SEVERITY: High] Zero-policy agents get an italic one-liner instead of a first-run path
- **Where:** `pages/agent/PoliciesNew.tsx:426-432` (and `:395` for phones)
- **Problem:** A brand-new agent sees three stat cards reading 0 / 0 / 0, four filter tabs all reading 0, a type-filter row, a search box, a sort dropdown, and then "No policies in this category." in grey italic. Nothing points at the next step, which is uploading a policy on the Analyze screen. The screen looks broken rather than empty.
- **Fix:** When `rows.length === 0` with no active filter, replace the whole toolbar and table block with one empty state: short heading, one line of plain copy, and a large "Upload a policy" button linking to `/agent/uploads`.

### [SEVERITY: High] No pagination or virtualisation — every policy renders at once
- **Where:** `pages/agent/PoliciesNew.tsx:433` (desktop), `:392-397` (mobile)
- **Problem:** `filtered.map` builds a row per policy with no cap. Each desktop row mounts four separate `TooltipProvider`s plus a popover (`:495-556`), so a 300-policy book mounts well over a thousand components on a mid-range Android. The footer even states the full count, "Showing N of N" at `:615`, with no way to page.
- **Fix:** Page at 25-50 rows with a "Show more" button, and hoist a single `TooltipProvider` to the table root instead of one per button.

### [SEVERITY: Medium] Recommendation detail is hover-only, so touch users can never see it
- **Where:** `pages/agent/PoliciesNew.tsx:104-111` (`onMouseEnter` / `onMouseLeave`)
- **Problem:** The painpoints / critical-actions / port panel, the most sales-useful content on the screen, only opens on mouse hover. The desktop table also renders on tablets and large phones in landscape, since the mobile list is gated on `useIsMobile`, so there the Info button appears dead. Every shadcn `TooltipContent` label on the action icons (`:519`, `:534`, `:553`) has the same problem, leaving four unlabelled glyphs on touch.
- **Fix:** Make the Info button a tap-toggled popover, and put visible text labels or a labelled overflow menu on the action icons.

### [SEVERITY: Medium] Action icons are unlabelled 14px glyphs in a five-item cluster
- **Where:** `pages/agent/PoliciesNew.tsx:492-602`
- **Problem:** Draft WhatsApp (sparkles), Open (external link), Download, Share and Delete sit side by side at `w-3.5 h-3.5` in slate-300/400 on white: low contrast, no text, and a sparkles icon does not read as "send a WhatsApp message" to anyone. The WhatsApp draft, the highest-value action for this audience, is the least recognisable icon on the row.
- **Fix:** Give the WhatsApp action a green WhatsApp glyph plus a visible label; move Download, Share and Delete into a labelled overflow menu.

### [SEVERITY: Medium] Stat strip is unmounted while loading, so the page jumps
- **Where:** `pages/agent/PoliciesNew.tsx:308`
- **Problem:** The three stat cards are wrapped in `{!loading && ...}` while the table below already renders skeleton rows. When the fetch lands, roughly 110px of cards appear and shove the table down — on a phone the row the agent was about to tap moves under their thumb.
- **Fix:** Render skeleton stat cards at the same height instead of hiding them.

### [SEVERITY: Medium] Header row does not wrap at 375px
- **Where:** `pages/agent/PoliciesNew.tsx:291-305`
- **Problem:** `flex items-center justify-between` with no `flex-wrap` holds a `text-3xl` Playfair title plus "Export to Excel" and "Refresh". At 375px the buttons are crushed against the title, and the Export button at `py-1.5` is roughly 30px tall, well under a 44px tap target.
- **Fix:** Add `flex-wrap`, give both buttons `min-h-11`, and consider hiding Export to Excel on phones — an .xlsx is not usable there.

### [SEVERITY: Medium] Score is a bare number with no explanation, and two thresholds disagree
- **Where:** `pages/agent/PoliciesNew.tsx:66-78`, header `:408`, tab filter `:266-267`
- **Problem:** A 0-100 number in a coloured pill with no legend, no "out of 100" and no explainer. The badge bands are 80 / 60 (`:68-72`) but the "Should Switch" and "Healthy" tabs split at 70, so a policy can show an amber badge while being counted as Healthy. The two signals visibly contradict each other.
- **Fix:** Label it "Cover score /100", add a one-tap explainer, and align the tab thresholds with the badge bands.

### [SEVERITY: Low] The Views column spends a full column on near-zero information
- **Where:** `pages/agent/PoliciesNew.tsx:410`, `:473-490`
- **Problem:** In an eight-column table one column reads "Not viewed" for almost every row, and its only elaboration is a hover tooltip.
- **Fix:** Fold the view count into the share control as a small badge.

### [SEVERITY: Low] Hover panel is positioned once and never follows the page
- **Where:** `pages/agent/PoliciesNew.tsx:90-94`, `:112-116`
- **Problem:** The painpoints panel is `position: fixed` at coordinates captured on mouse enter. Scrolling the table leaves it floating over unrelated rows.
- **Fix:** Use the existing shadcn Popover, which handles repositioning.

---

## CustomersNew.tsx — Customers list

### [SEVERITY: High] No Call or WhatsApp action anywhere on the customer book
- **Where:** `pages/agent/CustomersNew.tsx:228-231`
- **Problem:** The Contact column renders the phone number as plain text inside a row whose only behaviour is navigating to the detail page (`:222`). For a WhatsApp-first agent the customer list is the natural place to start a conversation, and there is no way to do it — not even a `tel:` link. The mobile list has the same gap.
- **Fix:** Add WhatsApp and Call icon buttons (44x44, `e.stopPropagation()`) to every row on both views.

### [SEVERITY: High] Add-customer form uses placeholders as labels and has no validation
- **Where:** `pages/agent/CustomersNew.tsx:141-144`
- **Problem:** Four bare inputs whose only labelling is a placeholder — "Full name *", "Phone", "Email", "City". Once the agent starts typing, the label disappears, so on a small screen with four adjacent boxes they cannot tell which field they are in. The required marker is an asterisk buried inside a placeholder. Phone and email are never validated, so a mistyped number is saved silently and the WhatsApp link later fails. The Save button is disabled while the name is empty (`:148`) with no message explaining why.
- **Fix:** Real `<label>` above each input, "Required" as visible text, a 10-digit phone check with inline error text, and an always-enabled Save that explains what is missing on click.

### [SEVERITY: Medium] Empty state names an action it does not offer
- **Where:** `pages/agent/CustomersNew.tsx:206-215`, `:181`
- **Problem:** "No customers yet. Add one here, or tag a policy to a customer from its detail page." — italic grey-400, no button, and "tag a policy ... from its detail page" is both jargon and a set of directions the agent has to follow manually. New agents see this as their first impression of the screen.
- **Fix:** Heading plus one plain sentence plus a primary "Add customer" button that opens the form and focuses the name field.

### [SEVERITY: Medium] Screen is hardcoded English with no i18n
- **Where:** `pages/agent/CustomersNew.tsx:122`, `:128`, `:163`, `:190-195`, `:242`
- **Problem:** Same as Policies: no `useLanguage` import, so "Customers", "Add Customer", "Total Cover", "Next Premium", "No policies tagged" stay English after the language toggle is flipped. "Tagged" has no plain-language meaning to this audience.
- **Fix:** Route through `t()`; replace "tagged" with "linked".

### [SEVERITY: Medium] No pagination and no sort on the customer book
- **Where:** `pages/agent/CustomersNew.tsx:216`, `:258-261`
- **Problem:** Every customer renders in one pass with a free-text search as the only narrowing tool. There is no sort by next premium or by cover, which is the ordering an agent actually works in, and no paging — the footer just reports "Showing N of N".
- **Fix:** Add a sort control (Next premium / Name / Cover) and paginate at 25-50.

### [SEVERITY: Low] Full-page error swallows the real reason and offers no way out
- **Where:** `pages/agent/CustomersNew.tsx:156` (message captured at `:59` but never passed)
- **Problem:** `InlineErrorState` is rendered without a `message`, so whatever went wrong is discarded and the agent sees the generic "Failed to load — Try again".
- **Fix:** Pass a plain-language message distinguishing offline from server error.

---

## CustomerDetail.tsx — one customer

### [SEVERITY: High] Contact details are dead text on the one screen built around a person
- **Where:** `pages/agent/CustomerDetail.tsx:210-212`
- **Problem:** Phone, email and city are joined with a middle dot into a single grey `text-sm` line. Nothing is tappable: no `tel:`, no `wa.me`, no copy. This is the screen an agent opens before calling a customer about a renewal, and the phone number is the least prominent element on it.
- **Fix:** Promote phone to two large buttons — green WhatsApp and Call — directly under the name, above the fold.

### [SEVERITY: High] A load failure replaces the entire screen with one grey line
- **Where:** `pages/agent/CustomerDetail.tsx:186`
- **Problem:** `if (error) return <InlineErrorState onRetry={load} />` renders the whole route as small grey text plus "Try again". There is no header, no Back button, and no navigation — on a phone with the drawer closed the agent is stranded and must use the browser back gesture. The real error, including "Customer not found." from `:66`, is never shown because no `message` is passed.
- **Fix:** Keep the header and Back control mounted, show the error inside the page body, and distinguish "not found" from "could not load".

### [SEVERITY: Medium] Delete sits as a solid red button of equal weight to the primary action
- **Where:** `pages/agent/CustomerDetail.tsx:215-229`
- **Problem:** Three `size="sm"` buttons (roughly 32px tall, below the 44px target) sit in one non-wrapping row: "Calculate Cover Need", "Edit", and a fully saturated red "Delete". The destructive action is visually as loud as the primary one and adjacent to Edit, which is the button an agent actually wants. At 375px the row does not wrap (`flex gap-2 shrink-0`, `:215`) so the long primary label squeezes the others. The confirmation dialog itself (`:471-479`) is good and clearly states policies are kept.
- **Fix:** Move Delete into an overflow menu or to the bottom of the page as a quiet text link; wrap the row and raise all three to `min-h-11`.

### [SEVERITY: Medium] Untagging a policy is an unlabelled X with no confirmation
- **Where:** `pages/agent/CustomerDetail.tsx:420-427`
- **Problem:** A 14px X in slate-300 with only a `title` attribute ("Untag from customer") — invisible on touch — immediately detaches the policy from the customer. The padding gives roughly a 26px hit area, well under 44px, and it sits 4px from the "open policy" icon. Mis-taps are likely and there is no confirm; recovery means finding the policy again in the tag dropdown.
- **Fix:** Visible text button ("Remove from this customer"), 44px, with a short confirm.

### [SEVERITY: Medium] Loading is a text line, so the whole page pops in at once
- **Where:** `pages/agent/CustomerDetail.tsx:200`
- **Problem:** "Loading customer…" in a small card is replaced by a full page of cards, stats and a table. On a slow connection the screen jumps by several hundred pixels with no warning.
- **Fix:** Skeleton the header card and the four stat tiles at their real heights.

### [SEVERITY: Medium] The tag-a-policy control is a native select over the agent entire untagged book
- **Where:** `pages/agent/CustomerDetail.tsx:439-453` (query at `:53-58` has no limit)
- **Problem:** Every untagged policy in the account becomes an `<option>` whose label is "Name — Insurer (Type)" with a leading star for suggested matches. On Android this opens a full-screen unsearchable list; with a few hundred policies it is unusable. The star legend (`:463`) appears below the control, after the point where it was needed.
- **Fix:** Replace with a searchable combobox, show the suggested matches as tappable chips above it, and explain the star inline.

### [SEVERITY: Medium] Edit form repeats the placeholder-as-label pattern
- **Where:** `pages/agent/CustomerDetail.tsx:234-238`
- **Problem:** Five inputs pre-filled with existing values and labelled only by placeholders, which are therefore invisible whenever a value exists. An agent editing a phone number sees two similar-looking boxes with numbers in them and no way to tell phone from city.
- **Fix:** Add visible labels.

### [SEVERITY: Low] Jargon and internal wording on the stat tiles
- **Where:** `pages/agent/CustomerDetail.tsx:267`, `:285-291`, `:302-313`, `:379`
- **Problem:** "Premium (as extracted)" leaks implementation language; "Health Score" with a bare number and "Should switch" beneath it is unexplained; "Cover Gap ... short"; "No policies tagged yet". None of it is translated.
- **Fix:** Plain wording ("Premium on the policy document", "Cover score /100", "Shortfall") routed through `t()`.

---

## LeadsNew.tsx — Leads (Pipeline / Renewals)

This is the strongest screen in the portal for the target user: real field labels (`:328-335`), 48px WhatsApp and Call buttons on every card (`:353-379`), a "Call today" block at the top (`:248-266`), and `text-base` inputs. The findings below are the gaps against that bar.

### [SEVERITY: High] Stage buttons on the card are 24px targets that change data silently
- **Where:** `pages/agent/LeadsNew.tsx:421-434` (handler at `:137-147`)
- **Problem:** Every card ends with a wrapped row of "→ Contacted", "→ Quoted", "→ Lost" style buttons at `px-2.5 py-1 text-xs` — roughly 24px tall and a few pixels apart, directly below the large WhatsApp/Call buttons an agent is aiming for. A mis-tap silently moves the lead to another stage: `quickStatus` shows a toast on failure but nothing at all on success (`:141`), so the only feedback is a small badge changing colour, and the lead may immediately vanish from the current filter. There is no undo.
- **Fix:** Collapse the stage moves into one labelled "Change stage" control, give it a 44px target, and show a success toast with an Undo action.

### [SEVERITY: Medium] Search is stranded at the end of a seven-chip filter row on a phone
- **Where:** `pages/agent/LeadsNew.tsx:269-282`
- **Problem:** `flex flex-wrap` holds Open + every status chip + All, then an `ml-auto w-64` search input. On a 375px screen the chips wrap across three lines and the search box lands underneath all of them, so finding a known lead by name means scrolling past the filters every time.
- **Fix:** Put search above the chips on mobile and make it full width.

### [SEVERITY: Medium] Empty state tells the agent to tap a button that is not in the empty state
- **Where:** `pages/agent/LeadsNew.tsx:289-295`
- **Problem:** "No leads here yet. Tap 'Add Lead' to add your first one." in grey italic, with the actual Add Lead button scrolled away in the page header. The default filter is "open" (`:56`), so an agent whose leads are all marked Won or Lost sees this same empty box and may conclude their data is gone.
- **Fix:** Put the Add Lead button inside the empty state, and when a filter is active say so explicitly with a "Show all leads" reset.

### [SEVERITY: Medium] Screen is hardcoded English, including product jargon
- **Where:** `pages/agent/LeadsNew.tsx:155-156`, `:173`, `:252`, `:294`, `:417`
- **Problem:** No `useLanguage`. "Pipeline", "Renewals", "Draft message", "Open", "via {source}" and the raw `utm_campaign` string (`:402`) are shown as-is. "Pipeline" and a UTM campaign name mean nothing to the intended user.
- **Fix:** Translate; rename "Pipeline" to "My leads"; hide or relabel the UTM field as "Came from".

### [SEVERITY: Low] Disabled WhatsApp / Call buttons give no reason
- **Where:** `pages/agent/LeadsNew.tsx:358-377`
- **Problem:** When a lead has no phone the two buttons render at 40% opacity with `pointer-events-none`, so tapping them does nothing and nothing explains why. `aria-disabled` on an `<a>` also leaves them in the tab order for screen readers.
- **Fix:** Replace with an "Add phone number" button that opens the lead for editing.

### [SEVERITY: Low] Lead cards are unpaginated
- **Where:** `pages/agent/LeadsNew.tsx:297-308`
- **Problem:** Every matching lead renders as a full card; a busy agent with a few hundred leads scrolls a very long page with no jump-to.
- **Fix:** Page or lazy-load after the first 30 cards.

---

## LeadDetail.tsx — one lead

Good baseline: 48px WhatsApp/Call in the header (`:178-193`), labelled fields (`:295-302`), a clear convert banner (`:220-233`), and a proper delete confirmation that explains what is not deleted (`:282-290`).

### [SEVERITY: High] Unsaved edits are discarded silently when leaving the page
- **Where:** `pages/agent/LeadDetail.tsx:144-146` (Back) and `:242-260` (the edit grid)
- **Problem:** The entire lead record is a permanently-open edit form. Nothing commits until "Save changes" is pressed, but Back to leads, the bottom tab bar, and the stage buttons all navigate or re-fetch without warning. `changeStatus` (`:95-106`) mutates only local state, while `save` (`:86`) calls `load()`, which overwrites `draft` from the server — so editing fields and then changing stage, or vice versa, can silently drop typing.
- **Fix:** Track dirty state, warn before navigating away, and either autosave on blur or make the edit card explicitly enter/exit an edit mode.

### [SEVERITY: Medium] Stage change gives no confirmation at all
- **Where:** `pages/agent/LeadDetail.tsx:95-106`
- **Problem:** Success updates local state only — no toast, no saved indicator. On a slow connection the agent taps a stage, sees the chip highlight instantly, and has no evidence it reached the server. Failures do toast, so a silent success and a stale-looking screen are indistinguishable.
- **Fix:** Show a brief "Stage updated" toast.

### [SEVERITY: Medium] Notes is a single-line input
- **Where:** `pages/agent/LeadDetail.tsx:260` (and `LeadsNew.tsx:230`)
- **Problem:** The one field where an agent records what was discussed on a call is a one-line `<input>`. Text scrolls sideways out of view, there is no way to add a second line, and there is no dated call log anywhere on the screen.
- **Fix:** Use a `<textarea>` with 3-4 rows; consider append-only dated notes.

### [SEVERITY: Medium] A load failure blanks the page with no way back
- **Where:** `pages/agent/LeadDetail.tsx:136`
- **Problem:** Same pattern as CustomerDetail: the route renders as one line of grey text plus "Try again", with no header and no Back control, and the real message ("Lead not found.", `:55`) is dropped because no `message` prop is passed.
- **Fix:** Keep the header mounted and show a specific message.

### [SEVERITY: Low] Loading is a bare text card, so the page pops in
- **Where:** `pages/agent/LeadDetail.tsx:152`
- **Problem:** "Loading lead…" is replaced by three full cards at once.
- **Fix:** Skeleton the header card.

---

## MyQueue.tsx — failed / processing uploads

### [SEVERITY: Critical] "Dismiss" permanently deletes the uploaded policy record
- **Where:** `pages/agent/MyQueue.tsx:96-114`, button at `:295-302`, confirm at `:278-293`
- **Problem:** The button says "Dismiss", the confirm says "Remove", and the success toast says "Removed from queue" — three phrasings that all mean "hide this from my list". What actually runs is `supabase.from("clients").delete()`, which destroys the row and with it the uploaded document reference and any analysis. An agent tidying a cluttered queue will delete customer records believing they are only clearing a notification. There is no undo.
- **Fix:** Either make it a real dismiss (a `hidden`/`archived` flag) or rename it "Delete this upload" with a proper AlertDialog that says the file and analysis will be permanently removed.

### [SEVERITY: High] Polling re-triggers the full-page loading state every 5 seconds
- **Where:** `pages/agent/MyQueue.tsx:47` (`setLoading(true)` inside `fetchQueue`) and the poll at `:117-128`
- **Problem:** While the Processing tab is open, `fetchQueue` runs every 5s and sets `loading` true each time, so the whole table is replaced by three skeleton rows and then re-rendered. The list visibly flashes twice a minute and any row the agent is reaching for disappears mid-tap. The "Auto-refreshing every 5s" note (`:169`) does not prepare them for the content vanishing.
- **Fix:** Add a `silent` flag to `fetchQueue` so polls update data without toggling `loading`.

### [SEVERITY: High] Raw backend error strings are the entire explanation of a failure
- **Where:** `pages/agent/MyQueue.tsx:255-259`
- **Problem:** The Reason column prints `p.error_message` verbatim, in `text-xs` red, truncated on desktop. These are developer strings, in English, with no guidance on what the agent should do (re-scan the document? the PDF is password protected? try again later?). The fallback is the equally unhelpful "Analysis failed".
- **Fix:** Map known failure causes to plain sentences with a suggested action, and keep the raw string behind a "details" toggle.

### [SEVERITY: Medium] Internal status values are shown to the user
- **Where:** `pages/agent/MyQueue.tsx:261-268`
- **Problem:** The badge renders `p.status` directly, so agents read "pending", "processing", "error" in lowercase uppercase-styled pills. Combined with the screen title "My Queue" and the empty text "No failed analyses" (`:155`), the whole screen speaks in system vocabulary.
- **Fix:** Map to plain labels ("Waiting", "Checking now", "Could not read") and rename the screen something like "Uploads needing attention".

### [SEVERITY: Medium] Confirm and cancel are 10px uppercase text buttons
- **Where:** `pages/agent/MyQueue.tsx:280-292`
- **Problem:** Same pattern as Policies: the confirm for a destructive action is `text-[10px]` at `py-1.5`, well under a readable size and under a 44px target, inline next to a same-size Cancel.
- **Fix:** Use the shared ConfirmationDialog already used in CustomerDetail and LeadDetail.

### [SEVERITY: Low] The Failed tab never refreshes on its own
- **Where:** `pages/agent/MyQueue.tsx:117-118`
- **Problem:** Polling is gated on `tab !== "processing"`, so an analysis that fails while the agent watches the Failed tab never appears until they hit Refresh — and nothing tells them the list is stale.
- **Fix:** Poll both tabs silently, or show a "last checked" timestamp.

---

## SettingsNew.tsx — Settings

### [SEVERITY: High] The entire screen is written in language no agent will understand
- **Where:** `pages/agent/SettingsNew.tsx:131-132`, `:141`, `:157`, `:162`, `:187`, `:192`, `:196`
- **Problem:** The page title is "Account Orchestration", the subtitle is "Manage your professional identity and workspace preferences", the sections are "Personal Identification" and "Security Credentials", and the password fields are labelled "New Vault Password" and "Confirm Credentials". "Authorization Level" is the label on a read-only role box. For a 40+ agent with moderate English this is unreadable, and it directly contradicts the project copy-tone rule (professional simple English, no invented product jargon).
- **Fix:** "Settings" / "My details" / "Change password" / "New password" / "Type it again" / "Your role", all routed through `t()` so the Hindi toggle works.

### [SEVERITY: High] Every field label is 10px uppercase grey
- **Where:** `pages/agent/SettingsNew.tsx:153`, `:157`, `:162`, `:168`, `:192`, `:196`, and the error at `:205`
- **Problem:** Labels are `text-[10px] font-black uppercase tracking-widest text-slate-400` — roughly 10px, letter-spaced, low contrast on white. This is the smallest text in the portal on the screen most likely to be used by someone who needs reading glasses. The password error message is rendered in the same 10px uppercase red, so the one piece of corrective feedback is the hardest thing on the page to read.
- **Fix:** 14px sentence-case labels in slate-700; errors at 14px in normal case next to the field they concern.

### [SEVERITY: Medium] Password rules are only revealed after a failed attempt
- **Where:** `pages/agent/SettingsNew.tsx:100-109`, fields at `:193`, `:197`
- **Problem:** Nothing states the 8-character minimum until the agent has typed a password, typed it again, pressed the button and been rejected. There is no show/hide toggle on either field, so a mistyped password can only be found by retyping both. Validation is submit-time only.
- **Fix:** Show the rule under the field from the start, add an eye toggle, and validate the match inline as they type.

### [SEVERITY: Medium] A failed load replaces Settings with one grey line and a full page reload
- **Where:** `pages/agent/SettingsNew.tsx:125`
- **Problem:** Any error from the profile query blanks the screen to "Failed to load — Try again", where "Try again" is `window.location.reload()` — a full app reload rather than a retry, losing anything unsaved elsewhere. The underlying message is never shown.
- **Fix:** Retry the query in place and keep the page shell.

### [SEVERITY: Medium] Settings is missing the settings an agent actually wants
- **Where:** `pages/agent/SettingsNew.tsx:136-211` (whole page)
- **Problem:** The screen offers exactly two things: name/location, and a password change. Language is only changeable from a toggle in the top bar, sign-out only exists inside the sidebar avatar dropdown (`components/agent/AgentLayout.tsx:255`), and there is nothing for renewal reminders or notifications. On a phone, an agent looking for "log out" will look in Settings and not find it.
- **Fix:** Add Language, Sign out, and reminder preferences to this page.

---

## PolicyDetail.tsx — one policy

### [SEVERITY: Critical] The delete confirmation says "archives" but the code hard-deletes
- **Where:** `pages/agent/PolicyDetail.tsx:606-614` (dialog) vs `:342-359` (`archivePolicy`)
- **Problem:** The dialog reads "This action archives the policy, revokes active share links, and removes it from the active upload flow." An agent reasonably concludes the record is filed away and recoverable. The function actually runs `supabase.from("clients").delete()` — the policy, its analysis and its share history are gone permanently, with no undo. The function name (`archivePolicy`) shows the wording drifted from the behaviour.
- **Fix:** Either implement archiving, or change the copy to "This permanently deletes the policy and its report. This cannot be undone." and require the customer name to be shown in the dialog.

### [SEVERITY: High] Share Report on this page calls a relative API path and will fail on the deployed frontend
- **Where:** `pages/agent/PolicyDetail.tsx:281`
- **Problem:** `fetch("/api/agent/clients/.../share/toggle")` hits the frontend origin, while every other call in the portal goes through `getApiBase()` (compare `pages/agent/PoliciesNew.tsx:565`, which uses `${getApiBase()}/api/...`). When the frontend and backend are on different hosts this returns the SPA HTML, `res.ok` is false, and the agent gets a "Share failed / Failed to generate share link" toast with no way to recover — while the same action works from the Policies list. Sharing the report with the customer is the core sales moment of the product.
- **Fix:** Use `getApiBase()` here too.

### [SEVERITY: High] Internal engineering copy is shown to agents
- **Where:** `pages/agent/PolicyDetail.tsx:593-600`
- **Problem:** A card at the bottom of the sidebar reads "Internal detail pages show the unabridged report and agent-only notes. Client shares still go through the public `/report/[token]` route." — including the literal backticked route. It is developer note text left in the UI. Adjacent cards are titled "Action bar" and "Upload metadata", which are equally internal names, and "File size" is hardcoded to "Unavailable" (`:566`) so a field permanently shows no value.
- **Fix:** Delete the note card, rename "Action bar" to "What you can do" and "Upload metadata" to "About this file", and drop the File size row.

### [SEVERITY: Medium] Every action appears two or three times on one screen
- **Where:** `pages/agent/PolicyDetail.tsx:375-378` and `:419-422` and `:581-584` (Share Report x3), `:424-427` and `:586-589` (Delete x2), `:527` and `:579` (Edit Client Details x2)
- **Problem:** There is no single obvious primary action. The most destructive control (Delete) is one of the duplicated ones and appears as a full-width solid red button in the sidebar, directly under three other full-width buttons of the same size — the easiest thing to hit by accident on a phone.
- **Fix:** One action group. Share as the primary, Re-run and Edit secondary, Delete demoted to a text link at the very bottom.

### [SEVERITY: Medium] A third, different set of score thresholds
- **Where:** `pages/agent/PolicyDetail.tsx:44-49`
- **Problem:** Here the bands are 75 ("Strong fit") / 60 ("Watch") / below ("Needs action"). `PoliciesNew.tsx:68-72` colours at 80/60 and its tabs split at 70. The same policy can read "Watch" here, amber in the list, and be counted as "Healthy" in the tab strip. "Strong fit" and "Watch" are also not plain language.
- **Fix:** One shared scoring band module with plain labels, used by every screen.

### [SEVERITY: Medium] Raw system status and no plain explanation of what the page is waiting for
- **Where:** `pages/agent/PolicyDetail.tsx:393`, `:567`, `:507-509`
- **Problem:** The header pill prints the raw `status` value, and when the report payload does not validate the agent is told "Analysis data is in an unexpected format. Try re-running analysis." — an engineering sentence describing an engineering failure, with no button next to it to actually re-run.
- **Fix:** Plain status words, and put the Re-run button inside that message.

### [SEVERITY: Medium] Customer phone on this page is not tappable, and edit fields have no labels
- **Where:** `pages/agent/PolicyDetail.tsx:525` (phone as static text), `:531-534` (placeholder-as-label)
- **Problem:** The Client details card shows the phone as plain text with no Call or WhatsApp action, and the edit form is four unlabelled Inputs whose placeholders (including the cryptic "Identifier / relationship / reference") vanish once values are filled.
- **Fix:** Tappable phone with WhatsApp/Call buttons; visible labels on the edit form.

### [SEVERITY: Low] Error and loading states repeat the weak pattern
- **Where:** `pages/agent/PolicyDetail.tsx:361`, `:382`
- **Problem:** Load failure replaces the entire page with the generic "Failed to load — Try again" (the captured message, including "Policy not found.", is not passed); loading is the text line "Loading policy detail...".
- **Fix:** Keep the header and Back control, pass the message, skeleton the cards.

---

## Claims.tsx — claims desk

Strong screen overall: plain-language claim-type cards with hints (`:465-486`), 48px WhatsApp/Call on every card (`:331-348`), a "Needs you today" banner that explains itself (`:198-213`), and the only page in the portal that passes a real message to the error state (`:195`).

### [SEVERITY: High] Irreversible document deletion is signalled only by a small countdown chip
- **Where:** `pages/agent/Claims.tsx:296-305` (chip), `:318-322`, `:513-515`
- **Problem:** Claim documents are auto-destroyed on a 30-day clock. On the card this appears as a grey or red "12 days left" pill with a clock icon and no noun — nothing on the card says what will happen when it reaches zero. The full explanation only exists in the attention banner ("documents are about to be deleted") and in fine print on the create form. There is no way to extend, download, or acknowledge the deadline from the card, and once `documents_purged_at` is set the card just says "Documents deleted."
- **Fix:** Label the chip "Documents deleted in 12 days", and give the card a direct "Download all documents" action while they still exist.

### [SEVERITY: Medium] "Round 2 open" is jargon
- **Where:** `pages/agent/Claims.tsx:309-316`
- **Problem:** The amber panel reads "Round {n} open. The insurer is waiting on you." An agent has no reason to know what a numbered query round is, and `total_queries` is used where `open_queries` triggered the panel, so the number shown is the total, not the open one.
- **Fix:** "The insurer has asked you for more documents" plus a count of what is outstanding.

### [SEVERITY: Medium] The customer picker is an unsearchable native select
- **Where:** `pages/agent/Claims.tsx:421-426`
- **Problem:** Every customer becomes an `<option>` labelled "Name · phone". On Android this is a full-screen scroll list with no search — unusable past about 30 customers, which is the point at which an agent needs it most.
- **Fix:** Searchable combobox with recent customers first.

### [SEVERITY: Medium] Which claim fields matter is never stated
- **Where:** `pages/agent/Claims.tsx:489-502`, validation at `:379-387`
- **Problem:** Insurer, Hospital, What happened and Amount claimed carry no required marker and no validation — only the customer and name are checked. An agent can open a claim with nothing but a name, and the resulting card then reads "No details yet" (`:281`) with no prompt to fill it in. Amount is a free-text field with no numeric formatting.
- **Fix:** Mark what is needed, validate the amount, and show the claim card a "Finish these details" prompt when key fields are blank.

### [SEVERITY: Low] Empty states again point at a button that is not in them
- **Where:** `pages/agent/Claims.tsx:220-230`
- **Problem:** Grey italic text, "Tap 'New claim' to start one", with the button in the page header.
- **Fix:** Put the button in the empty state.

### [SEVERITY: Low] No i18n on the claims desk
- **Where:** `pages/agent/Claims.tsx:105-106`, `:128-137`, `:151-153`, `:466-467`
- **Problem:** No `useLanguage`; "Cashless", "Reimbursement", "Needs you", "Amount settled", "% recovered on settled claims" are English only.
- **Fix:** Translate, and give "Cashless"/"Reimbursement" Hindi glosses.

---

## AgentUploads.tsx — Analyze / upload

The best-instrumented screen: staged files are explicitly not sent until Analyze (`:596`), the consent step is a real modal with an explicit checkbox (`:496-504`), duplicate uploads are warned about before they cost anything (`:481-494`), and per-file progress is shown (`:774-812`).

### [SEVERITY: High] PDF-only upload with no rejection message — phone photos fail silently
- **Where:** `pages/agent/AgentUploads.tsx:419-424` (`accept: { "application/pdf": [".pdf"] }`, no `onDropRejected`)
- **Problem:** The target user photographs policy documents with their phone. A JPG or PNG is silently discarded by react-dropzone: no toast, no message, nothing appears in the staged list. The agent sees their tap do nothing and has no idea why. There is also no camera-capture affordance anywhere on the screen.
- **Fix:** Add `onDropRejected` with a plain message naming the accepted types, and either accept images or say clearly "PDF only — photos are not supported yet".

### [SEVERITY: High] Analyze stays enabled when the plan has no entries left
- **Where:** `pages/agent/AgentUploads.tsx:556-562` (the "No data-entry entries left" warning) vs `:744-757` (button disabled only on `isProcessing`)
- **Problem:** The quota warning is one line of small red text well above the button. The Analyze button remains fully enabled and styled as the primary action, so the agent stages files, presses it, and discovers the failure only from a per-file error. Nothing on the screen offers an upgrade path.
- **Fix:** Disable Analyze when the remaining quota is zero, explain why on the button, and link to plan upgrade.

### [SEVERITY: High] The consent modal can overflow a small screen with no scroll
- **Where:** `pages/agent/AgentUploads.tsx:443-513`
- **Problem:** The dialog is a fixed centred box with no `max-h` and no `overflow-y-auto`. Its content grows with the consent body, the iLovePDF link, a companion-documents list (`:466-479`) and a duplicate-file warning (`:481-494`). On a 375x667 screen with all sections present, the consent checkbox and the Confirm button can sit below the viewport with no way to scroll to them — the agent cannot complete the upload at all.
- **Fix:** `max-h-[85vh] overflow-y-auto` on the panel, with the buttons in a sticky footer.

### [SEVERITY: High] Client details sit below the Analyze button on a phone
- **Where:** `pages/agent/AgentUploads.tsx:565` (grid becomes single-column under `lg`), card at `:832-894`
- **Problem:** Name, email, phone and policy ID are in a second card that is beside the dropzone on desktop but stacked underneath it on mobile — after the staged file list, the companion-cover section and the Analyze button. An agent working on a phone reaches Analyze before ever seeing the fields, so policies get created without a phone number, which then breaks every WhatsApp and Call action downstream.
- **Fix:** On mobile, put the client fields above the Analyze control, or surface name and phone inside the consent step.

### [SEVERITY: Medium] Half the screen is translated and half is not
- **Where:** translated at `:517`, `:569`, `:587-589`, `:803-806`; hardcoded English at `:553-554`, `:559-560`, `:592`, `:596`, `:604`, `:635-637`, `:643`, `:656-660`, `:697-700`, `:753-756`, `:766-769`
- **Problem:** This is the only in-scope screen wired to `t()`, but every newer explanation — what a health analysis does, how many checks it costs, the companion-cover block, the Analyze button label — is literal English. In Hindi mode the page becomes a mix of two languages, which reads as more broken than a consistently English page. The copy also mixes "Analyze" (`:755`) and "analyse" (`:604`, `:643`) within the same view.
- **Fix:** Move the new copy into the locale files and settle on one spelling.

### [SEVERITY: Medium] Per-file failures show a raw error and offer no retry
- **Where:** `pages/agent/AgentUploads.tsx:807-809`
- **Problem:** A failed file renders "Error: {upload.error}" in 12px red — the raw backend string, in English, with no suggested cause and no Retry button. Recovery requires knowing to navigate to My Queue.
- **Fix:** Plain-language cause plus a Retry button on the row.

### [SEVERITY: Low] Remove / Clear all are 12px text links
- **Where:** `pages/agent/AgentUploads.tsx:619-626`, `:758-765`
- **Problem:** The controls that discard staged work are `text-xs` text buttons with no padding, well under 44px, and "Clear all" sits immediately beside the primary Analyze button.
- **Fix:** Give them real button padding and move Clear all away from Analyze.

---

## Dashboard — DashboardNew.tsx (desktop) and components/agent/DashboardMobile.tsx (phone)

The phone dashboard is a genuinely good triage screen: three "needs you today" sections capped at three rows each, a real skeleton state (`DashboardMobile.tsx:147-155`), and a clear zero state.

### [SEVERITY: High] The phone dashboard has no WhatsApp or Call action, contrary to its own design note
- **Where:** `components/agent/DashboardMobile.tsx:88-120` (the `Row` component) vs the file header comment at `:10-11` ("puts WhatsApp one tap from each name")
- **Problem:** Each row is a single button that navigates to the policy detail page. There is no contact action anywhere on the screen, so acting on "Renews in 5 days" means opening the policy, then finding a number that is itself not tappable (`PolicyDetail.tsx:525`). The stated one-tap-to-WhatsApp promise is not implemented.
- **Fix:** Add a WhatsApp button to each dashboard row, using the policy `client_phone` the list already has access to.

### [SEVERITY: High] A brand-new agent sees "Nothing needs you today" instead of onboarding
- **Where:** `components/agent/DashboardMobile.tsx:173-177`
- **Problem:** The zero state cannot distinguish "you are all caught up" from "you have never uploaded anything". A first-time agent lands on their home screen and is told there is nothing to do, with no upload prompt and no explanation of what the product does for them. It is the single highest-leverage empty state in the portal.
- **Fix:** When the account has no policies at all, replace this block with a first-run card: one sentence and an "Upload your first policy" button.

### [SEVERITY: Medium] Raw analysis error strings on the home screen
- **Where:** `components/agent/DashboardMobile.tsx:244`
- **Problem:** The failed-uploads section prints `error_message` as the row subtitle, truncated to one line — a backend string as the first thing an agent reads about a failure. The "Retry" button beside it (`:246-253`) does not retry; it navigates to My Queue.
- **Fix:** Plain cause text, and either retry in place or label the button "Open queue".

### [SEVERITY: Medium] Status badges are hardcoded English on an otherwise translated screen
- **Where:** `pages/agent/DashboardNew.tsx:416-419`
- **Problem:** The desktop dashboard is wired to `useLanguage` (`:85`) and uses `t()` throughout, but the status pills print literal "Completed", "Failed", "Pending", "Processing" — so in Hindi the busiest column of the table stays English.
- **Fix:** Route the four labels through `t()`.

### [SEVERITY: Low] 10px uppercase micro-labels recur on the dashboard
- **Where:** `pages/agent/DashboardNew.tsx:357`, `:367`, `:377`, `:416-419`
- **Problem:** Section labels and status pills render at `sm:text-[10px]` uppercase with wide letter-spacing — the desktop breakpoint actually makes them *smaller* than the mobile value (`text-[11px]`), which is backwards for the 40+ reader sitting at a laptop.
- **Fix:** Floor all label text at 12px and drop the uppercase letter-spacing.

---

## LeadRenewals.tsx — renewals tab inside Leads

Good bones: bucketed by Overdue / This week / This month with a "Show all" for later ones (`:68-75`, `:112-119`), WhatsApp and Call on every card (`:184-196`), and real skeletons (`:122-123`).

### [SEVERITY: Medium] The draft-message action is a bare emoji
- **Where:** `pages/agent/LeadRenewals.tsx:193-195`
- **Problem:** The third button in the contact row is the ✍️ emoji with only a `title` attribute — invisible on touch, unreadable to a screen reader, and meaningless next to two clearly labelled buttons. The Call button next to it is also icon-only (`:189-192`).
- **Fix:** Use the same labelled "Draft message" button as the lead cards.

### [SEVERITY: Medium] "Mark as spoken to" is a 26px toggle with silent success
- **Where:** `pages/agent/LeadRenewals.tsx:198-207` (handler `:83-93`)
- **Problem:** The one action that records work done is a `text-xs py-1.5` full-width strip, roughly 26px tall. Success updates local state only — no toast, no persisted confirmation — while failure does toast, so the agent cannot tell a saved tap from an unsaved one. The state also resets visually on reload if the write failed.
- **Fix:** 44px control, success toast, and reconcile from the server response.

### [SEVERITY: Low] Empty state and error state repeat the portal-wide weaknesses
- **Where:** `pages/agent/LeadRenewals.tsx:124-128`, `:95`
- **Problem:** Empty is grey italic "No upcoming renewals. Add policies to your leads to see them here." with no action; error blanks the tab with the generic "Failed to load".
- **Fix:** Add an "Add a policy to a lead" button, and pass a real error message.

---

## Cross-cutting patterns (worth fixing once)

1. **Placeholder-as-label** — `CustomersNew.tsx:141-144`, `CustomerDetail.tsx:234-238`, `PolicyDetail.tsx:531-534`. Leads and Claims already have a `Labeled`/`Field` helper (`LeadsNew.tsx:328`, `Claims.tsx:521`); reuse it everywhere.
2. **`InlineErrorState` used without a message and as a whole-page replacement** — `CustomersNew.tsx:156`, `CustomerDetail.tsx:186`, `LeadDetail.tsx:136`, `PolicyDetail.tsx:361`, `SettingsNew.tsx:125`, `MyQueue.tsx:139`, `LeadRenewals.tsx:95`. Only `Claims.tsx:195` passes the message. Every case drops the diagnosis and, on detail pages, removes all navigation.
3. **Inline 10px "Delete / Cancel" confirms for destructive actions** — `PoliciesNew.tsx:579-602`, `MyQueue.tsx:278-293`. A shared `ConfirmationDialog` already exists and is used correctly in `CustomerDetail.tsx:471`, `LeadDetail.tsx:282` and `PolicyDetail.tsx:606`.
4. **Destructive wording that does not match behaviour** — `MyQueue.tsx:96-114` ("Dismiss" hard-deletes) and `PolicyDetail.tsx:611` ("archives" hard-deletes).
5. **Three different score bands** — `PoliciesNew.tsx:68-72` (80/60), `PoliciesNew.tsx:266-267` (70), `PolicyDetail.tsx:44-49` (75/60), plus `CustomerDetail.tsx:286` (70). The same policy is described differently on three screens.
6. **i18n coverage is inconsistent** — Dashboard and Uploads use `t()`; Policies, Customers, CustomerDetail, Leads, LeadDetail, Claims, MyQueue and Settings are hardcoded English. The language toggle in the header therefore appears broken to the user.
7. **No pagination anywhere** — Policies, Customers, Leads, Claims and MyQueue all render every row, on phones, with per-row tooltip providers in the worst case.
8. **Phone numbers are inert text on every "book" screen** — `CustomersNew.tsx:229`, `CustomerDetail.tsx:211`, `PolicyDetail.tsx:525`, `PoliciesMobileList.tsx:91`, `DashboardMobile.tsx:110`. Leads, Claims and LeadRenewals get this right; the customer and policy side does not.
