import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/use-seo";
import { PolicyUploadGate } from "@/components/PolicyUploadGate";
import { FileText, Search, Bell, ShieldCheck, Lock, IndianRupee } from "lucide-react";

// Campaign landing page for the "review your insurance, make a portfolio
// today" reel. Deliberately narrow:
//
//  - No Header and no MobileNav (both return null on /start). A cold visitor
//    arriving from a reel has one job here, and site nav is five ways to not
//    do it. Same reasoning as the /a/<slug> advisor pages.
//  - One action, repeated: the uploader. The closing button scrolls back to it
//    rather than jumping to /signup — the account is asked for after there is a
//    file waiting, which is the whole point of the flow.
//  - The reel's own words are the h1, so the page reads as the payoff to the
//    thing they just watched rather than a general homepage.
//
// Prerendered (see scripts/prerender.mjs) because this traffic arrives on
// mobile data and an empty #root costs more than the page is worth. Kept out
// of the sitemap on purpose: it duplicates the homepage's terms and should
// not compete with it.

const steps = [
  {
    icon: FileText,
    title: "Add your policy",
    body: "Upload the PDF your insurer sent you. Health, term life or vehicle.",
  },
  {
    icon: Search,
    title: "We read the wording",
    body: "Room rent limits, co-pay, sub-limits, waiting periods — explained in plain language, not insurance language.",
  },
  {
    icon: Bell,
    title: "Your portfolio watches it",
    body: "Everything in one place, with a reminder 30 days before anything expires.",
  },
];

const trust = [
  { icon: IndianRupee, text: "We earn no commission from any insurer" },
  { icon: Lock, text: "Your documents stay private, and you can delete them anytime" },
  { icon: ShieldCheck, text: "Free forever for one policy of each type. No card needed" },
];

export default function Start() {
  useSEO({
    title: "Review Your Insurance. Make Your Portfolio Today | IndSure",
    description:
      "Upload your health, term life or vehicle policy and see what it actually covers in plain language. Keep every policy in one portfolio with renewal reminders. Free forever for one policy of each type, no card needed.",
  });

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <main className="flex-grow px-6 py-10 md:py-16 w-full">

        {/* LOGO — not a link. The only way off this page is the CTA. */}
        <div className="max-w-2xl mx-auto mb-10 md:mb-14">
          <img src="/logo.png" alt="IndSure" className="h-9 w-auto" />
        </div>

        {/* HERO — the reel's own words */}
        <section className="max-w-2xl mx-auto mb-10">
          <h1 className="text-3xl md:text-5xl font-serif tracking-tight leading-tight mb-5">
            Review your insurance.{" "}
            <span className="italic text-[var(--color-green-primary)]">
              Make your portfolio today.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-secondary)] font-light leading-relaxed">
            Most people only find out what their policy does not cover on the day
            they claim. Take a few minutes now instead.
          </p>
        </section>

        {/* PRIMARY ACTION — the uploader itself, above the fold on a phone.
            This used to be a button to /signup, which asked someone who had
            just watched a reel to create an account before seeing anything.
            Now the file comes first and the account comes after. */}
        <section id="upload" className="max-w-2xl mx-auto mb-12">
          <PolicyUploadGate compact />
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-2xl mx-auto mb-12">
          <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-text-secondary)] mb-6">
            How it works
          </h2>
          <ol className="space-y-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-[var(--color-green-primary)]/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[var(--color-green-primary)]" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">
                      <span className="text-[var(--color-text-muted)] font-mono text-sm mr-2">
                        {i + 1}
                      </span>
                      {step.title}
                    </h3>
                    <p className="text-[var(--color-text-secondary)] leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* TRUST */}
        <section className="max-w-2xl mx-auto mb-12">
          <div className="card-white p-6 space-y-4">
            {trust.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.text} className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-[var(--color-green-primary)] shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-[var(--color-text-main)]">{t.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CLOSING CTA */}
        <section className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-serif mb-4">
            Start with the policy you already have
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            One policy of each type is free forever — health, term life and vehicle.
          </p>
          {/* Back to the uploader rather than off to /signup: the account is
              worth asking for once they have a file waiting, not before. */}
          <Button asChild size="lg" className="w-full md:w-auto text-base py-6 px-8">
            <a href="#upload">Check my policy — free</a>
          </Button>
        </section>

        {/* MINIMAL LEGAL FOOTER — no site nav */}
        <footer className="max-w-2xl mx-auto mt-16 pt-6 border-t border-[var(--color-border-light)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            IndSure is not an IRDAI-registered broker or agent and does not sell
            insurance.{" "}
            <a href="/privacy-policy" className="underline underline-offset-2 hover:text-[var(--color-text-secondary)]">
              Privacy Policy
            </a>{" "}
            ·{" "}
            <a href="/terms" className="underline underline-offset-2 hover:text-[var(--color-text-secondary)]">
              Terms
            </a>
          </p>
        </footer>

      </main>
    </div>
  );
}
