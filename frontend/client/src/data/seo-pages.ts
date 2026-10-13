// One title and description per public route, read by BOTH the prerender
// (scripts/prerender.mjs, which writes the raw HTML a crawler sees first) and
// the useSEO hook (which sets the head after JavaScript runs).
//
// Why one table: Search Console crawled the site on 2026-09-23 and found nine
// pages whose prerendered title and JS title disagreed, because each lived in a
// different file and they were edited separately. Google may pick either one.
//
// Rules the prerender enforces at build time for every indexable entry:
//   - title at most 60 characters, description at most 160
//   - the description names "IndSure". For the query "indsure.in" Google wants
//     a snippet containing the brand, and when the description lacked it Google
//     quoted the footer tagline, an FAQ disclaimer or an author bio instead.

export interface PageSeo {
  title: string;
  description: string;
  /** Keep the page out of the index (legal pages, sign-in screens, demos). */
  noindex?: boolean;
}

export const PAGE_SEO: Record<string, PageSeo> = {
  "/": {
    title: "IndSure: Your Family's Insurance, Explained in One Place",
    description:
      "IndSure keeps your health, term life and motor policies in one private dashboard and explains what each covers and won't pay. Free to start, no sales calls.",
  },
  "/how-it-works": {
    title: "How IndSure Works: Upload a Policy, Get a Plain Report",
    description:
      "IndSure reads your policy PDF clause by clause and returns a plain-language report on cover, gaps and waiting periods. Four steps, free to start.",
  },
  "/policychecker": {
    title: "Health Insurance Policy Checker: Find Gaps | IndSure",
    description:
      "A free health insurance policy review: upload your PDF and IndSure shows your room-rent cap, co-pay, sub-limits and waiting periods in plain language.",
  },
  "/calculator": {
    title: "Health Insurance Calculator: How Much Cover? | IndSure",
    description:
      "IndSure's free health insurance calculator works out how much cover your family needs from your city's hospital costs and your ages. No upload, nothing to buy.",
  },
  "/compare": {
    title: "Compare Health Insurance Policies Clause by Clause | IndSure",
    description:
      "Compare up to 4 health insurance plans side by side on IndSure: room limits, waiting periods, co-pay and exclusions from the real wordings. Free, no signup.",
  },
  "/start": {
    title: "Start Your Insurance Portfolio Free | IndSure",
    // claim-source: backend/server/routes.ts (FREE_SLOTS_PER_TYPE is the only gate). Verified 2026-09-07.
    description:
      "Add your first health, term life or vehicle policy to IndSure and see what it covers in plain language. Free for one policy of each type, no card needed.",
  },
  "/pricing": {
    title: "IndSure Pricing: Free Plan, or ₹99 a Month",
    // claim-source: pages/pricing.tsx featureRows (free = 1 health check, 1 of each other type stored).
    description:
      "Start free on IndSure: one health policy check, one of each other type stored, no card needed. Personal is ₹99 a month or ₹999 a year.",
  },
  "/life": {
    title: "Life Insurance Checker: Sum Assured & Riders | IndSure",
    description:
      "Upload your life insurance PDF and IndSure checks if your sum assured is enough, plus claim conditions, exclusions and riders. Free and private.",
  },
  "/term": {
    title: "Term Insurance Checker: Is Your Cover Enough? | IndSure",
    description:
      "Upload your term plan PDF and IndSure checks your sum assured against your family's needs, plus claim conditions and exclusions. Free and private.",
  },
  "/vehicle": {
    title: "Car and Bike Insurance Checker: IDV, NCB | IndSure",
    description:
      "Upload your car or bike policy and IndSure shows your IDV, deductibles, NCB and add-ons, and what an accident would really cost you. Free and private.",
  },
  "/find-provider": {
    title: "Cashless Network Hospital Finder | IndSure",
    description:
      "Check which insurers have a cashless tie-up with hospitals near you. IndSure's network hospital finder helps you pick a policy before a claim, not after.",
  },
  "/why-indsure": {
    title: "Why IndSure: Unbiased Insurance Checks, Zero Commission",
    description:
      "IndSure earns no commission and sells no leads. See how its policy catalog and clause-by-clause engine give you an honest read of your insurance.",
  },
  "/blog": {
    title: "Insurance Guides for India: Health, Life, Motor | IndSure",
    description:
      "Plain-language guides from IndSure on health, term life and motor insurance in India: claims, waiting periods, room-rent caps, tax benefits and more.",
  },
  "/agent": {
    title: "IndSure Advisor Portal: CRM for Insurance Agents in India",
    description:
      "IndSure's Advisor Portal helps Indian insurance advisors manage clients, track renewals and decode customer policies from one phone-friendly dashboard.",
  },
  "/advisors/pricing": {
    title: "IndSure Advisor Pricing: Free Plan, or ₹1,499 a Month",
    // claim-source: pages/advisors-pricing.tsx plans (Free forever; Agent ₹1,499/month, ₹14,990/year, 12 checks a month).
    description:
      "IndSure's daily tools for insurance advisors are free forever. The Agent plan is ₹1,499 a month or ₹14,990 a year, with 12 policy checks every month.",
  },
  "/advisors/features": {
    title: "Features for Insurance Advisors | IndSure",
    description:
      "Every tool in the IndSure advisor portal: customers, leads, renewals, policy checks, compare, cover calculator, claims and your own website.",
  },
  "/advisors/how-to-use": {
    title: "How to Use the IndSure Advisor Portal | IndSure",
    description:
      "Step-by-step guides for IndSure advisors: check a policy, share a report, compare plans, follow up leads, send renewal reminders on WhatsApp.",
  },
  "/learn": {
    // No term count in the title: it would go stale the day an entry is added.
    title: "Insurance Clause Library: Every Term Explained | IndSure",
    description:
      "IndSure's clause library explains Indian insurance terms in plain language: room-rent cap, co-pay, PED waiting period, restoration, IDV and more.",
  },
  "/team": {
    title: "Meet the IndSure Team | IndSure",
    description:
      "IndSure is built by a small team that got tired of watching people find out what their policy actually covers only after a claim gets rejected.",
  },
  "/help": {
    title: "Help and Support | IndSure",
    description:
      "Answers to common questions about reading your policy, your IndSure account and your privacy, plus how to reach the IndSure support team.",
  },
  "/mission": {
    title: "Our Mission: Insurance You Can Actually Understand | IndSure",
    description:
      "Insurance was designed to protect you, then it became about confusing you. IndSure exists to put the plain meaning back into the policy.",
  },
  "/vision": {
    title: "Our Vision: Insurance Decisions Made With Clarity | IndSure",
    description:
      "IndSure works toward a future where every policyholder understands exactly what they are buying and how it protects them.",
  },

  // Out of the index. Their footer links stay, and "follow" lets link equity
  // through. Search Console says noindex is the supported way to drop a sitelink.
  "/privacy-policy": {
    title: "Privacy Policy | IndSure",
    description:
      "How IndSure collects, uses and protects your personal data and the policy documents you upload.",
    noindex: true,
  },
  "/terms": {
    title: "Terms of Service | IndSure",
    description: "The terms that govern your use of IndSure and its policy checks.",
    noindex: true,
  },
  "/cookie-policy": {
    title: "Cookie Policy | IndSure",
    description: "Which cookies and similar storage IndSure uses, and why.",
    noindex: true,
  },
  "/grievance": {
    title: "Grievance Officer | IndSure",
    description: "How to raise a grievance with IndSure and who handles it.",
    noindex: true,
  },
  "/signup": {
    title: "Create a Free IndSure Account | IndSure",
    description:
      "Create a free IndSure account to store every policy and get renewal reminders before they lapse.",
    noindex: true,
  },
  "/login": {
    title: "Sign in | IndSure",
    description: "Sign in to your IndSure account.",
    noindex: true,
  },
  "/agent/login": {
    title: "Advisor Sign in | IndSure",
    description: "Sign in to the IndSure Advisor Portal.",
    noindex: true,
  },
  "/agent/signup": {
    title: "Create Your Advisor Account | IndSure",
    description: "Create an IndSure Advisor Portal account.",
    noindex: true,
  },
  "/agent/playground": {
    title: "Advisor Portal Demo | IndSure",
    description: "Try the IndSure Advisor Portal with sample data, no account needed.",
    noindex: true,
  },
};

