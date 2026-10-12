// Plan pages for Bajaj, Aditya Birla (Activ Yuva), Zuno, Tata AIG, Navi,
// Cholamandalam and IFFCO Tokio. Facts from the policy wordings, checked in the
// 9 Oct 2026 catalogue audit (E:/_audit/ledger). See ../insurance-pages.ts for the rules.
import type { InsurancePage } from "../insurance-pages";

const checkedOn = "2026-10-09";

export const OTHERS_A_PAGES: InsurancePage[] = [
  {
    slug: "bajaj-health-guard",
    primaryKeyword: "bajaj health guard review",
    sheetRows: [
      { keyword: "bajaj health guard review", evidence: "Editorial topic candidate" },
      { keyword: "bajaj allianz health guard gold", evidence: "Insurer/product/glossary candidate" },
      { keyword: "bajaj allianz health guard gold plan", evidence: "Real forum question/topic" },
      { keyword: "bajaj allianz health guard platinum", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "review",
    insurers: ["Bajaj General"],
    title: "Bajaj Health Guard Review: Silver, Gold, Platinum | IndSure",
    description:
      "IndSure reads the Bajaj Health Guard wording: room limit by plan and cover, cataract cap, 72-month maternity wait, bonus and reinstatement.",
    h1: "Bajaj Health Guard review: Silver, Gold and Platinum compared",
    answer:
      "Health Guard (UIN BAJHLIP26073V082526) has three plans. Silver limits the room to 1% of the sum insured a day. Gold and Platinum allow a single private AC room up to ₹7.5 lakh cover and any room from ₹10 lakh. All three reinstate 100% of the base cover once a year after it is used up, cap cataract at 20% of the sum insured per eye (up to ₹1 lakh), and pay 60 days before and 90 days after a hospital stay. Maternity on Gold and Platinum waits 72 months.",
    sections: [
      {
        h2: "Silver vs Gold vs Platinum",
        table: {
          head: ["", "Silver", "Gold", "Platinum"],
          rows: [
            ["Room", "1% of sum insured a day", "Single private AC room (₹3 to 7.5 lakh); any room (₹10 lakh+)", "Same as Gold"],
            ["Maternity", "Not covered", "Covered after 72 months", "Covered after 72 months"],
            ["Bonus", "10% a year, up to 100%", "10% a year, up to 100%", "Super Cumulative Bonus: 50% a year for 2 years, then 10% a year, up to 150%"],
            ["Bariatric surgery", "Up to 25% of sum insured", "Up to 50% of sum insured, max ₹5 lakh", "Up to 50% of sum insured, max ₹5 lakh"],
          ],
        },
      },
      {
        h2: "Limits in every plan",
        bullets: [
          "Cataract: up to 20% of the sum insured per eye, maximum ₹1 lakh.",
          "Road ambulance: up to ₹20,000 a policy year.",
          "ICU at actual cost.",
          "Reinstatement: 100% of the base sum insured once a year, after base cover and bonus are fully used, for the same or another member. For cancer and dialysis, only once in a lifetime.",
          "No co-payment in the base plan, but a zone co-payment applies if you pay a lower-zone premium and are treated in a higher zone.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months."],
            ["Listed illnesses and surgeries", "24 months. Some, like joint replacement and spine surgery, 36 months."],
            ["Maternity (Gold and Platinum)", "72 months."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "What is the room rent limit in Bajaj Health Guard Gold?",
        answer: "A single private AC room for sum insured of ₹3 to 7.5 lakh, and any room from ₹10 lakh.",
      },
      {
        question: "What is the maternity waiting period in Health Guard?",
        answer: "72 months, on the Gold and Platinum plans only. Silver does not cover maternity.",
      },
      {
        question: "Is cataract fully covered in Health Guard?",
        answer: "No. It is capped at 20% of the sum insured per eye, up to ₹1 lakh.",
      },
      {
        question: "What extra does Platinum give over Gold?",
        answer: "The Super Cumulative Bonus, which adds 50% of the sum insured for each of the first 2 claim-free years and 10% a year after, up to 150%.",
      },
    ],
    sources: [
      {
        document: "Bajaj Health Guard policy wording",
        uin: "BAJHLIP26073V082526",
        clauses: "C1 in-patient (room limits by plan), cataract limit, road ambulance, reinstatement, 14 maternity, 16 Super Cumulative Bonus, waiting periods",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "sub-limit", "maternity-cover", "restoration-benefit", "zone-based-co-pay"],
    related: ["star-family-health-optima"],
  },

  {
    slug: "aditya-birla-activ-yuva",
    primaryKeyword: "aditya birla activ yuva review",
    sheetRows: [
      { keyword: "aditya birla activ yuva review", evidence: "Editorial topic candidate" },
      { keyword: "aditya birla activ yuva", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "review",
    insurers: ["Aditya Birla Health"],
    title: "Activ Yuva Review: Yuva Credit and Reload | IndSure",
    description:
      "IndSure reads the Activ Yuva wording: any room, Yuva Credit of 100% a year up to 10x, unlimited reload, Claim Protect, 24-month waits.",
    h1: "Aditya Birla Activ Yuva review: what the policy wording says",
    answer:
      "Activ Yuva (UIN ADIHLIP27047V012627) pays any room and ICU at actuals, 90 days before and 180 days after a hospital stay, and covers items a hospital bill normally leaves out through Claim Protect. Yuva Credit adds 100% of the base sum insured at every renewal, regardless of claims, up to 10 times. Yuva Reload doubles cover for the first claim and refills it without limit after that. Pre-existing diseases wait 24 months.",
    sections: [
      {
        h2: "How the cover grows",
        bullets: [
          "Yuva Credit: 100% of the base sum insured added at every continuous renewal, irrespective of claims, up to 1000% (10 times).",
          "Yuva Reload: the first claim in the life of the policy gets twice the base sum insured. After that, every later claim, related or not, gets an unlimited refill of the base sum insured.",
          "Neither applies if you choose the Unlimited Sum Insured option.",
        ],
      },
      {
        h2: "What the base plan pays",
        bullets: [
          "Any room and ICU at actuals up to the sum insured.",
          "Claim Protect: the items on all four lists a hospital bill normally leaves out.",
          "Road and air ambulance within India at actuals up to the sum insured.",
          "Day care, treatment at home over 3 days, AYUSH, organ donor and listed modern treatments.",
        ],
      },
      {
        h2: "Two rules to know",
        bullets: [
          "Claims suspension: the wording has an ON/OFF feature. During an OFF period, no claims are admissible for that person.",
          "If a stay goes past 7 days and you do not inform the insurer in time, an extra 10% co-payment applies.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "24 months. An add-on can cut it to 12 months."],
            ["Listed illnesses and surgeries", "24 months. An add-on can cut it to 12 months."],
            ["Maternity (worldwide add-on)", "1, 2 or 3 years, as chosen."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "What is Yuva Credit in Activ Yuva?",
        answer: "100% of the base sum insured added at every renewal, even if you claimed, up to 10 times the base cover.",
      },
      {
        question: "How does Yuva Reload work?",
        answer: "The first claim in the life of the policy gets double the base sum insured. Every later claim, related or unrelated, gets an unlimited refill of the base cover.",
      },
      {
        question: "Does Activ Yuva cover maternity?",
        answer: "Only through the Worldwide Yuva Maternity add-on, with a 1, 2 or 3-year wait as you choose.",
      },
      {
        question: "Does Activ Yuva have a room-rent limit?",
        answer: "No. Room and ICU are paid at actuals up to the sum insured, unless you choose a room limit option for a lower premium.",
      },
    ],
    sources: [
      {
        document: "Aditya Birla Activ Yuva policy wordings",
        uin: "ADIHLIP27047V012627",
        clauses: "C.1 room, C.3, C.4, C.5 Claim Protect, C.10 Yuva Reload, C.11 Yuva Credit, C.14 optional covers, E.3.C, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["restoration-benefit", "no-claim-bonus", "consumables-non-payable", "pre-existing-disease-waiting-period"],
    related: ["aditya-birla-activ-one-nxt"],
  },

  {
    slug: "zuno-health-insurance",
    primaryKeyword: "zuno health insurance review",
    sheetRows: [
      { keyword: "zuno health insurance review", evidence: "Editorial topic candidate" },
      { keyword: "zuno health insurance gold", evidence: "Insurer/product/glossary candidate" },
      { keyword: "surgeries covered by zuno health insurance", evidence: "Editorial topic candidate" },
    ],
    kind: "review",
    insurers: ["Zuno"],
    title: "Zuno Health Insurance: Silver, Gold, Platinum | IndSure",
    description:
      "IndSure reads the Zuno Health Insurance wording: 20% co-pay above age 60, room by plan, pre and post days by plan, maternity on Gold and Platinum.",
    h1: "Zuno Health Insurance review: Silver, Gold and Platinum",
    answer:
      "Zuno Health Insurance (UIN ZUNHLIP26040V052526) has three plans in one wording. Every claim for anyone aged above 60 carries a 20% co-payment. Gold and Platinum pay a single private room, add 50% of the sum insured as bonus each claim-free year up to 100%, and include maternity after 48 months. Platinum has the shortest pre-existing disease wait, 24 months, against 36 months on Silver and Gold.",
    sections: [
      {
        h2: "Silver vs Gold vs Platinum",
        table: {
          head: ["", "Silver", "Gold", "Platinum"],
          rows: [
            ["Room", "1% of sum insured a day up to ₹2 lakh cover; single private room above", "Single private room", "Single private room"],
            ["Before / after a stay", "30 / 60 days", "60 / 90 days", "90 / 180 days"],
            ["Bonus", "10% a year, up to 50%", "50% a year, up to 100%", "50% a year, up to 100%"],
            ["Restore", "Add-on only", "Once a year, unrelated illness", "Once a year, unrelated illness"],
            ["Maternity", "Not covered", "Up to ₹50,000, after 48 months", "Up to ₹2 lakh, after 48 months"],
            ["Organ donor", "Not covered", "Up to ₹1 lakh", "Up to ₹2 lakh"],
            ["Ambulance (a year)", "₹1,500", "₹3,000", "₹10,000"],
            ["Pre-existing diseases", "36 months", "36 months", "24 months"],
          ],
        },
      },
      {
        h2: "Rules for every plan",
        bullets: [
          "20% compulsory co-payment on every claim for anyone aged above 60.",
          "Listed illnesses and surgeries wait 24 months. Cataract has its own limit.",
          "Bonus drops at the same rate after a claim year.",
          "Treatment in India only.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is there a co-payment in Zuno Health Insurance?",
        answer: "Yes, 20% on every claim for anyone aged above 60. Younger members can choose a voluntary co-payment for a lower premium.",
      },
      {
        question: "Does Zuno Health Insurance cover maternity?",
        answer: "On Gold (up to ₹50,000) and Platinum (up to ₹2 lakh), after 48 months. Silver does not cover it.",
      },
      {
        question: "Which Zuno plan has the shortest pre-existing disease wait?",
        answer: "Platinum, at 24 months. Silver and Gold wait 36 months.",
      },
    ],
    sources: [
      {
        document: "Zuno Health Insurance policy wording",
        uin: "ZUNHLIP26040V052526",
        clauses: "General condition 2 (co-payment), benefits by variant, pre and post hospitalisation, cumulative bonus, restoration, maternity, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["co-pay", "room-rent-cap", "maternity-cover", "pre-existing-disease-waiting-period"],
    related: ["navi-health"],
  },

  {
    slug: "tata-aig-medicare",
    primaryKeyword: "tata aig medicare plan review",
    sheetRows: [
      { keyword: "tata aig medicare plan review", evidence: "Editorial topic candidate" },
      { keyword: "tata aig medicare policy wording", evidence: "Editorial topic candidate" },
      { keyword: "tata aig medicare premier", evidence: "Editorial topic candidate" },
      { keyword: "tata aig medicare select review", evidence: "Editorial topic candidate" },
    ],
    kind: "review",
    insurers: ["Tata AIG"],
    title: "Tata AIG Medicare vs Premier vs Select | IndSure",
    description:
      "IndSure reads three Tata AIG MediCare wordings: room rules, 50% yearly bonus, restore, global cover, maternity and waiting periods.",
    h1: "Tata AIG MediCare, MediCare Premier and MediCare Select compared",
    answer:
      "All three Tata AIG plans add 50% of the sum insured as bonus for each claim-free year, up to 100%. MediCare Premier has no room limit, waits 24 months for pre-existing diseases and includes maternity after 36 months and planned treatment abroad. MediCare sets your room in the schedule and charges 10% of the claim if you take a higher one. MediCare Select restores cover unlimited times but needs add-ons for maternity and consumables.",
    sections: [
      {
        h2: "Side by side",
        table: {
          head: ["", "MediCare", "MediCare Premier", "MediCare Select"],
          rows: [
            ["UIN", "TATHLIP26053V042526", "TATHLIP26052V052526", "TATHLIP25051V012425"],
            ["Room", "As in schedule; 10% co-pay for a higher room", "No limit", "As in schedule"],
            ["ICU", "No limit stated", "No limit", "No limit"],
            ["Before / after a stay", "60 / 90 days", "60 / 90 days (200 after, from ₹75 lakh cover)", "90 / 90 days"],
            ["Bonus", "50% a year, up to 100%", "50% a year, up to 100%", "50% a year, up to 100%"],
            ["Restore", "Once a year (same illness after 45 days)", "Once a year, not on the first claim", "Unlimited, not on the first claim"],
            ["Consumables", "Built in (listed items)", "Built in", "Add-on"],
            ["Treatment abroad", "Built in (diagnosis in India)", "Planned treatment abroad built in", "Not covered"],
            ["Maternity", "Not covered", "Covered after 36 months", "Add-on, 24 months"],
            ["Pre-existing diseases", "36 months", "24 months", "36 months"],
            ["Listed illnesses", "24 months", "24 months", "24 months"],
          ],
        },
      },
      {
        h2: "How the bonus works in all three",
        body: [
          "50% of the sum insured is added for each claim-free year, up to 100%. After a claim year it drops by 50% of the sum insured. Each plan also lets you take a renewal premium discount instead of the bonus.",
        ],
      },
    ],
    faqs: [
      {
        question: "Which Tata AIG MediCare plan has no room limit?",
        answer: "MediCare Premier. MediCare and MediCare Select set the room in your schedule.",
      },
      {
        question: "Does Tata AIG MediCare cover maternity?",
        answer: "The base MediCare plan does not. MediCare Premier covers it after 36 months, and MediCare Select offers it as an add-on with a 24-month wait.",
      },
      {
        question: "What happens if I take a higher room in Tata AIG MediCare?",
        answer: "You bear 10% of the admissible claim amount.",
      },
    ],
    sources: [
      { document: "Tata AIG MediCare policy wording", uin: "TATHLIP26053V042526", clauses: "B1, B2, B3, B10, B12, B13, B14, claims clause i" },
      { document: "Tata AIG MediCare Premier policy wording", uin: "TATHLIP26052V052526", clauses: "B1, B2, B3, B12, B13, B14, maternity" },
      { document: "Tata AIG MediCare Select policy wording", uin: "TATHLIP25051V012425", clauses: "B1, B9 Restore Infinity Plus, cumulative bonus, C1, optional covers" },
    ],
    checkedOn,
    learn: ["room-rent-cap", "no-claim-bonus", "restoration-benefit", "maternity-cover", "consumables-non-payable"],
    related: ["hdfc-ergo-optima-secure"],
  },

  {
    slug: "navi-health",
    primaryKeyword: "navi health insurance review",
    sheetRows: [
      { keyword: "navi health insurance review", evidence: "Editorial topic candidate" },
      { keyword: "navi health", evidence: "Insurer/product/glossary candidate" },
      { keyword: "buying health insurance from navi insurance review", evidence: "Editorial topic candidate" },
      { keyword: "team can you please do a review of navi health insurance policy", evidence: "Real forum question/topic" },
    ],
    kind: "review",
    insurers: ["Navi"],
    title: "Navi Health Insurance Review: Policy Wording | IndSure",
    description:
      "IndSure reads the Navi Health wording: single private room, no co-payment, guaranteed bonus and restoration set in your schedule, add-ons.",
    h1: "Navi Health insurance review: what the policy wording says",
    answer:
      "Navi Health (UIN NAVHLIP27036V032627) pays up to a single private AC room with no co-payment, and ICU without a limit. Road ambulance is paid at actuals. Many numbers are set in your policy schedule rather than the wording: the pre and post-hospital days, the guaranteed bonus rate, and how many times the sum insured is restored. Pre-existing diseases wait 36 months.",
    sections: [
      {
        h2: "What the wording fixes",
        bullets: [
          "Room up to a single private AC room. A higher room means the related bill is paid in proportion. An Any Room upgrade is offered on ₹1, 2 and 3 crore covers.",
          "ICU with no limit. No co-payment.",
          "Road ambulance at actuals. Air ambulance up to ₹5 lakh is an add-on.",
          "Modern treatments up to the sum insured.",
        ],
      },
      {
        h2: "What your schedule decides",
        bullets: [
          "Days covered before and after a hospital stay.",
          "The Guaranteed Bonus rate.",
          "How many times the base sum insured is restored in a year.",
        ],
        body: ["Read these lines in your policy schedule. The wording only says they are set there."],
      },
      {
        h2: "Add-ons",
        bullets: [
          "Maternity and newborn: up to ₹30,000 for delivery, after 36 months.",
          "AYUSH, treatment at home, organ donor, items a bill normally leaves out, OPD.",
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
        question: "Does Navi Health have a room-rent limit?",
        answer: "Yes, up to a single private AC room. An Any Room upgrade is available on ₹1 crore and higher covers.",
      },
      {
        question: "Is AYUSH covered in Navi Health?",
        answer: "Only as an add-on. The same goes for organ donor costs and treatment at home.",
      },
      {
        question: "How many days before and after hospital does Navi Health cover?",
        answer: "The number of days is set in your policy schedule, not in the wording.",
      },
    ],
    sources: [
      {
        document: "Navi Health policy wording",
        uin: "NAVHLIP27036V032627",
        clauses: "3.1, 3.4, 3.10 Guaranteed Bonus, 3.12 restoration, 3.16, optional covers, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "proportionate-deduction", "restoration-benefit", "no-claim-bonus"],
    related: ["zuno-health-insurance"],
  },

  {
    slug: "chola-flexi-health",
    primaryKeyword: "chola flexi health",
    sheetRows: [
      { keyword: "chola flexi health", evidence: "Editorial topic candidate" },
      { keyword: "chola ms flexi health", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "plan",
    insurers: ["Cholamandalam MS"],
    title: "Chola MS Flexi Health: Room, Bonus and Waits | IndSure",
    description:
      "IndSure reads the Chola Flexi Health wording: no room limit above ₹2 lakh, 10% bonus up to 50%, 30 and 60 days pre and post, restoration.",
    h1: "Chola MS Flexi Health: what the policy wording covers",
    answer:
      "Flexi Health (UIN CHOHLIP24145V062526) has no room-rent limit for sum insured above ₹2 lakh, and ₹2,000 a day up to ₹2 lakh. It pays 30 days before and 60 days after a hospital stay, adds 10% of the sum insured as bonus each claim-free year up to 50%, and restores 100% of the sum insured once a year for an unrelated illness. Pre-existing diseases wait 36 months.",
    sections: [
      {
        h2: "Key limits",
        table: {
          head: ["Item", "What the wording says"],
          rows: [
            ["Room", "₹2,000 a day for ₹50,000 to ₹2 lakh cover; no limit above ₹2 lakh."],
            ["ICU", "No limit stated."],
            ["Road ambulance", "1% of the sum insured, up to ₹2,000 per hospitalisation."],
            ["Before and after a stay", "30 days and 60 days."],
            ["Co-payment", "20% if you pay a Tier 2 premium and are treated in a Tier 1 hospital."],
            ["Bonus", "10% a year up to 50%; reduced by 10% after a claim."],
            ["Restoration", "100% once a year, for an unrelated illness."],
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
            ["Listed illnesses and surgeries", "24 months."],
          ],
        },
      },
      {
        h2: "Not covered",
        bullets: [
          "Maternity. A newborn is covered from day 1, up to 10% of the sum insured (max ₹50,000), if the mother has been covered for 12 months.",
          "Items a hospital bill normally leaves out.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Chola Flexi Health have a room-rent limit?",
        answer: "Only on covers up to ₹2 lakh, where it is ₹2,000 a day. Above ₹2 lakh there is no room limit.",
      },
      {
        question: "What is the bonus in Chola Flexi Health?",
        answer: "10% of the sum insured for each claim-free year, up to 50%.",
      },
      {
        question: "Does Flexi Health cover maternity?",
        answer: "No. It covers a newborn from day 1 within limits, if the mother has been insured for 12 months.",
      },
    ],
    sources: [
      {
        document: "Chola MS Flexi Health policy wording",
        uin: "CHOHLIP24145V062526",
        clauses: "Benefit table (room, ambulance, pre and post, cumulative bonus), restoration, Excl01, Excl02, Excl18",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "no-claim-bonus", "restoration-benefit", "zone-based-co-pay"],
    related: ["iffco-tokio-family-health-protector"],
  },

  {
    slug: "iffco-tokio-family-health-protector",
    primaryKeyword: "iffco tokio family health protector",
    sheetRows: [
      { keyword: "iffco tokio family health protector basic", evidence: "Insurer/product/glossary candidate" },
      { keyword: "iffco tokio family health protector essential", evidence: "Insurer/product/glossary candidate" },
      { keyword: "iffco tokio family health protector smart", evidence: "Insurer/product/glossary candidate" },
      { keyword: "iffco tokio health insurance review", evidence: "Editorial topic candidate" },
    ],
    kind: "plan",
    insurers: ["IFFCO Tokio"],
    title: "IFFCO Tokio Family Health Protector Explained | IndSure",
    description:
      "IndSure reads the IFFCO Tokio Family Health Protector wording: no room cap from ₹7 lakh, reinstatement after claims, bonus, modern treatment cap.",
    h1: "IFFCO Tokio Family Health Protector: what the wording covers",
    answer:
      "Family Health Protector (UIN IFFHLIP26042V062526) has no room or ICU limit for sum insured of ₹7 lakh and above. Below ₹7 lakh, room is 1.5% of the sum insured a day in class A cities and 1.25% elsewhere. The sum insured is reinstated by the claim amount after each claim, free for the first claim. Modern treatments are capped at 50% of the sum insured. Pre-existing diseases wait 36 months.",
    sections: [
      {
        h2: "Key limits",
        table: {
          head: ["Item", "What the wording says"],
          rows: [
            ["Room", "No limit from ₹7 lakh cover. Below that, 1.5% of sum insured a day (class A cities) or 1.25% (elsewhere)."],
            ["ICU", "No limit from ₹7 lakh. Below that, 2.5% or 2% of sum insured a day."],
            ["Modern treatments", "Up to 50% of the sum insured."],
            ["Treatment at home", "Up to 20% of the sum insured."],
            ["Road ambulance", "1% of sum insured or ₹2,500, whichever is lower."],
            ["Before and after a stay", "60 days and 90 days."],
          ],
        },
      },
      {
        h2: "Bonus and reinstatement",
        bullets: [
          "Cumulative bonus: 25% of the base sum insured after the first claim-free year, then 10% a year, up to 100%. You can take a 5% premium discount instead.",
          "Reinstatement: after each claim, the base sum insured is topped back up by the claim amount. The first reinstatement in a year is free; later ones need extra premium.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months."],
            ["Listed illnesses and surgeries", "12 or 24 months, depending on the condition."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "Does IFFCO Tokio Family Health Protector have a room-rent limit?",
        answer: "Not for sum insured of ₹7 lakh and above. Below ₹7 lakh, room rent is 1.5% (class A cities) or 1.25% of the sum insured a day.",
      },
      {
        question: "How does reinstatement work?",
        answer: "After each claim, the base sum insured is reinstated by the amount paid. The first reinstatement is free; later ones in the year need extra premium.",
      },
      {
        question: "Are modern treatments fully covered?",
        answer: "No. They are capped at 50% of the sum insured.",
      },
    ],
    sources: [
      {
        document: "IFFCO Tokio Family Health Protector policy wording",
        uin: "IFFHLIP26042V062526",
        clauses: "1 Room Rent and ICU, modern treatments, domiciliary, ii reinstatement, cumulative bonus, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "restoration-benefit", "no-claim-bonus", "sub-limit"],
    related: ["chola-flexi-health"],
  },
];
