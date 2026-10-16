import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { IndianRupee, RefreshCw } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAgent } from "@/context/AgentContext";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { TYPE_META, typeLabel, type InsuranceType } from "@/lib/insuranceTypes";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr, type Locale } from "@/i18n";
import {
  fullInr, inForce, renewalBuckets, shortInr as shortInrFor, sumBy, toMoney,
  type BusinessRow, type PolicyMoney,
} from "@/lib/business";

/**
 * Business: the book in rupees.
 *
 * Insights counts policies. This adds the money: the premium and cover on every
 * policy, by type of insurance, by insurer, by family, and what falls due each
 * month. The rules for turning a stored premium into a yearly figure live in
 * lib/business.ts, and the note at the foot of the page says them out loud.
 *
 * PLAYGROUND ONLY for now (App.tsx route + AgentLayout nav). Before it opens to
 * real agents:
 *  - rewrite `insights.note_not_shown`: it says we store no premium on a checked
 *    policy, which stopped being true with audit 1.6.0;
 *  - the totals are summed in the browser from every row. Paging below keeps
 *    them whole, but a very large book belongs in a server-side sum.
 */

const SELECT = [
  "id", "insurance_type", "insurer", "sum_insured", "expiry_date", "customer_id",
  "x_premium:extracted_data->premium",
  "x_annual:extracted_data->annualised_premium",
  "x_freq:extracted_data->>premium_frequency",
  "x_next:extracted_data->>next_premium_date",
  "x_start:extracted_data->>start_date",
  "x_ppt:extracted_data->premium_paying_term_years",
  "h_premium:report_data->premium",
].join(", ");

/** PostgREST returns at most 1000 rows a call; a partial book is a wrong total. */
const PAGE = 1000;

function monthLabel(d: Date, locale: Locale): string {
  if (locale === "hi") return d.toLocaleDateString("hi-IN", { month: "short" }).replace("॰", "");
  return d.toLocaleDateString("en-IN", { month: "short" }).replace(".", "").slice(0, 3);
}

