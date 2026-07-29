// 2026 content expansion — narrative authority articles (how-to / decision,
// trust/category-defining, seasonal). Answer-first HTML for GEO; FAQ arrays
// drive FAQPage schema in [id].tsx.
//
// ACCURACY: evergreen mechanics, not volatile figures. Tax limits (80C/80D),
// IRDAI-set durations and CSR/ICR numbers change over time, so we describe the
// concept and point to "current rules / your policy" rather than pin a figure.
// Illustrative rupee amounts are framed as examples, not quotes.

/* ── High-intent how-to / decision guides ─────────────────────────────── */

export const artClaimRejectedContent = `
<div class="blog-article-content">
  <h2 id="intro">Your health insurance claim was rejected. Here is what to do.</h2>
  <p>A rejected claim is not always the end of the road. Many rejections are about process or paperwork, not a genuine lack of cover, and those can be fixed. The key is to understand <em>why</em> it was rejected, then respond in the right order.</p>

  <h3 id="common-reasons">Why claims get rejected</h3>
  <ul>
    <li><strong>Non-disclosure:</strong> a pre-existing condition or habit not declared at purchase. The single biggest reason.</li>
    <li><strong>Waiting period:</strong> claiming for something still inside its <a href="/learn/pre-existing-disease-waiting-period">PED</a> or <a href="/learn/initial-waiting-period">initial waiting</a> window.</li>
    <li><strong>Exclusions:</strong> the treatment is a <a href="/learn/permanent-exclusions">permanent exclusion</a> under the policy.</li>
    <li><strong>Documentation:</strong> missing discharge summary, itemised bills, or investigation reports.</li>
    <li><strong>Cashless denial:</strong> often a network or eligibility issue, not a final rejection. You can still file reimbursement.</li>
  </ul>

  <h3 id="steps">A calm, step-by-step response</h3>
  <ol>
    <li><strong>Get the reason in writing.</strong> Insurers must state the ground for rejection. Read it against your policy wording.</li>
    <li><strong>Separate "denied" from "needs documents".</strong> Many rejections are really requests for missing paperwork you can supply.</li>
    <li><strong>Gather evidence.</strong> Discharge summary, all bills, prescriptions, reports, and your policy schedule.</li>
    <li><strong>Raise a grievance with the insurer.</strong> Use their grievance channel with a clear, factual note and documents.</li>
    <li><strong>Escalate.</strong> If unresolved, the Insurance Ombudsman handles eligible complaints. Keep every communication.</li>
  </ol>

  <h3 id="prevent">Prevent the next one</h3>
  <p>Most rejections trace back to purchase-time choices: full disclosure, understanding waiting periods, and knowing your exclusions. Run your policy through our <a href="/policychecker">policy checker</a> to surface the clauses that decide claims before you ever file one.</p>
</div>`;

export const artClaimRejectedFAQs = [
  { question: "Can a rejected health insurance claim be reopened?", answer: "Often yes. If the rejection was for missing documents or a process issue, supplying the paperwork and raising a grievance can get it reconsidered. Genuine exclusions and non-disclosure are harder to overturn." },
  { question: "What is the Insurance Ombudsman?", answer: "An independent body that resolves eligible policyholder complaints against insurers, free of cost, after you have first raised a grievance with the insurer. Keep all documents and correspondence." },
  { question: "Is a cashless denial the same as claim rejection?", answer: "No. Cashless denial is usually an eligibility or documentation issue at the hospital. You can typically pay and file a reimbursement claim with the same documents afterwards." },
  { question: "How do I avoid claim rejection?", answer: "Disclose all conditions and habits at purchase, understand your waiting periods and exclusions, and keep complete documentation. Most rejections stem from purchase-time gaps, not the claim itself." },
];

