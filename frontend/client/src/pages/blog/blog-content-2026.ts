// 2026 content expansion — Q&A hub (natural-language questions for voice/AI
// search) and narrative authority articles. Content is answer-first HTML for
// GEO, with FAQ arrays that drive FAQPage schema in [id].tsx.
//
// ACCURACY: evergreen mechanics, not volatile figures. Where a number changes
// under IRDAI norms / tax law (limits, waiting periods, 80D/80C) we describe
// the concept and point to "your policy / current rules" rather than pin a
// figure that can go stale. Illustrative rupee ranges are clearly framed as
// examples, not quotes.

/* ══════════════════════════════════════════════════════════════════════════
 *  QUESTION HUB — short, direct, answer-first pages
 * ════════════════════════════════════════════════════════════════════════ */

export const qaExistingDiseaseContent = `
<div class="blog-article-content">
  <h2 id="short-answer">Can I claim health insurance for an existing disease?</h2>
  <p><strong>Usually yes — but not immediately.</strong> A pre-existing disease (a condition you already had when you bought the policy) is covered only after you serve the policy's pre-existing-disease (PED) waiting period. Claim before that window ends and it will be declined; claim after, and it is treated like any other illness.</p>

  <h3 id="how-it-works">How the waiting period works</h3>
  <p>Insurers apply a PED waiting period counted from when your continuous cover started. During that time, hospitalisation caused by the declared pre-existing condition is excluded. Once served, the condition is covered under your normal sum insured.</p>
  <p>Two things decide whether the claim is paid: that you <strong>disclosed the condition honestly</strong> when buying, and that the waiting period is <strong>over</strong>. Non-disclosure is the most common reason a pre-existing-disease claim is contested.</p>

  <h3 id="what-to-do">What to do</h3>
  <ul>
    <li>Declare every existing condition at purchase, even if it lowers no premium — hiding it risks the whole claim.</li>
    <li>Note your policy's PED waiting period and when it ends.</li>
    <li>If you are switching insurers, port the policy so the time you have already served carries over instead of restarting.</li>
  </ul>
  <p>See our plain-language explainer on the <a href="/learn/pre-existing-disease-waiting-period">pre-existing disease waiting period</a> and <a href="/learn/health-insurance-portability">portability</a>.</p>
</div>`;

export const qaExistingDiseaseFAQs = [
  { question: "How long is the pre-existing disease waiting period?", answer: "It varies by plan and has changed under IRDAI norms over time. Check your policy's PED clause for the exact duration, and count it from when your continuous cover began." },
  { question: "What if I didn't know I had the condition when I bought the policy?", answer: "Genuinely undiagnosed conditions are treated differently from concealed ones. Disclose everything you know; problems arise mainly when a known condition was hidden at purchase." },
  { question: "Does porting reset my pre-existing disease waiting period?", answer: "No. Portability credits the waiting time you have already served with your previous insurer, so you do not start the clock again if the new insurer accepts you." },
  { question: "Can the insurer still reject a claim after the waiting period ends?", answer: "If you disclosed the condition and the waiting period is over, that condition is covered. Rejection would need another valid reason, such as an exclusion or non-disclosure of something else." },
];

export const qaMissedPremiumContent = `
<div class="blog-article-content">
  <h2 id="short-answer">What happens if I miss a premium payment?</h2>
  <p><strong>You usually get a grace period to pay without losing the policy — but you are not covered for anything that happens during the unpaid gap unless and until you pay within that window.</strong> Miss the grace period too, and the policy lapses; restarting it can mean fresh waiting periods and lost continuity benefits.</p>

  <h3 id="grace-period">The grace period</h3>
  <p>Insurers allow a short grace period after the due date to pay the renewal premium and keep the policy continuous. If you pay within it, your accumulated benefits — served waiting periods, no-claim bonus, continuity — are preserved.</p>
  <p>Importantly, cover for events during the unpaid gap is typically not available until the premium is actually paid. The grace period protects continuity; it is not free coverage.</p>

  <h3 id="if-it-lapses">If the policy lapses</h3>
  <ul>
    <li><strong>Health insurance:</strong> a lapse can mean re-serving waiting periods and fresh underwriting — a real loss if you have held the policy for years.</li>
    <li><strong>Term life:</strong> cover stops; reviving it may need arrears, interest and sometimes fresh medical checks within a revival window.</li>
  </ul>
  <p>Read the mechanics in our <a href="/learn/grace-period">grace period</a> explainer, and why continuity matters under <a href="/learn/lifelong-renewability">lifelong renewability</a>.</p>
</div>`;

