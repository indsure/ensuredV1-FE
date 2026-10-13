// DRAFT blog posts (Phase 3, 13 Oct 2026). NOT PUBLISHED. See drafts-a.ts.
import type { DraftPost } from "./types";

export const DRAFTS_D: DraftPost[] = [
  {
    slug: "is-treatment-at-home-covered-by-health-insurance",
    title: "Is Treatment at Home Covered by Health Insurance?",
    excerpt: "Domiciliary hospitalisation and home care are two different benefits, with different rules and caps. What each pays, and which plans leave it out.",
    tags: ["Domiciliary", "Home care", "Coverage"],
    sheetRows: ["is treatment at home covered under health insurance in india", "what is domiciliary hospitalisation in health insurance", "do health insurance policies cover covid 19 home isolation"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Is treatment at home covered by health insurance?</h2>
  <p>Sometimes. Policies use two different benefits for treatment at home, and they work very differently.</p>

  <h3 id="domiciliary">1. Domiciliary hospitalisation</h3>
  <p><a href="/learn/domiciliary-hospitalisation">Domiciliary hospitalisation</a> pays for treatment at home that would normally need a hospital, when:</p>
  <ul>
    <li>the patient's condition does not allow moving them to hospital, or</li>
    <li>no hospital bed is available,</li>
  </ul>
  <p>and the treatment lasts more than 3 consecutive days.</p>
  <p><strong>The catch:</strong> wordings exclude a list of common long-term conditions from this benefit, such as asthma, bronchitis, diabetes, hypertension and epilepsy. Care Supreme lists 12 such conditions.</p>

  <h3 id="caps">Caps from real wordings</h3>
  <ul>
    <li>Care Supreme and ManipalCigna Sarvah Param: up to the sum insured.</li>
    <li><a href="/insurance/iffco-tokio-family-health-protector">IFFCO Tokio Family Health Protector</a>: up to 20% of the sum insured.</li>
    <li><a href="/insurance/care-freedom">Care Freedom</a>: up to 10% of the sum insured.</li>
    <li><a href="/insurance/oriental-youth-eco-care">Oriental Youth Eco Care</a>: 10% of the sum insured, up to ₹50,000, with the first 3 days as a deductible.</li>
  </ul>

  <h3 id="none">Plans that do not cover it</h3>
  <p>Some plans leave it out entirely. SBI Health Edge excludes domiciliary hospitalisation in so many words. HDFC ERGO Energy and Star Cancer Care Platinum have no such benefit.</p>

  <h3 id="homecare">2. Home care treatment</h3>
  <p>Home care is a newer benefit: doctor-led treatment at home for a listed set of conditions, as an alternative to admission. It needs a doctor's advice and daily monitoring.</p>
  <ul>
    <li>Star Young Star: up to 10% of the sum insured, maximum ₹5 lakh a year, for conditions such as fever, urinary infection, asthma, gastroenteritis and IV chemotherapy.</li>
    <li>Star Comprehensive: 10% of the sum insured, up to ₹5 lakh.</li>
    <li>Galaxy Marvel Neo: 10% of the sum insured or ₹5 lakh.</li>
  </ul>

  <h3 id="isolation">What about home isolation for an infection?</h3>
  <p>Only if your plan's home care list includes that condition, or the domiciliary rules are met. Check the list in your own wording; do not assume.</p>

  <h3 id="check">How to check</h3>
  <p>Search your wording for "domiciliary" and "home care". Note the cap, the 3-day rule and the excluded conditions. Or upload it to the <a href="/policychecker">policy checker</a>.</p>
</div>`,
    faqs: [
      { question: "What is domiciliary hospitalisation?", answer: "Treatment at home that would normally need a hospital, when the patient cannot be moved or no bed is available, lasting more than 3 days. Conditions such as asthma, diabetes and hypertension are usually excluded from it." },
      { question: "Is home treatment covered by health insurance?", answer: "In many plans, within limits. Caps range from the full sum insured (Care Supreme) to 10% of it (Care Freedom). Some plans, like SBI Health Edge, exclude it." },
      { question: "What is home care treatment?", answer: "A doctor-led alternative to admission for a listed set of conditions, such as fever or IV chemotherapy. Star Young Star covers it up to 10% of the sum insured, maximum ₹5 lakh a year." },
    ],
    sources: [
      "Care Supreme, CHIHLIP27061V032627 (domiciliary hospitalisation)",
      "ManipalCigna Sarvah Param, MCIHLIP26038V022526",
      "IFFCO Tokio Family Health Protector, IFFHLIP26042V062526",
      "Care Freedom, CHIHLIP26052V032526 (Benefit 6)",
      "Oriental Youth Eco Care, OICHLIP24034V012324",
      "SBI Health Edge, SBIHLIP23173V012223 (Specific Exclusion VIII)",
      "Star Young Star, SHAHLIP26043V062526; Star Comprehensive, SHAHLIP26044V092526 (home care)",
      "Galaxy Marvel Neo, GHIHLIP26042V012526 (home care)",
    ],
  },

  {
    slug: "health-insurance-with-diabetes-or-high-bp",
    title: "Health Insurance With Diabetes or High BP",
    excerpt: "You can be insured with diabetes or high blood pressure. Which waits apply, which plans cover them sooner, and what loading or co-pay to expect.",
    tags: ["Diabetes", "Hypertension", "Pre-existing"],
    sheetRows: ["does health insurance cover diabetes in india", "does health insurance cover chronic diseases", "why health insurance necessary for thyroid patients", "is there any health insurance plan for arthritis patient", "is dialysis covered by insurance"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Health insurance with diabetes or high BP</h2>
  <p>Yes, you can get health insurance with diabetes or high blood pressure. Declare it honestly, and know which waits and costs will apply.</p>

  <h3 id="ped">They are pre-existing diseases</h3>
  <p>If you have been diagnosed or treated in the 36 months before buying, diabetes and BP are <a href="/learn/pre-existing-disease-waiting-period">pre-existing diseases</a>. Claims linked to them wait for the PED waiting period. Of the 319 plan wordings we have audited, 214 wait 36 months, 50 wait 24 months and 35 wait 12 months. A few older wordings still say 48. The same applies to thyroid disorders, arthritis and other long-term conditions.</p>
  <p>Illnesses that have nothing to do with your condition are covered after the usual 30-day wait.</p>

  <h3 id="energy">A plan built for it</h3>
  <p><a href="/insurance/hdfc-ergo-energy">HDFC ERGO Energy</a> covers type 1 and type 2 diabetes, pre-diabetes (IFG and IGT) and hypertension with no pre-existing wait. Other pre-existing conditions wait 24 months. It also pays for an HbA1C test, up to ₹750 a time, twice a year.</p>

  <h3 id="instant">Day-31 options</h3>
  <ul>
    <li><a href="/insurance/care-supreme">Care Supreme</a>'s optional Instant Cover: diabetes, hypertension, high cholesterol and asthma covered from day 31.</li>
    <li>Galaxy Marvel Neo's Insta Care: the same four conditions from day 31. It can only be chosen when you first buy.</li>
  </ul>
  <p>Both cost extra. If you do not have these conditions yet, note that Oriental Youth Eco Care puts hypertension and diabetes on a 90-day wait.</p>

  <h3 id="loading">Loading and co-pay</h3>
  <p>At purchase, the insurer may add a premium loading, a co-pay, or a specific condition. Some wordings cap the loading; Narayana Arya caps it at 50%. A loading set at purchase applies to the condition you declared, not to claims you make later.</p>

  <h3 id="dialysis">Dialysis and long-term treatment</h3>
  <p>Dialysis is usually paid as a <a href="/learn/day-care-procedures">day care procedure</a>, so you do not need a 24-hour stay. Check for a per-sitting cap: Care Freedom, for example, caps dialysis per sitting. Also note that domiciliary (home) treatment usually excludes diabetes and hypertension.</p>

  <h3 id="tips">Tips</h3>
  <ul>
    <li>Declare the condition and your medicines. Hiding it risks the claim that matters most.</li>
    <li>Keep recent reports (HbA1C, BP readings) ready for the proposal.</li>
    <li>Compare the total cost: premium plus loading, and any co-pay on claims.</li>
  </ul>
</div>`,
    faqs: [
      { question: "Does health insurance cover diabetes?", answer: "Yes, after the pre-existing disease waiting period if you already have it, usually 12 to 36 months. Some plans and add-ons cover it sooner, such as HDFC ERGO Energy with no PED wait for diabetes and BP." },
      { question: "Can I get health insurance with high blood pressure?", answer: "Yes. Declare it. You may face a waiting period, a premium loading or a co-pay. Care Supreme's Instant Cover add-on covers hypertension from day 31." },
      { question: "Is dialysis covered by health insurance?", answer: "Usually yes, as a day care procedure, subject to any per-sitting cap and the pre-existing wait if kidney disease existed before you bought the policy." },
    ],
    sources: [
      "HDFC ERGO Energy, HDFHLIP26048V052526",
      "Care Supreme, CHIHLIP27061V032627 (Instant Cover)",
      "Galaxy Marvel Neo, GHIHLIP26042V012526 (21. Insta Care Cover from 31st Day)",
      "Oriental Youth Eco Care, OICHLIP24034V012324 (90-day wait for hypertension and diabetes)",
      "Narayana Arya, NHIHLIP26043V012526 (2.1.31 PED definition, 13.3 loading)",
      "Care Freedom, CHIHLIP26052V032526 (dialysis per sitting)",
      "IndSure catalogue audit of 319 plan wordings, Oct 2026 (PED wait counts)",
    ],
  },

  {
    slug: "is-cancer-covered-by-health-insurance",
    title: "Is Cancer Covered by Health Insurance?",
    excerpt: "A new cancer is usually covered after the 30-day wait, but some plans put it on a waiting list. Treatment limits, restoration, and options for survivors.",
    tags: ["Cancer", "Waiting period", "Critical illness"],
    sheetRows: ["is cancer covered in health insurance", "is cancer covered in normal health insurance policy", "is cancer surgery payable in 1st year of policy", "can health insurance save you from cancer expenses", "health insurance for someone treated for cancer years ago"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Is cancer covered by health insurance?</h2>
  <p>Yes, in a normal health policy, for a cancer first diagnosed after you buy. The details decide how much is paid and when.</p>

  <h3 id="first-year">Is cancer covered in the first year?</h3>
  <p>In many plans, yes, after the 30-day initial wait. Niva Bupa's wordings, for example, cover cancer after the 30 days. But check the listed-illness waits in your plan: some include cancer.</p>
  <ul>
    <li><a href="/insurance/care-freedom">Care Freedom</a> lists cancer on its 24-month waiting list.</li>
    <li><a href="/insurance/iffco-tokio-family-health-protector">IFFCO Tokio Family Health Protector</a> lists carcinoma on its 12-month list.</li>
  </ul>

  <h3 id="treatment">Chemo, radiotherapy and newer treatments</h3>
  <ul>
    <li>Chemotherapy and radiotherapy are usually paid as <a href="/learn/day-care-procedures">day care procedures</a>, without a 24-hour stay.</li>
    <li>Newer treatments, such as oral chemotherapy and monoclonal antibodies, are often sub-limited. Star Comprehensive links these limits to the sum insured.</li>
    <li>Some home care benefits include IV chemotherapy at home, such as Star Young Star's.</li>
  </ul>

  <h3 id="restoration">Long treatment and restoration</h3>
  <p>Cancer treatment can use up a sum insured. A <a href="/learn/restoration-benefit">restoration benefit</a> refills it after a claim. Check whether the refill can be used for the same illness: some wordings allow it, others only for a different illness. <a href="/insurance/niva-bupa-reassure-2">Niva Bupa ReAssure 2.0</a> is one plan to compare on this.</p>

  <h3 id="survivors">If you were treated for cancer before</h3>
  <p>Declare it. A past cancer is a pre-existing disease, and many insurers will decline or exclude it. Cancer-specific plans exist: Star Cancer Care Platinum is designed for people diagnosed with cancer. Its pre-existing wait is 30 months, including for cancer, and an optional lump-sum benefit pays 50% of the sum insured for recurrence, spread or a second cancer, after a 30-month wait.</p>

  <h3 id="ci">A lump sum alongside</h3>
  <p>A health policy pays bills. <a href="/learn/critical-illness-cover">Critical illness cover</a> pays a fixed amount on diagnosis, which helps with income loss and travel during long treatment. Note that early-stage cancers are often outside its definition. See <a href="/blog/critical-illness-cover-vs-health-insurance">critical illness cover vs health insurance</a>.</p>
</div>`,
    faqs: [
      { question: "Is cancer covered in a normal health insurance policy?", answer: "Yes, for a cancer first diagnosed after you buy, usually after the 30-day initial wait. Some plans put cancer on a listed-illness wait, such as Care Freedom (24 months)." },
      { question: "Is cancer surgery paid in the first year?", answer: "In many plans, yes, after the first 30 days. Check your plan's listed-illness waiting list to see whether cancer is on it." },
      { question: "Can a cancer survivor buy health insurance?", answer: "It is harder. Declare the history. Cancer-specific plans such as Star Cancer Care Platinum are designed for people diagnosed with cancer, with a 30-month pre-existing wait." },
    ],
    sources: [
      "Niva Bupa ReAssure 2.0, NBHHLIP27054V032627 (initial waiting period)",
      "Care Freedom, CHIHLIP26052V032526 (24-month listed illnesses)",
      "IFFCO Tokio Family Health Protector, IFFHLIP26042V062526 (12-month list)",
      "Star Comprehensive, SHAHLIP26044V092526 (modern treatment sub-limits)",
      "Star Young Star, SHAHLIP26043V062526 (home care)",
      "Star Cancer Care Platinum, SHAHLIP22031V022122",
    ],
  },

  {
    slug: "add-ons-vs-riders-in-health-insurance",
    title: "Add-ons vs Riders in Health Insurance",
    excerpt: "Add-on, rider, optional cover: the names vary by insurer. What matters is what each one changes in a claim, and whether it is worth the price.",
    tags: ["Add-ons", "Riders", "Buying guide"],
    sheetRows: ["difference between add ons and riders in health insurance", "difference between riders and add on covers", "is it advisable to buy add ons like dengue cover"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Add-ons vs riders in health insurance</h2>
  <p>"Add-on", "rider" and "optional cover" all mean extra cover you choose and pay for on top of the base policy. Insurers use the names differently. Care Supreme calls them optional benefits, Galaxy calls them optional covers, and some wordings define a rider as a separate insurance contract chosen alongside the policy. See our <a href="/learn/rider-add-on-cover">glossary entry</a>.</p>
  <p>Do not get stuck on the name. Ask three questions instead:</p>
  <ul>
    <li>Does it change what the base policy pays on a hospital claim?</li>
    <li>Does it have its own sum insured, waiting period and exclusions?</li>
    <li>Can it be added or removed at renewal, or only when you first buy?</li>
  </ul>

  <h3 id="matter">Add-ons that change claims</h3>
  <ul>
    <li><strong>Room rent waiver or modification:</strong> removes or changes the room limit, which can cut the whole bill in proportion.</li>
    <li><strong>Consumables cover:</strong> pays for <a href="/learn/consumables-non-payable">non-payable items</a> like gloves and PPE. Care Supreme's version is called Claim Shield.</li>
    <li><strong>PED wait reduction:</strong> cuts the pre-existing wait, for example from 36 to 12 months on Star Comprehensive.</li>
    <li><strong>Instant cover for chronic conditions:</strong> covers diabetes, BP, cholesterol and asthma from day 31 (Care Supreme, Galaxy Marvel Neo).</li>
  </ul>

  <h3 id="timing">Many can only be added at the start</h3>
  <p>Some add-ons can only be chosen when you first buy. Star Comprehensive's PED buy-back and Galaxy Marvel Neo's Insta Care are examples. Others cannot be removed once added: SBI Health Edge's co-payment option stays at renewal.</p>

  <h3 id="rarely">Add-ons that rarely matter</h3>
  <ul>
    <li>Disease-specific covers, such as dengue or vector-borne cover, when your base policy already covers hospitalisation for these illnesses.</li>
    <li>Small daily hospital cash amounts that do not change what you pay.</li>
    <li>Wellness add-ons, if you will not use them.</li>
  </ul>

  <h3 id="price">Read the price against the payout</h3>
  <p>For each add-on, compare the yearly price with what it would actually pay on a likely claim. A consumables cover that adds a little premium and pays several thousand rupees on every admission is usually good value. A cover that duplicates your base policy is not.</p>
</div>`,
    faqs: [
      { question: "What is the difference between an add-on and a rider?", answer: "Both are extra cover you buy on top of a base policy. Insurers use the names differently. What matters is what it pays, its own limits and waits, and whether it can be changed later." },
      { question: "Which health insurance add-ons are worth buying?", answer: "Ones that change claims: room rent waiver, consumables cover, and a pre-existing wait reduction if you have a condition. Check that the price is worth what it would pay." },
      { question: "Should I buy dengue cover?", answer: "If your base policy already covers hospital treatment for dengue, a separate dengue cover often adds little. Check what it pays beyond your base policy." },
    ],
    sources: [
      "Care Supreme, CHIHLIP27061V032627 (optional benefits incl. Claim Shield, Instant Cover)",
      "SBI Surrogacy and Oocyte Donor Suraksha, SBIHLIA24100V012324 (definition of rider)",
      "Star Comprehensive, SHAHLIP26044V092526 (Buy Back of PED, first purchase only)",
      "Galaxy Marvel Neo, GHIHLIP26042V012526 (Insta Care, not at renewal)",
      "SBI Health Edge, SBIHLIP23173V012223 (D.15 co-payment cannot be removed)",
    ],
  },

  {
    slug: "what-is-tpa-in-health-insurance",
    title: "What Is a TPA in Health Insurance?",
    excerpt: "A TPA is a company your insurer hires to handle claims and cashless approvals. The insurer stays responsible for your claim. How to find yours and when it matters.",
    tags: ["TPA", "Claims", "Basics"],
    sheetRows: ["what is tpa", "difference between tpa or non tpa health insurance policy", "md india health insurance benefit claim process explained"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">What is a TPA in health insurance?</h2>
  <p>A TPA (Third Party Administrator) is a company registered with IRDAI and engaged by an insurer, for a fee, to provide health services. That is close to the wording's own definition. In practice it often handles your cashless approvals and claims for the insurer.</p>

  <h3 id="does">What a TPA does</h3>
  <ul>
    <li>Issues your health card.</li>
    <li>Handles cashless requests from <a href="/learn/network-hospital-tpa">network hospitals</a>.</li>
    <li>Receives and processes reimbursement claims.</li>
    <li>Runs a helpline for claim questions.</li>
  </ul>

  <h3 id="inhouse">In-house vs TPA</h3>
  <p>Some insurers process claims themselves (in-house). Others use a TPA, and some use both, depending on the product or the region. You do not choose this; the insurer does. Wordings refer to "the Company/TPA" when they describe where to send claim notices.</p>

  <h3 id="who">Who is responsible for your claim?</h3>
  <p>The insurer. Your contract is with the insurer, and the policy wording sets the insurer's duties: it "shall settle or reject a claim" within the stated time, and pays interest if it is late. A TPA works for the insurer. If you are unhappy with a decision, complain to the insurer, then its grievance officer. See <a href="/blog/how-to-complain-about-health-insurer">how to complain about your health insurer</a>.</p>

  <h3 id="find">Finding your TPA</h3>
  <ul>
    <li>Your health card or e-card shows the TPA's name and helpline.</li>
    <li>Your policy schedule or welcome email usually names it.</li>
    <li>The insurer's website lists the TPAs it works with.</li>
  </ul>

  <h3 id="matter">Does TPA vs non-TPA matter?</h3>
  <p>Less than the policy terms. The wording decides what is paid. What can differ is service: how fast cashless approvals come back and how easy the helpline is. Current wordings set limits, such as a decision on a cashless request within one hour and final approval within three hours of the discharge request (Narayana Arya), and these apply however the insurer handles the claim.</p>

  <h3 id="tips">Tips</h3>
  <ul>
    <li>Save the TPA helpline and your card number in your phone.</li>
    <li>For a <a href="/learn/cashless-claim">cashless claim</a>, ask the hospital's insurance desk which TPA they deal with for your insurer.</li>
    <li>Keep copies of everything you send to the TPA.</li>
  </ul>
</div>`,
    faqs: [
      { question: "What is a TPA in health insurance?", answer: "A Third Party Administrator: a company registered with IRDAI and engaged by an insurer to provide health services, such as cashless approvals and claim processing." },
      { question: "Does the TPA decide my claim?", answer: "Your contract is with the insurer, and the policy wording makes the insurer responsible for settling or rejecting the claim. Complain to the insurer if you disagree." },
      { question: "How do I find my TPA?", answer: "Look at your health card or e-card, your policy schedule or welcome email, or the insurer's website." },
      { question: "Is a TPA or non-TPA policy better?", answer: "The policy terms matter more. The difference is mostly service speed. Current wordings set cashless timelines that apply either way." },
    ],
    sources: [
      "Aditya Birla Activ Health, ADIHLIP26042V062526 (definition of Third Party Administrator)",
      "Narayana Arya, NHIHLIP26043V012526 (2.1.28 Network Provider, 2.1.29 Notification of Claim, cashless turnaround times, 11 claim settlement)",
    ],
  },
];
