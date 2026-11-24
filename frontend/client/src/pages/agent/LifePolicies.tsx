/**
 * Life section of the advisor portal (/agent/life): every life and term policy
 * in the advisor's book, in one list. Life and Term are tags on the row, not
 * separate sections (founder decision D1), and the counts stay split by tag.
 *
 * Display only: no score, rating, recommendation or adequacy figure. Dates are
 * worked out on the day the list is opened (lib/lifeList, lib/lifePremium).
 * The surrender column is today's engine (lib/policyBook), the same figures as
 * the surrender details page. No rupee totals anywhere on this page (D5).
 * Free plan: the list shows, the surrender column is locked (D11).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { format } from "date-fns";
import { ChevronDown, Download, Loader2, Lock, Sparkles, Trash2 } from "lucide-react";

import { useAgent } from "@/context/AgentContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { dateLocale } from "@/i18n";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { buildBook, type BookRow, type SourceRow } from "@/lib/policyBook";
import { changeLifeType, fetchPolicyValueRows } from "@/lib/lifeApi";
import {
  daysUntil, lifeStats, maturingSoon, premiumDueSoon, toLifeRow,
  type LifeListRow, type LifeType,
} from "@/lib/lifeList";
import { isoDay } from "@/lib/lifePremium";
import { rupees } from "@/lib/policyValueText";
import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { getApiBase } from "@/lib/queryClient";
import { deletePolicyRecord } from "@/lib/policyDelete";
import { canOpenShare, type ShareSource } from "@shared/dataEntryShare";
import { ShareLinkPopover } from "@/components/agent/ShareLinkPopover";
import { setShare } from "@/lib/bookApi";
import { DraftMessageDialog } from "@/components/agent/DraftMessageDialog";
import type { DraftTarget } from "@/lib/draftMessage";
import { exportLifePolicies } from "@/lib/exportPolicies";
import { SurrenderCell } from "@/components/agent/life/SurrenderCell";

type View = "all" | "premium_due" | "maturing";
type TypeChip = "all" | LifeType;

/** Columns the surrender API does not send: read the way the Policies page reads them. */
type RowMeta = {
  id: string; expiry_date: string | null; client_phone: string | null; pdf_url: string | null; filename: string | null; share_token?: string | null; share_enabled?: boolean | null };

const iconBtn =
  "inline-flex h-11 w-11 items-center justify-center rounded text-slate-600 hover:bg-teal-50 hover:text-[#0D9488] disabled:cursor-not-allowed disabled:opacity-30";

const chip = (on: boolean) =>
  "inline-flex min-h-11 items-center rounded-full border px-4 py-1.5 text-sm font-semibold " +
  (on ? "border-[#0D9488] bg-[#0D9488] text-white" : "border-slate-200 bg-white text-slate-700");

