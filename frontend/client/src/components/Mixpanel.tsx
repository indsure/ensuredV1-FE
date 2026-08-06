import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { identifyUser, initMixpanel, resetUser, trackPageView } from "@/lib/mixpanel";

/**
 * Mounts Mixpanel (analytics + Session Replay) for the whole app.
 *
 * Render once, near the router; renders nothing. All the configuration and
 * privacy rules live in @/lib/mixpanel — this component only handles the three
 * things that need React: init on mount, a page view per wouter navigation, and
 * keeping identity in sync with Supabase auth.
 */
export function Mixpanel() {
  const [location] = useLocation();

  useEffect(() => {
    initMixpanel();
  }, []);

  // Page view per client-side navigation. Fires for the initial route too,
  // because wouter reports the entry location on first render.
  useEffect(() => {
    trackPageView(location);
  }, [location]);

  // Identity. Agents and consumers share one Supabase auth pool, so the user
  // id alone doesn't tell us which portal they belong to — we look up the
  // agents table the same way AgentProtectedRoute does.
  const identifiedFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function sync(session: { user?: { id?: string } } | null) {
      const userId = session?.user?.id;

      if (!userId) {
        if (identifiedFor.current) {
          identifiedFor.current = null;
          resetUser();
        }
        return;
      }
      // getSession() and the auth listener can both settle the same user.
      if (identifiedFor.current === userId) return;
      identifiedFor.current = userId;

      let userType: "agent" | "consumer" = "consumer";
      try {
        const { data } = await supabase
          .from("agents")
          .select("id")
          .eq("id", userId)
          .maybeSingle();
        if (data) userType = "agent";
      } catch {
        // Lookup failed — still identify, just without the role.
      }

      if (cancelled) return;
      identifyUser(userId, { userType });
    }

    supabase.auth.getSession().then(({ data: { session } }) => void sync(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => void sync(session));

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}

export default Mixpanel;
