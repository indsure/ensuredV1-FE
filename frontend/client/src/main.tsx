import { createRoot, hydrateRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import App from "./App";
// Self-hosted fonts (no Google request, no consent banner needed): the latin
// and latin-ext faces of Inter and Playfair Display, with unicode-range, so a
// page downloads latin-ext only if it shows one of those glyphs (the rupee
// sign is one). See fonts.css. Inter latin 400 is preloaded by
// scripts/prerender.mjs.
import "./fonts.css";
import "./index.css";
import { LanguageProvider } from "./i18n/LanguageContext";
import { getSavedLocale, loadLocale } from "./i18n";
import { isPlaygroundMode } from "./lib/playground/mode";
import { loadPlayground } from "./lib/playground/registry";
import { enableStaticFirstPaint } from "./lib/staticFirstPaint";

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

// Two optional chunks have to be in memory before the first render, or the page
// would paint wrong and then change: Hindi strings for a visitor who chose Hindi,
// and the demo mock for a tab already in playground mode. Everyone else renders
// straight away. A failed fetch still renders (English / an empty portal).
const ready: Promise<unknown>[] = [];
if (getSavedLocale() === "hi") {
  ready.push(loadLocale("hi"));
  // Screen readers and hyphenation read the page language; the switcher sets it
  // on a change, but a returning Hindi visitor arrives with "en" from the HTML.
  document.documentElement.lang = "hi";
}
if (isPlaygroundMode()) ready.push(loadPlayground());

// The main public pages ship as real HTML (scripts/prerender.mjs marks them
// with data-prerendered), so they are already on screen. Hydrating keeps that
// HTML and attaches React to it instead of throwing it away and rebuilding.
// It is only attempted when this visit would render exactly what was built:
// English, not the demo, and no query string beyond campaign tags (?type= on
// /compare, for one, switches to a different page). Otherwise React renders
// fresh over the HTML, which stays visible until then.
const root = document.getElementById("root")!;
const onlyCampaignParams = Array.from(new URLSearchParams(window.location.search).keys()).every(
  (k) => k.startsWith("utm_") || k === "gclid" || k === "fbclid"
);
const canHydrate =
  root.hasAttribute("data-prerendered") && ready.length === 0 && onlyCampaignParams;

const app = (
  <LanguageProvider>
    <App />
  </LanguageProvider>
);

if (canHydrate) {
  enableStaticFirstPaint();
  // Paint first, hydrate second. The entry script often arrives before the
  // browser has painted the HTML, and hydration is one long task, so running
  // it straight away held the first paint back by over a second on /pricing.
  // Waiting for the next frame lets the HTML reach the screen. The timer is a
  // backstop for a tab opened in the background, where frames never fire.
  let started = false;
  const hydrate = () => {
    if (started) return;
    started = true;
    hydrateRoot(root, app);
  };
  requestAnimationFrame(() => setTimeout(hydrate, 0));
  setTimeout(hydrate, 300);
} else {
  Promise.allSettled(ready).then(() => {
    const reactRoot = createRoot(root);
    // A prerendered page was hidden for a Hindi visitor (see loadAppAfterPaint
    // in scripts/prerender.mjs) so it never flashed in English. flushSync makes
    // the first commit synchronous, so React's own output has replaced that
    // HTML before the page is shown again.
    flushSync(() => reactRoot.render(app));
    document.documentElement.classList.remove("hi-pending");
  });
}
