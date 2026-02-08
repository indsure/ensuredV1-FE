
import { motion, AnimatePresence } from "framer-motion";
import {
    Shield, Lock, Clock, Activity, AlertTriangle,
    ChevronDown, ChevronUp, Check, ArrowRight, FileText,
    TrendingUp, Search, Zap
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LandingProps {
    onStart: () => void;
}

export function CalculatorLanding({ onStart }: LandingProps) {
    const [isLogicOpen, setIsLogicOpen] = useState(false);

    // Animation variants
    const fadeIn = {
        hidden: { opacity: 0, y: 10 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as any }
        })
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-20 py-12 md:py-20">

            {/* 1. HERO SECTION */}
            <motion.div
                initial="hidden"
                animate="visible"
                className="text-center space-y-8"
            >
                <motion.div custom={0} variants={fadeIn} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-teal-50)] border border-[var(--color-teal-100)] text-[var(--color-teal-700)] text-xs font-mono tracking-widest uppercase">
                    <Activity className="w-3 h-3" /> IndSure Intelligence Engine
                </motion.div>

                <motion.h1 custom={1} variants={fadeIn} className="text-5xl md:text-7xl font-serif text-[var(--color-navy-900)] leading-[1.1] tracking-tight">
                    Exact coverage.<br />
                    <span className="italic text-[var(--color-teal-600)]">Zero sales.</span>
                </motion.h1>

                <motion.p custom={2} variants={fadeIn} className="text-xl text-[var(--color-text-secondary)] max-w-xl mx-auto leading-relaxed">
                    I calculate your exact health insurance needs using medical inflation, city-level costs, and lifestyle risk.
                </motion.p>

                <motion.div custom={3} variants={fadeIn} className="pt-4">
                    <Button
                        size="lg"
                        onClick={onStart}
                        className="bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-700)] text-white text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-[var(--color-teal-200)] transition-all duration-300 group"
                    >
                        Start Analysis <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </motion.div>
            </motion.div>


            {/* 2. TRUST / FRICTION KILLER */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.8 }}
                className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-12 text-[var(--color-text-muted)] border-t border-b border-[var(--color-border-light)] py-8"
            >
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="w-4 h-4 text-[var(--color-teal-600)]" /> Takes 2–3 minutes
                </div>
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Lock className="w-4 h-4 text-[var(--color-teal-600)]" /> No policy upload
                </div>
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Shield className="w-4 h-4 text-[var(--color-teal-600)]" /> No medical history required
                </div>
            </motion.div>


            {/* 3. OUTCOME PREVIEW */}
            <div className="grid md:grid-cols-3 gap-6">
                {[
                    { icon: TrendingUp, title: "Ideal Cover Range", desc: "Based on real hospital costs in your specific city." },
                    { icon: Search, title: "Rider Forensics", desc: "Which add-ons actually matter vs marketing fluff." },
                    { icon: Zap, title: "Risk Assessment", desc: "Whether you recall under-insured risks or over-paying." }
                ].map((item, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.15, duration: 0.5 }}
                        className="bg-white p-6 rounded-xl border border-[var(--color-border-light)] shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="w-10 h-10 bg-[var(--color-cream-dark)] rounded-full flex items-center justify-center mb-4 text-[var(--color-navy-900)]">
                            <item.icon className="w-5 h-5" />
                        </div>
                        <h3 className="font-serif text-lg text-[var(--color-navy-900)] mb-2">{item.title}</h3>
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.desc}</p>
                    </motion.div>
                ))}
            </div>


            {/* 4. LOGIC TRANSPARENCY (Expandable) */}
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => setIsLogicOpen(!isLogicOpen)}
                    className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-[var(--color-cream-dark)] transition-colors group"
                >
                    <span className="font-serif text-lg text-[var(--color-navy-900)] group-hover:text-[var(--color-teal-700)] transition-colors">
                        How IndSure calculates your coverage
                    </span>
                    {isLogicOpen ? <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" /> : <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />}
                </button>

                <AnimatePresence>
                    {isLogicOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-6 pb-2 space-y-6 px-4 border-l-2 border-[var(--color-teal-100)] ml-4">
                                {[
                                    { title: "Step 1: City Anchor", desc: "We start with realistic private hospital costs for your specific city zone (A/B/C)." },
                                    { title: "Step 2: Inflation Planning", desc: "Modeling 14% medical inflation to ensure your cover survives 10 years." },
                                    { title: "Step 3: Family Stacking", desc: "Risks don't add linearly. We calculate overlapping probability for families." },
                                    { title: "Step 4: Structure Optimization", desc: "Balancing Base vs Super Top-up to save 40-60% premium costs." }
                                ].map((step, i) => (
                                    <div key={i} className="relative">
                                        <div className="absolute -left-[25px] top-1 w-2 h-2 rounded-full bg-[var(--color-teal-400)] ring-4 ring-white" />
                                        <h4 className="font-bold text-sm text-[var(--color-navy-900)] mb-1">{step.title}</h4>
                                        <p className="text-sm text-[var(--color-text-secondary)]">{step.desc}</p>
                                    </div>
                                ))}

                                <p className="text-xs text-[var(--color-text-muted)] pt-4 border-t border-[var(--color-border-light)] mt-4">
                                    * IndSure does not sell insurance or earn commissions. This logic is purely mathematical.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>


            {/* 5. COMMON MISTAKES */}
            <div className="bg-[var(--color-navy-900)] text-white rounded-3xl p-8 md:p-12">
                <h3 className="font-serif text-2xl mb-8 flex items-center gap-3">
                    <AlertTriangle className="text-[var(--color-teal-400)]" /> Common Mistakes
                </h3>
                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        { quote: "₹5L is enough, my office covers me.", risk: "Employer cover is temporary. You lose it when you switch jobs or retire." },
                        { quote: "I'll buy a higher base cover.", risk: "Wrong. A Base + Super Top-up structure is 50% cheaper for the same coverage." },
                        { quote: "Riders are just marketing.", risk: "Some (like Room Rent Waiver) decide if your claim is paid 100% or 50%." }
                    ].map((m, i) => (
                        <div key={i} className="space-y-3">
                            <p className="font-serif italic text-[var(--color-teal-200)] opacity-80">"{m.quote}"</p>
                            <p className="text-sm text-[var(--color-white-muted)] leading-relaxed">{m.risk}</p>
                        </div>
                    ))}
                </div>
            </div>


            {/* 6. JOURNEY MAP */}
            <div className="text-center pt-8">
                <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-6">Your Journey</p>
                <div className="flex justify-center items-center gap-4 text-sm font-medium text-[var(--color-navy-900)]">
                    <span className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-[var(--color-teal-100)] text-[var(--color-teal-800)] flex items-center justify-center text-xs">1</span> Inputs</span>
                    <div className="w-12 h-[1px] bg-[var(--color-border-medium)]" />
                    <span className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-white border border-[var(--color-border-medium)] flex items-center justify-center text-xs text-[var(--color-text-muted)]">2</span> Logic</span>
                    <div className="w-12 h-[1px] bg-[var(--color-border-medium)]" />
                    <span className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-white border border-[var(--color-border-medium)] flex items-center justify-center text-xs text-[var(--color-text-muted)]">3</span> Plan</span>
                </div>
            </div>

        </div>
    );
}
