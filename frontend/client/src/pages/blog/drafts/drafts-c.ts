// DRAFT blog posts (Phase 3, 13 Oct 2026). NOT PUBLISHED. See drafts-a.ts.
import type { DraftPost } from "./types";

export const DRAFTS_C: DraftPost[] = [
  {
    slug: "health-insurance-with-no-waiting-period",
    title: "Health Insurance With No Waiting Period: Options",
    excerpt: "Almost every policy has waits. A few plans shorten them by design, and add-ons can cut the pre-existing disease wait. Real options from filed wordings.",
    tags: ["Waiting period", "Pre-existing", "Portability"],
    sheetRows: ["are there health insurance plans with no waiting period", "can pre existing diseases be covered from day one in group health insurance", "how long is the waiting period for kidney stones in india", "what is the waiting period in health insurance"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Health insurance with no waiting period: what are your options?</h2>
  <p>Most health policies make you wait before some claims are paid. You cannot wish the waits away, but you can shorten them. Here is how they work and the real ways to cut them.</p>

  <h3 id="three">The three waits</h3>
  <ul>
    <li><strong><a href="/learn/initial-waiting-period">Initial wait</a>:</strong> usually 30 days from the first policy, for any illness. Accidents are covered from day 1.</li>
    <li><strong><a href="/learn/disease-specific-waiting-period">Listed illnesses</a>:</strong> usually 24 months for conditions like cataract, hernia, joint replacement and kidney stones.</li>
    <li><strong><a href="/learn/pre-existing-disease-waiting-period">Pre-existing diseases</a>:</strong> conditions you had before buying. Of the 319 plan wordings we have audited, 214 wait 36 months, 50 wait 24 months and 35 wait 12 months. A few older wordings still say 48 months.</li>
  </ul>
  <p>For kidney stones, the listed-illness wait is 24 months in plans like Star Comprehensive and Care Supreme, and 12 months in Star Young Star.</p>

  <h3 id="design">Plans with short waits by design</h3>
  <ul>
    <li><a href="/insurance/star-young-star">Star Young Star</a>: 12 months for pre-existing diseases and 12 months for listed illnesses.</li>
    <li>ManipalCigna Sarvah Param: no initial, listed-illness or pre-existing wait on the base plan. If you choose the optional Pratiksha cover for a lower premium, the usual waits apply (30 days, 24 months and up to 36 months). Underwriting can still add a personal wait.</li>
  </ul>

  <h3 id="buyback">Add-ons that cut the pre-existing wait</h3>
  <ul>
    <li>Star Comprehensive: Buy Back of PED Waiting Period cuts 36 months to 12. It can only be chosen when you first buy.</li>
    <li><a href="/insurance/hdfc-ergo-optima-secure">HDFC ERGO Optima Secure</a>: 36 months, or 12 or 24 months with the optional cover.</li>
    <li>Galaxy Marvel Neo: 36 months, or 24 or 12 with an optional cover chosen at the start. Another option cuts the listed-illness wait from 24 to 12 months.</li>
  </ul>

  <h3 id="instant">Day-31 cover for diabetes, BP and asthma</h3>
  <p><a href="/insurance/care-supreme">Care Supreme</a>'s optional Instant Cover covers diabetes, hypertension, high cholesterol and asthma from day 31. Galaxy Marvel Neo's Insta Care does the same for these four conditions. Both cost extra premium.</p>

  <h3 id="group">Employer cover</h3>
  <p>Many company group policies waive these waits for employees. Check your own group policy or ask HR, because the terms differ from one employer to the next. Remember that group cover ends when you leave the job.</p>

  <h3 id="port">Porting keeps the wait you have served</h3>
  <p>If you <a href="/learn/health-insurance-portability">port</a> to a new insurer, the time you have already served counts towards its waits, up to your old sum insured. Apply before your renewal date: SBI Health Edge asks for at least 30 days before, and Oriental Youth Eco Care asks for 45.</p>
</div>`,
    faqs: [
      { question: "Is there any health insurance with no waiting period?", answer: "A few. ManipalCigna Sarvah Param has no initial, listed-illness or pre-existing wait on its base plan, unless you choose the optional Pratiksha cover for a lower premium. Most plans have all three waits." },
      { question: "Can pre-existing diseases be covered from day one?", answer: "Rarely on a retail plan. Add-ons can shorten the wait to 12 months, and Care Supreme's Instant Cover covers diabetes, hypertension, high cholesterol and asthma from day 31. Many employer group policies waive the wait." },
      { question: "What is the waiting period for kidney stones?", answer: "Usually 24 months as a listed illness, as in Star Comprehensive and Care Supreme. Star Young Star waits 12 months." },
      { question: "Does porting reset the waiting period?", answer: "No. The time you have served carries over to the new insurer, up to your old sum insured." },
    ],
    sources: [
      "Star Young Star, SHAHLIP26043V062526",
      "ManipalCigna Sarvah Param, MCIHLIP26038V022526 (Pratiksha optional cover)",
      "Star Comprehensive, SHAHLIP26044V092526 (Buy Back of PED Waiting Period)",
      "HDFC ERGO Optima Secure, HDFHLIP26058V082526",
      "Galaxy Marvel Neo, GHIHLIP26042V012526 (Insta Care, waiting period modification)",
      "Care Supreme, CHIHLIP27061V032627 (Instant Cover)",
      "SBI Health Edge, SBIHLIP23173V012223 (portability)",
      "Oriental Youth Eco Care, OICHLIP24034V012324 (portability)",
      "IndSure catalogue audit of 319 plan wordings, Oct 2026 (PED wait counts)",
    ],
  },

  {
    slug: "critical-illness-cover-vs-health-insurance",
    title: "Critical Illness Cover vs Health Insurance",
    excerpt: "Health insurance pays your hospital bills. Critical illness cover pays a fixed lump sum when a listed illness is diagnosed. They solve different problems.",
    tags: ["Critical illness", "Lump sum", "Basics"],
    sheetRows: ["health insurance vs critical illness cover", "do i need health insurance and critical illness insurance both", "is critical illness insurance worth it", "cancer insurance vs critical illness plan", "should you buy a critical illness insurance plan", "why critical illness insurance claim may be denied"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Critical illness cover vs health insurance</h2>
  <p>They sound similar but pay in different ways. Health insurance repays hospital bills. <a href="/learn/critical-illness-cover">Critical illness cover</a> pays a fixed amount when you are diagnosed with an illness on its list, whatever your bills are.</p>

  <h3 id="example">One example</h3>
  <p>Say you have a ₹10 lakh health policy and a ₹10 lakh critical illness cover, and you have a heart attack that meets the policy definition. The hospital bill is ₹4 lakh.</p>
  <ul>
    <li>The health policy pays the admissible part of the ₹4 lakh bill.</li>
    <li>The critical illness cover pays ₹10 lakh to you, as one lump sum, once the claim is accepted.</li>
  </ul>

  <h3 id="lumpsum">What the lump sum is for</h3>
  <p>Costs a health policy does not pay: lost income while you recover, travel to a bigger city for treatment, home nursing, loan instalments. You can spend it however you want.</p>

  <h3 id="survival">Survival period and the named list</h3>
  <p>Critical illness covers pay only for illnesses on their list, and only if you live a set number of days after diagnosis. This survival period differs widely: HDFC ERGO's my:health Critical Illness add-on asks for at least 7 days, ABHI Activ One's critical illness cover 15 days, and New India Criti Protect has none ("NIL").</p>

  <h3 id="denied">Why critical illness claims get denied</h3>
  <ul>
    <li><strong>The definition is not met.</strong> Each illness has a strict definition. Early stages are often left out; for example, wordings exclude chronic lymphocytic leukaemia below RAI stage 3 from the cancer definition.</li>
    <li><strong>Timing.</strong> Some definitions need the effect to last, such as a stroke deficit assessed at least 30 days after it starts.</li>
    <li><strong>Survival period.</strong> Death within the survival period means no payout.</li>
    <li><strong>Waiting period.</strong> Critical illness covers have their own initial wait, often longer than 30 days (Activ One's is 60 days).</li>
    <li><strong>Non-disclosure</strong> of a past condition.</li>
  </ul>

  <h3 id="addon">Add-on or separate policy</h3>
  <p>An add-on on your health policy is simple and often cheaper, but ends if you drop or change that policy. A separate policy stays with you whatever happens to your health cover.</p>

  <h3 id="both">Who might need both</h3>
  <ul>
    <li>The only earner, or someone with large loans.</li>
    <li>People with a family history of heart disease or cancer.</li>
    <li>Self-employed people with no paid sick leave.</li>
  </ul>
  <p>Critical illness cover does not replace health insurance. Buy enough health cover first, then add a lump sum if losing your income would hurt.</p>
</div>`,
    faqs: [
      { question: "What is the difference between health insurance and critical illness cover?", answer: "Health insurance repays hospital bills. Critical illness cover pays a fixed lump sum when a listed illness is diagnosed and the definition is met, whatever the bills are." },
      { question: "Do I need both?", answer: "Health insurance comes first. Add critical illness cover if losing income during a long illness would hurt your family, for example if you are the only earner." },
      { question: "What is the survival period?", answer: "The number of days you must live after diagnosis for the claim to pay. It varies: 7 days in HDFC ERGO's my:health Critical Illness add-on, 15 days in ABHI Activ One, none in New India Criti Protect." },
      { question: "Why are critical illness claims rejected?", answer: "Most often the illness does not meet the policy's strict definition, for example an early-stage cancer. Waiting periods, survival periods and non-disclosure are other reasons." },
    ],
    sources: [
      "HDFC ERGO my:health Critical Illness endorsement (Survival Period, illness definitions)",
      "Aditya Birla Activ One, ADIHLIP24097V012324 (Critical Illness Cover: 60-day wait, 15-day survival)",
      "New India Criti Protect, NIAHLIP25038V022425 (NIL survival period)",
    ],
  },

  {
    slug: "how-to-complain-about-health-insurer",
    title: "How to Complain About Your Health Insurer",
    excerpt: "Claim rejected or stuck? The escalation ladder, in order: the insurer, its grievance officer, IRDAI's Bima Bharosa portal, the Insurance Ombudsman, and consumer court.",
    tags: ["Complaints", "Claims", "Ombudsman"],
    sheetRows: ["how to file a complaint against your health insurer", "how to lodge a health insurance complaint", "how to appeal for a rejected health insurance", "what to do if your health insurance claim is denied", "claim repudiated vs claim rejected"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">How to complain about your health insurer</h2>
  <p>If a claim is rejected, cut or delayed, you have a clear set of steps. Each step needs the one before it, so start at the bottom and keep everything in writing.</p>

  <h3 id="letter">First, read the letter</h3>
  <p>Insurers use the words "rejected" and "repudiated" loosely. What matters is the reason given and the clause it quotes. Ask for the reason in writing if the letter does not give one. Then check that clause in your own <a href="/policychecker">policy wording</a>: many rejections quote a waiting period or an exclusion that does not actually apply.</p>

  <h3 id="step1">Step 1: the insurer, in writing</h3>
  <p>Write to customer support with your policy number, claim number, what you want, and why. Attach the documents. Keep the complaint reference number.</p>

  <h3 id="step2">Step 2: the grievance officer</h3>
  <p>Every insurer has a grievance team and a Grievance Redressal Officer, named in your policy wording. Narayana Arya, for example, lists four steps: customer support, the grievance email, the Grievance Redressal Officer, then IRDAI's portal or the Ombudsman.</p>

  <h3 id="step3">Step 3: Bima Bharosa</h3>
  <p>If the insurer does not resolve it, register the complaint on IRDAI's Bima Bharosa portal at bimabharosa.irdai.gov.in. Your complaint is tracked there with the insurer.</p>

  <h3 id="step4">Step 4: the Insurance Ombudsman</h3>
  <p>The Insurance Ombudsman is free and you do not need a lawyer. According to the Council for Insurance Ombudsmen, you can go to the Ombudsman if:</p>
  <ul>
    <li>you complained to the insurer first, and</li>
    <li>it rejected the complaint, did not reply within one month, or you are not happy with its reply, and</li>
    <li>you file within one year of the insurer's reply.</li>
  </ul>
  <p>There is a limit on the claim value the Ombudsman can decide. Check the current limit at cioins.co.in before you file. Your policy wording also lists the Ombudsman offices.</p>

  <h3 id="step5">Step 5: consumer court</h3>
  <p>You can also go to a consumer commission. It takes longer and you may want legal help.</p>

  <h3 id="keep">What to keep</h3>
  <ul>
    <li>The policy wording and schedule, for the year of the claim.</li>
    <li>The claim form, all letters and emails, and complaint reference numbers.</li>
    <li>Hospital bills, the discharge summary and test reports.</li>
    <li>The settlement or rejection letter, with the clause quoted.</li>
  </ul>
</div>`,
    faqs: [
      { question: "How do I complain against my health insurer?", answer: "Write to the insurer first, then its Grievance Redressal Officer. If unresolved, use IRDAI's Bima Bharosa portal or go to the Insurance Ombudsman, which is free." },
      { question: "When can I go to the Insurance Ombudsman?", answer: "After complaining to the insurer, if it rejected your complaint, did not reply within one month, or you are not happy with the reply. File within one year of the insurer's reply." },
      { question: "What is the difference between a rejected and a repudiated claim?", answer: "Insurers use the words loosely. What matters is the reason and the clause quoted in the letter. Check that clause in your policy wording." },
      { question: "Does the Ombudsman charge a fee?", answer: "No. Filing a complaint with the Insurance Ombudsman is free, and you do not need a lawyer." },
    ],
    sources: [
      "Narayana Arya, NHIHLIP26043V012526 (13.24 Redressal of Grievance)",
      "Council for Insurance Ombudsmen, cioins.co.in (when to approach the Ombudsman)",
      "IRDAI Bima Bharosa portal, bimabharosa.irdai.gov.in",
    ],
  },

  {
    slug: "how-to-file-reimbursement-health-claim",
    title: "How to File a Reimbursement Health Claim",
    excerpt: "Treated at a non-network hospital, or paid yourself? When to tell the insurer, the documents to send, the deadlines, and how to claim the balance from a second policy.",
    tags: ["Claims", "Reimbursement", "Documents"],
    sheetRows: ["how to file a reimbursement claim under health insurance", "how to claim health insurance after discharge", "how to claim health insurance", "how to claim disallowed amounts in health insurance with another policy"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">How to file a reimbursement health claim</h2>
  <p>In a <a href="/learn/reimbursement-claim">reimbursement claim</a>, you pay the hospital and the insurer pays you back. You need it at a non-network hospital, when cashless is not approved, and for bills before and after the hospital stay. The steps below use the timelines in Narayana Arya's wording. Most current wordings are similar, but check your own.</p>

  <h3 id="tell">1. Tell the insurer in time</h3>
  <ul>
    <li>Emergency: within 24 hours of admission, or before discharge, whichever is earlier.</li>
    <li>Planned: at least 48 hours before admission.</li>
  </ul>
  <p>Some plans charge a co-pay for late notice at certain hospitals, so do not skip this step.</p>

  <h3 id="documents">2. Collect the documents</h3>
  <ul>
    <li>Completed claim form and the patient's photo ID.</li>
    <li>The doctor's prescription advising admission.</li>
    <li>Original bills with an itemised break-up, and payment receipts.</li>
    <li>Discharge summary with the full medical history.</li>
    <li>Test reports, with the doctor's prescription for them.</li>
    <li>OT notes or the surgeon's certificate, for surgery.</li>
    <li>Implant stickers or invoices, if any.</li>
    <li>MLC and FIR copies, for accidents where they exist.</li>
    <li>Bank details and a cancelled cheque.</li>
    <li>KYC of the proposer, for claims above ₹1 lakh.</li>
  </ul>
  <p>Bills must be in the patient's name. Ask the hospital for itemised bills before you leave; a single total is the most common cause of delay.</p>

  <h3 id="deadline">3. Submit before the deadline</h3>
  <ul>
    <li>Hospital stay and pre-hospital bills: within 30 days of discharge.</li>
    <li>Post-hospital bills: within 15 days of finishing post-hospital treatment.</li>
  </ul>
  <p>A delay can be accepted if it was for reasons beyond your control, but do not rely on that.</p>

  <h3 id="settle">4. How long the insurer has</h3>
  <p>Narayana Arya must settle or reject within 15 days of the last document; some older wordings say 30 days. If the insurer investigates, it must finish within 30 days and settle within 45. For a late payment, it pays interest at 2% above the bank rate.</p>

  <h3 id="second">5. Claim the balance from a second policy</h3>
  <p>If you have two policies, say a company policy and your own, the standard Multiple Policies clause lets you:</p>
  <ul>
    <li>choose which policy to claim from first;</li>
    <li>claim the amount disallowed by one policy from the other;</li>
    <li>claim the balance from the second insurer when a bill is more than one policy's sum insured.</li>
  </ul>
  <p>Send the second insurer copies of the documents along with the first insurer's settlement letter, certified by the first insurer.</p>

  <h3 id="letter">6. Read the settlement letter</h3>
  <p>Check each deduction against your policy: <a href="/learn/consumables-non-payable">non-payable items</a>, room rent limits, co-pays and sub-limits. If a deduction does not match the wording, ask in writing for the clause. See <a href="/blog/how-to-complain-about-health-insurer">how to complain</a>.</p>
</div>`,
    faqs: [
      { question: "How do I claim health insurance after discharge?", answer: "File a reimbursement claim. Send the claim form, bills, discharge summary and reports, usually within 30 days of discharge. Post-hospital bills usually go within 15 days of finishing that treatment." },
      { question: "How long does a reimbursement claim take?", answer: "Current wordings such as Narayana Arya require settlement within 15 days of the last document, or 45 days if investigated. Some older wordings say 30 days." },
      { question: "Can I claim the disallowed amount from another policy?", answer: "Yes. The standard Multiple Policies clause lets you claim amounts disallowed by one policy, or the balance above its sum insured, from your other policy." },
    ],
    sources: [
      "Narayana Arya, NHIHLIP26043V012526 (10.5 reimbursement procedure, notification, documents; 11 claim settlement; 13.9 Multiple Policies)",
    ],
  },

  {
    slug: "opd-vs-ipd-health-insurance",
    title: "OPD vs IPD: Is OPD Cover Worth It?",
    excerpt: "Base health plans pay for hospital stays, not doctor visits. How OPD covers work, why they are capped, and when one pays for itself.",
    tags: ["OPD", "Basics", "Add-ons"],
    sheetRows: ["difference between opd and ipd", "ipd vs opd", "how opd in health insurance can help you save money", "which is best out patient health insurance"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">OPD vs IPD: is OPD cover worth it?</h2>

  <h3 id="difference">The difference</h3>
  <ul>
    <li><strong>IPD (in-patient):</strong> you are admitted. Wordings define hospitalisation as at least 24 consecutive hours, except listed <a href="/learn/day-care-procedures">day care procedures</a> that take less time.</li>
    <li><strong>OPD (out-patient):</strong> everything else, such as doctor visits, tests you get without admission, and medicines from the chemist.</li>
  </ul>

  <h3 id="base">Most base plans pay IPD only</h3>
  <p>OPD treatment is a standard exclusion in most base policies, including Care Supreme, HDFC ERGO Energy and ManipalCigna Sarvah Param. Bills before and after a hospital stay are a different thing: they are paid as pre and post-hospitalisation expenses, linked to the admission.</p>

  <h3 id="how">How OPD cover works</h3>
  <p><a href="/learn/opd-cover">OPD cover</a> usually comes as an add-on with a yearly limit, and often a co-pay:</p>
  <ul>
    <li><a href="/insurance/sbi-general-health-edge">SBI Health Edge</a>'s optional OPD cover has a co-pay of 50% on doctors' fees and 30% on tests and pharmacy.</li>
    <li>Galaxy Marvel Neo's OPD Benefit has a 20% co-pay on reimbursement claims.</li>
    <li>Care Freedom's Good Health+ option covers OPD consultations and gives pharmacy discounts.</li>
  </ul>

  <h3 id="worth">When it pays for itself</h3>
  <p>Do the sum. Add up last year's OPD spend that the cover would pay. Subtract the co-pay. Compare that with the extra premium.</p>
  <ul>
    <li><strong>Often worth it:</strong> regular specialist visits, frequent tests, or young children who see the doctor often.</li>
    <li><strong>Often not:</strong> healthy adults with a few visits a year. The extra premium can be more than the cover pays after co-pay.</li>
  </ul>
  <p>Never cut your hospital cover to pay for OPD cover. A hospital stay is the expense that can wipe out savings; doctor visits rarely are.</p>
</div>`,
    faqs: [
      { question: "What is the difference between OPD and IPD?", answer: "IPD means you are admitted, usually for at least 24 hours or for a listed day care procedure. OPD covers doctor visits, tests and medicines without admission." },
      { question: "Does health insurance cover OPD?", answer: "Most base plans do not. OPD cover is usually an add-on with a yearly limit and often a co-pay." },
      { question: "Is OPD cover worth buying?", answer: "Only if your yearly OPD spend, after the co-pay, is more than the extra premium. It often helps families with young children or people with regular specialist visits." },
    ],
    sources: [
      "Narayana Arya, NHIHLIP26043V012526 (2.1.17 hospitalisation definition)",
      "SBI Health Edge, SBIHLIP23173V012223 (D.9 OPD cover co-payment)",
      "Galaxy Marvel Neo, GHIHLIP26042V012526 (OPD Benefit)",
      "Care Freedom, CHIHLIP26052V032526 (Good Health+)",
      "Care Supreme, CHIHLIP27061V032627; HDFC ERGO Energy, HDFHLIP26048V052526; ManipalCigna Sarvah Param, MCIHLIP26038V022526 (OPD excluded)",
    ],
  },
];
