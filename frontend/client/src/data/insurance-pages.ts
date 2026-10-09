// Insurer and plan pages at /insurance/:slug, built from the SEO keyword sheet
// (SEO.xlsx, 9 Oct 2026).
//
// Rules every entry here follows:
// 1. One page per TOPIC, not per keyword row. Rows that ask the same thing in
//    different words ("aspire plan niva bupa", "benefits of niva bupa aspire
//    plan") are listed in `sheetRows` and answered by the same page.
// 2. Every fact comes from the insurer's own policy wording, read line by line,
//    with the UIN and the clause it came from in `sources`. Our catalogue
//    (backend/catalog_seed) is a starting point only: it is machine-read and
//    marked unverified, and it was wrong on at least two facts used here.
// 3. No claim settlement ratios, premiums, ratings or "best plan" verdicts.
//    None of those are in a policy wording. They go in only with an IRDAI
//    source, never a competitor article.
//
// Import-free on purpose: scripts/prerender.mjs bundles this file for Node.

export interface InsurancePageSource {
  document: string;
  uin: string;
  /** Clauses this page relies on, as numbered in the wording. */
  clauses: string;
}

export interface InsurancePageSection {
  h2: string;
  body?: string[];
  bullets?: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface InsurancePageSheetRow {
  keyword: string;
  evidence: string;
  sourceUrl?: string;
}

export interface InsurancePage {
  slug: string;
  /** The keyword this page targets, exactly as it appears in the sheet. */
  primaryKeyword: string;
  sheetRows: InsurancePageSheetRow[];
  kind: "plan" | "comparison" | "review";
  insurers: string[];
  title: string;
  description: string;
  h1: string;
  /** Answer-first block, shown above everything else. */
  answer: string;
  sections: InsurancePageSection[];
  faqs: { question: string; answer: string }[];
  sources: InsurancePageSource[];
  /** Date the facts were last checked against the wording(s). */
  checkedOn: string;
  /** Clause library slugs (/learn/:slug) for the terms the page uses. */
  learn: string[];
  related: string[];
}

export const INSURANCE_PAGES: InsurancePage[] = [
  {
    slug: "niva-bupa-aspire",
    primaryKeyword: "niva bupa aspire plan",
    sheetRows: [
      { keyword: "niva bupa aspire plan", evidence: "Google Autocomplete observed" },
      { keyword: "aspire plan niva bupa", evidence: "Google Autocomplete observed" },
      { keyword: "benefits of niva bupa aspire plan", evidence: "Google Autocomplete observed" },
      { keyword: "aspire niva bupa brochure", evidence: "Google Autocomplete observed" },
      { keyword: "niva bupa aspire titanium plus maternity coverage", evidence: "Google Autocomplete observed" },
    ],
    kind: "plan",
    insurers: ["Niva Bupa"],
    title: "Niva Bupa Aspire Plan: Benefits and Maternity | IndSure",
    description:
      "IndSure reads the Niva Bupa Aspire policy wording: no room-rent limit, built-in maternity (M-iracle), Booster+, ReAssure and waiting periods.",
    h1: "Niva Bupa Aspire plan: benefits, maternity cover and waiting periods",
    answer:
      "Niva Bupa Aspire (UIN NBHHLIP26049V022526) has no room-rent limit in the base plan, pays 60 days of costs before a hospital stay and 180 days after it, and includes a maternity and fertility benefit called M-iracle. The waiting period for pre-existing diseases is 12, 24 or 36 months, depending on the variant you buy.",
    sections: [
      {
        h2: "What the base plan pays for",
        bullets: [
          "Hospital stays of 2 hours or more, so all day-care treatments are covered. AYUSH treatment needs at least 24 hours in an AYUSH hospital.",
          "Any room you choose. The wording says: choose the room you like, but choose carefully to protect your sum insured.",
          "Road ambulance up to the base sum insured, and air ambulance in an emergency up to the base sum insured, but only if the hospital claim is paid.",
          "12 listed modern treatments, including robotic surgery, oral chemotherapy and stereotactic radiosurgery, up to the base sum insured.",
          "Costs of the organ donor when you get a transplant, and your own costs if you donate an organ.",
          "Treatment at home when a doctor advises it and checks on you every day. Home devices like BP monitors and wheelchairs are not paid.",
          "A health check-up every policy year, from day 1.",
        ],
      },
      {
        h2: "How your cover grows: Booster+ and ReAssure",
        body: [
          "Booster+: base sum insured you do not use in a year is carried forward. It can build up to 10 times your base sum insured. How far it can go depends on your variant and your age when you join. The wording's own example: a 25-year-old on the Titanium+ variant with ₹10 lakh base cover and no claims for 10 years would have ₹1.10 crore of cover.",
          "ReAssure+ or ReAssureX: your first paid claim switches this on, and it then stays for the life of the policy as long as you renew without a break. It refills cover up to your base sum insured for each claim. A policy has one of the two, not both.",
        ],
      },
      {
        h2: "Maternity cover: M-iracle",
        body: [
          "M-iracle is part of the base plan (clause 4.1.10), not an add-on. Its sum insured and waiting period depend on the variant you choose, so check both in your policy schedule before planning a pregnancy.",
        ],
        bullets: [
          "Check-ups during pregnancy, scans and tests, and vaccines for the mother.",
          "Normal or caesarean delivery, and delivery by a surrogate mother.",
          "IVF and other assisted reproduction, and treatment for infertility.",
          "Charges for legally adopting a child, and up to ₹10,000 for the child's tests at adoption.",
          "The newborn is covered from day 1.",
          "The biological mother must be insured under the policy, except for surrogacy or adoption. M-iracle applies in India only.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "12, 24 or 36 months, as per the variant you choose."],
            ["Listed illnesses and surgeries", "12 or 24 months, as per the variant. Cancer after 30 days, accidents from day 1."],
            ["Maternity (M-iracle)", "As per the variant you choose."],
          ],
        },
      },
      {
        h2: "Optional add-ons that change your claim",
        body: [
          "Room Type Modification lowers your premium by limiting you to a shared room or a standard single room. If you then stay in a higher room, you pay a share of the claim yourself:",
        ],
        table: {
          head: ["Room you chose", "Room you stayed in", "You pay"],
          rows: [
            ["Shared room", "Standard single room", "10%"],
            ["Shared room", "Deluxe or suite", "25%"],
            ["Standard single room", "Deluxe or suite", "15%"],
          ],
        },
      },
      {
        h2: "Other add-ons in the wording",
        bullets: [
          "Safeguard and Safeguard+: pay for items a hospital bill normally leaves out, like gloves and other consumables.",
          "Borderless: treatment outside India, with a co-payment you choose.",
          "Annual Aggregate Deductible or Co-Payment for a lower premium. You cannot take both.",
          "Changing the pre-existing disease waiting period. This can only be chosen when you first buy.",
          "Personal Accident, Hospital Cash, Cash-Bag, WellConsult (OPD) and Future Ready.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Niva Bupa Aspire cover maternity?",
        answer:
          "Yes. Maternity is covered through M-iracle, which is part of the base plan. It covers delivery, IVF, surrogacy and adoption costs. The amount and the waiting period depend on the variant you buy.",
      },
      {
        question: "Does Niva Bupa Aspire have a room-rent limit?",
        answer:
          "Not in the base plan. You can pick any room. Only if you choose the Room Type Modification add-on do you get a room limit, with a 10% to 25% co-payment if you stay in a higher room.",
      },
      {
        question: "What is the pre-existing disease waiting period in Niva Bupa Aspire?",
        answer:
          "12, 24 or 36 months, depending on the variant. You can also change it with an add-on, but only when you first buy the policy.",
      },
      {
        question: "Where can I read the Aspire brochure or policy wording?",
        answer:
          "Niva Bupa publishes the policy wording on its website. Search for the UIN NBHHLIP26049V022526 to make sure you have the right version. This page is based on that wording.",
      },
    ],
    sources: [
      {
        document: "Niva Bupa Aspire policy wording",
        uin: "NBHHLIP26049V022526",
        clauses: "4.1.1 to 4.1.10, 4.1.14 to 4.1.25, 5.1.1, 5.1.2, 5.1.3",
      },
    ],
    checkedOn: "2026-10-09",
    learn: ["room-rent-cap", "restoration-benefit", "no-claim-bonus", "maternity-cover", "pre-existing-disease-waiting-period", "consumables-non-payable"],
    related: ["care-supreme-vs-niva-bupa-reassure-3"],
  },

  {
    slug: "care-supreme-vs-niva-bupa-reassure-3",
    primaryKeyword: "care supreme vs niva bupa reassure",
    sheetRows: [
      { keyword: "care supreme vs niva bupa reassure", evidence: "Real forum question/topic", sourceUrl: "https://www.beshak.org/forum/post/care-supreme-vs-niva-bupa-reassure/" },
      { keyword: "care supreme vs niva bupa reassure 08al77xov", evidence: "Real forum question/topic", sourceUrl: "https://www.beshak.org/forum/post/care-supreme-vs-niva-bupa-reassure-08al77xov/" },
      { keyword: "care supreme vs niva bupa reassure 3 0", evidence: "Editorial topic candidate", sourceUrl: "https://joinditto.in/articles/health-insurance/care-supreme-vs-niva-bupa-reassure-3-0/" },
    ],
    kind: "comparison",
    insurers: ["Care Health", "Niva Bupa"],
    title: "Care Supreme vs Niva Bupa ReAssure 3.0 | IndSure",
    description:
      "IndSure compares the Care Supreme and Niva Bupa ReAssure 3.0 policy wordings: room rent, waiting periods, bonus, restoration and maternity.",
    h1: "Care Supreme vs Niva Bupa ReAssure 3.0: what each policy wording says",
    answer:
      "Neither base plan makes you pay a fixed share of every claim. Both cover 60 days before and 180 days after a hospital stay, make you wait 36 months for pre-existing diseases and 24 months for listed illnesses, and do not cover maternity. The biggest difference is the hospital room. Care Supreme has no room-rent limit. In ReAssure 3.0 your room depends on the variant you buy, and taking a higher room means you pay a share of the whole claim.",
    sections: [
      {
        h2: "Side by side",
        table: {
          head: ["", "Care Supreme", "Niva Bupa ReAssure 3.0"],
          rows: [
            ["Hospital room", "No limit", "Depends on variant: Classic, Select or Elite (see below)"],
            ["ICU", "No limit", "The wording does not set a separate ICU limit"],
            ["Co-payment you did not choose", "None in the base plan", "Only if you take a higher room than your variant allows, or report a stay of over 7 days late (see below)"],
            ["Before and after a hospital stay", "60 days and 180 days", "60 days and 180 days"],
            ["Pre-existing diseases", "36 months", "36 months"],
            ["Listed illnesses and surgeries", "24 months", "24 months"],
            ["Bonus for a claim-free year", "50% of sum insured a year, up to 100%. A claim does not reduce it.", "Booster+: unused base cover carries forward, up to 10 times the base sum insured"],
            ["Refill after a claim", "Unlimited, up to base sum insured, within the same policy year", "ReAssure Forever: starts after your first paid claim and stays for life if renewed without a break"],
            ["Modern treatments like robotic surgery", "Up to the sum insured", "Sub-limit on Classic and Select. Elite and the Modern Treatments+ add-on remove it."],
            ["Maternity", "Not covered", "Not covered"],
          ],
        },
      },
      {
        h2: "The room rule in ReAssure 3.0",
        body: [
          "Each ReAssure 3.0 variant has an eligible room. If you stay in a higher one, the co-payment below applies to the entire claim, not just the room charge (Annexure V of the wording).",
        ],
        table: {
          head: ["Room you stay in", "Classic", "Select", "Elite"],
          rows: [
            ["General ward", "0%", "0%", "0%"],
            ["Twin sharing", "20%", "0%", "0%"],
            ["Any room except deluxe or suite", "40%", "20%", "0%"],
            ["Deluxe or suite", "50%", "40%", "20%"],
          ],
        },
      },
      {
        h2: "How the extra cover works",
        body: [
          "Care Supreme adds a cumulative bonus of 50% of your sum insured for each policy year, up to 100%, and the wording says a claim does not affect it. Its Unlimited Automatic Recharge refills up to your base sum insured any number of times in a policy year, but only once your base cover and bonus are used up, and it does not carry forward to the next year.",
          "ReAssure 3.0 carries unused base cover forward through Booster+. The wording's example: ₹10 lakh base cover on the Elite variant with no claims for 10 years becomes ₹1.10 crore. ReAssure Forever starts after your first paid claim and then pays up to your base sum insured for each later claim, for as long as you renew without a break.",
        ],
      },
      {
        h2: "Other differences worth knowing",
        bullets: [
          "ReAssure 3.0 has Lock the Clock: you keep paying the premium for your age at entry until a claim is paid.",
          "On ReAssure 3.0 Classic and Select, cataract cover is for a mono-focal lens only.",
          "Care Supreme covers treatment in hospitals in India. ReAssure 3.0 offers treatment abroad through the Borderless or International Cover add-ons.",
          "ReAssure 3.0 asks you to tell the insurer if a hospital stay goes past 7 days. If you do not tell them within 7 days of admission, an extra 10% co-payment applies to the claim (9 days for road accidents). Care Supreme has no such rule in its wording.",
          "Both let you lower the premium with a deductible or a co-payment you choose, and both have add-ons to shorten waiting periods.",
        ],
      },
    ],
    faqs: [
      {
        question: "Which one has a room-rent limit, Care Supreme or ReAssure 3.0?",
        answer:
          "Care Supreme has no room-rent limit. ReAssure 3.0 has an eligible room for each variant, and a co-payment of up to 50% on the whole claim if you stay in a higher room.",
      },
      {
        question: "Do Care Supreme or Niva Bupa ReAssure 3.0 cover maternity?",
        answer:
          "No. Both list maternity as a standard exclusion. Both still pay for an ectopic pregnancy.",
      },
      {
        question: "Are the waiting periods the same?",
        answer:
          "Yes for the main ones: 30 days for any illness after you first buy, 36 months for pre-existing diseases and 24 months for listed illnesses. Both have add-ons that can shorten them.",
      },
      {
        question: "Is ReAssure 3.0 the same as ReAssure 2.0?",
        answer:
          "No. They are separate products with separate policy wordings. This page compares ReAssure 3.0, UIN NBHHLIP26047V012526.",
      },
    ],
    sources: [
      {
        document: "Care Supreme policy terms and conditions (effective 29 April 2026)",
        uin: "CHIHLIP27061V032627",
        clauses: "3.1.1, 3.1.3, 3.1.4, 3.2.1, 3.2.2, 3.2.6, 3.2.7, 3.2.19, 4.1(a) Excl01 to Excl03, Excl18",
      },
      {
        document: "Niva Bupa ReAssure 3.0 policy wording",
        uin: "NBHHLIP26047V012526",
        clauses: "4.2, 4.3, 4.6, 4.7, 4.8, 4.18, 4.54, 5.1.1 to 5.1.3, 5.1.16, claim procedure B (prolonged hospitalisation), Annexure V",
      },
    ],
    checkedOn: "2026-10-09",
    learn: ["room-rent-cap", "proportionate-deduction", "co-pay", "restoration-benefit", "no-claim-bonus", "pre-existing-disease-waiting-period"],
    related: ["niva-bupa-aspire"],
  },

  {
    slug: "aditya-birla-activ-one-nxt",
    primaryKeyword: "aditya birla activ one nxt review",
    sheetRows: [
      { keyword: "aditya birla activ one nxt review", evidence: "Editorial topic candidate", sourceUrl: "https://joinditto.in/articles/health-insurance/aditya-birla-activ-one-nxt-review/" },
    ],
    kind: "review",
    insurers: ["Aditya Birla Health"],
    title: "Aditya Birla Activ One NXT Review | IndSure",
    description:
      "IndSure reads the Aditya Birla Activ One NXT policy wording: room rent at actuals, Super Reload, HealthReturns, waiting periods and what is left out.",
    h1: "Aditya Birla Activ One NXT review: what the policy wording says",
    answer:
      "Activ One NXT is a variant of Aditya Birla's Activ One plan (UIN ADIHLIP24097V012324). It pays room rent, ICU and road ambulance at actual cost up to the sum insured, covers 90 days before and 180 days after a hospital stay, and refills your base sum insured unlimited times in a year. Pre-existing diseases have a 3-year wait and listed illnesses a 2-year wait. Maternity is not covered.",
    sections: [
      {
        h2: "What NXT pays for",
        bullets: [
          "Room rent, ICU and road ambulance at actual cost, up to the sum insured.",
          "Day-care treatments, modern treatments, AYUSH, organ donor costs, treatment at home and home health care, up to the sum insured.",
          "Mental illness hospitalisation and obesity treatment, up to the sum insured.",
          "90 days of costs before a hospital stay and 180 days after it.",
          "Sum insured from ₹2 lakh to ₹6 crore. Adults can join from 18 with no upper age limit.",
        ],
      },
      {
        h2: "Super Reload: the refill",
        body: [
          "If your base sum insured (and Super Credit, if you have it) runs out or is not enough for a claim, Super Reload adds an amount equal to your base sum insured, unlimited times in the policy year. It works from the first claim in the life of the policy. One claim can never take more than your base sum insured from Super Reload.",
          "The order money is used in is set in the wording: base sum insured first, then Super Credit, then Super Reload, then Cancer Booster.",
        ],
      },
      {
        h2: "HealthReturns: money back for staying active",
        body: [
          "You can earn back up to 100% of your premium as HealthReturns, based on a yearly health check (your Healthy Heart Score) and how many active days you log. Unused HealthReturns are adjusted against your renewal premium. You can claim them up to 4 times a policy year.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "Activ One NXT"],
          rows: [
            ["Any illness after you first buy", "30 days. Not for accidents."],
            ["Pre-existing diseases", "3 years. An add-on can reduce it."],
            ["Listed illnesses and surgeries", "2 years. An add-on reduces it to 1 year."],
          ],
        },
      },
      {
        h2: "Add-ons, and what they cost you at claim time",
        bullets: [
          "Room Rent Type Options: limit yourself to a single private room or shared room for a lower premium.",
          "Per Claim Deductible of ₹15,000 or ₹25,000.",
          "Preferred Provider Network: 10% off the premium, but you pay 10% of every claim at a hospital outside that network.",
          "Claim Protect: pays for all four lists of items a hospital bill normally leaves out, like gloves and other consumables.",
          "Super Credit: adds up to 100% of your base sum insured, even if you claim.",
          "Chronic Care: hospital cover from day 1 for listed conditions like diabetes, high blood pressure and asthma, with a combined limit of ₹5 lakh or the sum insured, whichever is lower.",
          "Critical Illness, Personal Accident, Cancer Booster and Durable Equipment cover.",
        ],
      },
      {
        h2: "What NXT does not cover",
        bullets: [
          "Maternity. It is a standard exclusion. An ectopic pregnancy is still covered as a normal hospital stay.",
          "Items a hospital bill normally leaves out, unless you add Claim Protect.",
          "Treatment outside India, unless your policy schedule says it is covered.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Activ One NXT have a room-rent limit?",
        answer:
          "No. Room rent and ICU are paid at actual cost up to the sum insured. You only get a room limit if you choose the Room Rent Type Options add-on for a lower premium.",
      },
      {
        question: "Does Aditya Birla Activ One NXT cover maternity?",
        answer: "No. Maternity is a standard exclusion in the wording. An ectopic pregnancy is covered.",
      },
      {
        question: "How does Super Reload work in Activ One NXT?",
        answer:
          "When your base cover runs out in a year, Super Reload adds your base sum insured again, any number of times that year. One claim can use at most your base sum insured from it.",
      },
      {
        question: "What is the pre-existing disease waiting period in Activ One NXT?",
        answer: "3 years. You can reduce it with the optional Reduction in Pre-Existing Disease Waiting Period cover.",
      },
    ],
    sources: [
      {
        document: "Aditya Birla Activ One policy document (Activ One NXT)",
        uin: "ADIHLIP24097V012324",
        clauses: "C.8, C.9.2, C.10.6, D.1.18, Annexure III (Product Benefit Table)",
      },
    ],
    checkedOn: "2026-10-09",
    learn: ["restoration-benefit", "deductible", "co-pay", "consumables-non-payable", "pre-existing-disease-waiting-period", "maternity-cover"],
    related: ["care-supreme-vs-niva-bupa-reassure-3"],
  },
];

export function insurancePageBySlug(slug: string) {
  return INSURANCE_PAGES.find((p) => p.slug === slug);
}

export const INSURANCE_HUB = {
  title: "Health Insurance Plans, Read From the Wording | IndSure",
  description:
    "IndSure reads Indian health insurance policy wordings and explains each plan plainly: room rent, waiting periods, bonus, refill and exclusions.",
};
