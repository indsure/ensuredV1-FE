// IndSure Clause Library — plain-language, evergreen explanations of the
// insurance concepts our parser extracts from real policies. Each entry is a
// citable reference page at /learn/:slug.
//
// ACCURACY POLICY: content here is evergreen mechanics, not volatile figures.
// Where a number has changed under recent IRDAI norms (waiting periods,
// free-look/grace windows, moratorium) we describe the concept and give ranges
// with a "check your policy / current IRDAI norms" pointer, rather than pinning
// a specific figure that could go stale. No insurer-specific claims that we
// cannot stand behind.

export type Lob = "health" | "motor" | "life" | "general";

export interface ClauseFaq {
  question: string;
  answer: string;
}

export interface ClauseSection {
  h2: string;
  /** Paragraphs of plain text. */
  body: string[];
}

export interface ClauseEntry {
  slug: string;
  /** The canonical term, e.g. "Room rent cap". */
  term: string;
  /** Other names people search for. */
  aka?: string[];
  lob: Lob;
  /** One-line grouping label for the hub. */
  category: string;
  /** Answer-first definition, 40-60 words, written to be quotable. */
  shortAnswer: string;
  sections: ClauseSection[];
  example?: string;
  mistakes?: string[];
  faqs: ClauseFaq[];
  /** Slugs of related clause entries. */
  related?: string[];
  /** Related blog deep-dives (slug from blog POST_SLUGS). */
  relatedBlog?: { title: string; slug: string }[];
}

