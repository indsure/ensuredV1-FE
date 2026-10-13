// DRAFT blog posts (Phase 3, 13 Oct 2026). NOT PUBLISHED: nothing imports this
// file. Facts come from policy wordings checked in the Oct 2026 catalogue audit
// (cited by UIN in `sources`), the Insurance Ombudsman's site, and standard
// IRDAI clauses as printed in current wordings. No premiums, no claim ratios,
// no "best plan" picks.
import type { DraftPost } from "./types";

export const DRAFTS_A: DraftPost[] = [
  {
    slug: "co-payment-vs-deductible",
    title: "Co-payment vs Deductible: What You Actually Pay",
    excerpt: "Both make you pay part of a hospital bill, in very different ways. One worked example, the co-pays you never chose, and how to find them in your own policy.",
    tags: ["Co-pay", "Deductible", "Claims"],
    sheetRows: ["co payment vs deductible", "coinsurance vs copay", "copay vs coinsurance in health insurance", "what are deductibles in health insurance", "should you buy health insurance with copay clause"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Co-payment vs deductible: what you actually pay</h2>
  <p>A co-payment and a deductible both mean you pay part of a hospital bill yourself. The difference is how that part is worked out. A <a href="/learn/co-pay">co-payment</a> is a percentage of every claim. A <a href="/learn/deductible">deductible</a> is a fixed amount you pay first, before the insurer pays anything.</p>

  <h3 id="example">One bill, two answers</h3>
  <p>Take a hospital bill of ₹2,00,000 that the policy would otherwise pay in full.</p>
  <ul>
    <li><strong>With a 20% co-payment:</strong> you pay ₹40,000 and the insurer pays ₹1,60,000. On a ₹5,00,000 bill you would pay ₹1,00,000. The co-payment grows with the bill.</li>
    <li><strong>With a ₹50,000 deductible:</strong> you pay the first ₹50,000 and the insurer pays ₹1,50,000. On a ₹5,00,000 bill you would still pay ₹50,000. The deductible stays the same.</li>
  </ul>
  <p>So a co-payment hurts most on big bills, and a deductible hurts most on small ones. An aggregate deductible applies once a year across all claims. A per-claim deductible applies to every hospital stay.</p>

  <h3 id="unchosen">Co-payments you did not choose</h3>
  <p>Many people only find out about a co-payment at the hospital counter. These come from the policy wording, not from a choice you made:</p>
  <ul>
    <li><strong>Age at entry.</strong> Care Classic charges 20% on every claim if the insured, or the eldest on a family plan, is 61 or older when the policy is first issued. Raheja QBE Health QuBE does the same for entry age above 60.</li>
    <li><strong>Age at the time of the claim.</strong> Zuno Health Insurance charges 20% on every claim for anyone aged above 60.</li>
    <li><strong>On every claim, for everyone.</strong> Star Senior Citizens Red Carpet charges 30% on every claim. Niva Bupa Senior First starts at 50%, which you can lower to 20% only when you first buy.</li>
    <li><strong>By room type.</strong> HDFC ERGO Optima Senior charges 15% in a shared room and 30% in a single room or higher.</li>
    <li><strong>By network or city.</strong> Niva Bupa Rise charges 20% if you are treated outside its network. Several plans add a co-payment if you pay a lower-zone premium and get treated in a bigger city.</li>
  </ul>

  <h3 id="chosen">Co-payments and deductibles you choose</h3>
  <p>Many plans let you take a co-payment or a deductible in exchange for a lower premium. Care Supreme and HDFC ERGO Optima Restore both offer this. A lower premium is real money saved every year, but check the bill you would face in a bad year before you choose.</p>
  <p>Some products are built around a deductible. A super top-up, such as HDFC ERGO Optima Plus, only pays above a deductible. That is by design: it sits on top of a base policy.</p>

  <h3 id="coinsurance">What about coinsurance?</h3>
  <p>In India, "coinsurance" in a health policy usually means the same thing as a co-payment: you share a percentage of each claim. Read the clause itself rather than the label.</p>

  <h3 id="find">How to find these in your policy</h3>
  <ul>
    <li>Search the wording for "co-payment", "deductible" and "co-pay".</li>
    <li>Check the conditions for age, room type, zone and network hospitals.</li>
    <li>Check your policy schedule: a chosen co-payment or deductible is printed there.</li>
  </ul>
  <p>Or upload your policy to the <a href="/policychecker">policy checker</a>. It lists every co-payment in plain words, including the ones that start at a birthday.</p>
</div>`,
    faqs: [
      { question: "What is the difference between co-payment and deductible?", answer: "A co-payment is a percentage of every claim you pay yourself. A deductible is a fixed amount you pay first, before the insurer pays. On a ₹2 lakh bill, a 20% co-pay costs you ₹40,000; a ₹50,000 deductible costs you ₹50,000." },
      { question: "Can a health policy have a co-payment I did not choose?", answer: "Yes. Some wordings add a co-payment by entry age, age at claim, room type, network or zone. For example, Care Classic charges 20% if you are 61 or older when first insured." },
      { question: "Is coinsurance the same as co-payment?", answer: "In Indian health policies, usually yes: both mean you share a percentage of each claim. Read the actual clause to be sure." },
      { question: "Should I take a voluntary co-payment to lower my premium?", answer: "Only if you can comfortably pay that share of a large bill. The saving is every year, but so is the risk. Work out what you would pay on a ₹5 lakh claim before choosing." },
    ],
    sources: [
      "Care Classic, CHIHLIP26048V022526 (co-payment at 61+)",
      "Raheja QBE Health QuBE, RQBHLIP26036V052526 (mandatory co-payment)",
      "Zuno Health Insurance, ZUNHLIP26040V052526 (general condition 2)",
      "Star Senior Citizens Red Carpet, SHAHLIP26041V082526 (M. co-payment)",
      "Niva Bupa Senior First, NBHHLIP27053V022627 (4.1 co-payment)",
      "HDFC ERGO Optima Senior, HDHHLIP21379V022021 (Co-Payment A)",
      "Niva Bupa Rise, NBHHLIP25041V012425 (network co-payment)",
      "HDFC ERGO Optima Restore, HDFHLIP26055V102526 (optional co-payment)",
    ],
  },

  {
    slug: "does-health-insurance-cover-dental",
    title: "Does Health Insurance Cover Dental Treatment?",
    excerpt: "Most health policies pay for dental treatment only in hospital. What is paid, what is not, and the plans that add outpatient dental cover.",
    tags: ["Dental", "Exclusions", "OPD"],
    sheetRows: ["does health insurance cover dental", "is dental treatment covered in health insurance", "does health insurance cover dental implants india", "does your health insurance cover braces", "is there insurance for dental treatment", "does health insurance covers regarding jaw surgery orthognathic surgery dental surgery"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Does health insurance cover dental treatment?</h2>
  <p>Mostly no, with one important exception. A standard health policy pays for dental treatment only when it needs a hospital stay, usually after an accident or an illness. Routine dental work at a clinic is normally not covered.</p>

  <h3 id="definition">What "dental treatment" means in a policy</h3>
  <p>Policy wordings use a standard definition: treatment related to teeth or the structures supporting teeth, including examinations, fillings, crowns, extractions and surgery. So the exclusion, when it applies, is wide.</p>

  <h3 id="paid">What is usually paid</h3>
  <ul>
    <li><strong>Dental treatment needing hospitalisation.</strong> HDFC ERGO my:Optima Secure covers in-patient dental treatment needed because of disease or injury. Tata AIG MediCare Premier covers hospitalisation for dental treatment under anaesthesia needed because of an accident, injury or illness.</li>
    <li><strong>Injury to the jaw or teeth in an accident</strong>, when you are admitted.</li>
  </ul>
  <p>Many other wordings say the same thing the other way round: dental treatment or surgery of any kind is excluded unless it is part of an admissible hospitalisation.</p>

  <h3 id="not-paid">What is usually not paid</h3>
  <ul>
    <li>Check-ups, cleaning, fillings and root canals at a dental clinic.</li>
    <li>Dentures, implants and bridges.</li>
    <li>Braces and other cosmetic work. Cosmetic treatment is a standard exclusion (Excl08 in current wordings).</li>
  </ul>

  <h3 id="opd">Plans that add outpatient dental cover</h3>
  <p>A few plans include a small dental benefit. Tata AIG MediCare Premier, for example, pays for root canals, extractions and fillings after 2 years of continuous cover, up to ₹10,000 a year on covers up to ₹50 lakh, rising to ₹25,000 on ₹3 crore. Some insurers sell an OPD add-on that includes dental. Compare the yearly limit with the extra premium before buying it.</p>

  <h3 id="jaw">Jaw surgery</h3>
  <p>Jaw surgery done for a medical reason, after an accident or for a disease, in hospital, is treated like other surgery. If it is done mainly to change appearance, the cosmetic exclusion applies. Ask your doctor to state the medical reason in writing.</p>

  <h3 id="check">How to check your own policy</h3>
  <p>Search the wording for "dental". Look for the benefit (often "in-patient dental") and the exclusion together, since they decide each other. Or upload your policy to the <a href="/policychecker">policy checker</a>.</p>
</div>`,
    faqs: [
      { question: "Does health insurance cover dental treatment in India?", answer: "Usually only when it needs a hospital stay, such as after an accident or for an illness. Routine dental work at a clinic is normally excluded." },
      { question: "Are dental implants or braces covered?", answer: "Generally no. Implants and dentures are not covered as routine treatment, and braces fall under the cosmetic exclusion in most wordings." },
      { question: "Which health plans cover outpatient dental treatment?", answer: "A few do, with small limits. Tata AIG MediCare Premier pays for root canals, extractions and fillings after 2 years, up to ₹10,000 a year on covers up to ₹50 lakh." },
      { question: "Is dental treatment after an accident covered?", answer: "Yes, in most plans, when the treatment needs hospitalisation. Check the in-patient dental benefit in your wording." },
    ],
    sources: [
      "HDFC ERGO my:Optima Secure, HDFHLIP26058V082526 (Def. 13; in-patient dental)",
      "Tata AIG MediCare Premier, TATHLIP26052V052526 (B15 in-patient dental, B27 OPD dental)",
      "Care Supreme, CHIHLIP27061V032627 (Excl08 cosmetic surgery)",
    ],
  },

  {
    slug: "does-health-insurance-cover-therapy-mental-health",
    title: "Does Health Insurance Cover Therapy and Mental Health?",
    excerpt: "Hospital treatment for mental illness is covered under Indian law. Outpatient therapy usually is not. What is paid, what to disclose, and the limits to look for.",
    tags: ["Mental health", "Physiotherapy", "OPD"],
    sheetRows: ["does health insurance cover therapy", "does a health insurance policy cover depression", "can one get health insurance if he is taking antidepression medicines", "is speech therapy covered by health insurance in india", "is physiotherapy covered in health insurance"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Does health insurance cover therapy and mental health?</h2>
  <p>Hospital treatment for mental illness: yes. Regular therapy sessions at a clinic: usually not. The split is the same as for physical illness, because most health policies pay for treatment in hospital, not outpatient visits.</p>

  <h3 id="law">What the law says</h3>
  <p>Section 21(4) of the Mental Healthcare Act, 2017 requires insurers to provide medical insurance for mental illness on the same basis as for physical illness. Current wordings reflect this: they define mental illness, and the doctor who certifies it must act under the Mental Healthcare Act.</p>

  <h3 id="paid">What is usually paid</h3>
  <ul>
    <li>Hospitalisation for a mental illness, like any other admission.</li>
    <li>Treatment in a recognised mental health establishment, where the wording allows it.</li>
    <li>Medicines and tests linked to that hospital stay, within the pre and post-hospital days.</li>
  </ul>
  <p>Some plans put a cap on this. Niva Bupa Health Premia, for example, covers in-patient treatment for mental illness up to the limit in your schedule, and only when diagnosed by a qualified psychiatrist or a recognised equivalent.</p>

  <h3 id="therapy">Therapy sessions and counselling</h3>
  <p>Outpatient therapy, counselling and psychologist visits are usually not covered by a base policy, because they are outpatient care. Some plans include tele-consultations or an OPD benefit that can cover a few sessions. Check the OPD section of your wording.</p>

  <h3 id="physio">Physiotherapy and speech therapy</h3>
  <p>Physiotherapy is paid when it is part of a hospital stay, or within the pre and post-hospitalisation days for the same condition. Niva Bupa Rise, for example, lists physiotherapy among post-hospital expenses. Physiotherapy on its own, without a hospital stay, is usually not covered. Speech therapy follows the same logic.</p>

  <h3 id="buying">Buying a policy while on antidepressants</h3>
  <p>A condition treated or diagnosed in the 36 months before you buy counts as pre-existing. Disclose it, along with the medicines you take. The insurer may accept it after the pre-existing disease waiting period, add a loading, or set a special condition. Hiding it puts every future claim at risk.</p>
</div>`,
    faqs: [
      { question: "Does health insurance cover depression treatment in India?", answer: "Hospital treatment for mental illness, including depression, is covered like any other illness under the Mental Healthcare Act, 2017. Outpatient therapy sessions usually are not, unless your plan has an OPD benefit." },
      { question: "Is therapy or counselling covered by health insurance?", answer: "Not by most base policies, since it is outpatient care. Some plans include tele-consultations or OPD cover that can pay for a few sessions." },
      { question: "Is physiotherapy covered by health insurance?", answer: "Yes when it is part of a hospital stay or within the post-hospital days for the same condition. Not on its own." },
      { question: "Can I get health insurance if I take antidepressants?", answer: "Yes. Disclose the condition and medicines. It will usually be covered after the pre-existing disease waiting period, possibly with a loading." },
    ],
    sources: [
      "Mental Healthcare Act, 2017, section 21(4)",
      "Niva Bupa Health Premia, MAXHLIP21176V022021 (3.19 Mental Disorders Treatment)",
      "Niva Bupa Rise, NBHHLIP25041V012425 (pre and post-hospitalisation)",
      "Narayana Arya, NHIHLIP26043V012526 (2.1.31 pre-existing disease definition; 13.3 loading)",
    ],
  },

  {
    slug: "is-robotic-surgery-covered-by-health-insurance",
    title: "Is Robotic Surgery Covered by Health Insurance?",
    excerpt: "Robotic surgery is one of 12 listed modern treatments. Some plans pay up to the sum insured; others cap it at ₹50,000 or ₹1 lakh. Real limits from real wordings.",
    tags: ["Robotic surgery", "Modern treatments", "Sub-limits"],
    sheetRows: ["does health insurance cover robotic surgery", "is robotic surgery covered by insurance in india", "robotic surgery sublimit clause in niva bupa reassure plan", "can the insurance company decline robotic knee surgery based on gic guidline"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Is robotic surgery covered by health insurance?</h2>
  <p>Usually yes, but the amount varies a lot from plan to plan. Robotic surgery is one of 12 "modern treatments" listed in current policy wordings. Some plans pay for them up to the full sum insured. Others cap them, sometimes at a level far below the real cost.</p>

  <h3 id="list">The 12 modern treatments</h3>
  <p>Current wordings list the same 12: uterine artery embolisation and HIFU, balloon sinuplasty, deep brain stimulation, oral chemotherapy, immunotherapy by monoclonal antibody injection, intravitreal injections, robotic surgery, stereotactic radiosurgery, bronchial thermoplasty, vaporisation of the prostate (green or holmium laser), intra-operative neuro monitoring, and stem cell therapy for blood disorders.</p>

  <h3 id="full">Plans that pay up to the sum insured</h3>
  <ul>
    <li><a href="/insurance/care-supreme">Care Supreme</a>: the 12 listed treatments up to the sum insured.</li>
    <li><a href="/insurance/niva-bupa-reassure-2">Niva Bupa ReAssure 2.0</a>: lists robotic surgery with no separate limit.</li>
  </ul>

  <h3 id="capped">Plans that cap it</h3>
  <ul>
    <li><a href="/insurance/niva-bupa-rise">Niva Bupa Rise</a>: all 12 modern treatments are capped at ₹50,000 per claim, unless you buy Modern Treatment+.</li>
    <li><a href="/insurance/niva-bupa-health-premia">Niva Bupa Health Premia</a> and <a href="/insurance/niva-bupa-senior-first">Senior First</a>: most robotic surgery is capped at ₹1 lakh per claim. Robotic radical prostatectomy, cardiac surgery, partial nephrectomy and cancer surgery are not capped this way.</li>
    <li><a href="/insurance/niva-bupa-reassure-3">Niva Bupa ReAssure 3.0</a>: a modern treatment sub-limit on the Classic and Select variants. Elite removes it.</li>
    <li><a href="/insurance/iffco-tokio-family-health-protector">IFFCO Tokio Family Health Protector</a>: modern treatments up to 50% of the sum insured.</li>
    <li><a href="/insurance/raheja-qbe-health-qube">Raheja QBE Health QuBE</a>: a 50% co-payment on every modern treatment claim.</li>
  </ul>

  <h3 id="old">Older plans</h3>
  <p>Some older wordings do not mention modern treatments at all. If there is no exclusion either, the surgery is paid like any other hospital treatment. Check the wording rather than assuming.</p>

  <h3 id="knee">Robotic knee replacement</h3>
  <p>The method does not change the waiting period. Joint replacement is on the listed-illness waiting list in most wordings, usually 24 months and sometimes 36. A robotic knee replacement during that wait is not covered, whatever the modern treatment limit.</p>

  <h3 id="before">Before a planned robotic surgery</h3>
  <ul>
    <li>Ask the hospital for the full estimate, and check it against your modern treatment limit.</li>
    <li>Check that the condition is past its waiting period.</li>
    <li>Ask for pre-authorisation from the insurer before admission.</li>
  </ul>
</div>`,
    faqs: [
      { question: "Is robotic surgery covered by health insurance in India?", answer: "Usually yes, as one of 12 listed modern treatments. The limit varies: some plans pay up to the sum insured, others cap it at ₹50,000 or ₹1 lakh per claim or at a share of the sum insured." },
      { question: "Is there a robotic surgery sub-limit in Niva Bupa plans?", answer: "It depends on the plan. Rise caps modern treatments at ₹50,000 per claim; Health Premia and Senior First cap most robotic surgery at ₹1 lakh; ReAssure 2.0 states no separate limit." },
      { question: "Can an insurer reject a robotic knee replacement?", answer: "If joint replacement is still within its waiting period, yes. After the wait, it is paid up to your plan's modern treatment limit." },
    ],
    sources: [
      "Care Supreme, CHIHLIP27061V032627 (3.1.1, modern treatments)",
      "Niva Bupa ReAssure 2.0, NBHHLIP27054V032627 (4.2.2)",
      "Niva Bupa Rise, NBHHLIP25041V012425 (modern treatment note)",
      "Niva Bupa Health Premia, MAXHLIP21176V022021 (3.25)",
      "Niva Bupa Senior First, NBHHLIP27053V022627 (robotic surgery note)",
      "Niva Bupa ReAssure 3.0, NBHHLIP26047V012526",
      "IFFCO Tokio Family Health Protector, IFFHLIP26042V062526",
      "Raheja QBE Health QuBE, RQBHLIP26036V052526 (Section L)",
    ],
  },

  {
    slug: "is-cataract-surgery-covered-by-health-insurance",
    title: "Is Cataract Surgery Covered by Health Insurance?",
    excerpt: "Cataract is covered after a waiting period, but many plans cap it per eye and limit the lens type. The caps from real wordings, and a checklist before surgery.",
    tags: ["Cataract", "Sub-limits", "Waiting period"],
    sheetRows: ["is cataract surgery covered under health insurance", "does national health insurance cover cataract surgery"],
    content: `
<div class="blog-article-content">
  <h2 id="intro">Is cataract surgery covered by health insurance?</h2>
  <p>Yes, in almost every health policy, once the waiting period is over. But many plans cap what they pay per eye, and some only pay for a basic lens. The cap matters because a good lens can cost more than the limit.</p>

  <h3 id="wait">The waiting period</h3>
  <p>Cataract is on the listed-illness waiting list in most wordings, usually 24 months from when you first take the policy. Some plans offer an add-on that shortens it. Surgery during the wait is not covered, unless it follows an accident.</p>

  <h3 id="caps">Caps per eye, from real wordings</h3>
  <ul>
    <li><a href="/insurance/bajaj-health-guard">Bajaj Health Guard</a>: 20% of the sum insured per eye, up to ₹1 lakh.</li>
    <li><a href="/insurance/raheja-qbe-health-qube">Raheja QBE Health QuBE</a>: ₹50,000 per eye, including the lens.</li>
    <li><a href="/insurance/oriental-youth-eco-care">Oriental Youth Eco Care</a>: ₹50,000 per eye up to ₹10 lakh cover, ₹1 lakh above.</li>
    <li><a href="/insurance/star-family-health-optima">Star Family Health Optima</a>: rises with the sum insured, from ₹12,000 per eye on the smallest covers to ₹50,000 per eye (₹75,000 a year) at ₹10 lakh and above.</li>
  </ul>
  <p>Plans like Care Supreme state no disease-wise sub-limits, so cataract is paid up to the sum insured there.</p>

  <h3 id="lens">The lens type</h3>
  <ul>
    <li>Niva Bupa ReAssure 2.0 pays for a mono-focal lens only on covers up to ₹10 lakh.</li>
    <li>Niva Bupa ReAssure 3.0 pays for a mono-focal lens only on its Classic and Select variants.</li>
    <li>Care Freedom excludes multifocal lens implants.</li>
  </ul>
  <p>If you want a multifocal or premium lens, expect to pay the difference yourself on these plans.</p>

  <h3 id="daycare">No overnight stay needed</h3>
  <p>Cataract surgery is a day-care procedure. Policies pay for it without a 24-hour admission.</p>

  <h3 id="checklist">Checklist before booking the surgery</h3>
  <ul>
    <li>Has the cataract waiting period ended?</li>
    <li>What is the cap per eye, and per year?</li>
    <li>Which lens types are paid?</li>
    <li>Does the hospital estimate fit inside the cap, including the lens?</li>
    <li>Ask for pre-authorisation before the surgery date.</li>
  </ul>
</div>`,
    faqs: [
      { question: "Is cataract surgery covered by health insurance?", answer: "Yes, after the waiting period, usually 24 months. Many plans cap the amount per eye and some pay only for a mono-focal lens." },
      { question: "How much does health insurance pay for cataract surgery?", answer: "It depends on the plan. Examples: Bajaj Health Guard 20% of the sum insured per eye up to ₹1 lakh; Raheja Health QuBE ₹50,000 per eye; Care Supreme up to the sum insured." },
      { question: "Is a premium or multifocal lens covered?", answer: "Not always. Some plans pay only for a mono-focal lens, and some exclude multifocal lenses. You pay the difference." },
      { question: "Do I need to be admitted for 24 hours for cataract?", answer: "No. Cataract surgery is a day-care procedure and is paid without a 24-hour stay." },
    ],
    sources: [
      "Bajaj Health Guard, BAJHLIP26073V082526 (cataract limit)",
      "Raheja QBE Health QuBE, RQBHLIP26036V052526 (sub-limits)",
      "Oriental Youth Eco Care, OICHLIP24034V012324 (3.18)",
      "Star Family Health Optima, SHAHLIP26046V092526 (II.3 cataract table)",
      "Care Supreme, CHIHLIP27061V032627",
      "Niva Bupa ReAssure 2.0, NBHHLIP27054V032627 (4.2 cataract)",
      "Niva Bupa ReAssure 3.0, NBHHLIP26047V012526",
      "Care Freedom, CHIHLIP26052V032526 (permanent exclusion 25)",
    ],
  },
];
