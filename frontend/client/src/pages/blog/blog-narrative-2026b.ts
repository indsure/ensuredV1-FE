// 2026 content expansion (part 2) — trust/category-defining + seasonal
// articles. Answer-first HTML for GEO; FAQ arrays drive FAQPage schema.
//
// ACCURACY: the IRDAI and tax pieces deliberately avoid pinning specific
// limits, durations or 80C/80D figures, which change over time. They explain
// the mechanics and point readers to current rules / their own policy.

/* ── Trust / category-defining ────────────────────────────────────────── */

export const artHiddenClausesContent = `
<div class="blog-article-content">
  <h2 id="intro">The most common hidden clauses in Indian health policies</h2>
  <p>Most claim disappointments are not caused by fraud or bad luck. They are caused by clauses the policyholder never read, buried in the fine print. Here are the ones that most often shrink a payout, and where to look for them.</p>

  <h3 id="room-rent">Room-rent cap and proportionate deduction</h3>
  <p>A <a href="/learn/room-rent-cap">room-rent cap</a> limits the daily room charge, but the real sting is <a href="/learn/proportionate-deduction">proportionate deduction</a>: pick a costlier room and the insurer may scale down the entire bill, not just the room line. A large sum insured does not remove this.</p>

  <h3 id="co-pay-sublimits">Co-pay and disease sub-limits</h3>
  <p><a href="/learn/co-pay">Co-pay</a> makes you share a fixed percentage of every claim. <a href="/learn/sub-limit">Sub-limits</a> cap specific treatments (like cataract or knee replacement) far below your sum insured. Both quietly reduce what you actually receive.</p>

  <h3 id="waiting-nonpayable">Waiting periods and non-payable items</h3>
  <ul>
    <li><a href="/learn/pre-existing-disease-waiting-period">Pre-existing disease</a> and disease-specific waiting periods delay cover for months or years.</li>
    <li><a href="/learn/consumables-non-payable">Consumables and non-payable items</a> (gloves, syringes, PPE) are deducted unless you have an add-on.</li>
    <li><a href="/learn/zone-based-co-pay">Zone-based co-pay</a> adds a share if you are treated in a costlier city than your policy assumes.</li>
  </ul>

  <h3 id="how-to-catch">How to catch them before you claim</h3>
  <p>Read the schedule and the exclusions/sub-limits sections specifically, not just the brochure. Or run your policy through our <a href="/policychecker">policy checker</a>, which surfaces exactly these clauses in plain language.</p>
</div>`;

export const artHiddenClausesFAQs = [
  { question: "What is the most damaging hidden clause in health insurance?", answer: "Room-rent cap combined with proportionate deduction is often the costliest, because exceeding the room limit can scale down the entire admissible bill, not just the room charge." },
  { question: "Do sub-limits apply even with a large sum insured?", answer: "Yes. Sub-limits cap specific treatments regardless of your total sum insured, so a big cover can still pay only a capped amount for those procedures." },
  { question: "How do I find these clauses in my policy?", answer: "Read the policy schedule and the exclusions and sub-limits sections directly, rather than the brochure. A policy analysis tool can also surface them in plain language." },
  { question: "Can I remove a room-rent cap?", answer: "Some insurers offer a room-rent-waiver rider or plans with no capping. You can also stay within your eligible room category to avoid proportionate deduction." },
];

