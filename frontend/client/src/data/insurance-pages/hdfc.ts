// HDFC ERGO plan pages. Facts from the policy wordings, checked in the
// 9 Oct 2026 catalogue audit (E:/_audit/ledger). See ../insurance-pages.ts for the rules.
import type { InsurancePage } from "../insurance-pages";

const checkedOn = "2026-10-09";

export const HDFC_PAGES: InsurancePage[] = [
  {
    slug: "hdfc-ergo-optima-secure",
    primaryKeyword: "hdfc ergo optima secure",
    sheetRows: [
      { keyword: "hdfc ergo optima secure", evidence: "Real forum question/topic" },
      { keyword: "hdfc ergo optima secure benefits", evidence: "Real forum question/topic" },
      { keyword: "hdfc ergo optima secure policy wording", evidence: "Editorial topic candidate" },
      { keyword: "hdfc optima secure product review", evidence: "Editorial topic candidate" },
      { keyword: "secure benefit hdfc ergo optima secure health insurance review", evidence: "Editorial topic candidate" },
      { keyword: "room category capping in hdfc ergo optima secure", evidence: "Real forum question/topic" },
      { keyword: "unlimited restoration in hdfc ergo optima secure", evidence: "Real forum question/topic" },
      { keyword: "hdfc ergo optima secure plus", evidence: "Editorial topic candidate" },
      { keyword: "hdfc ergo optima secure global", evidence: "Insurer/product/glossary candidate" },
      { keyword: "hdfc ergo optima secure global plus", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "plan",
    insurers: ["HDFC ERGO"],
    title: "HDFC ERGO Optima Secure: Benefits and Variants | IndSure",
    description:
      "IndSure reads the my:Optima Secure policy wording: Secure Benefit, Plus Benefit, restore, no room limit, and how all 8 variants differ.",
    h1: "HDFC ERGO Optima Secure: benefits, variants and the fine print",
    answer:
      "Optima Secure is one plan inside HDFC ERGO's my:Optima Secure product (UIN HDFHLIP26058V082526). It pays any room and ICU at actuals, 60 days before and 180 days after a hospital stay, and gives three ways to grow cover: Secure Benefit adds 100% of the base sum insured each year once the base is used up, Plus Benefit adds 50% a year up to 100% even if you claim, and Restore adds 100% once a year. Pre-existing diseases wait 36 months.",
    sections: [
      {
        h2: "How the three extras work",
        bullets: [
          "Secure Benefit: an extra 100% of the base sum insured, available once a year after the base is used up, for any number of claims that year. It does not carry forward.",
          "Plus Benefit: 50% of the base sum insured added at each renewal, up to 100%. The wording says it applies irrespective of the number of claims.",
          "Automatic Restore: 100% of the base sum insured added once a year after a claim uses up cover, even for the same illness.",
          "Protect Benefit: pays for items a hospital bill normally leaves out. It is built in, and you can remove it.",
        ],
      },
      {
        h2: "All 8 plans in this product, side by side",
        table: {
          head: ["Plan", "Room", "Bonus", "Secure Benefit", "Restore"],
          rows: [
            ["Optima Suraksha", "Actuals", "10% a year, up to 100%", "None", "100%, once a year"],
            ["Optima Secure", "Actuals", "Plus Benefit, 50% a year up to 100%", "100%", "100%, once a year"],
            ["Optima Super Secure", "Actuals", "Plus Benefit, 50% a year up to 100%", "200%", "100%, once a year"],
            ["Optima Secure +", "Actuals", "Infinite Benefit, 100% a year with no cap", "100%", "Unlimited"],
            ["Optima Secure Global", "Actuals", "Plus Benefit, 50% a year up to 100%", "100%", "100%, once a year"],
            ["Optima Secure Global Plus", "Actuals", "Plus Benefit, 50% a year up to 100%", "100%", "100%, once a year"],
            ["Optima Select", "Single private room", "25% a year, up to 100%", "None", "Unlimited"],
            ["Optima Lite", "1% of sum insured a day (ICU 2%)", "10% a year, up to 100%", "None", "Unlimited"],
          ],
        },
      },
      {
        h2: "Room capping",
        body: [
          "Optima Secure has no room limit. You can choose to cap it at a single private room for a lower premium, subject to underwriting. Optima Select defaults to a single private room and can switch to actuals or a shared room. Optima Lite is fixed at 1% of the sum insured a day.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months, unless your schedule says otherwise. An option reduces it to 1 or 2 years."],
            ["Listed illnesses and surgeries", "24 months."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "Does HDFC ERGO Optima Secure have unlimited restoration?",
        answer: "Not on the Optima Secure plan, where Restore adds 100% once a year. Unlimited restore is built into Optima Secure +, Optima Select and Optima Lite.",
      },
      {
        question: "Is there a room-rent limit in Optima Secure?",
        answer: "No. Room and ICU are paid at actuals. You can opt into a single private room cap for a lower premium.",
      },
      {
        question: "Does a claim reduce the Optima Secure bonus?",
        answer: "No. The Plus Benefit adds 50% of the base sum insured each renewal, up to 100%, irrespective of claims.",
      },
      {
        question: "What is the difference between Optima Secure and Optima Secure +?",
        answer: "Optima Secure + replaces the Plus Benefit with the Infinite Benefit, which adds 100% of the base sum insured every year with no upper limit, and its restore is unlimited.",
      },
    ],
    sources: [
      {
        document: "HDFC ERGO my:Optima Secure policy wording",
        uin: "HDFHLIP26058V082526",
        clauses: "B-1, B-2.3 to B-2.6, B-2.12, B-2.13, B-2.17, C-1 Excl01, Excl02, Annexure C plan chart",
      },
    ],
    checkedOn,
    learn: ["restoration-benefit", "no-claim-bonus", "room-rent-cap", "consumables-non-payable", "pre-existing-disease-waiting-period"],
    related: ["hdfc-ergo-optima-restore-vs-optima-secure", "hdfc-ergo-optima-restore"],
  },

  {
    slug: "hdfc-ergo-optima-restore",
    primaryKeyword: "hdfc ergo optima restore",
    sheetRows: [
      { keyword: "hdfc ergo optima restore", evidence: "Insurer/product/glossary candidate" },
      { keyword: "hdfc ergo optima restore policy wording", evidence: "Editorial topic candidate" },
      { keyword: "existing hdfc ergo optima restore plan and what super topup to go with it", evidence: "Real forum question/topic" },
    ],
    kind: "plan",
    insurers: ["HDFC ERGO"],
    title: "HDFC ERGO Optima Restore: Benefits and Limits | IndSure",
    description:
      "IndSure reads the HDFC ERGO Optima Restore wording: no room limit, 50% Multiplier Benefit, Restore once a year, ₹2,000 ambulance, waits.",
    h1: "HDFC ERGO Optima Restore: what the policy wording covers",
    answer:
      "Optima Restore (UIN HDFHLIP26055V102526) has no room-rent or ICU limit and no co-payment in the base plan. It pays 60 days before and 180 days after a hospital stay. The Multiplier Benefit adds 50% of the base sum insured at each renewal, up to 100%, irrespective of claims, and Restore adds 100% of the base sum insured once a year. Road ambulance is capped at ₹2,000. Pre-existing diseases wait 36 months.",
    sections: [
      {
        h2: "Key limits",
        table: {
          head: ["Item", "What the wording says"],
          rows: [
            ["Hospital room and ICU", "No limit stated."],
            ["Road ambulance", "₹2,000 per hospitalisation."],
            ["Air ambulance", "Up to ₹2.5 lakh per hospitalisation, in India."],
            ["Before and after a hospital stay", "60 days and 180 days."],
            ["Modern treatments", "The wording has no separate clause and no exclusion, so they are paid like any in-patient treatment."],
          ],
        },
      },
      {
        h2: "Multiplier and Restore",
        bullets: [
          "Multiplier Benefit: 50% of the base sum insured added at each renewal, irrespective of claims, up to 100%.",
          "Restore Benefit: 100% of the base sum insured added once a year after full or partial use, available to everyone on a family floater. Unlimited Restore is an add-on.",
          "One claim cannot be larger than the base sum insured plus the Multiplier Benefit.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months."],
            ["Listed illnesses and surgeries", "24 months."],
          ],
        },
      },
      {
        h2: "Add-ons",
        bullets: [
          "Parenthood: maternity, embryo storage and IVF.",
          "Protector Rider: pays for items a hospital bill normally leaves out.",
          "Critical Advantage: planned treatment abroad for 8 major illnesses.",
          "Unlimited Restore, co-payment or deductible options, and others.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Optima Restore have a room-rent limit?",
        answer: "No. The wording sets no limit on room or ICU charges.",
      },
      {
        question: "How does the Restore benefit work in Optima Restore?",
        answer: "Once a year, after a claim uses up all or part of your cover, 100% of the base sum insured is added for later claims that year.",
      },
      {
        question: "Does a claim stop the Multiplier Benefit?",
        answer: "No. It adds 50% of the base sum insured at each renewal irrespective of claims, up to 100%.",
      },
      {
        question: "Can I add a super top-up to Optima Restore?",
        answer: "Yes, a super top-up is a separate policy that pays above a deductible. The Optima Restore wording does not restrict it. Check that the top-up's deductible matches your Optima Restore sum insured.",
      },
    ],
    sources: [
      {
        document: "HDFC ERGO Optima Restore policy wording",
        uin: "HDFHLIP26055V102526",
        clauses: "Section B in-patient, Restore Benefit, Multiplier Benefit (4), Excl01, Excl02, riders list",
      },
    ],
    checkedOn,
    learn: ["restoration-benefit", "no-claim-bonus", "room-rent-cap", "pre-post-hospitalisation"],
    related: ["hdfc-ergo-optima-restore-vs-optima-secure", "hdfc-ergo-optima-secure"],
  },

  {
    slug: "hdfc-ergo-optima-restore-vs-optima-secure",
    primaryKeyword: "hdfc ergo health insurance optima restore vs optima secure",
    sheetRows: [{ keyword: "hdfc ergo health insurance optima restore vs optima secure", evidence: "Real forum question/topic" }],
    kind: "comparison",
    insurers: ["HDFC ERGO"],
    title: "HDFC Optima Restore vs Optima Secure | IndSure",
    description:
      "IndSure compares the HDFC ERGO Optima Restore and Optima Secure wordings: bonus, Secure Benefit, restore, ambulance and waiting periods.",
    h1: "HDFC ERGO Optima Restore vs Optima Secure: what each wording says",
    answer:
      "Both have no room limit, pay 60 days before and 180 days after a hospital stay, add 50% of the base sum insured a year up to 100% regardless of claims, and restore 100% once a year. Optima Secure adds two things Optima Restore does not have: Secure Benefit, an extra 100% of base cover each year, and Protect Benefit for items a bill normally leaves out. Optima Restore caps road ambulance at ₹2,000.",
    sections: [
      {
        h2: "Side by side",
        table: {
          head: ["", "Optima Restore", "Optima Secure"],
          rows: [
            ["Room and ICU", "No limit stated", "Actuals"],
            ["Before and after a stay", "60 and 180 days", "60 and 180 days"],
            ["Yearly bonus", "Multiplier, 50% a year up to 100%, irrespective of claims", "Plus Benefit, 50% a year up to 100%, irrespective of claims"],
            ["Extra cover from day 1", "None", "Secure Benefit, 100% of base sum insured once the base is used up"],
            ["Restore", "100% once a year", "100% once a year, same illness allowed"],
            ["Consumables and similar items", "Only with the Protector Rider", "Protect Benefit built in (can be removed)"],
            ["Road ambulance", "₹2,000 per hospitalisation", "Up to the sum insured"],
            ["Pre-existing diseases", "36 months", "36 months (option to cut to 1 or 2 years)"],
            ["Listed illnesses", "24 months", "24 months"],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "Which has more cover, Optima Restore or Optima Secure?",
        answer: "For the same base sum insured, Optima Secure's wording gives more: its Secure Benefit adds another 100% of the base sum insured each year after the base is used up, on top of bonus and restore.",
      },
      {
        question: "Do both plans have a room-rent limit?",
        answer: "No. Neither wording sets a room or ICU limit in the base plan.",
      },
    ],
    sources: [
      { document: "HDFC ERGO Optima Restore policy wording", uin: "HDFHLIP26055V102526", clauses: "Section B, Restore, Multiplier, Excl01, Excl02" },
      { document: "HDFC ERGO my:Optima Secure policy wording", uin: "HDFHLIP26058V082526", clauses: "B-1, B-2.3 to B-2.6, Annexure C" },
    ],
    checkedOn,
    learn: ["restoration-benefit", "no-claim-bonus", "consumables-non-payable", "health-insurance-portability"],
    related: ["hdfc-ergo-optima-secure", "hdfc-ergo-optima-restore"],
  },

  {
    slug: "hdfc-ergo-easy-health",
    primaryKeyword: "hdfc ergo easy health individual policy",
    sheetRows: [{ keyword: "hdfc ergo easy health individual policy", evidence: "Real forum question/topic" }],
    kind: "plan",
    insurers: ["HDFC ERGO"],
    title: "HDFC ERGO Easy Health: Standard vs Exclusive | IndSure",
    description:
      "IndSure reads the HDFC ERGO Easy Health wording: no room limit, 10% yearly bonus, maternity only on Exclusive after 4 to 6 years, waits.",
    h1: "HDFC ERGO Easy Health: what Standard and Exclusive cover",
    answer:
      "Easy Health (UIN HDFHLIP26054V102526) sets no room-rent limit and has no co-payment. It pays 60 days before and 90 days after a hospital stay, and adds 10% of the base sum insured each year up to 100%. There is no restore benefit. Maternity is covered only on the Exclusive plan, after a 4-year wait for sum insured of ₹15 lakh and above or a 6-year wait below that. The Standard plan does not cover maternity.",
    sections: [
      {
        h2: "Standard vs Exclusive",
        table: {
          head: ["", "Standard", "Exclusive"],
          rows: [
            ["Sum insured (individual)", "₹1 lakh to ₹15 lakh", "₹3 lakh to ₹50 lakh"],
            ["Room rent", "No limit stated", "No limit stated"],
            ["Daily cash for a shared room", "Yes, a fixed amount a day", "Yes, a fixed amount a day, higher on bigger covers"],
            ["Maternity", "Not covered", "₹15,000 to ₹50,000 a delivery, 4 or 6-year wait"],
            ["Emergency air ambulance", "Not covered", "Up to ₹2.5 lakh per hospitalisation (higher covers)"],
            ["Road ambulance", "₹2,000 per hospitalisation", "₹2,000 per hospitalisation"],
          ],
        },
      },
      {
        h2: "What both plans include",
        bullets: [
          "Cumulative bonus: 10% of the base sum insured each year, up to 100%, irrespective of claims.",
          "Day-care treatment, treatment at home, AYUSH and organ donor costs.",
          "An optional Critical Illness cover that pays 50% or 100% of the in-patient sum insured.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months."],
            ["Listed illnesses and surgeries", "24 months."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "Does HDFC ERGO Easy Health have a room-rent limit?",
        answer: "No. The wording sets no room-rent limit. If you choose a shared room, you get a daily cash amount instead.",
      },
      {
        question: "Does Easy Health cover maternity?",
        answer: "Only the Exclusive plan, after a 4-year wait (sum insured ₹15 lakh and above) or 6 years (below that). The Standard plan does not cover maternity.",
      },
      {
        question: "Does Easy Health have a restore benefit?",
        answer: "No. The wording has no restore or recharge benefit.",
      },
    ],
    sources: [
      {
        document: "HDFC ERGO Easy Health policy wording",
        uin: "HDFHLIP26054V102526",
        clauses: "Section 1 in-patient, Schedule of Benefits (Individual and Family), 5.1 Cumulative Bonus, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "maternity-cover", "no-claim-bonus", "pre-existing-disease-waiting-period"],
    related: ["hdfc-ergo-optima-restore"],
  },

  {
    slug: "hdfc-ergo-energy",
    primaryKeyword: "hdfc ergo energy plan diabetes health insurance review",
    sheetRows: [
      { keyword: "hdfc ergo energy plan diabetes health insurance review", evidence: "Editorial topic candidate" },
      { keyword: "hdfc ergo energy gold", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "review",
    insurers: ["HDFC ERGO"],
    title: "HDFC ERGO Energy: Health Plan for Diabetes | IndSure",
    description:
      "IndSure reads the HDFC ERGO Energy wording: cover for diabetes and high blood pressure without the PED wait, HbA1C refunds, restore and limits.",
    h1: "HDFC ERGO Energy: health insurance for diabetes and high blood pressure",
    answer:
      "Energy (UIN HDFHLIP26048V052526) is for people with type 1 or type 2 diabetes, pre-diabetes (IFG or IGT) or high blood pressure. Those conditions and their complications are not part of the 24-month pre-existing disease wait. Other pre-existing diseases still wait 24 months. Room and ICU have no stated limit, it pays 30 days before and 60 days after a hospital stay, and restores your cover once a year.",
    sections: [
      {
        h2: "What makes Energy different",
        bullets: [
          "Diabetes, IFG, IGT and high blood pressure, and anything arising from them, are carved out of the pre-existing disease waiting period.",
          "HbA1C check-ups: up to ₹750 per test, twice a year, at least 3 months apart.",
          "A wellness programme for diabetes and high blood pressure that can earn a renewal discount.",
          "Gold and Silver plans share the same wording; they differ in the wellness programme.",
        ],
      },
      {
        h2: "Key limits",
        table: {
          head: ["Item", "What the wording says"],
          rows: [
            ["Room and ICU", "No limit stated."],
            ["Co-payment", "None by default. A 20% co-payment applies only if you choose it."],
            ["Road ambulance", "₹2,000 per hospitalisation."],
            ["Before and after a hospital stay", "30 days and 60 days."],
            ["Bonus", "10% of the base sum insured a year, up to 100%, irrespective of claims."],
            ["Restore", "100% of the base sum insured once a year."],
          ],
        },
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "24 months, except diabetes, IFG, IGT and high blood pressure."],
            ["Listed illnesses and surgeries", "24 months."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "Does HDFC ERGO Energy cover diabetes from day 1?",
        answer: "Diabetes and high blood pressure are not part of its pre-existing disease wait. The 30-day initial wait for illness still applies to a new policy.",
      },
      {
        question: "Is there a waiting period for other pre-existing diseases in Energy?",
        answer: "Yes, 24 months of continuous cover.",
      },
      {
        question: "Does Energy pay for HbA1C tests?",
        answer: "Yes, up to ₹750 per test, twice a policy year, with at least 3 months between tests.",
      },
    ],
    sources: [
      {
        document: "HDFC ERGO Energy policy wording",
        uin: "HDFHLIP26048V052526",
        clauses: "Section B, 1 Restore benefit, 2 HbA1C Checkup, 2 Cumulative Bonus, C.1 Excl01 carve-out, 15 Co-payment",
      },
    ],
    checkedOn,
    learn: ["pre-existing-disease-waiting-period", "restoration-benefit", "no-claim-bonus"],
    related: ["hdfc-ergo-optima-restore"],
  },

  {
    slug: "hdfc-ergo-optima-senior",
    primaryKeyword: "hdfc ergo senior citizen health insurance",
    sheetRows: [{ keyword: "hdfc ergo senior citizen health insurance", evidence: "Editorial topic candidate" }],
    kind: "plan",
    insurers: ["HDFC ERGO"],
    title: "HDFC ERGO Optima Senior: Co-pay by Room Type | IndSure",
    description:
      "IndSure reads the HDFC ERGO Optima Senior wording: 15% or 30% co-pay by room type, 30% on 14 surgeries, 36-month PED wait, no bonus.",
    h1: "HDFC ERGO Optima Senior: co-payment, waits and what it covers",
    answer:
      "Optima Senior (UIN HDHHLIP21379V022021) has no room-rent limit, but the room sets your co-payment: 15% of every claim in a shared room and 30% in a single room or higher. 14 listed illnesses and surgeries, including cataract, joint replacement and bypass surgery, carry a 30% co-payment. Pre-existing diseases wait 36 months. There is no cumulative bonus, only a 5% renewal premium discount after a claim-free year.",
    sections: [
      {
        h2: "The co-payment rules",
        bullets: [
          "Shared room or lower: 15% of each claim.",
          "Single room or higher: 30% of each claim. If you need urgent cardiac or accident care and no shared room is free, 15% applies.",
          "Day-care procedures: 15%.",
          "30% on 14 listed illnesses and surgeries: cataract, hysterectomy, gall bladder removal, prostate surgery, hernia, angiography, arthroscopy, disc surgery, mastectomy, joint replacement, angioplasty, hydrocele, major organ transplant and bypass surgery.",
        ],
      },
      {
        h2: "What it covers",
        table: {
          head: ["Item", "What the wording says"],
          rows: [
            ["Room and ICU", "No limit, but the room type sets the co-payment."],
            ["Before and after a hospital stay", "30 days and 60 days."],
            ["Road ambulance", "₹2,000 per hospitalisation."],
            ["Treatment at home", "Covered for more than 3 days."],
            ["Bonus", "None. A 5% renewal premium discount after a claim-free year."],
            ["Restore", "None."],
          ],
        },
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days."],
            ["Pre-existing diseases", "36 months."],
            ["Listed illnesses and surgeries", "24 months."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "What is the co-payment in HDFC ERGO Optima Senior?",
        answer: "15% in a shared room and 30% in a single room or higher, plus 30% for 14 listed surgeries such as cataract and joint replacement.",
      },
      {
        question: "Does Optima Senior give a no-claim bonus?",
        answer: "No cumulative bonus. You get a 5% discount on the renewal premium after a claim-free year.",
      },
      {
        question: "What is the pre-existing disease waiting period in Optima Senior?",
        answer: "36 months of continuous cover.",
      },
    ],
    sources: [
      {
        document: "HDFC ERGO Optima Senior policy wording",
        uin: "HDHHLIP21379V022021",
        clauses: "Section B, Co-Payment A and B, No Claim Discount, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["co-pay", "room-rent-cap", "pre-existing-disease-waiting-period", "no-claim-bonus"],
    related: ["niva-bupa-senior-first"],
  },
];
