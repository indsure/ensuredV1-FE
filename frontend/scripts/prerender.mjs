// Browser-free prerender for the IndSure SPA.
//
// Why: the app is client-rendered (createRoot). Without this step every route
// serves the same homepage <head> and an empty <div id="root"> to any crawler
// that does not run JavaScript (GPTBot, PerplexityBot, ClaudeBot, and Google's
// first pass). This script rewrites dist/<route>/index.html with per-page
// title/description/canonical/OG tags, page-specific JSON-LD, and real body
// content baked into #root. Because the app uses createRoot (not hydrateRoot),
// React simply replaces #root on mount, so there is no hydration mismatch.
//
// It runs as `postbuild`, after `vite build`, and uses only Node + esbuild
// (already a Vite dependency). No headless browser, so it is safe in CI/Vercel.

import { build } from "esbuild";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = join(ROOT, "dist");
const SITE = "https://indsure.in";

// ---------------------------------------------------------------------------
// Load blog data (TS with lucide imports) by bundling it for Node with esbuild.
// ---------------------------------------------------------------------------
async function loadBlogData() {
  const entry = join(__dirname, ".blog-entry.mjs");
  await writeFile(
    entry,
    [
      `export { blogPosts } from "../client/src/pages/blog/blog-data.ts";`,
      `export { POST_SLUGS, slugFor } from "../client/src/pages/blog/slugs.ts";`,
    ].join("\n"),
  );
  const outfile = join(__dirname, ".blog-bundle.mjs");
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "silent",
    loader: { ".css": "empty", ".png": "empty", ".jpg": "empty", ".svg": "empty" },
  });
  const mod = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
  await rm(entry, { force: true });
  await rm(outfile, { force: true });
  return mod;
}

// ---------------------------------------------------------------------------
// Small HTML helpers
// ---------------------------------------------------------------------------
const escAttr = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escText = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function applyHead(template, { title, description, canonical, ogType = "website" }) {
  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escText(title)}</title>`);
  // description / og:description / twitter:description
  html = html.replace(
    /(<meta name="description"\s+content=")[\s\S]*?("\s*\/>)/,
    `$1${escAttr(description)}$2`,
  );
  html = html.replace(
    /(<meta property="og:description"\s+content=")[\s\S]*?("\s*\/>)/,
    `$1${escAttr(description)}$2`,
  );
  html = html.replace(
    /(<meta name="twitter:description"\s+content=")[\s\S]*?("\s*\/>)/,
    `$1${escAttr(description)}$2`,
  );
  // titles
  html = html.replace(
    /(<meta property="og:title" content=")[\s\S]*?("\s*\/>)/,
    `$1${escAttr(title)}$2`,
  );
  html = html.replace(
    /(<meta name="twitter:title" content=")[\s\S]*?("\s*\/>)/,
    `$1${escAttr(title)}$2`,
  );
  // urls
  html = html.replace(
    /(<meta property="og:url" content=")[\s\S]*?("\s*\/>)/,
    `$1${escAttr(canonical)}$2`,
  );
  html = html.replace(
    /(<meta name="twitter:url" content=")[\s\S]*?("\s*\/>)/,
    `$1${escAttr(canonical)}$2`,
  );
  html = html.replace(/(<meta property="og:type" content=")[\s\S]*?("\s*\/>)/, `$1${ogType}$2`);
  // canonical link
  html = html.replace(
    /(<link rel="canonical" href=")[\s\S]*?("\s*\/>)/,
    `$1${escAttr(canonical)}$2`,
  );
  return html;
}

function injectJsonLd(html, blocks) {
  if (!blocks.length) return html;
  const scripts = blocks
    .map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`)
    .join("\n  ");
  return html.replace("</head>", `  ${scripts}\n</head>`);
}

function injectBody(html, bodyHtml) {
  return html.replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root">${bodyHtml}</div>`,
  );
}

