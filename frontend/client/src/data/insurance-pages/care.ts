// Care Health plan pages. Facts from the policy wordings, checked in the
// 9 Oct 2026 catalogue audit (E:/_audit/ledger). See ../insurance-pages.ts for the rules.
import type { InsurancePage } from "../insurance-pages";

const checkedOn = "2026-10-09";

export const CARE_PAGES: InsurancePage[] = [
  {
    slug: "care-supreme",
    primaryKeyword: "care supreme health insurance",
    sheetRows: [
      { keyword: "care supreme health insurance", evidence: "Google Autocomplete observed" },
      { keyword: "care supreme", evidence: "Insurer/product/glossary candidate" },
      { keyword: "care insurance care supreme", evidence: "Insurer/product/glossary candidate" },
      { keyword: "care supreme plan review", evidence: "Editorial topic candidate" },
      { keyword: "care supreme policy wording", evidence: "Editorial topic candidate" },
      { keyword: "is care supreme health insurance good one", evidence: "Real forum question/topic" },
      { keyword: "care insurance care supreme with instant cover rider", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "plan",
    insurers: ["Care Health"],
    title: "Care Supreme Health Insurance: Benefits and Limits | IndSure",
    description:
      "IndSure reads the Care Supreme policy wording: no room-rent limit, 50% yearly bonus that a claim does not cut, unlimited recharge, waiting periods.",
    h1: "Care Supreme health insurance: what the policy wording covers",
    answer:
      "Care Supreme (UIN CHIHLIP27061V032627) has no room-rent or ICU limit, no co-payment and no disease-wise sub-limits in the base plan. It pays 60 days of costs before a hospital stay and 180 days after. Your cover grows by 50% of the sum insured each year up to 100%, and a claim does not reduce that bonus. Pre-existing diseases wait 36 months. Maternity is not covered.",
    sections: [
      {
        h2: "What the base plan pays for",
        bullets: [
          "Any hospital room and ICU, with no limit.",
          "Road ambulance up to the sum insured, as part of the hospital claim.",
          "All day-care treatments, AYUSH treatment in an AYUSH hospital, and treatment at home when you cannot be moved for more than 3 days.",
          "12 listed modern treatments, such as robotic surgery and oral chemotherapy, up to the sum insured.",
          "Your organ donor's surgery costs. The donor's costs after the organ is taken out are not paid.",
        ],
      },
      {
        h2: "How your cover grows",
        body: [
          "Cumulative bonus: 50% of the sum insured is added each policy year, up to 100%. The wording says a claim does not stop this bonus from building.",
          "Unlimited Automatic Recharge: once your base cover and bonus are used up in a year, the base sum insured is refilled as many times as needed that year, for the same illness or a new one. It does not carry over to the next year.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months. An add-on can shorten it, and Instant Cover starts diabetes, high blood pressure, high cholesterol and asthma cover from day 31."],
            ["Listed illnesses and surgeries", "24 months, for things like cataract, hernia and joint replacement. An add-on can shorten it."],
          ],
        },
      },
      {
        h2: "Add-ons, and what they change at claim time",
        bullets: [
          "Room Rent Modification: limits you to a single private or twin-sharing room for a lower premium. ICU stays unlimited.",
          "Claim Shield: pays for items a hospital bill normally leaves out, like gloves and other consumables.",
          "Cumulative Bonus Super: adds more bonus on top of the base 50% a year.",
          "Co-payment or deductible options lower the premium, but you then pay part of every claim.",
          "Smart Select: a lower premium, but a 20% co-payment at hospitals outside its list.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Care Supreme have a room-rent limit?",
        answer: "No. The base plan pays any room and ICU. A room limit applies only if you choose the Room Rent Modification add-on.",
      },
      {
        question: "Does a claim reduce the Care Supreme bonus?",
        answer: "No. The wording says the 50% yearly cumulative bonus keeps building even if you claim, up to 100% of the sum insured.",
      },
      {
        question: "Does Care Supreme cover maternity?",
        answer: "No. Maternity is a standard exclusion and the plan has no maternity add-on. An ectopic pregnancy is still covered.",
      },
      {
        question: "Is Care Supreme Senior the same plan?",
        answer: "No. This page covers Care Supreme, UIN CHIHLIP27061V032627. Senior and super top-up versions sold under similar names have their own wordings.",
      },
    ],
    sources: [
      {
        document: "Care Supreme policy terms and conditions (effective 29 April 2026)",
        uin: "CHIHLIP27061V032627",
        clauses: "3.1.1, 3.1.3, 3.1.4, 3.2.6, 3.2.7, 3.2.17, 4.1(a) Excl01 to Excl03, Excl18",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "no-claim-bonus", "restoration-benefit", "pre-existing-disease-waiting-period", "consumables-non-payable"],
    related: ["care-supreme-vs-niva-bupa-reassure-3", "care-ultimate-care", "care-advantage"],
  },

  {
    slug: "care-freedom",
    primaryKeyword: "care freedom",
    sheetRows: [
      { keyword: "care freedom", evidence: "Editorial topic candidate" },
      { keyword: "care freedom plan", evidence: "Insurer/product/glossary candidate" },
      { keyword: "care health care freedom", evidence: "Insurer/product/glossary candidate" },
      { keyword: "care insurance care freedom plan 1", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "plan",
    insurers: ["Care Health"],
    title: "Care Freedom Health Insurance: Co-pay and Limits | IndSure",
    description:
      "IndSure reads the Care Freedom policy wording: co-payment on every claim, room and ICU options, 24-month waits, disease sub-limits and recharge.",
    h1: "Care Freedom: co-payment, limits and waiting periods in the wording",
    answer:
      "Care Freedom (UIN CHIHLIP26052V032526) makes you pay a share of every claim: the co-payment set in your policy schedule, such as 20% or 30%, plus 10% more each year after the eldest insured turns 71. Pre-existing diseases and listed illnesses both wait 24 months. Room rent is 1% of the sum insured a day or a fixed room category, named illnesses have their own caps, and there is no bonus for a claim-free year.",
    sections: [
      {
        h2: "Limits that apply to every claim",
        table: {
          head: ["Item", "What the wording says"],
          rows: [
            ["Co-payment", "As set in your schedule (for example 20% or 30%), on every claim. It rises by 10% after the eldest insured turns 71, unless you paid to waive that and joined at 70 or below."],
            ["Hospital room", "Your schedule sets one: 1% of the sum insured a day, twin sharing, or a single private AC room. A higher room means a cut on the whole bill."],
            ["ICU", "2% of the sum insured a day, or no limit, as your schedule says."],
            ["Named illnesses", "Cataract, knee replacement, hernia, hysterectomy, prostate, kidney stones, heart and brain conditions, cancer, kidney complications and fractures each have a cap in the schedule."],
            ["Before and after a hospital stay", "Paid up to a rupee amount in the schedule. The wording sets no number of days."],
            ["Treatment at home", "Up to 10% of the sum insured, for treatment over 3 days."],
          ],
        },
      },
      {
        h2: "What else is in the plan",
        bullets: [
          "Recharge: once your sum insured is used up, it is refilled once a year, but not for an illness you already claimed for that year.",
          "Consumable Allowance: a fixed daily amount from the 4th to the 7th day of a stay. It does not pay the items a bill normally leaves out.",
          "12 listed modern treatments are covered. Other advanced treatments are not.",
          "No cumulative bonus. The wording has no bonus for a claim-free year.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "24 months."],
            ["Listed illnesses and surgeries", "24 months."],
          ],
        },
      },
      {
        h2: "What Care Freedom does not cover",
        bullets: [
          "Maternity. An ectopic pregnancy is covered as a hospital stay.",
          "Your organ donor's costs. The wording excludes them.",
          "Treatment outside India.",
          "16 named conditions are permanently excluded if you had them before buying, such as unoperated varicose veins, kidney stones and retinal detachment. Read the exclusion list in the wording before you buy.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Care Freedom have a co-payment?",
        answer: "Yes, on every claim. The percentage is in your policy schedule, for example 20% or 30%, and it rises by 10% after the eldest insured turns 71.",
      },
      {
        question: "What is the pre-existing disease waiting period in Care Freedom?",
        answer: "24 months of continuous cover. Listed illnesses like cataract and hernia also wait 24 months.",
      },
      {
        question: "Does Care Freedom give a no-claim bonus?",
        answer: "No. The wording has no cumulative or no-claim bonus.",
      },
      {
        question: "How many days before and after hospital does Care Freedom pay?",
        answer: "The wording does not set a number of days. It pays these costs up to a rupee amount shown in your schedule of benefits.",
      },
    ],
    sources: [
      {
        document: "Care Freedom policy terms and conditions (effective 3 September 2025)",
        uin: "CHIHLIP26052V032526",
        clauses: "3.1.1, 3.1.2, 3.1.4, 3.1.6, 3.1.7, 4.1 Excl01, Excl02, Excl18, 4.2(i)(12)",
      },
    ],
    checkedOn,
    learn: ["co-pay", "sub-limit", "room-rent-cap", "proportionate-deduction", "pre-existing-disease-waiting-period"],
    related: ["care-heart", "care-supreme"],
  },

  {
    slug: "care-advantage",
    primaryKeyword: "care advantage health insurance",
    sheetRows: [
      { keyword: "care advantage health insurance", evidence: "Real forum question/topic" },
      { keyword: "care advantage", evidence: "Insurer/product/glossary candidate" },
      { keyword: "care advantage health insurance plan review", evidence: "Editorial topic candidate" },
      { keyword: "care advantage policy wording", evidence: "Editorial topic candidate" },
      { keyword: "are there any hidden tnc in care advantage health plan with cover of rs 50 lakhs", evidence: "Real forum question/topic" },
    ],
    kind: "plan",
    insurers: ["Care Health"],
    title: "Care Advantage Health Insurance: Wording Explained | IndSure",
    description:
      "IndSure reads the Care Advantage policy wording: no room or ICU limit, 10% yearly bonus up to 50%, one recharge a year, 30 and 60 days pre and post.",
    h1: "Care Advantage: what the policy wording covers, and the fine print",
    answer:
      "Care Advantage (UIN CHIHLIP27062V052627) has no room-rent or ICU limit, no co-payment and no disease-wise sub-limits in the base plan. It pays 30 days of costs before a hospital stay and 60 days after, which is shorter than many newer plans. The bonus is 10% of the sum insured a year up to 50%, and the sum insured is refilled once a year after it runs out.",
    sections: [
      {
        h2: "The fine print people ask about",
        bullets: [
          "Pre and post hospital cover is 30 and 60 days. An add-on can lengthen it.",
          "The bonus grows 10% a year up to 50%, and a claim reduces it at the same rate. The paid NCB Super add-on adds more.",
          "Recharge refills the base sum insured once a year after it is used up, for the same illness or a new one. Unlimited recharge is an add-on.",
          "Treatment at home is not covered.",
          "Items a hospital bill normally leaves out, like gloves, are not paid, and the plan has no add-on for them.",
          "Maternity is not covered and has no add-on.",
        ],
      },
      {
        h2: "What the base plan pays for",
        bullets: [
          "Any room and ICU, with no sub-limit (clause 3.1.1).",
          "541 listed day-care procedures.",
          "12 listed modern treatments, like robotic surgery and stem cell therapy, up to the sum insured.",
          "AYUSH treatment in an AYUSH hospital, up to the sum insured.",
          "Organ donor costs and road ambulance, up to the amounts in your schedule.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months, or 24 months with Optional Cover 5."],
            ["Listed illnesses and surgeries", "24 months."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "Are there hidden terms in Care Advantage?",
        answer: "Nothing is hidden, but check three things in the wording: pre and post hospital cover is only 30 and 60 days, the bonus is 10% a year up to 50% and drops after a claim, and treatment at home is not covered.",
      },
      {
        question: "Does Care Advantage have a room-rent limit?",
        answer: "No. Room and ICU have no sub-limit in the base plan. Optional Cover 8 can limit you to a single private room for a lower premium.",
      },
      {
        question: "How does the recharge work in Care Advantage?",
        answer: "After your sum insured is used up, it is refilled once in the policy year, for the same illness or a new one. Unlimited recharge is a paid add-on.",
      },
      {
        question: "Does Care Advantage cover maternity?",
        answer: "No. Maternity is excluded, and the plan has no maternity add-on.",
      },
    ],
    sources: [
      {
        document: "Care Advantage policy terms and conditions (effective 2 June 2026)",
        uin: "CHIHLIP27062V052627",
        clauses: "3.1.1, 3.1.3 to 3.1.7, Optional Covers 1, 5, 8, 11, 13, Excl01, Excl02, Excl18, 6.1.7",
      },
    ],
    checkedOn,
    learn: ["no-claim-bonus", "restoration-benefit", "pre-post-hospitalisation", "domiciliary-hospitalisation", "consumables-non-payable"],
    related: ["care-supreme", "care-ultimate-care"],
  },

  {
    slug: "care-heart",
    primaryKeyword: "care heart",
    sheetRows: [
      { keyword: "care heart", evidence: "Insurer/product/glossary candidate" },
      { keyword: "care heart review", evidence: "Editorial topic candidate" },
      { keyword: "care insurance care heart", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "plan",
    insurers: ["Care Health"],
    title: "Care Heart Insurance Plan: Co-pay and Waits | IndSure",
    description:
      "IndSure reads the Care Heart policy wording: co-payment on every claim, 24-month pre-existing wait, room and ICU options, sub-limits and recharge.",
    h1: "Care Heart: what the policy wording covers",
    answer:
      "Care Heart (UIN CHIHLIP26053V032526) has a co-payment on every claim, set in your schedule, which goes up by 10% after the eldest insured turns 71. Pre-existing diseases and listed illnesses both wait 24 months. Your room is a single private room or 1% of the sum insured a day, and named illnesses have their own caps. It pays 30 days before and 60 days after a hospital stay.",
    sections: [
      {
        h2: "Key limits",
        table: {
          head: ["Item", "What the wording says"],
          rows: [
            ["Co-payment", "As in your schedule, on hospital, pre and post, AYUSH and ambulance claims. Plus 10% after the eldest insured turns 71, unless you joined at 70 or below and paid to waive it."],
            ["Hospital room", "Single private room, or up to 1% of the sum insured a day, as your schedule says."],
            ["ICU", "Up to 2% of the sum insured a day, or no limit, as your schedule says."],
            ["Named illnesses", "Cataract, knee replacement, hernia, hysterectomy, prostate, kidney stones, stroke, cancer, kidney complications and fractures have caps in the schedule."],
            ["Before and after a hospital stay", "30 days and 60 days."],
          ],
        },
      },
      {
        h2: "Bonus, recharge and check-ups",
        bullets: [
          "No claims bonus: 10% of the sum insured for each claim-free year, up to 50%. It drops by 10% after a year with a claim, but never below your base cover.",
          "Automatic Recharge: refills the sum insured once a year after it runs out, but only for a different illness from the one that used it up.",
          "A cardiac health check-up is part of the plan.",
          "Treatment at home is covered if it runs more than 3 days, except for 12 listed conditions like diabetes and high blood pressure.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "24 months."],
            ["Listed illnesses and surgeries", "24 months. If a condition is also pre-existing, the longer wait applies."],
          ],
        },
      },
      {
        h2: "Not covered",
        bullets: [
          "Maternity, with no add-on.",
          "Your organ donor's costs.",
          "Advanced treatments other than the 12 listed methods.",
          "Treatment outside India.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Care Heart have a co-payment?",
        answer: "Yes. Every claim has the co-payment in your schedule, and it rises by 10% after the eldest insured turns 71.",
      },
      {
        question: "What is the waiting period for pre-existing diseases in Care Heart?",
        answer: "24 months of continuous cover.",
      },
      {
        question: "Does Care Heart cover organ transplant donors?",
        answer: "No. The wording excludes the donor's treatment and surgery costs.",
      },
      {
        question: "How does the recharge work in Care Heart?",
        answer: "Once a year, after your sum insured and bonus are used up, it refills up to the base sum insured, but only for an illness different from the one that used it up.",
      },
    ],
    sources: [
      {
        document: "Care Heart policy terms and conditions (effective 3 September 2025)",
        uin: "CHIHLIP26053V032526",
        clauses: "3.1.1 to 3.1.8, Excl01, Excl02, Excl18, 4.2(a)(12)",
      },
    ],
    checkedOn,
    learn: ["co-pay", "sub-limit", "room-rent-cap", "restoration-benefit", "pre-existing-disease-waiting-period"],
    related: ["care-freedom", "care-classic"],
  },

  {
    slug: "care-plus",
    primaryKeyword: "care plus health insurance",
    sheetRows: [
      { keyword: "care plus health insurance", evidence: "Real forum question/topic" },
      { keyword: "care plus", evidence: "Insurer/product/glossary candidate" },
      { keyword: "care insurance care plus", evidence: "Insurer/product/glossary candidate" },
      { keyword: "care plus youth", evidence: "Insurer/product/glossary candidate" },
      { keyword: "care plus complete", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "plan",
    insurers: ["Care Health"],
    title: "Care Plus Health Insurance: Benefits and Limits | IndSure",
    description:
      "IndSure reads the Care Plus policy wording: 50% yearly bonus up to 200%, unlimited recharge, room and ICU limits by sum insured, 36-month PED wait.",
    h1: "Care Plus health insurance: what the policy wording covers",
    answer:
      "Care Plus (UIN CHIHLIP22047V012122) adds a bonus of 50% of the sum insured for each claim-free year, up to 200%, and refills your base cover unlimited times a year. The room is a single private AC room, or 1% of the sum insured a day on smaller covers, with ICU at 2% a day in that case. It pays 60 days before and 90 days after a hospital stay. Pre-existing diseases wait 36 months.",
    sections: [
      {
        h2: "Key limits",
        table: {
          head: ["Item", "What the wording says"],
          rows: [
            ["Hospital room", "Single private AC room, or up to 1% of the sum insured a day, as your schedule says. The 1% limit is for covers under ₹5 lakh and can be upgraded."],
            ["ICU", "Up to 2% of the sum insured a day, or no limit. The 2% limit can be removed on covers under ₹5 lakh."],
            ["Co-payment", "None in the base plan. Smart Select adds 20% at non-network hospitals, and a co-payment option for age 61+ exists."],
            ["Before and after a hospital stay", "60 days and 90 days."],
          ],
        },
      },
      {
        h2: "How your cover grows",
        bullets: [
          "Cumulative bonus: 50% of the base sum insured each year with no claims, or with claims of up to 25% of the base cover, up to 200%. Bigger claims reduce it at the same rate.",
          "Unlimited Automatic Recharge: after base cover and bonus are used up, the base sum insured is refilled unlimited times a year, including for the same illness.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months."],
            ["Listed illnesses and surgeries", "24 months, for things like cataract, hernia, hysterectomy and kidney stones."],
            ["Maternity (add-on)", "24 months, for up to 2 living children."],
          ],
        },
      },
      {
        h2: "Not covered",
        bullets: [
          "Items a hospital bill normally leaves out, like gloves. There is no add-on for them.",
          "Treatment outside India.",
          "Maternity, unless you buy the Maternity and New Born Baby add-on.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is the no-claim bonus in Care Plus?",
        answer: "50% of the base sum insured each claim-free year, up to 200%. A claim of up to 25% of your base cover still counts as claim-free.",
      },
      {
        question: "Does Care Plus have a room-rent limit?",
        answer: "It depends on your schedule: a single private AC room, or 1% of the sum insured a day on covers under ₹5 lakh. Staying in a higher room means a cut on the related bill.",
      },
      {
        question: "Does Care Plus cover maternity?",
        answer: "Only with the Maternity and New Born Baby add-on, after a 24-month wait.",
      },
      {
        question: "What is the pre-existing disease waiting period in Care Plus?",
        answer: "36 months of continuous cover.",
      },
    ],
    sources: [
      {
        document: "Care Plus policy terms and conditions (effective 29 September 2024)",
        uin: "CHIHLIP22047V012122",
        clauses: "3.1.1, 3.1.7, 3.1.8, 3.2.1, 3.2.7, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["no-claim-bonus", "restoration-benefit", "room-rent-cap", "proportionate-deduction", "maternity-cover"],
    related: ["care-classic", "care-supreme"],
  },

  {
    slug: "care-classic",
    primaryKeyword: "care classic",
    sheetRows: [{ keyword: "care classic", evidence: "Insurer/product/glossary candidate" }],
    kind: "plan",
    insurers: ["Care Health"],
    title: "Care Classic Health Insurance: Wording Explained | IndSure",
    description:
      "IndSure reads the Care Classic policy wording: 25% yearly bonus up to 150%, unlimited recharge, 20% co-pay if you join at 61+, room limits and waits.",
    h1: "Care Classic: what the policy wording covers",
    answer:
      "Care Classic (UIN CHIHLIP26048V022526) adds 25% of the sum insured for each claim-free year, up to 150%, and refills your base cover unlimited times a year. Anyone who is 61 or older when the policy is first issued pays 20% of every claim. The room is a single private AC room or 1% of the sum insured a day, and cataract and modern treatments have caps. It pays 60 days before and 90 days after a hospital stay.",
    sections: [
      {
        h2: "Key limits",
        table: {
          head: ["Item", "What the wording says"],
          rows: [
            ["Co-payment", "20% on every claim if the insured, or the eldest on a family plan, is 61+ at first issue. A paid waiver can remove it."],
            ["Hospital room", "Single private AC room, or up to 1% of the sum insured a day, as your schedule says. The 1% limit applies under ₹5 lakh cover and can be upgraded."],
            ["ICU", "Up to 2% of the sum insured a day, or no limit."],
            ["Cataract and modern treatments", "Capped at the amounts in your schedule. A paid add-on removes these caps."],
            ["Before and after a hospital stay", "60 days and 90 days."],
          ],
        },
      },
      {
        h2: "How your cover grows",
        bullets: [
          "No claims bonus: 25% of the sum insured for each claim-free year, up to 150%. A claim reduces it at the same rate.",
          "Unlimited Automatic Recharge: after base cover, bonus and any accident cover are used up, the base sum insured is refilled unlimited times that year, for the same or a different illness.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months, or 24 with an add-on. Instant Cover starts diabetes, high blood pressure, cholesterol and asthma cover early."],
            ["Listed illnesses and surgeries", "24 months."],
            ["Maternity (add-on)", "24 months, for up to 2 living children."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "Does Care Classic have a co-payment?",
        answer: "Only if the insured, or the eldest member of a family plan, is 61 or older when the policy is first issued. Then 20% of every claim is yours, unless you buy the waiver.",
      },
      {
        question: "What is the bonus in Care Classic?",
        answer: "25% of the sum insured for each claim-free year, up to 150%.",
      },
      {
        question: "Does Care Classic cover maternity?",
        answer: "Only through the Maternity and New Born Baby Cover add-on, after a 24-month wait.",
      },
      {
        question: "Are there sub-limits in Care Classic?",
        answer: "Yes. Cataract and the listed modern treatments are capped at the amounts in your schedule, unless you buy the waiver add-on.",
      },
    ],
    sources: [
      {
        document: "Care Classic policy terms and conditions (effective 9 April 2025)",
        uin: "CHIHLIP26048V022526",
        clauses: "3.1.1 (vii), 3.1.3, 3.1.5, 3.2 optional benefits incl. 3.2.4, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["co-pay", "no-claim-bonus", "restoration-benefit", "sub-limit", "room-rent-cap"],
    related: ["care-plus", "care-heart"],
  },

  {
    slug: "care-ultimate-care",
    primaryKeyword: "care insurance ultimate care",
    sheetRows: [
      { keyword: "care insurance ultimate care", evidence: "Insurer/product/glossary candidate" },
      { keyword: "ultimate care", evidence: "Insurer/product/glossary candidate" },
      { keyword: "ultimate care plan customised review", evidence: "Editorial topic candidate" },
      { keyword: "clarification required for unlimited automatic recharge in care health ultimate care policy", evidence: "Real forum question/topic" },
    ],
    kind: "plan",
    insurers: ["Care Health"],
    title: "Care Ultimate Care Plan: Recharge and Benefits | IndSure",
    description:
      "IndSure reads the Care Ultimate Care policy wording: no room limit, 50% yearly bonus even in claim years, unlimited recharge from the 2nd claim.",
    h1: "Care Ultimate Care: what the policy wording covers",
    answer:
      "Ultimate Care (UIN CHIHLIP26058V022526) has no room-rent, ICU or co-payment limit in the base plan. It adds 50% of the sum insured as bonus every completed year, even a year with claims, up to 100%. Unlimited Automatic Recharge refills the base cover any number of times in a year, starting from the second claim of that year. It pays 60 days before and 90 days after a hospital stay.",
    sections: [
      {
        h2: "How the Unlimited Automatic Recharge works",
        body: [
          "This is the clause people ask about most. After your base sum insured is used up in a year, it is refilled up to the full base sum insured, as many times as needed that year, for the same illness or a different one. It applies from the second claim in a policy year, not the first. Unused recharge does not carry over.",
          "The optional Unlimited Automatic Recharge Booster makes the refill available from the first claim in the life of the policy.",
        ],
      },
      {
        h2: "What the base plan pays for",
        bullets: [
          "Any room and ICU, with no limit. The Room Rent Modification add-on can lower this for a lower premium.",
          "Road, air and train ambulance, up to the sum insured.",
          "All day-care treatments, treatment at home over 3 days, and AYUSH stays of at least 24 hours.",
          "12 listed modern treatments and organ donor costs, up to the sum insured.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. An add-on can change it."],
            ["Pre-existing diseases", "36 months. Add-ons can shorten it or start cover early for some conditions."],
            ["Listed illnesses and surgeries", "24 months."],
            ["Maternity (add-on)", "As set in your schedule, for ages 18 to 45."],
          ],
        },
      },
      {
        h2: "Add-ons",
        bullets: [
          "Infinity Bonus: more bonus each year on top of the base 50%.",
          "Claim Shield: pays for items a hospital bill normally leaves out.",
          "Travel Plus: emergency treatment outside India for a set number of days a year.",
          "Maternity Cover, Cancer Care, Inflation Shield, deductible and co-payment options.",
        ],
      },
    ],
    faqs: [
      {
        question: "When does the recharge start in Care Ultimate Care?",
        answer: "From the second claim in a policy year, after your base cover is used up. The Booster add-on makes it available from the first claim.",
      },
      {
        question: "Does Ultimate Care have a room-rent limit?",
        answer: "No. Room and ICU have no limit in the base plan.",
      },
      {
        question: "Does a claim stop the Ultimate Care bonus?",
        answer: "No. The wording adds 50% of the sum insured for each completed year, including years with a claim, up to 100%.",
      },
      {
        question: "Does Ultimate Care cover maternity?",
        answer: "Only through the Maternity Cover add-on, with the waiting period in your schedule.",
      },
    ],
    sources: [
      {
        document: "Care Ultimate Care policy terms and conditions (effective 16 January 2026)",
        uin: "CHIHLIP26058V022526",
        clauses: "3.1 base benefits, 3.2.11, 3.2.15, 3.2.28, 3.2.29, 3.2.39, Excl01 to Excl03",
      },
    ],
    checkedOn,
    learn: ["restoration-benefit", "no-claim-bonus", "room-rent-cap", "maternity-cover", "consumables-non-payable"],
    related: ["care-supreme", "care-advantage"],
  },
];
