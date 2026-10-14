import { useLanguage } from "@/i18n/LanguageContext";
import { Plus } from "lucide-react";
import { PAGE_FAQS } from "@/data/page-faqs";

/**
 * The visible FAQ for a public page. Its questions come from PAGE_FAQS, the
 * same list the prerender turns into FAQPage JSON-LD, so the two never drift.
 */
export function PageFaq({ route, className = "" }: { route: string; className?: string }) {
  const { t } = useLanguage();
  const headingId = `faq${route.replace(/[^a-z0-9]+/gi, "-")}`;
  const items = PAGE_FAQS[route] ?? [];
  if (!items.length) return null;
  return (
    <section className={`w-full max-w-3xl mx-auto px-4 sm:px-6 py-12 ${className}`} aria-labelledby={headingId}>
      <h2 id={headingId} className="text-2xl md:text-3xl font-serif font-bold text-[var(--color-navy-900)] mb-6">
        {t("pagefaq.title")}
      </h2>
      <div className="flex flex-col gap-3">
        {items.map(([q, a]) => (
          <details
            key={q}
            className="group rounded-xl border border-[var(--color-border-light)] bg-white px-5 py-4 open:border-[var(--color-teal-600)]/30"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-4 text-[17px] font-semibold text-[var(--color-navy-900)]">
              {t(q)}
              <Plus
                className="mt-1 h-5 w-5 shrink-0 text-[var(--color-teal-600)] transition-transform duration-300 group-open:rotate-45"
                aria-hidden="true"
              />
            </summary>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{t(a)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