async function writeRoute(path, html) {
  const outPath =
    path === "/" ? join(DIST, "index.html") : join(DIST, path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html);
}

// ---------------------------------------------------------------------------
// Static marketing / product routes
// ---------------------------------------------------------------------------
const STATIC_ROUTES = [
  {
    path: "/",
    title: "Decode Your Insurance Policy Free in 60 Seconds | IndSure India",
    description:
      "Upload your health, term life, or car insurance PDF. IndSure shows your room-rent cap, co-pay, waiting periods, and coverage gaps in plain language in about 60 seconds. Free, private, no sales calls.",
    h1: "Understand your insurance policy, in plain language",
    intro:
      "IndSure reads your Indian health, term life, or motor insurance policy PDF and explains what it actually covers: room-rent cap, co-pay, sub-limits, waiting periods, exclusions, and the gaps that cost people money at claim time. Free, private, and with no sales calls.",
  },
  {
    path: "/how-it-works",
    title: "How IndSure Works: Upload, Decode, Understand | IndSure",
    description:
      "See how IndSure turns a confusing insurance policy PDF into a clear, plain-language breakdown of your coverage, limits, and gaps in about 60 seconds.",
    h1: "How IndSure works",
    intro:
      "Upload your policy PDF, and IndSure reads it clause by clause, extracts the terms that matter, and shows you a plain-language verdict on your coverage, limits, and gaps.",
  },
  {
    path: "/policychecker",
    title: "Health Insurance Policy Checker: Room Rent, Co-pay & Gaps | IndSure",
    description:
      "Upload your health or mediclaim policy PDF and see your room-rent cap, co-pay, sub-limits, waiting periods, and coverage gaps explained in plain language. Free and private, no sales calls.",
    h1: "Health insurance policy checker",
    intro:
      "Upload a health or mediclaim policy and IndSure shows your room-rent cap, co-pay, sub-limits, pre-existing-disease waiting periods, and the coverage gaps that matter, in plain language.",
  },
  {
    path: "/life",
    title: "Life & Term Insurance Policy Checker: Sum Assured, Riders, Claims | IndSure",
    description:
      "Upload your life or term insurance PDF and instantly see whether your sum assured is enough for your family, plus claim conditions, exclusions, and how your riders actually protect you. Free and private.",
    h1: "Life and term insurance policy checker",
    intro:
      "Upload a life or term insurance policy and IndSure explains your sum assured, riders, claim conditions, and exclusions, so you know whether your family is actually protected.",
  },
  {
    path: "/term",
    title: "Term Life Insurance Policy Checker: Sum Assured & Claims | IndSure",
    description:
      "Upload your term life insurance PDF and see whether your sum assured is enough, understand claim conditions and exclusions, and maximise pure protection per rupee. Free and private.",
    h1: "Term life insurance policy checker",
    intro:
      "Upload a term life policy and IndSure explains your sum assured, claim conditions, and exclusions, so you can see whether your pure-protection cover is enough for your family.",
  },
  {
    path: "/vehicle",
    title: "Car & Bike Insurance Checker: IDV, NCB, Deductibles | IndSure",
    description:
      "Upload your car or bike policy and instantly see whether you are third-party or comprehensive, your IDV, deductibles, no-claim bonus impact, and what an accident will really cost you. Free and private.",
    h1: "Vehicle insurance policy checker",
    intro:
      "Upload a car or bike policy and IndSure shows whether you are third-party or comprehensive, your IDV, deductibles, and No Claim Bonus, plus what a claim will really cost you.",
  },
  {
    path: "/compare",
    title: "Compare Two Insurance Policies Wording-to-Wording | IndSure",
    description:
      "Compare two insurance policies side by side, clause by clause. See the real differences in coverage, limits, waiting periods, and exclusions in plain language.",
    h1: "Compare insurance policies",
    intro:
      "Put two policies side by side and IndSure compares them wording to wording, so you can see the real differences in coverage, limits, waiting periods, and exclusions.",
  },
  {
    path: "/pricing",
    title: "IndSure Pricing: Free Policy Checks & Paid Plans | IndSure",
    description:
      "Check your insurance policy for free. See IndSure's plans for deeper analysis, comparisons, and portfolio tracking. No commissions, no lead selling.",
    h1: "IndSure pricing",
    intro:
      "Checking a policy is free. Paid plans unlock deeper analysis, comparisons, and portfolio tracking. IndSure earns zero commissions and never sells your data as a lead.",
  },
  {
    path: "/blog",
    title: "Insurance Guides for India: Health, Life & Motor | IndSure Blog",
    description:
      "Plain-language guides to Indian insurance: room-rent caps, co-pay, waiting periods, term insurance, car insurance IDV, and more. Understand your cover before you claim.",
    h1: "IndSure insurance guides",
    intro:
      "Plain-language guides to Indian insurance, covering health, term life, and motor: room-rent caps, co-pay, waiting periods, IDV, No Claim Bonus, and the concepts that decide your claim.",
  },
  {
    path: "/why-indsure",
    title: "Why IndSure: Unbiased Insurance Clarity, No Sales | IndSure",
    description:
      "IndSure earns zero commissions and sells zero leads. We decode your insurance policy so you understand it, not so we can sell you another one.",
    h1: "Why IndSure",
    intro:
      "IndSure earns zero commissions and sells zero leads. We decode your policy so you understand your cover, with no cold calls and no pressure to buy.",
  },
];

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
async function main() {
  if (!existsSync(DIST)) {
    console.error("[prerender] dist/ not found. Run `vite build` first.");
    process.exit(1);
  }
  const template = await readFile(join(DIST, "index.html"), "utf8");

  // Static pages
  for (const r of STATIC_ROUTES) {
    const canonical = SITE + (r.path === "/" ? "/" : r.path);
    let html = applyHead(template, {
      title: r.title,
      description: r.description,
      canonical,
    });
    const body = `<main><h1>${escText(r.h1)}</h1><p>${escText(r.intro)}</p></main>`;
    html = injectBody(html, body);
    await writeRoute(r.path, html);
  }

  // Blog posts
  const { blogPosts, slugFor } = await loadBlogData();
  let postCount = 0;
  for (const post of blogPosts) {
    const slug = slugFor(post.id);
    const path = `/blog/${slug}`;
    const canonical = SITE + path;
    const title = `${post.title} | IndSure Blog`;
    const description = post.excerpt;

    let html = applyHead(template, { title, description, canonical, ogType: "article" });

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.excerpt,
        author: { "@type": "Organization", name: post.author || "IndSure" },
        datePublished: post.date,
        dateModified: post.date,
        publisher: {
          "@type": "Organization",
          name: "IndSure",
          logo: { "@type": "ImageObject", url: `${SITE}/favicon.png` },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
      },
    ];
    if (Array.isArray(post.faqs) && post.faqs.length) {
      jsonLd.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: post.faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      });
    }
    html = injectJsonLd(html, jsonLd);

    const faqHtml =
      Array.isArray(post.faqs) && post.faqs.length
        ? `<section><h2>Frequently asked questions</h2>${post.faqs
            .map((f) => `<h3>${escText(f.question)}</h3><p>${escText(f.answer)}</p>`)
            .join("")}</section>`
        : "";
    const body =
      `<article><h1>${escText(post.title)}</h1>` +
      `<p>${escText(post.excerpt)}</p>` +
      `${post.content || ""}${faqHtml}</article>`;
    html = injectBody(html, body);

    await writeRoute(path, html);
    postCount++;
  }

  console.log(
    `[prerender] wrote ${STATIC_ROUTES.length} static pages + ${postCount} blog posts.`,
  );
}

main().catch((err) => {
  console.error("[prerender] failed:", err);
  process.exit(1);
});