export const artWhyRejectContent = `
<div class="blog-article-content">
  <h2 id="intro">Why insurers reject claims, and how to claim-proof your policy</h2>
  <p>Genuine claim rejections almost always come down to a handful of causes. Understanding them lets you close the gaps in advance, so your policy actually pays when it matters.</p>

  <h3 id="reasons">The real reasons claims fail</h3>
  <ul>
    <li><strong>Non-disclosure:</strong> a condition, habit or existing policy not declared at purchase. The leading cause.</li>
    <li><strong>Waiting periods:</strong> claiming inside a <a href="/learn/pre-existing-disease-waiting-period">PED</a>, disease-specific or <a href="/learn/initial-waiting-period">initial</a> waiting window.</li>
    <li><strong>Exclusions:</strong> the treatment is a <a href="/learn/permanent-exclusions">permanent exclusion</a>.</li>
    <li><strong>Documentation gaps:</strong> missing discharge summary, itemised bills or reports.</li>
    <li><strong>Policy lapse:</strong> a missed renewal beyond the <a href="/learn/grace-period">grace period</a> breaking continuity.</li>
  </ul>

  <h3 id="claim-proof">How to claim-proof your policy</h3>
  <ol>
    <li><strong>Disclose everything at purchase</strong> — conditions, habits, family history and other policies. This single habit prevents most rejections.</li>
    <li><strong>Know your waiting periods</strong> and when each ends.</li>
    <li><strong>Read your exclusions and sub-limits</strong> so there are no surprises.</li>
    <li><strong>Renew on time</strong> to protect continuity and the <a href="/learn/moratorium-period">moratorium</a> clock.</li>
    <li><strong>Keep documents</strong> — every bill, report and prescription.</li>
  </ol>

  <h3 id="check">Check before you rely on it</h3>
  <p>The best time to find a weakness is before a claim. Run your policy through our <a href="/policychecker">policy checker</a> to see the clauses that decide payouts, and read our guide on <a href="/blog/health-insurance-claim-rejected-what-to-do">what to do if a claim is rejected</a>.</p>
</div>`;

export const artWhyRejectFAQs = [
  { question: "What is the number one reason health claims are rejected?", answer: "Non-disclosure — a pre-existing condition, habit or existing policy not declared when buying. Full, honest disclosure at purchase prevents most genuine rejections." },
  { question: "Can honest disclosure really prevent rejection?", answer: "It removes the most common ground for contesting a claim. Combined with understanding waiting periods, exclusions and on-time renewal, it makes your policy far more claim-ready." },
  { question: "Does a lapsed policy cause claim rejection?", answer: "Yes. Missing renewal beyond the grace period breaks continuity and can reset waiting periods, so events after a lapse may not be covered." },
  { question: "How can I check my policy for weaknesses before claiming?", answer: "Read the exclusions, sub-limits and waiting-period sections, or use a policy analysis tool that surfaces those clauses in plain language before you ever need to claim." },
];

export const artReadWordingContent = `
<div class="blog-article-content">
  <h2 id="intro">How to actually read a policy wording in 10 minutes</h2>
  <p>Policy wordings are long, but the parts that decide your claim are short and predictable. You do not need to read every page. Go straight to the sections that control payouts, in this order.</p>

  <h3 id="schedule">1. The policy schedule (1 minute)</h3>
  <p>This one page lists your sum insured, who is covered, the policy period, and any declared conditions. Confirm names, dates and sum insured are correct first.</p>

  <h3 id="limits">2. Sub-limits, room rent and co-pay (3 minutes)</h3>
  <p>Find the <a href="/learn/room-rent-cap">room-rent cap</a>, <a href="/learn/co-pay">co-pay</a>, and any <a href="/learn/sub-limit">sub-limits</a> on specific treatments. These decide how much of a bill is actually paid within your sum insured. Note any <a href="/learn/proportionate-deduction">proportionate deduction</a> clause.</p>

  <h3 id="waiting">3. Waiting periods (2 minutes)</h3>
  <p>Check the <a href="/learn/initial-waiting-period">initial</a>, <a href="/learn/pre-existing-disease-waiting-period">pre-existing disease</a> and disease-specific waiting periods, and note when each ends.</p>

  <h3 id="exclusions">4. Exclusions (2 minutes)</h3>
  <p>Skim the <a href="/learn/permanent-exclusions">permanent exclusions</a> and the list of <a href="/learn/consumables-non-payable">non-payable items</a>. These are what the policy will never pay.</p>

  <h3 id="claims">5. Claim process and timelines (2 minutes)</h3>
  <p>Note the intimation window, document list, and the difference between <a href="/learn/cashless-claim">cashless</a> and <a href="/learn/reimbursement-claim">reimbursement</a>. That is the whole game in ten minutes.</p>
  <p>Short on time? Our <a href="/policychecker">policy checker</a> extracts all of the above automatically.</p>
</div>`;

