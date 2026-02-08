import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, ShieldCheck, TrendingUp, Users, Scale, Search } from "lucide-react";

export default function WhyIndSure() {
    return (
        <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
            <Header />

            <main className="flex-grow pt-40 pb-20 px-6 w-full">

                {/* HERO SECTION */}
                <section className="max-w-4xl mx-auto text-center mb-24 animate-reveal">
                    <div className="inline-block py-1 px-3 border border-[var(--color-border-main)] rounded-full text-xs font-mono uppercase tracking-widest text-[var(--color-text-secondary)] mb-6 bg-white">
                        Our Philosophy
                    </div>
                    <h1 className="text-5xl md:text-7xl font-serif mb-8 tracking-tight text-[var(--color-text-main)] leading-tight">
                        Insurance, <br />
                        <span className="italic text-[var(--color-green-primary)]">Decoded.</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-[var(--color-text-secondary)] font-light leading-relaxed max-w-2xl mx-auto">
                        We built IndSure because the insurance industry is designed to confuse you.
                        We are here to give you the clarity they won't.
                    </p>
                </section>

                {/* PILLARS GRID */}
                <section className="max-w-6xl mx-auto mb-32 grid md:grid-cols-3 gap-8">

                    <div className="card-white p-8 md:p-10 hover:shadow-lg transition-all duration-500 group">
                        <div className="w-14 h-14 bg-[var(--color-cream-dark)] rounded-full flex items-center justify-center mb-6 group-hover:bg-[var(--color-green-primary)] transition-colors">
                            <Scale className="w-6 h-6 text-[var(--color-text-main)] group-hover:text-white" />
                        </div>
                        <h3 className="text-2xl font-serif mb-4">Unbiased analysis</h3>
                        <p className="text-[var(--color-text-secondary)] leading-relaxed">
                            We don't sell data. We don't push commissions. Our analysis engine looks at the fine print that agents gloss over, giving you the raw, unvarnished truth.
                        </p>
                    </div>

                    <div className="card-white p-8 md:p-10 hover:shadow-lg transition-all duration-500 group relative overflow-hidden">
                        {/* Decorative gradient for the middle card */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--color-green-primary)] to-[var(--color-gold-500)]"></div>
                        <div className="w-14 h-14 bg-[var(--color-cream-dark)] rounded-full flex items-center justify-center mb-6 group-hover:bg-[var(--color-green-primary)] transition-colors">
                            <Search className="w-6 h-6 text-[var(--color-text-main)] group-hover:text-white" />
                        </div>
                        <h3 className="text-2xl font-serif mb-4">Deep Logic</h3>
                        <p className="text-[var(--color-text-secondary)] leading-relaxed">
                            Insurance isn't just about premiums. It's about Room Rent Limits, Co-pay clauses, and Restoration benefits. We calculate the <i>real</i> value of a policy.
                        </p>
                    </div>

                    <div className="card-white p-8 md:p-10 hover:shadow-lg transition-all duration-500 group">
                        <div className="w-14 h-14 bg-[var(--color-cream-dark)] rounded-full flex items-center justify-center mb-6 group-hover:bg-[var(--color-green-primary)] transition-colors">
                            <Users className="w-6 h-6 text-[var(--color-text-main)] group-hover:text-white" />
                        </div>
                        <h3 className="text-2xl font-serif mb-4">You-First</h3>
                        <p className="text-[var(--color-text-secondary)] leading-relaxed">
                            Designed for the modern Indian family. Whether you are in a Tier 1 metro or a Tier 3 city, our algorithms adapt to your specific medical landscape.
                        </p>
                    </div>

                </section>

                {/* MANIFESTO / STORY */}
                <section className="max-w-4xl mx-auto mb-32 flex flex-col md:flex-row gap-12 items-center">
                    <div className="flex-1">
                        <h2 className="text-4xl font-serif mb-6 text-[var(--color-text-main)]">The "Fine Print" Problem</h2>
                        <div className="w-20 h-1 bg-[var(--color-green-primary)] mb-8"></div>
                        <div className="space-y-6 text-lg text-[var(--color-text-secondary)] font-light leading-relaxed">
                            <p>
                                Every year, millions of claims are rejected not because of fraud, but because of "hidden clauses" buried in page 42 of a policy document.
                            </p>
                            <p>
                                We realized that no human can keep up with the changing landscape of 50+ insurers and 200+ products. But an AI can.
                            </p>
                            <p>
                                IndSure is the result of thousands of hours of codifying insurance logic into a system that works for <strong>you</strong>, not the insurer.
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 relative">
                        <div className="aspect-square bg-[var(--color-cream-dark)] rounded-full border border-[var(--color-border-main)] flex items-center justify-center p-12 relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop')] opacity-10 bg-cover bg-center mix-blend-multiply"></div>
                            <div className="relative z-10 text-center">
                                <span className="block text-6xl font-serif text-[var(--color-green-primary)] mb-2">100%</span>
                                <span className="text-sm uppercase tracking-widest text-[var(--color-text-secondary)]">Unbiased</span>
                            </div>
                        </div>
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
