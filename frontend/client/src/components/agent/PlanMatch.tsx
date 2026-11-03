import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowRight, Check, HelpCircle, Loader2, Plus, Star, Target, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/i18n/LanguageContext";
import type { UserInputs } from "@/lib/health-engine-logic";

/**
 * Client Plan Match, advisor portal only. The best plan from each of the
 * advisor's insurers for this client's calculator answers, with the wording's
 * own words behind every tick. Matching runs on the server
 * (backend/server/services/planMatch.ts); this only shows it.
 * Never rendered on the client report, the PDF or the public site.
 */

type NeedKey = "abroad" | "room" | "deductible" | "ped" | "parents_copay" | "cover" | "age";
type NeedStatus = "met" | "addon" | "unmet" | "unclear";
interface Need { key: NeedKey; must: boolean; status: NeedStatus; detail: string }
interface Verdict {
  plan_key: string; insurer: string; plan_name: string; variant: string;
  completeness: number; fit: number; needs: Need[]; met: number; addons: number; unclear: number;
}
interface WhyNot {
  plan_key: string; insurer: string; plan_name: string; variant: string; completeness: number;
  kind: "fail" | "same_insurer" | "lower"; need: Need | null; met: number; of: number;
}
interface MatchResponse {
  source: "stars" | "insurers" | "catalog";
  stars: number;
  insurers: string[];
  unmatched: string[];
  needs: { key: NeedKey; must: boolean; why: string }[];
  picks: Verdict[];
  why_not: WhyNot[];
  blocked: { need: NeedKey; closest: Verdict | null; elsewhere: number } | null;
}

/** "TATA AIG General Insurance Company Limited" -> "TATA AIG". */
export function shortInsurer(name: string): string {
  return name
    .replace(/^the\s+/i, "")
    .replace(/\s+(and allied\s+)?(general|health)?\s*(insurance|assurance)\b.*$/i, "")
    .replace(/\s+(health|general)$/i, "")
    .trim() || name;
}

const planLabel = (p: { plan_name: string; variant: string }) => `${p.plan_name}${p.variant ? ` (${p.variant})` : ""}`;

const ICON: Record<NeedStatus, { cls: string; el: React.ReactNode }> = {
  met: { cls: "bg-teal-100 text-teal-700", el: <Check className="h-3 w-3" aria-hidden="true" /> },
  addon: { cls: "bg-amber-100 text-amber-700", el: <Plus className="h-3 w-3" aria-hidden="true" /> },
  unmet: { cls: "bg-red-100 text-red-600", el: <X className="h-3 w-3" aria-hidden="true" /> },
  unclear: { cls: "bg-slate-200 text-slate-600", el: <HelpCircle className="h-3 w-3" aria-hidden="true" /> },
};

