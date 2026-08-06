/**
 * Per-advisor link previews for /a/<slug>.
 *
 * Why this exists: the site is a client-rendered SPA. WhatsApp, Facebook and
 * Instagram fetch a shared URL with a crawler that does not run JavaScript, so
 * without this every advisor's link would preview as the generic IndSure card.
 * For a channel that is mostly forwarded WhatsApp messages and printed QR
 * codes, that preview card IS the click-through rate.
 *
 * How: vercel.json rewrites /a/:slug here. We fetch the built index.html from
 * the same deployment, swap in per-advisor <title>/description/OG tags, and
 * return it. Real browsers get the same shell and boot the SPA exactly as
 * before — the injected tags are simply overwritten by useSEO on mount.
 *
 * This route is on the critical path for every visit to an advisor page, so
 * every failure mode falls back to serving the plain shell rather than erroring.
 */

// Public anon credentials — the same pair already shipped in the client bundle.
// RLS on agent_pages allows anon SELECT only where (enabled AND published), so
// this can read live advisor pages and nothing else.
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://khxbabotbvnyjwvqtumt.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeGJhYm90YnZueWp3dnF0dW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDc1OTIsImV4cCI6MjA4ODc4MzU5Mn0.H7mVu4EUWLTzzUN4DhA_xWk2bi4LR8vFFN2NT1jIs08";

const SITE = "https://indsure.in";
const PHOTO_SIZE = 512;

const escapeHtml = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type AdvisorRow = {
  display_name: string;
  photo_url: string | null;
  city: string | null;
  primary_locale: "en" | "hi";
};

/** Preview copy in the advisor's own page language — he is advertising to his
 *  audience, and the card is the first thing they read. */
function previewCopy(row: AdvisorRow) {
  const where = row.city ? ` · ${row.city}` : "";
  if (row.primary_locale === "hi") {
    return {
      title: `${row.display_name} — बीमा सलाहकार${where}`,
      description: `अपनी पॉलिसी ${row.display_name} को भेजिए, या बीमा से जुड़ा कोई भी सवाल पूछिए। आसान भाषा में जवाब।`,
    };
  }
  return {
    title: `${row.display_name} — Insurance Advisor${where}`,
    description: `Send your policy to ${row.display_name} for a plain-language review, or ask any question about your cover.`,
  };
}

export default async function handler(req: any, res: any) {
  const slug = String(req.query?.slug || "").toLowerCase();
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const shellUrl = `${proto}://${host}/index.html`;

  let shell = "";
  try {
    const shellRes = await fetch(shellUrl);
    if (!shellRes.ok) throw new Error(`shell ${shellRes.status}`);
    shell = await shellRes.text();
  } catch (err) {
    // Nothing to inject into. Let the SPA's own catch-all handle it.
    res.setHeader("Location", `/index.html`);
    res.status(302).end();
    return;
  }

  let row: AdvisorRow | null = null;
  if (/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) {
    try {
      const q = `${SUPABASE_URL}/rest/v1/agent_pages?slug=eq.${encodeURIComponent(
        slug,
      )}&enabled=eq.true&published=eq.true&select=display_name,photo_url,city,primary_locale`;
      const r = await fetch(q, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      if (r.ok) {
        const rows = (await r.json()) as AdvisorRow[];
        row = rows?.[0] ?? null;
      }
    } catch {
      // Fall through: a preview without advisor detail still beats a 500.
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Short cache: an advisor who fixes a typo in their name should not wait
  // hours, but a forwarded link that goes viral should not hit the DB per view.
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");

  if (!row) {
    res.status(200).send(shell);
    return;
  }

  const { title, description } = previewCopy(row);
  const image = row.photo_url || `${SITE}/opengraph.jpg`;
  const url = `${SITE}/a/${slug}`;

  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    // These pages are ad and referral destinations, not search landing pages.
    // Hundreds of near-identical advisor pages would read as thin content and
    // drag on the main domain's own rankings.
    `<meta name="robots" content="noindex, nofollow" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:site_name" content="IndSure" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:locale" content="${row.primary_locale === "hi" ? "hi_IN" : "en_IN"}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ];

  // Headshots are stored centre-cropped at a fixed square size, so the card can
  // declare real dimensions. WhatsApp needs these to render the large preview
  // instead of a small thumbnail; a stock fallback image gets no claim made.
  if (row.photo_url) {
    tags.push(
      `<meta property="og:image:width" content="${PHOTO_SIZE}" />`,
      `<meta property="og:image:height" content="${PHOTO_SIZE}" />`,
      `<meta property="og:image:type" content="image/jpeg" />`,
    );
  }

  // Drop the shell's own title/description/OG tags first, or crawlers that take
  // the first match would keep showing the generic IndSure card.
  const stripped = shell
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<meta\s+name="robots"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "");

  const html = stripped.replace(/<head([^>]*)>/i, `<head$1>\n    ${tags.join("\n    ")}`);

  res.status(200).send(html);
}