export default function LifePolicies() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { agent } = useAgent();
  const { t, locale } = useLanguage();
  const locked = !!agent?.limitedFree;

  const params = new URLSearchParams(search);
  const typeParam = params.get("type");
  const typeChip: TypeChip = typeParam === "life" || typeParam === "term" ? typeParam : "all";
  const viewParam = params.get("view");
  const view: View = viewParam === "premium_due" || viewParam === "maturing" ? viewParam : "all";

  const setFilters = useCallback((next: { type?: TypeChip; view?: View }) => {
    const q = new URLSearchParams();
    const ty = next.type ?? typeChip;
    const vw = next.view ?? view;
    if (ty !== "all") q.set("type", ty);
    if (vw !== "all") q.set("view", vw);
    const qs = q.toString();
    setLocation(qs ? `/agent/life?${qs}` : "/agent/life", { replace: true });
  }, [setLocation, typeChip, view]);

  const [source, setSource] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [meta, setMeta] = useState<Map<string, RowMeta>>(new Map());
  const [draftTarget, setDraftTarget] = useState<DraftTarget | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      const [list, extra] = await Promise.all([
        fetchPolicyValueRows(),
        fetchAllRows((from, to) =>
          supabase
            .from("clients")
            .select("id, expiry_date, client_phone, pdf_url, filename, insurance_type, share_token, share_enabled")
            .eq("agent_id", agent.agentId!)
            .in("insurance_type", ["life", "term"])
            .order("id")
            .range(from, to)
        ).catch(() => [] as RowMeta[]), // the list still works; only the row actions lose their data
      ]);
      setMeta(new Map((extra as RowMeta[]).map((m) => [m.id, m])));
      setSource(list);
    } catch {
      setError(t("life.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [agent?.agentId, t]);

  useEffect(() => { void load(); }, [load]);

  const today = useMemo(() => new Date(), []);
  const rows = useMemo(
    () => source.map((s) => toLifeRow({ ...s, expiry_date: meta.get(s.id)?.expiry_date }, today)).filter((r): r is LifeListRow => r !== null),
    [source, meta, today],
  );
  const book = useMemo(() => new Map<string, BookRow>(buildBook(source).map((b) => [b.id, b])), [source]);

  const typed = useMemo(() => (typeChip === "all" ? rows : rows.filter((r) => r.type === typeChip)), [rows, typeChip]);
  // Life and term counts always cover the whole book; the due and maturing
  // counts follow the type chip, like the list under them.
  const stats = useMemo(() => {
    const book = lifeStats(rows, today);
    const shown = lifeStats(typed, today);
    return { life: book.life, term: book.term, premiumDue: shown.premiumDue, maturing: shown.maturing };
  }, [rows, typed, today]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = typed
      .filter((r) => (view === "premium_due" ? premiumDueSoon(r, today) : view === "maturing" ? maturingSoon(r, today) : true))
      .filter((r) =>
        !q || r.clientName.toLowerCase().includes(q) || (r.planName ?? "").toLowerCase().includes(q) ||
        (r.insurer ?? "").toLowerCase().includes(q) || (r.policyNumber ?? "").toLowerCase().includes(q));
    const byDate = (a: string | null, b: string | null) =>
      a && b ? a.localeCompare(b) : a ? -1 : b ? 1 : 0;
    if (view === "premium_due") return [...list].sort((a, b) => byDate(a.due ? isoDay(a.due.date) : null, b.due ? isoDay(b.due.date) : null));
    if (view === "maturing") return [...list].sort((a, b) => byDate(a.endDate, b.endDate));
    return [...list].sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [typed, view, query, today]);

  const changeType = async (r: LifeListRow, to: LifeType) => {
    setBusyId(r.id);
    try {
      await changeLifeType(r.id, to);
      toast({ title: t(to === "term" ? "life.changed_term" : "life.changed_life") });
      await load();
    } catch (e: any) {
      toast({ title: t("life.change_failed"), description: e?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const download = async (r: LifeListRow) => {
    setBusyId(r.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t("common.not_signed_in"));
      const res = await fetch(`${getApiBase()}/api/agent/clients/${r.id}/download-pdf`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(t("policies.download_failed"));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.get(r.id)?.filename || "policy.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: t("policies.download_failed"), description: e?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: LifeListRow) => {
    if (!agent?.agentId) return;
    setBusyId(r.id);
    try {
      await deletePolicyRecord(r.id, agent.agentId);
      setSource((prev) => prev.filter((s) => s.id !== r.id));
      toast({ title: t("policies.deleted_title"), description: t("policies.deleted_desc") });
    } catch (e: any) {
      void load();
      toast({ title: t("policies.delete_failed"), description: e?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  const fmt = (iso: string | null) => {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    return format(new Date(y, m - 1, d), "d MMM yyyy", { locale: dateLocale(locale) });
  };

  if (error) return <InlineErrorState message={error} onRetry={() => void load()} />;

  const endLabel = typeChip === "term" ? t("life.stat_cover_ending") : t("life.stat_maturing");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("life.title")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{t("life.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/agent/values"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {locked && <Lock className="h-4 w-4" aria-hidden />}
            {t("life.surrender_details")}
          </Link>
          <button
            type="button"
            disabled={exporting || visible.length === 0}
            onClick={async () => {
              setExporting(true);
              try {
                await exportLifePolicies(visible, typeChip);
              } catch {
                toast({ title: t("life.export_failed"), variant: "destructive" });
              } finally {
                setExporting(false);
              }
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            {t("life.export")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: t("life.stat_life"), value: stats.life },
          { label: t("life.stat_term"), value: stats.term },
          { label: t("life.stat_premium_due"), value: stats.premiumDue },
          { label: endLabel, value: stats.maturing },
        ].map((s) => (
          <Card key={s.label} className="border-slate-100 shadow-sm">
            <CardContent className="space-y-1 p-4">
              <div className="text-sm font-bold text-slate-600">{s.label}</div>
              <div className="text-2xl font-bold text-slate-900">{loading ? "…" : s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("life.type_filter")}>
          {(["all", "life", "term"] as TypeChip[]).map((ty) => (
            <button key={ty} type="button" aria-pressed={typeChip === ty} className={chip(typeChip === ty)} onClick={() => setFilters({ type: ty })}>
              {t(`life.type_${ty}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label={t("life.views")}>
            {(["all", "premium_due", "maturing"] as View[]).map((vw) => (
              <button
                key={vw}
                type="button"
                role="tab"
                aria-selected={view === vw}
                onClick={() => setFilters({ view: vw })}
                className={"min-h-10 rounded-lg px-3 text-sm font-semibold " + (view === vw ? "bg-white text-slate-900 shadow-sm" : "text-slate-600")}
              >
                {vw === "maturing" && typeChip === "term" ? t("life.view_cover_ending") : t(`life.view_${vw}`)}
              </button>
            ))}
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("life.search")}
            aria-label={t("life.search")}
            className="h-11 max-w-xs border-slate-200 bg-white"
          />
        </div>
      </div>

      {loading ? (
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-8 text-center text-sm text-slate-500">{t("life.loading")}</CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-8 text-center text-sm text-slate-600">
            {rows.length === 0 ? t("life.empty_all") : t("life.empty_view")}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm" data-mp-block>
          <table className="table-cards w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                {["col_client", "col_type", "col_cover", "col_premium", "col_end", "col_surrender", "col_actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-sm font-bold text-slate-600">
                    {h === "col_actions" ? t("policies.col_actions") : h === "col_end" && typeChip === "term" ? t("life.col_cover_ends") : t(`life.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const b = book.get(r.id);
                const endDays = daysUntil(r.endDate, today);
                const dueIso = r.due ? isoDay(r.due.date) : null;
                const dueDays = daysUntil(dueIso, today);
                const other: LifeType = r.type === "life" ? "term" : "life";
                return (
                  <tr
                    key={r.id}
                    onClick={() => setLocation(`/agent/policies/${r.id}`)}
                    className="cursor-pointer border-b border-slate-50 align-top last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3" data-label={t("life.col_client")} data-cell="title">
                      <div className="font-semibold text-slate-900">{r.clientName || t("life.unnamed")}</div>
                      <div className="text-sm text-slate-600">{[r.insurer, r.planName].filter(Boolean).join(" · ")}</div>
                      {r.status !== "done" && (
                        <div className="text-sm font-semibold text-amber-800">
                          {r.status === "error" || r.status === "failed" ? t("life.status_failed") : t("life.status_pending")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3" data-label={t("life.col_type")} onClick={(e) => e.stopPropagation()}>
                      <div className="min-w-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          disabled={busyId === r.id}
                          aria-label={t("life.change_type_for", { name: r.clientName || t("life.unnamed") })}
                          className={"inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm font-semibold " +
                            (r.type === "term" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-violet-200 bg-violet-50 text-violet-800")}
                        >
                          {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                          {t(`life.tag_${r.type}`)}
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onSelect={() => void changeType(r, other)}>
                            {t(other === "term" ? "life.mark_term" : "life.mark_life")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {r.suggest && (
                        <div className="mt-1.5 text-sm text-slate-700">
                          {t(r.suggest === "term" ? "life.suggest_term" : "life.suggest_life")}{" "}
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void changeType(r, r.suggest!)}
                            className="font-semibold text-[#0f766e] underline underline-offset-2"
                          >
                            {t("life.suggest_change")}
                          </button>
                        </div>
                      )}
                      </div>
                    </td>
                    <td className="px-4 py-3" data-label={t("life.col_cover")}>
                      {r.sumAssured !== null
                        ? <span className="font-semibold tabular-nums text-slate-900">{rupees(r.sumAssured)}</span>
                        : <span className="text-sm text-slate-500">{t("life.not_read")}</span>}
                    </td>
                    <td className="px-4 py-3" data-label={t("life.col_premium")}>
                      <div className="min-w-0">
                      {r.premium !== null ? (
                        <div className="tabular-nums text-slate-900">
                          {rupees(r.premium)}{r.frequency ? <span className="text-sm text-slate-600"> · {r.frequency}</span> : null}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">{t("life.not_read")}</div>
                      )}
                      {r.due ? (
                        <div className="text-sm text-slate-700">
                          {r.due.kind === "passed"
                            ? <span className="font-semibold text-amber-800">{t("life.due_passed", { date: fmt(dueIso) ?? "" })}</span>
                            : t("life.due_next", { date: fmt(dueIso) ?? "" })}
                          {r.due.kind === "scheduled" && dueDays !== null && dueDays <= 30 && (
                            <span className="text-amber-800"> · {t("common.in_days", { days: dueDays })}</span>
                          )}
                          <div className="text-sm text-slate-500">{t(`life.basis_${r.due.basis}`)}</div>
                        </div>
                      ) : r.status === "done" ? (
                        <div className="text-sm text-slate-500">{t(`life.no_due_${r.noDue}`)}</div>
                      ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3" data-label={typeChip === "term" ? t("life.col_cover_ends") : t("life.col_end")}>
                      <div className="min-w-0">
                      {r.endDate ? (
                        <>
                          <div className="font-semibold text-slate-800">{fmt(r.endDate)}</div>
                          {endDays !== null && endDays >= 0 && endDays <= 90 && (
                            <div className="text-sm text-teal-800">{t("common.in_days", { days: endDays })}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-slate-500">{t("life.not_read")}</span>
                      )}
                      </div>
                    </td>
                    <td className="px-4 py-3" data-label={t("life.col_surrender")}>
                      <div className="min-w-0">
                      {locked ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                          <Lock className="h-4 w-4" aria-hidden />{t("life.surrender_locked")}
                        </span>
                      ) : b ? (
                        <SurrenderCell r={b} />
                      ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-3" data-label={t("policies.col_actions")} data-cell="actions" onClick={(e) => e.stopPropagation()}>
                      {confirmId === r.id ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <button type="button" disabled={busyId === r.id} onClick={() => void remove(r)} className="min-h-11 rounded bg-red-600 px-3 text-sm font-semibold text-white disabled:opacity-50">
                            {t("common.delete")}
                          </button>
                          <button type="button" onClick={() => setConfirmId(null)} className="min-h-11 rounded px-3 text-sm font-semibold text-slate-600">
                            {t("common.cancel")}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <button
                            type="button" className={iconBtn} title={t("policies.draft_whatsapp")} aria-label={t("policies.draft_whatsapp")}
                            onClick={() => setDraftTarget({
                              type: "client", id: r.id, name: r.clientName, phone: meta.get(r.id)?.client_phone,
                              insurer: r.insurer, lifeLane: true,
                              renewalDate: r.due?.kind === "scheduled" ? dueIso : null,
                            })}
                          >
                            <Sparkles className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button" className={iconBtn} disabled={!meta.get(r.id)?.pdf_url || busyId === r.id}
                            title={t("policies.download_pdf")} aria-label={t("policies.download_pdf")} onClick={() => void download(r)}
                          >
                            <Download className="h-4 w-4" aria-hidden />
                          </button>
                          <ShareLinkPopover
                            shareUrl={meta.get(r.id)?.share_token && canOpenShare(source.find((x) => x.id === r.id) as ShareSource) ? `${window.location.origin}/shared/report/${meta.get(r.id)!.share_token}` : null}
                            shareEnabled={meta.get(r.id)?.share_enabled === true}
                            onToggle={async (enabled) => {
                              await setShare(r.id, enabled);
                              setMeta((m) => new Map(m).set(r.id, { ...m.get(r.id)!, share_enabled: enabled }));
                            }}
                          />
                          <button
                            type="button" className={iconBtn} title={t("policies.delete_policy")} aria-label={t("policies.delete_policy")}
                            onClick={() => setConfirmId(r.id)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="max-w-3xl space-y-2 text-sm text-slate-600">
        <p>{t("life.foot_dates")}</p>
        <p>{t("life.foot_no_totals")}</p>
      </div>

      <DraftMessageDialog target={draftTarget} open={!!draftTarget} onClose={() => setDraftTarget(null)} />
    </div>
  );
}
