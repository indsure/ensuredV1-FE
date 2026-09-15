import { useEffect, useRef, useState } from "react";
import { Redirect } from "wouter";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";

type Gate = "loading" | "ok" | "anon" | "agent";

/**
 * Gate for the D2C consumer app (/app/*).
 *
 * Also the landing point for the Google OAuth return, so it must handle two
 * things carefully:
 *
 *  1. The session arrives asynchronously. Supabase parses it out of the return
 *     URL after redirect, so a plain getSession() can resolve as "no session"
 *     and bounce a user who just signed in straight back to /login. We listen
 *     for SIGNED_IN as well, and only redirect once we've actually settled.
 *
 *  2. An agent may sign in with Google using their agent email. /api/me/bootstrap
 *     correctly refuses them (WRONG_ACCOUNT_TYPE) — rather than dead-ending, we
 *     send them to the portal that IS theirs.
 */
export default function UserProtectedRoute({ children }: { children: React.ReactNode }) {
  const [gate, setGate] = useState<Gate>("loading");
  // Bootstrap is idempotent, but getSession + auth events can both fire for the
  // same user; don't re-POST for a user we've already settled.
  const settledFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolve(session: any) {
      if (cancelled) return;

      if (!session?.user) {
        settledFor.current = null;
        setGate("anon");
        return;
      }
      if (settledFor.current === session.user.id) return;
      settledFor.current = session.user.id;

      try {
        const res = await apiFetch("/api/me/bootstrap", { method: "POST" });
        if (cancelled) return;

        if (res.status === 403) {
          const body = await res.json().catch(() => ({}));
          if (body.error === "WRONG_ACCOUNT_TYPE") {
            setGate("agent");
            return;
          }
        }
        setGate("ok");
      } catch {
        // Network hiccup — let them in; every /api/me/* call re-checks anyway.
        if (!cancelled) setGate("ok");
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => resolve(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // SIGNED_IN fires once the OAuth redirect has been parsed out of the URL.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        resolve(session);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (gate === "loading") {
    return (
      <div className="min-h-screen bg-[var(--color-cream-main)] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--color-teal-600)] border-t-transparent animate-spin" />
      </div>
    );
  }

  /* An advisor who signs in here is sent to the portal that is theirs, but say
     so instead of teleporting them. The silent redirect was read by a tester as
     the consumer login leaking into the advisor portal: nothing leaks (the
     server refuses every /api/me/* call from an agent account, which is how we
     know to redirect at all), but a person who lands somewhere they did not ask
     for has no way to tell those two apart. Signing out is offered because the
     other reason to be on this screen is owning both kinds of account. */
  if (gate === "agent") {
    return (
      <div className="min-h-screen bg-[var(--color-cream-main)] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-2xl text-[var(--color-navy-900)] mb-3">
            That is an advisor account
          </h1>
          <p className="text-base text-[var(--color-text-secondary)] mb-7">
            My Portfolio is for people tracking their own policies. Your advisor portal has your
            customers, your policies and your leads in it.
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="/agent/dashboard"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[var(--color-cta)] text-white font-bold hover:bg-[var(--color-cta-hover)] transition-colors"
            >
              Go to the advisor portal
            </a>
            <button
              onClick={() => { void supabase.auth.signOut().then(() => { window.location.href = "/login"; }); }}
              className="text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-navy-900)] transition-colors"
            >
              Sign out and use a different account
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (gate === "anon") return <Redirect to="/login" />;

  return <>{children}</>;
}