/** Spread into useSEO: `useSEO(seoFor("/pricing"))`. */
export function seoFor(path: string) {
  const p = PAGE_SEO[path];
  if (!p) throw new Error(`No PAGE_SEO entry for ${path}`);
  return { title: p.title, description: p.description, canonical: path, noindex: p.noindex };
}

// ---------------------------------------------------------------------------
// Templates for the generated pages (blog posts, clause library, authors).
// Shared with the prerender for the same reason as PAGE_SEO above.

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

// Head titles for clause terms too long for either automatic form. Keyed by term.
const CLAUSE_TITLES: Record<string, string> = {
  "Motor add-ons (engine protect, RSA, RTI, consumables)": "Motor Add-ons Explained: Engine Protect, RSA, RTI | IndSure",
  "Compulsory vs voluntary deductible (motor)": "Compulsory vs Voluntary Motor Deductible | IndSure",
  "Pre-existing disease (PED) waiting period": "Pre-existing Disease (PED) Waiting Period | IndSure",
};

/** "Room Rent Cap Explained: Meaning & Examples | IndSure", or a shorter form for long terms. */
export function clauseTitle(term: string) {
  if (CLAUSE_TITLES[term]) return CLAUSE_TITLES[term];
  const full = `${term} Explained: Meaning & Examples | IndSure`;
  return full.length <= TITLE_MAX ? full : `${term} Explained | IndSure`;
}

