/**
 * Public advisor landing page — indsure.in/a/<slug>
 *
 * The page an advisor shares on WhatsApp, in an Instagram bio, or as a printed
 * QR code. Everything a visitor submits lands in that advisor's leads pipeline.
 *
 * Design constraints that shaped this file:
 *  • The reader is often 40+, on a phone, inside Instagram's or WhatsApp's
 *    in-app webview. So: big targets, high contrast, plain sentences, no
 *    drag-and-drop, and a plain <input type=file> rather than a dropzone
 *    library (webviews handle the native picker far more reliably).
 *  • No site navigation. A landing page with a nav bar leaks the visitor off to
 *    /pricing. The only links out are the advisor's own CTAs.
 *  • All copy is fixed and translated, never advisor-authored. The advisor
 *    supplies identity only — name, photo, city, languages, lines. Nothing on
 *    this page is a claim that would need backing.
 *  • Page language starts from the advisor's own primary_locale (he is
 *    advertising to his audience, not to the site's saved preference), and the
 *    visitor can switch.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { Loader2, Upload, MessageCircle, Phone, Check, X, ShieldCheck, FileText } from "lucide-react";
import { getTranslator } from "@/i18n";
import { useSEO } from "@/hooks/use-seo";
import { MpEvent, track } from "@/lib/mixpanel";
import {
  fetchPublicPage,
  recordView,
  submitAdvisorLead,
  consentSentence,
  readUtm,
  waDeepLink,
  LOB_META,
  SPOKEN_LANGUAGES,
  type PublicAdvisorPage,
  type InactiveAdvisorPage,
  type LineOfBusiness,
  type PageLocale,
} from "@/lib/advisorPage";

type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "inactive"; name: string | null }
  | { kind: "live"; page: PublicAdvisorPage };

type Intent = "policy" | "talk";

export default function AdvisorPage() {
  const [, params] = useRoute("/a/:slug");
  const slug = (params?.slug ?? "").toLowerCase();

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [locale, setLocale] = useState<PageLocale>("en");
  const [openForm, setOpenForm] = useState<Intent | null>(null);
  const [sent, setSent] = useState<{ name: string; lob: LineOfBusiness | ""; intent: Intent } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const utm = useMemo(() => readUtm(), []);
  const t = useMemo(() => getTranslator(locale), [locale]);

  useEffect(() => {
    let alive = true;
    fetchPublicPage(slug)
      .then((res) => {
        if (!alive) return;
        if (!res) return setState({ kind: "notfound" });
        if (!res.live) return setState({ kind: "inactive", name: res.display_name });
        setState({ kind: "live", page: res });
        setLocale(res.primary_locale);
        recordView(slug, utm.source);
      })
      .catch(() => alive && setState({ kind: "notfound" }));
    return () => {
      alive = false;
    };
  }, [slug, utm.source]);

  const advisorName = state.kind === "live" ? state.page.display_name : "";

  useSEO({
    title: advisorName ? `${advisorName} — Insurance Advisor | IndSure` : "Insurance Advisor | IndSure",
    description: advisorName
      ? `Talk to ${advisorName} about your insurance, or send a policy for a plain-language review.`
      : "Talk to a licensed insurance advisor.",
    ogImage: state.kind === "live" && state.page.photo_url ? state.page.photo_url : "/opengraph.jpg",
    // Hundreds of near-identical advisor pages on the main domain would read as
    // thin/doorway content and drag on the site's own rankings. These are ad and
    // referral landing pages — they need to be shareable, not indexed.
    noindex: true,
  });

  // Keep <html lang> in step with the toggle. Screen readers pick their voice
  // and pronunciation from this, so a Hindi page announced as English is read
  // out wrong — and this page is aimed at people who may well be using one.
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [locale]);

  if (state.kind === "loading") {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--color-cream-main)]">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--color-green-primary)]" />
      </div>
    );
  }

  if (state.kind === "notfound") return <SimpleNotice title="Page not found" body="This link doesn't lead anywhere. Please check it with the person who shared it." />;

  if (state.kind === "inactive") {
    return (
      <SimpleNotice
        title={state.name ? `${state.name}'s page is no longer active` : "This page is no longer active"}
        body="This advisor is not taking enquiries through IndSure right now. If you need help with a policy, you can still check yours on IndSure."
        cta={{ label: "Go to IndSure", href: "/" }}
      />
    );
  }

  const page = state.page;

  function startForm(intent: Intent) {
    setOpenForm(intent);
    setSent(null);
    // The form renders below the fold on a phone; scroll it into view after
    // React has painted it.
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] text-[var(--color-text-main)] font-sans flex flex-col">
      {/* Minimal bar: brand + language. No navigation on purpose. */}
      <header className="border-b border-[var(--color-border-light)] bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-2xl px-5 h-14 flex items-center justify-between">
          <span className="font-serif text-lg font-bold tracking-tight">IndSure</span>
          <div className="flex items-center gap-1 rounded-full border border-[var(--color-border-light)] bg-white p-1">
            {(["en", "hi"] as PageLocale[]).map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  locale === l
                    ? "bg-[var(--color-green-primary)] text-white"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                }`}
              >
                {l === "en" ? "EN" : "हिंदी"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-5 pb-16">
        {/* ── Advisor ─────────────────────────────────────────────────── */}
        <section className="pt-9 pb-7 text-center">
          {page.photo_url ? (
            <img
              src={page.photo_url}
              alt={page.display_name}
              className="mx-auto h-28 w-28 rounded-full object-cover ring-4 ring-white shadow-lg"
              loading="eager"
            />
          ) : (
            <div className="mx-auto h-28 w-28 rounded-full bg-[var(--color-green-primary)]/10 grid place-items-center ring-4 ring-white shadow-lg">
              <span className="font-serif text-3xl font-bold text-[var(--color-green-primary)]">
                {page.display_name.trim().charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <h1 className="mt-5 font-serif text-3xl sm:text-4xl font-bold tracking-tight">
            {page.display_name}
          </h1>
          <p className="mt-1 text-[var(--color-text-secondary)]">
            {t("advisor_page.role")}
            {page.city ? ` · ${page.city}` : ""}
          </p>

          {page.languages.length > 0 && (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {t("advisor_page.speaks")}{" "}
              {page.languages
                .map((c) => SPOKEN_LANGUAGES.find((l) => l.code === c)?.label ?? c)
                .join(" · ")}
            </p>
          )}

          {page.lines_of_business.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {page.lines_of_business.map((lob) => (
                <span
                  key={lob}
                  className="rounded-full border border-[var(--color-border-light)] bg-white px-3.5 py-1.5 text-sm font-medium shadow-sm"
                >
                  <span aria-hidden="true">{LOB_META[lob].emoji}</span>{" "}
                  {locale === "hi" ? LOB_META[lob].hi : LOB_META[lob].en}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ── Fixed value copy ────────────────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--color-border-light)] bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-bold">{t("advisor_page.help_title")}</h2>
          <ul className="mt-4 space-y-3.5">
            {["help_1", "help_2", "help_3"].map((k) => (
              <li key={k} className="flex gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-green-primary)]" />
                <span className="text-[var(--color-text-secondary)] leading-relaxed">
                  {t(`advisor_page.${k}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── The two CTAs ────────────────────────────────────────────── */}
        <section className="mt-6 grid gap-3">
          <button
            onClick={() => startForm("policy")}
            className="group flex items-center gap-4 rounded-2xl bg-[var(--color-green-primary)] px-6 py-5 text-left text-white shadow-lg transition hover:brightness-110 active:scale-[0.99]"
          >
            <Upload className="h-6 w-6 shrink-0" />
            <span className="flex-1">
              <span className="block text-lg font-semibold">{t("advisor_page.cta_policy")}</span>
              <span className="block text-sm text-white/80">{t("advisor_page.cta_policy_sub")}</span>
            </span>
          </button>

          <button
            onClick={() => startForm("talk")}
            className="group flex items-center gap-4 rounded-2xl border-2 border-[var(--color-green-primary)] bg-white px-6 py-5 text-left shadow-sm transition hover:bg-[var(--color-green-primary)]/5 active:scale-[0.99]"
          >
            <MessageCircle className="h-6 w-6 shrink-0 text-[var(--color-green-primary)]" />
            <span className="flex-1">
              <span className="block text-lg font-semibold">{t("advisor_page.cta_talk")}</span>
              <span className="block text-sm text-[var(--color-text-muted)]">
                {t("advisor_page.cta_talk_sub")}
              </span>
            </span>
          </button>
        </section>

        {/* ── Form / success ──────────────────────────────────────────── */}
        <div ref={formRef} className="scroll-mt-4">
          {sent ? (
            <SuccessPanel
              advisor={page}
              locale={locale}
              t={t}
              prospectName={sent.name}
              lob={sent.lob}
              intent={sent.intent}
              onAgain={() => {
                setSent(null);
                setOpenForm(null);
              }}
            />
          ) : openForm ? (
            <LeadForm
              slug={slug}
              advisorName={page.display_name}
              lines={page.lines_of_business}
              intent={openForm}
              locale={locale}
              t={t}
              utm={utm}
              onClose={() => setOpenForm(null)}
              onSent={(name, lob) => setSent({ name, lob, intent: openForm })}
            />
          ) : null}
        </div>

        {/* ── What happens next ───────────────────────────────────────── */}
        <section className="mt-8 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-cream-dark)]/60 p-6">
          <h2 className="font-serif text-lg font-bold">{t("advisor_page.next_title")}</h2>
          <ol className="mt-3 space-y-2.5 text-sm text-[var(--color-text-secondary)]">
            {["next_1", "next_2", "next_3"].map((k, i) => (
              <li key={k} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-[var(--color-green-primary)] shadow-sm">
                  {i + 1}
                </span>
                <span className="leading-relaxed pt-0.5">{t(`advisor_page.${k}`)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            {t("advisor_page.privacy_note")}
          </p>
        </section>
      </main>

      {/* ── Fixed disclaimer. Not editable by the advisor. ───────────── */}
      <footer className="border-t border-[var(--color-border-light)] bg-white">
        <div className="mx-auto max-w-2xl px-5 py-7">
          <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
            {t("advisor_page.disclaimer").replace("{name}", page.display_name)}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <a href="/privacy-policy" className="underline hover:text-[var(--color-text-main)]">
              {t("advisor_page.privacy_link")}
            </a>
            <a href="/grievance" className="underline hover:text-[var(--color-text-main)]">
              {t("advisor_page.grievance_link")}
            </a>
            <span className="text-[var(--color-text-muted)]">
              {t("advisor_page.powered_by")}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Lead form ───────────────────────────────────────────────────────────── */

function LeadForm({
  slug,
  advisorName,
  lines,
  intent,
  locale,
  t,
  utm,
  onClose,
  onSent,
}: {
  slug: string;
  advisorName: string;
  lines: LineOfBusiness[];
  intent: Intent;
  locale: PageLocale;
  t: (k: string) => string;
  utm: ReturnType<typeof readUtm>;
  onClose: () => void;
  onSent: (name: string, lob: LineOfBusiness | "") => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lob, setLob] = useState<LineOfBusiness | "">(lines[0] ?? "");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consentText = consentSentence(advisorName, locale);
  const MAX_FILES = 8;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, MAX_FILES);
    setFiles(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const digits = phone.replace(/\D/g, "").slice(-10);
    if (name.trim().length < 2) return setError(t("advisor_page.err_name"));
    if (!/^[6-9][0-9]{9}$/.test(digits)) return setError(t("advisor_page.err_phone"));
    if (!consent) return setError(t("advisor_page.err_consent"));

    setBusy(true);
    try {
      await submitAdvisorLead(slug, {
        name: name.trim(),
        phone: digits,
        intent,
        lob,
        message: message.trim(),
        files,
        consentText,
        utm,
      });
      // No name/phone/message — advisor slug, intent and line of business are
      // what we segment on; everything else is the lead's own PII.
      track(MpEvent.AdvisorLeadSubmitted, {
        advisor_slug: slug,
        intent,
        lob: lob || null,
        file_count: files.length,
        locale,
        utm_source: utm.source,
        utm_medium: utm.medium,
        utm_campaign: utm.campaign,
      });
      onSent(name.trim(), lob);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("advisor_page.err_generic"));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-[var(--color-border-medium)] bg-white px-4 py-3.5 text-base outline-none focus:border-[var(--color-green-primary)] focus:ring-2 focus:ring-[var(--color-green-primary)]/20";

  return (
    <form
      onSubmit={submit}
      className="mt-6 rounded-2xl border border-[var(--color-border-light)] bg-white p-6 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-serif text-xl font-bold">
          {t(intent === "policy" ? "advisor_page.form_title_policy" : "advisor_page.form_title_talk")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("advisor_page.close")}
          className="rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-cream-dark)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("advisor_page.f_name")}</label>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("advisor_page.f_phone")}</label>
          <input
            className={field}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="98XXXXXXXX"
            required
          />
        </div>

        {lines.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("advisor_page.f_lob")}</label>
            <div className="flex flex-wrap gap-2">
              {lines.map((l) => (
                <button
                  type="button"
                  key={l}
                  onClick={() => setLob(l)}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                    lob === l
                      ? "border-[var(--color-green-primary)] bg-[var(--color-green-primary)]/10 text-[var(--color-green-primary)]"
                      : "border-[var(--color-border-medium)] bg-white text-[var(--color-text-secondary)]"
                  }`}
                >
                  <span aria-hidden="true">{LOB_META[l].emoji}</span>{" "}
                  {locale === "hi" ? LOB_META[l].hi : LOB_META[l].en}
                </button>
              ))}
            </div>
          </div>
        )}

        {intent === "policy" ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("advisor_page.f_files")}</label>
            <p className="mb-2 text-xs text-[var(--color-text-muted)]">
              {t("advisor_page.f_files_hint")}
            </p>
            {/* Plain input, not a dropzone: the native picker is the only thing
                that reliably opens inside Instagram's and WhatsApp's webviews. */}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border-medium)] bg-[var(--color-cream-main)] px-4 py-6 text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-green-primary)]">
              <Upload className="h-5 w-5" />
              {t("advisor_page.f_files_btn")}
              <input
                type="file"
                className="sr-only"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>

            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 rounded-lg bg-[var(--color-cream-dark)]/70 px-3 py-2 text-sm"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      className="rounded p-1 text-[var(--color-text-muted)] hover:bg-white"
                      aria-label={t("advisor_page.remove")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("advisor_page.f_message")}</label>
            <textarea
              className={`${field} min-h-[90px] resize-y`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
            />
          </div>
        )}

        {/* Consent: the exact sentence is stored on the lead, so what the
            visitor reads here is what we can later show them. */}
        <label className="flex cursor-pointer gap-3 rounded-xl bg-[var(--color-cream-dark)]/60 p-4">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-green-primary)]"
          />
          <span className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {consentText}
          </span>
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-green-primary)] px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-5 w-5 animate-spin" />}
          {t(intent === "policy" ? "advisor_page.submit_policy" : "advisor_page.submit_talk")}
        </button>
      </div>
    </form>
  );
}

/* ── Success ─────────────────────────────────────────────────────────────── */

/**
 * Deliberately a screen with a button, not an automatic redirect. Mobile
 * browsers block a programmatic window.open that fires after an async request
 * resolves — Instagram's in-app webview most aggressively — so auto-opening
 * WhatsApp here would silently fail for exactly the audience this page targets.
 * The prospect taps; the tap is a real user gesture; the deep link opens.
 */
function SuccessPanel({
  advisor,
  locale,
  t,
  prospectName,
  lob,
  intent,
  onAgain,
}: {
  advisor: PublicAdvisorPage;
  locale: PageLocale;
  t: (k: string) => string;
  prospectName: string;
  lob: LineOfBusiness | "";
  intent: Intent;
  onAgain: () => void;
}) {
  const wa = waDeepLink(advisor.whatsapp_number, prospectName, locale, lob);

  return (
    <section className="mt-6 rounded-2xl border-2 border-[var(--color-green-primary)]/30 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--color-green-primary)]/10">
        <Check className="h-7 w-7 text-[var(--color-green-primary)]" />
      </div>
      <h2 className="mt-4 font-serif text-2xl font-bold">{t("advisor_page.done_title")}</h2>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        {t(intent === "policy" ? "advisor_page.done_policy" : "advisor_page.done_talk").replace(
          "{name}",
          advisor.display_name,
        )}
      </p>

      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:brightness-105"
        >
          <MessageCircle className="h-5 w-5" />
          {t("advisor_page.open_whatsapp")}
        </a>
      )}

      {advisor.whatsapp_number && (
        <a
          href={`tel:+91${advisor.whatsapp_number.replace(/\D/g, "").slice(-10)}`}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--color-border-medium)] bg-white px-6 py-3.5 text-base font-semibold transition hover:bg-[var(--color-cream-dark)]/50"
        >
          <Phone className="h-5 w-5" />
          {t("advisor_page.call_now")}
        </a>
      )}

      <button
        onClick={onAgain}
        className="mt-5 text-sm font-medium text-[var(--color-text-muted)] underline hover:text-[var(--color-text-main)]"
      >
        {t("advisor_page.send_another")}
      </button>
    </section>
  );
}

/* ── Not found / inactive ────────────────────────────────────────────────── */

function SimpleNotice({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] px-5 grid place-items-center text-center">
      <div className="max-w-md">
        <span className="font-serif text-2xl font-bold tracking-tight">IndSure</span>
        <h1 className="mt-6 font-serif text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-[var(--color-text-secondary)] leading-relaxed">{body}</p>
        {cta && (
          <a
            href={cta.href}
            className="mt-7 inline-block rounded-xl bg-[var(--color-green-primary)] px-6 py-3.5 font-semibold text-white shadow-lg hover:brightness-110"
          >
            {cta.label}
          </a>
        )}
      </div>
    </div>
  );
}
