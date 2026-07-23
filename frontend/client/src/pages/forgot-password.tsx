import { useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, MailCheck } from "lucide-react";

// Consumer password recovery. Uses Supabase's built-in recovery email; the link
// lands on /reset-password. Mirrors the agent flow but in the consumer style.
export default function ForgotPasswordPublic() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Reset your password — IndSure";
  }, []);

  async function handleSubmit() {
    if (!email) {
      setError("Please enter the email you signed up with.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Always show success regardless of whether the email exists (no enumeration).
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <AuthShell
      eyebrow="Password help"
      title={<>Let's get you <span className="italic text-[var(--color-teal-400)]">back in.</span></>}
      subtitle="Enter your email and we'll send you a secure link to set a new password."
    >
      {sent ? (
        <div className="space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-teal-600)]/10 flex items-center justify-center">
            <MailCheck className="w-6 h-6 text-[var(--color-teal-600)]" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-[var(--color-navy-900)]">Check your email</h2>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              If an account exists for <span className="font-semibold text-[var(--color-navy-900)]">{email}</span>,
              we've sent a link to reset your password. Check your inbox (and spam) and follow the link.
            </p>
          </div>
          <Link href="/login">
            <Button className="w-full h-[52px] bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-400)] text-white rounded-xl text-base font-bold shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98]">
              Back to log in
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-[var(--color-navy-900)]">Forgot your password?</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              No problem — it happens. We'll email you a reset link.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="fp-email" className="text-sm font-semibold text-[var(--color-navy-900)]">Email</label>
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
            className="w-full h-[52px] bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-400)] text-white rounded-xl text-base font-bold shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {loading ? "Sending…" : <>Send reset link <ArrowRight className="w-4 h-4" /></>}
          </Button>

          <p className="text-center text-xs text-[var(--color-text-muted)]">
            Remembered it?{" "}
            <Link href="/login">
              <span className="font-semibold text-[var(--color-teal-600)] hover:underline cursor-pointer">Back to log in</span>
            </Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
