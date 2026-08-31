import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Upload,
  ScanSearch,
  ShieldCheck,
  FileCheck2,
  Lock,
  Ban,
  Clock,
  ArrowRight,
} from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Upload,
    title: "Upload",
    time: "~30 seconds",
    summary: "Drag in your policy PDF — or up to 4, if you want them compared side by side.",
    details: [
      "Works with scanned copies and photos, not just clean PDFs",
      "A free account, no card, to see your result",
      "Encrypted in transit (HTTPS/TLS) the moment it leaves your device",
    ],
  },
  {
    step: "02",
    icon: ScanSearch,
    title: "Decipher",
    time: "~45 seconds",
    summary: "Our engine reads every clause the way a claims examiner would — not the way a brochure summarizes it.",
    details: [
      "Room rent limits, co-pay percentages, sub-limits, and restoration benefits",
      "Waiting periods for pre-existing conditions, maternity, and specific surgeries",
      "Exclusions buried in annexures most people never open",
    ],
  },
  {
    step: "03",
    icon: ShieldCheck,
    title: "Audit",
    time: "~15 seconds",
    summary: "Every extracted clause is checked against known claim-rejection patterns and, if you uploaded more than one policy, against each other.",
    details: [
      "50+ individual risk checks per policy",
      "Flags redundant coverage across policies (you're paying twice for the same thing)",
      "Flags silent gaps — cover you assumed you had, but don't",
    ],
  },
  {
    step: "04",
    icon: FileCheck2,
    title: "Report",
    time: "Ready instantly",
    summary: "A single Insurance Health Score, plus specific, actionable next steps — not a wall of legal text.",
    details: [
      "\"Port to a policy with zero room-rent capping to avoid proportionate deduction\" — that level of specific",
      "Shareable report link, or a PDF you can hand to your family",
      "Nothing to sign, nothing to buy",
    ],
  },
];

const faqs = [
  {
    q: "How long does this actually take?",
    a: "Under 2 minutes end to end for a single policy. Comparing up to 4 policies takes a little longer, but you're still looking at minutes, not hours of manual reading.",
  },
  {
    q: "Is my data safe?",
    a: "Your document is encrypted in transit and stored so you can open it again from your portfolio. We never share it with insurers, agents, or anyone else unless you ask us to, and you can delete it whenever you want.",
  },
  {
    q: "Do you sell insurance or earn commissions on my results?",
    a: "No. IndSure is not an IRDAI-registered broker or agent. We have no policy to sell you and no commission riding on what our audit finds — that's the whole point.",
  },
  {
    q: "What if I don't have a soft copy of my policy?",
    a: "A clear photo of the printed policy document works fine. If the scan is genuinely unreadable, we'll tell you instead of guessing.",
  },
  {
    q: "Can I compare policies from different insurers?",
    a: "Yes — upload up to 4 policies (yours or ones you're considering) and we align them on the same dimensions: coverage limit, room rent, co-pay, exclusions, and waiting periods.",
  },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      <main className="flex-grow pt-32 pb-20 px-6 w-full">

        {/* HERO */}
        <section className="max-w-4xl mx-auto text-center mb-24 animate-reveal">
          <div className="inline-block py-1 px-3 border border-[var(--color-border-main)] rounded-full text-xs font-mono uppercase tracking-widest text-[var(--color-text-secondary)] mb-6 bg-white">
            How It Works
          </div>
          <h1 className="text-5xl md:text-7xl font-serif mb-8 tracking-tight text-[var(--color-text-main)] leading-tight">
            From chaos <br />
            to <span className="italic text-[var(--color-green-primary)]">clarity.</span>
          </h1>
          <p className="text-xl md:text-2xl text-[var(--color-text-secondary)] font-light leading-relaxed max-w-2xl mx-auto">
            No forms. No sales calls. Upload your policy and get a forensic-grade
            audit before your coffee gets cold.
          </p>
        </section>

        {/* STEPS */}
        <section className="max-w-5xl mx-auto mb-32 space-y-6">
          {steps.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="card-white p-8 md:p-10 flex flex-col md:flex-row gap-8 md:items-start"
              >
                <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-3 md:w-40 shrink-0">
                  <div className="w-14 h-14 bg-[var(--color-cream-dark)] rounded-full flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[var(--color-green-primary)]" />
                  </div>
                  <div>
                    <span className="block text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                      Step {item.step}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] mt-1">
                      <Clock className="w-3.5 h-3.5" /> {item.time}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="text-2xl md:text-3xl font-serif mb-3">{item.title}</h3>
                  <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed mb-5">
                    {item.summary}
                  </p>
                  <ul className="space-y-2">
                    {item.details.map((d, j) => (
                      <li key={j} className="flex gap-3 items-start text-sm text-[var(--color-text-secondary)]">
                        <span className="text-[var(--color-green-primary)] font-bold mt-0.5">✓</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </section>

        {/* TRUST BLOCK */}
        <section className="max-w-5xl mx-auto mb-32 grid md:grid-cols-2 gap-6">
          <div className="card-white p-8 flex gap-5 items-start">
            <div className="w-12 h-12 bg-[var(--color-cream-dark)] rounded-full flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-[var(--color-green-primary)]" />
            </div>
            <div>
              <h3 className="text-lg font-serif mb-2">Your data, yours to delete</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Documents are encrypted in transit and processed securely. We keep your file so you can open it again later, and you can delete any policy and its file whenever you want. We are not building a database to sell.
              </p>
            </div>
          </div>
          <div className="card-white p-8 flex gap-5 items-start">
            <div className="w-12 h-12 bg-[var(--color-cream-dark)] rounded-full flex items-center justify-center shrink-0">
              <Ban className="w-5 h-5 text-[var(--color-green-primary)]" />
            </div>
            <div>
              <h3 className="text-lg font-serif mb-2">No commission, no upsell</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                We're not an IRDAI-registered broker or agent. There's no policy we're trying to sell you at the end of this — the audit is the product.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto mb-32">
          <h2 className="text-3xl md:text-4xl font-serif mb-10 text-center">Questions people actually ask</h2>
          <div className="space-y-6">
            {faqs.map((f, i) => (
              <div key={i} className="border-b border-[var(--color-border-light)] pb-6">
                <h3 className="text-lg font-semibold mb-2 text-[var(--color-text-main)]">{f.q}</h3>
                <p className="text-[var(--color-text-secondary)] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[var(--color-cream-dark)] border border-[var(--color-border-light)] text-[var(--color-text-main)] rounded-lg p-16 text-center max-w-5xl mx-auto shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.07] pointer-events-none">
            <div className="absolute top-[-50%] left-[-20%] w-[500px] h-[500px] bg-[var(--color-green-primary)] rounded-full blur-[100px]"></div>
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-serif mb-6">Ready to see where you actually stand?</h2>
            <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-10 font-light">
              Two minutes. No signup. Just clarity.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-[var(--color-green-primary)] hover:bg-[var(--color-green-secondary)] text-white h-14 px-8 text-lg rounded-full">
                <Link href="/policychecker">Check My Coverage</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-transparent border-[var(--color-petrol-900)] text-[var(--color-petrol-900)] hover:bg-[var(--color-petrol-900)] hover:text-white h-14 px-8 text-lg rounded-full">
                <Link href="/compare">Compare Plans <ArrowRight className="w-4 h-4 ml-1" /></Link>
              </Button>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
