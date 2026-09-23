import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, CheckCircle2, ArrowRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

// Consumer "set a new password" page. Supabase parses the recovery token from
// the URL and establishes a session; we verify one exists, then updateUser.
// Mirrors the agent ResetPassword logic in the consumer style.
export default function ResetPasswordPublic() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // null = checking, true = valid recovery session, false = no/expired link
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = t("cauth.rp_doc_title");
  }, []);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    (async () => {
      // Our reset emails link straight here carrying the token hash, rather than
      // bouncing through Supabase's /auth/v1/verify — that redirect only honours
      // URLs on the project allowlist and was silently dropping people on the
      // Site URL instead, with no reset screen in sight. Exchanging the hash for
      // a recovery session here keeps the whole flow on our own domain.
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      if (tokenHash && params.get("type") === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (!active) return;
        if (error) {
          setReady(false);
          return;
        }
        // Drop the token from the address bar so a shared or re-opened URL does
        // not carry a live credential, and a refresh cannot try to reuse it.
        window.history.replaceState({}, "", window.location.pathname);
        setReady(true);
        return;
      }

      // Legacy path: a link that did route through Supabase leaves tokens in the
      // fragment and the client picks them up on its own.
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) setReady(true);
      else setReady((prev) => (prev === null ? false : prev));
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const passwordValid = checks.length && checks.uppercase && checks.number;

  async function handleSubmit() {
    if (!passwordValid) {
      setError(t("cauth.rp_err_rules"));
      return;
    }
    if (password !== confirm) {
      setError(t("cauth.rp_err_match"));
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Ensure the profile/trial clock exists, then head into the portfolio.
    // guard-ok(unchecked-apifetch): idempotent, and retried on /app entry. A failure here must not block sign-in.
      try { await apiFetch("/api/me/bootstrap", { method: "POST" }); } catch { /* non-fatal */ }
    setDone(true);
    setTimeout(() => setLocation("/app"), 1600);
  }

  return (
    <AuthShell
      eyebrow={t("cauth.rp_eyebrow")}
      title={<>{t("cauth.rp_title_a")} <span className="italic text-[var(--color-teal-400)]">{t("cauth.rp_title_b")}</span></>}
      subtitle={t("cauth.rp_sub")}
    >
      {ready === null && (
        <div className="py-6 text-center text-sm font-medium text-[var(--color-text-secondary)]">
          {t("cauth.rp_verifying")}
        </div>
      )}

      {ready === false && (
        <div className="space-y-6">
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm font-medium leading-relaxed">
            {t("cauth.rp_invalid")}
          </div>
          <Link href="/forgot-password">
            <Button className="w-full h-[52px] bg-[var(--color-cta)] hover:bg-[var(--color-cta-hover)] text-white rounded-xl text-base font-bold shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98]">
              {t("cauth.rp_request")}
            </Button>
          </Link>
        </div>
      )}

      {ready === true && done && (
        <div className="space-y-4">
          <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-100 text-sm font-semibold leading-relaxed flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            {t("cauth.rp_done")}
          </div>
        </div>
      )}

      {ready === true && !done && (
        <div className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-[var(--color-navy-900)]">{t("cauth.rp_h")}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("cauth.rp_pick")}</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rp-pw" className="text-sm font-semibold text-[var(--color-navy-900)]">{t("cauth.password")}</label>
            <div className="relative">
              <Input
                id="rp-pw"
                type={showPassword ? "text" : "password"}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-[52px] bg-[var(--color-cream-main)] border-[var(--color-border-light)] focus:border-[var(--color-teal-600)] focus:bg-white transition-all font-medium px-4 pr-12 rounded-xl"
                placeholder={t("cauth.rp_new_ph")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-navy-900)] transition-colors"
                aria-label={showPassword ? t("cauth.hide_pw") : t("cauth.show_pw")}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rp-confirm" className="text-sm font-semibold text-[var(--color-navy-900)]">{t("cauth.rp_confirm")}</label>
            <Input
              id="rp-confirm"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="h-[52px] bg-[var(--color-cream-main)] border-[var(--color-border-light)] focus:border-[var(--color-teal-600)] focus:bg-white transition-all font-medium px-4 rounded-xl"
              placeholder={t("cauth.rp_again")}
            />
          </div>

          {password && (
            <div className="space-y-1.5">
              {[
                { ok: checks.length, label: t("cauth.rp_len") },
                { ok: checks.uppercase, label: t("cauth.rp_upper") },
                { ok: checks.number, label: t("cauth.rp_number") },
              ].map((c) => (
                <div key={c.label} className={`text-xs flex items-center gap-2 ${c.ok ? "text-emerald-600" : "text-[var(--color-text-muted)]"}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> {c.label}
                </div>
              ))}
            </div>
          )}

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
            {loading ? t("cauth.rp_updating") : <>{t("cauth.rp_update")} <ArrowRight className="w-4 h-4" /></>}
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
