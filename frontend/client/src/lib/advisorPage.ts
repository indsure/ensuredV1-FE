/**
 * Advisor landing pages — the public page an advisor shares (indsure.in/a/<slug>)
 * and the agent-side editor behind it.
 *
 * Split by trust boundary, deliberately:
 *   • Public reads/writes go through the BACKEND (/api/p/*). An anonymous
 *     visitor has no Supabase session, and agent_leads is RLS'd to
 *     auth.uid() = agent_id, so lead capture has to be a service-role write.
 *   • Agent-side editing goes straight through supabase-js, like leads.ts and
 *     customers.ts, because RLS already scopes agent_pages to the owner.
 *
 * What is NOT here, on purpose: firm name, designation, licence number. We hold
 * no verified licence data, so nothing credential-shaped goes on a public page
 * carrying IndSure's domain. See migrations/008_advisor_pages.sql.
 */

import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/queryClient";

/* ── Shape ─────────────────────────────────────────────────────────────── */

/** The four public marketing lines. Stored as these canonical English values,
 *  never the translated label a visitor saw, so leads-portal filters keep
 *  working when someone fills the form in Hindi. */
export const LINES_OF_BUSINESS = ["term", "health", "life", "vehicle"] as const;
export type LineOfBusiness = (typeof LINES_OF_BUSINESS)[number];

export const LOB_META: Record<LineOfBusiness, { en: string; hi: string; emoji: string }> = {
  term:    { en: "Term",    hi: "टर्म",     emoji: "🛡️" },
  health:  { en: "Health",  hi: "हेल्थ",    emoji: "🩺" },
  life:    { en: "Life",    hi: "लाइफ",     emoji: "💠" },
  vehicle: { en: "Vehicle", hi: "गाड़ी",    emoji: "🚗" },
};

/** Languages an advisor can say they speak. Wider than the languages the page
 *  copy exists in (EN/HI today) — "speaks Marathi" is a trust signal even when
 *  the page itself is in Hindi. */
export const SPOKEN_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "mr", label: "मराठी" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "bn", label: "বাংলা" },
  { code: "ml", label: "മലയാളം" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
] as const;

export type PageLocale = "en" | "hi";

