import { SearchX } from "lucide-react";
import { motion } from "framer-motion";

export function EmptyState() {
    return (
        <section className="py-24 bg-[var(--color-cream-main)] text-center">
            <div className="container-editorial max-w-2xl px-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center"
                >
                    <div className="w-24 h-24 bg-[var(--color-cream-dark)] rounded-full flex items-center justify-center mb-6">
                        <SearchX className="w-10 h-10 text-[var(--color-text-muted)]" />
                    </div>
                    <h3 className="text-3xl font-serif font-bold text-[var(--color-navy-900)] mb-3">
                        No hospitals found
                    </h3>
                    <p className="text-[var(--color-text-secondary)] text-lg mb-8 leading-relaxed">
                        We couldn't find any network hospitals matching your specific criteria.
                        This might mean no insurers have listed hospitals in this exact pincode.
                    </p>
                    <div className="bg-white border border-[var(--color-border-light)] rounded-lg p-6 text-left max-w-md w-full shadow-sm">
                        <p className="font-bold text-[var(--color-navy-900)] mb-2 text-sm uppercase tracking-wide">
                            Suggestions:
                        </p>
                        <ul className="space-y-2 text-[var(--color-text-main)] text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--color-teal-600)] mt-0.5">•</span>
                                <span>Try searching by <strong>State only</strong> to see all available cities.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--color-teal-600)] mt-0.5">•</span>
                                <span>Check the spelling of the City name.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--color-teal-600)] mt-0.5">•</span>
                                <span>Try a nearby Pincode.</span>
                            </li>
                        </ul>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
