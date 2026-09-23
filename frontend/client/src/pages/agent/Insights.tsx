import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { RefreshCw, TrendingUp } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAgent } from "@/context/AgentContext";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { TYPE_META, typeLabel, type InsuranceType } from "@/lib/insuranceTypes";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr, type Locale } from "@/i18n";

/**
 * Insights — the book, analysed.
 *
 * Home answers "what needs me today". This answers "how is the book moving",
 * which is the question the person who owns an agency logs in with.
 *
 * Two rules govern what is on this screen:
 *
 *  1. Every figure is computed from a query you can point at. Nothing is
 *     asserted, and nothing is a placeholder. Where a figure is not derivable
 *     from what we store, it is ABSENT rather than approximated — see the note
 *     rendered at the foot of the page, which says so to the agent as well.
 *
 *  2. The query is narrow on purpose. Six columns, no `report_data`. An agency
 *     with a thousand policies cannot afford this screen pulling analysis blobs
 *     it never reads.
 */

/** Only the columns the aggregates below actually consume. */
type InsightRow = {
  id: string;
  insurance_type: string | null;
  expiry_date: string | null;
  created_at: string;
  score: number | null;
  customer_id: string | null;
};

const DAY = 86_400_000;

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / DAY);
}

function monthKey(d: Date, locale: Locale): string {
  // Devanagari month names cannot be cut to three characters, so Hindi keeps
  // the whole short form and only drops the abbreviation mark.
  if (locale === "hi") return d.toLocaleDateString("hi-IN", { month: "short" }).replace("॰", "");
  // en-IN renders September as "Sept", four characters against everything
  // else's three, which makes one bar's label sit wider than its neighbours.
  return d.toLocaleDateString("en-IN", { month: "short" }).replace(".", "").slice(0, 3);
}