export const qaMissedPremiumFAQs = [
  { question: "Is my policy cancelled the moment I miss the due date?", answer: "No. A grace period lets you pay a little late and keep the policy continuous. It lapses only if you miss the grace period as well." },
  { question: "Am I covered during the grace period?", answer: "Continuity is preserved if you pay within it, but cover for events in the unpaid gap generally applies only once you have paid the premium. Do not rely on the gap as active cover." },
  { question: "Can I revive a lapsed policy?", answer: "Often yes, within a revival window, by paying arrears (and interest for life plans) and sometimes fresh medicals. Beyond that window you may need a brand-new policy with fresh waiting periods." },
  { question: "Will I lose my no-claim bonus if I pay in the grace period?", answer: "Paying within the grace period generally preserves accumulated benefits like no-claim bonus and served waiting periods. A full lapse is what puts them at risk." },
];

export const qaNormalDeliveryContent = `
<div class="blog-article-content">
  <h2 id="short-answer">Is a normal delivery covered by health insurance?</h2>
  <p><strong>Only if your policy includes maternity cover — and most base health plans do not.</strong> Where maternity is included (built-in or as an add-on), normal delivery and caesarean are covered up to a limit, but usually only after a waiting period of a few years. A standard hospitalisation policy without maternity benefit will not pay for a routine delivery.</p>

  <h3 id="how-it-works">How maternity cover applies</h3>
  <p>Maternity benefit typically has its own waiting period and a sub-limit for delivery, sometimes with different caps for normal and caesarean. Pre- and post-natal costs may sit inside that limit. Because the waiting period is long, maternity cover works only when planned well in advance.</p>

  <h3 id="what-to-check">What to check</h3>
  <ul>
    <li>Does the plan include maternity at all, or only as an optional benefit?</li>
    <li>What is the delivery sub-limit, and is caesarean capped separately?</li>
    <li>Is the waiting period already served for the year you plan to deliver?</li>
    <li>Is the newborn covered, and from when?</li>
  </ul>
  <p>More detail in our <a href="/learn/maternity-cover">maternity cover</a> explainer.</p>
</div>`;

export const qaNormalDeliveryFAQs = [
  { question: "Does normal health insurance cover pregnancy?", answer: "Most base plans exclude maternity or offer it only as an add-on with its own waiting period and sub-limit. Check whether your specific plan includes maternity before assuming delivery is covered." },
  { question: "Is there a waiting period for maternity cover?", answer: "Yes, usually a few years. Because of this, buying maternity cover only when a pregnancy is imminent generally means the benefit is not yet active." },
  { question: "Is caesarean covered like normal delivery?", answer: "Where maternity is covered, both normal and caesarean deliveries are typically included, though some plans set different sub-limits for each. Check your delivery limits." },
  { question: "Is the newborn baby covered?", answer: "Many maternity plans add newborn cover, sometimes from day one and sometimes after a set period, often with its own conditions or limit. Confirm the newborn terms." },
];

export const qaFloodDamageContent = `
<div class="blog-article-content">
  <h2 id="short-answer">Does car insurance cover flood damage?</h2>
  <p><strong>A comprehensive (own-damage) car policy generally covers flood damage to your vehicle — but engine damage from water is the big exception.</strong> If water enters the engine and you try to restart it (hydrostatic lock), that consequential engine damage is often excluded unless you have an <em>engine protect</em> add-on. Third-party-only policies do not cover your own car at all.</p>

  <h3 id="what-is-covered">What is and isn't covered</h3>
  <ul>
    <li><strong>Covered under comprehensive:</strong> damage to the car body, interiors and electricals from flooding or waterlogging, subject to IDV, deductible and depreciation.</li>
    <li><strong>Often excluded:</strong> engine or gearbox damage caused by water ingress — especially if you restart a stalled car in water. This is where an <em>engine protect</em> add-on matters.</li>
    <li><strong>Not covered:</strong> anything on your own car if you only hold third-party liability insurance.</li>
  </ul>

  <h3 id="what-to-do">What to do in a flood</h3>
  <p>If your car stalls in water, do not restart it — call for a tow and inform your insurer. Restarting is the single most common way a claimable situation becomes an excluded engine claim.</p>
  <p>See <a href="/learn/motor-add-ons">motor add-ons</a> (engine protect, roadside assistance) and <a href="/learn/own-damage-vs-third-party">own damage vs third-party</a>.</p>
</div>`;

