import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { claimPendingUpload, attachEmailToPendingUpload } from "@/lib/pendingUpload";
import { isPersonalEmail } from "@/lib/emailDomains";
import { AuthShell } from "@/components/auth/AuthShell";
import { FieldLabel, FieldError, RequiredLegend, inputStateClass } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, ArrowRight, MailCheck, FileText, ShieldCheck, AlertCircle } from "lucide-react";
import { loadSampleReport, mockReportHealth } from "@/lib/mock-data";
import { MpEvent, identifyUser, track } from "@/lib/mixpanel";

// Consumer (D2C individual) signup — name + mobile + email + password, SELF-SERVE,
// no invite. Restricted to personal email providers (no business/Workspace domains
// — those belong on the agent portal).
//
// Name and mobile are collected for demographics, NOT for verification: there is
// no OTP anywhere in this flow, and the copy on the page says so. Both land on
// individual_profiles via /api/me/bootstrap; they also go into Supabase user
// metadata so the email-confirmation path (no session yet → no bootstrap call)
// still gets them when the user comes back and signs in.
/**
 * Keeps the field at the 10 digits we actually store, whether the number is
 * pasted or typed. Separators go first; a country code or trunk 0 is only
 * dropped once what's left would still overflow 10 digits, so "+91 98765 43210"
 * typed one key at a time self-corrects the moment it runs past ten.
 * The field carries no maxLength for exactly that reason — the value has to be
 * allowed to reach eleven digits for the prefix to be recognisable as a prefix.
 */
