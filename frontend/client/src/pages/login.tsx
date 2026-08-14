import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

// Consumer (D2C individual) login — mobile number OR email, plus password.
// Signs individuals into their personal insurance portfolio (/app). The agent
// portal keeps its own login at /agent/login — deliberately untouched.
//
// One field rather than a mobile/email toggle: our users are largely 40+ and on
// a phone, and a toggle is one more decision before they can start typing. Ten
// digits is unambiguously a mobile and anything else is treated as an email, so
// the form works out which it is instead of asking.
export default function LoginPublic() {
  const [, setLocation] = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Sign in — IndSure";
  }, []);

  /** Ten digits after stripping punctuation and any +91 / leading 0 = a mobile.
   *  Anything containing "@" is an email. Everything else falls through to the
   *  email path so the error comes from Supabase rather than from us guessing. */
  function asMobile(input: string): string | null {
    if (input.includes("@")) return null;
    const digits = input.replace(/\D/g, "").slice(-10);
    return /^[6-9][0-9]{9}$/.test(digits) ? digits : null;
  }

  async function handleSignIn() {
    const value = identifier.trim();
    if (!value || !password) {
      setError("Please enter your mobile number or email, and your password.");
      return;
    }
    setLoading(true);
    setError(null);

    const mobile = asMobile(value);

    if (mobile) {
      // Mobile path. The number is resolved to an account server-side, inside
      // the sign-in, so this request cannot be used to test which numbers exist.
      try {
        const res = await apiFetch("/api/auth/consumer-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: mobile, password }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.access_token) {
          setError(body?.message || "That mobile number and password don't match an account.");
          setLoading(false);
          return;
        }
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: body.access_token,
          refresh_token: body.refresh_token,
        });
        if (sessErr) {
          setError(sessErr.message);
          setLoading(false);
          return;
        }
      } catch {
        setError("Could not reach IndSure. Please check your connection and try again.");
        setLoading(false);
        return;
      }
    } else {
      // Email path — unchanged, still straight to Supabase from the browser.
      const { error } = await supabase.auth.signInWithPassword({ email: value, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }
    // Idempotent — ensures the profile + trial clock exist.
    try {
      await apiFetch("/api/me/bootstrap", { method: "POST" });
    } catch { /* non-fatal — retried on /app entry */ }
    setLocation("/app");
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title={<>Your portfolio's <span className="italic text-[var(--color-teal-400)]">waiting.</span></>}
      subtitle="Pick up where you left off — every policy you've added, audited and in one place."
    >
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-[var(--color-navy-900)]">Log in</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            New to IndSure?{" "}
            <Link href="/signup">
              <span className="font-semibold text-[var(--color-teal-600)] hover:underline cursor-pointer">Create a free account</span>
            </Link>
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-identifier" className="text-sm font-semibold text-[var(--color-navy-900)]">Mobile number or email</label>
            <Input
              id="login-identifier"
              type="text"
              inputMode="text"
              autoComplete="username"
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="h-[52px] bg-[var(--color-cream-main)] border-[var(--color-border-light)] focus:border-[var(--color-teal-600)] focus:bg-white transition-all font-medium px-4 rounded-xl"
              placeholder="9876543210 or you@gmail.com"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-sm font-semibold text-[var(--color-navy-900)]">Password</label>
              <Link href="/forgot-password">
                <span className="text-xs font-semibold text-[var(--color-teal-600)] hover:underline cursor-pointer">Forgot password?</span>
              </Link>
            </div>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                className="h-[52px] bg-[var(--color-cream-main)] border-[var(--color-border-light)] focus:border-[var(--color-teal-600)] focus:bg-white transition-all font-medium px-4 pr-12 rounded-xl"
                placeholder="Your password"
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
          onClick={handleSignIn}
          disabled={loading}
          className="w-full h-[52px] bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-400)] text-white rounded-xl text-base font-bold shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {loading ? "Signing you in…" : <>Take me to my portfolio <ArrowRight className="w-4 h-4" /></>}
        </Button>

        <p className="text-center text-xs text-[var(--color-text-muted)]">
          Are you an insurance agent?{" "}
          <Link href="/agent/login">
            <span className="underline cursor-pointer hover:text-[var(--color-navy-900)]">Use the agent portal</span>
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
