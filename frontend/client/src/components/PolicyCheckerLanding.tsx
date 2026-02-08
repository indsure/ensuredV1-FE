
import { motion } from "framer-motion";
import {
    Shield, Lock, Clock, FileText, AlertCircle,
    CheckCircle2, Search, Zap, AlertTriangle, FileUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface PolicyCheckerLandingProps {
    getRootProps: any;
    getInputProps: any;
    isDragActive: boolean;
    uploading: boolean;
    error: string | null;
}

export function PolicyCheckerLanding({
    getRootProps,
    getInputProps,
    isDragActive,
    uploading,
    error
}: PolicyCheckerLandingProps) {

    const fadeIn = {
        hidden: { opacity: 0, y: 10 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as any }
        })
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-24">

            {/* 1. HERO & UPLOAD SECTION */}
            <div className="grid lg:grid-cols-2 gap-16 items-start">

                {/* Left: Intelligence Copy */}
                <motion.div
                    initial="hidden"
                    animate="visible"
                    className="space-y-8 pt-4"
                >
                    <motion.div custom={0} variants={fadeIn}>
                        <span className="inline-block py-1 px-3 border border-[var(--color-teal-200)] bg-[var(--color-teal-50)] rounded-full text-xs font-mono uppercase tracking-widest text-[var(--color-teal-700)]">
                            Policy Decoder
                        </span>
                    </motion.div>

                    <motion.h1 custom={1} variants={fadeIn} className="text-5xl md:text-6xl font-serif leading-[1.1] text-[var(--color-navy-900)]">
                        The fine print, <br /> <span className="italic text-[var(--color-teal-600)]">translated.</span>
                    </motion.h1>

                    <motion.div custom={2} variants={fadeIn} className="space-y-6">
                        <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed max-w-lg">
                            Upload your health insurance policy. Our engine audits every clause, exclusion, and rider to tell you whether you are correctly insured — or exposed.
                        </p>
                        <p className="text-sm text-[var(--color-text-muted)] opacity-70 font-mono">
                            Built for modern Indian policyholders. <br /> Independent. Product-agnostic.
                        </p>
                    </motion.div>

                    {/* 3. TRUST / PRIVACY GUARDRAILS (Mobile only here, desktop below upload) */}
                    <motion.div custom={3} variants={fadeIn} className="lg:hidden pt-4 border-t border-[var(--color-border-medium)]">
                        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                            <Shield className="w-4 h-4 text-[var(--color-teal-600)]" />
                            We don’t store, sell, or reuse your policy.
                        </div>
                    </motion.div>
                </motion.div>


                {/* Right: Upload Zone */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="relative"
                >
                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 p-4 rounded flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-red-700">Upload Error</p>
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        </div>
                    )}

                    <div
                        {...getRootProps()}
                        className={cn(
                            "group relative bg-white border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer min-h-[400px] flex flex-col items-center justify-center overflow-hidden shadow-sm",
                            isDragActive
                                ? "border-[var(--color-teal-600)] bg-[var(--color-teal-50)] shadow-md"
                                : "border-[var(--color-border-medium)] hover:border-[var(--color-teal-300)] hover:bg-gray-50"
                        )}
                    >
                        <input {...getInputProps()} />

                        {uploading ? (
                            <div className="flex flex-col items-center z-10">
                                {/* Calm Progress Indicator (No Spinner) */}
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="w-20 h-20 rounded-full bg-[var(--color-teal-50)] flex items-center justify-center mb-6 border border-[var(--color-teal-200)]"
                                >
                                    <FileText className="w-8 h-8 text-[var(--color-teal-600)]" />
                                </motion.div>
                                <span className="font-serif text-xl text-[var(--color-navy-900)] mb-2">Auditing 50+ Clauses...</span>
                                <div className="w-48 h-1 bg-[var(--color-border-light)] rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: "100%" }}
                                        transition={{ duration: 3, ease: "linear" }}
                                        className="h-full bg-[var(--color-teal-600)]"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="z-10 flex flex-col items-center">
                                <div className="w-16 h-16 mb-6 rounded-full bg-[var(--color-cream-dark)] flex items-center justify-center border border-[var(--color-border-light)] group-hover:scale-110 group-hover:border-[var(--color-teal-200)] transition-all duration-300">
                                    <FileUp className="w-6 h-6 text-[var(--color-teal-600)]" />
                                </div>
                                <h3 className="font-serif text-2xl mb-2 text-[var(--color-navy-900)]">Drop policy PDF here</h3>
                                <p className="text-[var(--color-text-muted)] mb-8 font-mono text-xs uppercase tracking-widest">
                                    or click to browse
                                </p>

                                <div className="flex items-center gap-6 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-cream-main)] px-4 py-2 rounded-full border border-[var(--color-border-light)]">
                                    <span className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-[var(--color-teal-600)]" /> Private</span>
                                    <span className="w-px h-3 bg-[var(--color-border-medium)]"></span>
                                    <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-[var(--color-teal-600)]" /> ~60 seconds</span>
                                    <span className="w-px h-3 bg-[var(--color-border-medium)]"></span>
                                    <span className="flex items-center gap-1.5"><FileText className="w-3 h-3 text-[var(--color-teal-600)]" /> PDF only</span>
                                </div>
                            </div>
                        )}

                        {/* Subtle Grid Background (Light) */}
                        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none" />
                    </div>

                    {/* Desktop Trust Bar */}
                    <div className="hidden lg:flex mt-6 justify-center">
                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] opacity-70">
                            <Shield className="w-3 h-3" />
                            We don’t store, sell, or reuse your policy. Analysis is ephemeral.
                        </div>
                    </div>
                </motion.div>
            </div>


            {/* 4. WHAT WE ANALYZE (Logic Transparency) */}
            <div className="border-t border-[var(--color-border-light)] pt-16">
                <h3 className="font-serif text-2xl text-[var(--color-navy-900)] mb-10 text-center">What this analysis actually checks</h3>

                <div className="grid md:grid-cols-4 gap-8">
                    {[
                        { title: "Coverage Reality", items: ["Base sum vs City costs", "Room rent caps", "Hidden co-pays"] },
                        { title: "Claim Failures", items: ["Specific Sub-limits", "Waiting periods", "Permanent exclusions"] },
                        { title: "Rider Effectiveness", items: ["Junk riders", "Missing critical add-ons", "Cost-benefit ratio"] },
                        { title: "Structural Integrity", items: ["Restoration efficiency", "Employer dependency", "Zone limitations"] }
                    ].map((cat, i) => (
                        <div key={i} className="space-y-4">
                            <h4 className="font-bold text-[var(--color-teal-700)] text-sm uppercase tracking-wide border-b border-[var(--color-border-light)] pb-2 mb-2">
                                {cat.title}
                            </h4>
                            <ul className="space-y-2">
                                {cat.items.map((item, j) => (
                                    <li key={j} className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2">
                                        <span className="w-1 h-1 rounded-full bg-[var(--color-teal-400)] mt-2 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>


            {/* 5. WHAT YOU'LL GET (Outcome Preview) */}
            <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-xl border border-[var(--color-border-light)] shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-cream-dark)] flex items-center justify-center mb-4 text-[var(--color-navy-900)]">
                        <Search className="w-5 h-5" />
                    </div>
                    <h4 className="text-[var(--color-navy-900)] font-serif text-lg mb-2">A Clear Verdict</h4>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        Correctly insured, Under-insured, or Exposed. No vague scores.
                    </p>
                </div>

                <div className="bg-white p-8 rounded-xl border border-[var(--color-border-light)] shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-cream-dark)] flex items-center justify-center mb-4 text-[var(--color-navy-900)]">
                        <FileText className="w-5 h-5" />
                    </div>
                    <h4 className="text-[var(--color-navy-900)] font-serif text-lg mb-2">Plain English Breakdown</h4>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        We translate "Co-pay on Zone B treatment" into "You pay 20% in Mumbai".
                    </p>
                </div>

                <div className="bg-white p-8 rounded-xl border border-[var(--color-border-light)] shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-cream-dark)] flex items-center justify-center mb-4 text-[var(--color-navy-900)]">
                        <Zap className="w-5 h-5" />
                    </div>
                    <h4 className="text-[var(--color-navy-900)] font-serif text-lg mb-2">Actionable Guidance</h4>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        Specific steps to fix gaps. We never recommend specific policies to buy.
                    </p>
                </div>
            </div>


            {/* 6. SAMPLE REPORTS */}
            <div className="text-center pt-8 border-t border-[var(--color-border-light)]">
                <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-6">
                    See what the analysis looks like
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                    <Link href="/report/sample-health">
                        <Button variant="outline" className="cursor-pointer text-[var(--color-text-secondary)] border-[var(--color-border-medium)] hover:text-[var(--color-navy-900)] hover:border-[var(--color-navy-900)]">
                            Sample Health Policy
                        </Button>
                    </Link>
                    <Link href="/report/sample-life">
                        <Button variant="outline" className="cursor-pointer text-[var(--color-text-secondary)] border-[var(--color-border-medium)] hover:text-[var(--color-navy-900)] hover:border-[var(--color-navy-900)]">
                            Sample Term Life
                        </Button>
                    </Link>
                    <Link href="/report/sample-vehicle">
                        <Button variant="outline" className="cursor-pointer text-[var(--color-text-secondary)] border-[var(--color-border-medium)] hover:text-[var(--color-navy-900)] hover:border-[var(--color-navy-900)]">
                            Sample Car Insurance
                        </Button>
                    </Link>
                </div>
            </div>

        </div>
    );
}