export const artCashlessStepsContent = `
<div class="blog-article-content">
  <h2 id="intro">How to file a cashless claim, step by step</h2>
  <p>A <a href="/learn/cashless-claim">cashless claim</a> lets a network hospital settle the covered amount directly with your insurer, so you pay only the non-covered part. The process is straightforward once you know the steps, and whether your admission is planned or an emergency.</p>

  <h3 id="planned">Planned hospitalisation</h3>
  <ol>
    <li><strong>Confirm the hospital is in-network.</strong> Cashless works only at <a href="/learn/network-hospital-tpa">network hospitals</a>. Check the current list.</li>
    <li><strong>Intimate the insurer in advance.</strong> Give notice a few days before admission.</li>
    <li><strong>Submit pre-authorisation.</strong> The hospital insurance desk sends your diagnosis and cost estimate to the insurer or TPA using your health card.</li>
    <li><strong>Get approval.</strong> The insurer approves an admissible amount, sometimes in stages.</li>
    <li><strong>At discharge,</strong> the insurer settles the approved amount with the hospital; you pay co-pay, deductible and non-payable items.</li>
  </ol>

  <h3 id="emergency">Emergency hospitalisation</h3>
  <ol>
    <li>Get admitted and stabilised first.</li>
    <li>Intimate the insurer within the policy emergency window (a family member can do this).</li>
    <li>The hospital raises pre-authorisation once you are stable.</li>
    <li>Approval and settlement follow the same path as planned admission.</li>
  </ol>

  <h3 id="tips">Keep it smooth</h3>
  <ul>
    <li>Carry your health card or policy number and a photo ID.</li>
    <li>Understand that pre-authorisation is an estimate; the final amount is confirmed at discharge.</li>
    <li>Keep copies of everything. If cashless is partly denied, you can claim the balance by <a href="/learn/reimbursement-claim">reimbursement</a>.</li>
  </ul>
</div>`;

export const artCashlessStepsFAQs = [
  { question: "How soon must I inform the insurer for a planned admission?", answer: "Usually a few days in advance; check your policy stated notice period. For emergencies, intimate within the short window the policy specifies, even after admission." },
  { question: "What do I pay at discharge in a cashless claim?", answer: "Your co-pay, any deductible, non-payable consumables, and anything above your sum insured or sub-limits. The insurer settles the rest directly with the hospital." },
  { question: "What if cashless is denied at the hospital?", answer: "It is usually a documentation or eligibility issue, not a final rejection. Pay the bill and file a reimbursement claim with the same documents." },
  { question: "Can I use cashless at any hospital?", answer: "No, only at hospitals in your insurer network. For non-network hospitals you pay first and claim reimbursement." },
];

export const artPortContent = `
<div class="blog-article-content">
  <h2 id="intro">How to port your health insurance without losing benefits</h2>
  <p><a href="/learn/health-insurance-portability">Portability</a> lets you switch insurer or plan while carrying forward the waiting-period credit you have already earned. Done right, you keep your continuity; done late or carelessly, you can create gaps or lose ground.</p>

  <h3 id="why">Why port at all</h3>
  <p>People port for better room-rent terms, fewer sub-limits, a stronger network, or a plan that simply fits better. The reason porting beats buying fresh is that your served <a href="/learn/pre-existing-disease-waiting-period">pre-existing-disease waiting period</a> is credited by the new insurer, so you do not restart the clock.</p>

  <h3 id="steps">The porting process</h3>
  <ol>
    <li><strong>Start early.</strong> Initiate porting before renewal, within the pre-renewal window insurers require, not after the policy lapses.</li>
    <li><strong>Apply to the new insurer.</strong> They underwrite your application and may accept, offer different terms, or decline. Acceptance is not automatic.</li>
    <li><strong>Compare the full plan, not just premium.</strong> Sum insured, sub-limits, co-pay, room rent and network all change; a lower premium with worse terms is not a win.</li>
    <li><strong>Do not let the old policy lapse</strong> until the new one is confirmed, so there is no coverage gap.</li>
  </ol>

  <h3 id="pitfalls">Common pitfalls</h3>
  <ul>
    <li>Porting only to chase a lower premium while accepting tighter sub-limits.</li>
    <li>Applying too late and missing the window.</li>
    <li>Assuming acceptance; the new insurer still underwrites you.</li>
  </ul>
  <p>Before you switch, run both policies through our <a href="/compare">comparison tool</a> to see what actually changes.</p>
</div>`;

export const artPortFAQs = [
  { question: "Will I lose my waiting-period credit if I port?", answer: "No. Portability credits the waiting time you have already served, so you do not restart it, provided the new insurer accepts your application and you port within the correct window." },
  { question: "Can the new insurer reject my porting request?", answer: "Yes. The new insurer underwrites your application and can accept, modify terms, or decline. Continuity credit applies only if they accept you." },
  { question: "When should I start the porting process?", answer: "Ahead of your renewal date, within the pre-renewal window insurers require. Starting late, or after a lapse, can cost you the continuity benefit." },
  { question: "Does a higher sum insured on the new policy carry the old waiting credit?", answer: "The base cover carries your served waiting periods. Any newly added or increased cover can have its own fresh waiting period. Check the new plan terms." },
];

