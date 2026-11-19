import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Cake, HeartPulse, Lock, MessageCircle, Phone, Play, RefreshCw, ShieldPlus, UserPlus } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { rerunPolicy } from "@/lib/rerun";
import { toast } from "@/hooks/use-toast";
import { useAgent } from "@/context/AgentContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { FreePlanBanner } from "@/components/agent/PaidOnly";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { typeLabel } from "@/lib/insuranceTypes";
import { fullInr, renewalBuckets, shortInr as shortInrFor } from "@/lib/business";
import {
  dueList, splitDue, startOfDay, sumDue, summarise, upcomingBirthdays, LATE_WINDOW_DAYS, WEEK_DAYS,
  type Due, type HomeRow,
} from "@/lib/home";
import { fetchLeads, isFollowUpDue, telHref, waHref, type Lead } from "@/lib/leads";
import { fetchDueLeadPolicies, daysUntilDue, type LeadPolicyWithLead } from "@/lib/leadPolicies";
import { ADD_ON_FINDINGS_KEY } from "@shared/motorAddOns";
import { scoreMotorPolicy, motorScoreTone, motorScoreVerdict } from "@shared/motorScore";

/**
 * Home: the advisor's landing page.
 *
 * One page for what used to be three (Dashboard, Insights, Business), in the
 * order an advisor works: the book in numbers, who renews this week, who
 * renews this month, who is worth a call, then how the book is made up.
 *
 * Every figure is computed from a query on this page. Due dates come from
 * lib/home.ts, so the "due in 30 days" tile and both renewal lists are the same
 * rows. The 12-month chart uses calendar months from lib/business.ts and says so.
 * Plan: docs/plans/2026-11-19-advisor-home.md.
 */

const SELECT = [
  "id", "insurance_type", "insurer", "sum_insured", "expiry_date", "customer_id",
  "policyholder_name", "name", "policy_name", "created_at", "score",
  "x_premium:extracted_data->premium",
  "x_annual:extracted_data->annualised_premium",
  "x_freq:extracted_data->>premium_frequency",
  "x_next:extracted_data->>next_premium_date",
  "x_start:extracted_data->>start_date",
  "x_ppt:extracted_data->premium_paying_term_years",
  `x_addons:extracted_data->${ADD_ON_FINDINGS_KEY}`,
  "x_cov:extracted_data->>coverage_type",
  "h_premium:report_data->premium",
].join(", ");

/** PostgREST returns at most 1000 rows a call; a partial book is a wrong total. */
const PAGE = 1000;
const SHOW = 6;

type Person = { id: string; name: string | null; phone: string | null; dob: string | null };
type Failed = { id: string; policy_name: string | null; name: string | null; error_message: string | null; created_at: string | null };

function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? "dashboard.good_morning" : h < 18 ? "dashboard.good_afternoon" : "dashboard.good_evening";
}

