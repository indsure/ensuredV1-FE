import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { PolicyCheckerLanding } from "@/components/PolicyCheckerLanding";
import { PolicyUploadGate } from "@/components/PolicyUploadGate";
import { Section, SectionHeading } from "@/components/marketing";
import { Reveal } from "@/components/motion";

// Value page for the consumer policy analyzer, with the uploader on it.
//
// Analysis still happens only after signup, in the metered path; nothing is
// read here. Sample reports remain viewable without an account (mock data).
//
// The uploader used to sit above everything, so the first thing a cold visitor
// met was a file picker for a decision they had not made yet. It now closes the
// page, after the decode has shown them what they get for it.
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

      <main className="flex-grow pt-32">
        <PolicyCheckerLanding />

        {/* ─────────── UPLOAD ─────────── */}
        <Section surface="ink" className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-grid-faint-dark mask-fade-edges" />
            <div
              className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/3 rounded-full blur-3xl"
              style={{ background: "radial-gradient(ellipse, rgba(45,212,191,0.22), transparent 70%)" }}
            />
          </div>

          <div className="container-editorial relative flex flex-col items-center gap-10">
            <SectionHeading
              title="Now do it with yours"
              sub="Pick your policy PDF. You will be asked to create a free account before the result is shown, so it has somewhere to live."
              align="center"
              onInk
            />

            <Reveal className="w-full max-w-2xl">
              <div className="rounded-2xl bg-white p-2 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.6)]">
                <PolicyUploadGate />
              </div>
            </Reveal>
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
