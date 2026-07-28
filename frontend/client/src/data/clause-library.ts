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
];

export function clauseBySlug(slug: string): ClauseEntry | undefined {
  return CLAUSE_LIBRARY.find((c) => c.slug === slug);
}
