// Phase 3 guides (13 Oct 2026). Published via blog-data.ts.
import type { DraftPost } from "./types";

export const DRAFTS_B: DraftPost[] = [
  {
    slug: "is-lasik-covered-by-health-insurance",
    title: "Is LASIK Eye Surgery Covered by Health Insurance?",
    excerpt: "Most policies exclude LASIK for low eye power. The exact rule is in a standard exclusion, and it turns on a number: 7.5 dioptres.",
    tags: ["LASIK", "Exclusions", "Eye care"],
    sheetRows: ["does health insurance cover lasik eye surgery", "is lasik surgery covered in any health insurance plan", "is lasik surgery covered in the insurance"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Is LASIK eye surgery covered by health insurance?</h2>
  <p>For most people, no. Indian health policies use a standard exclusion for surgery that corrects eyesight, and it depends on how strong your glasses are.</p>

  <h3 id="rule">The rule, in the wording's own words</h3>
  <p>Current wordings carry the same exclusion, coded Excl15: "Expenses related to the treatment for correction of eye sight due to refractive error less than 7.5 dioptres."</p>
  <p>Dioptre is the unit for the power of your glasses. If your power is below 7.5 (for example, -3.0 or -6.0), LASIK to correct it is excluded. That covers most people who wear glasses.</p>

  <h3 id="when">When it can be paid</h3>
  <ul>
    <li>Your refractive error is 7.5 dioptres or more, and</li>
    <li>the treatment is medically necessary and done as per the policy terms, after any waiting period that applies.</li>
  </ul>
  <p>Even then, check the eye-related limits in your plan. Some plans cap eye procedures, and some list eye surgeries on the waiting-period list.</p>

  <h3 id="cosmetic">Why "cosmetic" decides the claim</h3>
  <p>Insurers treat LASIK done only so you can stop wearing glasses as a choice, not a treatment. The 7.5-dioptre line is where the wording draws that boundary. A doctor's note on medical need helps, but it does not override the exclusion below 7.5.</p>

  <h3 id="check">How to check your policy</h3>
  <p>Search the wording for "refractive" or "Excl15". If you find the standard text, the 7.5-dioptre rule applies to you. Or upload the policy to the <a href="/policychecker">policy checker</a>.</p>
</div>`,
    faqs: [
      { question: "Is LASIK covered by health insurance in India?", answer: "Usually not. A standard exclusion (Excl15) removes surgery to correct eyesight when the refractive error is less than 7.5 dioptres, which covers most people who wear glasses." },
      { question: "When is LASIK covered?", answer: "When your refractive error is 7.5 dioptres or more and the treatment is medically necessary, subject to the policy's other terms and waiting periods." },
      { question: "What does 7.5 dioptres mean?", answer: "It is the power of your glasses or contact lenses. A power of -3 or -6 is below 7.5, so LASIK for it is excluded." },
    ],
    sources: ["Care Supreme, CHIHLIP27061V032627 (Excl15 refractive error)", "Narayana Arya, NHIHLIP26043V012526 (same exclusion text)"],
  },

  {
    slug: "maternity-cover-if-already-pregnant",
    title: "Maternity Cover If You Are Already Pregnant",
    excerpt: "A new policy will not pay for a current pregnancy. Maternity waits run from 9 months to 6 years. Real waits and limits, and what to check in the clause.",
    tags: ["Maternity", "Waiting period", "Newborn"],
    sheetRows: ["can you get maternity insurance if already pregnant", "is it possible to get maternity insurance when already pregnant", "what should you check in a maternity cover", "is pregnancy covered in health insurance", "how to file claim for maternity health insurance"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Maternity cover: can you get it if you are already pregnant?</h2>
  <p>Not for the current pregnancy. Every maternity benefit has a waiting period, and a pregnancy that has already started will not be covered by a policy bought now. Maternity cover is something to buy years before you plan a child.</p>

  <h3 id="default">The default: maternity is excluded</h3>
  <p>Most health policies exclude maternity under a standard exclusion (Excl18): childbirth, including caesarean, and miscarriage unless caused by an accident. Ectopic pregnancy is treated as an illness and is covered. Maternity is paid only where the plan adds a specific maternity benefit.</p>

  <h3 id="waits">Waiting periods, from real wordings</h3>
  <ul>
    <li><a href="/insurance/star-women-care">Star Women Care</a>: 24 months at ₹5 to 10 lakh cover, 12 months from ₹15 lakh.</li>
    <li><a href="/insurance/niva-bupa-health-premia">Niva Bupa Health Premia</a>: 24 months, only on family floater (both spouses) or Family First policies, never on an individual policy.</li>
    <li><a href="/insurance/tata-aig-medicare">Tata AIG MediCare Premier</a>: 3 years.</li>
    <li><a href="/insurance/hdfc-ergo-easy-health">HDFC ERGO Easy Health Exclusive</a>: 4 years from ₹15 lakh cover, 6 years below.</li>
    <li><a href="/insurance/zuno-health-insurance">Zuno Gold and Platinum</a>: 48 months.</li>
    <li><a href="/insurance/bajaj-health-guard">Bajaj Health Guard Gold and Platinum</a>: 72 months.</li>
    <li>Some bank-customer plans from Universal Sompo: 9 months, within 5% of the sum insured.</li>
  </ul>
  <p>In <a href="/insurance/niva-bupa-aspire">Niva Bupa Aspire</a>, maternity is part of the base plan (M-iracle), with the wait and limit set by the variant.</p>

  <h3 id="limits">Limits per delivery</h3>
  <p>Maternity benefits pay a fixed limit, not the full sum insured. Examples: Tata AIG MediCare Premier pays up to ₹50,000 on covers up to ₹50 lakh (₹60,000 for a girl child), and up to ₹1 lakh above that (₹1,20,000 for a girl child). Zuno pays up to ₹50,000 on Gold and ₹2 lakh on Platinum. Many plans also cap the benefit at 2 deliveries in a lifetime, including Star Women Care and Bajaj Health Guard.</p>

  <h3 id="newborn">Newborn cover</h3>
  <p>Check this separately. Some plans cover the baby from day 1, as Aspire does. Others tie it to the mother's cover: Chola Flexi Health covers a newborn from day 1 up to 10% of the sum insured (maximum ₹50,000) if the mother has been insured for 12 months.</p>

  <h3 id="checklist">What to check in a maternity clause</h3>
  <ul>
    <li>The waiting period, and whether it restarts if you change plans.</li>
    <li>The limit per delivery, for normal and caesarean birth.</li>
    <li>Whether pre-natal and post-natal costs are inside that limit.</li>
    <li>When the newborn is covered, and up to what amount.</li>
    <li>The lifetime cap on deliveries.</li>
    <li>Whether it needs a floater policy covering both spouses.</li>
  </ul>
</div>`,
    faqs: [
      { question: "Can I buy maternity insurance if I am already pregnant?", answer: "A new policy will not cover a current pregnancy, because every maternity benefit has a waiting period. Buy maternity cover well before planning a child." },
      { question: "What is the shortest maternity waiting period?", answer: "It varies. Star Women Care waits 12 months from ₹15 lakh cover; some bank-customer plans wait 9 months but pay only up to 5% of the sum insured. Many plans wait 2 to 6 years." },
      { question: "Does health insurance cover delivery costs?", answer: "Only if the plan has a maternity benefit. Most base policies exclude childbirth. Where covered, a fixed limit per delivery applies." },
      { question: "Is my newborn covered from birth?", answer: "In some plans, from day 1. In others only within limits or after the mother has been covered for a set time. Check the newborn clause separately." },
    ],
    sources: [
      "Care Supreme, CHIHLIP27061V032627 (Excl18 maternity)",
      "Star Women Care, SHAHLIP23132V022223",
      "Niva Bupa Health Premia, MAXHLIP21176V022021 (3.10)",
      "Tata AIG MediCare Premier, TATHLIP26052V052526 (B21)",
      "HDFC ERGO Easy Health, HDFHLIP26054V102526 (schedule 3 a)",
      "Zuno Health Insurance, ZUNHLIP26040V052526",
      "Bajaj Health Guard, BAJHLIP26073V082526 (14 maternity)",
      "Universal Sompo Indian Bank / IOB / K Bank Healthcare Plus (maternity, 9 months)",
      "Niva Bupa Aspire, NBHHLIP26049V022526 (4.1.10 M-iracle)",
      "Chola MS Flexi Health, CHOHLIP24145V062526 (new born)",
    ],
  },

  {
    slug: "why-health-insurance-premium-goes-up",
    title: "Why Does Your Health Insurance Premium Go Up?",
    excerpt: "Premiums rise with age bands and approved price revisions. What an insurer is not allowed to do is raise your renewal premium because you made a claim.",
    tags: ["Premium", "Renewal", "Pricing"],
    sheetRows: ["does health insurance premium increase every year", "does health insurance premium change on renewal", "why are health insurance premiums increasing", "how age affect health insurance premium", "how is your health insurance premium determined", "what are the factors affecting health insurance premium"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Why does your health insurance premium go up?</h2>
  <p>Health insurance premiums usually rise over time. Most increases come from two sources: you move into an older age band, or the insurer revises the price of the whole product. A claim on your own policy is not supposed to be one of them.</p>

  <h3 id="age">1. Age bands</h3>
  <p>Premiums are priced by age band, for example 36 to 40 and 41 to 45. When you cross into the next band at renewal, the premium steps up. On a family floater, the eldest member's age usually drives the price.</p>

  <h3 id="revision">2. Product-wide revisions</h3>
  <p>Insurers can revise a product's premium rates for everyone, as per IRDAI regulations. Current wordings say so directly, for example: "The Company may revise or modify the terms of the policy including the premium rates as per applicable IRDAI regulations." Wordings also require the insurer to tell you before such a change applies. Medical inflation and the product's overall claims are the usual reasons.</p>

  <h3 id="not-allowed">What an insurer should not do</h3>
  <ul>
    <li><strong>Refuse renewal because you claimed.</strong> Current wordings state: "Renewal shall not be denied on the ground that the insured had made a claim or claims in the preceding policy years."</li>
    <li><strong>Load your premium for your own claims.</strong> Many wordings say no loading is applied at renewal on the basis of individual claim experience.</li>
  </ul>
  <p>A loading can be applied when you first buy, based on your declared health. Some wordings cap it (Narayana Arya at 50%) and say it continues on renewals.</p>

  <h3 id="freeze">Features that freeze the age</h3>
  <p>A few plans lock your entry age. Niva Bupa ReAssure 2.0 and ReAssure 3.0 have Lock the Clock: you pay the premium for the age you joined at until a claim is paid.</p>

  <h3 id="other">Other things that change the price</h3>
  <ul>
    <li>Increasing your sum insured or adding add-ons.</li>
    <li>Removing a discount you had, such as a multi-year or wellness discount.</li>
    <li>Moving to a city in a higher premium zone, on plans priced by zone.</li>
  </ul>

  <h3 id="notice">Read your renewal notice</h3>
  <p>Compare it line by line with last year's: age band, sum insured, add-ons, discounts and taxes. If the jump is not explained by one of these, ask the insurer in writing.</p>
</div>`,
    faqs: [
      { question: "Does my health insurance premium increase every year?", answer: "Not every year, but it rises when you move into a higher age band and when the insurer revises the product's rates as per IRDAI regulations." },
      { question: "Can my premium go up because I made a claim?", answer: "Renewal cannot be refused because you claimed, and many wordings say no loading is applied at renewal based on your own claims. Increases should come from age bands or product-wide revisions." },
      { question: "Can I stop my premium rising with age?", answer: "Some plans lock your entry age until a claim is paid, such as Niva Bupa ReAssure 2.0 and 3.0 (Lock the Clock). Most plans do not." },
    ],
    sources: [
      "Narayana Arya, NHIHLIP26043V012526 (13.3 loading, 13.17 revision of terms, renewal clause)",
      "Magma OneHealth, MAGHLIP27039V072627 (no loading on individual claim experience)",
      "Niva Bupa ReAssure 2.0, NBHHLIP27054V032627 (4.7.2 Lock the Clock)",
    ],
  },

  {
    slug: "how-to-lower-health-insurance-premium",
    title: "How to Lower Your Health Insurance Premium Safely",
    excerpt: "Every premium discount moves some cost to the day you claim. Deductibles, co-pays, room options, multi-year terms and top-ups, with the trade-off for each.",
    tags: ["Premium", "Deductible", "Super top-up"],
    sheetRows: ["how to lower health insurance premiums", "tips to reduce health insurance premium", "yearly vs multi year premium payments", "benefits of multi year health insurance plans"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">How to lower your health insurance premium safely</h2>
  <p>Most ways to cut a premium move part of the cost to the day you claim. That can be a good trade, as long as you know what you are giving up. Here are the common options and the catch with each.</p>

  <h3 id="deductible">1. A voluntary deductible</h3>
  <p>You agree to pay the first slice of claims each year, for example ₹50,000, and the premium drops. Care Supreme, among others, offers this. <strong>The catch:</strong> on a small claim you pay most or all of it. It suits people who have savings for small bills, or a company policy to use first.</p>

  <h3 id="copay">2. A voluntary co-payment</h3>
  <p>You agree to pay a percentage of every claim, for example 10% or 20%. <strong>The catch:</strong> on a big claim, 20% is a lot of money. A ₹10 lakh bill means ₹2 lakh from you.</p>

  <h3 id="room">3. A cheaper room option</h3>
  <p>Some plans let you limit yourself to a shared or single room for a lower premium. In Niva Bupa Aspire's Room Type Modification, if you then stay in a higher room you pay 10% to 25% of the claim. <strong>The catch:</strong> a higher room can cut the whole bill in proportion, not just the room charge.</p>

  <h3 id="multiyear">4. Pay for 2 or 3 years at once</h3>
  <p>Many wordings give a discount for paying several years up front. Narayana Arya, for example, gives 7.5% for a 2 or 3-year policy paid as one premium. <strong>The catch:</strong> more money up front, and you are tied to the plan for those years (you can still port at renewal).</p>

  <h3 id="topup">5. A smaller base plan plus a super top-up</h3>
  <p>Instead of one large base policy, many families hold a smaller base plan and a super top-up that pays above a deductible. For the same total cover, this is often much cheaper. Our <a href="/calculator">health insurance calculator</a> shows this structure for your family. <strong>The catch:</strong> two policies to renew, and the top-up's deductible must match your base cover.</p>

  <h3 id="avoid">Discounts that cost too much</h3>
  <ul>
    <li>A room limit of a fixed rupee amount far below your city's hospital rates.</li>
    <li>A large co-payment on a plan you are relying on for a big illness.</li>
    <li>Dropping a restoration or consumables cover you would actually use.</li>
  </ul>
  <p>Before you accept a discount, work out what you would pay on a ₹5 lakh claim with and without it.</p>
</div>`,
    faqs: [
      { question: "What is the safest way to lower a health insurance premium?", answer: "A smaller base policy with a super top-up often gives the same total cover for less. A voluntary deductible also works if you can pay the first slice of claims yourself." },
      { question: "Is a multi-year health policy cheaper?", answer: "Often yes. Many wordings give a discount for paying 2 or 3 years at once; Narayana Arya gives 7.5%." },
      { question: "Should I choose a co-payment to save premium?", answer: "Only if you can afford that share of a large bill. A 20% co-pay on a ₹10 lakh claim means ₹2 lakh from you." },
    ],
    sources: [
      "Care Supreme, CHIHLIP27061V032627 (3.2.6 deductible, 3.2.7 co-payment)",
      "Niva Bupa Aspire, NBHHLIP26049V022526 (Room Type Modification co-payment table)",
      "Narayana Arya, NHIHLIP26043V012526 (13.16 multi-year premium payment)",
      "HDFC ERGO Optima Plus, HDHHLIP21336V022021 (deductible-based product)",
    ],
  },

  {
    slug: "what-to-disclose-when-buying-health-insurance",
    title: "What to Disclose When Buying Health Insurance",
    excerpt: "What counts as a pre-existing disease, what people forget to declare, and why the 5-year moratorium does not protect a fraud.",
    tags: ["Disclosure", "Pre-existing", "Moratorium"],
    sheetRows: ["should recent health problems be declared", "why an honest proposal is a must for health insurance", "should a person disclose if he had undergone a small surgery septoplasty while taking new policy", "is smoking listed as a pre existing illness in health insurance", "is cholesterol considered ped in health insurance", "do you have to report health issues after you have bought the insurance policy", "should you disclose changes in health changes after purchasing a health insurance policy"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">What to disclose when buying health insurance</h2>
  <p>The proposal form is the most important document you sign. What you declare decides how the insurer treats every future claim. The rule is simple: if in doubt, declare it.</p>

  <h3 id="ped">What counts as pre-existing</h3>
  <p>Current wordings use a standard definition. A <a href="/learn/pre-existing-disease-waiting-period">pre-existing disease</a> is any condition, ailment, injury or disease that was:</p>
  <ul>
    <li>diagnosed by a doctor within 36 months before the policy starts, or</li>
    <li>one for which a doctor recommended or gave advice or treatment within those 36 months, or</li>
    <li>declared by you or found in a pre-policy health check.</li>
  </ul>

  <h3 id="declare">What to declare</h3>
  <ul>
    <li>Any condition you are being treated for, and the medicines you take regularly.</li>
    <li>Surgeries and hospital stays, even small ones like a septoplasty.</li>
    <li>Test results a doctor acted on, such as high cholesterol or blood sugar.</li>
    <li>Habits the form asks about, like smoking, tobacco and alcohol.</li>
  </ul>
  <p>Answer every question as asked. If a question is unclear, write a short explanation rather than skipping it.</p>

  <h3 id="after">After you buy</h3>
  <p>An illness that starts after your policy begins is not pre-existing for that policy. Some wordings still ask you to tell the insurer about material changes at each renewal (Narayana Arya, clause 13.4). Telling them does not take away cover you already have, and renewal cannot be refused because you claimed.</p>

  <h3 id="moratorium">The 5-year moratorium</h3>
  <p>After 5 continuous years of cover, the insurer cannot look back at your past. In Care Supreme's words: "no health insurance claim shall be contestable except for proven fraud and permanent exclusions specified in the policy contract." So after 5 years, an honest mistake on the form cannot be used to reject a claim, but deliberate concealment still can.</p>

  <h3 id="outcomes">What a disclosure can lead to</h3>
  <ul>
    <li>Cover after the pre-existing disease waiting period (often 36 months, sometimes less).</li>
    <li>A premium loading, which some wordings cap (Narayana Arya at 50%).</li>
    <li>A special condition or exclusion for that condition, or in some cases a decline.</li>
  </ul>
  <p>Any of these is better than a policy that looks clean and rejects your first big claim.</p>
</div>`,
    faqs: [
      { question: "What is a pre-existing disease in health insurance?", answer: "A condition diagnosed, or for which a doctor advised or treated you, within 36 months before the policy starts, or one you declared or that a pre-policy check found." },
      { question: "Should I declare a small surgery from years ago?", answer: "Yes. Declare surgeries and hospital stays even if they seem minor. An undeclared surgery can be used to question a later claim." },
      { question: "Do I need to tell my insurer about a new illness after buying?", answer: "A new illness after the policy starts is not pre-existing for that policy. Some wordings ask you to report material changes at renewal; doing so does not remove existing cover." },
      { question: "What is the moratorium period?", answer: "After 5 continuous years, the insurer cannot contest a claim on the basis of non-disclosure, except for proven fraud and permanent exclusions." },
    ],
    sources: [
      "Narayana Arya, NHIHLIP26043V012526 (2.1.31 pre-existing disease, 13.3 loading, 13.4 material change, renewal clause)",
      "Care Supreme, CHIHLIP27061V032627 (5.12 moratorium period)",
    ],
  },
];
