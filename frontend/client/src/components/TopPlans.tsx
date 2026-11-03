import { useEffect, useState } from "react";
import { ArrowRight, Check, AlertTriangle, Loader2, Trophy } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatINRShort } from "@/lib/format";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * "Compare Plans With This Coverage": the 3 most complete catalogue plans that
 * can carry the cover the calculator recommended. Ranked server-side by
 * services/planCompleteness.ts. An advisor's session ranks from their
 * preferred list instead, when they have one.
 *
 * `refreshKey` lets the advisor page re-rank after the list changes.
 */
export interface RecommendedPlan {
  plan_key: string;
  insurer: string;
  plan_name: string;
  variant: string;
  sum_insured_options: string | null;
  score: number;
  strengths: string[];
  gaps: string[];
}

export function TopPlans({
  minSiLakhs,
  onCompare,
  audience = "consumer",
  refreshKey = 0,
}: {
  minSiLakhs: number;
  onCompare: (planKeys: string[]) => void;
  audience?: "consumer" | "advisor";
  refreshKey?: number;
}) {
  const { t } = useLanguage();
  const [plans, setPlans] = useState<RecommendedPlan[] | null>(null);
  const [source, setSource] = useState<"catalog" | "preferred">("catalog");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!(minSiLakhs > 0)) return;
    let alive = true;
    setPlans(null);
    setFailed(false);
    (async () => {
      try {
        const res = await apiFetch(`/api/compare/recommend?min_si=${encodeURIComponent(String(minSiLakhs))}`);
        if (!res.ok) throw new Error("recommend");
        const json = await res.json();
        if (!alive) return;
        setPlans(json.plans ?? []);
        setSource(json.source === "preferred" ? "preferred" : "catalog");
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [minSiLakhs, refreshKey]);

  if (!(minSiLakhs > 0)) return null;
  const amount = formatINRShort(minSiLakhs * 1e5);

  return (
    <section className="rounded-2xl border border-[var(--color-border-light)] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-teal-700)]">
        {t("toprec.eyebrow", { amount })}
      </p>
      <h2 className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-[var(--color-navy-900)]">
        {source === "preferred" ? t("toprec.title_preferred") : t("toprec.title_catalog")}
      </h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{t("toprec.sub")}</p>
      {audience === "advisor" && source === "catalog" && (
        <p className="mt-2 text-[15px] text-[var(--color-text-secondary)]">{t("toprec.hint_star")}</p>
      )}

      {failed ? (
        <p className="mt-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[15px] text-red-700">{t("toprec.failed")}</p>
      ) : plans == null ? (
        <p className="mt-5 flex items-center gap-2 text-[15px] text-[var(--color-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("toprec.loading")}
        </p>
      ) : plans.length === 0 ? (
        <p className="mt-5 text-[15px] text-[var(--color-text-main)]">
          {source === "preferred" ? t("toprec.none_preferred", { amount }) : t("toprec.none", { amount })}
        </p>
      ) : (
        <>
          <ol className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((p, i) => (
              <li
                key={p.plan_key}
                className="flex flex-col gap-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-cream-main)] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-navy-900)] px-2.5 py-1 text-sm font-bold text-white">
                    {i === 0 && <Trophy className="h-3.5 w-3.5" aria-hidden="true" />}#{i + 1}
                  </span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{t("toprec.score")}</span>
                </div>
                <div>
                  <p className="font-serif text-lg font-bold leading-snug text-[var(--color-navy-900)]">
                    {p.plan_name}{p.variant ? ` (${p.variant})` : ""}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{p.insurer}</p>
                </div>
                <div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-[var(--color-navy-900)]">{t("toprec.out_of", { n: p.score })}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[rgba(15,23,42,0.08)]" aria-hidden="true">
                    <div className="h-2 rounded-full bg-[var(--color-teal-600)]" style={{ width: `${p.score}%` }} />
                  </div>
                </div>
                {p.strengths.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-teal-700)]">{t("toprec.good")}</p>
                    <ul className="mt-1 space-y-1">
                      {p.strengths.slice(0, 2).map((s) => (
                        <li key={s} className="flex gap-1.5 text-sm leading-snug text-[var(--color-text-main)]">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-teal-600)]" aria-hidden="true" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.gaps.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-[#B45309]">{t("toprec.watch")}</p>
                    <p className="mt-1 flex gap-1.5 text-sm leading-snug text-[var(--color-text-main)]">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" aria-hidden="true" /> {p.gaps[0]}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ol>

          {plans.length >= 2 && (
            <button
              type="button"
              onClick={() => onCompare(plans.map((p) => p.plan_key))}
              className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-cta)] px-5 text-base font-semibold text-white transition-colors hover:bg-[#0F766E] sm:w-auto"
            >
              {t("toprec.compare")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">{t("toprec.age_note")}</p>
        </>
      )}
    </section>
  );
}