export default function Business() {
  const { agent } = useAgent();
  const [, setLocation] = useLocation();
  const { t, locale } = useLanguage();
  const shortInr = (n: number) => shortInrFor(n, locale);
  const [policies, setPolicies] = useState<PolicyMoney[]>([]);
  const [expired, setExpired] = useState(0);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renewalType, setRenewalType] = useState<string>("all");

  const load = useCallback(async () => {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      const rows: BusinessRow[] = [];
      for (let page = 0; page < 50; page++) {
        const { data, error: qErr } = await supabase
          .from("clients")
          .select(SELECT)
          .eq("agent_id", agent.agentId)
          .eq("status", "done")
          .order("id")
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (qErr) throw new Error(qErr.message);
        rows.push(...((data ?? []) as unknown as BusinessRow[]));
        if ((data ?? []).length < PAGE) break;
      }
      const today = new Date();
      const live = rows.filter((r) => inForce(r, today));
      setExpired(rows.length - live.length);
      setPolicies(live.map((r) => toMoney(r, today)));

      // Non-fatal: without names the families table says "A family" instead.
      try {
        const { data: people } = await supabase
          .from("customers")
          .select("id, name")
          .eq("agent_id", agent.agentId);
        setNames(new Map((people ?? []).map((p: { id: string; name: string | null }) => [p.id, p.name || ""])));
      } catch { setNames(new Map()); }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("business.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [agent?.agentId]);

  useEffect(() => { void load(); }, [load]);

  const typeName = (type: string) =>
    `${TYPE_META[type as InsuranceType]?.emoji ?? ""} ${tOr(t, `common.type_${type}`, typeLabel(type))}`.trim();

  const s = useMemo(() => {
    const priced = policies.filter((p) => p.yearly != null);
    const totalPremium = priced.reduce((a, p) => a + (p.yearly ?? 0), 0);
    const totalCover = policies.reduce((a, p) => a + (p.cover ?? 0), 0);
    const families = new Set(policies.map((p) => p.customerId).filter(Boolean) as string[]);
    const pricedFamilies = new Set(priced.map((p) => p.customerId).filter(Boolean) as string[]);

    const premiumByType = sumBy(priced, (p) => p.type, (p) => p.yearly);
    const coverByType = sumBy(policies, (p) => p.type, (p) => p.cover);
    const premiumByInsurer = sumBy(priced, (p) => p.insurer, (p) => p.yearly);
    const avgByType = premiumByType
      .map(([type, sum]) => [type, sum / priced.filter((p) => p.type === type).length] as [string, number])
      .sort((a, b) => b[1] - a[1]);

    const byFamily = new Map<string, PolicyMoney[]>();
    for (const p of policies) {
      if (!p.customerId) continue;
      byFamily.set(p.customerId, [...(byFamily.get(p.customerId) ?? []), p]);
    }
    const topFamilies = Array.from(byFamily.entries())
      .map(([id, ps]) => {
        const premium = ps.reduce((a, p) => a + (p.yearly ?? 0), 0);
        const next = ps
          .flatMap((p) => p.dues.map((d) => ({ date: d.date, type: p.type })))
          .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
        const types = Array.from(new Set(ps.map((p) => p.type)));
        return { id, ps, premium, next, types };
      })
      .filter((f) => f.premium > 0)
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 8);

    // Only types the book actually holds get a filter chip.
    const renewalTypes = ["health", "motor", "life", "term"].filter((ty) => priced.some((p) => p.type === ty));

    return {
      total: policies.length,
      priced: priced.length,
      missing: policies.filter((p) => p.status === "missing").length,
      single: policies.filter((p) => p.status === "single").length,
      paidUp: policies.filter((p) => p.status === "paid_up").length,
      unclear: policies.filter((p) => p.status === "unclear").length,
      oneTimeCount: policies.filter((p) => p.status === "one_time").length,
      oneTimeSum: policies.reduce((a, p) => a + (p.oneTime ?? 0), 0),
      assumed: priced.filter((p) => p.assumedYearly).length,
      noFamily: policies.filter((p) => !p.customerId).length,
      totalPremium, totalCover,
      families: families.size,
      pricedFamilies: pricedFamilies.size,
      premiumByType, coverByType, premiumByInsurer, avgByType, topFamilies, renewalTypes,
      types: new Set(policies.map((p) => p.type)).size,
    };
  }, [policies]);

  const renewals = useMemo(
    () => renewalBuckets(renewalType === "all" ? policies : policies.filter((p) => p.type === renewalType), new Date()),
    [policies, renewalType],
  );
  const renewalTotal = renewals.reduce((a, b) => a + b.amount, 0);
  const maxRenewal = Math.max(1, ...renewals.map((b) => b.amount));

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t("business.title")}</h1>
        <InlineErrorState onRetry={load} />
      </div>
    );
  }

  const dueDate = (d: Date) =>
    d.toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t("business.title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("business.subtitle")}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-[#0D9488] hover:underline disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">{t("business.loading")}</p>}

      {!loading && s.total === 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <IndianRupee className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-base font-semibold text-slate-700">{t("business.empty_title")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{t("business.empty_desc")}</p>
          <button
            onClick={() => setLocation("/agent/uploads")}
            className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[#0D9488] px-4 text-sm font-bold text-white hover:bg-[#0f766e]"
          >
            {t("insights.check_policy")}
          </button>
        </div>
      )}

      {!loading && s.total > 0 && (
        <>
          {/* HEADLINE */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              hero
              label={t("business.t_premium")}
              value={s.priced ? shortInr(s.totalPremium) : "–"}
              hint={t(s.priced === 1 ? "business.t_premium_hint_one" : "business.t_premium_hint_many", { count: s.priced })}
            />
            <Tile
              label={t("business.t_policies")}
              value={s.total}
              hint={t(s.types === 1 ? "business.t_types_one" : "business.t_types_many", { count: s.types })}
            />
            <Tile
              label={t("business.t_families")}
              value={s.families}
              hint={s.pricedFamilies ? t("business.t_families_hint", { amount: shortInr(s.totalPremium / s.pricedFamilies) }) : undefined}
            />
            <Tile label={t("business.t_cover")} value={s.totalCover ? shortInr(s.totalCover) : "–"} hint={t("business.t_cover_hint")} />
          </div>

          {s.priced > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title={t("business.by_type_title")} desc={t("business.by_type_desc", { count: s.priced })}>
                <Bars
                  rows={s.premiumByType}
                  name={typeName}
                  onPick={(type) => setLocation(`/agent/policies?type=${type}`)}
                />
              </Card>
              <Card title={t("business.cover_title")} desc={t("business.cover_desc")}>
                <Bars
                  rows={s.coverByType}
                  name={typeName}
                  light
                  onPick={(type) => setLocation(`/agent/policies?type=${type}`)}
                />
              </Card>
            </div>
          )}

          {s.priced > 0 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-800">{t("business.renewals_title")}</h2>
                  <p className="mb-5 text-sm text-slate-500">
                    {renewalTotal > 0
                      ? t("business.renewals_desc", { amount: shortInr(renewalTotal) })
                      : t("business.renewals_none")}
                  </p>
                </div>
                {s.renewalTypes.length > 1 && (
                  <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1" role="group" aria-label={t("business.renewals_filter")}>
                    {["all", ...s.renewalTypes].map((ty) => (
                      <button
                        key={ty}
                        onClick={() => setRenewalType(ty)}
                        aria-pressed={renewalType === ty}
                        className={`min-h-9 rounded-md px-3 text-sm font-bold ${renewalType === ty ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        {ty === "all" ? t("business.all") : tOr(t, `common.type_${ty}`, typeLabel(ty))}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <div className="grid h-56 min-w-[600px] grid-cols-12 items-end gap-2">
                  {renewals.map((b, i) => (
                    <div
                      key={b.month.toISOString()}
                      className="flex h-full flex-col items-center justify-end gap-1"
                      title={`${fullInr(b.amount)} · ${b.count}`}
                    >
                      <span className="whitespace-nowrap text-xs font-bold tabular-nums text-slate-700">
                        {b.amount ? shortInr(b.amount) : "–"}
                      </span>
                      <div
                        className={`w-full rounded-t ${i === 0 ? "bg-amber-400" : "bg-[#0D9488]"}`}
                        style={{ height: `${Math.max(1, (b.amount / maxRenewal) * 75)}%` }}
                      />
                      <span className="text-sm font-semibold text-slate-500">
                        {monthLabel(b.month, locale)}
                        {(i === 0 || b.month.getMonth() === 0) && ` ${String(b.month.getFullYear()).slice(2)}`}
                      </span>
                      <span className="-mt-1 text-xs tabular-nums text-slate-500">
                        {t(b.count === 1 ? "business.policy_one" : "business.policy_many", { count: b.count })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />{t("business.legend_now")}</span>
                <span className="inline-flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#0D9488]" />{t("business.legend_later")}</span>
              </div>
            </section>
          )}

          {s.priced > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title={t("business.insurer_title")} desc={t("business.insurer_desc")}>
                <Bars wide rows={s.premiumByInsurer.slice(0, 8)} name={(n) => (n === "Not recorded" ? t("business.not_recorded") : n)} />
              </Card>
              <Card title={t("business.avg_title")} desc={t("business.avg_desc")}>
                <Bars rows={s.avgByType} name={typeName} light noShare />
              </Card>
            </div>
          )}

          {s.topFamilies.length > 0 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-slate-800">{t("business.families_title")}</h2>
              <p className="mb-4 text-sm text-slate-500">{t("business.families_desc")}</p>
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <th className="w-8 py-2.5 pr-2" />
                      <th className="py-2.5 pr-3">{t("business.col_family")}</th>
                      <th className="py-2.5 pr-3">{t("business.col_insurance")}</th>
                      <th className="py-2.5 pr-3 text-right">{t("business.col_policies")}</th>
                      <th className="py-2.5 pr-3 text-right">{t("business.col_premium")}</th>
                      <th className="py-2.5 pr-3 text-right">{t("business.col_share")}</th>
                      <th className="py-2.5">{t("business.col_next")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.topFamilies.map((f, i) => {
                      const soon = f.next && (f.next.date.getTime() - Date.now()) / 86_400_000 <= 30;
                      return (
                        <tr key={f.id} className="border-b border-slate-100 last:border-0">
                          <td className="py-3 pr-2 font-bold tabular-nums text-slate-400">{i + 1}</td>
                          <td className="py-3 pr-3">
                            <button
                              onClick={() => setLocation(`/agent/customers/${f.id}`)}
                              className="min-h-11 text-left font-bold text-[#0D9488] hover:underline"
                            >
                              {names.get(f.id) || t("business.a_family")}
                            </button>
                          </td>
                          <td className="py-3 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {f.types.map((ty) => (
                                <span key={ty} className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-600">
                                  {tOr(t, `common.type_${ty}`, typeLabel(ty))}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums">{f.ps.length}</td>
                          <td className="py-3 pr-3 text-right font-bold tabular-nums text-slate-800">{fullInr(f.premium)}</td>
                          <td className="py-3 pr-3 text-right tabular-nums text-slate-500">{((f.premium / s.totalPremium) * 100).toFixed(1)}%</td>
                          <td className={`py-3 ${soon ? "font-bold text-amber-700" : "text-slate-600"}`}>
                            {f.next ? `${dueDate(f.next.date)} · ${tOr(t, `common.type_${f.next.type}`, typeLabel(f.next.type))}` : "–"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* WHAT THESE NUMBERS COUNT */}
          <p className="text-sm leading-relaxed text-slate-500">
            <b className="text-slate-600">{t("business.note_title")}</b> {t("business.note_body")}{" "}
            {t("business.note_counted", { priced: s.priced, total: s.total })}
            {s.missing > 0 && (
              <>
                {" "}
                {t(s.missing === 1 ? "business.note_missing_one" : "business.note_missing_many", { count: s.missing })}{" "}
                <button onClick={() => setLocation("/agent/policies")} className="font-semibold text-[#0D9488] hover:underline">
                  {t("business.note_open_policies")}
                </button>
              </>
            )}
            {s.oneTimeCount > 0 && <> {t(s.oneTimeCount === 1 ? "business.note_onetime_one" : "business.note_onetime_many", { count: s.oneTimeCount, amount: shortInr(s.oneTimeSum) })}</>}
            {s.assumed > 0 && <> {t(s.assumed === 1 ? "business.note_assumed_one" : "business.note_assumed_many", { count: s.assumed })}</>}
            {s.unclear > 0 && <> {t(s.unclear === 1 ? "business.note_unclear_one" : "business.note_unclear_many", { count: s.unclear })}</>}
            {s.single > 0 && <> {t(s.single === 1 ? "business.note_single_one" : "business.note_single_many", { count: s.single })}</>}
            {s.paidUp > 0 && <> {t(s.paidUp === 1 ? "business.note_paidup_one" : "business.note_paidup_many", { count: s.paidUp })}</>}
            {expired > 0 && <> {t(expired === 1 ? "business.note_expired_one" : "business.note_expired_many", { count: expired })}</>}
            {s.noFamily > 0 && <> {t(s.noFamily === 1 ? "business.note_nofamily_one" : "business.note_nofamily_many", { count: s.noFamily })}</>}
            {" "}{t("business.note_gst")}
          </p>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, hint, hero }: { label: string; value: number | string; hint?: string; hero?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl border border-slate-100 bg-white p-4 shadow-sm ${hero ? "border-l-4 border-l-[#0D9488]" : ""}`}>
      <p className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-3xl font-extrabold tabular-nums text-slate-800">{value}</p>
      {hint && <p className="mt-1.5 text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      <p className="mb-5 text-sm text-slate-500">{desc}</p>
      {children}
    </section>
  );
}

function Bars({
  rows, name, onPick, light, noShare, wide,
}: {
  rows: [string, number][];
  name: (key: string) => string;
  onPick?: (key: string) => void;
  light?: boolean;
  noShare?: boolean;
  /** Long names (insurers) get a wider label column and wrap to two lines. */
  wide?: boolean;
}) {
  const { locale } = useLanguage();
  const shortInr = (n: number) => shortInrFor(n, locale);
  const max = Math.max(1, ...rows.map(([, v]) => v));
  const total = rows.reduce((a, [, v]) => a + v, 0) || 1;
  return (
    <div className="space-y-1.5">
      {rows.map(([key, value]) => {
        const inner = (
          <>
            <span className={`${wide ? "line-clamp-2 leading-tight" : "truncate"} text-sm font-semibold text-slate-600`}>{name(key)}</span>
            <span className="h-3.5 overflow-hidden rounded bg-slate-100">
              <span
                className={`block h-full rounded ${light ? "bg-teal-300" : "bg-[#0D9488]"}`}
                style={{ width: `${(value / max) * 100}%` }}
              />
            </span>
            <span className="whitespace-nowrap text-right text-sm tabular-nums text-slate-500">
              <b className="text-slate-800">{shortInr(value)}</b>
              {!noShare && <span className="hidden sm:inline">&nbsp; {Math.round((value / total) * 100)}%</span>}
            </span>
          </>
        );
        const cls = `grid min-h-11 w-full ${wide ? "grid-cols-[120px_1fr_76px] sm:grid-cols-[180px_1fr_112px]" : "grid-cols-[88px_1fr_76px] sm:grid-cols-[112px_1fr_112px]"} items-center gap-2 rounded-lg px-1 text-left sm:gap-3`;
        return onPick ? (
          <button key={key} onClick={() => onPick(key)} title={fullInr(value)} className={`${cls} hover:bg-slate-50`}>{inner}</button>
        ) : (
          <div key={key} title={fullInr(value)} className={cls}>{inner}</div>
        );
      })}
    </div>
  );
}