export const qaFloodDamageFAQs = [
  { question: "Is engine damage from flooding covered?", answer: "Often not under a standard policy. Water-ingress engine damage — particularly from restarting a stalled car — is usually excluded unless you have an engine protect (bumper-to-bumper support) add-on." },
  { question: "Does third-party car insurance cover flood damage?", answer: "No. Third-party cover only pays for damage you cause to others. Damage to your own car from flooding needs comprehensive (own-damage) cover." },
  { question: "Should I restart my car after it stalls in water?", answer: "No. Restarting can cause hydrostatic lock and turn a coverable situation into an excluded engine claim. Get it towed and call your insurer first." },
  { question: "What add-on protects against flood engine damage?", answer: "An engine protect add-on covers consequential engine and gearbox damage, including many water-ingress cases. It is worth considering in flood-prone areas." },
];

export const qaTwoPoliciesContent = `
<div class="blog-article-content">
  <h2 id="short-answer">Can I have two health insurance policies?</h2>
  <p><strong>Yes. You can hold more than one health policy — say a corporate group plan plus your own personal policy — and use them together.</strong> What you cannot do is profit from the same bill twice. Health insurance is indemnity-based: your total recovery cannot exceed what you actually spent.</p>

  <h3 id="how-claims-work">How claims work with two policies</h3>
  <ul>
    <li><strong>Bill within one policy's cover:</strong> claim it from either policy; you do not need the second.</li>
    <li><strong>Bill larger than one policy:</strong> claim up to the limit from the first, get a claim summary and attested bills, then claim the balance from the second. This is contribution/coordination between insurers.</li>
    <li><strong>Fixed-benefit plans</strong> (like critical illness or daily hospital cash) pay their defined amount regardless, and can be claimed alongside an indemnity policy.</li>
  </ul>

  <h3 id="why-hold-two">Why people hold two</h3>
  <p>A common setup is a personal policy backing up an employer plan — so you keep continuous cover if you change or lose your job, and have extra headroom for a large claim. Just remember to disclose existing cover when asked.</p>
  <p>Related: <a href="/learn/sum-insured">sum insured</a> and how it caps each indemnity claim.</p>
</div>`;

export const qaTwoPoliciesFAQs = [
  { question: "Can I claim the same hospital bill from two insurers?", answer: "You cannot recover more than you spent. You can split a large bill across policies (claim the balance from the second after the first), but you cannot get the full amount twice for the same expense." },
  { question: "Should I keep a personal policy if my employer covers me?", answer: "Often yes. A personal policy gives continuity if you change or lose your job and adds headroom for big claims. Employer cover usually ends when the job does." },
  { question: "Do I have to tell one insurer about the other?", answer: "Yes, disclose existing cover when asked. For a bill split across policies, insurers coordinate using claim summaries and attested documents." },
  { question: "Can I claim critical illness and health insurance together?", answer: "Yes. A fixed-benefit critical illness plan pays its lump sum on diagnosis regardless of your indemnity health claim for the same treatment." },
];

export const qaAmbulanceContent = `
<div class="blog-article-content">
  <h2 id="short-answer">Is an ambulance covered by health insurance?</h2>
  <p><strong>Usually yes — most health policies cover ambulance charges, but only up to a small fixed limit and typically only when it leads to a covered hospitalisation.</strong> The amount is capped per event, so a long or specialised transfer can exceed it, leaving a balance you pay yourself.</p>

  <h3 id="how-it-works">How ambulance cover works</h3>
  <p>Ambulance cover pays for road transport to hospital (and sometimes between hospitals) linked to an admissible in-patient claim. It is a defined sub-limit — a per-hospitalisation cap — rather than open-ended cover.</p>
  <ul>
    <li>The transport usually has to connect to a covered hospitalisation, not a standalone call-out.</li>
    <li>The cap is modest; specialised or air ambulance is only covered if the policy specifically says so.</li>
    <li>Keep the ambulance receipt to include it with your claim.</li>
  </ul>
  <p>Ambulance limits sit alongside other <a href="/learn/sub-limit">sub-limits</a> in your policy.</p>
</div>`;

export const qaAmbulanceFAQs = [
  { question: "How much ambulance cover do I get?", answer: "It is a small fixed sub-limit that varies by plan, applied per hospitalisation. Check your policy's ambulance clause for the exact cap." },
  { question: "Is air ambulance covered?", answer: "Only if your policy specifically includes it. Standard ambulance cover is for road transport up to a modest limit; air ambulance needs an explicit benefit." },
  { question: "Is a standalone ambulance call covered without hospitalisation?", answer: "Usually not. Ambulance cover generally applies when the transport is linked to a covered in-patient admission, not as a standalone service." },
  { question: "Do I need to keep the ambulance receipt?", answer: "Yes. Include the ambulance receipt with your hospitalisation claim documents so the admissible amount can be reimbursed up to the limit." },
];