// Hand-written head for posts that earn a sitelink. Keyed by URL slug.
export const BLOG_SEO: Record<string, { title?: string; description?: string }> = {
  "health-insurance-vs-mediclaim": {
    title: "Health Insurance vs Mediclaim: The Difference | IndSure",
    description:
      "Mediclaim is the older term; modern health insurance covers more. IndSure explains the difference in plain language and which one suits your family.",
  },
  // Shorter head titles (60 chars max) for posts whose H1 runs long; the
  // on-page H1 keeps the full title.
  "buying-insurance-before-or-after-a-diagnosis": { title: "Buying Insurance Before or After a Diagnosis | IndSure" },
  "cashless-vs-reimbursement-claims": { title: "Cashless vs Reimbursement Claims Explained | IndSure" },
  "claim-health-insurance-for-existing-disease": { title: "Claiming Health Insurance for an Existing Disease | IndSure" },
  "common-hidden-clauses-in-indian-health-policies": { title: "Common Hidden Clauses in Indian Health Policies | IndSure" },
  "cover-size-5-lakh-vs-10-lakh-vs-1-crore": { title: "5 Lakh vs 10 Lakh vs 1 Crore Health Cover | IndSure" },
  "family-floater-vs-individual-policies": { title: "Family Floater vs Individual Health Policy | IndSure" },
  "health-insurance-claim-rejected-what-to-do": { title: "Health Insurance Claim Rejected? What to Do | IndSure" },
  "health-insurance-sufficiency-guide": { title: "Is Your Health Insurance Enough? A Guide | IndSure" },
  "home-insurance-building-vs-contents": { title: "Home Insurance: Building vs Contents Cover | IndSure" },
  "how-many-health-insurance-claims-per-year": { title: "How Many Health Insurance Claims Per Year? | IndSure" },
  "how-much-health-cover-do-you-need-by-life-stage": { title: "How Much Health Cover You Need, by Life Stage | IndSure" },
  "how-to-port-health-insurance-without-losing-benefits": { title: "Port Health Insurance Without Losing Benefits | IndSure" },
  "how-to-read-a-policy-wording-in-10-minutes": { title: "How to Read a Policy Wording in 10 Minutes | IndSure" },
  "individual-vs-group-health-insurance": { title: "Individual vs Group Health Insurance | IndSure" },
  "irdai-rule-changes-what-they-mean-for-your-policy": { title: "IRDAI Rule Changes: What They Mean for You | IndSure" },
  "liability-insurance-explained": { title: "Liability Insurance: Professional and General | IndSure" },
  "property-insurance-explained": { title: "Property Insurance: Commercial and Residential | IndSure" },
  "restoration-benefit-explained": { title: "Restoration Benefit in Health Insurance | IndSure" },
  "tax-benefits-health-life-insurance-80d-80c": { title: "Tax Benefits on Insurance: Sec 80D and 80C | IndSure" },
  "term-life-insurance-basics": { title: "Term Life Insurance Basics Explained | IndSure" },
  "third-party-vs-comprehensive-car-insurance": { title: "Third-Party vs Comprehensive Car Insurance | IndSure" },
  "top-5-health-insurance-gaps": { title: "Top 5 Gaps in Health Insurance Policies | IndSure" },
  "travel-insurance-domestic-vs-international": { title: "Domestic vs International Travel Insurance | IndSure" },
  "what-is-health-insurance": { title: "What Is Health Insurance? A Guide for India | IndSure" },
  "what-is-life-insurance": { title: "What Is Life Insurance? A Guide for Families | IndSure" },
  "why-insurers-reject-claims-how-to-claim-proof": { title: "Why Insurers Reject Claims and How to Avoid It | IndSure" },
};

export function blogTitle(title: string, slug?: string) {
  return (slug && BLOG_SEO[slug]?.title) || `${title} | IndSure`;
}

export function blogDescription(excerpt: string, slug?: string) {
  return (slug && BLOG_SEO[slug]?.description) || metaDescription(excerpt);
}

/**
 * Whole sentences from the start of `text` that fit in `max` characters. When
 * even the first sentence is too long, cut it at a word boundary and end with an
 * ellipsis, so Google is not left to truncate mid-word.
 */
export function metaDescription(text: string, max = DESCRIPTION_MAX) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const sentences = clean.match(/[^.?!]+[.?!]+(?=\s|$)/g) ?? [];
  let out = "";
  for (const s of sentences) {
    const next = (out + " " + s.trim()).trim();
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
  const cut = clean.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:(—-]+$/, "") + "…";
}
