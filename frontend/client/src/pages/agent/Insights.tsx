import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { RefreshCw, TrendingUp } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAgent } from "@/context/AgentContext";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { TYPE_META, typeLabel, type InsuranceType } from "@/lib/insuranceTypes";

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

function monthKey(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "short" });
}

export default function Insights() {
  const { agent } = useAgent();
  const [, setLocation] = useLocation();
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
      setError(e instanceof Error ? e.message : "Could not load insights.");
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
      const t = r.insurance_type || "health";
      byType.set(t, (byType.get(t) ?? 0) + 1);
    }
    const typeRows = Array.from(byType.entries()).sort((a, b) => b[1] - a[1]);

    // Six forward months of expiries, bucketed by calendar month.
    const now = new Date();
    const buckets: { label: string; count: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      buckets.push({ label: monthKey(d), count: 0 });
    }
    for (const r of rows) {
      if (!r.expiry_date) continue;
      const e = new Date(r.expiry_date);
      if (Number.isNaN(e.getTime())) continue;
      const months = (e.getFullYear() - now.getFullYear()) * 12 + (e.getMonth() - now.getMonth());
      if (months >= 0 && months < 6) buckets[months].count++;
    }

    // Health is the only line we actually check, so it is the only one with a
    // score. Averaging across everything would divide by policies that were
    // never scored.
    const scored = rows.filter((r) => typeof r.score === "number");
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length)
      : null;
    const weak = scored.filter((r) => (r.score ?? 100) < 70).length;

    return { total, renewing30, expired, unknownExpiry, typeRows, buckets, scored: scored.length, avgScore, weak };
  }, [rows]);

  const maxBucket = Math.max(1, ...stats.buckets.map((b) => b.count));
  const maxType = Math.max(1, ...stats.typeRows.map(([, n]) => n));

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">Insights</h1>
        <InlineErrorState onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">Insights</h1>
          <p className="mt-1 text-sm text-slate-500">How your book is moving, and where the work is.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-[#0D9488] hover:underline disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading your book…</p>}

      {!loading && stats.total === 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <TrendingUp className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-base font-semibold text-slate-700">Nothing to chart yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Insights fills in as you add policies. Check your first policy and this page starts
            showing renewals, product mix and where your weak covers are.
          </p>
          <button
            onClick={() => setLocation("/agent/uploads")}
            className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[#0D9488] px-4 text-sm font-bold text-white hover:bg-[#0f766e]"
          >
            Check a policy
          </button>
        </div>
      )}

      {!loading && stats.total > 0 && (
        <>
          {/* HEADLINE COUNTS */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Policies in your book" value={stats.total} />
            <Tile label="Renewing in 30 days" value={stats.renewing30} tone={stats.renewing30 > 0 ? "warn" : undefined} />
            <Tile label="Already expired" value={stats.expired} tone={stats.expired > 0 ? "bad" : undefined} />
            <Tile label="People you cover" value={customerCount ?? "—"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">

            {/* RENEWAL FORECAST */}
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-slate-800">Renewals due, next six months</h2>
              <p className="mb-5 text-sm text-slate-500">
                Policies reaching their expiry date. Plan your calls against the tall months.
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
              <h2 className="text-base font-bold text-slate-800">What you sell</h2>
              <p className="mb-5 text-sm text-slate-500">
                Share of {stats.total} policies. One colour, because a product type is not a warning.
              </p>
              <div className="space-y-2.5">
                {stats.typeRows.map(([type, count]) => (
                  <button
                    key={type}
                    onClick={() => setLocation(`/agent/policies?type=${type}`)}
                    className="grid w-full grid-cols-[92px_1fr_78px] items-center gap-3 rounded-lg py-0.5 text-left hover:bg-slate-50"
                  >
                    <span className="truncate text-sm font-semibold text-slate-600">
                      {TYPE_META[type as InsuranceType]?.emoji} {typeLabel(type)}
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
              <h2 className="text-base font-bold text-slate-800">What your checks found</h2>
              <p className="mb-4 text-sm text-slate-500">
                Across the {stats.scored} {stats.scored === 1 ? "policy" : "policies"} that carry a
                health check score. Other lines are data entry and are not scored.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Tile label="Average score" value={stats.avgScore ?? "—"} />
                <Tile label="Scoring under 70" value={stats.weak} tone={stats.weak > 0 ? "warn" : undefined} />
                <Tile label="Policies checked" value={stats.scored} />
              </div>
              {stats.weak > 0 && (
                <button
                  onClick={() => setLocation("/agent/policies?type=health")}
                  className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-[#0D9488] hover:underline"
                >
                  See the weak ones →
                </button>
              )}
            </section>
          )}

          {/* HONESTY NOTE — the empty slots, said out loud. */}
          <p className="text-sm leading-relaxed text-slate-500">
            <b className="text-slate-600">What these numbers count.</b> Every figure above is
            counted from the policies in your book right now.
            {stats.unknownExpiry > 0 && (
              <> {stats.unknownExpiry} {stats.unknownExpiry === 1 ? "policy has" : "policies have"} no
              expiry date recorded, so {stats.unknownExpiry === 1 ? "it is" : "they are"} left out of the
              renewal figures rather than guessed at.</>
            )}{" "}
            Premium under management and lapse rate are deliberately not shown: we do not store a
            premium on a checked policy, and a lapse is not something the system can tell apart from
            a renewal written elsewhere. Showing either would mean inventing it.
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
