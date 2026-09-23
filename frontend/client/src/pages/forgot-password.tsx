import { useEffect, useState } from "react";
import { Link } from "wouter";
import { apiFetch, apiOk } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, MailCheck } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

// Consumer password recovery. Uses Supabase's built-in recovery email; the link
// lands on /reset-password. Mirrors the agent flow but in the consumer style.
export default function ForgotPasswordPublic() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = t("cauth.fp_doc_title");
  }, []);

  async function handleSubmit() {
    if (!email) {
      setError(t("cauth.fp_err_email"));
      return;
    }
    setLoading(true);
    setError(null);
    // Goes through our own SES rather than Supabase's built-in sender, which is
    // rate-limited to a few messages an hour and frequently lands in spam. The
    // server mints the same Supabase recovery link and mails it itself, so the
    // /reset-password screen is unchanged.
    try {
      await apiOk(apiFetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }));
    } catch {
      // Not revealing whether the address exists is the no-enumeration rule.
      // Hiding a 500 is not: the user is told we sent a mail we never sent.
      setError(t("cauth.fp_err_send"));
      setLoading(false);
      return;
    }
    setLoading(false);
    // Always show success regardless of whether the email exists (no enumeration).
    setSent(true);
  }

  return (
    <AuthShell
      eyebrow={t("cauth.fp_eyebrow")}
      title={<>{t("cauth.fp_title_a")} <span className="italic text-[var(--color-teal-400)]">{t("cauth.fp_title_b")}</span></>}
      subtitle={t("cauth.fp_sub")}
    >
      {sent ? (
        <div className="space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-teal-600)]/10 flex items-center justify-center">
            <MailCheck className="w-6 h-6 text-[var(--color-teal-600)]" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-[var(--color-navy-900)]">{t("cauth.fp_check")}</h2>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {t("cauth.fp_sent", { email })}
            </p>
          </div>
          <Link href="/login">
            <Button className="w-full h-[52px] bg-[var(--color-cta)] hover:bg-[var(--color-cta-hover)] text-white rounded-xl text-base font-bold shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98]">
              {t("cauth.back_login")}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-[var(--color-navy-900)]">{t("cauth.fp_h")}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("cauth.fp_no_problem")}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="fp-email" className="text-sm font-semibold text-[var(--color-navy-900)]">{t("cauth.email")}</label>
            <Input
              id="fp-email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="h-[52px] bg-[var(--color-cream-main)] border-[var(--color-border-light)] focus:border-[var(--color-teal-600)] focus:bg-white transition-all font-medium px-4 rounded-xl"
              placeholder="you@gmail.com"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-sm font-medium">
              {error}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-[52px] bg-[var(--color-cta)] hover:bg-[var(--color-cta-hover)] text-white rounded-xl text-base font-bold shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {loading ? t("cauth.sending") : <>{t("cauth.send_link")} <ArrowRight className="w-4 h-4" /></>}
          </Button>

          <p className="text-center text-xs text-[var(--color-text-muted)]">
            {t("cauth.remembered")}{" "}
            <Link href="/login">
              <span className="font-semibold text-[var(--color-teal-600)] hover:underline cursor-pointer">{t("cauth.back_login")}</span>
            </Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