export const artSeniorParentsContent = `
<div class="blog-article-content">
  <h2 id="intro">Health insurance for parents and senior citizens</h2>
  <p>Insuring older parents is where cover matters most and is hardest to get: premiums are higher, waiting periods bite, and terms like co-pay and sub-limits do more work. The goal is realistic, claim-ready cover, not the cheapest sticker premium.</p>

  <h3 id="what-changes">What is different at older ages</h3>
  <ul>
    <li><strong>Higher premiums and possible medical tests</strong> at entry.</li>
    <li><strong>Co-pay</strong> is common on senior plans; you share a fixed percentage of every claim.</li>
    <li><strong>Sub-limits and room-rent caps</strong> can quietly shrink payouts; watch for <a href="/learn/proportionate-deduction">proportionate deduction</a>.</li>
    <li><strong>Pre-existing conditions</strong> are the norm, so the <a href="/learn/pre-existing-disease-waiting-period">PED waiting period</a> and honest disclosure are central.</li>
  </ul>

  <h3 id="how-to-choose">How to choose well</h3>
  <ol>
    <li><strong>Disclose everything.</strong> At older ages, non-disclosure is the fastest route to a rejected claim.</li>
    <li><strong>Prioritise clean terms</strong> such as lower co-pay and no or high room-rent limit over a marginally lower premium.</li>
    <li><strong>Check lifelong renewability</strong> so cover cannot be dropped later for age or claims.</li>
    <li><strong>Consider a top-up</strong> to raise the ceiling affordably.</li>
  </ol>

  <h3 id="bottom-line">The bottom line</h3>
  <p>For seniors, the policy wording decides the payout more than the brand. Read the co-pay, sub-limits and waiting periods carefully, or run the policy through our <a href="/policychecker">policy checker</a> first.</p>
</div>`;

export const artSeniorParentsFAQs = [
  { question: "Is it too late to buy health insurance for elderly parents?", answer: "Many insurers offer senior plans with higher entry ages, though premiums are higher and medical tests may apply. The earlier you start continuous cover, the better the long-run terms." },
  { question: "Why do senior citizen plans have co-pay?", answer: "Co-pay shares claim cost between you and the insurer, which helps keep older-age cover available. Prefer plans with lower co-pay if you can, as it directly reduces your payout." },
  { question: "Do pre-existing conditions get covered for seniors?", answer: "Yes, after the pre-existing disease waiting period, provided they were disclosed honestly at purchase. Disclosure matters even more at older ages." },
  { question: "Should I add a top-up for my parents?", answer: "A top-up or super top-up can raise the overall ceiling affordably above a base policy, which is useful for the large bills more likely at older ages." },
];

export const artHowMuchCoverContent = `
<div class="blog-article-content">
  <h2 id="intro">How much health cover do you actually need?</h2>
  <p>There is no universal number, but there is a sensible way to reason about it: match your <a href="/learn/sum-insured">sum insured</a> to the cost of a serious hospitalisation in your city and your life stage, not to the cheapest premium.</p>

  <h3 id="drivers">What drives the right number</h3>
  <ul>
    <li><strong>Your city:</strong> metro hospital costs run far higher than smaller towns, and <a href="/learn/zone-based-co-pay">zone-based co-pay</a> can apply if you under-buy.</li>
    <li><strong>Who is covered:</strong> a family floater shares one pool, so one big claim can exhaust it for everyone.</li>
    <li><strong>Life stage:</strong> needs shift with dependants, age and existing conditions.</li>
  </ul>

  <h3 id="by-stage">A life-stage lens</h3>
  <ul>
    <li><strong>Young and single:</strong> a solid individual base, bought early while premiums and health are favourable.</li>
    <li><strong>Young family:</strong> a larger floater or individual covers per member; mind that a shared pool depletes with one claim.</li>
    <li><strong>Mid-life with parents:</strong> separate senior cover for parents rather than crowding one floater.</li>
    <li><strong>Near retirement:</strong> higher ceilings, clean co-pay and sub-limit terms, and top-ups for headroom.</li>
  </ul>

  <h3 id="raise-affordably">Raising cover affordably</h3>
  <p>You do not have to buy one huge policy. A moderate base plus a top-up or super top-up often gives a higher effective ceiling for less premium. Size the base for common claims and the top-up for catastrophic ones.</p>
</div>`;

