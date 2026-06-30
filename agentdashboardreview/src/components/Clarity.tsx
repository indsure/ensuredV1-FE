"use client";

import Script from "next/script";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";

const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

/**
 * Loads Microsoft Clarity (session recordings + heatmaps) and tags each
 * session with the logged-in agent so recordings are searchable per agent.
 *
 * Set NEXT_PUBLIC_CLARITY_PROJECT_ID to enable. When unset (e.g. local dev),
 * nothing loads.
 */
export function Clarity() {
  const { user } = useAuth();

  // Attach the agent's identity once Clarity is loaded and the user is known.
  useEffect(() => {
    if (!CLARITY_PROJECT_ID || !user || typeof window === "undefined") return;
    if (typeof window.clarity !== "function") return;

    // custom-id = email, friendly-name = display name. Lets you search a
    // recording by the agent who triggered it.
    window.clarity("identify", user.email, undefined, undefined, user.name);

    // Filterable tags in the Clarity dashboard.
    window.clarity("set", "agent_id", user.id);
    window.clarity("set", "agent_email", user.email);
    window.clarity("set", "agent_role", user.role);
  }, [user]);

  if (!CLARITY_PROJECT_ID) return null;

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`}
    </Script>
  );
}