export const artReadWordingFAQs = [
  { question: "Which parts of a policy wording matter most?", answer: "The schedule, sub-limits and room-rent and co-pay clauses, waiting periods, exclusions, and the claim process. These five sections decide almost every payout." },
  { question: "Do I need to read the entire policy document?", answer: "No. Focus on the schedule, limits and sub-limits, waiting periods, exclusions and claim process. Those control your claim; the rest is largely standard language." },
  { question: "What is the fastest way to understand my policy?", answer: "Read the five key sections in order, or use a policy analysis tool that extracts your sum insured, sub-limits, waiting periods and exclusions in plain language." },
  { question: "Where do I find sub-limits and room-rent caps?", answer: "In the policy schedule and the limits/sub-limits section of the wording. Look specifically for room-rent caps, co-pay and any proportionate-deduction clause." },
];

export const artMythsContent = `
<div class="blog-article-content">
  <h2 id="intro">Health insurance myths that cost people money</h2>
  <p>Some of the most expensive insurance mistakes come from believing things that simply are not true. Here are the myths that most often lead to under-cover or rejected claims.</p>

  <h3 id="myth1">"My employer cover is enough"</h3>
  <p>Group cover ends when the job does, and the employer can change its terms. A personal policy gives you continuity and served <a href="/learn/pre-existing-disease-waiting-period">waiting periods</a> that follow you. See <a href="/blog/individual-vs-group-health-insurance">why you still need your own</a>.</p>

  <h3 id="myth2">"A big sum insured means my whole bill is paid"</h3>
  <p>Not if there is a <a href="/learn/room-rent-cap">room-rent cap</a>, <a href="/learn/co-pay">co-pay</a> or <a href="/learn/sub-limit">sub-limit</a>. These reduce the payout within your sum insured, regardless of how large it is.</p>

  <h3 id="myth3">"I am young and healthy, so I do not need it"</h3>
  <p>Buying young is exactly when cover is cheapest and waiting periods are easiest to serve. Waiting until you need it usually means higher premiums, tougher underwriting, and conditions that are now pre-existing.</p>

  <h3 id="myth4">"I can hide a condition to get a lower premium"</h3>
  <p>Non-disclosure is the leading cause of rejected claims. A small premium saving is not worth risking the entire claim. Always disclose.</p>

  <h3 id="myth5">"All policies are basically the same"</h3>
  <p>Two policies with the same sum insured can pay very differently once room rent, co-pay, sub-limits and exclusions are applied. The wording is the product. Compare it with our <a href="/compare">comparison tool</a>.</p>
</div>`;

export const artMythsFAQs = [
  { question: "Is my employer health cover enough on its own?", answer: "Usually not. It ends when the job does and its terms can change. A personal policy preserves continuity and served waiting periods that stay with you regardless of employment." },
  { question: "Does a large sum insured guarantee my full bill is paid?", answer: "No. Room-rent caps, co-pay and sub-limits reduce the payout within the sum insured. Clean terms matter as much as the headline cover amount." },
  { question: "Is it fine to skip insurance while young and healthy?", answer: "Buying young is cheapest and lets you serve waiting periods before you need cover. Delaying often means higher premiums and conditions that later count as pre-existing." },
  { question: "Can hiding a medical condition lower my premium safely?", answer: "No. Non-disclosure is the top reason claims are rejected. Any premium saving is dwarfed by the risk of losing the whole claim. Always disclose." },
];

