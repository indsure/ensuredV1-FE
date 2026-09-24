import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import CoverCalculator from "@/components/calculator/CoverCalculator";
import { useSEO } from "@/hooks/use-seo";
import { seoFor } from "@/data/seo-pages";

/**
 * Consumer-facing calculator page. The wizard itself lives in
 * components/calculator/CoverCalculator.tsx and is shared with the agent
 * portal (/agent/calculator); this page just provides the public-site chrome.
 */
export default function CalculatorPage() {
  useSEO(seoFor("/calculator"));
  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans flex flex-col">
      <Header />
      <main className="flex-grow pt-24">
        <CoverCalculator />
      </main>
      <Footer />
    </div>
  );
}
