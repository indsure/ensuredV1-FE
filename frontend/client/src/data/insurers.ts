// Data for programmatic insurer landing pages (/insurers/:slug).
//
// IMPORTANT (accuracy policy): these pages deliberately contain NO volatile
// figures (no claim-settlement ratios, cashless network counts, or specific
// room-rent/co-pay numbers). Those are plan-specific and change over time, so
// asserting them as fact on YMYL content is risky. Each page instead explains
// the universal mechanics and drives the reader to check THEIR own policy.
// The `blurb` values below are stable, high-confidence positioning statements.

export type InsurerCategory = "Standalone health insurer" | "General insurer";

export interface Insurer {
  slug: string;
  /** Common brand name used in copy and titles. */
  name: string;
  /** Short name for tighter sentences. */
  shortName: string;
  category: InsurerCategory;
  /** One stable, high-confidence sentence of positioning. No volatile numbers. */
  blurb: string;
}

export const INSURERS: Insurer[] = [
  {
    slug: "star-health",
    name: "Star Health",
    shortName: "Star Health",
    category: "Standalone health insurer",
    blurb:
      "Star Health is one of India's largest standalone health insurers, best known for its retail health plans and wide cashless hospital network.",
  },
  {
    slug: "hdfc-ergo",
    name: "HDFC ERGO",
    shortName: "HDFC ERGO",
    category: "General insurer",
    blurb:
      "HDFC ERGO is a large private general insurer offering health, motor, travel, and home cover in India.",
  },
  {
    slug: "icici-lombard",
    name: "ICICI Lombard",
    shortName: "ICICI Lombard",
    category: "General insurer",
    blurb:
      "ICICI Lombard is one of India's largest private general insurers, with a broad range of health and motor products.",
  },
  {
    slug: "niva-bupa",
    name: "Niva Bupa",
    shortName: "Niva Bupa",
    category: "Standalone health insurer",
    blurb:
      "Niva Bupa (formerly Max Bupa) is a standalone health insurer focused on retail and family health plans.",
  },
  {
    slug: "care-health",
    name: "Care Health Insurance",
    shortName: "Care",
    category: "Standalone health insurer",
    blurb:
      "Care Health Insurance (formerly Religare Health) is a standalone health insurer offering retail, family, and top-up health plans.",
  },
  {
    slug: "aditya-birla-health",
    name: "Aditya Birla Health Insurance",
    shortName: "Aditya Birla Health",
    category: "Standalone health insurer",
    blurb:
      "Aditya Birla Health Insurance is a standalone health insurer known for wellness and health-management linked plans.",
  },
  {
    slug: "bajaj-allianz",
    name: "Bajaj Allianz",
    shortName: "Bajaj Allianz",
    category: "General insurer",
    blurb:
      "Bajaj Allianz General Insurance is a large private general insurer with health, motor, and travel products.",
  },
  {
    slug: "tata-aig",
    name: "Tata AIG",
    shortName: "Tata AIG",
    category: "General insurer",
    blurb:
      "Tata AIG General Insurance is a private general insurer offering health, travel, and motor cover in India.",
  },
  {
    slug: "new-india-assurance",
    name: "The New India Assurance",
    shortName: "New India Assurance",
    category: "General insurer",
    blurb:
      "The New India Assurance is India's largest public-sector general insurer, offering mediclaim and a wide range of general insurance.",
  },
  {
    slug: "go-digit",
    name: "Go Digit",
    shortName: "Digit",
    category: "General insurer",
    blurb:
      "Go Digit General Insurance is a digital-first private general insurer offering health and motor cover.",
  },
];

export function insurerBySlug(slug: string): Insurer | undefined {
  return INSURERS.find((i) => i.slug === slug);
}