/* ── Seasonal / news-pegged ───────────────────────────────────────────── */

export const artIrdaiContent = `
<div class="blog-article-content">
  <h2 id="intro">IRDAI rule changes and what they mean for your policy</h2>
  <p>IRDAI, the insurance regulator, periodically updates the rules insurers must follow. These changes tend to standardise definitions and strengthen policyholder protections. Because specifics evolve, the smart approach is to understand the <em>direction</em> of change and check the current rules at renewal, rather than rely on old figures.</p>

  <h3 id="areas">Where regulatory changes usually land</h3>
  <ul>
    <li><strong>Standard definitions:</strong> common terms and exclusions are increasingly standardised across insurers, making policies easier to compare.</li>
    <li><strong>Waiting periods and moratorium:</strong> rules around <a href="/learn/pre-existing-disease-waiting-period">pre-existing disease</a> waits and the <a href="/learn/moratorium-period">moratorium period</a> (after which claims cannot be contested for non-disclosure) have been tightened in the policyholder's favour over time.</li>
    <li><strong>Portability and grace:</strong> norms for <a href="/learn/health-insurance-portability">porting</a> and the <a href="/learn/grace-period">grace period</a> aim to protect continuity when you switch or pay late.</li>
    <li><strong>Claim processes:</strong> moves toward faster, clearer claim handling and cashless access.</li>
  </ul>

  <h3 id="what-to-do">What this means for you</h3>
  <ol>
    <li><strong>Re-check key terms at each renewal</strong> — waiting periods, moratorium and portability rights may have improved.</li>
    <li><strong>Do not assume old figures still apply;</strong> confirm the current norms or ask your insurer.</li>
    <li><strong>Use standardisation to compare</strong> policies more confidently.</li>
  </ol>
  <p>For the plain-language mechanics behind these terms, browse our <a href="/learn">insurance glossary</a>.</p>
</div>`;

export const artIrdaiFAQs = [
  { question: "Do IRDAI rule changes apply to my existing policy?", answer: "Many regulatory changes flow through at renewal or apply prospectively. Check with your insurer how a specific change affects your policy, and review your terms at each renewal." },
  { question: "Have waiting periods changed under IRDAI norms?", answer: "Rules around pre-existing disease waiting periods and the moratorium have been revised over time, generally in the policyholder's favour. Confirm the current durations for your plan rather than relying on older figures." },
  { question: "What is the moratorium period?", answer: "After a continuous coverage period defined by regulation, an insurer generally cannot contest a claim for non-disclosure except in cases of proven fraud. The exact duration is set by current norms." },
  { question: "How do I keep up with rule changes?", answer: "Review your policy terms at each renewal, watch for standardised definitions, and confirm current rules with your insurer or the regulator rather than assuming past figures still hold." },
];

export const artTaxContent = `
<div class="blog-article-content">
  <h2 id="intro">Tax benefits on health and life insurance (Sections 80D and 80C)</h2>
  <p>Insurance premiums can bring tax deductions under the Income Tax Act, but the exact limits and eligibility change with budgets and your chosen tax regime. Treat the mechanics below as the framework, and confirm the current figures and whether they apply under your regime before filing.</p>

  <h3 id="80d">Health insurance and Section 80D</h3>
  <p>Section 80D allows a deduction for health insurance premiums paid for yourself, family and parents, with an additional allowance where senior citizens are covered. Preventive health check-ups can fall within the limit. The precise caps depend on current law and who is insured, so verify the applicable figures for the year.</p>

  <h3 id="80c">Life insurance and Section 80C</h3>
  <p>Life insurance premiums can qualify for deduction under Section 80C, which is a combined limit shared with other eligible investments (such as certain provident-fund, ELSS and tuition-fee payments). Because 80C is a shared cap, life premiums compete with your other 80C claims.</p>

  <h3 id="regime">The regime question</h3>
  <p>Whether you can use these deductions depends on the tax regime you opt for. Some deductions are available only under specific regimes. Choose your regime with the full picture, not just the insurance angle.</p>

  <h3 id="reminder">A useful reminder</h3>
  <p>Tax relief is a bonus, not the reason to buy cover. Buy the right protection first, size it to your needs, and treat the deduction as a benefit on top. Confirm current limits with an official source or a tax adviser.</p>
</div>`;

