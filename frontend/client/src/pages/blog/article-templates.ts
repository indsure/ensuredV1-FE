/**
 * GPT-EO Article Generation Templates
 * Use these prompts with ChatGPT/Claude/Gemini to generate blog articles
 */

export interface ArticleBrief {
  id: number;
  title: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  targetAudience: string;
  wordCount: number;
  category: "Individual" | "Business" | "Educational" | "Comparison" | "Hub";
  structure: string;
  tone: string;
  requirements: string[];
  ctaLinks: Array<{ text: string; url: string }>;
  faqCount: number;
}

export const articleBriefs: ArticleBrief[] = [
  {
    id: 1,
    title: "What Is Health Insurance? A Complete Guide for Indians",
    primaryKeyword: "What is health insurance",
    secondaryKeywords: [
      "health insurance meaning",
      "how health insurance works India",
      "health insurance plan types",
      "health insurance benefits explained",
      "health insurance premium vs coverage",
    ],
    targetAudience: "28–45 year old working professionals, India",
    wordCount: 2000,
    category: "Individual",
    structure: `
1. Hook (Why understanding health insurance matters in India)
   - ₹5L+ annual healthcare costs in metros
   - Insurance as safety net, not luxury
   
2. Definition: What is health insurance?
   - Simple: "Agreement between you and insurer"
   - You pay premium → Insurer covers hospital bills
   - Include real ₹ example (₹5k/month premium → ₹5L coverage)

3. How Health Insurance Works
   - Steps: Take policy → Pay premium → Get hospitalized → Claim
   - Real scenario: ₹2L surgery bill, what insurer + you each pay
   - Include room limits, co-pay, deductibles (briefly, link to detailed articles)

4. Key Components Explained
   - Sum assured (coverage limit)
   - Premium (monthly/annual cost)
   - Deductible/excess
   - Co-pay percentage
   - Room limit per day
   - Waiting periods
   - Exclusions
   (Each 2–3 sentences, plain English)

5. Main Plan Types in India
   - Individual health insurance
   - Family floater policies
   - Group health insurance (employer)
   - Critical illness covers
   - Mediclaim vs health insurance (difference)
   Brief explanation + when to choose each

6. Key Benefits of Health Insurance
   - Peace of mind
   - Covers major medical expenses
   - Preventive care (in some plans)
   - Tax benefits (Section 80D)
   - Add-on riders (maternity, accidents)

7. Common Misconceptions
   - "Health insurance covers everything" (NO)
   - "I'm young, don't need it" (risk exists at any age)
   - "Government insurance is enough" (often not)

8. Real-World Scenario
   - Case: 35-year-old in Mumbai with ₹5L health insurance
   - Gets appendicitis surgery (₹50k bill)
   - Show: Policy covers? Room limit? Co-pay? Your out-of-pocket?
   - Real ₹ breakdown

9. Next Steps
   - How to choose health insurance (mention /select-type)
   - Analyze your existing policy (CTA → /policychecker)
   - Calculate real costs (CTA → /calculator)

10. FAQ (10 questions)
    - Is health insurance mandatory in India?
    - What age can I buy health insurance?
    - Can I claim if I don't have a policy upfront?
    - Do pre-existing conditions require waiting period?
    - Can I have multiple health policies?
    - Is maternity covered?
    - What's the claim process?
    - Can I carry forward unused benefits?
    - Is health insurance tax-deductible?
    - What if I don't disclose pre-existing condition?
    `,
    tone: `
- Direct, honest, India-specific
- Use ₹ examples throughout (real Mumbai/Delhi/Bangalore costs)
- Avoid jargon OR explain every term
- "You" voice: "You might be wondering..."
- Outcome-focused: "So here's what this means for you..."
    `,
    requirements: [
      "Must include 5+ real ₹ examples",
      "Must reference IRDAI norms at least once",
      "Must link to: /policychecker, /calculator, /compare",
      "Internal links using keyword-rich anchor text",
      "Include real hospital room costs in metros (₹2k–₹8k/day)",
      "No corporate jargon, no insurance-speak",
    ],
    ctaLinks: [
      { text: "Decode your health policy", url: "/policychecker" },
      { text: "Calculate your actual insurance costs", url: "/calculator" },
      { text: "Compare health insurance policies side-by-side", url: "/compare" },
    ],
    faqCount: 10,
  },
  {
    id: 2,
    title: "What Is Life Insurance? Complete Guide for Indian Families",
    primaryKeyword: "What is life insurance",
    secondaryKeywords: [
      "life insurance meaning explained",
      "how life insurance works India",
      "term vs whole life insurance",
      "life insurance benefits",
      "life insurance premium calculation",
      "family protection insurance",
    ],
    targetAudience: "30–50 year old decision-makers (parents, breadwinners)",
    wordCount: 2000,
    category: "Individual",
    structure: `
1. Hook
   - "If you die today, is your family financially secure?"
   - Life insurance = family's financial safety net
   - Real stat: "Avg Indian earner ₹8–12L/year; sudden loss = crisis"

2. Definition: What is life insurance?
   - You pay premium → If you die, insurer pays family
   - Simple: "Money for your family after you're gone"
   - Show real example: ₹30L/year earner, ₹1cr policy, family gets ₹1cr

3. How Life Insurance Works
   - You: Pay monthly/annual premium
   - Insurer: Keep premium money (invest it)
   - If you die: Insurer pays sum assured to beneficiary
   - Real scenario: 35-year-old, ₹1cr policy, ₹500/month premium
   - What family receives if claim approved?

4. Types of Life Insurance
   - Term Life Insurance (cheap, pure protection)
   - Whole Life Insurance (expensive, lifetime)
   - Endowment Plans (traditional Indian plan)
   - (Each with ₹ example)

5. Key Terms Explained
   - Sum assured, Premium, Maturity benefit, Riders, Claim settlement period, Waiting period, Policy tenure

6. Who Needs Life Insurance?
   - Breadwinners with dependents
   - Young professionals with loans
   - Parents wanting to secure child's future
   - Business owners

7. Life Insurance Benefits
   - Family financial security
   - Debt repayment
   - Education funding
   - Tax benefits (Section 80C, 80D)
   - Wealth creation

8. Real-World Scenario
   - Case: 32-year-old, ₹12L annual income, two kids, home loan
   - ₹1cr term life policy, ₹400/month premium
   - If death: Family gets ₹1cr breakdown

9. Common Misconceptions
   - "Only breadwinners need it" (wrong)
   - "Life insurance is investment" (term life is not)
   - "Young people don't need it" (cheap when young)
   - "I'll get it later" (premiums increase with age)

10. Next Steps
    - How to calculate needed sum assured
    - Analyze your existing term policy (CTA → /policychecker)
    - Compare term life policies (CTA → /compare)
    - Calculate benefit scenarios (CTA → /calculator)

11. FAQ (10 questions)
    `,
    tone: `
- Serious but not morbid
- Responsible, protective (parent-focused)
- Real Indian scenarios
- Use ₹ for income, sum assured, premiums
- "Your family" not "beneficiaries"
    `,
    requirements: [
      "Min 5 real ₹ scenarios (income levels, family sizes)",
      "Reference IRDAI claim settlement guidelines",
      "Include real claim denial rates + common reasons",
      "Link to: /policychecker, /calculator, /compare",
      "Emphasize: Term life is cheap, pure protection; get it young",
    ],
    ctaLinks: [
      { text: "Understand your existing term policy", url: "/policychecker" },
      { text: "Calculate how much coverage your family needs", url: "/calculator" },
      { text: "Compare term life policies", url: "/compare" },
    ],
    faqCount: 10,
  },
  {
    id: 3,
    title: "Car Insurance Explained: Third-Party vs Comprehensive",
    primaryKeyword: "Car insurance explained",
    secondaryKeywords: [
      "motor insurance third-party vs comprehensive",
      "vehicle insurance add-ons",
      "no-claim bonus explained",
      "car insurance deductible",
      "two-wheeler insurance",
      "vehicle insurance claim process",
    ],
    targetAudience: "Car/bike owners, 25–50, India",
    wordCount: 2000,
    category: "Individual",
    structure: `
1. Hook
   - Accident statistics in India
   - Why vehicle insurance isn't optional
   - Legal requirement + financial protection

2. What is Vehicle Insurance?
   - Protect: Your car + third party
   - Real example: ₹2L car damage, ₹50k claim to third party

3. Two Types of Vehicle Insurance
   - Third-Party Liability Insurance (Mandatory)
   - Comprehensive Insurance (Optional but Smart)
   - Real scenarios for each

4. Key Components
   - Premium, Sum insured, Deductible, No-claim bonus, IDV, Coverage period

5. Add-ons / Riders
   - Zero deductible, Engine protection, Breakdown assistance, Personal accident cover, etc.

6. No-Claim Bonus Explained
   - Discount system (20–50% for claim-free years)
   - Real example: ₹10k premium, 5-year claim-free = ₹5k premium

7. Claim Process
   - Steps and timeline (15–30 days typical)

8. Real-World Scenarios
   - Minor fender-bender
   - Major accident
   - Hit-and-run

9. Common Claim Denials
   - Expired policy, No license, DUI, etc.

10. Tips for Cheaper Vehicle Insurance
    - Increase deductible, Improve car safety, Maintain NCB, etc.

11. FAQ (10 questions)
    `,
    tone: `
- Practical, real-world
- Focus on "what this costs you" not "insurance speak"
- Use ₹ for cars, repairs, premiums
- Scenario-driven
    `,
    requirements: [
      "Min 5 real ₹ scenarios (damage amounts, premium costs)",
      "Reference RTO/SLLI regulations (third-party mandatory)",
      "Include real claim denial stats",
      "Link to: /policychecker, /calculator, /compare",
      "Show deductible logic (small claims vs NCB value)",
      "Address DUI/rash driving (major denial reasons)",
    ],
    ctaLinks: [
      { text: "Decode your vehicle insurance policy", url: "/policychecker" },
      { text: "Calculate accident cost scenarios", url: "/calculator" },
      { text: "Compare vehicle insurance policies", url: "/compare" },
    ],
    faqCount: 10,
  },
  {
    id: 4,
    title: "Home Insurance Explained: Building vs Contents Coverage",
    primaryKeyword: "Home insurance explained",
    secondaryKeywords: [
      "building insurance vs contents insurance",
      "landlord insurance India",
      "home insurance coverage",
      "property damage insurance",
      "home insurance premium",
      "fire and theft insurance",
    ],
    targetAudience: "Homeowners/landlords, 30–60, India",
    wordCount: 1800,
    category: "Individual",
    structure: `
1. Hook
   - Fire, theft, natural disasters damage ₹crores yearly
   - Your home likely your biggest asset (₹30L–₹1cr+ in metros)
   - Home insurance = protection for that investment

2. What is Home Insurance?
   - Protection: Your house + contents/furniture inside
   - Real example: ₹50L home, ₹50k annual premium, fire damage covered

3. Three Types of Home Insurance
   - Building Insurance (Structure Only)
   - Contents Insurance (Belongings Only)
   - Landlord Insurance (For Rented Homes)

4. Key Coverage Areas
   - Fire, Burglary/theft, Vandalism, Natural calamities, Riots, Third-party liability, Loss of rent

5. What Home Insurance DOESN'T Cover
   - Wear and tear, Poor maintenance, Mechanical/electrical failure, etc.

6. Add-ons/Riders
   - Earthquake cover, Flood cover, Replacement cost, etc.

7. How to Determine Coverage Amount
   - Building valuation, Contents listing, Don't under/over-insure

8. Claim Process
   - Steps and timeline (20–30 days)

9. Real-World Scenarios
   - Home owner, fire damage
   - Renter, theft
   - Landlord, tenant defaults

10. Owner vs Landlord vs Renter
    - Table comparison

11. FAQ (10 questions)
    `,
    tone: `
- Practical, protective
- Address fear of being underinsured
- Use ₹ for home values, coverage, claims
- Clear distinction: Building vs Contents
    `,
    requirements: [
      "Real metro home prices (₹30L–₹1cr)",
      "Real content values (₹10L–₹30L)",
      "Real claim examples with amounts",
      "Link to: /policychecker, /calculator, /compare",
      "Emphasize: Under-insurance is common mistake",
      "Address: Flood/earthquake as add-ons (critical for India)",
    ],
    ctaLinks: [
      { text: "Analyze your home insurance policy", url: "/policychecker" },
      { text: "Calculate coverage you need", url: "/calculator" },
      { text: "Compare home insurance policies", url: "/compare" },
    ],
    faqCount: 10,
  },
  {
    id: 5,
    title: "Travel Insurance Explained: Domestic vs International",
    primaryKeyword: "Travel insurance explained",
    secondaryKeywords: [
      "travel insurance coverage",
      "international travel insurance",
      "domestic travel insurance",
      "travel medical insurance",
      "trip cancellation coverage",
      "travel insurance exclusions",
    ],
    targetAudience: "Frequent travelers, young professionals, 25–50, India",
    wordCount: 1800,
    category: "Individual",
    structure: `
1. Hook
   - Flight cancelled → lose ₹50k?
   - Medical emergency abroad → ₹2L hospital bill?
   - Baggage lost → no spare clothes for 5-day trip?
   - Travel insurance = peace of mind

2. What is Travel Insurance?
   - Covers: Medical emergencies, trip cancellation, lost baggage, delays
   - Cost: ₹500–₹3000 per trip

3. Types of Travel Insurance
   - Individual Trip Insurance
   - International Travel Insurance
   - Annual Travel Insurance

4. What Travel Insurance Covers
   - Medical Coverage, Trip Cancellation, Lost/Delayed Baggage, Travel Delay, Lost Documents, Personal Liability, Adventure Activities

5. What Travel Insurance DOESN'T Cover
   - Pre-existing conditions, High-risk activities, Travel during unrest, etc.

6. Domestic vs International Travel Insurance
   - Cost differences, Coverage differences, Use cases

7. Real-World Scenarios
   - Domestic flight cancellation
   - Medical emergency abroad
   - Lost baggage

8. How to Choose Right Coverage
   - Assess travel frequency, Check destinations, Declare pre-existing conditions

9. Tips for Smooth Claims
   - Report ASAP, Keep receipts, Document everything

10. FAQ (10 questions)
    `,
    tone: `
- Practical, reassuring
- Focus: Risk mitigation, not just protection
- Use ₹ for trip costs, medical expenses
- Scenarios that resonate with travelers
    `,
    requirements: [
      "Real ₹ examples (trips, medical costs, compensation)",
      "Real destination examples (Thailand, Dubai, Europe)",
      "Address: Pre-existing conditions (critical transparency)",
      "Link to: /policychecker, /calculator, /compare",
      "Emphasize: Medical evacuation is expensive; worth the insurance",
    ],
    ctaLinks: [
      { text: "Analyze your travel insurance policy", url: "/policychecker" },
      { text: "Calculate trip costs and coverage needed", url: "/calculator" },
      { text: "Compare travel insurance policies", url: "/compare" },
    ],
    faqCount: 10,
  },
];

