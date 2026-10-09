import { useRoute, Link } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText } from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { SchemaMarkup, createFAQSchema } from "@/components/SEO";
import { insurancePageBySlug, type InsurancePageSection } from "@/data/insurance-pages";
import { CLAUSE_LIBRARY } from "@/data/clause-library";

const SITE = "https://indsure.in";

function Section({ s }: { s: InsurancePageSection }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-serif font-bold mb-3">{s.h2}</h2>
      {s.body?.map((p, i) => (
        <p key={i} className="text-[var(--color-text-secondary)] leading-relaxed mb-3">{p}</p>
      ))}
      {s.bullets && (
        <ul className="space-y-2 mb-3">
          {s.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-[var(--color-text-secondary)] leading-relaxed">
              <span className="text-[var(--color-green-primary)] mt-1">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      {s.table && (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border-light)] bg-white">
          <table className="w-full text-left text-base">
            <thead className="bg-[var(--color-cream-dark)]">
              <tr>
                {s.table.head.map((h, i) => (
                  <th key={i} scope="col" className="px-4 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.table.rows.map((r, i) => (
                <tr key={i} className="border-t border-[var(--color-border-light)] align-top">
                  {r.map((c, j) =>
                    j === 0 ? (
                      <th key={j} scope="row" className="px-4 py-3 font-semibold">{c}</th>
                    ) : (
                      <td key={j} className="px-4 py-3 text-[var(--color-text-secondary)]">{c}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function InsurancePageDetail() {
  const [, params] = useRoute("/insurance/:slug");
  const page = insurancePageBySlug(params?.slug || "");

  useSEO({
    title: page ? page.title : "Health Insurance Plans | IndSure",
    description: page?.description ?? "",
    canonical: page ? `/insurance/${page.slug}` : "/insurance",
  });

  if (!page) {
    return (
      <div className="min-h-screen bg-[var(--color-cream-main)] flex flex-col">
        <Header />
        <Breadcrumbs items={[{ label: "Insurance plans", href: "/insurance" }, { label: "Not found" }]} />
        <main className="flex-1 max-w-3xl mx-auto px-6 pt-32 pb-12 text-center">
          <h1 className="text-3xl font-bold font-serif mb-4">We could not find that page</h1>
          <Button asChild className="bg-[var(--color-green-primary)] text-white">
            <Link href="/insurance">See all plans</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const canonical = `${SITE}/insurance/${page.slug}`;
  const breadcrumbSchema = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Insurance plans", item: `${SITE}/insurance` },
      { "@type": "ListItem", position: 3, name: page.h1, item: canonical },
    ],
  };
  const learn = page.learn
    .map((s) => CLAUSE_LIBRARY.find((c) => c.slug === s))
    .filter(Boolean) as typeof CLAUSE_LIBRARY;
  const checked = new Date(page.checkedOn).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <SchemaMarkup type="BreadcrumbList" data={breadcrumbSchema} />
      <SchemaMarkup type="FAQPage" data={createFAQSchema(page.faqs)} />
      <Header />
      <Breadcrumbs items={[{ label: "Insurance plans", href: "/insurance" }, { label: page.h1 }]} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 pt-24 sm:pt-28 pb-16">
        <article>
          <p className="text-sm uppercase tracking-widest text-[var(--color-green-primary)] font-semibold mb-3">
            {page.insurers.join(" and ")}
          </p>
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">{page.h1}</h1>

          <div className="bg-white rounded-xl border border-[var(--color-border-light)] border-l-4 border-l-[var(--color-green-primary)] p-5 mb-8">
            <p className="text-lg leading-relaxed">{page.answer}</p>
          </div>

          {page.sections.map((s) => (
            <Section key={s.h2} s={s} />
          ))}

          <section className="mb-8">
            <h2 className="text-xl font-serif font-bold mb-4">Frequently asked questions</h2>
            <div className="space-y-4">
              {page.faqs.map((f) => (
                <div key={f.question}>
                  <h3 className="text-lg font-sans font-semibold mb-1">{f.question}</h3>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="bg-[var(--color-petrol-900)] text-white rounded-xl p-6 my-10 text-center">
            <h2 className="text-xl font-serif font-bold mb-2">Compare these plans clause by clause</h2>
            <p className="text-white/80 mb-4">
              Put any of these plans next to the one you have, or another you are thinking of buying.
            </p>
            <Button asChild className="bg-[var(--color-green-primary)] hover:bg-[var(--color-green-secondary)] text-white">
              <Link href="/compare">Compare plans <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>

          <section className="mb-8 rounded-xl bg-[var(--color-cream-dark)] p-5">
            <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--color-green-primary)]" /> Where this comes from
            </h2>
            <ul className="space-y-1 text-[var(--color-text-secondary)]">
              {page.sources.map((s) => (
                <li key={s.uin}>
                  {s.document}, UIN {s.uin}. Clauses {s.clauses}.
                </li>
              ))}
            </ul>
            <p className="text-[var(--color-text-secondary)] mt-2">
              Checked against the wording on {checked}. Insurers update their wordings, so always read the one in your
              policy schedule before you buy.
            </p>
          </section>

          {learn.length > 0 && (
            <section className="border-t border-[var(--color-border-light)] pt-6">
              <h2 className="text-base font-semibold mb-3">Terms on this page, explained</h2>
              <div className="flex flex-wrap gap-2">
                {learn.map((r) => (
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
