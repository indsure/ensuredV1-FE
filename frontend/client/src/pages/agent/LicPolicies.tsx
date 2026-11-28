import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { FileUp, MessageCircle, Search, Trash2 } from "lucide-react";

import { useAgent } from "@/context/AgentContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { LicUploadPanel } from "@/components/agent/LicUploadPanel";
import {
  dayText, fetchLicOverview, inr, monthText, niceName, planLabel, reminderHref, removeLicUpload,
  type LicMode, type LicOverview, type LicRow, type LicStatus,
} from "@/lib/lic";

// Policies > LIC (founder, 2026-11-28): the agent uploads LIC's Premium Due list and Commission
// sheet, and this shows who has not paid yet, longest unpaid first.

type StatusFilter = "unpaid" | "past_grace" | "in_grace" | "part_paid" | "paid" | "all";
type ModeFilter = "all" | LicMode;

const STATUS_CHIP: Record<LicStatus, string> = {
  past_grace: "bg-red-50 text-red-800 border-red-200",
  part_paid: "bg-violet-50 text-violet-800 border-violet-200",
  in_grace: "bg-amber-50 text-amber-900 border-amber-200",
  due: "bg-sky-50 text-sky-900 border-sky-200",
  paid: "bg-teal-50 text-teal-800 border-teal-200",
};