export const qaNotCoveredContent = `
<div class="blog-article-content">
  <h2 id="short-answer">What is not covered in health insurance?</h2>
  <p><strong>Every health policy has exclusions — things it will never pay for — plus items that are only partly paid.</strong> Knowing them upfront is how you avoid a nasty surprise at claim time. Broadly, exclusions fall into permanent exclusions, waiting-period exclusions, and non-payable items.</p>

  <h3 id="permanent">Permanent exclusions</h3>
  <p>These are never covered, such as cosmetic or aesthetic procedures (unless reconstructive after an accident), routine dental and vision (unless due to injury), self-inflicted harm, and treatment outside what the policy defines as medically necessary. The exact list is in your policy wording.</p>

  <h3 id="waiting">Waiting-period exclusions</h3>
  <p>Some things are covered later, not now: pre-existing diseases, specific named ailments, and an initial waiting period for most illnesses at the start of the policy. See <a href="/learn/pre-existing-disease-waiting-period">PED waiting period</a> and <a href="/learn/initial-waiting-period">initial waiting period</a>.</p>

  <h3 id="non-payable">Non-payable items and partial deductions</h3>
  <ul>
    <li><strong>Consumables:</strong> gloves, syringes, PPE and similar are often <a href="/learn/consumables-non-payable">non-payable</a> without an add-on.</li>
    <li><strong>Room-rent overage:</strong> exceeding your room limit can trigger a <a href="/learn/proportionate-deduction">proportionate deduction</a> across the bill.</li>
    <li><strong>Co-pay and sub-limits:</strong> your share and per-item caps reduce the payout within the sum insured.</li>
  </ul>
</div>`;

export const qaNotCoveredFAQs = [
  { question: "Are pre-existing diseases permanently excluded?", answer: "No — they are excluded only during the pre-existing disease waiting period. Once served (and if disclosed honestly), they are covered like any other condition." },
  { question: "Why was part of my bill not paid even at a cashless hospital?", answer: "Non-payable consumables, co-pay, sub-limits and room-rent-linked proportionate deductions are removed from the admissible amount, so the settled figure is often less than the total bill." },
  { question: "Is dental treatment covered?", answer: "Routine dental is usually excluded unless the treatment is needed because of an accident. Check your policy for the exact dental terms." },
  { question: "Where do I find my policy's exclusions?", answer: "In the policy wording, under the exclusions and waiting-periods sections. Read these before you need to claim — they define what will and won't be paid." },
];

export const qaClaimsPerYearContent = `
<div class="blog-article-content">
  <h2 id="short-answer">How many claims can I make in a year?</h2>
  <p><strong>There is no fixed number — you can make multiple claims in a policy year, as many as needed, until your sum insured is used up.</strong> Health insurance limits the total amount (your sum insured), not the count of claims. Once the sum insured is exhausted, further claims that year are not payable unless a restoration benefit refills it.</p>

  <h3 id="how-it-works">How the limit really works</h3>
  <p>Each admissible claim draws down your sum insured. Five small claims or one big claim — what matters is that their total stays within the cover. When the balance runs low, a <a href="/learn/restoration-benefit">restoration benefit</a>, if your plan has one, can reinstate the sum insured for unrelated future claims in the same year.</p>

  <h3 id="what-to-watch">What to watch</h3>
  <ul>
    <li><strong>Sum insured balance:</strong> the real ceiling, not the number of claims.</li>
    <li><strong>No-claim bonus:</strong> claiming may reduce next year's accumulated bonus, depending on the plan.</li>
    <li><strong>Sub-limits:</strong> specific caps (room rent, named procedures) still apply to each claim.</li>
  </ul>
</div>`;

export const qaClaimsPerYearFAQs = [
  { question: "Is there a limit on the number of health insurance claims?", answer: "No fixed count. You can claim multiple times in a year until your sum insured is exhausted; the cap is on the total amount, not the number of claims." },
  { question: "What happens when my sum insured runs out?", answer: "Further claims that year are not payable unless your plan has a restoration benefit that reinstates the sum insured, usually for unrelated conditions." },
  { question: "Does making a claim affect my premium or bonus?", answer: "Claiming can reduce the no-claim bonus you would otherwise accumulate, depending on the plan. It does not cap how many times you may claim within the sum insured." },
  { question: "Do sub-limits apply to every claim?", answer: "Yes. Caps like room rent and named-procedure sub-limits apply to each claim, reducing the admissible amount within your overall sum insured." },
];