export const artHowMuchCoverFAQs = [
  { question: "Is a bigger sum insured always better?", answer: "A higher ceiling helps against catastrophic bills, but clean terms (room rent, co-pay, sub-limits) decide how much of a claim is actually paid. Balance size with quality of terms." },
  { question: "How does my city affect how much cover I need?", answer: "Metro treatment costs more, so the same illness needs a larger sum insured than in a smaller town. Under-buying can also trigger zone-based co-pay if you get treated in a costlier city." },
  { question: "Is one family floater enough for everyone?", answer: "A floater shares one sum insured, so a single major claim can exhaust it for the whole family. For older parents especially, a separate policy is often wiser." },
  { question: "How can I increase cover without a huge premium?", answer: "Pair a moderate base policy with a top-up or super top-up. The base handles common claims and the top-up adds an affordable ceiling for large bills." },
];

export const artTermWholeEndowmentContent = `
<div class="blog-article-content">
  <h2 id="intro">Term vs whole life vs endowment: which and why</h2>
  <p>These three life products do very different jobs. Confusing them is how people end up under-protected and over-charged. The short version: term is pure protection, endowment mixes protection with savings, and whole life extends cover across your lifetime.</p>

  <h3 id="term">Term insurance: pure protection</h3>
  <p>Term pays a large <a href="/learn/sum-assured">sum assured</a> to your family if you die during the policy term, for a low premium. There is usually no maturity payout, and that is the point: all your premium buys protection, not savings. It is the most efficient way to cover income replacement and loans.</p>

  <h3 id="endowment">Endowment: protection plus savings</h3>
  <p>Endowment plans combine a smaller life cover with a savings or maturity benefit. Premiums are far higher for the same cover because part goes into savings. Returns are typically modest; the trade-off is a lump sum if you survive the term.</p>

  <h3 id="whole-life">Whole life: lifelong cover</h3>
  <p>Whole life extends protection across your whole lifetime (often to a very high age) and can build a cash value. It suits specific estate-planning or dependant-for-life needs rather than plain income replacement.</p>

  <h3 id="which">Which should you pick?</h3>
  <ul>
    <li><strong>Need to protect your family cheaply?</strong> Term, sized to replace income and clear debts.</li>
    <li><strong>Want forced savings with some cover?</strong> Endowment, but compare its returns against keeping term plus a separate investment.</li>
    <li><strong>Specific lifelong or legacy need?</strong> Whole life, chosen deliberately.</li>
  </ul>
  <p>For most families, a large term plan plus separate investing beats bundling the two. See our <a href="/blog/term-life-insurance-basics">term insurance basics</a>.</p>
</div>`;

export const artTermWholeEndowmentFAQs = [
  { question: "Why is term insurance so much cheaper than endowment?", answer: "Term is pure protection with no savings component, so nearly all the premium buys cover. Endowment premiums are higher because part funds a maturity or savings benefit." },
  { question: "Do I get money back if I survive a term plan?", answer: "Pure term plans usually have no maturity payout; the value is the protection during the term. Some return-of-premium variants exist but cost more." },
  { question: "Is endowment a good investment?", answer: "Endowment returns are typically modest. Many people are better served by buying term for protection and investing the difference separately, but it depends on your goals and discipline." },
  { question: "Who should consider whole life insurance?", answer: "Those with lifelong dependants or estate-planning needs, where cover across the entire lifetime matters. For plain income replacement, term is usually more efficient." },
];

export const artBestAgeContent = `
<div class="blog-article-content">
  <h2 id="intro">The best age to buy health and term insurance</h2>
  <p>The honest answer for both: as early as you sensibly can. Premiums and eligibility both favour the young and healthy, and starting early banks time against waiting periods and future health changes.</p>

  <h3 id="health">Health insurance: buy young, stay continuous</h3>
  <ul>
    <li><strong>Lower premiums:</strong> age is a major pricing factor; younger entry locks in cheaper cover.</li>
    <li><strong>Waiting periods served early:</strong> your <a href="/learn/pre-existing-disease-waiting-period">PED</a> and initial waits pass while you are healthy, so cover is fully active when you need it.</li>
    <li><strong>Continuity compounds:</strong> years of unbroken cover build no-claim bonus and protect you under <a href="/learn/lifelong-renewability">lifelong renewability</a>.</li>
  </ul>

  <h3 id="term">Term insurance: lock the rate in</h3>
  <ul>
    <li><strong>Premiums are fixed at entry</strong> for the whole term in most plans, so buying young locks a low rate for decades.</li>
    <li><strong>Easier underwriting:</strong> fewer health issues mean smoother approval and standard rates.</li>
    <li><strong>Cover when dependants arrive:</strong> buy as soon as someone relies on your income or you take on a big loan.</li>
  </ul>

  <h3 id="already-older">What if you are already older?</h3>
  <p>Later is still far better than never. The cost of being uninsured during a big claim dwarfs a higher premium. Disclose honestly, prioritise clean terms, and consider top-ups for headroom.</p>
</div>`;

