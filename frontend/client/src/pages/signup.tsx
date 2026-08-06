import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { isPersonalEmail } from "@/lib/emailDomains";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, ArrowRight, MailCheck, FileText } from "lucide-react";
import { loadSampleReport, mockReportHealth } from "@/lib/mock-data";
import { MpEvent, identifyUser, track } from "@/lib/mixpanel";

// Consumer (D2C individual) signup — email + password, SELF-SERVE, no invite.
// Restricted to personal email providers (no business/Workspace domains — those
// belong on the agent portal).
export default function SignupPublic() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Create your free account — IndSure";
  }, []);

  async function handleSignUp() {
    if (!email || !password) {
      setError("Please enter your email and a password.");
      return;
    }
    // Personal providers only — reject business/Workspace/custom domains.
    if (!isPersonalEmail(email)) {
      setError("Please use a personal email (Gmail, Outlook, Yahoo, iCloud…). Work or business email? That's the agent portal.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If email confirmation is required, there is no session yet — so there is
    // no confirmed user to identify against. Track it anonymously; the identify
    // happens when they come back and sign in.
    if (!data.session) {
      track(MpEvent.SignupCompleted, {
        account_type: "consumer",
        sign_up_method: "email",
        pending_confirmation: true,
      });
      setNeedsConfirm(true);
      setLoading(false);
      return;
    }

    // Order matters: identify() before track() so sign_up_completed lands on the
    // real user profile rather than the anonymous device id. The auth listener in
    // components/Mixpanel.tsx would get here eventually, but not before this event.
    if (data.user?.id) identifyUser(data.user.id, { userType: "consumer" });
    track(MpEvent.SignupCompleted, {
      account_type: "consumer",
      sign_up_method: "email",
      pending_confirmation: false,
    });

    try {
      await apiFetch("/api/me/bootstrap", { method: "POST" });
    } catch { /* non-fatal — bootstrap is idempotent and retried on /app entry */ }
    setLocation("/app");
  }

  // Don't dead-end people who came to browse. Sample uses mock data — no analysis runs.
  function viewSample() {
    loadSampleReport(mockReportHealth);
    setLocation("/report?sample=health");
  }

  if (needsConfirm) {
    return (
      <AuthShell
        eyebrow="Almost there"
        title={<>Check your <span className="italic text-[var(--color-teal-400)]">inbox.</span></>}
        subtitle="One tap on the link we just sent and your portfolio is ready."
      >
        <div className="text-center space-y-5 py-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--color-teal-600)]/10 flex items-center justify-center">
            <MailCheck className="w-8 h-8 text-[var(--color-teal-600)]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[var(--color-navy-900)]">Confirm your email</h2>
            <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
              We sent a link to <span className="font-semibold text-[var(--color-navy-900)]">{email}</span>.
              Click it to activate your account, then sign in.
            </p>
          </div>
          <Link href="/login">
            <Button className="w-full h-[52px] bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-400)] text-white rounded-xl text-base font-bold">
              Go to sign in
            </Button>
          </Link>
          <p className="text-xs text-[var(--color-text-muted)]">
            Didn't get it? Check spam — it's the only mail we'll ever send you.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Free account"
      title={<>See what your policy <span className="italic text-[var(--color-teal-400)]">won't</span> pay for.</>}
      subtitle="Upload your policies, get an unbiased audit in about a minute, and keep everything in one private dashboard."
    >
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-[var(--color-navy-900)]">Create your free account</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Already have one?{" "}
            <Link href="/login">
              <span className="font-semibold text-[var(--color-teal-600)] hover:underline cursor-pointer">Log in</span>
            </Link>
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="su-email" className="text-sm font-semibold text-[var(--color-navy-900)]">Email</label>
            <Input
              id="su-email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[52px] bg-[var(--color-cream-main)] border-[var(--color-border-light)] focus:border-[var(--color-teal-600)] focus:bg-white transition-all font-medium px-4 rounded-xl"
              placeholder="you@gmail.com"
            />
            <p className="text-xs text-[var(--color-text-muted)] pl-1">Personal email only. No spam — we mean it.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="su-password" className="text-sm font-semibold text-[var(--color-navy-900)]">Password</label>
            <div className="relative">
              <Input
                id="su-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
                className="h-[52px] bg-[var(--color-cream-main)] border-[var(--color-border-light)] focus:border-[var(--color-teal-600)] focus:bg-white transition-all font-medium px-4 pr-12 rounded-xl"
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-navy-900)] transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-sm font-medium">
            {error}
          </div>
        )}

        <Button
          onClick={handleSignUp}
          disabled={loading}
          className="w-full h-[52px] bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-400)] text-white rounded-xl text-base font-bold shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {loading ? "Creating your account…" : <>Analyze my policy — free <ArrowRight className="w-4 h-4" /></>}
        </Button>

        {/* Low-commitment escape hatch — warms up browsers instead of losing them. */}
        <button
          type="button"
          onClick={viewSample}
          className="w-full text-sm font-semibold text-[var(--color-teal-600)] hover:underline inline-flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Just browsing? See a sample audit
        </button>
      </div>
    </AuthShell>
  );
}
