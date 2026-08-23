import { Link } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ArrowRight } from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { SchemaMarkup } from "@/components/SEO";
import { CLAUSE_LIBRARY } from "@/data/clause-library";

const SITE = "https://indsure.in";

export default function LearnHub() {
  useSEO({
    title: "Insurance Clause Library: Every Term Explained Plainly | IndSure",
    description:
      "A plain-language library of Indian insurance clauses, waiting periods, sub-limits, and benefits. Understand room-rent caps, co-pay, PED, restoration, IDV, and more before you claim.",
    keywords:
      "insurance clause library, insurance terms explained India, room rent cap, co-pay, sub-limit, waiting period, restoration benefit, IDV",
    canonical: "/learn",
  });

  // Group entries by their category label, preserving first-seen order.
  const groups: { name: string; items: typeof CLAUSE_LIBRARY }[] = [];
  for (const c of CLAUSE_LIBRARY) {
    let g = groups.find((x) => x.name === c.category);
    if (!g) {
      g = { name: c.category, items: [] as unknown as typeof CLAUSE_LIBRARY };
      groups.push(g);
    }
    (g.items as any).push(c);
  }

  const collectionSchema = {
    "@type": "CollectionPage",
    name: "IndSure Insurance Clause Library",
    description:
      "A plain-language library of Indian insurance clauses, waiting periods, sub-limits, and benefits.",
    url: `${SITE}/learn`,
    hasPart: CLAUSE_LIBRARY.map((c) => ({
      "@type": "DefinedTerm",
      name: c.term,
      url: `${SITE}/learn/${c.slug}`,
    })),
  };

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <SchemaMarkup type="CollectionPage" data={collectionSchema} />
      <Header />
      <Breadcrumbs items={[{ label: "Learn" }]} />

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 pt-24 sm:pt-28 pb-16">
        <header className="max-w-2xl mb-12">
          <p className="text-xs uppercase tracking-widest text-[var(--color-green-primary)] font-semibold mb-3">
            Clause library
          </p>
          <h1 className="text-3xl md:text-5xl font-serif font-bold mb-4 leading-tight">
            Every insurance clause, explained plainly
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed">
            Insurance is complicated on purpose. This is the plain-language library of the clauses,
            waiting periods, and benefits that decide whether your claim gets paid. Each term is
            defined the way you would actually search for it, with examples and the mistakes to avoid.
          </p>
        </header>

        {groups.map((g) => (
          <section key={g.name} className="mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4 border-b border-[var(--color-border-light)] pb-2">
              {g.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {g.items.map((c) => (
                <Link key={c.slug} href={`/learn/${c.slug}`}>
                  <div className="bg-white rounded-xl border border-[var(--color-border-light)] p-5 h-full hover:shadow-lg hover:border-[var(--color-green-secondary)] transition-all cursor-pointer flex flex-col">
                    <h3 className="font-semibold mb-1">{c.term}</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3 flex-grow">
                      {c.shortAnswer}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm text-[var(--color-green-primary)] font-medium mt-3">
                      Read <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