export const artBestAgeFAQs = [
  { question: "Why buy insurance when I am young and healthy?", answer: "Premiums are lowest, underwriting is easiest, and you serve waiting periods while healthy, so cover is cheap and fully active by the time you actually need it." },
  { question: "Does term insurance premium rise as I age?", answer: "In most term plans the premium is fixed at entry for the whole term, so buying younger locks a lower rate for decades. Waiting raises the entry price." },
  { question: "Is it worth buying health insurance after 50?", answer: "Yes. Premiums are higher and terms tighter, but being uninsured during a major hospitalisation is far costlier. Focus on honest disclosure and clean co-pay and sub-limit terms." },
  { question: "When should I buy term insurance?", answer: "As soon as someone depends on your income or you take on significant debt like a home loan. Earlier entry means a lower locked-in premium." },
];

export const artCoverSizeContent = `
<div class="blog-article-content">
  <h2 id="intro">Cover size: 5 lakh vs 10 lakh vs 1 crore, and how it changes payouts</h2>
  <p>Cover size sets the ceiling on what you can recover, but how that ceiling behaves differs between health and life insurance. Getting the size right is one of the highest-impact decisions you will make.</p>

  <h3 id="health">Health: sum insured is an annual ceiling</h3>
  <p>A health <a href="/learn/sum-insured">sum insured</a> of 5 lakh, 10 lakh or more caps what you can claim in a year, reimbursing actual admissible bills up to that cap. The difference shows up in a big event:</p>
  <ul>
    <li><strong>5 lakh</strong> handles many routine hospitalisations, but a major surgery or ICU stay in a metro can breach it.</li>
    <li><strong>10 lakh or more</strong> gives more headroom for serious illness, often the practical floor for metro families.</li>
    <li><strong>Beyond that,</strong> a top-up or super top-up raises the ceiling affordably instead of paying full price for one huge base.</li>
  </ul>
  <p>Remember: size is the ceiling, but co-pay, sub-limits and room-rent rules decide how much within it is actually paid.</p>

  <h3 id="life">Life: sum assured is a fixed payout</h3>
  <p>A term <a href="/learn/sum-assured">sum assured</a> of 1 crore is paid in full to your nominee on death, not as a reimbursement. Here the question is income replacement: enough to run the household, clear loans, and fund major goals for years without your income. Too small a cover leaves the family exposed, and the premium difference between adequate and inadequate cover is usually small.</p>

  <h3 id="how-to-size">How to size each</h3>
  <ul>
    <li><strong>Health:</strong> the cost of a serious hospitalisation in your city, with headroom via top-ups.</li>
    <li><strong>Life:</strong> several years of income plus outstanding loans and future goals, minus existing savings.</li>
  </ul>
</div>`;

export const artCoverSizeFAQs = [
  { question: "Is 5 lakh health cover enough?", answer: "It covers many routine hospitalisations, but a major surgery or ICU stay in a metro can exceed it. Families in cities often need 10 lakh or more, or a base plus top-up." },
  { question: "How is life cover size different from health cover size?", answer: "Health sum insured is an annual ceiling that reimburses actual bills up to the cap. Life sum assured is a fixed lump sum paid in full on death, regardless of expenses." },
  { question: "Should I buy one large health policy or a base plus top-up?", answer: "A base plus top-up or super top-up usually gives a higher effective ceiling for less premium: the base covers common claims and the top-up covers catastrophic ones." },
  { question: "How much term life cover do I need?", answer: "A common approach is several years of income plus outstanding loans and major future goals, minus existing savings, enough for your family to maintain their life without your income." },
];

