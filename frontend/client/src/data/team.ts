// Single source of truth for the founding team.
// Used by the /team page, blog author bylines, author pages, and the
// prerender/JSON-LD pipeline so every "author" reference stays consistent.

export interface Founder {
  /** Clean legal name, no credential suffix (used for schema Person.name). */
  name: string;
  /** Credential suffix shown after the name, e.g. "CFA". */
  suffix?: string;
  /** Job title at IndSure. */
  role: string;
  bio: string;
  linkedin: string;
  initials: string;
  /** URL slug for the author page, e.g. "deep-shah". */
  slug: string;
}

export const FOUNDERS: Founder[] = [
  {
    name: "Deep Shah",
    role: "CEO",
    bio: "Deep started IndSure after watching a family member's hospital claim get slashed by a room-rent clause nobody had explained at the time of buying the policy. The pattern was obvious: insurance isn't complicated because it has to be, it's complicated because complexity is profitable for whoever's selling it. He leads product and the long-term bet that clarity should be a right, not a service you pay a commission for.",
    linkedin: "https://www.linkedin.com/in/deeepp/",
    initials: "DS",
    slug: "deep-shah",
  },
  {
    name: "Aniket Bang",
    suffix: "CFA",
    role: "CRO",
    bio: "Aniket reads policy documents the way most people read term sheets, line by line, looking for what the bold-print number is hiding. A CFA by training, he leads revenue and partnerships, and spends an uncomfortable amount of time arguing that a room-rent cap belongs above the fold, not in Annexure IV.",
    linkedin: "https://www.linkedin.com/in/aniketbang13/",
    initials: "AB",
    slug: "aniket-bang",
  },
  {
    name: "Nikhil Mhaskar",
    role: "COO",
    bio: "Nikhil runs the unglamorous half of IndSure, the pipelines that turn a scanned PDF into a clause-by-clause audit in under a minute, the agent onboarding that doesn't need a training manual, the systems that keep working when nobody's watching. If IndSure feels simple to use, it's because he made the complicated part invisible.",
    linkedin: "https://www.linkedin.com/in/mhaskar-nikhil01/",
    initials: "NM",
    slug: "nikhil-mhaskar",
  },
];

/** Display name including credential suffix, e.g. "Aniket Bang, CFA". */
export function displayName(f: Founder): string {
  return f.suffix ? `${f.name}, ${f.suffix}` : f.name;
}

/**
 * Deterministic author assignment for a blog post, rotating across the
 * founders by post id so bylines are stable and spread evenly.
 */
export function authorForId(id: number): Founder {
  return FOUNDERS[id % FOUNDERS.length];
}

export function founderBySlug(slug: string): Founder | undefined {
  return FOUNDERS.find((f) => f.slug === slug);
}
