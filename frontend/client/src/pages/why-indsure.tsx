import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Database, Cpu, Share2, ShieldOff } from "lucide-react";

const pillars = [
    {
        icon: Database,
        title: "The Catalog",
        body: "We didn't scrape brochures. We hand-built a wording-level database of 63 health insurance plans across 10 insurers — every room-rent clause, co-pay clause, sub-limit, and waiting period, extracted from the actual policy documents insurers file, not their marketing copy. That takes months of work most competitors won't do.",
    },
    {
        icon: Cpu,
        title: "The Engine",
        body: "Reading one policy properly takes a trained human the better part of an hour. Our engine reads clause-by-clause, deterministically — the same policy produces the same audit every time, whether it's run by a lawyer or a first-time buyer. 50+ risk checks, in under a minute.",
    },
    {
        icon: Share2,
        title: "Distribution",
        body: "The best analysis in the world is useless if it never reaches the person deciding. We built for the channel that already reaches millions of Indian households: the insurance advisor. Compare, Calculator, and client tools — in agents' hands, with WhatsApp as the front door, not a CRM login.",
    },
    {
        icon: ShieldOff,
        title: "The Business Model",
        body: "We are not an IRDAI-registered broker or agent. We cannot earn a commission on what we recommend — even if we wanted to. That's not a tagline, it's a structural constraint most of this industry can't claim.",
    },
];

const stats = [
    { value: "63", label: "Plans indexed" },
    { value: "10", label: "Insurers covered" },
    { value: "50+", label: "Risk checks per audit" },
    { value: "0", label: "Commissions earned, ever" },
];

export default function WhyIndSure() {
    return (
        <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
            <Header />

            <main className="flex-grow pt-32 pb-20 px-6 w-full">

                {/* HERO SECTION */}
                <section className="max-w-4xl mx-auto text-center mb-20 animate-reveal">
                    <div className="inline-block py-1 px-3 border border-[var(--color-border-main)] rounded-full text-xs font-mono uppercase tracking-widest text-[var(--color-text-secondary)] mb-6 bg-white">
                        Why IndSure
                    </div>
                    <h1 className="text-5xl md:text-7xl font-serif mb-8 tracking-tight text-[var(--color-text-main)] leading-tight">
                        Insurance, <br />
                        <span className="italic text-[var(--color-green-primary)]">Decoded.</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-[var(--color-text-secondary)] font-light leading-relaxed max-w-2xl mx-auto">
                        Everyone promises "unbiased advice." Almost nobody can back it with the
                        data, the technology, and the business model to prove it. Here's ours.
                    </p>
                </section>

                {/* STATS STRIP */}
                <section className="max-w-5xl mx-auto mb-24 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                    {stats.map((s) => (
                        <div key={s.label} className="text-center">
                            <div className="text-4xl md:text-5xl font-serif text-[var(--color-green-primary)] mb-1">{s.value}</div>
                            <div className="text-xs md:text-sm uppercase tracking-widest text-[var(--color-text-secondary)]">{s.label}</div>
                        </div>
                    ))}
                </section>

                {/* PILLARS GRID */}
                <section className="max-w-6xl mx-auto mb-32 grid md:grid-cols-2 gap-8">
                    {pillars.map((p) => {
                        const Icon = p.icon;
                        return (
                            <div key={p.title} className="card-white p-8 md:p-10 hover:shadow-lg transition-all duration-500 group">
                                <div className="w-14 h-14 bg-[var(--color-cream-dark)] rounded-full flex items-center justify-center mb-6 group-hover:bg-[var(--color-green-primary)] transition-colors">
                                    <Icon className="w-6 h-6 text-[var(--color-text-main)] group-hover:text-white" />
                                </div>
                                <h3 className="text-2xl font-serif mb-4">{p.title}</h3>
                                <p className="text-[var(--color-text-secondary)] leading-relaxed">
                                    {p.body}
                                </p>
                            </div>
                        );
                    })}
                </section>

                {/* MANIFESTO / STORY */}
                <section className="max-w-4xl mx-auto mb-32">
                    <h2 className="text-4xl font-serif mb-6 text-[var(--color-text-main)] text-center">The "Fine Print" Problem</h2>
                    <div className="w-20 h-1 bg-[var(--color-green-primary)] mb-8 mx-auto"></div>
                    <div className="space-y-6 text-lg text-[var(--color-text-secondary)] font-light leading-relaxed text-center max-w-2xl mx-auto">
                        <p>
                            Every year, thousands of claims are rejected not because of fraud, but because of clauses buried in page 42 of a policy document — a room-rent cap, a co-pay, a waiting period nobody read out loud at the time of sale.
                        </p>
                        <p>
                            No human advisor can hold 10 insurers' worth of fine print in their head, consistently, for every customer, every time. A system built to do exactly that — and nothing else — can.
                        </p>
                        <p>
                            That's the bet IndSure is built on: codify the fine print once, apply it consistently, and never let a commission check the outcome.
                        </p>
                    </div>
                </section>

                {/* CTA */}
                <section className="bg-[var(--color-petrol-900)] text-white rounded-lg p-16 text-center max-w-5xl mx-auto shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <div className="absolute top-[-50%] left-[-20%] w-[500px] h-[500px] bg-[var(--color-green-primary)] rounded-full blur-[100px]"></div>
                    </div>

                    <div className="relative z-10">
                        <h2 className="text-3xl md:text-5xl font-serif mb-6">Experience the Difference</h2>
                        <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10 font-light">
                            Stop guessing. Start knowing. Upload your policy or compare plans with our engine today.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button asChild size="lg" className="bg-[var(--color-green-primary)] hover:bg-[var(--color-green-secondary)] text-white h-14 px-8 text-lg rounded-full">
                                <Link href="/policychecker">Check My Policy</Link>
                            </Button>
                            <Button asChild variant="outline" size="lg" className="bg-transparent border-white text-white hover:bg-white hover:text-[var(--color-petrol-900)] h-14 px-8 text-lg rounded-full">
                                <Link href="/compare">Compare Plans</Link>
                            </Button>
                        </div>
                    </div>
                </section>

            </main>

            <Footer />
        </div>
    );
}