export const artGroupVsIndividualContent = `
<div class="blog-article-content">
  <h2 id="intro">Individual vs corporate group health cover: why you still need your own</h2>
  <p>Employer group health cover is a genuine benefit, but relying on it alone is risky. A personal policy does jobs the group plan cannot, especially the day you change or lose your job.</p>

  <h3 id="group-strengths">What group cover does well</h3>
  <ul>
    <li>Often covers pre-existing conditions from day one, with no medical tests.</li>
    <li>Free or subsidised, and may include family members.</li>
  </ul>

  <h3 id="group-gaps">Where group cover leaves you exposed</h3>
  <ul>
    <li><strong>It ends with the job.</strong> Resign, get laid off, or retire, and the cover usually stops, often when buying fresh cover is hardest.</li>
    <li><strong>The employer controls the terms.</strong> Sum insured, co-pay, room rent and sub-limits can be changed or trimmed at renewal, without your say.</li>
    <li><strong>No continuity for you.</strong> Years on a group plan do not build your own waiting-period credit or no-claim bonus.</li>
  </ul>

  <h3 id="best-setup">The resilient setup</h3>
  <p>Hold your <strong>own individual policy alongside</strong> the group plan. Your personal policy quietly accrues continuity and served <a href="/learn/pre-existing-disease-waiting-period">waiting periods</a>, so if the job cover disappears you are not starting from zero. You can also <a href="/blog/can-i-have-two-health-insurance-policies">use both together</a> on a large bill.</p>
  <p>Buy the personal policy while you are young and healthy so its waiting periods are behind you before you ever need it.</p>
</div>`;

export const artGroupVsIndividualFAQs = [
  { question: "If my employer covers me, do I still need my own health policy?", answer: "Yes. Employer cover ends when the job does and its terms can change without your input. A personal policy gives continuity, served waiting periods, and cover that follows you." },
  { question: "Can I use employer and personal health cover together?", answer: "Yes. For a large bill you can claim up to one policy limit and the balance from the other. You just cannot recover more than you actually spent." },
  { question: "Does time on a group plan count towards my own waiting periods?", answer: "Generally no. Group cover does not build your personal continuity or no-claim bonus, which is why holding your own policy in parallel matters." },
  { question: "When should I buy a personal policy if I have group cover?", answer: "While you are young and healthy, so its waiting periods are served before you need it, not after you have left the job and lost the group plan." },
];

export const artTopupContent = `
<div class="blog-article-content">
  <h2 id="intro">Top-up vs super top-up: which saves more?</h2>
  <p>Both let you raise your health cover ceiling affordably by sitting on top of a deductible. The difference is in how that deductible is applied across the year, and it changes which one actually pays out.</p>

  <h3 id="how-they-work">How each works</h3>
  <p>Both a top-up and a super top-up only pay once your bills cross a set threshold (the deductible), which your base policy or savings covers first.</p>
  <ul>
    <li><strong>Top-up:</strong> the deductible applies <em>per claim</em>. Each hospitalisation must individually exceed the threshold for the top-up to pay.</li>
    <li><strong>Super top-up:</strong> the deductible applies to your <em>total</em> claims in the year. Once your combined bills cross the threshold, it pays the rest, even across several smaller hospitalisations.</li>
  </ul>

  <h3 id="which-saves">Which saves more?</h3>
  <p>For most people, a <strong>super top-up</strong> is the better value: multiple moderate claims in a year can add up past the deductible and still be covered, whereas a plain top-up might pay nothing if no single claim is large enough. A top-up can be marginally cheaper, but the super top-up aggregate deductible usually wins on real-world protection.</p>

  <h3 id="example">Worked example (illustrative)</h3>
  <p>Say the deductible is 5 lakh and you have two hospitalisations of 3 lakh each in one year. A <strong>top-up</strong> pays nothing, since neither claim alone crosses 5 lakh. A <strong>super top-up</strong> sees 6 lakh total, crosses the threshold, and pays the 1 lakh above it.</p>

  <h3 id="use">How to use them</h3>
  <p>Pair a moderate base <a href="/learn/sum-insured">sum insured</a> (which absorbs the deductible) with a super top-up for a high overall ceiling at low premium, often the most cost-effective way to reach large cover.</p>
</div>`;

export const artTopupFAQs = [
  { question: "What is the difference between a top-up and super top-up?", answer: "A top-up applies its deductible per claim; a super top-up applies it to your total claims for the year. The super top-up therefore pays across several smaller hospitalisations that individually would not cross the threshold." },
  { question: "Which is better value, top-up or super top-up?", answer: "For most people a super top-up offers better real-world protection because its aggregate yearly deductible captures multiple claims. A plain top-up can be slightly cheaper but may pay nothing if no single claim is large enough." },
  { question: "Do I need a base policy for a top-up to work?", answer: "You need something to cover the deductible first, usually a base health policy or your own funds. The top-up or super top-up pays only above that threshold." },
  { question: "Is a base plus super top-up cheaper than one large policy?", answer: "Often yes. A moderate base plus a super top-up usually reaches a high overall ceiling for less premium than a single large sum insured." },
];
