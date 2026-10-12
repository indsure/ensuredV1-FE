// Star Health plan pages. Facts from the policy wordings, checked in the
// 9 Oct 2026 catalogue audit (E:/_audit/ledger). See ../insurance-pages.ts for the rules.
import type { InsurancePage } from "../insurance-pages";

const checkedOn = "2026-10-09";

export const STAR_PAGES: InsurancePage[] = [
  {
    slug: "star-health-assure",
    primaryKeyword: "star health assure",
    sheetRows: [
      { keyword: "star health assure", evidence: "Insurer/product/glossary candidate" },
      { keyword: "star health assure policy wording", evidence: "Editorial topic candidate" },
      { keyword: "questions regarding star health assure policy", evidence: "Real forum question/topic" },
    ],
    kind: "plan",
    insurers: ["Star Health"],
    title: "Star Health Assure Policy: Rooms, Bonus, Restore | IndSure",
    description:
      "IndSure reads the Star Health Assure wording: room limit by sum insured, unlimited restoration, 25% yearly bonus, delivery cover and waits.",
    h1: "Star Health Assure: what the policy wording covers",
    answer:
      "Star Health Assure (UIN SHAHLIP26048V032526) restores your sum insured unlimited times a year and adds 25% of the sum insured as bonus for each claim-free year, up to 100%. Your room depends on the sum insured: 1% of it a day at ₹5 to 7.5 lakh, any room except a suite at ₹10 to 25 lakh, and any room from ₹50 lakh. It pays 60 days before and 180 days after a hospital stay, and covers delivery up to 10% of the sum insured after 24 months.",
    sections: [
      {
        h2: "Room limit by sum insured",
        table: {
          head: ["Sum insured", "Room the wording allows"],
          rows: [
            ["₹5 lakh and ₹7.5 lakh", "Up to 1% of the sum insured a day"],
            ["₹10, 15, 20 and 25 lakh", "Any room except a suite or above"],
            ["₹50 lakh, ₹75 lakh, ₹1 crore and ₹2 crore", "Any room"],
          ],
        },
        body: ["A higher room than allowed means the related bill is paid in proportion, except where the hospital does not bill by room category."],
      },
      {
        h2: "What else the plan includes",
        bullets: [
          "Unlimited restoration: the sum insured is restored up to 100% each time it is partly or fully used, any number of times a year.",
          "Cumulative bonus: 25% of the sum insured per claim-free year, up to 100%.",
          "Delivery, including caesarean, up to 10% of the sum insured after a 24-month wait.",
          "Items a hospital bill normally leaves out (List I) are paid when the hospital claim is admissible.",
          "ICU at actuals. Modern treatments up to the sum insured.",
          "Co-payment: 10% of every claim only for those who are 61 or older when they join.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months on a 1 or 2-year policy, 30 months on a 3-year policy."],
            ["Listed illnesses and surgeries", "24 months."],
            ["Delivery", "24 months."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "Does Star Health Assure have unlimited restoration?",
        answer: "Yes. The sum insured is restored up to 100% any number of times in a year, triggered by partial or full use.",
      },
      {
        question: "What room can I take in Star Health Assure?",
        answer: "It depends on your sum insured: 1% of it a day at ₹5 to 7.5 lakh, any room except a suite at ₹10 to 25 lakh, and any room from ₹50 lakh.",
      },
      {
        question: "Does Star Health Assure cover delivery?",
        answer: "Yes, up to 10% of the sum insured, including caesarean, after a 24-month wait.",
      },
      {
        question: "Is there a co-payment in Star Health Assure?",
        answer: "Only if you are 61 or older when you join: then 10% of every claim.",
      },
    ],
    sources: [
      {
        document: "Star Health Assure Insurance Policy wording",
        uin: "SHAHLIP26048V032526",
        clauses: "Section 1 in-patient table, 12 Cumulative Bonus, Automatic Restoration, 15 Delivery Expenses, 27 Consumables, 29 Co-payment, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "restoration-benefit", "no-claim-bonus", "maternity-cover", "consumables-non-payable"],
    related: ["star-family-health-optima", "star-women-care"],
  },

  {
    slug: "star-family-health-optima",
    primaryKeyword: "star health family health optima",
    sheetRows: [{ keyword: "star health family health optima", evidence: "Insurer/product/glossary candidate" }],
    kind: "plan",
    insurers: ["Star Health"],
    title: "Star Family Health Optima: Room Limits Explained | IndSure",
    description:
      "IndSure reads the Star Family Health Optima wording: room limit by sum insured, 3 restorations a year, loyalty bonus, 20% co-pay at 61+.",
    h1: "Star Family Health Optima: what the policy wording covers",
    answer:
      "Family Health Optima (UIN SHAHLIP26046V092526) limits the room by sum insured: ₹2,000 a day at ₹1 to 2 lakh, ₹5,000 a day at ₹3 to 4 lakh, and a single standard AC room from ₹5 lakh. It restores the sum insured up to 3 times a year, but only for an unrelated illness. Anyone who joins at 61 or older pays 20% of every claim. Pre-existing diseases wait 36 months.",
    sections: [
      {
        h2: "Room limit by sum insured",
        table: {
          head: ["Sum insured", "Room the wording allows"],
          rows: [
            ["₹1 lakh and ₹2 lakh", "Up to ₹2,000 a day"],
            ["₹3 lakh and ₹4 lakh", "Up to ₹5,000 a day"],
            ["₹5 lakh to ₹25 lakh", "Single standard AC room"],
          ],
        },
      },
      {
        h2: "Restoration, bonus and other benefits",
        bullets: [
          "Automatic restoration: up to 3 times a year at 100% each, for an illness unrelated to the earlier claims. Not for modern treatments. Only for sum insured of ₹3 lakh and above.",
          "Loyalty bonus: 10% of the sum insured a year, up to 100%, irrespective of claims (₹3 lakh and above).",
          "Assisted reproduction (sub-fertility) treatment after 36 months: up to ₹1 lakh at ₹5 lakh cover and ₹2 lakh from ₹10 lakh, per 36-month block.",
          "Road ambulance up to ₹750 per hospitalisation and ₹1,500 a year. Air ambulance up to 10% of the sum insured from ₹5 lakh.",
          "Cataract and modern treatments have caps that rise with the sum insured.",
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
        h2: "Not covered",
        bullets: ["Maternity and childbirth.", "Items a hospital bill normally leaves out.", "Treatment outside India."],
      },
    ],
    faqs: [
      {
        question: "What is the room rent limit in Star Family Health Optima?",
        answer: "₹2,000 a day for ₹1 to 2 lakh cover, ₹5,000 a day for ₹3 to 4 lakh, and a single standard AC room for ₹5 lakh and above.",
      },
      {
        question: "How many times does Family Health Optima restore the sum insured?",
        answer: "Up to 3 times a year, at 100% each time, but only for an illness unrelated to the earlier claims, and only on covers of ₹3 lakh and above.",
      },
      {
        question: "Is there a co-payment in Family Health Optima?",
        answer: "Yes, 20% of every claim for anyone who is 61 or older when they join. A voluntary co-payment for a premium discount is also available.",
      },
    ],
    sources: [
      {
        document: "Star Family Health Optima Insurance Plan wording",
        uin: "SHAHLIP26046V092526",
        clauses: "II.1 room table, II.3 cataract, II.5 modern treatments, II.8 ambulance, II.14 loyalty bonus, II.15 restoration, ART, II.28 co-payment, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "restoration-benefit", "co-pay", "sub-limit", "pre-existing-disease-waiting-period"],
    related: ["star-health-assure", "star-young-star"],
  },

  {
    slug: "star-young-star",
    primaryKeyword: "star health young star plan review",
    sheetRows: [
      { keyword: "star health young star plan review", evidence: "Editorial topic candidate" },
      { keyword: "star health young star gold", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "review",
    insurers: ["Star Health"],
    title: "Star Young Star Review: Silver vs Gold | IndSure",
    description:
      "IndSure reads the Star Young Star wording: 12-month pre-existing wait, single private room, 20% yearly bonus, Gold plan delivery cover.",
    h1: "Star Young Star review: what the policy wording says",
    answer:
      "Young Star (UIN SHAHLIP26043V062526) waits only 12 months for pre-existing diseases and 12 months for listed illnesses, much shorter than most plans. It pays for a single private AC room, adds 20% of the base sum insured for each claim-free year up to 100%, restores cover once a year, and has no co-payment. Delivery is covered only on the Gold plan, up to ₹30,000, after 36 months.",
    sections: [
      {
        h2: "Silver vs Gold",
        table: {
          head: ["", "Silver", "Gold"],
          rows: [
            ["Delivery", "Not covered", "Up to ₹30,000 a delivery, 2 deliveries in a lifetime, after 36 months"],
            ["Hospital cash", "Not covered", "Daily cash for a limited number of days"],
            ["Everything else", "Same wording", "Same wording"],
          ],
        },
      },
      {
        h2: "Key limits",
        table: {
          head: ["Item", "What the wording says"],
          rows: [
            ["Room", "Single private AC room. A higher room means the related bill is paid in proportion."],
            ["ICU", "No separate limit."],
            ["Co-payment", "None."],
            ["Before and after a hospital stay", "60 days and 90 days."],
            ["Bonus", "20% of the base sum insured a year, up to 100%. A claim reduces it at the same rate."],
            ["Restoration", "Once a year, 100% of base cover, for all claims. Not for modern treatments."],
            ["Modern treatments", "Covered with caps that depend on the sum insured."],
          ],
        },
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "12 months."],
            ["Listed illnesses and surgeries", "12 months."],
            ["Delivery (Gold)", "36 months."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "What is the pre-existing disease waiting period in Star Young Star?",
        answer: "12 months of continuous cover. Listed illnesses also wait 12 months.",
      },
      {
        question: "What is the difference between Young Star Silver and Gold?",
        answer: "Gold adds delivery cover of up to ₹30,000 after a 36-month wait, and a hospital cash benefit. The rest of the wording is the same.",
      },
      {
        question: "Is there a co-payment in Young Star?",
        answer: "No. The wording has no co-payment clause.",
      },
    ],
    sources: [
      {
        document: "Star Young Star Insurance Policy wording",
        uin: "SHAHLIP26043V062526",
        clauses: "Section 1 in-patient, Automatic Restoration, Cumulative Bonus, Gold Plan delivery and hospital cash, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["pre-existing-disease-waiting-period", "restoration-benefit", "no-claim-bonus", "maternity-cover"],
    related: ["star-family-health-optima", "star-health-assure"],
  },

  {
    slug: "star-women-care",
    primaryKeyword: "star women care",
    sheetRows: [
      { keyword: "star women care", evidence: "Insurer/product/glossary candidate" },
      { keyword: "star women care health insurance plan review", evidence: "Editorial topic candidate" },
      { keyword: "women care", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "plan",
    insurers: ["Star Health"],
    title: "Star Women Care: Maternity Wait and Benefits | IndSure",
    description:
      "IndSure reads the Star Women Care wording: delivery after 12 or 24 months by sum insured, room limit by cover, 20% yearly bonus, restore.",
    h1: "Star Women Care: maternity, waiting periods and benefits",
    answer:
      "Star Women Care (UIN SHAHLIP23132V022223) covers delivery after 24 months at ₹5 to 10 lakh sum insured, or after 12 months from ₹15 lakh. Pre-existing diseases and listed illnesses both wait 24 months. The room is 1% of the sum insured a day at ₹5 lakh, any room except a suite at ₹10 to 25 lakh, and any room at ₹50 lakh and ₹1 crore. It has no co-payment.",
    sections: [
      {
        h2: "Room limit by sum insured",
        table: {
          head: ["Sum insured", "Room the wording allows"],
          rows: [
            ["₹5 lakh", "Up to 1% of the sum insured a day"],
            ["₹10, 15, 20 and 25 lakh", "Any room except a suite or above"],
            ["₹50 lakh and ₹1 crore", "Any room"],
          ],
        },
      },
      {
        h2: "Pregnancy and fertility cover",
        bullets: [
          "Delivery, normal or caesarean, up to the limit in the wording for your sum insured, for up to 2 deliveries in a lifetime.",
          "Wait for delivery: 24 months at ₹5 to 10 lakh, 12 months at ₹15 lakh and above.",
          "Assisted reproduction treatment, after a 36-month wait, with yearly caps.",
          "Ante-natal care and in-utero fetal surgery are also listed.",
        ],
      },
      {
        h2: "Bonus and restore",
        bullets: [
          "Cumulative bonus: 20% of the sum insured a year, up to 100%. A partial claim does not reduce it.",
          "Restoration: 100% of the sum insured once a year after partial or full use, for later stays.",
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
            ["Delivery", "24 months (₹5 to 10 lakh) or 12 months (₹15 lakh and above)."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "What is the maternity waiting period in Star Women Care?",
        answer: "24 months for sum insured of ₹5 to 10 lakh, and 12 months for ₹15 lakh and above.",
      },
      {
        question: "Does Star Women Care have a room-rent limit?",
        answer: "At ₹5 lakh, room rent is up to 1% of the sum insured a day. From ₹10 lakh it is any room except a suite, and from ₹50 lakh any room.",
      },
      {
        question: "Does Star Women Care cover IVF?",
        answer: "It covers assisted reproduction treatment after a 36-month wait, with yearly limits.",
      },
    ],
    sources: [
      {
        document: "Star Women Care Insurance Policy wording",
        uin: "SHAHLIP23132V022223",
        clauses: "Section 1 room table, delivery and ART sections, cumulative bonus, automatic restoration, waiting periods 1 to 3, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["maternity-cover", "room-rent-cap", "no-claim-bonus", "restoration-benefit"],
    related: ["star-health-assure", "niva-bupa-aspire"],
  },

  {
    slug: "star-red-carpet",
    primaryKeyword: "star health red carpet",
    sheetRows: [
      { keyword: "star health red carpet", evidence: "Insurer/product/glossary candidate" },
      { keyword: "star health senior citizen red carpet", evidence: "Editorial topic candidate" },
      { keyword: "star health insurance for senior citizens", evidence: "Editorial topic candidate" },
      { keyword: "star health red carpet renewal", evidence: "Real forum question/topic" },
      { keyword: "suggestions for limit enhancement for parents 70 with star health red carpet", evidence: "Real forum question/topic" },
    ],
    kind: "plan",
    insurers: ["Star Health"],
    title: "Star Red Carpet Senior Citizen Plan: 30% Co-pay | IndSure",
    description:
      "IndSure reads the Star Senior Citizens Red Carpet wording: 30% co-pay on all claims, 12-month PED wait, room and fee caps, no bonus.",
    h1: "Star Health Red Carpet senior citizen plan: what the wording says",
    answer:
      "Senior Citizens Red Carpet (UIN SHAHLIP26041V082526) has a 30% co-payment on every claim. Pre-existing diseases wait only 12 months. The bill is capped in several places: room rent by sum insured, surgeon and doctor fees at 25% of the sum insured per stay, and medicines, theatre and tests at 50%. Post-hospital cover is 7% of the hospital bill up to a cap. There is no cumulative bonus and no restoration.",
    sections: [
      {
        h2: "The caps on each hospital stay",
        table: {
          head: ["Item", "What the wording says"],
          rows: [
            ["Co-payment", "30% of every claim."],
            ["Room", "1% of the sum insured a day up to ₹5 lakh cover; ₹6,000 a day at ₹7.5 to 10 lakh; ₹7,000 at ₹15 lakh; ₹8,500 at ₹20 lakh; ₹10,000 at ₹25 lakh."],
            ["ICU", "2% of the sum insured a day up to ₹10 lakh cover; actuals from ₹15 lakh."],
            ["Surgeon, doctor and specialist fees", "Up to 25% of the sum insured per stay."],
            ["Medicines, theatre, tests, implants", "Up to 50% of the sum insured per stay."],
            ["Before a hospital stay", "30 days."],
            ["After a hospital stay", "7% of the hospital bill, capped at ₹5,000 to ₹10,000 by sum insured. No day limit."],
            ["Road ambulance", "₹600 to ₹1,500 per hospitalisation by sum insured."],
          ],
        },
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "12 months."],
            ["Listed illnesses and surgeries", "24 months."],
          ],
        },
      },
      {
        h2: "What it does not have",
        bullets: [
          "No cumulative bonus and no restoration.",
          "No organ donor cover.",
          "Items a hospital bill normally leaves out are not paid.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is the co-payment in Star Health Red Carpet?",
        answer: "30% of every claim.",
      },
      {
        question: "What is the pre-existing disease waiting period in Red Carpet?",
        answer: "12 months of continuous cover.",
      },
      {
        question: "Does Red Carpet have a room-rent limit?",
        answer: "Yes. It is 1% of the sum insured a day up to ₹5 lakh cover, then fixed amounts from ₹6,000 to ₹10,000 a day for higher covers.",
      },
      {
        question: "Can I increase the sum insured for parents on Red Carpet?",
        answer: "Any increase is subject to the insurer's acceptance at renewal, and the waiting periods start again for the increased amount.",
      },
    ],
    sources: [
      {
        document: "Star Senior Citizens Red Carpet Health Insurance Policy wording",
        uin: "SHAHLIP26041V082526",
        clauses: "Section 1 A to G (room, ICU, fees, ambulance, pre and post), M co-payment, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["co-pay", "room-rent-cap", "sub-limit", "pre-existing-disease-waiting-period"],
    related: ["hdfc-ergo-optima-senior", "niva-bupa-senior-first"],
  },
];