export default function LicPolicies() {
  const { t, locale } = useLanguage();
  const { agent } = useAgent();
  const [data, setData] = useState<LicOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("unpaid");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchLicOverview();
      setData(d);
      if (!d.dueList) setShowUpload(true);
    } catch (e: any) {
      setError(e?.message || t("lic.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const rows = data?.rows ?? [];
  const counts = useMemo(() => {
    const c = { unpaid: 0, past_grace: 0, in_grace: 0, part_paid: 0, paid: 0, all: rows.length };
    for (const r of rows) {
      if (r.status === "paid") c.paid++;
      else c.unpaid++;
      if (r.status === "past_grace") c.past_grace++;
      if (r.status === "in_grace" || r.status === "due") c.in_grace++;
      if (r.status === "part_paid") c.part_paid++;
    }
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "unpaid" && r.status === "paid") return false;
      if (status === "in_grace" && r.status !== "in_grace" && r.status !== "due") return false;
      if (status !== "unpaid" && status !== "all" && status !== "in_grace" && r.status !== status) return false;
      if (mode !== "all" && r.mode !== mode) return false;
      if (needle && !`${r.holderName} ${r.policyNo}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, status, mode, q]);

  const cm = data?.latestCommission;
  const processedOn = (cm?.totals?.processedOn as string | null) ?? null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {data?.dueList && (
            <p className="text-xs font-black uppercase tracking-widest text-amber-700">
              {t("lic.eyebrow", { month: monthText(data.dueList.period, locale, true) })}
            </p>
          )}
          <h1 className="mt-1 text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t("lic.title")}</h1>
          {data?.totals && (
            <p className="mt-1 text-base text-slate-600">
              {t("lic.sub", { count: data.totals.notPaid.count, amount: inr(data.totals.notPaid.amount, locale) })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowUpload((v) => !v)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-5 text-sm font-bold text-white hover:bg-[#0B5F59]"
        >
          <FileUp className="h-4 w-4" />
          {t("lic.upload_button")}
        </button>
      </header>

      {showUpload && <LicUploadPanel onDone={load} onClose={data?.dueList ? () => setShowUpload(false) : undefined} />}

      {loading && !data ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : error ? (
        <InlineErrorState message={error} onRetry={load} />
      ) : !data?.dueList ? (
        <EmptyState hasCommission={!!cm} />
      ) : (
        <>
          <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
            {cm
              ? t("lic.checked_against", {
                  batch: cm.batch ?? 1,
                  month: monthText(cm.period, locale),
                  date: processedOn ? dayText(processedOn, locale) : dayText(cm.createdAt, locale),
                })
              : t("lic.no_commission_yet")}
          </p>

          {data.totals && (
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label={t("lic.tile_not_paid")} value={String(data.totals.notPaid.count)} hint={inr(data.totals.notPaid.amount, locale)} tone="red" />
              <Tile label={t("lic.tile_past_grace")} value={String(data.totals.pastGrace.count)} hint={inr(data.totals.pastGrace.amount, locale)} tone="red" />
              <Tile label={t("lic.tile_in_grace")} value={String(data.totals.inGrace.count + data.totals.notYetDue.count)} hint={inr(data.totals.inGrace.amount + data.totals.notYetDue.amount, locale)} tone="amber" />
              <Tile label={t("lic.tile_paid")} value={String(data.totals.paid.count)} hint={inr(data.totals.paid.amount, locale)} tone="teal" />
            </section>
          )}

          <section className="space-y-3">
            <div role="group" aria-label={t("lic.filter_status")} className="flex flex-wrap gap-2">
              {(["unpaid", "past_grace", "in_grace", "part_paid", "paid", "all"] as StatusFilter[])
                .filter((s) => s !== "part_paid" || counts.part_paid > 0)
                .map((s) => (
                  <Chip key={s} on={status === s} onClick={() => setStatus(s)}>
                    {t(`lic.f_${s}`)} · {counts[s]}
                  </Chip>
                ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div role="group" aria-label={t("lic.filter_mode")} className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-600">{t("lic.pays")}</span>
                {(["all", "M", "Q", "H", "Y"] as ModeFilter[]).map((m) => (
                  <Chip key={m} on={mode === m} onClick={() => setMode(m)}>
                    {t(`lic.mode_${m}`)}
                  </Chip>
                ))}
              </div>
              <div className="relative sm:ml-auto sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("lic.search")}
                  aria-label={t("lic.search")}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                />
              </div>
            </div>
          </section>

          {shown.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-500">
              {counts.unpaid === 0 && status === "unpaid" ? t("lic.all_paid") : t("lic.none_match")}
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {shown.map((r) => (
                <RowCard key={`${r.policyNo}-${r.fup}`} r={r} advisor={agent?.name ?? null} />
              ))}
            </ul>
          )}
        </>
      )}

      {data && data.uploads.length > 0 && <History uploads={data.uploads} onRemoved={load} />}
    </div>
  );
}

/* ── one policy ──────────────────────────────────────────────────────── */

function RowCard({ r, advisor }: { r: LicRow; advisor: string | null }) {
  const { t, locale } = useLanguage();
  // Only the term the client chose (from a commission sheet). LIC's own Tm on the due list
  // is 100 minus entry age for whole-life plans, so showing it would mislead.
  const term = r.chosenTerm;
  const note = (() => {
    switch (r.status) {
      case "paid": return t("lic.note_paid");
      case "part_paid": return t("lic.note_part_paid", { paid: inr(r.paidAmount, locale), left: inr(r.stillDue, locale) });
      case "due": return t("lic.note_due", { date: dayText(r.dueDate, locale) });
      case "in_grace": return t("lic.note_in_grace", { date: dayText(r.graceEnds, locale) });
      default:
        // Maturing or last-premium policies are not told to revive (critic item 6).
        return r.flag === "MT" || r.flag === "LP"
          ? t("lic.note_grace_ended", { date: dayText(r.graceEnds, locale) })
          : t("lic.note_past_grace", { date: dayText(r.graceEnds, locale) });
    }
  })();
  const behind = r.dueCount > 1
    ? t("lic.premiums_owed", { count: r.dueCount })
    : r.monthsBehind > 0
      ? t(r.monthsBehind === 1 ? "lic.months_behind_one" : "lic.months_behind", { count: r.monthsBehind })
      : null;

  return (
    <li className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/agent/lic/policy/${r.policyNo}`} className="text-base font-bold text-slate-900 underline-offset-2 hover:text-[#0F766E] hover:underline">
            {niceName(r.holderName)}
          </Link>
          <div className="mt-0.5 text-sm text-slate-600">{t("lic.policy_no", { no: r.policyNo })}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums text-slate-900">{inr(r.status === "paid" ? r.totalPrem : r.stillDue, locale)}</div>
          {behind && <div className="text-sm text-slate-600">{behind}</div>}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div className="col-span-2"><dt className="sr-only">{t("lic.plan")}</dt><dd className="text-slate-800">{planLabel(r.planNo)}</dd></div>
        {term != null && <div><dt className="sr-only">{t("lic.term")}</dt><dd className="text-slate-700">{t("lic.term_years", { count: term })}</dd></div>}
        <div><dt className="sr-only">{t("lic.pays")}</dt><dd className="text-slate-700">{t(`lic.mode_${r.mode}`)}</dd></div>
        <div className="col-span-2 sm:col-span-4"><dt className="sr-only">{t("lic.unpaid_since")}</dt>
          <dd className="text-slate-700">{t("lic.unpaid_since_month", { month: monthText(r.fup, locale) })}</dd></div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-bold ${STATUS_CHIP[r.status]}`}>
            {t(`lic.status_${r.status}`)}
          </span>
          <span className="text-sm text-slate-600">{note}</span>
          {r.flag === "LP" && <span className="text-sm font-semibold text-violet-800">{t("lic.flag_lp")}</span>}
          {r.flag === "MT" && <span className="text-sm font-semibold text-violet-800">{t("lic.flag_mt")}</span>}
        </div>
        {r.status !== "paid" && (
          <a
            href={reminderHref(r, locale, advisor)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#0F766E] px-4 text-sm font-bold text-[#0F766E] hover:bg-teal-50"
          >
            <MessageCircle className="h-4 w-4" />
            {t("lic.remind")}
          </a>
        )}
      </div>
    </li>
  );
}

/* ── history ─────────────────────────────────────────────────────────── */

function History({ uploads, onRemoved }: { uploads: LicOverview["uploads"]; onRemoved: () => void }) {
  const { t, locale } = useLanguage();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function remove(id: number) {
    setBusyId(id);
    try {
      await removeLicUpload(id);
      toast({ title: t("lic.removed") });
      setConfirmId(null);
      onRemoved();
    } catch (e: any) {
      toast({ title: e?.message || t("lic.remove_failed"), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="lic-history" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 id="lic-history" className="text-lg font-bold text-slate-900">{t("lic.history")}</h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {uploads.map((u) => {
          const name = u.kind === "due"
            ? t("lic.h_due", { month: monthText(u.period, locale, true) })
            : t("lic.h_cm", { batch: u.batch ?? 1, month: monthText(u.period, locale, true) });
          return (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900">{name}</div>
                <div className="text-sm text-slate-600">
                  {t("lic.h_meta", { count: u.rowCount, date: dayText(u.createdAt, locale), code: u.agentCode || "?" })}
                </div>
              </div>
              {confirmId === u.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-700">{t("lic.remove_confirm", { name })}</span>
                  <button type="button" onClick={() => remove(u.id)} disabled={busyId === u.id}
                    className="min-h-[44px] rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                    {busyId === u.id ? "…" : t("lic.remove_yes")}
                  </button>
                  <button type="button" onClick={() => setConfirmId(null)}
                    className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700">
                    {t("common.cancel")}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmId(u.id)} aria-label={t("lic.remove_label", { name })}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                  {t("lic.remove")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-slate-600">{t("lic.history_note")}</p>
    </section>
  );
}

/* ── small parts ─────────────────────────────────────────────────────── */

function EmptyState({ hasCommission }: { hasCommission: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 text-sm text-slate-700 shadow-sm">
      <p className="text-base font-bold text-slate-900">{t(hasCommission ? "lic.empty_need_due" : "lic.empty_title")}</p>
      <p className="mt-2">{t("lic.empty_body")}</p>
      <p className="mt-2">
        <Link href="/agent/lic-plans" className="font-bold text-[#0F766E] underline">{t("lic.empty_directory")}</Link>
      </p>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-[44px] rounded-full border px-4 text-sm ${on ? "border-[#0B1120] bg-[#0B1120] font-bold text-white" : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"}`}
    >
      {children}
    </button>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: "red" | "amber" | "teal" }) {
  const c = tone === "red" ? "border-red-100 bg-red-50 text-red-900" : tone === "amber" ? "border-amber-100 bg-amber-50 text-amber-950" : "border-teal-100 bg-teal-50 text-teal-900";
  return (
    <div className={`rounded-2xl border p-4 ${c}`}>
      <div className="text-sm font-bold">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-sm tabular-nums">{hint}</div>
    </div>
  );
}
