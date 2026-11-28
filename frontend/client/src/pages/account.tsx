import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Download, Loader2, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/i18n/LanguageContext";
import { downloadAccountExport, type ExportProgress } from "@/lib/exportDownload";
import { ExportProgressBar } from "@/components/ExportProgressBar";
import { clearSessionKeys } from "@/lib/clearSessionKeys";

// The server only deletes when it receives this exact phrase (accountData.ts).
const CONFIRM_PHRASE = "DELETE MY ACCOUNT";

/** The mobile number is also how they sign in, so it is read from the profile, not the login. */
function PhoneRow({ initial }: { initial: string }) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState(initial);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setPhone((p) => p || initial);
    let on = true;
    apiFetch("/api/me/portfolio").then((r) => (r.ok ? r.json() : null)).then((d) => { if (on && d && "phone" in d) setPhone(d.phone ?? ""); }).catch(() => {});
    return () => { on = false; };
  }, [initial]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const digits = (draft ?? "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) return setErr(t("book.phone_bad"));
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/me/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: digits }) });
      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) return setErr(body.error === "PHONE_TAKEN" ? t("book.phone_taken") : t("book.phone_failed"));
      setPhone(body.phone ?? digits);
      setDraft(null);
    } catch {
      setErr(t("book.phone_failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <dt className="text-sm text-[var(--color-text-muted)]">{t("cauth.su_mobile")}</dt>
      <dd className="font-semibold">
        {draft === null ? (
          <span className="flex flex-wrap items-center gap-3">
            {phone || t("book.phone_none")}
            <button type="button" className="min-h-11 text-base font-semibold text-[var(--color-teal-600)] underline" onClick={() => { setErr(null); setDraft(phone); }}>{t("book.phone_change")}</button>
          </span>
        ) : (
          <form onSubmit={save} className="mt-1 space-y-2">
            <input type="tel" inputMode="numeric" autoComplete="tel-national" aria-label={t("cauth.su_mobile")} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-12 w-full rounded-xl border border-[var(--color-border-light)] px-4 text-base" />
            <p className="text-sm font-normal text-[var(--color-text-secondary)]">{t("book.phone_note")}</p>
            {err && <p role="alert" className="text-sm font-medium text-red-700">{err}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className="inline-flex h-12 items-center rounded-xl bg-[var(--color-cta)] px-6 text-base font-bold text-white disabled:opacity-50">{t("xform.save")}</button>
              <button type="button" disabled={busy} className="h-12 px-3 text-base font-semibold" onClick={() => setDraft(null)}>{t("common.cancel")}</button>
            </div>
          </form>
        )}
      </dd>
    </div>
  );
}

/**
 * The consumer's own account page: who they are signed in as, a copy of
 * everything we hold, and a way to delete it all. The Privacy Policy promises
 * both, and the server routes (/api/me/export, DELETE /api/me/account) exist;
 * this is the button for them. Rendered inside UserProtectedRoute.
 */
export default function Account() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [who, setWho] = useState<{ email: string; name: string; phone: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const meta = session?.user.user_metadata ?? {};
      setWho({
        email: session?.user.email ?? "",
        name: String(meta.full_name || ""),
        phone: String(meta.phone || ""),
      });
    });
  }, []);

  /* Live progress while the zip streams in; see lib/exportDownload.ts. */
  async function downloadData() {
    setExporting(true);
    setExportErr(null);
    try {
      await downloadAccountExport("/api/me/export", setExportProgress);
    } catch (err) {
      const busy = err instanceof Error && err.message === "EXPORT_429";
      setExportErr(busy ? t("export_progress.busy") : t("cflow.ac_export_failed"));
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }

  async function deleteAccount() {
    if (confirmText.trim() !== CONFIRM_PHRASE) return;
    setDeleting(true);
    setDeleteErr(null);
    try {
      const res = await apiFetch("/api/me/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: CONFIRM_PHRASE }),
      });
      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setDeleteErr(body?.message || t("cflow.ac_delete_failed"));
        return;
      }
      // Signed out only when they leave: the route gate listens for sign-out
      // and would swap this page for the login screen before it is read.
      setDeleted(true);
    } catch {
      setDeleteErr(t("cflow.ac_delete_failed"));
    } finally {
      setDeleting(false);
    }
  }

  const ready = confirmText.trim() === CONFIRM_PHRASE;

  if (deleted) {
    return (
      <div className="min-h-screen bg-[var(--color-cream-main)] flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4" role="status">
          <h1 className="font-serif text-3xl text-[var(--color-navy-900)]">{t("cflow.ac_deleted_h")}</h1>
          <p className="text-base text-[var(--color-text-secondary)]">{t("cflow.ac_deleted_body")}</p>
          <button
            type="button"
            onClick={() => { clearSessionKeys(); void supabase.auth.signOut().catch(() => {}).finally(() => setLocation("/")); }}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-[var(--color-cta)] px-6 text-base font-bold text-white hover:bg-[var(--color-cta-hover)]"
          >
            {t("cflow.ac_home")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] text-[var(--color-text-main)]">
      <main className="max-w-xl mx-auto px-5 sm:px-6 py-8 space-y-6">
        <Link href="/app">
          <span className="inline-flex items-center gap-1.5 text-base font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-navy-900)] cursor-pointer">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {t("cflow.ac_back")}
          </span>
        </Link>
        <h1 className="font-serif text-3xl text-[var(--color-navy-900)]">{t("cflow.ac_title")}</h1>

        <section className="rounded-2xl border border-[var(--color-border-light)] bg-white p-6 space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-navy-900)]">
            <UserRound className="w-5 h-5 text-[var(--color-teal-600)]" aria-hidden="true" /> {t("cflow.ac_signed_in")}
          </h2>
          <dl className="space-y-2 text-base">
            {who?.name && (
              <div><dt className="text-sm text-[var(--color-text-muted)]">{t("cauth.su_name")}</dt><dd className="font-semibold">{who.name}</dd></div>
            )}
            <div><dt className="text-sm text-[var(--color-text-muted)]">{t("cflow.ac_email")}</dt><dd className="font-semibold break-all">{who?.email || "..."}</dd></div>
            <PhoneRow initial={who?.phone ?? ""} />
          </dl>
        </section>

        <section className="rounded-2xl border border-[var(--color-border-light)] bg-white p-6 space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-navy-900)]">
            <Download className="w-5 h-5 text-[var(--color-teal-600)]" aria-hidden="true" /> {t("cflow.ac_export_h")}
          </h2>
          <p className="text-base text-[var(--color-text-secondary)]">{t("cflow.ac_export_body")}</p>
          <button
            type="button"
            onClick={() => void downloadData()}
            disabled={exporting}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-cta)] px-6 text-base font-bold text-white hover:bg-[var(--color-cta-hover)] disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
            {exporting ? t("cflow.ac_exporting") : t("cflow.ac_export_cta")}
          </button>
          <ExportProgressBar progress={exportProgress} />
          {exportErr && <p role="alert" className="text-sm font-medium text-red-700">{exportErr}</p>}
        </section>

        <section className="rounded-2xl border border-red-200 bg-white p-6 space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-red-700">
            <Trash2 className="w-5 h-5" aria-hidden="true" /> {t("cflow.ac_delete_h")}
          </h2>
          <p className="text-base text-[var(--color-text-secondary)]">{t("cflow.ac_delete_body")}</p>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-[var(--color-navy-900)]">{t("cflow.ac_delete_type", { phrase: CONFIRM_PHRASE })}</span>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              className="w-full h-12 rounded-xl border border-[var(--color-border-light)] bg-white px-4 text-base tracking-wide"
            />
          </label>
          <button
            type="button"
            onClick={() => void deleteAccount()}
            disabled={!ready || deleting}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-red-700 px-6 text-base font-bold text-white hover:bg-red-800 disabled:opacity-40"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Trash2 className="w-4 h-4" aria-hidden="true" />}
            {deleting ? t("cflow.ac_deleting") : t("cflow.ac_delete_cta")}
          </button>
          {deleteErr && <p role="alert" className="text-sm font-medium text-red-700">{deleteErr}</p>}
        </section>
      </main>
    </div>
  );
}
