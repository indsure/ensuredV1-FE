import { SearchX } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "@/i18n/LanguageContext";

export function EmptyState() {
    const { t } = useLanguage();
    return (
        <section className="py-14 sm:py-20 lg:py-24 bg-[var(--color-cream-main)] text-center">
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
                        {t("hosp.none")}
                    </h3>
                    <p className="text-[var(--color-text-secondary)] text-lg mb-8 leading-relaxed">
                        {t("hosp.none_d")}
                    </p>
                    <div className="bg-white border border-[var(--color-border-light)] rounded-lg p-6 text-left max-w-md w-full shadow-sm">
                        <p className="font-bold text-[var(--color-navy-900)] mb-2 text-sm uppercase tracking-wide">
                            {t("hosp.suggest")}
                        </p>
                        <ul className="space-y-2 text-[var(--color-text-main)] text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--color-teal-600)] mt-0.5">•</span>
                                <span>{t("hosp.s1a")} <strong>{t("hosp.s1b")}</strong> {t("hosp.s1c")}</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--color-teal-600)] mt-0.5">•</span>
                                <span>{t("hosp.s2")}</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--color-teal-600)] mt-0.5">•</span>
                                <span>{t("hosp.s3")}</span>
                            </li>
                        </ul>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
