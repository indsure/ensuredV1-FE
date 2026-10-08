import { UserRound } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { CALCULATOR_CONFIG, type SeparatePolicyPlan } from "@/lib/health-engine-logic";
import { formatINRFull as formatINR, formatLakhs } from "@/lib/format";

/**
 * Children too old for the family floater, each with the cover the engine
 * planned for them as an individual. Shared by the public report and the
 * advisor's calculator so the two never say different things.
 *
 * Renders nothing when there are no such children, which is every report
 * saved before separatePolicies existed.
 */
export function SeparatePolicyCard({ plans }: { plans?: SeparatePolicyPlan[] }) {
  const { t } = useLanguage();
  if (!plans?.length) return null;

  const maxAge = CALCULATOR_CONFIG.dependentChildMaxAge;
  const single = plans.length === 1;

  const steps: Array<{ title: string; body: string }> = [
    { title: t("sep.step1_t"), body: t("sep.step1_b") },
    { title: t("sep.step2_t"), body: t("sep.step2_b") },
    { title: t("sep.step3_t"), body: t("sep.step3_b") },
  ];

  return (
    <section
      aria-labelledby="separate-policy-title"
      className="space-y-6 rounded-2xl border border-amber-300 bg-amber-50 p-6 md:p-8"
    >
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <UserRound className="h-6 w-6 text-amber-800" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-900">
            {single ? t("sep.eyebrow_one") : t("sep.eyebrow_many", { n: plans.length })}
          </p>
          <h2 id="separate-policy-title" className="mt-1 font-serif text-2xl md:text-3xl text-[var(--color-navy-900)]">
            {single ? t("sep.title_one", { age: plans[0].age }) : t("sep.title_many", { n: plans.length })}
          </h2>
        </div>
      </div>

      <p className="text-base md:text-lg leading-relaxed text-[var(--color-text-secondary)]">
        {t("sep.why", { max: maxAge, next: maxAge + 1 })}
      </p>

      <div className="space-y-3">
        {plans.map((p, i) => (
          <div key={i} className="rounded-xl border border-amber-200 bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-muted)]">
                  {t("sep.child_age", { age: p.age })}
                </p>
                <p className="font-serif text-3xl text-[var(--color-navy-900)]">{formatLakhs(p.totalSI)}</p>
                {p.topUpSI > 0 && (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t("sep.split", { base: formatLakhs(p.baseSI), topup: formatLakhs(p.topUpSI) })}
                  </p>
                )}
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("sep.premium", {
                  min: formatINR(p.premiumEstimate.annual.min),
                  max: formatINR(p.premiumEstimate.annual.max),
                })}
              </p>
            </div>
          </div>
        ))}
      </div>

      <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={i} className="space-y-2 rounded-xl border border-amber-200 bg-white p-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-teal-700)] text-sm font-bold text-white">
              {i + 1}
            </span>
            <p className="font-semibold text-[var(--color-navy-900)]">{s.title}</p>
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{s.body}</p>
          </li>
        ))}
      </ol>

      <p className="text-sm text-[var(--color-text-muted)]">{t("sep.method")}</p>
    </section>
  );
}
