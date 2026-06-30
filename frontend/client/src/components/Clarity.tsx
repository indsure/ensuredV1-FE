import { useEffect } from "react";

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

export function Clarity() {
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

  return null;
}