export default function DashboardNew() {
  const [, setLocation] = useLocation();
  const { agent, creditsRemaining, refresh: refreshAgent } = useAgent();
  const { t, locale } = useLanguage();
  const shortInr = (n: number) => shortInrFor(n, locale);
  const tag = locale === "hi" ? "hi-IN" : "en-IN";

  const [rows, setRows] = useState<HomeRow[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [leadsDue, setLeadsDue] = useState<Lead[]>([]);
  const [prospectsDue, setProspectsDue] = useState<LeadPolicyWithLead[]>([]);
  const [queue, setQueue] = useState<number | null>(null);
  const [failed, setFailed] = useState<Failed[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [chartType, setChartType] = useState("all");
  const [showAllWeek, setShowAllWeek] = useState(false);
  const [showAllMonth, setShowAllMonth] = useState(false);

  const load = useCallback(async () => {
    if (!agent?.agentId) return;
    const agentId = agent.agentId;
    setLoading(true);
    setError(null);
    try {
      const all: HomeRow[] = [];
      for (let page = 0; page < 50; page++) {
        const { data, error: qErr } = await supabase
          .from("clients")
          .select(SELECT)
          .eq("agent_id", agentId)
          .eq("status", "done")
          .order("id")
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (qErr) throw new Error(qErr.message);
        all.push(...((data ?? []) as unknown as HomeRow[]));
        if ((data ?? []).length < PAGE) break;
      }
      setRows(all);

      // Side blocks. Each one failing only empties its own block.
      const [cust, leads, prospects, q, f] = await Promise.allSettled([
        fetchAllRows<Person>((from, to) =>
          supabase.from("customers").select("id, name, phone, dob").eq("agent_id", agentId).order("id").range(from, to)),
        fetchLeads(agentId),
        fetchDueLeadPolicies(agentId),
        supabase.from("clients").select("id", { count: "exact", head: true })
          .eq("agent_id", agentId).in("status", ["pending", "processing", "error"]),
        supabase.from("clients").select("id, policy_name, name, error_message, created_at")
          .eq("agent_id", agentId).eq("status", "error").order("created_at", { ascending: false }).limit(5),
      ]);
      setPeople(cust.status === "fulfilled" ? new Map(cust.value.map((p) => [p.id, p])) : new Map());
      setLeadsDue(leads.status === "fulfilled" ? leads.value.filter(isFollowUpDue) : []);
      // Same window as the advisor's own book: up to 30 days late, or due this week.
      setProspectsDue(prospects.status === "fulfilled"
        ? prospects.value.filter((p) => {
            const d = daysUntilDue(p.due_date);
            return !p.spoken_to && d !== null && d >= -LATE_WINDOW_DAYS && d <= WEEK_DAYS;
          })
        : []);
      setQueue(q.status === "fulfilled" && !q.value.error ? q.value.count ?? 0 : null);
      setFailed(f.status === "fulfilled" && !f.value.error ? (f.value.data ?? []) as Failed[] : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("ahome.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [agent?.agentId]);

  useEffect(() => { void load(); }, [load]);

  // Retry stays on Home: My Queue is paid-only, and a Free advisor's own failed
  // check must not land on an upgrade screen.
  async function retry(id: string) {
    setRetrying(id);
    try {
      await rerunPolicy(id);
      toast({ variant: "success", title: t("dashboard.rerun_title"), description: t("dashboard.rerun_desc") });
      void load();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("dashboard.retry_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setRetrying(null);
    }
  }

  const today = useMemo(() => startOfDay(new Date()), [rows]);
  const s = useMemo(() => summarise(rows, today), [rows, today]);
  const due = useMemo(() => dueList(rows, today), [rows, today]);
  const { week, month } = useMemo(() => splitDue(due), [due]);
  const weekShown = typeFilter === "all" ? week : week.filter((d) => d.type === typeFilter);
  const monthShown = typeFilter === "all" ? month : month.filter((d) => d.type === typeFilter);
  // The tile is exactly the rows of the two lists below: late ones plus the next 30 days.
  const lateCount = due.filter((d) => d.days < 0).length;
  const next30Sum = sumDue(due);
  const weekSum = sumDue(weekShown);
  const monthSum = sumDue(monthShown);
  const listTypes = useMemo(
    () => ["health", "motor", "life", "term"].filter((ty) => due.some((d) => d.type === ty)),
    [due],
  );

  const chart = useMemo(
    () => renewalBuckets(chartType === "all" ? s.money : s.money.filter((p) => p.type === chartType), today),
    [s.money, chartType, today],
  );
  const chartTotal = chart.reduce((a, b) => a + b.amount, 0);
  const chartMax = Math.max(1, ...chart.map((b) => b.amount));
  const chartTypes = ["health", "motor", "life", "term"].filter((ty) => s.money.some((p) => p.type === ty && p.yearly != null));

  const birthdays = useMemo(() => upcomingBirthdays(Array.from(people.values()), today), [people, today]);
  const familyNextDue = useMemo(() => {
    const m = new Map<string, Due>();
    for (const d of due) {
      const id = d.row.customer_id;
      if (id && d.days >= 0 && !m.has(id)) m.set(id, d);
    }
    return m;
  }, [due]);
  const recent = useMemo(
    () => [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    [rows],
  );

  const typeName = (ty: string) => tOr(t, `common.type_${ty}`, typeLabel(ty));
  const holder = (r: HomeRow) => (r.customer_id && people.get(r.customer_id)?.name) || r.policyholder_name || r.name || t("ahome.no_name");
  const dateText = (d: Date) => d.toLocaleDateString(tag, { day: "numeric", month: "short" });

  if (!agent) return null;
  if (error) return <InlineErrorState onRetry={load} />;

  const firstName = agent.name.split(" ")[0] || t("dashboard.agent_fallback");
  const paid = !agent.limitedFree;

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-['Playfair_Display']">
            {t(greetingKey())}, {firstName}
          </h1>
          <p className="mt-1 text-base text-slate-500">
            {new Date().toLocaleDateString(tag, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => { void load(); void refreshAgent(); }}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> {t("dashboard.refresh")}
          </button>
          <button
            type="button"
            onClick={() => setLocation("/agent/uploads")}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-bold text-white shadow-md hover:bg-[#0f766e]"
          >
            <Play size={16} className="fill-current" /> {t("ahome.check_policy")}
          </button>
        </div>
      </div>

      <FreePlanBanner />

      {creditsRemaining === 0 && (
        <Banner tone="red" title={t("dashboard.credits_zero_title")} body={t("dashboard.credits_zero_desc")} cta={t("dashboard.buy_checks")} href="/agent/plan" />
      )}
      {creditsRemaining > 0 && creditsRemaining < 3 && (
        <Banner
          tone="amber"
          title={creditsRemaining === 1
            ? t("dashboard.credits_low_title").replace("{{count}}", "1")
            : t("dashboard.credits_low_title_plural").replace("{{count}}", String(creditsRemaining))}
          body={t("dashboard.credits_low_desc")}
          cta={t("dashboard.get_credits")}
          href="/agent/plan"
        />
      )}

      {loading && rows.length === 0 && <Skeleton />}

      {!loading && rows.length === 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-800">{t("ahome.empty_title")}</p>
          <p className="mx-auto mt-2 max-w-md text-base text-slate-500">{t("ahome.empty_desc")}</p>
          <button
            type="button"
            onClick={() => setLocation("/agent/uploads")}
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#0D9488] px-5 text-base font-bold text-white hover:bg-[#0f766e]"
          >
            {t("ahome.check_policy")}
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* 1. STATS */}
          {/* Free advisors keep the counts they had; rupee totals were Insights and
              Business, which are paid, so those tiles stay with the paid plan. */}
          <section className={`grid grid-cols-2 gap-3 ${paid ? "lg:grid-cols-5" : "lg:grid-cols-3"}`}>
            {paid && (
              <Tile
                accent="teal"
                label={t("ahome.t_premium")}
                value={s.priced ? shortInr(s.totalPremium) : "–"}
                hint={t("ahome.t_premium_hint", { priced: s.priced, total: s.inForce })}
              />
            )}
            <Tile
              label={t("ahome.t_policies")}
              value={String(s.inForce)}
              hint={s.addedThisWeek > 0 ? t("ahome.t_added_week", { count: s.addedThisWeek }) : t("ahome.t_none_added")}
            />
            <Tile
              label={t("ahome.t_families")}
              value={String(s.families)}
              hint={paid && s.perFamily ? t("ahome.t_per_family", { amount: shortInr(s.perFamily) }) : undefined}
            />
            <Tile
              accent="amber"
              label={t("ahome.t_due30")}
              value={paid ? (next30Sum.priced ? shortInr(next30Sum.amount) : "–") : String(due.length)}
              hint={lateCount > 0
                ? t("ahome.t_due30_hint_late", { count: due.length, late: lateCount })
                : t("ahome.t_due30_hint", { count: due.length, week: week.length })}
              wide={!paid}
            />
            {paid && (
              <Tile
                label={t("ahome.t_cover")}
                value={s.totalCover ? shortInr(s.totalCover) : "–"}
                hint={t("ahome.t_cover_hint")}
                wide
              />
            )}
          </section>

          {/* 2 + 3. RENEWALS */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">{t("ahome.renewals")}</h2>
            {listTypes.length > 1 && (
              <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1" role="group" aria-label={t("ahome.filter_label")}>
                {["all", ...listTypes].map((ty) => (
                  <button
                    key={ty}
                    type="button"
                    onClick={() => setTypeFilter(ty)}
                    aria-pressed={typeFilter === ty}
                    className={`min-h-11 rounded-lg px-3.5 text-sm font-bold ${typeFilter === ty ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {ty === "all" ? t("ahome.all") : typeName(ty)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <DueCard
            title={t("ahome.week_title")}
            tone="amber"
            desc={t("ahome.week_desc", { date: dateText(new Date(today.getTime() + 7 * 86_400_000)) })}
            sum={weekSum}
            money={paid}
            items={weekShown}
            showAll={showAllWeek}
            onShowAll={() => setShowAllWeek((v) => !v)}
            empty={t("ahome.week_empty")}
            holder={holder}
            people={people}
            dateText={dateText}
            shortInr={shortInr}
            typeName={typeName}
            onOpen={(id) => setLocation(`/agent/policies/${id}`)}
          />

          <DueCard
            title={t("ahome.month_title")}
            tone="teal"
            desc={t("ahome.month_desc", {
              from: dateText(new Date(today.getTime() + 8 * 86_400_000)),
              to: dateText(new Date(today.getTime() + 30 * 86_400_000)),
            })}
            sum={monthSum}
            money={paid}
            items={monthShown}
            showAll={showAllMonth}
            onShowAll={() => setShowAllMonth((v) => !v)}
            empty={t("ahome.month_empty")}
            holder={holder}
            people={people}
            dateText={dateText}
            shortInr={shortInr}
            typeName={typeName}
            onOpen={(id) => setLocation(`/agent/policies/${id}`)}
          />

          {/* 4. WORTH A CALL */}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Opp
              icon={<HeartPulse size={18} />}
              label={t("ahome.o_weak")}
              value={s.weakHealth.length}
              desc={t("ahome.o_weak_desc")}
              names={s.weakHealth.map((r) => holder(r))}
              cta={t("ahome.o_weak_cta")}
              href="/agent/policies?type=health"
            />
            <Opp
              icon={<ShieldPlus size={18} />}
              label={t("ahome.o_noterm")}
              value={s.healthNoTerm.length}
              desc={t("ahome.o_noterm_desc")}
              names={s.healthNoTerm.map((f) => people.get(f.id)?.name || t("ahome.a_family"))}
              cta={t("ahome.o_noterm_cta")}
              href="/agent/customers"
            />
            <Opp
              icon={<UserPlus size={18} />}
              label={t("ahome.o_leads")}
              value={leadsDue.length + prospectsDue.length}
              desc={t("ahome.o_leads_desc", { leads: leadsDue.length, prospects: prospectsDue.length })}
              names={[...leadsDue.map((l) => l.name), ...prospectsDue.map((p) => p.agent_leads?.name || p.policyholder_name || "")].filter(Boolean)}
              cta={prospectsDue.length > 0 && leadsDue.length === 0 ? t("ahome.o_prospects_cta") : t("ahome.o_leads_cta")}
              href={prospectsDue.length > 0 && leadsDue.length === 0 ? "/agent/renewals" : "/agent/leads"}
            />
            <Opp
              icon={<Cake size={18} />}
              label={t("ahome.o_bday")}
              value={birthdays.length}
              desc={t("ahome.o_bday_desc")}
              names={birthdays.map((b) => `${b.person.name ?? ""} (${b.days === 0 ? t("ahome.today") : dateText(b.date)})`)}
              cta={t("ahome.o_bday_cta")}
              href="/agent/customers"
            >
              {birthdays.slice(0, 2).map((b) => {
                const wa = waHref(b.person.phone, t("ahome.bday_msg", { name: (b.person.name ?? "").split(" ")[0] }));
                return wa ? (
                  <a key={b.person.id} href={wa} target="_blank" rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-green-600 px-3 text-sm font-bold text-white hover:bg-green-700">
                    <MessageCircle size={15} /> {(b.person.name ?? "").split(" ")[0]}
                  </a>
                ) : null;
              })}
            </Opp>
          </section>

          {/* 5 + 6. THE BOOK (paid) */}
          {agent.limitedFree ? (
            <section className="rounded-2xl border border-[#0D9488]/30 bg-[#0D9488]/5 p-6 text-center">
              <Lock className="mx-auto h-6 w-6 text-[#0D9488]" />
              <p className="mt-2 text-lg font-bold text-slate-900">{t("ahome.paid_title")}</p>
              <p className="mx-auto mt-1 max-w-lg text-base text-slate-600">{t("ahome.paid_body")}</p>
              <Link href="/agent/plan" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#0D9488] px-5 text-base font-bold text-white hover:bg-[#0f766e]">
                {t("paywall.see_plans")}
              </Link>
            </section>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
                <section className="min-w-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-slate-900">{t("ahome.chart_title")}</h2>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {chartTotal > 0 ? t("ahome.chart_desc", { amount: shortInr(chartTotal) }) : t("ahome.chart_none")}
                      </p>
                    </div>
                    {chartTypes.length > 1 && (
                      <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1" role="group" aria-label={t("ahome.filter_label")}>
                        {["all", ...chartTypes].map((ty) => (
                          <button
                            key={ty}
                            type="button"
                            onClick={() => setChartType(ty)}
                            aria-pressed={chartType === ty}
                            className={`min-h-11 rounded-lg px-3 text-sm font-bold ${chartType === ty ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                          >
                            {ty === "all" ? t("ahome.all") : typeName(ty)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-5 overflow-x-auto">
                    <div className="grid h-52 min-w-[560px] grid-cols-12 items-end gap-2">
                      {chart.map((b, i) => (
                        <div key={b.month.toISOString()} className="flex h-full flex-col items-center justify-end gap-1" title={`${fullInr(b.amount)} · ${b.count}`}>
                          <span className="whitespace-nowrap text-xs font-bold tabular-nums text-slate-700">{b.amount ? shortInr(b.amount) : "–"}</span>
                          <div className={`w-full rounded-t ${i === 0 ? "bg-amber-400" : "bg-[#0D9488]"}`} style={{ height: `${Math.max(1, (b.amount / chartMax) * 72)}%` }} />
                          <span className="whitespace-nowrap text-sm font-semibold text-slate-500">
                            {locale === "hi"
                              ? b.month.toLocaleDateString(tag, { month: "short" }).replace("॰", "")
                              : b.month.toLocaleDateString(tag, { month: "short" }).replace(".", "").slice(0, 3)}
                            {(i === 0 || b.month.getMonth() === 0) && ` ${String(b.month.getFullYear()).slice(2)}`}
                          </span>
                          <span className="-mt-1 text-xs tabular-nums text-slate-500">{b.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />{today.toLocaleDateString(tag, { month: "long" })}</span>
                    <span className="inline-flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#0D9488]" />{t("ahome.legend_later")}</span>
                    <span>{t("ahome.legend_count")}</span>
                  </div>
                </section>

                <section className="min-w-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900">{t("ahome.mix_title")}</h2>
                  <p className="mt-0.5 mb-4 text-sm text-slate-500">{t("ahome.mix_desc")}</p>
                  <div className="space-y-1">
                    {s.typeRows.map(([ty, v]) => {
                      const max = Math.max(1, ...s.typeRows.map(([, x]) => x.premium));
                      return (
                        <button
                          key={ty}
                          type="button"
                          onClick={() => setLocation(`/agent/policies?type=${ty}`)}
                          className="grid min-h-11 w-full grid-cols-[84px_1fr_auto] items-center gap-3 rounded-lg px-1 text-left hover:bg-slate-50"
                        >
                          <span className="truncate text-sm font-semibold text-slate-700">{typeName(ty)}</span>
                          <span className="h-3.5 overflow-hidden rounded bg-slate-100">
                            <span className="block h-full rounded bg-[#0D9488]" style={{ width: `${(v.premium / max) * 100}%` }} />
                          </span>
                          <span className="whitespace-nowrap text-right text-sm tabular-nums text-slate-500">
                            <b className="text-slate-900">{v.premium ? shortInr(v.premium) : "–"}</b> · {v.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {s.topInsurers.length > 0 && (
                    <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-500">
                      <b className="text-slate-700">{t("ahome.top_insurers")}</b>{" "}
                      {s.topInsurers.map(([n, v]) => `${n === "Not recorded" ? t("ahome.not_recorded") : n} ${shortInr(v)}`).join(", ")}
                    </p>
                  )}
                </section>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
                {s.topFamilies.length > 0 ? (
                  <section className="min-w-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">{t("ahome.fam_title")}</h2>
                        <p className="mt-0.5 text-sm text-slate-500">{t("ahome.fam_desc")}</p>
                      </div>
                      <Link href="/agent/customers" className="inline-flex min-h-10 shrink-0 items-center text-sm font-bold text-[#0D9488] hover:underline">{t("ahome.all_customers")}</Link>
                    </div>
                    <div className="-mx-5 mt-3 overflow-x-auto px-5">
                      <table className="w-full min-w-[560px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                            <th className="w-6 py-2.5" />
                            <th className="py-2.5 pr-3">{t("ahome.col_family")}</th>
                            <th className="py-2.5 pr-3">{t("ahome.col_insurance")}</th>
                            <th className="py-2.5 pr-3 text-right">{t("ahome.col_policies")}</th>
                            <th className="py-2.5 pr-3 text-right">{t("ahome.col_premium")}</th>
                            <th className="py-2.5">{t("ahome.col_next")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.topFamilies.map((f, i) => {
                            const nd = familyNextDue.get(f.id);
                            return (
                              <tr key={f.id} className="border-b border-slate-100 last:border-0">
                                <td className="py-2 font-bold tabular-nums text-slate-400">{i + 1}</td>
                                <td className="py-2 pr-3">
                                  <Link href={`/agent/customers/${f.id}`} className="inline-flex min-h-11 items-center font-bold text-[#0D9488] hover:underline">
                                    {people.get(f.id)?.name || t("ahome.a_family")}
                                  </Link>
                                </td>
                                <td className="py-2 pr-3">
                                  <div className="flex flex-wrap gap-1">
                                    {f.types.map((ty) => (
                                      <span key={ty} className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-600">{typeName(ty)}</span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums">{f.policies}</td>
                                <td className="py-2 pr-3 text-right font-bold tabular-nums text-slate-900">{fullInr(f.premium)}</td>
                                <td className={`py-2 whitespace-nowrap ${nd ? (nd.days <= 7 ? "font-bold text-amber-700" : "text-slate-700") : "text-slate-400"}`}>
                                  {nd ? `${dateText(nd.date)} · ${typeName(nd.type)}` : t("ahome.not_in_30")}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : <div className="hidden xl:block" />}

                <RecentChecks recent={recent} failed={failed} retrying={retrying} onRetry={retry} queue={queue} holder={holder} typeName={typeName} onOpen={(id) => setLocation(`/agent/policies/${id}`)} />
              </div>
            </>
          )}

          {agent.limitedFree && (
            <RecentChecks queueLink={false} recent={recent} failed={failed} retrying={retrying} onRetry={retry} queue={queue} holder={holder} typeName={typeName} onOpen={(id) => setLocation(`/agent/policies/${id}`)} />
          )}

          {/* WHAT THESE NUMBERS COUNT */}
          <p className="max-w-5xl text-sm leading-relaxed text-slate-500">
            <b className="text-slate-600">{t("ahome.note_title")}</b> {t("ahome.note_body", { priced: s.priced, total: s.inForce })}
            {s.missingPremium > 0 && <> {t("ahome.note_missing", { count: s.missingPremium })}</>}
            {s.noFamily > 0 && <> {t("ahome.note_nofamily", { count: s.noFamily })}</>}
            {s.noDate > 0 && <> {t("ahome.note_nodate", { count: s.noDate })}</>}
            {" "}{t("ahome.note_rules")}
          </p>
        </>
      )}
    </div>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function Banner({ tone, title, body, cta, href }: { tone: "red" | "amber"; title: string; body: string; cta: string; href: string }) {
  const c = tone === "red"
    ? { box: "border-red-200 bg-red-50", h: "text-red-700", p: "text-red-600", b: "bg-red-600 hover:bg-red-700" }
    : { box: "border-amber-200 bg-amber-50", h: "text-amber-800", p: "text-amber-700", b: "bg-amber-600 hover:bg-amber-700" };
  return (
    <div className={`flex flex-col gap-3 rounded-xl border px-5 py-4 sm:flex-row sm:items-center ${c.box}`}>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${c.h}`}>{title}</p>
        <p className={`mt-0.5 text-sm ${c.p}`}>{body}</p>
      </div>
      <Link href={href} className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white ${c.b}`}>{cta}</Link>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-white shadow-sm" />)}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
    </div>
  );
}

function Tile({ label, value, hint, accent, wide }: { label: string; value: string; hint?: string; accent?: "teal" | "amber"; wide?: boolean }) {
  const border = accent === "teal" ? "border-l-4 border-l-[#0D9488]" : accent === "amber" ? "border-l-4 border-l-amber-400" : "";
  return (
    <div className={`min-w-0 rounded-xl border border-slate-100 bg-white p-4 shadow-sm ${border} ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
      <p className="text-sm font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

function ScoreCell({ row }: { row: HomeRow }) {
  const type = row.insurance_type || "health";
  const box = "inline-flex h-8 w-11 items-center justify-center rounded-md text-sm font-bold";
  if (type === "motor") {
    const sc = scoreMotorPolicy((row.x_addons ?? null) as never, row.x_cov);
    if (sc.score === null) return <span className="text-slate-400">–</span>;
    const cls = { strong: "bg-green-100 text-green-700", core: "bg-amber-100 text-amber-700", basic: "bg-slate-100 text-slate-700", third_party: "bg-red-100 text-red-700", unscored: "" }[motorScoreTone(sc)];
    return <span title={motorScoreVerdict(sc)} className={`${box} ${cls}`}>{sc.score}</span>;
  }
  if (type !== "health" || typeof row.score !== "number") return <span className="text-slate-400">–</span>;
  const cls = row.score >= 80 ? "bg-green-100 text-green-700" : row.score >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`${box} ${cls}`}>{row.score}</span>;
}

function WhenCell({ d, dateText }: { d: Due; dateText: (d: Date) => string }) {
  const { t } = useLanguage();
  const late = d.days < 0;
  const color = late || d.days === 0 ? "text-red-600" : d.days <= 3 ? "text-amber-700" : "text-slate-700";
  const sub = late
    ? d.premiumDate ? t("ahome.premium_passed") : t(d.days === -1 ? "ahome.late_one" : "ahome.late_many", { count: -d.days })
    : d.days === 0 ? (d.premiumDate ? t("ahome.premium_today") : t("ahome.renews_today"))
    : d.days === 1 ? t("ahome.tomorrow")
    : t("ahome.in_days", { count: d.days });
  return (
    <span className={`flex flex-col leading-tight ${color}`}>
      <b className="text-base">{d.days === 0 ? t("ahome.today") : dateText(d.date)}</b>
      <span className="text-xs font-semibold">{sub}</span>
    </span>
  );
}

function freqText(t: (k: string) => string, perYear: Due["perYear"]) {
  return perYear === 12 ? t("ahome.f_monthly") : perYear === 4 ? t("ahome.f_quarterly") : perYear === 2 ? t("ahome.f_half") : t("ahome.f_yearly");
}

function Contact({ d, phone, name, typeName, dateText }: {
  d: Due; phone: string | null; name: string; typeName: (ty: string) => string; dateText: (d: Date) => string;
}) {
  const { t } = useLanguage();
  const tel = telHref(phone);
  const msg = t(d.premiumDate ? "ahome.wa_premium" : "ahome.wa_renewal", {
    name: name.split(" ")[0],
    type: typeName(d.type),
    insurer: d.row.insurer || "",
    date: dateText(d.date),
  });
  const wa = waHref(phone, msg);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  if (!tel && !wa) {
    return (
      <Link
        href={d.row.customer_id ? `/agent/customers/${d.row.customer_id}` : `/agent/policies/${d.row.id}`}
        onClick={stop}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"
      >
        {d.row.customer_id ? t("ahome.add_phone") : t("ahome.link_family")}
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2" onClick={stop}>
      {tel && (
        <a href={tel} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <Phone size={15} /> {t("ahome.call")}
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-green-600 px-3 text-sm font-bold text-white hover:bg-green-700">
          <MessageCircle size={15} /> WhatsApp
        </a>
      )}
    </div>
  );
}

function DueCard({
  title, tone, desc, sum, money, items, showAll, onShowAll, empty, holder, people, dateText, shortInr, typeName, onOpen,
}: {
  title: string; tone: "amber" | "teal"; desc: string; sum: { amount: number; priced: number }; money: boolean; items: Due[];
  showAll: boolean; onShowAll: () => void; empty: string; holder: (r: HomeRow) => string;
  people: Map<string, Person>; dateText: (d: Date) => string; shortInr: (n: number) => string;
  typeName: (ty: string) => string; onOpen: (id: string) => void;
}) {
  const { t } = useLanguage();
  const shown = showAll ? items : items.slice(0, SHOW);
  const hidden = items.slice(SHOW);
  const hiddenSum = sumDue(hidden);
  const unpriced = items.filter((d) => d.amount == null).length;
  const phoneOf = (d: Due) => (d.row.customer_id ? people.get(d.row.customer_id)?.phone ?? null : null);
  const familyOf = (d: Due) => (d.row.customer_id && people.get(d.row.customer_id)?.name) || null;

  const amountCell = (d: Due) => d.amount == null
    ? <span className="text-sm font-medium text-slate-400">{t("ahome.premium_not_read")}</span>
    : (
      <span className="flex flex-col items-end leading-tight">
        <b className="tabular-nums text-slate-900">{fullInr(d.amount)}</b>
        {d.premiumDate && <span className="text-xs text-slate-500">{freqText(t, d.perYear)}</span>}
      </span>
    );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
          {title}
          <span className={`rounded-full px-2.5 py-0.5 text-sm font-extrabold ${tone === "amber" ? "bg-amber-400 text-slate-900" : "bg-[#0D9488] text-white"}`}>{items.length}</span>
        </h3>
        <p className="mt-0.5 text-sm text-slate-500">
          {desc}{" "}
          {money && sum.priced > 0 && <b className="text-slate-800">{t("ahome.of_premium", { amount: shortInr(sum.amount) })}</b>}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-base text-slate-500">{empty}</p>
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2.5 pl-5 pr-3">{t("ahome.col_due")}</th>
                <th className="px-3 py-2.5">{t("ahome.col_customer")}</th>
                <th className="px-3 py-2.5">{t("ahome.col_insurance")}</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">{t("ahome.col_insurer")}</th>
                <th className="px-3 py-2.5 text-right">{t("ahome.col_premium")}</th>
                <th className="px-3 py-2.5">{t("ahome.col_score")}</th>
                <th className="py-2.5 pl-3 pr-5 text-right">{t("ahome.col_contact")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((d) => (
                <tr key={d.row.id} onClick={() => onOpen(d.row.id)} className="cursor-pointer hover:bg-slate-50/60">
                  <td className="py-3 pl-5 pr-3"><WhenCell d={d} dateText={dateText} /></td>
                  <td className="px-3 py-3">
                    <span className="block font-bold text-slate-900">{holder(d.row)}</span>
                    {familyOf(d) !== holder(d.row) && (
                      <span className="block text-xs text-slate-500">{familyOf(d) ? t("ahome.family_of", { name: familyOf(d)! }) : t("ahome.no_family")}</span>
                    )}
                  </td>
                  <td className="px-3 py-3"><TypeChip type={d.type} label={typeName(d.type)} /></td>
                  <td className="hidden max-w-[220px] px-3 py-3 text-slate-600 lg:table-cell"><span className="line-clamp-2" title={d.row.insurer || ""}>{d.row.insurer || "–"}</span></td>
                  <td className="px-3 py-3 text-right">{amountCell(d)}</td>
                  <td className="px-3 py-3"><ScoreCell row={d.row} /></td>
                  <td className="py-3 pl-3 pr-5">
                    <div className="flex justify-end">
                      <Contact d={d} phone={phoneOf(d)} name={holder(d.row)} typeName={typeName} dateText={dateText} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Phone cards */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {shown.map((d) => (
              <li key={d.row.id} className="px-4 py-3.5">
                <button type="button" onClick={() => onOpen(d.row.id)} className="flex w-full items-start justify-between gap-3 text-left">
                  <span className="min-w-0">
                    <span className="block text-base font-bold text-slate-900">{holder(d.row)}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <TypeChip type={d.type} label={typeName(d.type)} />
                      {d.row.insurer && <span className="truncate">{d.row.insurer}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right"><WhenCell d={d} dateText={dateText} /></span>
                </button>
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <span>{amountCell(d)}</span>
                  <Contact d={d} phone={phoneOf(d)} name={holder(d.row)} typeName={typeName} dateText={dateText} />
                </div>
              </li>
            ))}
          </ul>

          {(hidden.length > 0 || unpriced > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-2.5 text-sm text-slate-500">
              <span>
                {hidden.length > 0 && !showAll && t("ahome.showing", { shown: shown.length, total: items.length })}
                {money && hidden.length > 0 && !showAll && hiddenSum.priced > 0 && ` ${t("ahome.more_worth", { count: hidden.length, amount: shortInr(hiddenSum.amount) })}`}
                {unpriced > 0 && ` ${t(unpriced === 1 ? "ahome.unpriced_one" : "ahome.unpriced_many", { count: unpriced })}`}
              </span>
              {hidden.length > 0 && (
                <button type="button" onClick={onShowAll} className="inline-flex min-h-11 items-center font-bold text-[#0D9488] hover:underline">
                  {showAll ? t("ahome.show_less") : t("ahome.show_all", { count: items.length })}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TypeChip({ type, label }: { type: string; label: string }) {
  const cls: Record<string, string> = {
    health: "bg-emerald-50 text-emerald-700",
    motor: "bg-blue-50 text-blue-700",
    life: "bg-amber-50 text-amber-800",
    term: "bg-purple-50 text-purple-800",
  };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${cls[type] ?? "bg-slate-100 text-slate-600"}`}>{label}</span>;
}

function Opp({ icon, label, value, desc, names, cta, href, children }: {
  icon: React.ReactNode; label: string; value: number; desc: string; names: string[]; cta: string; href: string; children?: React.ReactNode;
}) {
  const { t } = useLanguage();
  const list = names.slice(0, 2).join(", ");
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        <span className="text-[#0D9488]">{icon}</span>{label}
      </p>
      <p className="text-3xl font-extrabold tabular-nums text-slate-900">{value}</p>
      <p className="text-sm leading-snug text-slate-700">{desc}</p>
      {value > 0 && list && (
        <p className="text-sm text-slate-500">
          {list}{names.length > 2 && ` ${t("ahome.and_more", { count: names.length - 2 })}`}
        </p>
      )}
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
      <Link href={href} className="mt-auto inline-flex min-h-11 items-center text-sm font-bold text-[#0D9488] hover:underline">{cta}</Link>
    </div>
  );
}

function RecentChecks({ recent, failed, retrying, onRetry, queue, holder, typeName, onOpen, queueLink = true }: {
  recent: HomeRow[]; failed: Failed[]; retrying: string | null; onRetry: (id: string) => void;
  queue: number | null; holder: (r: HomeRow) => string; typeName: (ty: string) => string; onOpen: (id: string) => void;
  /** My Queue is paid-only; a Free advisor gets Retry here and no link there. */
  queueLink?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{t("ahome.recent_title")}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{t("ahome.recent_desc")}</p>
        </div>
        <Link href="/agent/policies" className="inline-flex min-h-10 shrink-0 items-center text-sm font-bold text-[#0D9488] hover:underline">{t("ahome.all_policies")}</Link>
      </div>
      <ul className="divide-y divide-slate-100">
        {recent.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onOpen(r.id)} className="flex min-h-12 w-full items-center justify-between gap-3 px-5 py-2 text-left hover:bg-slate-50">
              <span className="min-w-0">
                <span className="block truncate font-bold text-slate-900">{holder(r)}</span>
                <span className="block truncate text-xs text-slate-500">{typeName(r.insurance_type || "health")}{r.insurer ? ` · ${r.insurer}` : ""}</span>
              </span>
              <ScoreCell row={r} />
            </button>
          </li>
        ))}
        {failed.map((f) => (
          <li key={f.id} className="flex min-h-12 items-center justify-between gap-3 bg-red-50/60 px-5 py-2">
            <span className="min-w-0">
              <span className="block truncate font-bold text-slate-900">{f.name || f.policy_name || t("ahome.no_name")}</span>
              <span className="block truncate text-xs text-red-700">{f.error_message || t("dashboard.analysis_failed")}</span>
            </span>
            <button
              type="button"
              onClick={() => onRetry(f.id)}
              disabled={retrying === f.id}
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {t("dashboard.retry")}
            </button>
          </li>
        ))}
        {queueLink && queue !== null && queue > 0 && (
          <li>
            <Link href="/agent/my-queue" className="flex min-h-12 items-center justify-between gap-3 bg-amber-50 px-5 py-2 font-bold text-amber-800 hover:bg-amber-100">
              <span>{t(queue === 1 ? "ahome.queue_one" : "ahome.queue_many", { count: queue })}</span>
              <span className="text-sm">{t("ahome.open_queue")}</span>
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}