export const CLAUSE_LIBRARY: ClauseEntry[] = [
  {
    slug: "room-rent-cap",
    term: "Room rent cap",
    aka: ["room rent limit", "room rent capping", "room rent sub-limit"],
    lob: "health",
    category: "Limits and sub-limits",
    shortAnswer:
      "A room rent cap is a limit on how much your health insurer will pay per day for your hospital room. If you choose a room that costs more, you pay the difference, and in many policies the insurer also cuts every other bill in the same proportion.",
    sections: [
      {
        h2: "How a room rent cap works",
        body: [
          "Hospitals price most services by room category. A deluxe room does not just cost more per night, it usually comes with higher charges for the surgeon, nursing, and other services attached to that room class.",
          "When your policy caps room rent (say at a fixed rupee amount or a percentage of the sum insured per day) and you pick a costlier room, most insurers apply a proportionate deduction: they scale down the entire admissible claim, not just the room charge. This is why a room rent cap can quietly shrink a claim far more than the room bill alone.",
        ],
      },
      {
        h2: "Why insurers use it",
        body: [
          "Room choice is one of the few hospital costs a patient controls, and it drives many linked costs. Capping room rent discourages over-spending on the room and limits the insurer's exposure on every claim.",
        ],
      },
    ],
    example:
      "Your policy caps room rent at Rs 5,000/day but you take a Rs 10,000/day room. Because you used a room at 2x the eligible rate, the insurer may pay only half of the associated charges too. A Rs 4 lakh bill can settle at closer to Rs 2 lakh, even though your sum insured was Rs 10 lakh.",
    mistakes: [
      "Assuming a large sum insured means no room limit. The two are separate. A Rs 10 lakh policy can still cap room rent.",
      "Reading only the room-rent line and missing the proportionate-deduction clause that applies it to the whole bill.",
      "Not checking whether a Room Rent Waiver rider is available to remove the cap.",
    ],
    faqs: [
      {
        question: "Does a room rent cap apply to ICU charges?",
        answer:
          "Many policies set a separate, higher ICU limit (or no ICU limit) while capping normal rooms. Check both lines in your policy; they are often different.",
      },
      {
        question: "How do I remove a room rent cap?",
        answer:
          "Some insurers offer a Room Rent Waiver rider, or plans with no room capping. You can also choose a room within the eligible category to avoid proportionate deduction.",
      },
    ],
    related: ["sub-limit", "co-pay", "deductible"],
    relatedBlog: [
      { title: "Room Rent Caps: The Hidden Cost in Your Policy", slug: "room-rent-caps-hidden-cost" },
    ],
  },
  {
    slug: "co-pay",
    term: "Co-pay",
    aka: ["copay", "co-payment", "co pay in health insurance"],
    lob: "health",
    category: "Cost sharing",
    shortAnswer:
      "A co-pay is the share of an approved claim you agree to pay yourself, expressed as a percentage. If your policy has a 20% co-pay and the approved claim is Rs 1 lakh, the insurer pays Rs 80,000 and you pay Rs 20,000, on every claim the co-pay applies to.",
    sections: [
      {
        h2: "How co-pay works",
        body: [
          "Co-pay is applied after the claim is approved and other deductions are made. It is a fixed percentage of the payable amount, so it scales with the size of the claim.",
          "Co-pay is common on senior-citizen plans, on policies bought in metro cities but used in smaller towns (zone-based co-pay), and on certain treatments. Some policies let you buy the co-pay down for a higher premium.",
        ],
      },
      {
        h2: "Why insurers use it",
        body: [
          "A co-pay keeps the policyholder financially involved in every claim, which reduces small or unnecessary claims and lets the insurer offer a lower premium.",
        ],
      },
    ],
    example:
      "A senior-citizen plan with a 25% co-pay settles a Rs 4 lakh approved claim by paying Rs 3 lakh, leaving Rs 1 lakh for you, before any room-rent or sub-limit deductions are even considered.",
    mistakes: [
      "Confusing co-pay (a percentage of each claim) with a deductible (a fixed amount before cover starts).",
      "Buying a low-premium plan without noticing it carries a mandatory co-pay.",
      "Assuming co-pay applies only to room rent; it usually applies to the whole approved claim.",
    ],
    faqs: [
      {
        question: "Is co-pay charged on every claim?",
        answer:
          "If your policy has a co-pay, it typically applies to every claim it covers, for the life of the policy, unless you have a plan or rider that waives it.",
      },
      {
        question: "Can I avoid co-pay?",
        answer:
          "Choose a plan without a mandatory co-pay, or one that offers a co-pay waiver option. Always read the co-pay line before buying, especially on senior-citizen plans.",
      },
    ],
    related: ["deductible", "sub-limit", "room-rent-cap"],
  },
  {
    slug: "sub-limit",
    term: "Sub-limit",
    aka: ["sub limit", "disease sub-limit", "treatment cap"],
    lob: "health",
    category: "Limits and sub-limits",
    shortAnswer:
      "A sub-limit is a cap on how much your policy pays for a specific treatment or expense, even though your total sum insured is larger. For example, a cataract sub-limit of Rs 40,000 means the policy pays at most Rs 40,000 for that surgery regardless of your Rs 10 lakh cover.",
    sections: [
      {
        h2: "How sub-limits work",
        body: [
          "Sub-limits sit inside your overall sum insured. Common ones apply to cataract, knee replacement, some other named surgeries, ambulance charges, and modern treatments. Room rent and ICU charges are also a form of sub-limit.",
          "If the actual cost exceeds the sub-limit, you pay the excess out of pocket, even if plenty of your sum insured is unused.",
        ],
      },
      {
        h2: "Why insurers use it",
        body: [
          "Sub-limits let insurers control cost on procedures that vary widely in price or are prone to inflated billing, while still advertising a large headline sum insured.",
        ],
      },
    ],
    example:
      "Your Rs 15 lakh policy has a Rs 50,000 sub-limit on cataract surgery. The surgery costs Rs 85,000. The policy pays Rs 50,000 and you pay Rs 35,000, even though most of your cover is untouched.",
    mistakes: [
      "Judging a policy only by its sum insured and ignoring the sub-limit schedule.",
      "Not realising room rent and ICU caps are sub-limits too.",
    ],
    faqs: [
      {
        question: "Which treatments usually have sub-limits?",
        answer:
          "Cataract, some joint-replacement and named surgeries, ambulance, and sometimes modern or day-care procedures. The exact list is in your policy schedule.",
      },
      {
        question: "Are there policies without sub-limits?",
        answer:
          "Yes. Many comprehensive plans advertise no disease-wise sub-limits and no room-rent cap. Confirm this in the wording, not just the brochure.",
      },
    ],
    related: ["room-rent-cap", "co-pay", "deductible"],
  },
  {
    slug: "deductible",
    term: "Deductible",
    aka: ["deductible in health insurance", "voluntary deductible", "aggregate deductible"],
    lob: "health",
    category: "Cost sharing",
    shortAnswer:
      "A deductible is a fixed amount you pay before your insurance starts paying. With a Rs 1 lakh deductible, the insurer covers costs only above Rs 1 lakh. Deductibles are common on top-up and super top-up plans and on some voluntary-deductible health policies.",
    sections: [
      {
        h2: "How a deductible works",
        body: [
          "Unlike a co-pay (a percentage of each claim), a deductible is a rupee threshold. On a top-up plan, the deductible is the amount that your base policy or your own pocket is expected to absorb first.",
          "A super top-up applies the deductible once per year across all claims combined, while an ordinary top-up applies it per claim, which is a meaningful difference at claim time.",
        ],
      },
    ],
    example:
      "You have a Rs 5 lakh base policy and a Rs 5 lakh super top-up with a Rs 5 lakh deductible. A Rs 8 lakh hospital bill is met Rs 5 lakh by the base policy and Rs 3 lakh by the super top-up, once the deductible is crossed.",
    mistakes: [
      "Mixing up per-claim (top-up) and per-year (super top-up) deductibles.",
      "Buying a top-up with a deductible higher than your base cover, leaving a gap in the middle.",
    ],
    faqs: [
      {
        question: "What is the difference between a deductible and a co-pay?",
        answer:
          "A deductible is a fixed amount you pay before cover starts. A co-pay is a percentage of each approved claim you keep paying throughout.",
      },
      {
        question: "Are top-up plan deductibles per claim or per year?",
        answer:
          "An ordinary top-up applies the deductible to each claim. A super top-up applies it once a year across all claims, which usually pays out more often.",
      },
    ],
    related: ["co-pay", "sub-limit"],
  },
  {
    slug: "pre-existing-disease-waiting-period",
    term: "Pre-existing disease (PED) waiting period",
    aka: ["PED waiting period", "pre existing disease", "existing illness waiting"],
    lob: "health",
    category: "Waiting periods",
    shortAnswer:
      "A pre-existing disease (PED) waiting period is the time you must hold a policy before conditions you already had when buying are covered. During this window, claims arising from those conditions are excluded. IRDAI has been reducing the maximum length of this waiting period in recent years.",
    sections: [
      {
        h2: "How the PED waiting period works",
        body: [
          "A pre-existing disease is generally one you were diagnosed with, or took treatment or advice for, before buying the policy (within a defined look-back window). Cover for such conditions begins only after you have held the policy continuously for the stated waiting period.",
          "The exact length depends on the plan and current regulation, and some plans let you buy the waiting period down. Always read the PED clause and your declared conditions carefully, because non-disclosure is a leading cause of claim rejection.",
        ],
      },
    ],
    example:
      "You disclose diabetes when buying the policy. A diabetes-linked hospitalisation in the first year may be excluded under the PED clause, while the same claim after the waiting period ends would be payable.",
    mistakes: [
      "Not disclosing an existing condition, which can void the claim later.",
      "Assuming the PED clock restarts if you port to another insurer; continuous coverage credit usually carries over on porting.",
    ],
    faqs: [
      {
        question: "How long is the PED waiting period?",
        answer:
          "It varies by plan and has been shortened under recent IRDAI norms. Check your policy's PED clause for the exact period, and whether a buy-down option is available.",
      },
      {
        question: "Does porting reset the PED waiting period?",
        answer:
          "Porting to a new insurer generally preserves the continuous-coverage credit you have already earned, so you usually do not start the waiting period again from zero.",
      },
    ],
    related: ["initial-waiting-period", "disease-specific-waiting-period", "moratorium-period"],
    relatedBlog: [
      { title: "Pre-existing Disease Waiting Periods", slug: "pre-existing-disease-waiting-periods" },
    ],
  },
  {
    slug: "initial-waiting-period",
    term: "Initial waiting period",
    aka: ["30 day waiting period", "cooling period"],
    lob: "health",
    category: "Waiting periods",
    shortAnswer:
      "The initial waiting period is a short window at the start of a new health policy (commonly around 30 days) during which only accident-related hospitalisation is covered. Illness claims raised in this window are usually excluded, to prevent buying cover only after symptoms appear.",
    sections: [
      {
        h2: "How it works",
        body: [
          "From the policy start date, claims for illness are generally not payable for the initial waiting period, while hospitalisation due to an accident is typically covered from day one.",
          "This is separate from, and shorter than, the pre-existing disease and disease-specific waiting periods, which run for longer.",
        ],
      },
    ],
    mistakes: [
      "Delaying buying cover until you feel unwell; illness claims in the first weeks are usually excluded.",
      "Confusing the short initial waiting period with the much longer PED waiting period.",
    ],
    faqs: [
      {
        question: "Are accidents covered during the initial waiting period?",
        answer:
          "Yes, accident-related hospitalisation is typically covered from day one; the initial waiting period usually applies only to illness.",
      },
    ],
    related: ["pre-existing-disease-waiting-period", "disease-specific-waiting-period"],
  },
  {
    slug: "disease-specific-waiting-period",
    term: "Disease-specific waiting period",
    aka: ["specific illness waiting period", "named ailment waiting period"],
    lob: "health",
    category: "Waiting periods",
    shortAnswer:
      "A disease-specific waiting period is a fixed period (often around two years) before the policy covers certain named conditions and planned surgeries such as cataract, hernia, some joint replacements, and specified ENT or gynaecological procedures, even if the condition is not pre-existing.",
    sections: [
      {
        h2: "How it works",
        body: [
          "Insurers list specific ailments and elective procedures that are commonly planned rather than emergencies, and apply a waiting period to them regardless of whether you had the condition before.",
          "The exact list and duration are in your policy. These procedures are payable once the named waiting period ends and you have held the policy continuously.",
        ],
      },
    ],
    example:
      "A cataract that develops in year one may fall under a two-year named-ailment waiting period and be excluded until that period ends, separate from any cataract sub-limit that applies afterwards.",
    faqs: [
      {
        question: "Which conditions have specific waiting periods?",
        answer:
          "Commonly cataract, hernia, piles, some joint replacements, and specified ENT and gynaecological procedures. Your policy lists the exact conditions and periods.",
      },
    ],
    related: ["initial-waiting-period", "pre-existing-disease-waiting-period", "sub-limit"],
  },
  {
    slug: "restoration-benefit",
    term: "Restoration benefit",
    aka: ["refill benefit", "recharge benefit", "reinstatement of sum insured"],
    lob: "health",
    category: "Benefits",
    shortAnswer:
      "A restoration (or refill) benefit tops your sum insured back up after it is used up during the policy year, so a second unrelated hospitalisation still has cover. The trigger, whether it applies to the same illness, and how many times it refills all vary by policy.",
    sections: [
      {
        h2: "How restoration works",
        body: [
          "If a claim exhausts part or all of your sum insured, the restoration benefit reinstates it for later claims in the same year. This protects against a second, unrelated event wiping you out after a big first claim.",
          "The important fine print: some policies restore only for a different illness, some restore only after the full sum insured is exhausted, and some restore multiple times. Read which trigger and scope your policy uses.",
        ],
      },
    ],
    example:
      "Your Rs 5 lakh cover is used up on a heart procedure. Later that year, an unrelated Rs 4 lakh hospitalisation is still covered because the restoration benefit refilled the sum insured.",
    mistakes: [
      "Assuming restoration applies to the same illness; many policies restore only for unrelated conditions.",
      "Assuming it triggers on partial use; some restore only after the sum insured is fully exhausted.",
    ],
    faqs: [
      {
        question: "Does restoration cover the same illness again?",
        answer:
          "It depends on the policy. Some restore only for a different, unrelated illness; newer plans may restore for the same illness too. Check the trigger in your wording.",
      },
    ],
    related: ["sub-limit", "no-claim-bonus"],
    relatedBlog: [
      { title: "Restoration Benefit Explained", slug: "restoration-benefit-explained" },
    ],
  },
  {
    slug: "no-claim-bonus",
    term: "No Claim Bonus (NCB)",
    aka: ["NCB", "cumulative bonus", "no claim discount"],
    lob: "health",
    category: "Benefits",
    shortAnswer:
      "A No Claim Bonus rewards you for a claim-free year. In health insurance it usually increases your sum insured at no extra premium; in motor insurance it is a discount on your own-damage premium. Making a claim can reduce or reset the accumulated bonus.",
    sections: [
      {
        h2: "NCB in health insurance",
        body: [
          "For each claim-free year, many health plans add a percentage to your sum insured, up to a cap, giving you more cover for the same premium. If you claim, the bonus may reduce, though some plans protect it.",
        ],
      },
      {
        h2: "NCB in motor insurance",
        body: [
          "In car and bike insurance, NCB is a discount on the own-damage part of your premium that grows with each claim-free year up to a maximum. A single claim can reset it to zero at the next renewal, which is why small claims are sometimes not worth making.",
        ],
      },
    ],
    example:
      "A motor policy with a 50% NCB gives a large discount on the own-damage premium. One small claim can reset that to 0%, so a Rs 8,000 dent claim can cost far more than Rs 8,000 in lost bonus over the next years.",
    mistakes: [
      "Making a small motor claim without checking how much NCB you would lose.",
      "Letting a motor policy lapse, which can forfeit accumulated NCB.",
    ],
    faqs: [
      {
        question: "Do I lose my No Claim Bonus if I make a claim?",
        answer:
          "Usually yes, unless you have an NCB-protection add-on. In motor insurance a claim often resets NCB at renewal; in health insurance the accumulated bonus may reduce.",
      },
    ],
    related: ["restoration-benefit", "idv"],
  },
  {
    slug: "permanent-exclusions",
    term: "Permanent exclusions",
    aka: ["policy exclusions", "what is not covered", "exclusions in health insurance"],
    lob: "health",
    category: "Exclusions",
    shortAnswer:
      "Permanent exclusions are treatments and situations a policy never covers, no matter how long you hold it. These are listed in the policy wording and commonly include cosmetic surgery, most dental and vision unless from an accident, and treatments arising from specified excluded causes.",
    sections: [
      {
        h2: "How exclusions work",
        body: [
          "Every policy has a list of permanent exclusions that sit outside the cover entirely, separate from waiting periods (which are temporary). IRDAI has standardised many exclusion definitions to make policies more comparable.",
          "Reading the exclusions list is the single most useful thing you can do before a claim, because a rejection under a permanent exclusion cannot be appealed the way a documentation issue can.",
        ],
      },
    ],
    mistakes: [
      "Assuming anything medical is covered; the exclusions list defines the true boundary of the policy.",
      "Confusing a temporary waiting period with a permanent exclusion.",
    ],
    faqs: [
      {
        question: "What is commonly excluded from health insurance?",
        answer:
          "Typically cosmetic treatment, most routine dental and vision unless accident-related, and treatments from specified excluded causes. Your policy's exclusions section lists the exact items.",
      },
    ],
    related: ["pre-existing-disease-waiting-period", "sub-limit"],
    relatedBlog: [
      { title: "Top 5 Health Insurance Gaps", slug: "top-5-health-insurance-gaps" },
    ],
  },
  {
    slug: "free-look-period",
    term: "Free-look period",
    aka: ["free look period", "policy cancellation window", "cooling-off period"],
    lob: "health",
    category: "Policy rights",
    shortAnswer:
      "The free-look period is a window after you receive a new policy during which you can review it and cancel for a refund if you disagree with the terms. IRDAI mandates this window for life and health policies; the exact length has been revised in recent norms, so check the current figure.",
    sections: [
      {
        h2: "How the free-look period works",
        body: [
          "When a new long-term policy is issued, you get a short period to read the actual wording, not just the sales pitch, and to cancel if the terms are not what you expected. The insurer refunds the premium after deducting proportionate risk cover and any expenses.",
          "This is one of the few consumer protections that lets you exit cleanly, which is exactly the moment to run the policy through a clause check.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I get a full refund in the free-look period?",
        answer:
          "You generally get the premium back minus proportionate cover for the days on risk, a medical-check cost if any, and stamp duty. The precise deductions are set by regulation and your insurer.",
      },
    ],
    related: ["grace-period", "moratorium-period"],
  },
  {
    slug: "grace-period",
    term: "Grace period",
    aka: ["renewal grace period", "premium grace period"],
    lob: "health",
    category: "Policy rights",
    shortAnswer:
      "The grace period is extra time after your renewal due date to pay the premium without losing continuity benefits such as waiting-period credit. If you pay within the grace period, your policy is treated as continuous; if it lapses, you can lose accumulated credits.",
    sections: [
      {
        h2: "Why the grace period matters",
        body: [
          "Continuity is valuable: it preserves the waiting periods you have already served and any accumulated bonus. Paying within the grace period keeps that continuity intact.",
          "A lapse beyond the grace period can mean starting waiting periods again and losing No Claim Bonus, so the renewal date is worth a calendar reminder.",
        ],
      },
    ],
    faqs: [
      {
        question: "What happens if I miss the grace period?",
        answer:
          "The policy can lapse. You may lose waiting-period credit and accumulated bonus, and a fresh policy would restart those clocks. Pay within the grace period to avoid this.",
      },
    ],
    related: ["free-look-period", "no-claim-bonus", "pre-existing-disease-waiting-period"],
  },
  {
    slug: "day-care-procedures",
    term: "Day-care procedures",
    aka: ["day care treatment", "procedures under 24 hours"],
    lob: "health",
    category: "Benefits",
    shortAnswer:
      "Day-care procedures are treatments that need hospitalisation for less than 24 hours because of technology, such as cataract surgery, dialysis, chemotherapy, and many others. Good policies cover a wide list of these even though the usual rule requires a 24-hour admission.",
    sections: [
      {
        h2: "How day-care cover works",
        body: [
          "Standard hospitalisation cover often requires at least 24 hours of admission. Day-care cover is the exception that pays for listed procedures completed in less time, which matters as more treatments become same-day.",
          "Policies differ in how many day-care procedures they list. This is separate from OPD cover, which is for treatment without any hospital admission at all.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is cataract surgery a day-care procedure?",
        answer:
          "Usually yes. Cataract is one of the most common day-care procedures, though it may also carry a sub-limit and a named-ailment waiting period. Check all three lines in your policy.",
      },
    ],
    related: ["sub-limit", "disease-specific-waiting-period"],
  },
  {
    slug: "moratorium-period",
    term: "Moratorium period",
    aka: ["moratorium in health insurance", "non-contestability period"],
    lob: "health",
    category: "Policy rights",
    shortAnswer:
      "After a continuous coverage period defined by IRDAI, a health policy enters a moratorium: the insurer can no longer contest a claim on the ground of non-disclosure or misrepresentation, except in cases of proven fraud. It protects long-standing policyholders from late rejections.",
    sections: [
      {
        h2: "Why the moratorium matters",
        body: [
          "Once the moratorium applies, your policy cannot be challenged over how a pre-existing condition was disclosed years earlier, unless the insurer can prove fraud. This gives long-term policyholders certainty.",
          "The length of continuous coverage required has been revised under recent IRDAI norms, so confirm the current period rather than relying on an older figure.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can an insurer reject a claim after the moratorium?",
        answer:
          "After the moratorium, a claim cannot be contested for non-disclosure or misrepresentation except on grounds of proven fraud. Ordinary policy terms and exclusions still apply.",
      },
    ],
    related: ["pre-existing-disease-waiting-period", "free-look-period"],
  },
  {
    slug: "idv",
    term: "Insured Declared Value (IDV)",
    aka: ["IDV", "car IDV", "vehicle insured value"],
    lob: "motor",
    category: "Motor insurance",
    shortAnswer:
      "IDV is the maximum your motor insurer will pay if your vehicle is stolen or written off. It is roughly the current market value after depreciation, not what you originally paid. A higher IDV means a higher payout at total loss but a slightly higher premium.",
    sections: [
      {
        h2: "How IDV works",
        body: [
          "Each year the IDV falls as depreciation is applied to your vehicle's value. At a total loss (theft or damage beyond economical repair), the claim is settled against the IDV, not the invoice price.",
          "Setting IDV too low to save premium reduces your payout at the worst moment. Setting it fairly at market value is usually the right call.",
        ],
      },
    ],
    example:
      "A three-year-old car with an IDV of Rs 6 lakh is stolen. The claim settles at up to Rs 6 lakh minus any deductible, regardless of the Rs 10 lakh you paid when new.",
    mistakes: [
      "Under-declaring IDV to lower the premium, which cuts the theft/total-loss payout.",
      "Ignoring that IDV drops every year, which affects renewal payouts.",
    ],
    faqs: [
      {
        question: "Is a higher IDV better?",
        answer:
          "A higher IDV gives a larger payout on theft or total loss for a modestly higher premium. Set it close to fair market value rather than artificially low.",
      },
    ],
    related: ["no-claim-bonus"],
    relatedBlog: [
      { title: "Third-party vs Comprehensive Car Insurance", slug: "third-party-vs-comprehensive-car-insurance" },
    ],
  },

  // ─── Health — process & claims ──────────────────────────────────────────
  {
    slug: "cashless-claim",
    term: "Cashless claim",
    aka: ["cashless hospitalisation", "cashless treatment", "cashless facility"],
    lob: "health",
    category: "Claims and process",
    shortAnswer:
      "A cashless claim lets you get treated at a network hospital without paying the covered amount yourself. Your insurer or its TPA settles the approved bill directly with the hospital. You still pay for anything excluded, above your sum insured, or below a deductible or co-pay.",
    sections: [
      {
        h2: "How a cashless claim works",
        body: [
          "You get admitted at a hospital in your insurer's network and show your health card or policy details. The hospital sends a pre-authorisation request to the insurer or TPA with your diagnosis and estimated cost.",
          "The insurer approves an amount (often in stages), and settles the admissible bill directly with the hospital at discharge. You only pay non-covered items, co-pay, deductible, and anything beyond your sum insured.",
        ],
      },
      {
        h2: "Where cashless can still cost you",
        body: [
          "Cashless only applies at network hospitals, and approval is for the admissible amount, not the whole bill. Room-rent caps, sub-limits, co-pay and non-payable consumables are still deducted, so the 'cashless' figure can be smaller than the sticker bill.",
        ],
      },
    ],
    example:
      "You are admitted at a network hospital for surgery. The insurer pre-approves the covered amount and pays the hospital directly. You settle only the non-payable consumables and your policy's co-pay at discharge.",
    mistakes: [
      "Assuming cashless means the entire bill is covered — sub-limits, co-pay and exclusions still apply.",
      "Going to a non-network hospital and expecting cashless — there you must use reimbursement instead.",
      "Not intimating the insurer in time for a planned admission, which can delay pre-authorisation.",
    ],
    faqs: [
      {
        question: "What if cashless is denied at the hospital?",
        answer:
          "A cashless denial is usually about documentation or a network/eligibility issue, not an outright claim rejection. You can typically still pay and file a reimbursement claim with the same documents afterwards.",
      },
      {
        question: "Is cashless available at every hospital?",
        answer:
          "No. Cashless works only at hospitals in your insurer's network. For non-network hospitals you pay first and claim reimbursement.",
      },
    ],
    related: ["reimbursement-claim", "network-hospital-tpa", "claim-intimation-pre-authorisation", "co-pay"],
    relatedBlog: [
      { title: "Cashless vs Reimbursement: Understanding Claim Processes", slug: "cashless-vs-reimbursement-claims" },
    ],
  },
  {
    slug: "reimbursement-claim",
    term: "Reimbursement claim",
    aka: ["reimbursement", "pay and claim", "non-cashless claim"],
    lob: "health",
    category: "Claims and process",
    shortAnswer:
      "In a reimbursement claim you pay the hospital yourself, then submit bills and documents to your insurer to get the covered amount back. It is how you claim at non-network hospitals, or when cashless was not used, and it pays only the admissible portion of your bill.",
    sections: [
      {
        h2: "How reimbursement works",
        body: [
          "You settle the hospital bill from your own pocket and collect the discharge summary, itemised bills, payment receipts, investigation reports and prescriptions.",
          "You file these with the insurer or TPA within the policy's claim window. They assess the admissible amount against your cover, apply any deductions, and pay the balance to you.",
        ],
      },
      {
        h2: "Why the payout can differ from what you paid",
        body: [
          "Reimbursement pays the admissible amount, not necessarily what you spent. Non-payable items, co-pay, room-rent-linked proportionate deductions and sub-limits are removed first, so keep every document to support the claim.",
        ],
      },
    ],
    example:
      "You are treated at a hospital outside your insurer's network, pay the bill, and submit the documents. The insurer reviews them and refunds the covered amount after deducting non-payable items and any co-pay.",
    mistakes: [
      "Missing the claim-submission deadline stated in your policy.",
      "Losing original bills or the itemised breakup, which insurers need to assess the claim.",
      "Not intimating the insurer about the hospitalisation within the required window.",
    ],
    faqs: [
      {
        question: "How long do I have to file a reimbursement claim?",
        answer:
          "Each policy sets its own intimation and document-submission windows (often counted in days from admission or discharge). Check your policy wording and file as early as possible.",
      },
      {
        question: "Can I claim reimbursement after using partial cashless?",
        answer:
          "Yes. If cashless covered only part of an admissible cost, you can usually claim the remaining eligible amount by reimbursement with the balance documents.",
      },
    ],
    related: ["cashless-claim", "network-hospital-tpa", "pre-post-hospitalisation"],
    relatedBlog: [
      { title: "Cashless vs Reimbursement: Understanding Claim Processes", slug: "cashless-vs-reimbursement-claims" },
    ],
  },
  {
    slug: "network-hospital-tpa",
    term: "Network hospital and TPA",
    aka: ["network hospital", "TPA", "third party administrator", "empanelled hospital"],
    lob: "health",
    category: "Claims and process",
    shortAnswer:
      "A network hospital is one that has a tie-up with your insurer to offer cashless treatment. A TPA (Third Party Administrator) is the agency that issues your health card and processes claims between you, the hospital and the insurer. Some insurers process claims in-house instead of using a TPA.",
    sections: [
      {
        h2: "Network hospitals",
        body: [
          "Insurers empanel hospitals where they have agreed rates and a cashless arrangement. At these hospitals you can get cashless treatment; at others you pay and claim reimbursement.",
          "Networks change over time, so it is worth checking the current list — and whether the hospitals you would actually use are on it — before you need to claim.",
        ],
      },
      {
        h2: "What a TPA does",
        body: [
          "A TPA is the intermediary that issues your health card, receives pre-authorisation requests, and coordinates approvals and settlements. Where an insurer runs claims in-house, that team plays the same role.",
        ],
      },
    ],
    example:
      "Before a planned surgery you check that your preferred hospital is in the insurer's network, so you can use cashless. Your TPA card and policy number are what the hospital's insurance desk uses to raise the request.",
    mistakes: [
      "Assuming a hospital is in-network without checking the current list.",
      "Confusing the TPA with the insurer — your cover and terms come from the insurer, the TPA only administers the process.",
    ],
    faqs: [
      {
        question: "Does the network hospital list ever change?",
        answer:
          "Yes. Hospitals can be added or removed from an insurer's network over time. Check the latest list before a planned admission.",
      },
      {
        question: "Is a claim slower with a TPA than in-house?",
        answer:
          "Not inherently. Speed depends on documentation and the specific insurer/TPA. Both route to the same policy terms for the final decision.",
      },
    ],
    related: ["cashless-claim", "reimbursement-claim", "claim-intimation-pre-authorisation"],
    relatedBlog: [
      { title: "Cashless vs Reimbursement: Understanding Claim Processes", slug: "cashless-vs-reimbursement-claims" },
    ],
  },
  {
    slug: "pre-post-hospitalisation",
    term: "Pre- and post-hospitalisation expenses",
    aka: ["pre-hospitalisation", "post-hospitalisation", "pre and post hospitalization cover"],
    lob: "health",
    category: "Claims and process",
    shortAnswer:
      "These are medical costs linked to a hospitalisation but incurred before admission and after discharge — like diagnostic tests, doctor consultations, medicines and follow-ups. Most health policies cover them for a fixed number of days before and after the hospital stay, provided they relate to the same condition.",
    sections: [
      {
        h2: "What counts",
        body: [
          "Pre-hospitalisation covers relevant tests, scans and consultations in the days leading up to admission. Post-hospitalisation covers follow-up consultations, medicines and tests after discharge for the same illness.",
          "Policies define fixed windows (for example a set number of days pre and a longer window post). Only expenses that are connected to the hospitalised condition and fall within those windows are admissible.",
        ],
      },
    ],
    example:
      "A surgery is preceded by blood tests and scans, and followed by review consultations and medicines. If these fall within your policy's pre- and post-hospitalisation windows and relate to the same condition, they are claimable along with the main bill.",
    mistakes: [
      "Discarding pre-admission test bills and pharmacy receipts — they are needed to claim pre-hospitalisation costs.",
      "Assuming unlimited follow-up cover; the post-hospitalisation window and same-condition rule still apply.",
    ],
    faqs: [
      {
        question: "Are pre- and post-hospitalisation costs part of my sum insured?",
        answer:
          "Usually yes — they draw from the same sum insured unless your policy provides a separate limit. Check your wording for the exact days and any sub-limit.",
      },
      {
        question: "Do OPD medicines after discharge count?",
        answer:
          "Follow-up medicines for the hospitalised condition within the post-hospitalisation window are generally claimable. Unrelated or routine OPD costs are handled under OPD cover, if any.",
      },
    ],
    related: ["cashless-claim", "reimbursement-claim", "opd-cover"],
    relatedBlog: [
      { title: "What Is Health Insurance? A Complete Guide for Indians", slug: "what-is-health-insurance" },
    ],
  },
  {
    slug: "health-insurance-portability",
    term: "Health insurance portability (porting)",
    aka: ["porting health insurance", "policy portability", "switching insurer"],
    lob: "health",
    category: "Claims and process",
    shortAnswer:
      "Portability lets you switch your health insurer or plan while carrying forward the credit you have earned for waiting periods already served. Under IRDAI rules you apply before renewal; the new insurer can accept, price, or decline based on underwriting, but cannot make you restart pre-existing-disease waits you have already completed.",
    sections: [
      {
        h2: "How porting protects your waiting periods",
        body: [
          "The main reason to port rather than buy fresh is continuity: the time you have already served against pre-existing-disease and other waiting periods is credited by the new insurer, so you do not start the clock again.",
          "You initiate porting ahead of your renewal date and within the window IRDAI prescribes. The new insurer underwrites the application and may accept it, offer different terms, or decline — acceptance is not automatic.",
        ],
      },
      {
        h2: "What to check before you port",
        body: [
          "Compare the new plan's sum insured, sub-limits, co-pay, room rent and network — not just the premium. Continuity credit protects waiting periods, but the rest of the terms can be very different.",
        ],
      },
    ],
    example:
      "You have served two years of a pre-existing-disease waiting period and want a plan with better room-rent terms. You apply to port before renewal; if the new insurer accepts, your served waiting time is carried over rather than reset.",
    mistakes: [
      "Applying too late — porting must be initiated within the pre-renewal window, not after lapse.",
      "Porting only for a lower premium while ignoring worse sub-limits or co-pay.",
      "Letting the old policy lapse before the new one is confirmed, creating a coverage gap.",
    ],
    faqs: [
      {
        question: "Will I have to serve waiting periods again after porting?",
        answer:
          "Waiting time you have already completed is credited by the new insurer. Any additional cover or higher sum insured you newly add can carry its own fresh waiting period.",
      },
      {
        question: "Can the new insurer reject my porting request?",
        answer:
          "Yes. The new insurer underwrites your application and can accept, modify terms, or decline. Continuity credit applies only if they accept you.",
      },
    ],
    related: ["pre-existing-disease-waiting-period", "moratorium-period", "lifelong-renewability"],
    relatedBlog: [
      { title: "Health Insurance vs Mediclaim: What's the Difference?", slug: "health-insurance-vs-mediclaim" },
    ],
  },
  {
    slug: "claim-intimation-pre-authorisation",
    term: "Claim intimation and pre-authorisation",
    aka: ["claim intimation", "pre-authorisation", "pre-auth", "cashless approval"],
    lob: "health",
    category: "Claims and process",
    shortAnswer:
      "Claim intimation is telling your insurer about a hospitalisation, within the window your policy requires. Pre-authorisation is the cashless approval step, where a network hospital sends your diagnosis and estimate to the insurer to confirm cover before or during treatment. Both are process steps that protect your claim.",
    sections: [
      {
        h2: "Intimation vs pre-authorisation",
        body: [
          "Intimation is simply informing the insurer — for planned admissions in advance, and for emergencies within the short window the policy specifies. It keeps the claim valid and lets the insurer track it.",
          "Pre-authorisation is specific to cashless: the hospital raises a request with your clinical details and estimated cost, and the insurer approves an admissible amount, sometimes in stages as treatment progresses.",
        ],
      },
    ],
    example:
      "For a planned surgery you intimate the insurer a few days ahead and the hospital raises a pre-authorisation. For an emergency admission, a family member intimates within the policy's window and the hospital seeks approval once you are stable.",
    mistakes: [
      "Not intimating an emergency admission within the policy's window.",
      "Treating a pre-authorisation approval as the final settled amount — the final figure is confirmed at discharge after review.",
      "Leaving intimation to the hospital and assuming it is done.",
    ],
    faqs: [
      {
        question: "What happens if I miss the intimation window?",
        answer:
          "Late intimation can complicate a claim, but a genuine delay with a valid reason is often still considered. Intimate as early as you can and keep all documents.",
      },
      {
        question: "Is pre-authorisation the same as claim approval?",
        answer:
          "No. Pre-authorisation confirms cashless cover for an estimated amount. The final admissible amount is settled at discharge after the insurer reviews the actual bill.",
      },
    ],
    related: ["cashless-claim", "network-hospital-tpa", "reimbursement-claim"],
    relatedBlog: [
      { title: "Cashless vs Reimbursement: Understanding Claim Processes", slug: "cashless-vs-reimbursement-claims" },
    ],
  },
  {
    slug: "claim-settlement-ratio",
    term: "Claim settlement ratio (CSR)",
    aka: ["CSR", "claim settlement ratio", "settlement ratio"],
    lob: "health",
    category: "Claims and process",
    shortAnswer:
      "Claim settlement ratio is the share of claims an insurer settled out of all claims it decided in a period. A high CSR suggests most claims get paid, but it says nothing about how much was paid, how fast, or why some were rejected — so it is a starting signal, not the whole picture.",
    sections: [
      {
        h2: "What CSR does and does not tell you",
        body: [
          "CSR is a ratio of settled claims to claims decided. A consistently high ratio is reassuring at a headline level, and it is worth glancing at when comparing insurers.",
          "But CSR mixes small and large claims, does not show partial settlements, and does not capture turnaround time or the reasons behind rejected claims. An insurer can have a high CSR and still make heavy proportionate deductions on individual bills.",
        ],
      },
      {
        h2: "How to use it sensibly",
        body: [
          "Use CSR as one input alongside the things that actually decide your payout: policy wording, sub-limits, co-pay, room-rent rules and the insurer's claim experience. The cleanest policy wording beats a marginally higher CSR.",
        ],
      },
    ],
    example:
      "Two insurers both quote high settlement ratios, but one caps room rent and applies proportionate deduction while the other does not. The ratio looks similar; the real-world payout on the same bill can differ sharply.",
    mistakes: [
      "Choosing a policy on CSR alone while ignoring sub-limits, co-pay and room-rent rules.",
      "Reading CSR as 'percentage of my bill that gets paid' — it is a count of claims settled, not amounts.",
    ],
    faqs: [
      {
        question: "Where can I find an insurer's claim settlement ratio?",
        answer:
          "Insurers and IRDAI periodically publish claim data. Look at the latest official figures rather than older marketing numbers, since the ratio changes each year.",
      },
      {
        question: "Is a 100% CSR realistic?",
        answer:
          "Genuine rejections exist (fraud, exclusions, non-disclosure), so a real-world ratio is rarely a perfect 100%. Focus on a consistently strong record plus clean policy terms.",
      },
    ],
    related: ["incurred-claim-ratio", "permanent-exclusions"],
    relatedBlog: [
      { title: "What Is Health Insurance? A Complete Guide for Indians", slug: "what-is-health-insurance" },
    ],
  },
  {
    slug: "incurred-claim-ratio",
    term: "Incurred claim ratio (ICR)",
    aka: ["ICR", "incurred claims ratio", "loss ratio"],
    lob: "health",
    category: "Claims and process",
    shortAnswer:
      "Incurred claim ratio is the total claims an insurer paid divided by the total premium it collected in a period. Around or below 100% means it paid out less than it earned; well above 100% means it paid more. It reflects the insurer's book, not any one policyholder's claim experience.",
    sections: [
      {
        h2: "How ICR differs from CSR",
        body: [
          "ICR is about money: claims paid versus premium earned across the insurer's portfolio. CSR is about the count of claims settled. They answer different questions.",
          "A very low ICR can hint at conservative payouts or heavy deductions, while a very high ICR can pressure future pricing. Neither extreme is automatically good or bad for you as an individual.",
        ],
      },
    ],
    example:
      "An insurer with an ICR near 100% is paying out roughly what it collects in premium. That is a portfolio-level signal — your own claim still depends entirely on your policy's wording and terms.",
    mistakes: [
      "Treating ICR as a promise about your personal claim — it is a portfolio average.",
      "Assuming the lowest ICR is best; too low can indicate tight claim practices, too high can push premiums up.",
    ],
    faqs: [
      {
        question: "What is a 'good' incurred claim ratio?",
        answer:
          "There is no single ideal. A sustainable ratio (broadly in a healthy band, not extremely low or extremely high) suggests balanced pricing and payouts. Read it alongside claim settlement ratio and policy terms.",
      },
      {
        question: "Does ICR affect my premium?",
        answer:
          "Indirectly. Persistently high ICRs can push an insurer to reprice, but your premium mainly reflects your age, cover, and the plan you choose.",
      },
    ],
    related: ["claim-settlement-ratio"],
    relatedBlog: [
      { title: "What Is Health Insurance? A Complete Guide for Indians", slug: "what-is-health-insurance" },
    ],
  },

  // ─── Health — coverage terms ────────────────────────────────────────────
  {
    slug: "sum-insured",
    term: "Sum insured (vs sum assured)",
    aka: ["sum insured", "sum assured", "cover amount", "coverage limit"],
    lob: "health",
    category: "Coverage basics",
    shortAnswer:
      "Sum insured is the maximum a health (or general) insurer will pay in a policy year — it works on indemnity, reimbursing actual costs up to that cap. Sum assured is a life-insurance term: a fixed amount paid on a covered event, regardless of any 'cost'. Health uses sum insured; life uses sum assured.",
    sections: [
      {
        h2: "Indemnity vs fixed benefit",
        body: [
          "Health insurance is indemnity-based: it pays your actual admissible hospital costs up to the sum insured, and unused cover does not come to you as cash. Sub-limits, co-pay and deductibles can reduce what is paid within that cap.",
          "Life insurance is a fixed-benefit contract: the sum assured is a defined amount paid to your nominee on death (or maturity, for some plans), not a reimbursement of expenses.",
        ],
      },
    ],
    example:
      "A Rs 10 lakh health sum insured caps annual claims at Rs 10 lakh, paid against real bills. A Rs 1 crore term-life sum assured is paid in full to the nominee on the policyholder's death, with no bills involved.",
    mistakes: [
      "Using 'sum assured' for health cover (or vice versa) — they are different mechanisms.",
      "Assuming a large sum insured removes sub-limits and co-pay; those apply within the cap.",
    ],
    faqs: [
      {
        question: "Does a higher sum insured mean my whole bill is paid?",
        answer:
          "Only up to the cap, and only the admissible portion. Room-rent caps, sub-limits and co-pay can still reduce the payout within the sum insured.",
      },
      {
        question: "Is sum insured per person or per family?",
        answer:
          "It depends on the plan. Individual policies give each person their own sum insured; a family floater shares one sum insured across all insured members.",
      },
    ],
    related: ["proportionate-deduction", "sub-limit", "co-pay", "sum-assured"],
    relatedBlog: [
      { title: "How to Choose the Right Sum Insured for Your City", slug: "right-sum-insured-for-your-city" },
    ],
  },
  {
    slug: "maternity-cover",
    term: "Maternity cover",
    aka: ["maternity benefit", "pregnancy cover", "delivery cover"],
    lob: "health",
    category: "Coverage basics",
    shortAnswer:
      "Maternity cover pays for pregnancy and delivery costs — normal and caesarean — usually up to a defined limit, and often after a waiting period of a few years. Many base health plans exclude maternity or offer it only as an add-on, and newborn cover terms vary, so read the specifics.",
    sections: [
      {
        h2: "How maternity cover typically works",
        body: [
          "Maternity benefit generally carries its own waiting period and a sub-limit for delivery, with normal and caesarean sometimes capped differently. Pre- and post-natal expenses may be included within that limit or separately.",
          "Newborn-baby cover — from day one or after a set period — is often bundled with maternity but with its own conditions. Because the waiting period can be long, maternity cover works best when planned well ahead.",
        ],
      },
    ],
    example:
      "A plan offers maternity benefit up to a fixed limit after a multi-year waiting period. Because the wait is long, buying it only when planning a pregnancy that year usually means the benefit is not yet active.",
    mistakes: [
      "Buying maternity cover expecting to use it immediately — the waiting period usually rules that out.",
      "Overlooking newborn and vaccination terms bundled with maternity.",
      "Missing the delivery sub-limit and paying the excess out of pocket.",
    ],
    faqs: [
      {
        question: "Is maternity covered in a normal health policy?",
        answer:
          "Often not by default. Many base plans exclude maternity or provide it as an optional benefit with its own waiting period and limit. Check your specific policy.",
      },
      {
        question: "Does maternity cover the newborn?",
        answer:
          "Many plans add newborn cover alongside maternity, sometimes from day one, sometimes after a period. The terms and any separate limit vary by plan.",
      },
    ],
    related: ["opd-cover", "sub-limit", "initial-waiting-period"],
    relatedBlog: [
      { title: "What Is Health Insurance? A Complete Guide for Indians", slug: "what-is-health-insurance" },
    ],
  },
  {
    slug: "opd-cover",
    term: "OPD cover",
    aka: ["OPD", "outpatient cover", "out-patient department cover"],
    lob: "health",
    category: "Coverage basics",
    shortAnswer:
      "OPD (out-patient department) cover pays for treatment that does not need hospital admission — doctor consultations, diagnostics, pharmacy and minor procedures. Most base health plans focus on hospitalisation and exclude OPD; where offered, it usually comes with a modest annual limit and specific conditions.",
    sections: [
      {
        h2: "What OPD cover includes",
        body: [
          "OPD benefits typically reimburse everyday medical costs that happen without a 24-hour admission — consultations, tests, prescribed medicines and small procedures done as an outpatient.",
          "Because these costs are frequent and predictable, OPD cover is usually capped at a modest annual amount and may require using specified channels. It is a convenience benefit, not catastrophe protection.",
        ],
      },
    ],
    example:
      "A plan with OPD benefit reimburses your GP consultation and prescribed medicines up to an annual limit. A hospital admission, by contrast, is handled under the main in-patient sum insured.",
    mistakes: [
      "Expecting OPD cover in a standard hospitalisation plan — most exclude it unless added.",
      "Paying extra for OPD when your routine costs are lower than the added premium.",
    ],
    faqs: [
      {
        question: "Is OPD cover worth it?",
        answer:
          "It helps if you have frequent, predictable outpatient costs and the benefit exceeds its added premium. For pure protection against big bills, in-patient sum insured matters more.",
      },
      {
        question: "Does OPD cover include medicines?",
        answer:
          "Where OPD is offered, prescribed medicines are commonly included within the OPD limit. Check whether tests and consultations share that same cap.",
      },
    ],
    related: ["pre-post-hospitalisation", "daily-hospital-cash", "sub-limit"],
    relatedBlog: [
      { title: "What Is Health Insurance? A Complete Guide for Indians", slug: "what-is-health-insurance" },
    ],
  },
  {
    slug: "critical-illness-cover",
    term: "Critical illness cover",
    aka: ["critical illness", "CI cover", "critical illness rider"],
    lob: "health",
    category: "Coverage basics",
    shortAnswer:
      "Critical illness cover pays a fixed lump sum if you are diagnosed with one of the specific serious illnesses listed in the policy (such as certain cancers, heart or stroke conditions). It is a benefit payout, not a reimbursement — you receive the amount regardless of your actual treatment bills, subject to survival and definition terms.",
    sections: [
      {
        h2: "Lump sum, not reimbursement",
        body: [
          "Unlike indemnity health cover, a critical illness policy or rider pays a defined amount on diagnosis of a listed condition. You can use it for treatment, income replacement, or debt — it is not tied to hospital bills.",
          "Payout depends on the illness matching the policy's exact medical definition, a waiting period, and often a survival period after diagnosis. The list of covered illnesses varies between plans.",
        ],
      },
    ],
    example:
      "A critical illness plan pays a lump sum on diagnosis of a listed condition. The policyholder uses it to cover treatment abroad and lost income — something a normal indemnity health policy would not do.",
    mistakes: [
      "Assuming every serious illness is covered — only the specifically listed and defined conditions qualify.",
      "Overlooking the survival period and exact medical definitions.",
      "Treating it as a replacement for indemnity health cover rather than a complement.",
    ],
    faqs: [
      {
        question: "Is critical illness cover the same as health insurance?",
        answer:
          "No. Health insurance reimburses hospital bills up to a sum insured; critical illness pays a fixed lump sum on diagnosis of a listed condition. Many people hold both.",
      },
      {
        question: "Does it pay for any cancer or heart problem?",
        answer:
          "Only conditions that match the policy's listed definitions and stage criteria. Early-stage or unlisted conditions may not qualify — read the definitions carefully.",
      },
    ],
    related: ["daily-hospital-cash", "sum-insured", "permanent-exclusions"],
    relatedBlog: [
      { title: "What Is Health Insurance? A Complete Guide for Indians", slug: "what-is-health-insurance" },
    ],
  },
  {
    slug: "daily-hospital-cash",
    term: "Daily hospital cash",
    aka: ["hospital cash", "daily cash benefit", "hospi-cash"],
    lob: "health",
    category: "Coverage basics",
    shortAnswer:
      "Daily hospital cash pays a fixed amount for each day you are hospitalised, on top of your main claim, to help with incidental costs like travel, attendant or lost income. It is a defined-benefit add-on with a per-day amount and a cap on the number of days, independent of your actual bill.",
    sections: [
      {
        h2: "How the benefit works",
        body: [
          "For every eligible day of admission (often after an initial deductible day or two), the policy pays a set cash amount regardless of your hospital charges. It is meant for the side costs a bill-based claim ignores.",
          "The benefit is capped per day and per hospitalisation or per year, and usually needs a minimum length of stay to trigger.",
        ],
      },
    ],
    example:
      "With a daily hospital cash benefit, a multi-day admission pays a fixed sum per eligible day into your hands, helping cover an attendant's costs and days off work — separate from the main reimbursement.",
    mistakes: [
      "Expecting hospital cash to cover the bill — it is a small daily top-up, not the main cover.",
      "Missing the minimum-stay or first-day-deductible condition.",
    ],
    faqs: [
      {
        question: "Is daily hospital cash paid in addition to my claim?",
        answer:
          "Yes. It is a fixed daily benefit paid on top of your main indemnity claim, intended for incidental costs, subject to per-day and duration limits.",
      },
      {
        question: "Does it start from the first day?",
        answer:
          "Many plans apply a short deductible (for example the first day or two) and require a minimum stay. Check the exact trigger in your policy.",
      },
    ],
    related: ["critical-illness-cover", "opd-cover"],
    relatedBlog: [
      { title: "What Is Health Insurance? A Complete Guide for Indians", slug: "what-is-health-insurance" },
    ],
  },
  {
    slug: "consumables-non-payable",
    term: "Consumables and non-payable items",
    aka: ["consumables", "non-payable items", "non-medical expenses", "non-payables"],
    lob: "health",
    category: "Coverage basics",
    shortAnswer:
      "Consumables and non-payable items are hospital charges many policies do not pay — things like gloves, syringes, PPE kits, administrative and certain disposables. They appear on the bill but are deducted from the claim unless your policy specifically covers them or you have a consumables add-on.",
    sections: [
      {
        h2: "Why non-payables shrink a claim",
        body: [
          "Insurers publish lists of items considered non-medical or consumable. During claim assessment these are removed from the admissible amount, so the settled figure is lower than the total bill even at a network hospital.",
          "Some insurers offer a 'consumables cover' or 'non-payable items' add-on that pays for these charges. Without it, they come out of your pocket.",
        ],
      },
    ],
    example:
      "A hospital bill lists gloves, syringes and a PPE kit among the charges. Without a consumables add-on, the insurer deducts these as non-payable, and you settle that portion yourself.",
    mistakes: [
      "Assuming a network/cashless claim means zero out-of-pocket — non-payables are still deducted.",
      "Skipping a consumables add-on when it is available and your typical procedures use many disposables.",
    ],
    faqs: [
      {
        question: "Can I avoid paying for consumables?",
        answer:
          "Only if your policy covers them or you buy a consumables/non-payable-items add-on. Otherwise these listed items are deducted from the claim.",
      },
      {
        question: "Are consumables a big part of a bill?",
        answer:
          "They can be, especially for surgeries and intensive care where disposables add up. That is why a consumables add-on can matter for surgery-heavy needs.",
      },
    ],
    related: ["proportionate-deduction", "sub-limit", "co-pay"],
    relatedBlog: [
      { title: "Top 5 Gaps in Health Insurance Policies You Should Know", slug: "top-5-health-insurance-gaps" },
    ],
  },
  {
    slug: "domiciliary-hospitalisation",
    term: "Domiciliary hospitalisation",
    aka: ["domiciliary treatment", "home hospitalisation", "treatment at home"],
    lob: "health",
    category: "Coverage basics",
    shortAnswer:
      "Domiciliary hospitalisation covers treatment taken at home for a condition that would normally need hospital admission — because the patient could not be moved, or a hospital bed was unavailable. It applies only under those specific conditions, often for a minimum duration, and may carry its own limits.",
    sections: [
      {
        h2: "When it applies",
        body: [
          "This benefit exists for genuine situations where in-patient care happens at home: the patient is too ill to be shifted, or no bed was available. It is not meant for ordinary home recovery or routine OPD care.",
          "Policies usually require the condition to otherwise need hospitalisation, a minimum number of days of care, and medical documentation. Some conditions are specifically excluded from domiciliary cover.",
        ],
      },
    ],
    example:
      "A patient who cannot be safely moved to a hospital receives equivalent in-patient care at home. If the policy's domiciliary conditions and duration are met, those costs can be claimed.",
    mistakes: [
      "Claiming routine at-home recovery as domiciliary hospitalisation — the strict conditions must be met.",
      "Not keeping the medical justification and records that prove admission was not possible.",
    ],
    faqs: [
      {
        question: "Is any home treatment covered as domiciliary?",
        answer:
          "No. It applies only when a condition needing hospitalisation is treated at home because the patient could not be moved or no bed was available, subject to duration and documentation.",
      },
      {
        question: "Are there exclusions in domiciliary cover?",
        answer:
          "Yes. Policies often list conditions that are not eligible for domiciliary treatment, and require minimum duration and proof. Check your wording.",
      },
    ],
    related: ["pre-post-hospitalisation", "day-care-procedures"],
    relatedBlog: [
      { title: "What Is Health Insurance? A Complete Guide for Indians", slug: "what-is-health-insurance" },
    ],
  },
  {
    slug: "ayush-cover",
    term: "AYUSH cover",
    aka: ["AYUSH treatment", "ayurveda cover", "homeopathy cover"],
    lob: "health",
    category: "Coverage basics",
    shortAnswer:
      "AYUSH cover pays for in-patient treatment under Ayurveda, Yoga and Naturopathy, Unani, Siddha and Homeopathy systems. Many modern health plans include AYUSH hospitalisation, often at recognised or government-registered facilities, sometimes up to a sub-limit rather than the full sum insured.",
    sections: [
      {
        h2: "What AYUSH cover includes",
        body: [
          "AYUSH benefits typically apply to in-patient treatment at qualifying AYUSH hospitals or recognised centres. The condition and admission still need to be genuine hospitalisation, not routine wellness visits.",
          "Some policies cover AYUSH up to the full sum insured, others cap it at a sub-limit. Facility recognition requirements vary, so eligibility depends on where you are treated.",
        ],
      },
    ],
    example:
      "A policyholder is admitted for Ayurvedic in-patient treatment at a recognised AYUSH hospital. If the plan covers AYUSH within its terms, the admissible cost is claimable, possibly up to a sub-limit.",
    mistakes: [
      "Assuming AYUSH cover extends to wellness or OPD visits — it generally applies to in-patient treatment.",
      "Getting treated at a facility that does not meet the policy's recognition criteria.",
    ],
    faqs: [
      {
        question: "Is AYUSH treatment covered up to my full sum insured?",
        answer:
          "Some plans cover it up to the full sum insured, others apply a sub-limit. Check your policy's AYUSH clause for the exact cap and facility conditions.",
      },
      {
        question: "Does AYUSH cover outpatient therapy?",
        answer:
          "Usually the benefit is for in-patient AYUSH hospitalisation. Routine outpatient therapy is generally not covered unless the plan specifically says so.",
      },
    ],
    related: ["day-care-procedures", "sub-limit"],
    relatedBlog: [
      { title: "What Is Health Insurance? A Complete Guide for Indians", slug: "what-is-health-insurance" },
    ],
  },
  {
    slug: "organ-donor-cover",
    term: "Organ donor cover",
    aka: ["organ donor expenses", "donor cover", "transplant donor cover"],
    lob: "health",
    category: "Coverage basics",
    shortAnswer:
      "Organ donor cover pays the hospitalisation costs of the donor during an organ transplant where the insured person is the recipient. It typically covers the donor's surgery to harvest the organ, subject to the policy's terms, and usually excludes the donor's pre/post-care and any payment to the donor.",
    sections: [
      {
        h2: "What is and isn't covered",
        body: [
          "When a covered member receives a transplant, this benefit meets the donor's in-hospital surgical expenses for organ harvesting, within the policy's limits and definitions.",
          "It generally does not cover the donor's own pre- and post-hospitalisation, screening, or any commercial payment, and the transplant must comply with applicable transplantation law.",
        ],
      },
    ],
    example:
      "An insured recipient undergoes a kidney transplant. The donor's harvesting surgery costs are met under the organ donor benefit, while the recipient's treatment draws on the main sum insured.",
    mistakes: [
      "Expecting the donor's full workup and recovery to be covered — usually only the harvesting hospitalisation is.",
      "Overlooking that the transplant must be legally compliant for the claim to hold.",
    ],
    faqs: [
      {
        question: "Whose expenses does organ donor cover pay?",
        answer:
          "The donor's in-hospital costs for the organ-harvesting surgery, when the insured person is the transplant recipient — within the policy's limits and legal conditions.",
      },
      {
        question: "Is the recipient's transplant also covered?",
        answer:
          "The recipient's treatment is claimed under the main sum insured as normal hospitalisation; the donor benefit is specifically for the donor's harvesting surgery.",
      },
    ],
    related: ["sum-insured", "pre-post-hospitalisation"],
    relatedBlog: [
      { title: "What Is Health Insurance? A Complete Guide for Indians", slug: "what-is-health-insurance" },
    ],
  },
  {
    slug: "lifelong-renewability",
    term: "Lifelong renewability",
    aka: ["lifelong renewal", "guaranteed renewability", "renew for life"],
    lob: "health",
    category: "Coverage basics",
    shortAnswer:
      "Lifelong renewability means your health insurer must let you renew the policy for life, so cover cannot be stopped just because you have aged or claimed. Premiums can still rise with age and revisions, and you must renew on time — but the insurer cannot refuse renewal on those grounds.",
    sections: [
      {
        h2: "Why it matters",
        body: [
          "Health needs rise with age, exactly when a new policy would be hardest to buy. Lifelong renewability protects continuity so you are not left without cover in later life for having claimed or grown older.",
          "It guarantees the right to renew, not a frozen premium. Age-banded increases and approved revisions can still apply, and renewal must be done within the grace window to avoid a break.",
        ],
      },
    ],
    example:
      "A long-held policy with lifelong renewability continues into the policyholder's seventies. The premium has risen with age, but the insurer cannot decline renewal simply because of age or past claims.",
    mistakes: [
      "Confusing lifelong renewability with a fixed premium — the premium can still increase.",
      "Letting the policy lapse past the grace period and losing continuity benefits.",
    ],
    faqs: [
      {
        question: "Can the insurer refuse to renew if I claim a lot?",
        answer:
          "Under lifelong renewability the insurer cannot decline renewal due to age or claim history. Renew on time; premiums may reflect age and approved revisions.",
      },
      {
        question: "Does lifelong renewability freeze my premium?",
        answer:
          "No. It guarantees your right to renew, not the price. Premiums can rise with age bands and periodic, approved revisions.",
      },
    ],
    related: ["grace-period", "moratorium-period", "health-insurance-portability"],
    relatedBlog: [
      { title: "What Is Health Insurance? A Complete Guide for Indians", slug: "what-is-health-insurance" },
    ],
  },
  {
    slug: "proportionate-deduction",
    term: "Proportionate deduction",
    aka: ["proportionate deduction", "proportionate clause", "pro-rata deduction"],
    lob: "health",
    category: "Limits and sub-limits",
    shortAnswer:
      "Proportionate deduction is when an insurer scales down your whole admissible claim because you chose a room above your policy's eligible category. Since many hospital charges are linked to room class, exceeding the room-rent limit can cut the entire bill in the same proportion — not just the room charge.",
    sections: [
      {
        h2: "How it multiplies a room-rent overage",
        body: [
          "If your eligible room rent is a certain amount and you take a room at twice that, the insurer may treat associated charges (surgeon, nursing, procedures) as if billed at the eligible room class, paying them proportionately.",
          "The result is a claim far smaller than expected even when your sum insured is large, because the deduction applies across the bill rather than only to the room line.",
        ],
      },
    ],
    example:
      "Your eligible room rent is Rs 5,000/day but you pick a Rs 10,000/day room. The insurer applies proportionate deduction, and a Rs 4 lakh bill may settle closer to Rs 2 lakh even on a Rs 10 lakh policy.",
    mistakes: [
      "Upgrading the room without realising the deduction hits the whole bill.",
      "Not checking for a Room Rent Waiver rider or a no-capping plan.",
    ],
    faqs: [
      {
        question: "How do I avoid proportionate deduction?",
        answer:
          "Choose a room within your policy's eligible category, or pick a plan with no room-rent capping or a room-rent-waiver add-on.",
      },
      {
        question: "Does proportionate deduction apply to consumables too?",
        answer:
          "It generally scales the admissible bill charges linked to room category. Non-payable consumables are separately deducted regardless.",
      },
    ],
    related: ["room-rent-cap", "sub-limit", "consumables-non-payable", "zone-based-co-pay"],
    relatedBlog: [
      { title: "Room Rent Caps: The Hidden Cost in Your Policy", slug: "room-rent-caps-hidden-cost" },
    ],
  },
  {
    slug: "zone-based-co-pay",
    term: "Zone-based co-pay",
    aka: ["zonal co-pay", "zone co-pay", "city-based co-pay"],
    lob: "health",
    category: "Limits and sub-limits",
    shortAnswer:
      "Zone-based co-pay is an extra share of the bill you pay if you get treated in a higher-cost city than the zone your premium was priced for. Insurers group cities into zones; treatment in a costlier zone than your policy's can trigger a percentage co-pay unless you opted for pan-India cover.",
    sections: [
      {
        h2: "Why zones affect your claim",
        body: [
          "Treatment costs differ across cities, so insurers price policies by zone. If you buy for a lower-cost zone but get treated in a metro, the policy may apply a co-pay on the claim to reflect the higher cost.",
          "You can usually avoid this by declaring your correct location or choosing a plan without zonal co-pay, sometimes for a higher premium.",
        ],
      },
    ],
    example:
      "A policy priced for a smaller-city zone applies a co-pay when the insured is treated in a metro hospital. Choosing pan-India cover upfront would have avoided that extra share.",
    mistakes: [
      "Buying a cheaper lower-zone policy while usually seeking treatment in a metro.",
      "Not realising a zonal co-pay stacks on top of any regular co-pay in the plan.",
    ],
    faqs: [
      {
        question: "How do I avoid zone-based co-pay?",
        answer:
          "Pick a plan without zonal co-pay or one priced for the highest zone you might use, and declare your correct location. Confirm the zone terms before buying.",
      },
      {
        question: "Is zone-based co-pay the same as normal co-pay?",
        answer:
          "It is a specific type triggered by treatment location. It can apply in addition to any standard co-pay your policy already has.",
      },
    ],
    related: ["co-pay", "proportionate-deduction", "sub-limit"],
    relatedBlog: [
      { title: "How to Choose the Right Sum Insured for Your City", slug: "right-sum-insured-for-your-city" },
    ],
  },

  // ─── Life ───────────────────────────────────────────────────────────────
  {
    slug: "sum-assured",
    term: "Sum assured",
    aka: ["sum assured", "life cover", "death benefit"],
    lob: "life",
    category: "Life insurance basics",
    shortAnswer:
      "Sum assured is the guaranteed amount a life insurer pays your nominee on death (or on maturity, for some plans) — a fixed benefit, not a reimbursement of costs. In term insurance it is the pure protection amount your family receives. Choose it to replace your income and clear liabilities, not by premium alone.",
    sections: [
      {
        h2: "A fixed benefit, not an expense reimbursement",
        body: [
          "Unlike health insurance's sum insured, the sum assured is paid in full on the covered event regardless of any 'cost'. In term plans, it is the money your dependents get to run the household and clear debts.",
          "Sizing it well matters more than trimming premium: a sum assured that does not cover income replacement, loans and future goals leaves the family exposed exactly when it counts.",
        ],
      },
    ],
    example:
      "A Rs 1 crore term-life sum assured is paid to the nominee on the policyholder's death, whatever the family's actual expenses are. The payout replaces lost income and clears the home loan.",
    mistakes: [
      "Confusing sum assured (life, fixed payout) with sum insured (health, reimbursement up to a cap).",
      "Picking the sum assured to fit a premium budget instead of the family's real needs.",
    ],
    faqs: [
      {
        question: "How much sum assured do I need?",
        answer:
          "A common approach is enough to replace several years of income plus outstanding loans and major future goals, minus existing savings. It is about your family's needs, not a fixed multiple.",
      },
      {
        question: "Is sum assured the same as maturity value?",
        answer:
          "In pure term plans there is no maturity value — the sum assured is a death benefit. Some savings-linked plans pay a maturity amount, which may differ from the death sum assured.",
      },
    ],
    related: ["sum-insured", "rider-add-on-cover", "claim-settlement-ratio-life"],
    relatedBlog: [
      { title: "Term Life Insurance Basics: Pure Protection Explained", slug: "term-life-insurance-basics" },
    ],
  },
  {
    slug: "rider-add-on-cover",
    term: "Rider (add-on cover)",
    aka: ["rider", "add-on cover", "policy rider"],
    lob: "life",
    category: "Life insurance basics",
    shortAnswer:
      "A rider is an optional add-on you attach to a base life (or health) policy for extra protection — such as critical illness, accidental death, disability or waiver of premium. It costs a little more premium and comes with its own terms, extending cover without buying a separate standalone policy.",
    sections: [
      {
        h2: "How riders extend a base policy",
        body: [
          "Riders let you tailor a policy to specific risks. Common life riders include accidental death benefit, critical illness, permanent disability, and waiver of premium (which keeps the policy going if you cannot pay after a covered event).",
          "Each rider has its own definitions, limits and exclusions, and a rider generally cannot outlast or exceed the base policy. Read each rider's wording as carefully as the base plan.",
        ],
      },
    ],
    example:
      "A term policy with a waiver-of-premium rider keeps running without further premiums if the policyholder suffers a covered disability — the base cover continues while premiums are waived.",
    mistakes: [
      "Adding riders you will not use instead of simply increasing the base sum assured.",
      "Ignoring rider-specific definitions and assuming they match the base policy.",
    ],
    faqs: [
      {
        question: "Are riders worth adding?",
        answer:
          "A rider is worth it when it covers a real, relevant risk cheaply — like waiver of premium or accidental cover. Compare the added premium and terms against buying separate cover.",
      },
      {
        question: "Can a rider continue after the base policy ends?",
        answer:
          "Generally no. A rider is attached to the base policy and typically cannot exceed or outlast it. Check the rider's term and conditions.",
      },
    ],
    related: ["sum-assured", "critical-illness-cover", "surrender-paid-up-value"],
    relatedBlog: [
      { title: "What Is Life Insurance? Complete Guide for Indian Families", slug: "what-is-life-insurance" },
    ],
  },
  {
    slug: "surrender-paid-up-value",
    term: "Surrender value and paid-up value",
    aka: ["surrender value", "paid-up value", "free-look period life", "policy exit values"],
    lob: "life",
    category: "Life insurance basics",
    shortAnswer:
      "Surrender value is what you get if you exit a savings-linked life policy early; paid-up value is the reduced cover you keep if you stop paying premiums after a point but do not surrender. Pure term plans usually have neither. The free-look period lets you cancel a new policy soon after buying, for a refund minus small charges.",
    sections: [
      {
        h2: "Surrender vs paid-up",
        body: [
          "Surrendering ends the policy and pays out a surrender value, which in early years is often much less than the premiums paid. Making a policy 'paid-up' instead stops future premiums and continues a reduced sum assured based on what you have already paid.",
          "These values apply to savings/endowment-style plans that build value. Pure term insurance is protection-only and typically has no surrender or paid-up value.",
        ],
      },
      {
        h2: "Free-look period",
        body: [
          "Right after buying, the free-look window lets you review the policy and cancel for a refund, minus small deductions, if it is not what you expected. It is a short cooling-off period, distinct from surrendering later.",
        ],
      },
    ],
    example:
      "A policyholder who can no longer pay an endowment plan makes it paid-up: premiums stop and a reduced sum assured continues, rather than surrendering for a low early exit value.",
    mistakes: [
      "Surrendering early and losing a large part of premiums, when making the policy paid-up would have preserved some cover.",
      "Missing the free-look window to exit a mis-sold or unsuitable policy.",
      "Expecting surrender value from a pure term plan, which usually has none.",
    ],
    faqs: [
      {
        question: "Will I get all my money back if I surrender early?",
        answer:
          "Usually not. Early surrender values are often well below total premiums paid, especially in the first years. Compare surrender value against making the policy paid-up.",
      },
      {
        question: "What is the free-look period for?",
        answer:
          "It is a short window after purchase to review the policy and cancel for a refund minus small charges if it does not suit you. Check your document for the exact window.",
      },
    ],
    related: ["free-look-period", "rider-add-on-cover", "sum-assured"],
    relatedBlog: [
      { title: "What Is Life Insurance? Complete Guide for Indian Families", slug: "what-is-life-insurance" },
    ],
  },
  {
    slug: "nominee-vs-beneficiary",
    term: "Nominee vs beneficiary",
    aka: ["nominee", "beneficiary", "beneficial nominee"],
    lob: "life",
    category: "Life insurance basics",
    shortAnswer:
      "A nominee is the person you name to receive the policy payout. A beneficiary is who is ultimately entitled to that money. Naming a 'beneficial nominee' (like a close family member) makes the nominee the rightful owner of the proceeds; otherwise a plain nominee may act only as a receiver who must pass the money to legal heirs.",
    sections: [
      {
        h2: "Why the distinction matters",
        body: [
          "Naming a nominee ensures the insurer knows who to pay quickly. But whether that person keeps the money can depend on succession law and how the nomination is structured.",
          "Where the law recognises a 'beneficial nominee' (typically immediate family), that nominee is entitled to the proceeds. A non-beneficial nominee can be treated as a trustee who receives and must distribute the amount to legal heirs.",
        ],
      },
    ],
    example:
      "A policyholder names their spouse as a beneficial nominee. On death, the spouse is entitled to the payout directly, avoiding disputes over whether it must be shared among other heirs.",
    mistakes: [
      "Never updating the nominee after marriage, divorce or a death in the family.",
      "Assuming a nominee always keeps the money, without checking beneficial-nominee status.",
      "Leaving the nomination blank, which forces heirs through a longer legal process.",
    ],
    faqs: [
      {
        question: "Does the nominee automatically own the payout?",
        answer:
          "Not always. A beneficial nominee (close family) is generally entitled to keep it; a plain nominee may have to pass it to legal heirs. Structure the nomination accordingly.",
      },
      {
        question: "Can I have more than one nominee?",
        answer:
          "Yes, many policies allow multiple nominees with defined shares. Keep the shares and details updated as your circumstances change.",
      },
    ],
    related: ["sum-assured", "mwp-act"],
    relatedBlog: [
      { title: "What Is Life Insurance? Complete Guide for Indian Families", slug: "what-is-life-insurance" },
    ],
  },
  {
    slug: "claim-settlement-ratio-life",
    term: "Claim settlement ratio (life)",
    aka: ["life CSR", "life insurer claim settlement ratio", "death claim settlement ratio"],
    lob: "life",
    category: "Life insurance basics",
    shortAnswer:
      "For life insurance, the claim settlement ratio is the share of death claims an insurer paid out of those it decided in a year. Because a term claim is your family's whole safety net, a consistently high settlement record matters — but honest disclosures on your application matter even more to a claim being paid.",
    sections: [
      {
        h2: "Why it carries weight in life cover",
        body: [
          "A life claim is usually a single, large, one-time payout at the worst moment for a family, so an insurer's track record of paying death claims is a meaningful comfort factor when choosing a term plan.",
          "But the biggest driver of a life claim being paid is full, accurate disclosure at purchase — health, habits, income and existing cover. Non-disclosure is a leading reason genuine-looking claims get contested.",
        ],
      },
    ],
    example:
      "Two insurers show strong death-claim settlement records. The deciding factor for a payout is that the policyholder disclosed medical history and smoking honestly, leaving no ground to contest the claim.",
    mistakes: [
      "Hiding medical history, smoking or income to get a lower premium — it can sink the claim later.",
      "Choosing purely on a fractionally higher ratio while under-disclosing.",
    ],
    faqs: [
      {
        question: "Is a high life claim settlement ratio enough to trust an insurer?",
        answer:
          "It is a good signal, but a claim depends most on honest disclosures and a valid policy. Combine a strong settlement record with complete, accurate information at purchase.",
      },
      {
        question: "Why do some life claims get rejected despite a high CSR?",
        answer:
          "Common reasons are non-disclosure or misstatement at application, or claims within contestability where facts were withheld. Full disclosure is the best protection.",
      },
    ],
    related: ["claim-settlement-ratio", "sum-assured", "nominee-vs-beneficiary"],
    relatedBlog: [
      { title: "Term Life Insurance Basics: Pure Protection Explained", slug: "term-life-insurance-basics" },
    ],
  },
  {
    slug: "mwp-act",
    term: "MWP Act protection",
    aka: ["Married Women's Property Act", "MWP Act", "MWPA policy"],
    lob: "life",
    category: "Life insurance basics",
    shortAnswer:
      "Buying a life policy under the Married Women's Property (MWP) Act ring-fences the payout for your wife and/or children. The proceeds go into a trust for them and are protected from your creditors and other claimants — useful if you have business debts or want to guarantee the money reaches your family.",
    sections: [
      {
        h2: "How MWP protection works",
        body: [
          "When a term policy is taken under the MWP Act, the sum assured is held in trust for the named beneficiaries (wife and/or children). It does not form part of your estate and cannot be attached by creditors.",
          "This is chosen most often by those with business liabilities or who want certainty that the payout benefits only their immediate family. The election is usually made at the time of buying and is difficult to change later.",
        ],
      },
    ],
    example:
      "A business owner buys term cover under the MWP Act. If creditors pursue the estate later, the policy proceeds still go to the spouse and children, shielded from those claims.",
    mistakes: [
      "Deciding to add MWP protection after buying — it is best set at purchase and hard to change later.",
      "Assuming MWP is needed for everyone; it is most useful where creditor protection or ring-fencing matters.",
    ],
    faqs: [
      {
        question: "Who should consider an MWP Act policy?",
        answer:
          "Those with business or personal liabilities, or anyone wanting to guarantee the payout reaches only their spouse/children, protected from creditors and estate claims.",
      },
      {
        question: "Can I change beneficiaries in an MWP policy?",
        answer:
          "Changes are restricted because the proceeds are held in trust for the named beneficiaries. Decide the structure carefully at purchase.",
      },
    ],
    related: ["nominee-vs-beneficiary", "sum-assured"],
    relatedBlog: [
      { title: "Term Life Insurance Basics: Pure Protection Explained", slug: "term-life-insurance-basics" },
    ],
  },

  // ─── Motor ──────────────────────────────────────────────────────────────
  {
    slug: "zero-depreciation",
    term: "Zero-depreciation (bumper-to-bumper)",
    aka: ["zero dep", "zero depreciation", "bumper to bumper", "nil depreciation"],
    lob: "motor",
    category: "Motor insurance",
    shortAnswer:
      "Zero-depreciation (or bumper-to-bumper) is a car-insurance add-on that pays the full cost of replaced parts at a claim, without cutting for wear and tear (depreciation). Without it, plastic, rubber and fibre parts especially are paid at a depreciated value, so you fund the gap. It is most valuable on newer cars.",
    sections: [
      {
        h2: "How zero-dep changes a claim",
        body: [
          "In a normal own-damage claim, insurers apply depreciation to replaced parts based on their material and the vehicle's age, so you receive less than the new-part price. Plastic and fibre parts attract the steepest depreciation.",
          "Zero-depreciation waives that deduction, so replaced parts are paid at full cost (you still pay the compulsory deductible and any non-covered items). It usually adds premium and is offered mainly on newer vehicles.",
        ],
      },
    ],
    example:
      "After an accident, several plastic panels are replaced. Without zero-dep, depreciation on those parts leaves a large out-of-pocket gap; with zero-dep, they are paid at full replacement cost minus only the compulsory deductible.",
    mistakes: [
      "Skipping zero-dep on a new car to save a little premium, then absorbing heavy depreciation at a claim.",
      "Assuming zero-dep covers the deductible or consumables — those are separate.",
    ],
    faqs: [
      {
        question: "Is zero-depreciation worth it?",
        answer:
          "For newer cars and expensive-to-repair models it usually pays for itself in a single claim by removing depreciation on parts. On older cars the benefit and availability shrink.",
      },
      {
        question: "Do I still pay anything with zero-dep?",
        answer:
          "Yes. The compulsory deductible and any non-covered items still apply. Zero-dep only removes the depreciation cut on replaced parts.",
      },
    ],
    related: ["motor-add-ons", "motor-deductibles", "own-damage-vs-third-party", "idv"],
    relatedBlog: [
      { title: "Car Insurance Explained: Third-Party vs Comprehensive", slug: "third-party-vs-comprehensive-car-insurance" },
    ],
  },
  {
    slug: "own-damage-vs-third-party",
    term: "Own damage vs third-party liability",
    aka: ["own damage", "third party liability", "OD vs TP", "comprehensive vs third party"],
    lob: "motor",
    category: "Motor insurance",
    shortAnswer:
      "Third-party liability cover pays for injury or damage you cause to others — it is legally mandatory for every vehicle in India. Own-damage cover pays for damage to your own vehicle (accident, theft, fire, natural events). A comprehensive policy combines both; a standalone third-party policy covers only your liability to others.",
    sections: [
      {
        h2: "Two different jobs",
        body: [
          "Third-party cover exists to protect other people and their property from harm you cause with your vehicle. It is compulsory by law, but it pays nothing towards your own vehicle's repairs.",
          "Own-damage cover protects your car itself. Bundled with third-party into a comprehensive policy, it covers accident damage, theft, fire and natural calamities, subject to IDV, deductible and add-on choices.",
        ],
      },
    ],
    example:
      "You cause a collision that damages another car and dents your own. Third-party cover handles the other party's claim; your own car's repairs are met only if you also hold own-damage (comprehensive) cover.",
    mistakes: [
      "Running only third-party cover and expecting your own car's repairs to be paid.",
      "Letting comprehensive cover lapse and dropping to bare third-party without realising own damage is now uncovered.",
    ],
    faqs: [
      {
        question: "Is third-party insurance enough?",
        answer:
          "It meets the legal minimum and protects others, but it pays nothing for your own vehicle. For theft, accident or natural-calamity damage to your car, you need own-damage/comprehensive cover.",
      },
      {
        question: "What is a standalone own-damage policy?",
        answer:
          "It is own-damage cover bought separately, often alongside a longer third-party policy, so you can insure your car's damage without bundling both into one term.",
      },
    ],
    related: ["personal-accident-owner-driver", "zero-depreciation", "idv", "motor-deductibles"],
    relatedBlog: [
      { title: "Car Insurance Explained: Third-Party vs Comprehensive", slug: "third-party-vs-comprehensive-car-insurance" },
    ],
  },
  {
    slug: "personal-accident-owner-driver",
    term: "Personal accident cover (owner-driver)",
    aka: ["owner-driver PA cover", "personal accident cover motor", "PA cover"],
    lob: "motor",
    category: "Motor insurance",
    shortAnswer:
      "Owner-driver personal accident (PA) cover pays a benefit if the vehicle's owner-driver dies or is disabled in an accident involving the insured vehicle. It is a compulsory component for the registered owner who drives, and can often be extended to cover passengers or a paid driver as add-ons.",
    sections: [
      {
        h2: "What owner-driver PA covers",
        body: [
          "This benefit pays a defined amount for death or specified disabilities of the owner-driver arising from an accident with the insured vehicle. It is protection for the person, separate from the vehicle-damage cover.",
          "It applies to the registered owner who holds a valid licence and is driving. Cover for passengers or an employed driver is usually available as separate add-ons.",
        ],
      },
    ],
    example:
      "The owner-driver is injured in a covered accident. The PA cover pays the applicable disability benefit to them, independent of any own-damage claim for the car's repairs.",
    mistakes: [
      "Assuming owner-driver PA also covers all passengers — passenger cover is typically a separate add-on.",
      "Overlooking that a valid driving licence and eligible use are conditions for the benefit.",
    ],
    faqs: [
      {
        question: "Is owner-driver personal accident cover mandatory?",
        answer:
          "A personal accident cover for the owner-driver is a required component for the registered owner who drives. Those who do not own or drive may hold it through other means; check current rules and your policy.",
      },
      {
        question: "Can I cover my passengers and driver too?",
        answer:
          "Yes, usually via add-ons — passenger PA cover and paid-driver cover extend accident benefits beyond the owner-driver.",
      },
    ],
    related: ["own-damage-vs-third-party", "motor-add-ons"],
    relatedBlog: [
      { title: "Personal Accident Insurance: Complete Guide", slug: "personal-accident-insurance-guide" },
    ],
  },
  {
    slug: "motor-add-ons",
    term: "Motor add-ons (engine protect, RSA, RTI, consumables)",
    aka: ["car insurance add-ons", "engine protect", "roadside assistance", "return to invoice", "consumables cover"],
    lob: "motor",
    category: "Motor insurance",
    shortAnswer:
      "Motor add-ons extend a comprehensive car policy for extra premium. Common ones: engine protect (damage to engine/gearbox, e.g. from water ingress), roadside assistance (towing, jump-start, help on the road), return-to-invoice (pays the invoice price, not just IDV, on total loss/theft), and consumables (oils, nuts, bolts normally excluded).",
    sections: [
      {
        h2: "What each add-on does",
        body: [
          "Engine protect covers consequential damage to the engine and gearbox — notably hydrostatic lock from driving through water — which a standard own-damage policy often excludes. Roadside assistance provides on-road help like towing, fuel, jump-start and lockout support.",
          "Return-to-invoice bridges the gap between IDV and your original invoice price on theft or total loss, so you are made closer to whole. Consumables cover pays for small items — engine oil, nuts, bolts, lubricants — that are otherwise deducted from a claim.",
        ],
      },
    ],
    example:
      "During heavy monsoon flooding, a car's engine is damaged by water ingress. A standard policy may decline the engine repair, but an engine-protect add-on covers it.",
    mistakes: [
      "Driving through flood water assuming a basic policy covers engine damage — engine protect is usually needed.",
      "Skipping return-to-invoice on a new car, then receiving only the depreciated IDV after a theft or total loss.",
      "Adding every add-on regardless of relevance instead of matching them to your risks.",
    ],
    faqs: [
      {
        question: "Which motor add-ons are most useful?",
        answer:
          "It depends on your risk: zero-dep and engine protect for newer cars and flood-prone areas, return-to-invoice for new vehicles, and roadside assistance for long-distance or older-car drivers.",
      },
      {
        question: "Does engine protect cover normal engine wear?",
        answer:
          "No. It covers sudden, accidental engine/gearbox damage (like water ingress or leakage-related damage), not routine wear, servicing or mechanical breakdown.",
      },
    ],
    related: ["zero-depreciation", "idv", "own-damage-vs-third-party", "motor-deductibles"],
    relatedBlog: [
      { title: "Car Insurance Explained: Third-Party vs Comprehensive", slug: "third-party-vs-comprehensive-car-insurance" },
    ],
  },
  {
    slug: "motor-deductibles",
    term: "Compulsory vs voluntary deductible (motor)",
    aka: ["compulsory deductible", "voluntary deductible", "car insurance excess"],
    lob: "motor",
    category: "Motor insurance",
    shortAnswer:
      "A deductible (excess) is the part of an own-damage claim you pay yourself. The compulsory deductible is a fixed amount set by the insurer that always applies. A voluntary deductible is an extra amount you choose to bear in exchange for a lower premium — it raises your out-of-pocket cost at every claim.",
    sections: [
      {
        h2: "Compulsory vs voluntary",
        body: [
          "The compulsory deductible is mandatory and applies to every own-damage claim regardless of your choices. You cannot remove it.",
          "A voluntary deductible is optional: by agreeing to pay more per claim, you get a premium discount. It suits careful drivers who rarely claim, but it increases what you pay each time you do claim, on top of the compulsory amount.",
        ],
      },
    ],
    example:
      "You opt for a voluntary deductible to cut premium. At a claim, you pay the compulsory deductible plus your chosen voluntary amount before the insurer pays the balance of the admissible repair.",
    mistakes: [
      "Choosing a high voluntary deductible for the premium saving, then struggling to fund it at claim time.",
      "Forgetting the voluntary deductible stacks on top of the compulsory one at every claim.",
    ],
    faqs: [
      {
        question: "Should I take a voluntary deductible?",
        answer:
          "It makes sense if you rarely claim and can comfortably pay the higher excess when you do. If you claim often or want minimal out-of-pocket, keep it low or nil.",
      },
      {
        question: "Does the deductible apply to third-party claims?",
        answer:
          "Deductibles apply to own-damage claims for your vehicle. Third-party liability payouts to others are handled separately under the policy's liability terms.",
      },
    ],
    related: ["own-damage-vs-third-party", "zero-depreciation", "deductible", "idv"],
    relatedBlog: [
      { title: "Car Insurance Explained: Third-Party vs Comprehensive", slug: "third-party-vs-comprehensive-car-insurance" },
    ],
  },
];

export function clauseBySlug(slug: string): ClauseEntry | undefined {
  return CLAUSE_LIBRARY.find((c) => c.slug === slug);
}