/**
 * Master GPT-EO Prompt Template
 * Use this with ChatGPT/Claude/Gemini to generate articles
 */
export function generateArticlePrompt(brief: ArticleBrief): string {
  return `You are an expert insurance writer for Ensured (ensured.com), an AI-powered insurance clarity platform for Indian customers.

Your task: Write a ${brief.wordCount}-word blog article about "${brief.title}".

═══════════════════════════════════════════════════════════════

PRIMARY KEYWORD: ${brief.primaryKeyword}
SECONDARY KEYWORDS: ${brief.secondaryKeywords.join(", ")}
TARGET AUDIENCE: ${brief.targetAudience}

═══════════════════════════════════════════════════════════════

ARTICLE STRUCTURE (MANDATORY):

${brief.structure}

═══════════════════════════════════════════════════════════════

WRITING GUIDELINES:

TONE:
${brief.tone}

LANGUAGE:
- Avoid jargon OR explain every term
- Use "you" voice: "You pay X → You get Y"
- Short sentences (15–20 words max)
- Short paragraphs (2–3 sentences max)
- Use **bold** for key terms first mention
- Use numbered lists for steps, bullet points for lists

₹ EXAMPLES:
- Must include 5+ real ₹ examples minimum
- Use real costs for India:
  * Hospital rooms: ₹2k–₹8k/day (metros)
  * Car repairs: ₹20k–₹2L (depends on damage)
  * Home values: ₹30L–₹1cr (metros)
  * Insurance premiums: Vary by type
- Make comparisons relatable: "That's like buying [X]"

INTERNAL LINKING:
${brief.ctaLinks.map(link => `- Link to ${link.url} with anchor text: "${link.text}"`).join("\n")}
- Use keyword-rich anchor text
- Minimum 5–7 links per article, maximum 10
- Spread links naturally (not all at end)

REQUIREMENTS:
${brief.requirements.map(req => `- ${req}`).join("\n")}
- Must reference IRDAI or insurance regulations at least once
- Must include claim denial rates or statistics (if available)
- Must address "what if you don't have this" (contrast)
- Must be India-specific (not generic)
- Must be honest about gaps/exclusions

═══════════════════════════════════════════════════════════════

OUTPUT FORMAT:

[Complete article in markdown format]
- Use # for H1 (article title)
- Use ## for H2 (section headings)
- Use ### for H3 (subsections)
- Use **bold** for key terms
- Use > for blockquotes (for important callouts)
- Use numbered lists for processes, bullet lists for lists

═══════════════════════════════════════════════════════════════

FINAL CHECKLIST:

- [ ] Article is ${brief.wordCount} words (±5%)
- [ ] Contains 5+ real ₹ examples
- [ ] Includes ${brief.faqCount} FAQ questions
- [ ] Includes 2–3 real-world scenarios
- [ ] Links to all required pages
- [ ] No jargon OR all jargon explained
- [ ] Tone: Direct, honest, India-specific
- [ ] SEO keywords naturally integrated

═══════════════════════════════════════════════════════════════

Write the article now.`;
}
