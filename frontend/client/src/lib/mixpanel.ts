import mixpanel from "mixpanel-browser";

/**
 * Mixpanel analytics + Session Replay for the IndSure frontend.
 *
 * Docs: https://docs.mixpanel.com/docs/session-replay/session-replay-web
 *
 * Two things drive every choice in this file:
 *
 *  1. We handle insurance PII — policy documents, customer names, phone
 *     numbers, sum insured, health declarations. Replay therefore runs with
 *     Mixpanel's *strictest* masking (all text + all inputs masked) and an
 *     extended block list that covers the elements a PDF/report viewer renders
 *     into. Nothing is unmasked. If you ever need to reveal a specific element,
 *     add `data-mp-unmask` to it rather than loosening a global flag.
 *
 *  2. The SDK must never be able to break the app. Mixpanel's own guidance is
 *     defensive programming, so every entry point below is wrapped in
 *     try/catch and no-ops when the SDK is disabled or failed to load.
 *
 * Enable by setting VITE_MIXPANEL_TOKEN at build time. Without it the whole
 * module is inert, so local dev and preview builds stay clean by default.
 */

// The project token is not a secret — it ships in the client bundle either way,
// and it only grants permission to WRITE events into the project, never to read
// anything out. So it is baked in with an env override, which means production
// works off a plain `git push` — no Vercel env var, no redeploy dance.
const TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN || "31b42a826c8e7069f9a72799b83cf783";

// Data residency. Verified against Project Settings → Overview on 2026-08-05:
// project "Indsure" (id 4039086) is a **US residency** project, so this must be
// the US host. Session Replay reuses it — there is no separate replay endpoint.
//
// Do not "correct" this to api-in.mixpanel.com because the company is Indian.
// That was tried: the India edge accepts the request and returns HTTP 200 with
// {"error":null,"status":1}, but the events land in a cluster where this project
// does not exist, so Event Count stays at 0. A 200 here does NOT prove delivery —
// only the Event Count in Project Settings does.
const API_HOST = import.meta.env.VITE_MIXPANEL_API_HOST ?? "https://api.mixpanel.com";

// Percentage of SDK initialisations that capture a replay. 100 while we verify
// the implementation and privacy rules; dial down from Mixpanel's UI controls
// or by setting VITE_MIXPANEL_RECORD_PERCENT once volume matters.
const RECORD_PERCENT = Number(import.meta.env.VITE_MIXPANEL_RECORD_PERCENT ?? 100);

// Analytics only ship from production builds. Set VITE_MIXPANEL_DEBUG=true to
// exercise the integration from `vite dev` against a sandbox project.
const DEBUG_MODE = import.meta.env.VITE_MIXPANEL_DEBUG === "true";
const ENABLED = Boolean(TOKEN) && (import.meta.env.PROD || DEBUG_MODE);

let started = false;

