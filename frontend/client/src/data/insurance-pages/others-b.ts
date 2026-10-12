// Plan pages for Royal Sundaram, Oriental, Raheja QBE, New India, SBI General and
// IndusInd. Facts from the policy wordings, checked in the 9 Oct 2026 catalogue
// audit (E:/_audit/ledger). See ../insurance-pages.ts for the rules.
import type { InsurancePage } from "../insurance-pages";

const checkedOn = "2026-10-09";

export const OTHERS_B_PAGES: InsurancePage[] = [
  {
    slug: "royal-sundaram-multiplier",
    primaryKeyword: "royal sundaram multiplier",
    sheetRows: [
      { keyword: "royal sundaram multiplier", evidence: "Insurer/product/glossary candidate" },
      { keyword: "multiplier benefit under royal sundaram multiplier plan", evidence: "Editorial topic candidate" },
      { keyword: "ped coverage under royal sundaram multiplier plan review", evidence: "Editorial topic candidate" },
    ],
    kind: "plan",
    insurers: ["Royal Sundaram"],
    title: "Royal Sundaram Multiplier Plan: 4X Benefit, PED | IndSure",
    description:
      "IndSure reads the Royal Sundaram Multiplier wording: no room cap, 4X Multiplier for life-threatening conditions, PED cover in years 2 and 3.",
    h1: "Royal Sundaram Multiplier: the 4X benefit and early PED cover",
    answer:
      "Multiplier (UIN RSAHLIP23030V012223) has no room-rent cap. Its 4X Multiplier Benefit adds 4 times the sum insured and bonus for life-threatening conditions, once base cover and bonus are used up, up to 4 times in the life of the policy. Pre-existing diseases normally wait 36 months, but declared ones are covered in years 2 and 3 with a 50% co-payment, up to a cap. The no-claim bonus is 20% a year up to 100%, and once earned it is not cut by later claims.",
    sections: [
      {
        h2: "The 4X Multiplier Benefit",
        bullets: [
          "Only for life-threatening conditions, certified by the treating doctor.",
          "Starts after the base sum insured and no-claim bonus are used up.",
          "Adds 4 times the sum insured and bonus for claims that year.",
          "Available 4 times in the life of the policy, across all members. Unused amounts do not carry forward.",
        ],
      },
      {
        h2: "Pre-existing disease cover before 36 months",
        body: [
          "During the pre-existing disease wait, in the 2nd and 3rd policy years, declared pre-existing diseases are covered with a 50% co-payment, up to the limit in the product benefit table (up to ₹2 lakh). Not in the 1st year. These claims reduce the sum insured.",
        ],
      },
      {
        h2: "Other benefits and limits",
        bullets: [
          "No room-rent cap.",
          "Flexi Reload: 100% of the base sum insured once a year after base cover and bonus run out, even for the same illness. Not on the first claim of the year.",
          "No-claim bonus: 20% of the base sum insured a year, up to 100%. Earned bonus is not reduced by later claims.",
          "Road ambulance or app-based cab: up to ₹5,000 per hospitalisation.",
          "60 days before and 90 days after a stay (30 days for day care).",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months (limited cover in years 2 and 3, see above)."],
            ["Listed illnesses and surgeries", "24 months."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "What is the multiplier benefit in Royal Sundaram Multiplier?",
        answer: "For life-threatening conditions, once your base cover and bonus are used up, an extra 4 times the sum insured and bonus becomes available that year. It can be used 4 times in the life of the policy.",
      },
      {
        question: "Does Royal Sundaram Multiplier cover pre-existing diseases early?",
        answer: "Declared pre-existing diseases are covered in years 2 and 3 with a 50% co-payment, up to the cap in the benefit table. Full cover starts after 36 months.",
      },
      {
        question: "Is there a room-rent limit?",
        answer: "No. The product benefit table states no room-rent capping.",
      },
    ],
    sources: [
      {
        document: "Royal Sundaram Multiplier Health Insurance Plan wording",
        uin: "RSAHLIP23030V012223",
        clauses: "D.1, No Claim Bonus, 4X Multiplier Benefit, Pre-Existing Disease Coverage, Flexi Reload, Product Benefit Table, Excl01, Excl02",
      },
    ],
    checkedOn,
    learn: ["pre-existing-disease-waiting-period", "co-pay", "no-claim-bonus", "restoration-benefit"],
    related: ["iffco-tokio-family-health-protector"],
  },

  {
    slug: "oriental-youth-eco-care",
    primaryKeyword: "oriental youth eco care",
    sheetRows: [
      { keyword: "oriental youth eco care", evidence: "Editorial topic candidate" },
      { keyword: "youth eco care", evidence: "Insurer/product/glossary candidate" },
      { keyword: "oriental youth eco care basic", evidence: "Insurer/product/glossary candidate" },
      { keyword: "oriental youth eco care premium", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "plan",
    insurers: ["Oriental Insurance"],
    title: "Oriental Youth Eco Care Policy: Limits and Waits | IndSure",
    description:
      "IndSure reads the Oriental Youth Eco Care wording: 12-month PED wait, room by sum insured, sub-limits up to ₹10 lakh, maternity on Premium.",
    h1: "Oriental Youth Eco Care: what the policy wording covers",
    answer:
      "Youth Eco Care (UIN OICHLIP24034V012324) waits only 12 months for pre-existing diseases. The room is up to 1% of the sum insured a day up to ₹5 lakh cover, ₹10,000 a day at ₹7 to 10 lakh, and actuals above ₹10 lakh. Covers up to ₹10 lakh have several sub-limits, including cataract, AYUSH at 25% and modern treatments at 25% of the sum insured. It pays 45 days before and 90 days after a stay. Maternity is on the Premium plan only.",
    sections: [
      {
        h2: "Limits by sum insured",
        table: {
          head: ["Item", "Up to ₹5 lakh", "₹7 to 10 lakh", "Above ₹10 lakh"],
          rows: [
            ["Room", "1% of sum insured a day", "₹10,000 a day", "Actuals"],
            ["ICU", "₹10,000 a day", "₹20,000 a day", "Actuals"],
            ["Modern treatments", "25% of sum insured", "25% of sum insured", "Actuals"],
            ["Cataract (per eye)", "₹50,000", "₹50,000", "₹1 lakh"],
          ],
        },
      },
      {
        h2: "Other things to know",
        bullets: [
          "AYUSH: up to 25% of the sum insured.",
          "Treatment at home: up to 10% of the sum insured, max ₹50,000.",
          "Bonus: 10% a year, up to 100%, reduced at the same rate after a claim.",
          "No restoration benefit.",
          "Maternity on the Premium plan only, after 24 months, for up to 2 deliveries.",
          "Organ donor costs when you receive an organ, and up to 10% of the sum insured when you donate one.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "12 months."],
            ["Listed illnesses and surgeries", "1 or 2 years by condition. High blood pressure and diabetes, if new, 90 days."],
            ["Maternity (Premium plan)", "24 months."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "What is the pre-existing disease waiting period in Oriental Youth Eco Care?",
        answer: "12 months of continuous cover.",
      },
      {
        question: "Does Youth Eco Care have a room-rent limit?",
        answer: "Yes up to ₹10 lakh cover: 1% of the sum insured a day up to ₹5 lakh, and ₹10,000 a day at ₹7 to 10 lakh. Above ₹10 lakh it pays actuals.",
      },
      {
        question: "Does Youth Eco Care cover maternity?",
        answer: "Only on the Premium plan, after 24 months.",
      },
    ],
    sources: [
      {
        document: "Oriental Youth Eco Care Policy wording",
        uin: "OICHLIP24034V012324",
        clauses: "Room and ICU bands, sub-limits table, pre and post (45/90 days), cumulative bonus, maternity (Premium), 4.38, waiting periods",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "sub-limit", "pre-existing-disease-waiting-period", "maternity-cover"],
    related: ["new-india-yuva-bharat"],
  },

  {
    slug: "raheja-qbe-health-qube",
    primaryKeyword: "raheja qbe health qube",
    sheetRows: [
      { keyword: "raheja qbe health qube comprehensive", evidence: "Insurer/product/glossary candidate" },
      { keyword: "raheja qbe health qube basic", evidence: "Insurer/product/glossary candidate" },
      { keyword: "raheja qbe health qube super saver", evidence: "Insurer/product/glossary candidate" },
      { keyword: "raheja qbe health qube a la carte", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "plan",
    insurers: ["Raheja QBE"],
    title: "Raheja QBE Health QuBE: Plans and Co-pays | IndSure",
    description:
      "IndSure reads the Raheja QBE Health QuBE wording: Basic, Comprehensive, Super Saver and A la Carte, 50% co-pay on modern treatments, caps.",
    h1: "Raheja QBE Health QuBE: the four plans and their limits",
    answer:
      "Health QuBE (UIN RQBHLIP26036V052526) has four plans. Basic, Super Saver and A la Carte limit the room to 1% of the sum insured a day and ICU to 2%; Comprehensive has no room or ICU limit. Every plan pays modern treatments like robotic surgery with a 50% co-payment, caps cataract at ₹50,000 an eye and joint replacement at ₹3 lakh a joint, and charges 20% of every claim for anyone whose entry age is above 60.",
    sections: [
      {
        h2: "Limits in every plan",
        bullets: [
          "Modern treatments (robotic surgery, oral chemotherapy and others): 50% co-payment on every claim.",
          "Cataract, including the lens: up to ₹50,000 per eye.",
          "Joint replacement, including implants: up to ₹3 lakh per joint.",
          "20% co-payment for anyone whose entry age is above 60. Super Saver has a 20% co-payment for everyone.",
          "Restoration: the original sum insured once a year, not for an illness already claimed that year.",
          "No-claim bonus: 5% a year, up to 100%.",
        ],
      },
      {
        h2: "Room and ICU by plan",
        table: {
          head: ["Plan", "Room", "ICU"],
          rows: [
            ["Basic", "1% of sum insured a day", "2% a day"],
            ["Super Saver", "1% of sum insured a day", "2% a day"],
            ["A la Carte", "1% of sum insured a day", "2% a day"],
            ["Comprehensive (₹3 lakh+)", "No limit", "No limit"],
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
            ["Listed illnesses and surgeries", "24 months; some mental illnesses 36 months."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "Which Health QuBE plan has no room-rent limit?",
        answer: "Comprehensive, for sum insured of ₹3 lakh and above. The other three plans limit room to 1% of the sum insured a day.",
      },
      {
        question: "Is robotic surgery fully covered in Health QuBE?",
        answer: "No. All listed modern treatments, including robotic surgery, carry a 50% co-payment.",
      },
      {
        question: "Is there a co-payment for senior citizens?",
        answer: "Yes, 20% of every claim for anyone whose age at entry is above 60.",
      },
    ],
    sources: [
      {
        document: "Raheja QBE Health QuBE policy wording",
        uin: "RQBHLIP26036V052526",
        clauses: "Sections A to L (L: Advance Treatment 50% co-pay), mandatory co-payment, NCB, recharge, sub-limits schedule, waiting periods",
      },
    ],
    checkedOn,
    learn: ["co-pay", "sub-limit", "room-rent-cap", "restoration-benefit"],
    related: ["royal-sundaram-multiplier"],
  },

  {
    slug: "new-india-yuva-bharat",
    primaryKeyword: "new india yuva bharat health policy",
    sheetRows: [
      { keyword: "new india health insurance yuva bharat health policy", evidence: "Real forum question/topic" },
      { keyword: "new india yuva bharat platinum", evidence: "Insurer/product/glossary candidate" },
      { keyword: "new india yuva bharat gold key add ons", evidence: "Insurer/product/glossary candidate" },
      { keyword: "new india yuva bharat base key add ons", evidence: "Insurer/product/glossary candidate" },
    ],
    kind: "plan",
    insurers: ["New India Assurance"],
    title: "New India Yuva Bharat Health Policy Explained | IndSure",
    description:
      "IndSure reads the New India Yuva Bharat wording: Base, Gold and Platinum, room by cover, guaranteed bonus, reinstatement, 24-month PED wait.",
    h1: "New India Yuva Bharat Health Policy: Base, Gold and Platinum",
    answer:
      "Yuva Bharat (UIN NIAHLIP25059V042425) waits 24 months for pre-existing diseases and 12 months for most listed illnesses. The room is a single AC room at ₹5 to 15 lakh cover and a deluxe AC room from ₹25 lakh. The bonus is 25% a year up to 100%; on Gold and Platinum it is guaranteed, so a claim does not reduce it. Cover is reinstated once a year on Base and twice on Gold and Platinum, for unrelated illness. Maternity is on Platinum only.",
    sections: [
      {
        h2: "Base vs Gold vs Platinum",
        table: {
          head: ["", "Base", "Gold", "Platinum"],
          rows: [
            ["Bonus", "25% a year up to 100%, reduced after a claim", "Guaranteed, not reduced by a claim", "Guaranteed, not reduced by a claim"],
            ["Reinstatement", "Once a year, unrelated illness", "Twice a year, unrelated illness", "Twice a year, unrelated illness"],
            ["Maternity", "Not covered", "Not covered", "After 24 months, up to 2 claims"],
            ["Air ambulance", "Not covered", "Covered", "Covered"],
          ],
        },
      },
      {
        h2: "Limits in every plan",
        bullets: [
          "Room: single AC room at ₹5, 10 and 15 lakh; deluxe AC room at ₹25 lakh and above.",
          "Cataract and modern treatments have caps that depend on the sum insured.",
          "Road ambulance: ₹5,000 to ₹20,000 per illness, by sum insured.",
          "10% co-payment only if you pay a Zone II premium and are treated in a Zone I city.",
          "Treatment at home is not covered.",
        ],
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "24 months."],
            ["Listed illnesses and surgeries", "12 months for most; 24 months for joint replacement and some others."],
            ["Maternity (Platinum)", "24 months."],
          ],
        },
      },
    ],
    faqs: [
      {
        question: "What is the pre-existing disease waiting period in New India Yuva Bharat?",
        answer: "24 months of continuous cover.",
      },
      {
        question: "What is a guaranteed cumulative bonus?",
        answer: "On Gold and Platinum, a bonus already credited is not reduced if you claim later.",
      },
      {
        question: "Does Yuva Bharat cover maternity?",
        answer: "Only the Platinum plan, after 24 months, for up to 2 claims in a lifetime.",
      },
    ],
    sources: [
      {
        document: "New India Yuva Bharat Health Policy wording",
        uin: "NIAHLIP25059V042425",
        clauses: "2.19 Guaranteed Cumulative Bonus, room by sum insured, reinstatement, maternity, zone co-payment, 4.4.17, waiting periods",
      },
    ],
    checkedOn,
    learn: ["no-claim-bonus", "restoration-benefit", "room-rent-cap", "zone-based-co-pay"],
    related: ["oriental-youth-eco-care"],
  },

  {
    slug: "sbi-general-health-edge",
    primaryKeyword: "sbi general health edge",
    sheetRows: [
      { keyword: "sbi general health edge", evidence: "Insurer/product/glossary candidate" },
      { keyword: "domestic help cover sbi general health edge plan", evidence: "Editorial topic candidate" },
    ],
    kind: "plan",
    insurers: ["SBI General"],
    title: "SBI General Health Edge: Domestic Help Cover | IndSure",
    description:
      "IndSure reads the SBI General Health Edge wording: no room limit, 24-month PED wait, optional refill and booster, domestic help cover.",
    h1: "SBI General Health Edge: what it covers, including domestic help",
    answer:
      "Health Edge (UIN SBIHLIP23173V012223) pays room and ICU at actuals up to the sum insured, waits 24 months for pre-existing diseases and listed illnesses, and pays 30 days before and 60 days after a stay. Bonus and refill are add-ons, not built in. Its Domestic Help/Staff Indemnity add-on covers your domestic help's hospital treatment, with its own sum insured of ₹50,000 or ₹1 lakh and its own room and ICU limits.",
    sections: [
      {
        h2: "The domestic help add-on",
        bullets: [
          "Covers hospital stays, day care, AYUSH, modern treatments, road ambulance and bariatric surgery for your domestic help.",
          "Has its own sum insured, ₹50,000 or ₹1 lakh, separate from yours.",
          "For the domestic help: room up to 2% and ICU up to 4% of that sum insured a day, and ambulance up to ₹3,000.",
          "Individual cover, for helpers aged 18 to 65.",
        ],
      },
      {
        h2: "What the base plan pays",
        bullets: [
          "Room and ICU at actuals, up to the sum insured.",
          "12 listed modern treatments, up to the sum insured.",
          "Road ambulance up to ₹3,000 per hospitalisation.",
          "No co-payment unless you choose one.",
          "Treatment at home is not covered.",
        ],
      },
      {
        h2: "Add-ons for your own cover",
        bullets: [
          "Unlimited Refill: 100% of the base sum insured from the first claim, related or unrelated illness.",
          "Booster: 50% of base cover a year, up to 200%.",
          "Women Care: delivery after 48 months. Global Treatment for listed illnesses abroad. Claims Safeguard for items a bill normally leaves out.",
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
        question: "What is the domestic help cover in SBI Health Edge?",
        answer: "An add-on that pays your domestic help's hospital treatment, with a separate sum insured of ₹50,000 or ₹1 lakh and its own room and ICU limits.",
      },
      {
        question: "Does SBI Health Edge have a room-rent limit?",
        answer: "Not for you. Your room and ICU are paid at actuals up to the sum insured. The 2% room limit applies only to the domestic help add-on.",
      },
      {
        question: "Does Health Edge restore the sum insured?",
        answer: "Only with the Unlimited Refill add-on.",
      },
    ],
    sources: [
      {
        document: "SBI General Health Edge Insurance policy wording",
        uin: "SBIHLIP23173V012223",
        clauses: "C.1, C.4 to C.8, D.1 Domestic Help/Staff Indemnity, D.5, D.8, D.10, D.12.1, D.13, benefit table",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "restoration-benefit", "pre-existing-disease-waiting-period"],
    related: ["indusind-health-infinity"],
  },

  {
    slug: "indusind-health-infinity",
    primaryKeyword: "reliance general health infinity policy wording",
    sheetRows: [{ keyword: "reliance general health infinity policy wording", evidence: "Editorial topic candidate" }],
    kind: "plan",
    insurers: ["IndusInd General"],
    title: "IndusInd (Reliance) Health Infinity: Wording | IndSure",
    description:
      "IndSure reads the IndusInd Health Infinity wording (formerly Reliance General): single private room, restore, 90 and 180 days, modern treatment caps.",
    h1: "IndusInd Health Infinity (formerly Reliance General): what the wording covers",
    answer:
      "Health Infinity (UIN RELHLIP23120V042223), sold by IndusInd General (formerly Reliance General), pays up to a single private AC room, with ICU never cut in proportion. It pays 90 days before and 180 days after a stay and restores 100% of the sum insured once a year for an unrelated illness. Modern treatments are capped at 50% of the sum insured below ₹10 lakh cover. There is no cumulative bonus. Pre-existing diseases wait 36 months.",
    sections: [
      {
        h2: "Key limits",
        table: {
          head: ["Item", "What the wording says"],
          rows: [
            ["Room", "Single private AC room. A higher room means the related bill is paid in proportion."],
            ["ICU", "Not cut in proportion in any case."],
            ["Modern treatments", "Up to 50% of sum insured below ₹10 lakh; up to the sum insured from ₹10 lakh."],
            ["Road ambulance", "Within the sum insured, including intercity transfers."],
            ["Before and after a stay", "90 days and 180 days."],
            ["Bonus", "None. A renewal discount for sharing a health check-up is offered instead."],
            ["Restore", "100% once a year, unrelated illness. Unlimited Restore is an add-on."],
          ],
        },
      },
      {
        h2: "Waiting periods",
        table: {
          head: ["Waiting period", "What the wording says"],
          rows: [
            ["Any illness after you first buy", "30 days. Accidents are covered from day 1."],
            ["Pre-existing diseases", "36 months, or 24 or 12 with an add-on."],
            ["Listed illnesses and surgeries", "24 months, or 12 with an add-on."],
          ],
        },
      },
      {
        h2: "Add-ons",
        bullets: [
          "Maternity and newborn (3-year policies, women aged 18 to 45).",
          "Consumables cover, air ambulance, OPD, home care and MoreGlobal for treatment abroad.",
          "Voluntary co-payment or deductible for a lower premium.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is Reliance Health Infinity the same as IndusInd Health Infinity?",
        answer: "Yes. Reliance General Insurance is now IndusInd General Insurance. The wording keeps the UIN RELHLIP23120V042223.",
      },
      {
        question: "Does Health Infinity have a no-claim bonus?",
        answer: "No. The wording has no cumulative bonus. It offers a renewal premium discount for sharing health check-up results instead.",
      },
      {
        question: "Does Health Infinity cover maternity?",
        answer: "Only as an add-on, on 3-year policies, for women aged 18 to 45.",
      },
    ],
    sources: [
      {
        document: "IndusInd Health Infinity Insurance policy wording",
        uin: "RELHLIP23120V042223",
        clauses: "3.1 basic benefits incl. 3.1.2, 3.1.9, 3.1.11 Restore, 3.2.3, 3.4 optional covers, Excl01 to Excl03",
      },
    ],
    checkedOn,
    learn: ["room-rent-cap", "proportionate-deduction", "restoration-benefit", "sub-limit"],
    related: ["sbi-general-health-edge"],
  },
];
