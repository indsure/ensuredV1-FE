import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { PolicyCheckerLanding } from "@/components/PolicyCheckerLanding";
import { PolicyUploadGate } from "@/components/PolicyUploadGate";

// Value page for the consumer policy analyzer, now with the uploader on it.
//
// It used to be explanation only, funnelling to /signup — so a visitor had to
// create an account before seeing anything at all. The uploader sits above the
// explanation instead: choose a file, then sign up to see the result. Analysis
// still happens only after signup, in the metered path; nothing is read here.
// Sample reports remain viewable without an account (mock data, no analysis).
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
        <div className="max-w-2xl mx-auto mb-14">
          <PolicyUploadGate />
        </div>
        <PolicyCheckerLanding />
      </main>

      <Footer />
    </div>
  );
}
