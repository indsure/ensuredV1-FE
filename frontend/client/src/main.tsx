import { createRoot } from "react-dom/client";
import App from "./App";
// Self-hosted fonts (no Google request, no consent banner needed).
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/400-italic.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "./index.css";
import { LanguageProvider } from "./i18n/LanguageContext";

// #region agent log
try {
  // Keep hooks, but avoid noisy dev-proxy network calls.
  const send = (_payload: any) => {};

  window.addEventListener("error", (e) => {
    send({
      hypothesisId: "A",
      message: "window.error",
      data: {
        message: (e as any)?.message,
        filename: (e as any)?.filename,
        lineno: (e as any)?.lineno,
        colno: (e as any)?.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason: any = (e as any)?.reason;
    send({
      hypothesisId: "B",
      message: "window.unhandledrejection",
      data: {
        reasonName: reason?.name,
        reasonMessage: reason?.message,
      },
    });
  });
} catch {}
// #endregion

// ── Recover from a stale build ───────────────────────────────────────────────
// Every route is a lazily imported chunk with a content hash in its filename.
// When a deploy lands, those filenames change — so a tab that was opened before
// the deploy is holding an index that points at chunks which no longer exist.
// The moment that visitor navigates, the import fails and they are stuck on a
// blank screen with "Failed to fetch dynamically imported module".
//
// That is worst exactly where it costs the most: someone who has just uploaded
// a policy and taps through to /signup. Their upload token lives in
// sessionStorage, which survives a reload, so simply reloading puts them back
// on the gate with their file still waiting.
//
// Reload once per session only. If the fresh build fails the same way the
// problem is not staleness, and a loop would be worse than the error.
const RELOADED_KEY = "indsure_chunk_reloaded";

function recoverFromStaleChunk(reason: unknown) {
  const message = String((reason as any)?.message ?? reason ?? "");
  const isChunkError =
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      message
    );
  if (!isChunkError) return;

  try {
    if (sessionStorage.getItem(RELOADED_KEY)) return;
    sessionStorage.setItem(RELOADED_KEY, "1");
  } catch {
    return; // no sessionStorage means no loop guard, so do not reload at all
  }
  window.location.reload();
}

// Vite fires this for a failed module preload; the rejection handler catches
// the failures that surface as an unhandled promise instead.
window.addEventListener("vite:preloadError", (e) => recoverFromStaleChunk((e as any)?.payload));
window.addEventListener("unhandledrejection", (e) => recoverFromStaleChunk(e.reason));

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>
);