export function PlanMatch({ inputs, minSiLakhs }: { inputs: Partial<UserInputs>; minSiLakhs: number }) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<MatchResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    (async () => {
      try {
        const res = await apiFetch("/api/agent/plan-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: inputs, min_si_lakhs: minSiLakhs }),
        });
        if (!res.ok) throw new Error("match");
        const json = await res.json();
        if (alive) setData(json);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [inputs, minSiLakhs]);

  const needLabel = (k: NeedKey) => t(`pmatch.need_${k}`);

  const verdictText = (v: Verdict) => {
    const n = v.needs.length;
    const head = v.met === n && v.addons === 0
      ? t("pmatch.verdict_all", { n })
      : v.met === n
        ? t("pmatch.verdict_addon", { n, a: v.addons })
        : t("pmatch.verdict_partial", { met: v.met, n });
    return v.unclear > 0 ? `${head} · ${t("pmatch.verdict_confirm", { u: v.unclear })}` : head;
  };
  const verdictCls = (v: Verdict) =>
    v.met === v.needs.length && v.addons === 0 && v.unclear === 0
      ? "bg-emerald-50 text-emerald-700"
      : v.met === v.needs.length
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-2xl border border-slate-100 bg-white">
      <div className="p-5 md:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              <Target className="h-4 w-4 text-[#0D9488]" aria-hidden="true" /> {t("pmatch.title")}
            </div>
            <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">{t("pmatch.sub")}</p>
          </div>
          {data && (
            <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
              {data.source === "stars"
                ? t("pmatch.pool_stars", { n: data.stars })
                : data.source === "insurers"
                  ? data.insurers.map(shortInsurer).join(" · ")
                  : t("pmatch.pool_catalog")}
            </span>
          )}
        </div>

        {failed ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{t("pmatch.failed")}</p>
        ) : !data ? (
          <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("pmatch.loading")}</p>
        ) : (
          <>
            {data.needs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.needs.map((n) => (
                  <span key={n.key} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    <span className={n.must ? "text-teal-700" : "text-slate-500"}>{n.must ? t("pmatch.must") : t("pmatch.counts")}</span>
                    {" · "}{needLabel(n.key)} <span className="text-slate-500">({n.why})</span>
                  </span>
                ))}
              </div>
            )}

            {data.source === "catalog" && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">{t("pmatch.no_insurers_title")}</p>
                  <p className="text-sm text-slate-600">{t("pmatch.no_insurers_body")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLocation("/agent/profile")}
                  className="rounded-lg bg-[#0D9488] px-3 py-2 text-sm font-bold text-white hover:bg-[#0f766e]"
                >
                  {t("pmatch.no_insurers_cta")}
                </button>
              </div>
            )}
            {data.source === "stars" && (
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                <Star className="h-4 w-4 fill-amber-500 text-amber-500" aria-hidden="true" /> {t("pmatch.stars_hint")}
              </p>
            )}
            {data.unmatched.length > 0 && (
              <p className="text-sm text-slate-500">{t("pmatch.unmatched", { names: data.unmatched.join(", ") })}</p>
            )}

            {data.blocked && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {t("pmatch.blocked_title", { need: needLabel(data.blocked.need) })}
                </p>
                {data.blocked.closest && (
                  <p className="mt-1">{t("pmatch.blocked_closest", { plan: `${planLabel(data.blocked.closest)}, ${shortInsurer(data.blocked.closest.insurer)}` })}</p>
                )}
                {data.blocked.elsewhere > 0 && <p className="mt-1">{t("pmatch.blocked_elsewhere", { n: data.blocked.elsewhere })}</p>}
              </div>
            )}

            {data.picks.length > 0 && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {data.picks.map((p, i) => (
                  <article
                    key={p.plan_key}
                    className={`flex flex-col gap-2.5 rounded-2xl bg-white p-4 ${i === 0 ? "border-2 border-[#0D9488] shadow-[0_10px_24px_-16px_rgba(13,148,136,0.55)]" : "border border-slate-200"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-black text-white">#{i + 1}</span>
                      <span className="text-right text-xs font-bold text-slate-500">{shortInsurer(p.insurer)}</span>
                    </div>
                    <h4 className="font-serif text-lg font-bold leading-snug text-slate-800">{planLabel(p)}</h4>
                    <div className={`rounded-lg px-2.5 py-1.5 text-xs font-extrabold ${verdictCls(p)}`}>{verdictText(p)}</div>
                    <ul className="space-y-1.5">
                      {p.needs.map((n) => (
                        <li key={n.key} className="grid grid-cols-[18px_1fr] items-start gap-1.5 text-sm text-slate-700">
                          <span className={`mt-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full ${ICON[n.status].cls}`}>{ICON[n.status].el}</span>
                          <span className="min-w-0">
                            {needLabel(n.key)}
                            <span className="block text-xs text-slate-500 break-words">
                              {n.status === "addon" ? `${t("pmatch.addon")}: ` : ""}{n.detail}
                              {n.status === "unclear" ? ` · ${t("pmatch.confirm")}` : ""}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-slate-500">
                      {t("pmatch.completeness")}
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                        <span className="block h-full rounded-full bg-[#0D9488]" style={{ width: `${p.completeness}%` }} />
                      </span>
                      <b className="tabular-nums text-slate-800">{p.completeness}</b>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {data.picks.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setLocation(`/agent/compare?keys=${data.picks.map((p) => encodeURIComponent(p.plan_key)).join(",")}&minSI=${minSiLakhs}`)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0f766e]"
                >
                  {t("pmatch.compare")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              {data.why_not.length > 0 && (
                <button
                  type="button"
                  aria-expanded={showWhy}
                  onClick={() => setShowWhy((s) => !s)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-[#0D9488] hover:text-[#0D9488]"
                >
                  {showWhy ? t("pmatch.hide") : t("pmatch.why_not", { n: data.why_not.length })}
                </button>
              )}
            </div>

            {showWhy && (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {data.why_not.map((w) => (
                  <li key={w.plan_key} className="grid grid-cols-[minmax(0,1.3fr)_44px] gap-x-3 gap-y-0.5 px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1.3fr)_44px_minmax(0,2fr)]">
                    <span className="min-w-0 font-bold text-slate-800">
                      {planLabel(w)}
                      <span className="block text-xs font-semibold text-slate-500">{shortInsurer(w.insurer)}</span>
                    </span>
                    <span className="text-right font-mono text-xs tabular-nums text-slate-500">{w.completeness}</span>
                    <span className="col-span-2 min-w-0 text-slate-700 sm:col-span-1">
                      {w.kind === "fail" && w.need
                        ? <><b className="text-red-600">{t("pmatch.kind_fail", { need: needLabel(w.need.key) })}</b> <span className="text-slate-500">{w.need.detail}</span></>
                        : w.kind === "same_insurer"
                          ? <><b className="text-amber-700">{t("pmatch.kind_same", { need: w.need ? needLabel(w.need.key) : "" })}</b> {w.need ? <span className="text-slate-500">{w.need.detail}</span> : null}</>
                          : t("pmatch.kind_lower", { met: w.met, of: w.of })}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">{t("pmatch.foot")}</p>
          </>
        )}
      </div>
    </div>
  );
}