export default function Insights() {
  const { agent } = useAgent();
  const [, setLocation] = useLocation();
  const { t, locale } = useLanguage();
  const [rows, setRows] = useState<InsightRow[]>([]);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("clients")
        .select("id, insurance_type, expiry_date, created_at, score, customer_id")
        .eq("agent_id", agent.agentId)
        .eq("status", "done");
      if (qErr) throw new Error(qErr.message);
      setRows((data ?? []) as InsightRow[]);

      // Non-fatal: the people tile just stays blank if this fails.
      try {
        const { count } = await supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", agent.agentId);
        setCustomerCount(count ?? 0);
      } catch { setCustomerCount(null); }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("insights.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [agent?.agentId]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    let renewing30 = 0;
    let expired = 0;
    let unknownExpiry = 0;

    for (const r of rows) {
      const d = daysUntil(r.expiry_date);
      if (d === null) { unknownExpiry++; continue; }
      if (d < 0) expired++;
      else if (d <= 30) renewing30++;
    }

    // By type, largest first. Types with no policies are omitted rather than
    // rendered as a zero bar, so the chart never implies a category we do not
    // actually hold.
    const byType = new Map<string, number>();
    for (const r of rows) {
      const ty = r.insurance_type || "health";
      byType.set(ty, (byType.get(ty) ?? 0) + 1);
    }
    const typeRows = Array.from(byType.entries()).sort((a, b) => b[1] - a[1]);

    // Six forward months of expiries, bucketed by calendar month.
    const now = new Date();
    const buckets: { label: string; count: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      buckets.push({ label: monthKey(d, locale), count: 0 });
    }
    for (const r of rows) {
      if (!r.expiry_date) continue;
      const e = new Date(r.expiry_date);
      if (Number.isNaN(e.getTime())) continue;
      // A policy that expired earlier THIS month is month-offset 0, so bucketing
      // on the month alone counted it as "due" while the tile above counted it
      // as "expired" — the same policy in two places saying opposite things, and
      // the current month's bar reading high for work already missed.
      if ((daysUntil(r.expiry_date) ?? -1) < 0) continue;
      const months = (e.getFullYear() - now.getFullYear()) * 12 + (e.getMonth() - now.getMonth());
      if (months >= 0 && months < 6) buckets[months].count++;
    }

    // Health is the only line we actually check, so it is the only one with a
    // score. Averaging across everything would divide by policies that were
    // never scored.
    /* Health only, and not just because motor scores were always null here.
       The two numbers share a scale and mean different things: health grades
       wording, motor measures how completely a vehicle is covered. Averaging
       them produces a figure that describes neither, and a motor 18 (own damage,
       no add-ons, a perfectly ordinary policy) would be counted as weak cover.
       The re-read path now writes motor scores, so this had to stop being
       accidentally correct and start being deliberately correct. */
    const scored = rows.filter(
      (r) => (r.insurance_type || "health") === "health" && typeof r.score === "number",
    );
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length)
      : null;
    const weak = scored.filter((r) => (r.score ?? 100) < 70).length;

    return { total, renewing30, expired, unknownExpiry, typeRows, buckets, scored: scored.length, avgScore, weak };
  }, [rows, locale]);

  const maxBucket = Math.max(1, ...stats.buckets.map((b) => b.count));
  const maxType = Math.max(1, ...stats.typeRows.map(([, n]) => n));

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t("insights.title")}</h1>
        <InlineErrorState onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t("insights.title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("insights.subtitle")}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-[#0D9488] hover:underline disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">{t("insights.loading")}</p>}

      {!loading && stats.total === 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <TrendingUp className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-base font-semibold text-slate-700">{t("insights.empty_title")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {t("insights.empty_desc")}
          </p>
          <button
            onClick={() => setLocation("/agent/uploads")}
            className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[#0D9488] px-4 text-sm font-bold text-white hover:bg-[#0f766e]"
          >
            {t("insights.check_policy")}
          </button>
        </div>
      )}

      {!loading && stats.total > 0 && (
        <>
          {/* HEADLINE COUNTS */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={t("insights.t_total")} value={stats.total} />
            <Tile label={t("insights.t_renewing")} value={stats.renewing30} tone={stats.renewing30 > 0 ? "warn" : undefined} />
            <Tile label={t("insights.t_expired")} value={stats.expired} tone={stats.expired > 0 ? "bad" : undefined} />
            <Tile label={t("insights.t_people")} value={customerCount ?? "—"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">

            {/* RENEWAL FORECAST */}
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-slate-800">{t("insights.renewals_title")}</h2>
              <p className="mb-5 text-sm text-slate-500">
                {t("insights.renewals_desc")}
              </p>
              <div className="flex h-40 items-end gap-2">
                {stats.buckets.map((b) => (
                  <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-sm font-bold tabular-nums text-slate-700">{b.count}</span>
                    <div
                      className="w-full rounded-t bg-[#0D9488]"
                      style={{ height: `${Math.max(2, (b.count / maxBucket) * 100)}%` }}
                    />
                    <span className="text-sm font-semibold text-slate-500">{b.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* PRODUCT MIX */}
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-slate-800">{t("insights.mix_title")}</h2>
              <p className="mb-5 text-sm text-slate-500">
                {t("insights.mix_desc", { count: stats.total })}
              </p>
              <div className="space-y-2.5">
                {stats.typeRows.map(([type, count]) => (
                  <button
                    key={type}
                    onClick={() => setLocation(`/agent/policies?type=${type}`)}
                    // These rows are links into a filtered Policies list, so
                    // they are tap targets and were 24px tall — half the 44px
                    // floor this product sets itself, on a screen built for
                    // people who are not aiming carefully.
                    className="grid min-h-11 w-full grid-cols-[76px_1fr_74px] items-center gap-2 rounded-lg px-1 text-left hover:bg-slate-50 sm:grid-cols-[92px_1fr_78px] sm:gap-3"
                  >
                    <span className="truncate text-sm font-semibold text-slate-600">
                      {TYPE_META[type as InsuranceType]?.emoji} {tOr(t, `common.type_${type}`, typeLabel(type))}
                    </span>
                    <span className="h-3.5 overflow-hidden rounded bg-slate-100">
                      <span
                        className="block h-full rounded bg-[#0D9488]"
                        style={{ width: `${(count / maxType) * 100}%` }}
                      />
                    </span>
                    <span className="text-right text-sm tabular-nums text-slate-500">
                      <b className="text-slate-800">{count}</b> &nbsp;{Math.round((count / stats.total) * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* CHECK QUALITY */}
          {stats.scored > 0 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-slate-800">{t("insights.checks_title")}</h2>
              <p className="mb-4 text-sm text-slate-500">
                {t(stats.scored === 1 ? "insights.checks_desc_one" : "insights.checks_desc_many", { count: stats.scored })}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Tile label={t("insights.t_avg")} value={stats.avgScore ?? "—"} />
                <Tile label={t("insights.t_weak")} value={stats.weak} tone={stats.weak > 0 ? "warn" : undefined} />
                <Tile label={t("insights.t_checked")} value={stats.scored} />
              </div>
              {stats.weak > 0 && (
                <button
                  onClick={() => setLocation("/agent/policies?type=health")}
                  className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-[#0D9488] hover:underline"
                >
                  {t("insights.see_weak")}
                </button>
              )}
            </section>
          )}

          {/* HONESTY NOTE — the empty slots, said out loud. */}
          <p className="text-sm leading-relaxed text-slate-500">
            <b className="text-slate-600">{t("insights.note_title")}</b> {t("insights.note_body")}
            {stats.unknownExpiry > 0 && (
              <> {t(stats.unknownExpiry === 1 ? "insights.note_unknown_one" : "insights.note_unknown_many", { count: stats.unknownExpiry })}</>
            )}{" "}
            {t("insights.note_not_shown")}
          </p>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number | string; tone?: "warn" | "bad" }) {
  const ring =
    tone === "bad" ? "border-red-100 border-l-4 border-l-red-400"
    : tone === "warn" ? "border-amber-100 border-l-4 border-l-amber-400"
    : "border-slate-100";
  const text =
    tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-slate-800";
  return (
    <div className={`min-w-0 rounded-xl border bg-white p-4 shadow-sm ${ring}`}>
      <p className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-3xl font-extrabold tabular-nums ${text}`}>{value}</p>
    </div>
  );
}