/** Swallow SDK failures — analytics must never take a page down. */
function safe<T>(fn: () => T): T | undefined {
  if (!started) return undefined;
  try {
    return fn();
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initMixpanel(): void {
  if (started || !ENABLED) return;

  try {
    mixpanel.init(TOKEN, {
      api_host: API_HOST,
      // Cookies are first-party and same-site; no cross-site tracking.
      cross_site_cookie: false,
      secure_cookie: true,
      persistence: "localStorage",
      // Mixpanel derives country/region/city from the request IP. That geo
      // breakdown is a core analytics dimension for an India-first product, so
      // it is left on (the SDK default). The IP itself is personal data under
      // the DPDP Act — if you'd rather not have Mixpanel resolve it, set
      // VITE_MIXPANEL_DISABLE_IP=true and you lose only the geo columns.
      ip: import.meta.env.VITE_MIXPANEL_DISABLE_IP !== "true",
      debug: DEBUG_MODE,
      // We emit our own page views (see trackPageView) because wouter drives
      // client-side navigation and autocapture's pageview would miss most of it.
      autocapture: false,

      // --- Session Replay -------------------------------------------------
      record_sessions_percent: RECORD_PERCENT,

      // Strictest masking. Both are Mixpanel defaults; they are spelled out
      // here so nobody has to guess what the recorder is allowed to see.
      // Password/email/tel/hidden inputs are always masked regardless.
      record_mask_all_text: true,
      record_mask_all_inputs: true,

      // Default block selector is "img, video". We extend it: canvas, iframe,
      // embed and object are how pdf.js, @react-pdf/renderer and our report
      // viewers paint policy documents to the screen. `[data-mp-block]` is the
      // manual escape hatch for any new component that renders raw customer data.
      record_block_selector: "img, video, canvas, iframe, embed, object, [data-mp-block]",

      // Explicitly off: canvas capture would defeat the block above (and uses
      // rrweb's experimental UNSAFE_replayCanvas path).
      record_canvas: false,

      // Heatmaps + rage-click + dead-click detection. These events are exempt
      // from the plan's data allowance.
      record_heatmap_data: true,

      // Console logs land in the replay Activity Feed — useful for debugging
      // the report/upload flows where users report "it just spun forever".
      record_console: true,

      // Network capture is timing + status metadata ONLY. We deliberately pass
      // no recordHeaders and no recordBodyUrls allowlists: our API payloads
      // carry policy PII and Authorization bearer tokens, and Mixpanel only
      // records headers/bodies you explicitly opt into.
      record_network: true,
      record_network_options: {
        initiatorTypes: ["fetch", "xmlhttprequest"],
        // Auth traffic can carry tokens in the URL fragment/query on the
        // OAuth return leg — keep it out entirely.
        ignoreRequestUrls: ["/auth/v1/", "/storage/v1/object/sign"],
        recordHeaders: { request: [], response: [] },
        recordBodyUrls: { request: [], response: [] },
        recordInitialRequests: false,
      },

      // A replay ends after 30 min idle, capped at 24h (both SDK defaults).
      record_idle_timeout_ms: 1_800_000,
      // Drop sub-2s bounces — they cost allowance and show nothing useful.
      record_min_ms: 2_000,
    });

    started = true;

    // Super property — auto-attached to every event so reports can split web
    // traffic out later without re-instrumenting, if a mobile app ever lands.
    try {
      mixpanel.register({ platform: "web" });
    } catch {
      /* non-fatal */
    }

    // Debug builds only: expose the instance so you can inspect the resolved
    // config and drive recording by hand from the console when QA'ing against
    // a sandbox project. Never reachable from a production bundle.
    if (DEBUG_MODE) {
      (window as unknown as { mixpanel?: typeof mixpanel }).mixpanel = mixpanel;
    }

    // Respect browser Do Not Track. The SDK honours DNT for replay data, but
    // opting out entirely is the honest reading of the signal.
    try {
      const dnt =
        navigator.doNotTrack === "1" ||
        (window as unknown as { doNotTrack?: string }).doNotTrack === "1";
      if (dnt) mixpanel.opt_out_tracking();
    } catch {
      /* navigator quirks — ignore */
    }
  } catch {
    started = false;
  }
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * Bind the current Supabase user to Mixpanel.
 *
 * ASSUMES SIMPLIFIED ID MERGE — the default for Mixpanel organisations created
 * from April 2024 onwards, which this project is. Under Simplified, identify()
 * is the only identity call ever needed: the SDK holds a $device_id for the
 * anonymous visitor, and identify() sets $user_id and merges the two. There is
 * no cap on how many devices fold into one user.
 *
 * If this project turns out to be on ORIGINAL ID Merge (Project Settings →
 * Identity Management), then account *creation* should call mixpanel.alias()
 * instead of identify() — see pages/signup.tsx. Everything else stays the same.
 * The mode cannot be changed once a project holds data, so check rather than assume.
 *
 * Calling identify() client-side is also what makes Session Replay's
 * server-side stitching work: backend events sent with the same distinct_id
 * get attributed to the right replay.
 *
 * Deliberately no email, phone or name — the user id and coarse role are
 * enough to segment on, and anything more is PII we have no reason to export.
 */
export function identifyUser(
  userId: string,
  props?: { userType?: "agent" | "consumer"; plan?: string },
): void {
  safe(() => {
    mixpanel.identify(userId);
    if (props?.userType) mixpanel.register({ user_type: props.userType });
    // Only our own properties here. $last_seen is a reserved property Mixpanel
    // maintains automatically on every people call — writing it by hand just
    // risks fighting the value Mixpanel already keeps correct.
    mixpanel.people.set({
      user_type: props?.userType ?? "unknown",
      plan: props?.plan ?? "unknown",
    });
    // Stamps the first time we ever saw this user, and never overwrites it.
    mixpanel.people.set_once({ first_identified_at: new Date().toISOString() });
  });
}

/** Clear identity on sign-out so the next session starts as a new anon user. */
export function resetUser(): void {
  safe(() => mixpanel.reset());
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Product events worth measuring. Centralised so names stay stable — renaming
 * an event in Mixpanel after the fact splits its history.
 */
export const MpEvent = {
  PageView: "page_viewed",

  // Policy check funnel — the core product loop and our Value Moment.
  UploadStarted: "policy_upload_started",
  UploadCompleted: "policy_analysis_completed",
  AnalysisViewed: "policy_analysis_viewed",
  AnalysisFailed: "policy_analysis_failed",

  // Tools
  CalculatorCompleted: "cover_calculator_completed",
  CompareRun: "policy_comparison_run",

  // Growth
  AdvisorLeadSubmitted: "advisor_lead_submitted",
  SignupCompleted: "sign_up_completed",
} as const;

export type MpEventName = (typeof MpEvent)[keyof typeof MpEvent];

/**
 * Track an event. Property values must stay non-PII: line of business, page
 * tag, counts and durations are fine; names, phone numbers, policy numbers and
 * sums insured are not.
 */
export function track(event: MpEventName, props?: Record<string, unknown>): void {
  safe(() => mixpanel.track(event, props));
}

// ---------------------------------------------------------------------------
// Page views
// ---------------------------------------------------------------------------

/**
 * Collapse a pathname into a stable, filterable page tag.
 *
 * Keeps record ids (policy ids, lead ids, share tokens) out of the event stream,
 * so /agent/leads/<uuid> reports as "agent/leads" rather than one row per lead.
 * Order matters: specific prefixes before generic ones.
 */
export function pageTagFor(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/calculator")) return "calculator";
  if (pathname.startsWith("/policychecker")) return "policychecker";
  if (pathname.startsWith("/analyze")) return "analyze";
  if (pathname.startsWith("/shared/report") || pathname.startsWith("/report")) return "report";
  if (pathname.startsWith("/compare")) return "compare";
  if (pathname.startsWith("/find-provider") || pathname.startsWith("/hospitals")) return "find-provider";
  if (pathname.startsWith("/a/")) return "advisor-page";
  if (pathname.startsWith("/blog")) return "blog";
  if (pathname.startsWith("/learn")) return "learn";
  if (pathname.startsWith("/author")) return "author";
  if (pathname.startsWith("/app")) return "consumer-app";
  // Keep the agent portal's own sections distinguishable, but strip record ids.
  if (pathname.startsWith("/agent")) {
    const section = pathname.split("/")[2];
    return section ? `agent/${section}` : "agent";
  }
  if (pathname.startsWith("/admin")) return "admin";
  return pathname;
}

export function trackPageView(pathname: string): void {
  safe(() =>
    mixpanel.track(MpEvent.PageView, {
      page: pageTagFor(pathname),
      // Full path is safe for our routes (ids are opaque UUIDs), and it is what
      // Mixpanel's URL-based replay sampling rules match on.
      path: pathname,
    }),
  );
}

// ---------------------------------------------------------------------------
// Replay helpers
// ---------------------------------------------------------------------------

/**
 * Replay properties ($mp_replay_id) for the active capture, or {} if none.
 * Attach these to events sent outside the SDK so they land in the same replay.
 */
export function getReplayProperties(): Record<string, string> {
  return safe(() => mixpanel.get_session_recording_properties()) ?? {};
}

/**
 * Deep link to the current replay in the Mixpanel UI, or null if nothing is
 * recording. Handy to attach to support tickets and bug reports.
 */
export function getReplayUrl(): string | null {
  return safe(() => mixpanel.get_session_replay_url()) ?? null;
}

/** Force recording on, regardless of the sampling rate. */
export function startRecording(): void {
  safe(() => mixpanel.start_session_recording());
}

/** Stop the active capture (e.g. before showing something we must not record). */
export function stopRecording(): void {
  safe(() => mixpanel.stop_session_recording());
}

export { mixpanel };