function normalizeMobile(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

type FieldName = "name" | "phone" | "email" | "password";

export default function SignupPublic() {
  const [, setLocation] = useLocation();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  // Per-field messages. The single bottom-of-form banner is kept only for
  // failures that belong to no field (a rejected signup from the server).
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  const refs = {
    name: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Create your free account — IndSure";
  }, []);

  /** Clear a field's error as soon as the person starts fixing it — leaving red
   *  text under a field someone is actively correcting reads as nagging. */
  function clearFieldError(f: FieldName) {
    setFieldErrors((prev) => (prev[f] ? { ...prev, [f]: undefined } : prev));
  }

  async function handleSignUp() {
    const name = fullName.trim();
    // Already normalized on input; re-derived here so autofill can't slip past.
    const digits = normalizeMobile(phone);

    // Collect EVERY problem in one pass rather than surfacing them one at a
    // time. Being told about the mobile number, fixing it, and only then being
    // told about the password is three round trips for one form.
    const next: Partial<Record<FieldName, string>> = {};
    if (!name) next.name = "Please enter your name.";
    if (!digits) next.phone = "Please enter your mobile number.";
    else if (!/^[6-9][0-9]{9}$/.test(digits))
      next.phone = "That doesn't look like a 10-digit Indian mobile number.";
    if (!email) next.email = "Please enter your email.";
    // Personal providers only — reject business/Workspace/custom domains.
    else if (!isPersonalEmail(email))
      next.email = "Please use a personal email (Gmail, Outlook, Yahoo, iCloud…). Work email? That's the agent portal.";
    if (!password) next.password = "Please choose a password.";
    else if (password.length < 6) next.password = "Use at least 6 characters.";

    setFieldErrors(next);
    const firstBad = (["name", "phone", "email", "password"] as FieldName[]).find((f) => next[f]);
    if (firstBad) {
      setError(null);
      // Send them straight to the field rather than leaving them to find it.
      refs[firstBad].current?.focus();
      refs[firstBad].current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    setLoading(true);
    setError(null);

    // Before the account exists, while this tab still holds the token: tell the
    // server which address is signing up for the parked upload. If the
    // confirmation link is then opened in another tab or on a phone, the token
    // is gone but the address still finds the file. Awaited rather than fired
    // and forgotten, because a fast confirmation could otherwise race it, and it
    // never throws.
    await attachEmailToPendingUpload(email);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, phone: digits },
        // Send the confirmation link back to the site the person actually signed
        // up on. Without this, Supabase falls back to the project's Site URL —
        // a single global value, so for a long time every confirmation email,
        // including ones from indsure.in, pointed at beta. Deriving it from the
        // current origin makes each environment self-consistent and stops the
        // link depending on a dashboard setting nobody remembers is there.
        // (Origins still have to be on the Auth allowlist to be honoured.)
        emailRedirectTo: `${window.location.origin}/app`,
      },
    });
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
      // guard-ok(unchecked-apifetch): idempotent, and retried on /app entry. A failure here must not block signup.
      await apiFetch("/api/me/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name, phone: digits }),
      });
    } catch { /* non-fatal — bootstrap is idempotent and retried on /app entry */ }

    // If they uploaded a policy before signing up, redeem it now. Must come
    // after bootstrap: the quota check reads the profile row bootstrap creates.
    // ?job= tells the portfolio which analysis to follow so they land on live
    // progress rather than an inert list.
    const claimed = await claimPendingUpload();
    if (claimed.status === "started") {
      setLocation(`/app?job=${claimed.jobId}`);
      return;
    }
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
      promise="No OTP, no spam calls, no messages you didn't ask for. We will never sell your data."
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
            <FieldLabel htmlFor="su-name" required>Full name</FieldLabel>
            <Input
              id="su-name"
              ref={refs.name}
              type="text"
              autoComplete="name"
              autoFocus
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "su-name-err" : undefined}
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); clearFieldError("name"); }}
              className={`h-[52px] text-base ${inputStateClass(Boolean(fieldErrors.name))} transition-all font-medium px-4 rounded-xl`}
              placeholder="Rahul Sharma"
            />
            <FieldError id="su-name-err" message={fieldErrors.name} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="su-phone" required>Mobile number</FieldLabel>
            {/* +91 is a static prefix, not part of the value — we store 10 digits. */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--color-text-muted)] pointer-events-none">
                +91
              </span>
              <Input
                id="su-phone"
                ref={refs.phone}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? "su-phone-err" : undefined}
                value={phone}
                onChange={(e) => { setPhone(normalizeMobile(e.target.value)); clearFieldError("phone"); }}
                className={`h-[52px] text-base ${inputStateClass(Boolean(fieldErrors.phone))} transition-all font-medium pl-14 pr-4 rounded-xl tracking-wide`}
                placeholder="9876543210"
              />
            </div>
            <FieldError id="su-phone-err" message={fieldErrors.phone} />
          </div>

          {/* The honest reason we're asking. Sits right under the two new fields,
              where the hesitation actually happens. */}
          <div className="flex items-start gap-2.5 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-cream-main)] p-3">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-teal-600)]" />
            <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
              <span className="font-semibold text-[var(--color-navy-900)]">No OTP. Nothing to verify.</span>{" "}
              We ask for your name and number only to understand who our early users are.
              We will never spam you, and we will never sell or share your details.
            </p>
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="su-email" required>Email</FieldLabel>
            <Input
              id="su-email"
              ref={refs.email}
              type="email"
              autoComplete="email"
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "su-email-err" : "su-email-hint"}
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
              className={`h-[52px] text-base ${inputStateClass(Boolean(fieldErrors.email))} transition-all font-medium px-4 rounded-xl`}
              placeholder="you@gmail.com"
            />
            {fieldErrors.email ? (
              <FieldError id="su-email-err" message={fieldErrors.email} />
            ) : (
              <p id="su-email-hint" className="text-xs text-[var(--color-text-muted)] pl-1">
                Personal email only. This is your login.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="su-password" required>Password</FieldLabel>
            <div className="relative">
              <Input
                id="su-password"
                ref={refs.password}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "su-password-err" : "su-password-hint"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
                className={`h-[52px] text-base ${inputStateClass(Boolean(fieldErrors.password))} transition-all font-medium px-4 pr-12 rounded-xl`}
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-navy-900)] transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password ? (
              <FieldError id="su-password-err" message={fieldErrors.password} />
            ) : (
              // A requirement that lives only in the placeholder vanishes the
              // moment someone starts typing, which is exactly when it matters.
              <p id="su-password-hint" className="text-xs text-[var(--color-text-muted)] pl-1">
                At least 6 characters.
              </p>
            )}
          </div>

          <RequiredLegend />
        </div>

        {/* Reserved for failures that belong to no single field — a signup the
            server rejected. Field-level problems render against their input. */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-red-50 text-red-700 p-3.5 rounded-xl border border-red-200 text-sm font-medium"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
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
          className="w-full min-h-11 text-sm font-semibold text-[var(--color-teal-600)] hover:underline inline-flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Just browsing? See a sample audit
        </button>
      </div>
    </AuthShell>
  );
}
