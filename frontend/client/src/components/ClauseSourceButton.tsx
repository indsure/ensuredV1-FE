import { useId, useState } from "react";
import { FileText } from "lucide-react";
import type { ClauseSource } from "@shared/policy";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * The policy sentence a finding rests on, opened by a tap.
 *
 * Deliberately a disclosure, not a hover tooltip: most advisors read reports on
 * a phone, where hover does not exist. Styled with explicit colours because the
 * shadcn popover/muted/accent tokens are never defined in this Tailwind theme
 * and paint nothing.
 *
 * Only a quote the server verified is ever stored (services/clauseSources.ts),
 * and this renders nothing unless `verified` is true, so an old report or a
 * dropped quote shows the finding alone, with no note. The quote is text read
 * out of a policy PDF, so the panel is kept out of session replay.
 */
export function ClauseSourceButton({ source }: { source?: ClauseSource | null }) {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const panelId = useId();

    if (!source || source.verified !== true || !source.quote) return null;

    return (
        <div className="mt-2 print:hidden">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((v) => !v)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--color-teal-600)] bg-white px-3 text-sm font-medium text-[var(--color-teal-700)] hover:bg-[var(--color-teal-50)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-teal-600)]"
            >
                <FileText className="h-4 w-4" aria-hidden="true" />
                {open ? t("rpt.src_hide") : t("rpt.src_show")}
            </button>
            {open && (
                <div
                    id={panelId}
                    data-mp-block
                    className="mt-2 rounded-lg border-l-4 border-[var(--color-teal-600)] bg-[#F8FAF9] px-4 py-3"
                >
                    <blockquote className="text-sm leading-relaxed text-[var(--color-navy-900)]">
                        "{source.quote}"
                    </blockquote>
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        {source.origin === "official_wording" ? t("rpt.src_wording") : t("rpt.src_uploaded")}
                    </p>
                </div>
            )}
        </div>
    );
}
