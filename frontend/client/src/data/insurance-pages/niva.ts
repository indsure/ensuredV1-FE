// Niva Bupa plan pages. Facts from the policy wordings, checked in the
// 9 Oct 2026 catalogue audit (E:/_audit/ledger). See ../insurance-pages.ts for the rules.
import type { InsurancePage } from "../insurance-pages";

const checkedOn = "2026-10-09";

export const NIVA_PAGES: InsurancePage[] = [
  {
    slug: "niva-bupa-reassure-2",
    primaryKeyword: "benefits of niva bupa reassure 2.0",
    sheetRows: [
      { keyword: "benefits of niva bupa reassure 2.0", evidence: "Google Autocomplete observed" },
      { keyword: "brochure of niva bupa reassure 2.0", evidence: "Google Autocomplete observed" },
      { keyword: "niva bupa reassure 2 0 review", evidence: "Editorial topic candidate" },
      { keyword: "niva bupa reassure 2.0 policy wording", evidence: "Editorial topic candidate" },
      { keyword: "lock your health insurance premium niva bupa reassure 2.0", evidence: "Editorial topic candidate" },
      { keyword: "max bupa reassure 2 10 x cover and lock the clock", evidence: "Real forum question/topic" },
      { keyword: "niva bupa titanium reassure2 0", evidence: "Real forum question/topic" },
      { keyword: "robotic surgery sublimit clause in niva bupa reassure plan", evidence: "Real forum question/topic" },
    ],
    kind: "plan",
    insurers: ["Niva Bupa"],
    title: "Niva Bupa ReAssure 2.0: Benefits and Booster+ | IndSure",
    description:
      "IndSure reads the Niva Bupa ReAssure 2.0 policy wording: any room, Booster+ up to 10x, ReAssure Forever, Lock the Clock and waiting periods.",
    h1: "Niva Bupa ReAssure 2.0: benefits, Booster+ and Lock the Clock",
    answer:
      "ReAssure 2.0 (UIN NBHHLIP27054V032627) lets you choose any room, with no co-payment in the base plan. It pays 60 days before and 180 days after a hospital stay. Unused base cover carries forward through Booster+, up to 3, 5 or 10 times the base sum insured depending on the plan. After your first paid claim, ReAssure Forever refills your cover for every later claim for life. Pre-existing diseases wait 36 months. Maternity is not covered.",
    sections: [
      {
        h2: "What the base plan pays for",
        bullets: [
          "Any room you choose. The wording says: choose the room you like, but choose judiciously to protect your sum insured.",
          "Stays of 2 hours or more, so day-care treatment is covered. AYUSH needs 24 hours in an AYUSH hospital.",
          "12 listed modern treatments, including robotic surgery, with no separate limit stated in the wording.",
          "Road ambulance up to the sum insured, and air ambulance in an emergency up to ₹2.5 lakh per hospitalisation.",
          "Treatment at home, organ donor costs, and your own costs if you donate an organ.",
          "Cataract: for sum insured up to ₹10 lakh, only a mono-focal lens is paid.",
        ],
      },
      {
        h2: "Booster+, ReAssure Forever and Lock the Clock",
        body: [
          "Booster+: base sum insured you do not use in a year is carried forward, up to 3, 5 or 10 times the base sum insured, depending on the plan you chose.",
          "ReAssure Forever (as ReAssure+ or ReAssureX): your first paid claim switches it on, and it stays for life as long as you renew without a break. Each later claim can use up to your base sum insured from it.",
          "Lock the Clock: your premium age is locked at the age you joined, until a claim is paid.",
          "Live Healthy: walking earns health points that can cut the renewal premium by up to 30%.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months. An add-on, chosen at purchase, can change it."],
            ["Listed illnesses and surgeries", "24 months. Cancer after 30 days, accidents from day 1."],
          ],
        },
      },
      {
        h2: "Add-ons",
        bullets: [
          "Safeguard and Safeguard+: pay for items a hospital bill normally leaves out.",
          "Room Type Modification, Annual Aggregate Deductible and Co-Payment: lower premium, but you take on more of the bill.",
          "Hospital Cash and Personal Accident.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is there a robotic surgery sub-limit in ReAssure 2.0?",
        answer: "The ReAssure 2.0 wording lists robotic surgery among 12 modern treatments and states no separate limit for it. Some other Niva Bupa plans, like Health Premia and Senior First, cap most robotic surgeries at ₹1 lakh.",
      },
      {
        question: "How much can Booster+ grow in ReAssure 2.0?",
        answer: "Up to 3, 5 or 10 times your base sum insured, depending on the plan you chose. It builds from base cover you did not use.",
      },
      {
        question: "What is Lock the Clock?",
        answer: "Your premium is charged at the age you joined until a claim is paid. After a paid claim, the age is unlocked.",
      },
      {
        question: "Is ReAssure 2.0 the same as ReAssure 3.0?",
        answer: "No. They are separate products with separate wordings. ReAssure 3.0 ties your room to a variant and uses a co-payment table if you stay in a higher room.",
      },
    ],
    sources: [
      {
        document: "Niva Bupa ReAssure 2.0 policy wording",
        uin: "NBHHLIP27054V032627",
        clauses: "4.1.2, 4.2.1, 4.2.2, 4.3, 4.4, 4.5, 4.7, 4.7.2, 4.8, 4.9, 4.10, 4.16 to 4.21",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "restoration-benefit", "no-claim-bonus", "pre-existing-disease-waiting-period", "consumables-non-payable"],
    related: ["niva-bupa-reassure-3", "niva-bupa-aspire"],
  },

  {
    slug: "niva-bupa-reassure-3",
    primaryKeyword: "niva bupa reassure 3 0 plan review",
    sheetRows: [{ keyword: "niva bupa reassure 3 0 plan review", evidence: "Editorial topic candidate" }],
    kind: "review",
    insurers: ["Niva Bupa"],
    title: "Niva Bupa ReAssure 3.0 Review: Rooms and Co-pay | IndSure",
    description:
      "IndSure reads the Niva Bupa ReAssure 3.0 wording: Classic, Select and Elite rooms, the room co-pay table, Booster+, ReAssure Forever and waits.",
    h1: "Niva Bupa ReAssure 3.0 review: what the policy wording says",
    answer:
      "ReAssure 3.0 (UIN NBHHLIP26047V012526) comes in three variants, Classic, Select and Elite, and the variant decides your room. Stay in a higher room than your variant allows and you pay 20% to 50% of the whole claim. It pays 60 days before and 180 days after a hospital stay, waits 36 months for pre-existing diseases, and does not cover maternity.",
    sections: [
      {
        h2: "The room rule (Annexure V)",
        body: ["The co-payment applies to the entire claim, not just the room charge."],
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
        h2: "Other things that change by variant",
        bullets: [
          "Modern treatments like robotic surgery have a sub-limit on Classic and Select. Elite, or the Modern Treatments+ add-on, removes it.",
          "Cataract on Classic and Select pays for a mono-focal lens only.",
          "The wording does not set a separate ICU limit.",
        ],
      },
      {
        h2: "How your cover grows",
        bullets: [
          "Booster+: unused base cover carries forward. The wording's example: ₹10 lakh on Elite with no claims for 10 years becomes ₹1.10 crore.",
          "ReAssure Forever: starts after your first paid claim and then pays up to your base sum insured for each later claim, for as long as you renew without a break.",
          "Lock the Clock: you pay the premium for your entry age until a claim is paid.",
        ],
      },
      {
        h2: "A rule many people miss",
        body: [
          "If a hospital stay goes past 7 days, tell Niva Bupa within 7 days of admission (9 days for road accidents). If you do not, an extra 10% co-payment applies to that claim.",
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
        question: "Which ReAssure 3.0 variant has no room co-payment?",
        answer: "None of them in every room. Elite has no co-payment up to any room except deluxe or suite, and 20% for deluxe or suite. Classic charges a co-payment for anything above a general ward.",
      },
      {
        question: "Does ReAssure 3.0 cover maternity or abortion?",
        answer: "No. Maternity is a standard exclusion, and medical termination of pregnancy is excluded. An ectopic pregnancy is covered.",
      },
      {
        question: "Is there a robotic surgery limit in ReAssure 3.0?",
        answer: "Yes on Classic and Select, which have a modern treatment sub-limit. Elite, or the Modern Treatments+ add-on, removes it.",
      },
      {
        question: "What happens if I report a long hospital stay late?",
        answer: "For a stay of over 7 days not reported within 7 days of admission (9 for road accidents), an extra 10% co-payment applies.",
      },
    ],
    sources: [
      {
        document: "Niva Bupa ReAssure 3.0 policy wording",
        uin: "NBHHLIP26047V012526",
        clauses: "4.2, 4.3, 4.6, 4.7, 4.8, 4.18, 4.54, 5.1.1 to 5.1.3, 5.1.16, claim procedure B, Annexure V",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "proportionate-deduction", "co-pay", "restoration-benefit", "claim-intimation-pre-authorisation"],
    related: ["care-supreme-vs-niva-bupa-reassure-3", "niva-bupa-reassure-2"],
  },

  {
    slug: "niva-bupa-health-companion",
    primaryKeyword: "niva bupa health companion",
    sheetRows: [
      { keyword: "niva bupa health companion", evidence: "Insurer/product/glossary candidate" },
      { keyword: "niva bupa health companion plan full review 2026", evidence: "Editorial topic candidate" },
      { keyword: "niva bupa health companion policy wording", evidence: "Editorial topic candidate" },
      { keyword: "niva bupa health companion variant 2022", evidence: "Real forum question/topic" },
      { keyword: "niva bupa health companion family first", evidence: "Real forum question/topic" },
    ],
    kind: "plan",
    insurers: ["Niva Bupa"],
    title: "Niva Bupa Health Companion: Variant 2022 vs 2023 | IndSure",
    description:
      "IndSure reads the Niva Bupa Health Companion wording: Variant 2023 shared-room cap and 20% co-pay, 20% yearly bonus, refill once a year, waits.",
    h1: "Niva Bupa Health Companion: what the policy wording covers",
    answer:
      "Health Companion (UIN NBHHLIP26051V092526) has two variants in one wording. Variant 2023 caps you at a shared room and charges a 20% co-payment if you take a higher room. The plan adds 20% of the base sum insured as bonus for each claim-free year, up to 100%, and refills your cover once a year after the first paid claim. It pays 60 days before and 180 days after a hospital stay. Pre-existing diseases wait 36 months.",
    sections: [
      {
        h2: "Variant 2022 vs Variant 2023",
        body: [
          "The wording covers both variants. The one rule it states separately is the room: for Variant 2023 there is a room cap up to a shared room, and a 20% co-payment applies if you stay in a higher room category. Check which variant your schedule shows.",
        ],
      },
      {
        h2: "Key limits",
        table: {
          head: ["Item", "What the wording says"],
          rows: [
            ["Hospital room", "Variant 2023: shared room, 20% co-payment for a higher room."],
            ["Road ambulance", "₹2,000 per hospitalisation."],
            ["Air ambulance", "₹2.5 lakh, emergencies only."],
            ["Before and after a hospital stay", "60 days and 180 days."],
            ["Bonus", "20% of base sum insured per claim-free year, up to 100%. Sub-limits do not grow with it."],
            ["Refill", "Once a year, equal to the base sum insured, for any illness, from the first paid claim."],
          ],
        },
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months."],
            ["Listed illnesses and surgeries", "24 months. Cancer after 30 days."],
          ],
        },
      },
      {
        h2: "Not covered",
        bullets: [
          "Maternity. An ectopic pregnancy is covered.",
          "Items a hospital bill normally leaves out, listed in Annexure I.",
          "Treatment outside India.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is the difference between Health Companion Variant 2022 and 2023?",
        answer: "The wording sets a shared-room cap for Variant 2023, with a 20% co-payment if you stay in a higher room. Your schedule shows which variant you have.",
      },
      {
        question: "What is the no-claim bonus in Health Companion?",
        answer: "20% of the base sum insured for each claim-free year, up to 100%.",
      },
      {
        question: "How does the refill work in Health Companion?",
        answer: "After the first claim is paid, an amount equal to the base sum insured is added, even if you only used part of it. It applies once a year, for the same or a different illness.",
      },
      {
        question: "Does Health Companion cover maternity?",
        answer: "No. Maternity is a standard exclusion.",
      },
    ],
    sources: [
      {
        document: "Niva Bupa Health Companion policy wording (Variant 2022 and Variant 2023)",
        uin: "NBHHLIP26051V092526",
        clauses: "3.1, 3.5, 3.6, NCB clause, Excl01, Excl02, Excl18, Annexure I",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "co-pay", "no-claim-bonus", "restoration-benefit", "pre-existing-disease-waiting-period"],
    related: ["niva-bupa-reassure-2", "niva-bupa-rise"],
  },

  {
    slug: "niva-bupa-health-premia",
    primaryKeyword: "niva bupa health premia",
    sheetRows: [
      { keyword: "niva bupa health premia", evidence: "Editorial topic candidate" },
      { keyword: "niva bupa health premia gold", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "plan",
    insurers: ["Niva Bupa"],
    title: "Niva Bupa Health Premia: Silver, Gold, Platinum | IndSure",
    description:
      "IndSure reads the Niva Bupa Health Premia wording: room by plan, 24-month PED wait, 12-month listed-illness wait, maternity on floaters, refill.",
    h1: "Niva Bupa Health Premia: what Silver, Gold and Platinum cover",
    answer:
      "Health Premia (UIN MAXHLIP21176V022021) waits only 24 months for pre-existing diseases and 12 months for listed illnesses. It pays 90 days before and 180 days after a hospital stay, adds 10% of the base sum insured as bonus each renewal up to 100%, and refills your cover once a year. Maternity is covered on family floater and Family First policies after 24 months, but not on an individual policy.",
    sections: [
      {
        h2: "Room rent by plan",
        table: {
          head: ["Policy type", "Silver", "Gold", "Platinum"],
          rows: [
            ["Individual or family floater", "Up to sum insured, except suite or above", "Up to sum insured, except suite or above", "Up to sum insured, any room"],
            ["Family First", "₹3,000 a day or shared room, or ₹5,000 a day or single private room (whichever is lower)", "Up to sum insured, except suite or above", "Up to sum insured, any room"],
          ],
        },
      },
      {
        h2: "Limits to know",
        bullets: [
          "Robotic surgery: up to ₹1 lakh, except robotic radical prostatectomy, cardiac surgery, partial nephrectomy and cancer surgery.",
          "HIV/AIDS, some mental illnesses and LASER surgery have their own caps.",
          "Bonus and refill do not raise these sub-limits.",
          "Road ambulance is paid up to the sum insured at network hospitals and up to ₹2,000 elsewhere.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "24 months (36 months for the Critical Illness add-on)."],
            ["Listed illnesses and surgeries", "12 months. Cancer after 30 days."],
            ["Maternity", "24 months, floater and Family First policies only."],
          ],
        },
      },
      {
        h2: "What else the plan includes",
        bullets: [
          "Re-fill: an extra amount once a year for later claims. It does not carry forward.",
          "Living organ donor costs, treatment at home over 3 days, and AYUSH stays.",
          "Gold and Platinum include some cover for emergencies and specified illnesses outside India. USA and Canada need an add-on.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is the pre-existing disease waiting period in Health Premia?",
        answer: "24 months of continuous cover. Listed illnesses like cataract and hernia wait 12 months.",
      },
      {
        question: "Does Health Premia cover maternity?",
        answer: "Only on a family floater policy covering both spouses, or a Family First policy, after 24 months. An individual policy cannot claim maternity.",
      },
      {
        question: "Is there a room-rent limit in Health Premia Gold?",
        answer: "On Gold, room rent is covered up to the sum insured, but not for a suite or higher room category.",
      },
      {
        question: "Is robotic surgery fully covered in Health Premia?",
        answer: "Most robotic surgeries are capped at ₹1 lakh. Robotic radical prostatectomy, cardiac surgery, partial nephrectomy and cancer surgery are not capped this way.",
      },
    ],
    sources: [
      {
        document: "Niva Bupa Health Premia policy wording",
        uin: "MAXHLIP21176V022021",
        clauses: "3.1 to 3.3, 3.8, 3.10, 3.13, 3.16, 3.25, 3.26, 5.1.1.1, 5.1.1.2, schedules of benefits",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "sub-limit", "maternity-cover", "pre-existing-disease-waiting-period", "disease-specific-waiting-period"],
    related: ["niva-bupa-aspire", "niva-bupa-reassure-2"],
  },

  {
    slug: "niva-bupa-rise",
    primaryKeyword: "niva bupa rise",
    sheetRows: [
      { keyword: "niva bupa rise", evidence: "Insurer/product/glossary candidate" },
      { keyword: "niva bupa rise plan", evidence: "Editorial topic candidate" },
    ],
    kind: "plan",
    insurers: ["Niva Bupa"],
    title: "Niva Bupa Rise Plan: Twin Room, Network Co-pay | IndSure",
    description:
      "IndSure reads the Niva Bupa Rise wording: twin sharing room, 20% co-pay outside its network, ₹50,000 modern treatment cap, refill and waits.",
    h1: "Niva Bupa Rise: what the policy wording covers",
    answer:
      "Rise (UIN NBHHLIP25041V012425) pays for a twin sharing room with no co-payment, and ICU up to the sum insured. You pay 20% of the claim if you are treated outside its Rise tiered network. Modern treatments like robotic surgery are capped at ₹50,000 a claim unless you buy Modern Treatment+. It pays 60 days before and 180 days after a hospital stay. Pre-existing diseases wait 36 months.",
    sections: [
      {
        h2: "The three limits that matter",
        bullets: [
          "Room: twin sharing room is paid without a co-payment. A higher room is an add-on, with a 20% to 30% co-payment on related costs if you go above your choice.",
          "Network: a flat 20% co-payment if you are treated outside the Rise tiered network. The No Co-Pay Network add-on removes it.",
          "Modern treatments: all 12 listed treatments are capped at ₹50,000 per claim. Modern Treatment+ removes the cap.",
        ],
      },
      {
        h2: "Bonus and refill",
        bullets: [
          "Loyalty bonus: 10% of the base sum insured each year, up to 100%.",
          "Re-fill: adds the base sum insured once a year after full or partial use, for any illness. The ReAssure Forever add-on replaces it with unlimited refills.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months. An add-on at purchase can change it."],
            ["Listed illnesses and surgeries", "24 months. Cancer after 30 days."],
          ],
        },
      },
      {
        h2: "Not covered",
        bullets: [
          "Maternity and IVF. An ectopic pregnancy is covered.",
          "Items a hospital bill normally leaves out, unless you add Safeguard.",
          "Treatment outside India.",
        ],
      },
    ],
    faqs: [
      {
        question: "What room does Niva Bupa Rise pay for?",
        answer: "A twin sharing room, meaning any room with at least 2 beds, with no co-payment. ICU is paid up to the sum insured.",
      },
      {
        question: "Is there a co-payment in Niva Bupa Rise?",
        answer: "Yes, 20% if you are treated outside the Rise tiered network, and more if you take a higher room than your plan allows.",
      },
      {
        question: "Does Rise cover robotic surgery?",
        answer: "Yes, but all modern treatments are capped at ₹50,000 per claim unless you buy the Modern Treatment+ add-on.",
      },
      {
        question: "What is the bonus in Niva Bupa Rise?",
        answer: "10% of the base sum insured each year, up to 100%.",
      },
    ],
    sources: [
      {
        document: "Niva Bupa Rise policy wording",
        uin: "NBHHLIP25041V012425",
        clauses: "4.1.2, 4.1 modern treatments note, loyalty bonus, re-fill, Excl01, Excl02, Excl18, optional covers",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "co-pay", "sub-limit", "network-hospital-tpa", "restoration-benefit"],
    related: ["niva-bupa-health-companion", "niva-bupa-reassure-2"],
  },

  {
    slug: "niva-bupa-senior-first",
    primaryKeyword: "niva bupa senior first platinum",
    sheetRows: [
      { keyword: "niva bupa senior first platinum", evidence: "Insurer/product/glossary candidate" },
      { keyword: "niva bupa senior first platinum policy wording", evidence: "Editorial topic candidate" },
    ],
    kind: "plan",
    insurers: ["Niva Bupa"],
    title: "Niva Bupa Senior First: Co-pay Options Explained | IndSure",
    description:
      "IndSure reads the Niva Bupa Senior First wording: 50% default co-pay you can lower to 20%, 24-month waits, unlimited ReAssure and limits.",
    h1: "Niva Bupa Senior First: co-payment, waits and benefits",
    answer:
      "Senior First (UIN NBHHLIP27053V022627) has a default co-payment of 50% of every claim, which you can lower to 40%, 30% or 20% only when you first buy, and never change later. A higher room than your schedule allows adds another 10%. Pre-existing diseases and listed illnesses wait 24 months. It pays 60 days before and 180 days after a hospital stay, and ReAssure refills cover after the first paid claim.",
    sections: [
      {
        h2: "The co-payment, in the wording's words",
        bullets: [
          "Default 50%, which you can change to 40%, 30% or 20% at the start of your first policy. Once chosen, it cannot be changed.",
          "It does not apply to ambulance and health check-up benefits.",
          "An extra 10% applies if you stay in a higher room category than your schedule allows.",
          "If you choose the Annual Aggregate Deductible instead, the co-payment does not apply, except the higher-room 10%.",
        ],
      },
      {
        h2: "Other limits",
        bullets: [
          "Robotic surgery: up to ₹1 lakh per claim, except radical prostatectomy, cardiac surgery, partial nephrectomy and cancer surgery.",
          "Road ambulance up to ₹2,000; air ambulance up to ₹2.5 lakh in emergencies.",
          "Items a hospital bill normally leaves out are not paid.",
        ],
      },
      {
        h2: "Bonus and ReAssure",
        bullets: [
          "Loyalty Additions: 10% of the previous year's base sum insured each year, up to 100%. Sub-limits do not grow with it.",
          "ReAssure: starts after the first paid claim and refills cover for later claims, up to the base sum insured per claim.",
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
    ],
    faqs: [
      {
        question: "What is the co-payment in Niva Bupa Senior First?",
        answer: "50% by default. You can reduce it to 40%, 30% or 20% only when you first buy, and you cannot change it afterwards.",
      },
      {
        question: "What is the pre-existing disease waiting period in Senior First?",
        answer: "24 months of continuous cover.",
      },
      {
        question: "Does a higher room cost more in Senior First?",
        answer: "Yes. If you stay in a higher room category than your schedule allows, an extra 10% co-payment applies.",
      },
      {
        question: "Does Senior First cover robotic surgery?",
        answer: "Yes, up to ₹1 lakh per claim for most robotic surgeries. Radical prostatectomy, cardiac, partial nephrectomy and cancer surgery are not capped this way.",
      },
    ],
    sources: [
      {
        document: "Niva Bupa Senior First policy wording",
        uin: "NBHHLIP27053V022627",
        clauses: "4.1 Co-payment, modern treatments, ReAssure, Loyalty Additions, Excl01, Excl02, Excl18",
      },
    ],
    checkedOn,
    learn: ["co-pay", "deductible", "sub-limit", "restoration-benefit", "pre-existing-disease-waiting-period"],
    related: ["niva-bupa-health-premia"],
  },
];