export type AdvisorPage = {
  id: string;
  agent_id: string;
  slug: string;
  display_name: string;
  photo_url: string | null;
  city: string | null;
  languages: string[];
  lines_of_business: LineOfBusiness[];
  primary_locale: PageLocale;
  whatsapp_number: string | null;
  /** Set by us (the allowlist). The agent cannot change it — a DB trigger pins
   *  it back on any update that carries an end-user JWT. */
  enabled: boolean;
  /** Set by the agent when they're ready to go live. */
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/** What a stranger is allowed to see. Mirrors GET /api/p/:slug exactly. */
export type PublicAdvisorPage = {
  live: true;
  slug: string;
  display_name: string;
  photo_url: string | null;
  city: string | null;
  languages: string[];
  lines_of_business: LineOfBusiness[];
  primary_locale: PageLocale;
  whatsapp_number: string | null;
};

/** A page that exists but has been pulled. QR codes outlive subscriptions, so
 *  this gets a real "no longer active" screen rather than a bare 404. */
export type InactiveAdvisorPage = { live: false; display_name: string | null };

/* ── Public side (no auth) ─────────────────────────────────────────────── */

export async function fetchPublicPage(
  slug: string,
): Promise<PublicAdvisorPage | InactiveAdvisorPage | null> {
  const res = await fetch(`${getApiBase()}/api/p/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Could not load this page");
  return (await res.json()) as PublicAdvisorPage | InactiveAdvisorPage;
}

/** Fire-and-forget. Lead counts without a view count can't tell a good ad from
 *  a bad one, but a failed analytics write must never break the page. */
export function recordView(slug: string, utmSource: string | null): void {
  try {
    fetch(`${getApiBase()}/api/p/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utm_source: utmSource || "direct" }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export type AdvisorLeadSubmission = {
  name: string;
  phone: string;
  intent: "talk" | "policy";
  lob?: LineOfBusiness | "";
  message?: string;
  files?: File[];
  consentText: string;
  utm: UtmParams;
};

export async function submitAdvisorLead(
  slug: string,
  input: AdvisorLeadSubmission,
): Promise<{ ok: boolean; files_saved?: number }> {
  const fd = new FormData();
  fd.append("name", input.name);
  fd.append("phone", input.phone);
  fd.append("intent", input.intent);
  if (input.lob) fd.append("lob", input.lob);
  if (input.message) fd.append("message", input.message);
  fd.append("consent_text", input.consentText);
  if (input.utm.source) fd.append("utm_source", input.utm.source);
  if (input.utm.medium) fd.append("utm_medium", input.utm.medium);
  if (input.utm.campaign) fd.append("utm_campaign", input.utm.campaign);
  // Honeypot: always sent, always empty from a real browser. A bot that fills
  // every input gets a cheerful 200 and writes nothing.
  fd.append("company", "");
  for (const f of input.files ?? []) fd.append("files", f);

  const res = await fetch(`${getApiBase()}/api/p/${encodeURIComponent(slug)}/lead`, {
    method: "POST",
    body: fd,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "Could not send that. Please try again.");
  return body;
}

/* ── Consent ───────────────────────────────────────────────────────────── */

/**
 * The exact sentence the visitor ticks, naming the advisor they can see on the
 * page. Stored verbatim on the lead: if this person ever asks what they agreed
 * to, the answer has to be the words they actually read, not a boolean.
 *
 * IndSure is the data fiduciary here — the page is on our domain and we collect
 * it — so the sentence says we share it, and the grievance route is ours.
 */
export function consentSentence(advisorName: string, locale: PageLocale): string {
  if (locale === "hi") {
    return `मैं सहमत हूँ कि IndSure मेरी दी गई जानकारी और अपलोड किए गए दस्तावेज़ ${advisorName} के साथ साझा करे, ताकि वे मुझसे संपर्क कर सकें।`;
  }
  return `I agree that IndSure may share the details and documents I provide here with ${advisorName}, so that they can contact me.`;
}

/* ── Campaign attribution ──────────────────────────────────────────────── */

export type UtmParams = { source: string | null; medium: string | null; campaign: string | null };

export function readUtm(search: string = window.location.search): UtmParams {
  const q = new URLSearchParams(search);
  const clean = (v: string | null) => {
    const t = (v ?? "").trim().slice(0, 80);
    return t === "" ? null : t;
  };
  return {
    source: clean(q.get("utm_source")),
    medium: clean(q.get("utm_medium")),
    campaign: clean(q.get("utm_campaign")),
  };
}

/**
 * Channels for the share kit. The whole point is that the advisor never types
 * or edits a URL — he copies the one for the channel he's about to post on, and
 * the tagging happens for him. Hand an agent a bare link and every lead lands
 * as "direct", which makes the view/lead numbers unattributable.
 */
export const SHARE_CHANNELS = [
  { key: "whatsapp",  label: "WhatsApp",     utm: "whatsapp" },
  { key: "instagram", label: "Instagram bio", utm: "instagram" },
  { key: "facebook",  label: "Facebook",     utm: "facebook" },
  { key: "qr",        label: "QR / printed", utm: "qr" },
  { key: "sms",       label: "SMS",          utm: "sms" },
] as const;

export type ShareChannel = (typeof SHARE_CHANNELS)[number]["key"];

/**
 * Origin for shared links, QR codes and the copy buttons.
 *
 * On production this is always the canonical apex domain, so an advisor can
 * never hand a prospect a preview URL that will disappear.
 *
 * Anywhere else — beta, or a laptop — it is the host you are actually on.
 * Hardcoding production everywhere made the whole share kit untestable: the QR
 * pointed at indsure.in while the feature only existed on beta, so scanning it
 * landed on the marketing homepage.
 */
export function publicOrigin(): string {
  if (typeof window === "undefined") return "https://indsure.in";
  const host = window.location.hostname;
  if (host === "indsure.in" || host === "www.indsure.in") return "https://indsure.in";
  return window.location.origin;
}

/** @deprecated Prefer publicOrigin() — this cannot reflect the current host. */
export const PUBLIC_ORIGIN = "https://indsure.in";

export function pageUrl(slug: string, channel?: ShareChannel, campaign?: string): string {
  const base = `${publicOrigin()}/a/${slug}`;
  const ch = SHARE_CHANNELS.find((c) => c.key === channel);
  if (!ch) return base;
  const q = new URLSearchParams({ utm_source: ch.utm, utm_medium: "share" });
  if (campaign?.trim()) q.set("utm_campaign", campaign.trim());
  return `${base}?${q.toString()}`;
}

/* ── WhatsApp ──────────────────────────────────────────────────────────── */

/** Last 10 digits, +91 — same rule as leads.ts, kept in step with it. */
export function waNumber(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return `91${d.slice(-10)}`;
}

/**
 * Deep link into the advisor's WhatsApp with the prospect's own message ready
 * to send.
 *
 * Note for the caller: this must be opened from inside a real tap handler.
 * Mobile browsers — Instagram's in-app webview worst of all — block a
 * programmatic open that happens after an async fetch resolves, so the success
 * screen shows a button the prospect presses rather than redirecting for them.
 */
export function waDeepLink(
  advisorPhone: string | null,
  prospectName: string,
  locale: PageLocale,
  lob?: LineOfBusiness | "",
): string | null {
  const n = waNumber(advisorPhone);
  if (!n) return null;
  const line = LOB_META[(lob || "health") as LineOfBusiness];
  const text =
    locale === "hi"
      ? `नमस्ते, मैं ${prospectName} हूँ। मैंने आपका IndSure पेज देखा और ${line.hi} बीमा के बारे में बात करना चाहता/चाहती हूँ।`
      : `Hello, this is ${prospectName}. I saw your IndSure page and would like to talk about ${line.en.toLowerCase()} insurance.`;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

/* ── Agent side (supabase-js, RLS-scoped) ──────────────────────────────── */

export async function fetchMyPage(agentId: string): Promise<AdvisorPage | null> {
  const { data, error } = await supabase
    .from("agent_pages")
    .select("*")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AdvisorPage | null;
}

export type AdvisorPageDraft = {
  display_name?: string;
  photo_url?: string | null;
  city?: string | null;
  languages?: string[];
  lines_of_business?: LineOfBusiness[];
  primary_locale?: PageLocale;
  whatsapp_number?: string | null;
  published?: boolean;
};

/** `enabled` and `slug` are intentionally absent from the draft type: both are
 *  ours to set, and the DB trigger pins them back even if something tried. */
export async function updateMyPage(pageId: string, draft: AdvisorPageDraft): Promise<void> {
  const { error } = await supabase.from("agent_pages").update(draft).eq("id", pageId);
  if (error) throw new Error(error.message);
}

export type ViewStat = {
  viewed_on: string;
  utm_source: string;
  /** instagram | facebook | whatsapp | telegram | linkedin | browser | other */
  app: string;
  /** mobile | tablet | desktop | unknown */
  device: string;
  views: number;
};

export async function fetchPageViews(pageId: string, sinceDays = 30): Promise<ViewStat[]> {
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("agent_page_views")
    .select("viewed_on, utm_source, app, device, views")
    .eq("page_id", pageId)
    .gte("viewed_on", since)
    .order("viewed_on", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ViewStat[];
}

/** Plain labels for the advisor. "Instagram" means the in-app browser, which is
 *  where most social traffic actually lands. */
export const APP_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  linkedin: "LinkedIn",
  browser: "Web browser",
  other: "Other",
};

export const DEVICE_LABELS: Record<string, string> = {
  mobile: "Phone",
  tablet: "Tablet",
  desktop: "Computer",
  unknown: "Unknown",
};

/** Roll the per-day rows up into a single "where visitors come from" list. */
export function summariseByApp(stats: ViewStat[]): { key: string; label: string; views: number }[] {
  const totals = new Map<string, number>();
  for (const s of stats) totals.set(s.app, (totals.get(s.app) ?? 0) + s.views);
  return Array.from(totals.entries())
    .map(([key, views]) => ({ key, label: APP_LABELS[key] ?? key, views }))
    .sort((a, b) => b.views - a.views);
}

export function summariseByDevice(stats: ViewStat[]): { key: string; label: string; views: number }[] {
  const totals = new Map<string, number>();
  for (const s of stats) totals.set(s.device, (totals.get(s.device) ?? 0) + s.views);
  return Array.from(totals.entries())
    .map(([key, views]) => ({ key, label: DEVICE_LABELS[key] ?? key, views }))
    .sort((a, b) => b.views - a.views);
}

/* ── Display-name guard ────────────────────────────────────────────────── */

/**
 * The one field an advisor types freely is their own name, so it's the one
 * place a page on our domain could be made to read as an official IndSure, LIC
 * or IRDAI page. Cheap blocklist, checked before publish.
 */
const RESERVED_NAME_TERMS = [
  "indsure", "ind sure", "irdai", "irda", "lic ", " lic", "official",
  "insurance company", "customer care", "helpline", "govt", "government",
];

export function displayNameProblem(name: string): string | null {
  const n = ` ${name.trim().toLowerCase()} `;
  if (name.trim().length < 3) return "Please enter your full name.";
  if (name.trim().length > 60) return "That name is too long.";
  const hit = RESERVED_NAME_TERMS.find((t) => n.includes(t));
  if (hit) {
    return "Please use your own name here. Company, regulator and helpline names aren't allowed on an advisor page.";
  }
  return null;
}

/* ── Photo ─────────────────────────────────────────────────────────────── */

/** Public bucket — a page photo has to be readable by strangers and by
 *  Facebook/WhatsApp's link-preview crawlers, and signed URLs expire while
 *  those crawlers cache for weeks. Nothing private is ever put here. */
export const ADVISOR_PHOTO_BUCKET = "advisor-photos";

/** Every stored headshot is exactly this, square. Fixed so the link-preview
 *  card can declare og:image:width/height honestly. */
export const PHOTO_SIZE = 512;

/**
 * Centre-crop to a square and downscale in the browser before upload. An
 * advisor will send an 8MB portrait straight off a phone camera; the page needs
 * 512px of it. Square because the page renders a round avatar and because a
 * known, fixed size lets the WhatsApp/Facebook preview card state real image
 * dimensions instead of guessing.
 */
export async function resizePhoto(file: File, size = PHOTO_SIZE): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.round((bitmap.width - side) / 2);
  const sy = Math.round((bitmap.height - side) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process that image."))),
      "image/jpeg",
      0.85,
    ),
  );
}

export async function uploadPhoto(agentId: string, file: File): Promise<string> {
  const blob = await resizePhoto(file);
  const path = `${agentId}/photo.jpg`;
  const { error } = await supabase.storage
    .from(ADVISOR_PHOTO_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(ADVISOR_PHOTO_BUCKET).getPublicUrl(path);
  // Cache-bust: the path is stable across re-uploads so the CDN would otherwise
  // keep serving the old headshot.
  return `${data.publicUrl}?v=${Date.now()}`;
}
