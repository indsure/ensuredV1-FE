import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { clsx } from "clsx";

interface InsurerScore {
    slug: string;
    count: number;
}

interface WinnerPodiumProps {
    insurers: InsurerScore[];
    totalHospitals: number;
}

export function WinnerPodium({ insurers, totalHospitals }: WinnerPodiumProps) {
    if (insurers.length === 0) return null;

    return (
        <div className="bg-[var(--color-blue-800)] rounded-xl p-6 border border-[var(--color-border-subtle)] relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-teal-500)]/10 rounded-full blur-3xl -mr-16 -mt-16" />

            <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="p-2 bg-gradient-to-br from-[var(--color-gold-400)] to-[var(--color-gold-600)] rounded-lg text-white shadow-lg shadow-amber-900/20">
                    <Trophy className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-sm tracking-wide uppercase text-[var(--color-white-muted)]">Strongest Networks</h3>
                    <p className="text-xs text-[var(--color-teal-400)] font-medium">by absolute hospital count</p>
                </div>
            </div>

            <div className="space-y-4 relative z-10">
                {insurers.map((insurer, idx) => {
                    const percentage = Math.round((insurer.count / (insurers[0].count * 1.2)) * 100); // Scale relative to winner

                    return (
                        <motion.div
                            key={insurer.slug}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="relative"
                        >
                            <div className="flex justify-between items-center z-10 relative mb-1">
                                <div className="flex items-center gap-3">
                                    <div className={clsx(
                                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm",
                                        idx === 0 ? "bg-[var(--color-gold-500)] text-white ring-2 ring-[var(--color-gold-500)]/30" :
                                            idx === 1 ? "bg-gray-300 text-gray-800" :
                                                idx === 2 ? "bg-amber-700 text-amber-100" :
                                                    "bg-[var(--color-navy-900)] text-[var(--color-white-muted)] border border-[var(--color-border-subtle)]"
                                    )}>
                                        {idx + 1}
                                    </div>
                                    <span className="capitalize text-white font-medium tracking-tight">
                                        {insurer.slug.replace(/_/g, " ")}
                                    </span>
                                </div>
                                <span className="font-mono text-[var(--color-teal-400)] font-bold text-lg">
                                    {insurer.count}
                                </span>
                            </div>

                            {/* Bar visualization */}
                            <div className="h-1.5 w-full bg-[var(--color-navy-900)] rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ duration: 1, ease: "easeOut", delay: 0.2 + (idx * 0.1) }}
                                    className={clsx(
                                        "h-full rounded-full",
                                        idx === 0 ? "bg-gradient-to-r from-[var(--color-gold-500)] to-[var(--color-gold-300)]" :
                                            "bg-[var(--color-teal-600)]"
                                    )}
                                />
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--color-border-subtle)] text-xs text-[var(--color-white-muted)] text-center">
                Review full network lists before purchasing.
            </div>
        </div>
    );
}
