// SEO slugs for blog posts — single source of truth, keyed by post id.
// /blog/:param accepts BOTH the slug (canonical) and the legacy numeric id
// (old indexed/bookmarked links keep working; canonical tag points at the slug).
import { blogPosts, type BlogPost } from "./blog-data";

export const POST_SLUGS: Record<number, string> = {
  1: "health-insurance-sufficiency-guide",
  2: "top-5-health-insurance-gaps",
  3: "right-sum-insured-for-your-city",
  4: "room-rent-caps-hidden-cost",
  5: "pre-existing-disease-waiting-periods",
  6: "family-floater-vs-individual-policies",
  7: "restoration-benefit-explained",
  8: "cashless-vs-reimbursement-claims",
  9: "what-is-health-insurance",
  10: "what-is-life-insurance",
  11: "third-party-vs-comprehensive-car-insurance",
  12: "home-insurance-building-vs-contents",
  13: "travel-insurance-domestic-vs-international",
  14: "what-is-general-insurance",
  15: "health-insurance-vs-mediclaim",
  16: "term-life-insurance-basics",
  17: "property-insurance-explained",
  18: "personal-accident-insurance-guide",
  19: "business-insurance-101",
  20: "liability-insurance-explained",
  21: "workers-compensation-guide",
  22: "marine-cargo-insurance",
  23: "cyber-insurance-explained",
  24: "what-is-reinsurance",
  25: "retirement-pension-plans",
  26: "agricultural-crop-insurance",
  27: "micro-insurance-explained",
  28: "top-types-of-insurance",
};

const SLUG_TO_ID: Record<string, number> = Object.fromEntries(
  Object.entries(POST_SLUGS).map(([id, slug]) => [slug, Number(id)])
);

export function slugFor(id: number): string {
  return POST_SLUGS[id] ?? String(id);
}

export function blogPath(id: number): string {
  return `/blog/${slugFor(id)}`;
}

/** Resolve a /blog/:param value (slug or legacy numeric id) to a post. */
export function postFromParam(param: string | undefined): BlogPost | null {
  if (!param) return null;
  const bySlug = SLUG_TO_ID[param];
  if (bySlug) return blogPosts.find((p) => p.id === bySlug) ?? null;
  const n = parseInt(param, 10);
  if (!Number.isNaN(n)) return blogPosts.find((p) => p.id === n) ?? null;
  return null;
}
