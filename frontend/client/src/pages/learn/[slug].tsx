import { useRoute, Link } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, AlertTriangle, Lightbulb } from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { SchemaMarkup, createFAQSchema } from "@/components/SEO";
import { clauseBySlug, CLAUSE_LIBRARY } from "@/data/clause-library";

const SITE = "https://indsure.in";

export default function ClauseDetail() {
  const [, params] = useRoute("/learn/:slug");
  const clause = clauseBySlug(params?.slug || "");

  useSEO({
    title: clause ? `What is a ${clause.term}? Meaning, Examples & Mistakes | IndSure` : "Insurance Clause Library | IndSure",
    description: clause
      ? clause.shortAnswer.slice(0, 300)
      : "Plain-language explanations of Indian insurance clauses, waiting periods, and benefits.",
    keywords: clause ? [clause.term, ...(clause.aka || [])].join(", ") : undefined,
    canonical: clause ? `/learn/${clause.slug}` : "/learn",
  });

  if (!clause) {
    return (
      <div className="min-h-screen bg-[var(--color-cream-main)] flex flex-col">
        <Header />
        <Breadcrumbs items={[{ label: "Learn", href: "/learn" }, { label: "Not found" }]} />
        <main className="flex-1 max-w-3xl mx-auto px-6 pt-32 pb-12 text-center">
          <h1 className="text-3xl font-bold font-serif mb-4">Term not found</h1>
          <Button asChild className="bg-[var(--color-green-primary)] text-white">
            <Link href="/learn">Browse the clause library</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const related = (clause.related || [])
    .map((s) => CLAUSE_LIBRARY.find((c) => c.slug === s))
    .filter(Boolean) as typeof CLAUSE_LIBRARY;

  const canonical = `${SITE}/learn/${clause.slug}`;

  const definedTermSchema = {
    "@type": "DefinedTerm",
    name: clause.term,
    ...(clause.aka?.length ? { alternateName: clause.aka } : {}),
    description: clause.shortAnswer,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "IndSure Insurance Clause Library",
      url: `${SITE}/learn`,
    },
    url: canonical,
  };
  const breadcrumbSchema = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Learn", item: `${SITE}/learn` },
      { "@type": "ListItem", position: 3, name: clause.term, item: canonical },
    ],
  };

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <SchemaMarkup type="DefinedTerm" data={definedTermSchema} />
      <SchemaMarkup type="BreadcrumbList" data={breadcrumbSchema} />
      {clause.faqs?.length > 0 && (
        <SchemaMarkup type="FAQPage" data={createFAQSchema(clause.faqs)} />
      )}
      <Header />
      <Breadcrumbs items={[{ label: "Learn", href: "/learn" }, { label: clause.term }]} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 pt-24 sm:pt-28 pb-16">
        <article>
          <p className="text-xs uppercase tracking-widest text-[var(--color-green-primary)] font-semibold mb-3">
            {clause.category}
          </p>
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">What is a {clause.term}?</h1>

          {/* Answer-first block */}
          <div className="bg-white rounded-xl border border-[var(--color-border-light)] border-l-4 border-l-[var(--color-green-primary)] p-5 mb-8">
            <p className="text-lg leading-relaxed">{clause.shortAnswer}</p>
          </div>

          {clause.sections.map((sec) => (
            <section key={sec.h2} className="mb-8">
              <h2 className="text-xl font-serif font-bold mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[var(--color-green-primary)]" /> {sec.h2}
              </h2>
              {sec.body.map((p, i) => (
                <p key={i} className="text-[var(--color-text-secondary)] leading-relaxed mb-3">{p}</p>
              ))}
            </section>
          ))}

          {clause.example && (
            <div className="bg-[var(--color-cream-dark)] rounded-xl p-5 mb-8">
              <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-[var(--color-green-primary)]" /> Example
              </h2>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">{clause.example}</p>
            </div>
          )}

          {clause.mistakes && clause.mistakes.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-serif font-bold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> Common mistakes
              </h2>
              <ul className="space-y-2">
                {clause.mistakes.map((m, i) => (
                  <li key={i} className="flex gap-2 text-[var(--color-text-secondary)]">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {clause.faqs && clause.faqs.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-serif font-bold mb-4">Frequently asked questions</h2>
              <div className="space-y-4">
                {clause.faqs.map((f) => (
                  <div key={f.question}>
                    <h3 className="font-semibold mb-1">{f.question}</h3>
                    <p className="text-[var(--color-text-secondary)] leading-relaxed">{f.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <div className="bg-[var(--color-petrol-900)] text-white rounded-xl p-6 my-10 text-center">
            <h2 className="text-xl font-serif font-bold mb-2">See how this applies to your own policy</h2>
            <p className="text-white/80 mb-4">
              Upload your policy and IndSure shows your exact {clause.term.toLowerCase()} and every other clause that matters, in plain language.
            </p>
            <Button asChild className="bg-[var(--color-green-primary)] hover:bg-[var(--color-green-secondary)] text-white">
              <Link href="/signup">Check my policy free <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>

          {/* Related deep dives */}
          {clause.relatedBlog && clause.relatedBlog.length > 0 && (
            <section className="mb-8">
              <h2 className="text-base font-semibold mb-2">Read the full guide</h2>
              <ul className="space-y-1">
                {clause.relatedBlog.map((b) => (
                  <li key={b.slug}>
                    <Link href={`/blog/${b.slug}`} className="text-[var(--color-green-primary)] hover:underline">
                      {b.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Related concepts */}
          {related.length > 0 && (
            <section className="border-t border-[var(--color-border-light)] pt-6">
              <h2 className="text-base font-semibold mb-3">Related concepts</h2>
              <div className="flex flex-wrap gap-2">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/learn/${r.slug}`}
                    className="inline-block px-3 py-1.5 rounded-full bg-white border border-[var(--color-border-light)] text-sm hover:border-[var(--color-green-secondary)] hover:text-[var(--color-green-primary)] transition-colors"
                  >
                    {r.term}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>
      <Footer />
    </div>
  );
}
