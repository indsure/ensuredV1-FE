import { useRef, useState } from "react";
import { Link } from "wouter";
import { X } from "lucide-react";

import { useLanguage } from "@/i18n/LanguageContext";
import { inr, monthText, uploadLicSheet, type LicSheetKind, type LicUploadResult } from "@/lib/lic";

/**
 * Upload an LIC Premium Due list or Commission sheet. One component, used on Policies > LIC
 * and on Upload Policies (founder, 2026-11-28), so both places behave the same.
 */
export function LicUploadPanel({ onDone, onClose, showOpenLink = false }: {
  onDone?: () => void;
  onClose?: () => void;
  /** On Upload Policies: after a sheet is saved, point to the LIC page. */
  showOpenLink?: boolean;
}) {
  const { t, locale } = useLanguage();
  const [kind, setKind] = useState<LicSheetKind | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<LicUploadResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function send() {
    if (!kind || !file) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const r = await uploadLicSheet(kind, file);
      setResult(r);
      setFile(null);
      if (input.current) input.current.value = "";
      onDone?.();
    } catch (e: any) {
      setErr(e?.message || t("lic.upload_failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="lic-upload-title" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="lic-upload-title" className="text-xl font-bold text-slate-900 font-['Playfair_Display']">{t("lic.upload_title")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("lic.upload_sub")}</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={t("lic.close")} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-bold text-slate-800">{t("lic.step_which")}</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {(["due", "commission"] as LicSheetKind[]).map((k) => (
            <label
              key={k}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${kind === k ? "border-2 border-[#0F766E] bg-teal-50" : "border-slate-200 bg-white"}`}
            >
              <input type="radio" name="lic-kind" value={k} checked={kind === k} onChange={() => { setKind(k); setErr(null); }} className="mt-1 h-5 w-5 accent-[#0F766E]" />
              <span>
                <span className="block text-base font-bold text-slate-900">{t(`lic.kind_${k}`)}</span>
                <span className="mt-0.5 block text-sm text-slate-600">{t(`lic.kind_${k}_help`)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-800">{t("lic.step_file")}</p>
        <label className="flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center hover:border-[#0D9488]">
          <span className="text-sm font-bold text-slate-800">{file ? file.name : t("lic.choose_pdf")}</span>
          <span className="text-sm text-slate-600">{t("lic.choose_pdf_help")}</span>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErr(null); }}
          />
        </label>
      </div>

      {err && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>}

      <button
        type="button"
        onClick={send}
        disabled={!kind || !file || busy}
        className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[#0F766E] px-6 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {busy ? t("lic.reading") : t("lic.upload_go")}
      </button>

      {result && <ResultCard r={result} locale={locale} />}
      {result && showOpenLink && (
        <Link href="/agent/lic" className="inline-flex min-h-[44px] items-center text-sm font-bold text-[#0F766E] underline">
          {t("lic.strip_open")}
        </Link>
      )}
    </section>
  );
}

function ResultCard({ r, locale }: { r: LicUploadResult; locale: string }) {
  const { t } = useLanguage();
  const u = r.upload;
  const tot = u.totals as Record<string, number | null>;
  return (
    <div role="status" className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-teal-950">
      <p className="text-base font-bold">
        {u.kind === "due"
          ? t("lic.read_due", { count: u.rowCount, month: monthText(u.period, locale, true) })
          : t("lic.read_cm", { count: u.rowCount, batch: u.batch ?? 1, month: monthText(u.period, locale, true) })}
      </p>
      <p className="text-sm">{t("lic.read_agent", { code: u.agentCode || "?" })}</p>
      {u.kind === "commission" && r.thisSheet && (
        <ul className="space-y-1 text-sm">
          <li>{t("lic.r_paid", { count: r.thisSheet.paidOnList.count, amount: inr(r.thisSheet.paidOnList.amount, locale) })}</li>
          {r.thisSheet.newPolicies > 0 && <li>{t("lic.r_new", { count: r.thisSheet.newPolicies, amount: inr(r.thisSheet.newPremium, locale) })}</li>}
          {r.thisSheet.paidBeforeList > 0 && <li>{t("lic.r_not_on_list", { count: r.thisSheet.paidBeforeList })}</li>}
        </ul>
      )}
      {u.kind === "commission" && (
        <p className="text-sm">
          {t("lic.r_commission", { amount: inr(Number(tot.commission ?? 0), locale) })}
          {tot.incomeTax != null && <> · {t("lic.r_tds", { amount: inr(Number(tot.incomeTax), locale) })}</>}
          {tot.netPayable != null && <> · {t("lic.r_net", { amount: inr(Number(tot.netPayable), locale) })}</>}
        </p>
      )}
      {r.totals ? (
        <p className="text-sm font-bold">{t("lic.r_pending", { count: r.totals.notPaid.count, amount: inr(r.totals.notPaid.amount, locale) })}</p>
      ) : (
        u.kind === "commission" && <p className="text-sm">{t("lic.r_need_due")}</p>
      )}
    </div>
  );
}
