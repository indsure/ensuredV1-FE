import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CalendarClock, MessageCircle, Phone, Sparkles } from "lucide-react";

import { DraftMessageDialog } from "@/components/agent/DraftMessageDialog";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { useAgent } from "@/context/AgentContext";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { fetchReplacedIds } from "@/lib/bookApi";
import { formatAmount } from "@/lib/customers";
import type { DraftTarget } from "@/lib/draftMessage";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { dueList, HOME_SELECT, LATE_WINDOW_DAYS, startOfDay, type Due, type HomeRow } from "@/lib/home";
import { typeLabel } from "@/lib/insuranceTypes";
import { telHref, waHref } from "@/lib/leads";
import { fetchRenewalStatuses, renewalKey, RENEWAL_STATUSES, setRenewalStatus, ymd, type RenewalStatus } from "@/lib/renewals";
import { supabase } from "@/lib/supabase";

type Row = HomeRow & { client_phone: string | null };
const WINDOWS = [30, 60, 90] as const;
const inDays = (n: number) => { const d = startOfDay(new Date()); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); };

/** The advisor's own customers, by the same due-date rules as Home, up to 90 days ahead. */
export default function OwnRenewals() {
  const { agent } = useAgent();
  const { t, locale } = useLanguage();
  const [, setLocation] = useLocation();
  const [rows, setRows] = useState<Row[]>([]);
  const [replaced, setReplaced] = useState<Set<string>>(new Set());
  const [phones, setPhones] = useState<Map<string, string>>(new Map());
  const [statuses, setStatuses] = useState<Map<string, RenewalStatus> | null>(null);
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(60);
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftTarget | null>(null);

  const load = useCallback(async () => {
    if (!agent?.agentId) return;
    const agentId = agent.agentId;
    setLoading(true);
    setError(false);
    try {
      const [list, rep, cust, st] = await Promise.all([
        fetchAllRows<any>((from, to) =>
          supabase.from("clients").select(`${HOME_SELECT}, client_phone`).eq("agent_id", agentId).eq("status", "done").order("id").range(from, to) as any),
        fetchReplacedIds(agentId),
        fetchAllRows<any>((from, to) => supabase.from("customers").select("id, phone").eq("agent_id", agentId).order("id").range(from, to)).catch(() => []),
        fetchRenewalStatuses(agentId, inDays(-LATE_WINDOW_DAYS), inDays(90)).catch(() => null),
      ]);
      setRows(list as Row[]);
      setReplaced(rep);
      setPhones(new Map(cust.filter((c: any) => c.phone).map((c: any) => [c.id, c.phone])));
      setStatuses(st);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [agent?.agentId]);
  useEffect(() => { void load(); }, [load]);

  const all = useMemo(() => dueList(rows, startOfDay(new Date()), { ahead: days, replaced }), [rows, days, replaced]);
  const types = useMemo(() => Array.from(new Set(all.map((d) => d.type))), [all]);
  const shown = type === "all" ? all : all.filter((d) => d.type === type);
  const groups = [
    { key: "late", rows: shown.filter((d) => d.days < 0), tone: "text-red-600" },
    { key: "g30", rows: shown.filter((d) => d.days >= 0 && d.days <= 30), tone: "text-amber-700" },
    { key: "g60", rows: shown.filter((d) => d.days > 30 && d.days <= 60), tone: "text-slate-700" },
    { key: "g90", rows: shown.filter((d) => d.days > 60), tone: "text-slate-600" },
  ].filter((g) => g.rows.length);

  async function mark(d: Due, next: RenewalStatus | null) {
    if (!agent?.agentId || !statuses) return;
    const key = renewalKey(d.row.id, d.date);
    setSaving(key);
    try {
      await setRenewalStatus(agent.agentId, d.row.id, d.date, next);
      setStatuses((m) => { const c = new Map(m ?? []); if (next) c.set(key, next); else c.delete(key); return c; });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("ahome.save_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(null);
    }
  }

  const tl = (ty: string) => tOr(t, `common.type_${ty}`, typeLabel(ty));
  const chip = (on: boolean) => `min-h-11 rounded-lg px-4 text-sm font-bold ${on ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`;
  if (error) return <InlineErrorState onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {WINDOWS.map((n) => <button key={n} type="button" aria-pressed={days === n} className={chip(days === n)} onClick={() => setDays(n)}>{t("book.next_days", { days: n })}</button>)}
        <select aria-label={t("book.type")} value={type} onChange={(e) => setType(e.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">{t("book.all_types")}</option>
          {types.map((ty) => <option key={ty} value={ty}>{tl(ty)}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      ) : !groups.length ? (
        <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center text-slate-500 shadow-sm">
          <CalendarClock className="mx-auto mb-3 h-9 w-9 text-slate-300" /> {t("book.none_due", { days })}
        </div>
      ) : groups.map((g) => (
        <section key={g.key}>
          <h2 className={`mb-2 text-sm font-bold ${g.tone}`}>{t(`book.${g.key}`)} ({g.rows.length})</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {g.rows.map((d) => {
              const r = d.row as Row;
              const name = r.policyholder_name || r.name || t("ahome.no_name");
              const phone = (r.customer_id && phones.get(r.customer_id)) || r.client_phone;
              const wa = waHref(phone, `Hello ${name.split(" ")[0]}, `);
              const tel = telHref(phone);
              const key = renewalKey(r.id, d.date);
              return (
                <div key={key} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" className="min-w-0 text-left" onClick={() => setLocation(`/agent/policies/${r.id}`)}>
                      <span className="block truncate font-bold text-slate-800">{name}</span>
                      <span className="block truncate text-sm text-slate-600">{tl(d.type)}, {r.insurer || t("renewals.unknown_insurer")}</span>
                    </button>
                    <div className="shrink-0 text-right text-sm">
                      <div className={`font-bold ${d.days < 0 ? "text-red-600" : "text-slate-800"}`}>{d.date.toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                      <div className="text-slate-600">{d.days < 0 ? t(d.premiumDate ? "book.date_passed" : "renewals.overdue_days", { days: -d.days }) : d.days === 0 ? t("renewals.due_today") : t("renewals.in_days", { days: d.days })}</div>
                      <div className="text-slate-600">{d.amount != null ? formatAmount(Math.round(d.amount)) : t("book.premium_unread")}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={wa ?? undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!wa} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#25D366] px-4 text-sm font-bold text-white ${wa ? "" : "pointer-events-none opacity-40"}`}><MessageCircle size={16} /> {t("leads.whatsapp")}</a>
                    <a href={tel ?? undefined} aria-label={t("leads.call")} aria-disabled={!tel} className={`inline-flex min-h-11 items-center rounded-lg bg-slate-800 px-4 text-white ${tel ? "" : "pointer-events-none opacity-40"}`}><Phone size={16} /></a>
                    <button type="button" aria-label={t("policies.draft_whatsapp")} className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-4 text-[#0D9488]" onClick={() => setDraft({ type: "client", id: r.id, name, phone, insurer: r.insurer, lifeLane: d.premiumDate, renewalDate: d.days >= 0 ? ymd(d.date) : null })}><Sparkles size={16} /></button>
                    {!d.premiumDate && <button type="button" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700" onClick={() => setLocation(`/agent/uploads?renews=${r.id}&type=${d.type}`)}>{t("book.renew")}</button>}
                    {statuses && (
                      <select aria-label={t("book.outcome")} disabled={saving === key} value={statuses.get(key) ?? ""} onChange={(e) => void mark(d, (e.target.value || null) as RenewalStatus | null)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700">
                        <option value="">{t("book.outcome")}</option>
                        {RENEWAL_STATUSES.map((s) => <option key={s} value={s}>{t(`book.o_${s}`)}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <DraftMessageDialog target={draft} open={!!draft} onClose={() => setDraft(null)} />
    </div>
  );
}
