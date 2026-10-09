import { Link } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useSEO } from "@/hooks/use-seo";
import { INSURANCE_PAGES, INSURANCE_HUB } from "@/data/insurance-pages";

export default function InsuranceHub() {
  useSEO({ title: INSURANCE_HUB.title, description: INSURANCE_HUB.description, canonical: "/insurance" });

  // Grouped by insurer so the list stays readable as it grows. A comparison
  // appears under each insurer it covers.
  const insurers = Array.from(new Set(INSURANCE_PAGES.flatMap((p) => p.insurers))).sort();

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />
      <Breadcrumbs items={[{ label: "Insurance plans" }]} />
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 pt-24 sm:pt-28 pb-16">
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">Health insurance plans, read from the policy wording</h1>
        <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed mb-8">
          Each page explains one plan, or two plans side by side, using only what the insurer's own policy wording says:
          room rent, waiting periods, bonus, refill and what is not covered.
        </p>
        {insurers.map((name) => (
          <section key={name} className="mb-8">
            <h2 className="text-xl font-serif font-bold mb-3">{name}</h2>
            <ul className="space-y-2">
              {INSURANCE_PAGES.filter((p) => p.insurers.includes(name)).map((p) => (
                <li key={p.slug}>
                  <Link href={`/insurance/${p.slug}`} className="text-[var(--color-green-primary)] hover:underline font-medium">
                    {p.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