export const artTaxFAQs = [
  { question: "Can I claim tax deduction on health insurance premiums?", answer: "Health insurance premiums are generally deductible under Section 80D, with an added allowance where senior citizens are covered. The exact limits depend on current law and who is insured, and on your tax regime." },
  { question: "Is life insurance premium tax deductible?", answer: "Life insurance premiums can qualify under Section 80C, which is a combined cap shared with other eligible investments. Confirm the current limit and your regime before relying on it." },
  { question: "Does the tax regime affect these deductions?", answer: "Yes. Availability of 80C and 80D deductions can depend on whether you choose the old or new regime. Decide your regime with the full tax picture, not just insurance." },
  { question: "Should I buy insurance mainly for tax savings?", answer: "No. Buy the right cover for your protection needs first and treat any tax deduction as a bonus. Under-buying or over-buying for tax reasons usually backfires." },
];

export const artDiagnosisContent = `
<div class="blog-article-content">
  <h2 id="intro">Buying insurance before or after a diagnosis: what changes</h2>
  <p>Timing changes everything in insurance. The same person can get very different terms depending on whether they buy cover before or after a medical diagnosis. Understanding this is one of the strongest arguments for buying early.</p>

  <h3 id="before">Buying before a diagnosis</h3>
  <ul>
    <li>You are underwritten as healthy, so premiums are lower and approval is easier.</li>
    <li>Conditions diagnosed later are treated as new illnesses, covered subject to the normal terms.</li>
    <li>You serve waiting periods while healthy, so cover is fully active when you need it.</li>
  </ul>

  <h3 id="after">Buying after a diagnosis</h3>
  <ul>
    <li>The condition is now <a href="/learn/pre-existing-disease-waiting-period">pre-existing</a>. You must disclose it, and it is covered only after the applicable waiting period.</li>
    <li>The insurer may load the premium, exclude the condition, or decline cover for it.</li>
    <li>Non-disclosure to get around this is the leading cause of rejected claims, and is not worth the risk.</li>
  </ul>

  <h3 id="already">If you are already diagnosed</h3>
  <p>You still have options: disclose fully, accept the waiting period or loading, and compare insurers, since their treatment of specific conditions varies. Cover with a served waiting period is far better than none. Read <a href="/blog/claim-health-insurance-for-existing-disease">claiming for an existing disease</a> for the mechanics.</p>

  <h3 id="lesson">The lesson</h3>
  <p>The best time to buy is before you have a reason to. Buying while healthy locks in lower premiums and clean terms, and gets your waiting periods out of the way.</p>
</div>`;

export const artDiagnosisFAQs = [
  { question: "Can I buy health insurance after being diagnosed with a condition?", answer: "Yes, but you must disclose it. The condition becomes pre-existing, covered only after the waiting period, and the insurer may load the premium, exclude it, or decline. Terms vary between insurers." },
  { question: "Why is buying insurance before a diagnosis so much better?", answer: "You are underwritten as healthy, so premiums are lower and approval easier, and you serve waiting periods before you need cover. Conditions diagnosed later are treated as new illnesses under normal terms." },
  { question: "Should I hide a diagnosis to get better terms?", answer: "No. Non-disclosure is the leading reason claims are rejected. Disclose fully and accept the waiting period or loading; honest cover that pays beats cheaper cover that does not." },
  { question: "Is it worth insuring an already-diagnosed condition?", answer: "Yes. After the waiting period the condition is covered, and insurers differ in how they treat specific conditions, so it pays to compare. Cover with a served waiting period beats no cover." },
];
