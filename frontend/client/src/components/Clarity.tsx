import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Microsoft Clarity (session recordings + heatmaps) for the Vite frontend.
 *
 * The Clarity project ID is not a secret (it ships in the client tag either
 * way), so it's baked in with an optional VITE_CLARITY_PROJECT_ID override.
 * Loads only in production builds, so local `vite dev` sessions aren't recorded.
 */

const PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID || "xeg35lza9v";

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

// Maps routes to a stable, filterable page tag in the Clarity dashboard.
// Order matters: more specific prefixes must be checked before "/agent" etc.
// Unlisted routes fall back to the raw pathname.
function pageTagFor(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/calculator")) return "calculator";
  if (pathname.startsWith("/policychecker")) return "policychecker";
  if (pathname.startsWith("/report") || pathname.startsWith("/shared/report")) return "report";
  if (pathname.startsWith("/compare")) return "compare";
  if (pathname.startsWith("/find-provider") || pathname.startsWith("/hospitals")) return "find-provider";
  if (pathname.startsWith("/agent")) return "agent";
  return pathname;
}

export function Clarity() {
  const [location] = useLocation();

  useEffect(() => {
    if (!PROJECT_ID || !import.meta.env.PROD) return;
    if (window.clarity || document.getElementById("ms-clarity")) return;

    (function (c: any, l: Document, a: string, r: string, i: string) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      const t = l.createElement(r) as HTMLScriptElement;
      t.async = true;
      t.id = "ms-clarity";
      t.src = "https://www.clarity.ms/tag/" + i;
      const y = l.getElementsByTagName(r)[0];
      y.parentNode!.insertBefore(t, y);
    })(window, document, "clarity", "script", PROJECT_ID);
  }, []);

  // Tag every session with the current page so recordings are filterable
  // by page in the Clarity dashboard (mirrors the per-agent tagging in
  // agentdashboardreview/src/components/Clarity.tsx).
  useEffect(() => {
    if (!PROJECT_ID || !import.meta.env.PROD) return;
    if (typeof window.clarity !== "function") return;

    window.clarity("set", "page", pageTagFor(location));
  }, [location]);

  return null;
}
