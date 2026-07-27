import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { PolicyCheckerLanding } from "@/components/PolicyCheckerLanding";

// Marketing / value page for the consumer policy analyzer. Analysis itself now
// lives behind a free account (see /signup → /app). This page explains the
// value and funnels visitors into signup; sample reports remain viewable
// without an account (mock data, no analysis is run).
export default function PolicyChecker() {
  useSEO({
    title: "Health Insurance Policy Checker: Room Rent, Co-pay & Gaps | IndSure",
    description: "Upload your health or mediclaim policy PDF and see your room-rent cap, co-pay, sub-limits, waiting periods, and coverage gaps explained in plain language. Free and private, no sales calls.",
    keywords: "health insurance policy checker, mediclaim analyzer India, room rent cap, co-pay, sub-limits, waiting period, health insurance gaps",
    canonical: "/policychecker",
  });

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] flex flex-col font-sans text-[var(--color-navy-900)]">
      <Header />

      <main className="flex-grow pt-24 pb-20 px-6 max-w-7xl mx-auto w-full">
        <PolicyCheckerLanding />
      </main>

      <Footer />
    </div>
  );
}
