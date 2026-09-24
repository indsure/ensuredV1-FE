// Browser-free prerender for the IndSure SPA.
//
// Why: the app is client-rendered (createRoot). Without this step every route
// serves the same homepage <head> and an empty <div id="root"> to any crawler
// that does not run JavaScript (GPTBot, PerplexityBot, ClaudeBot, and Google's
// first pass). This script rewrites dist/<route>/index.html with per-page
// title/description/canonical/OG tags, page-specific JSON-LD, and real body
// content baked into #root inside a <noscript>, so a crawler reads it and a
// browser never paints it. Because the app uses createRoot (not hydrateRoot),
// React simply replaces #root on mount, so there is no hydration mismatch.
//
// It runs as `postbuild`, after `vite build`, and uses only Node + esbuild
// (already a Vite dependency). No headless browser, so it is safe in CI/Vercel.

import { build } from "esbuild";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = join(ROOT, "dist");
const SITE = "https://indsure.in";
// Canonical URLs/JSON-LD always point at production (SITE) so the beta preview
// never competes with prod for indexing. Social-preview images are the one
// exception: they must be absolute, so on Vercel *preview* builds we serve them
// from the beta host, otherwise the beta pages would reference prod's images
// (which still hold the old artwork until this ships to production).
const IMAGE_HOST =
  process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production"
    ? "https://beta.indsure.in"
    : SITE;

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
      `export { FOUNDERS, authorForId, displayName } from "../client/src/data/team.ts";`,
      `export { CLAUSE_LIBRARY } from "../client/src/data/clause-library.ts";`,
      `export { PAGE_SEO, clauseTitle, blogTitle, blogDescription, metaDescription, TITLE_MAX } from "../client/src/data/seo-pages.ts";`,
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

function applyHead(
  template,
  { title, description, canonical, ogType = "website", image = "/opengraph.jpg", imageAlt, noindex = false },
) {
  let html = template;
  html = html.replace(
    /(<meta name="robots" content=")[\s\S]*?("\s*\/>)/,
    `$1${noindex ? "noindex, follow" : "index, follow"}$2`,
  );
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
    `$1${escAttr(canonical || `${SITE}/`)}$2`,
  );
  html = html.replace(
    /(<meta name="twitter:url" content=")[\s\S]*?("\s*\/>)/,
    `$1${escAttr(canonical || `${SITE}/`)}$2`,
  );
  html = html.replace(/(<meta property="og:type" content=")[\s\S]*?("\s*\/>)/, `$1${ogType}$2`);
  // og:image / twitter:image (per-route social preview). Always rewritten so
  // every page resolves its image from IMAGE_HOST (prod, or beta on preview
  // builds); routes that set no `image` fall back to the general brand image.
  const imageUrl = image.startsWith("http") ? image : IMAGE_HOST + image;
  html = html.replace(
    /(<meta property="og:image" content=")[\s\S]*?("\s*\/>)/,
    `$1${escAttr(imageUrl)}$2`,
  );
  html = html.replace(
    /(<meta name="twitter:image" content=")[\s\S]*?("\s*\/>)/,
    `$1${escAttr(imageUrl)}$2`,
  );
  if (imageAlt) {
    html = html.replace(
      /(<meta property="og:image:alt" content=")[\s\S]*?("\s*\/>)/,
      `$1${escAttr(imageAlt)}$2`,
    );
    html = html.replace(
      /(<meta name="twitter:image:alt" content=")[\s\S]*?("\s*\/>)/,
      `$1${escAttr(imageAlt)}$2`,
    );
  }
  // canonical link (none at all for the 404 and app shells: a page that is not
  // a page has nothing to be canonical to)
  html = html.replace(
    /(<link rel="canonical" href=")[\s\S]*?("\s*\/>)/,
    canonical ? `$1${escAttr(canonical)}$2` : "",
  );
  return html;
}

function injectJsonLd(html, blocks) {
  if (!blocks.length) return html;
  const scripts = blocks
    // The id matches the one SchemaMarkup (components/SEO.tsx) gives the same
    // type, so when React mounts it replaces this block instead of adding a
    // second copy. Search Console saw Article, FAQPage and friends twice.
    .map(
      (b) =>
        `<script type="application/ld+json" id="schema-${String(b["@type"]).toLowerCase()}">${JSON.stringify(b)}</script>`,
    )
    .join("\n  ");
  return html.replace("</head>", `  ${scripts}\n</head>`);
}

// The seed is for crawlers that do not run JavaScript. Browsers do run it, but
// not instantly: the markup carries no classes, so for the ~90ms between first
// paint and createRoot replacing #root, a real visitor sees an unstyled <h1>
// and paragraph fill the screen. <noscript> keeps the markup in the document
// for the crawlers that need it and renders nothing for everyone else.
function injectBody(html, bodyHtml, currentPath) {
  if (currentPath !== undefined) bodyHtml += navHtml(currentPath);
  return html.replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root"><noscript>${bodyHtml}</noscript></div>`,
  );
}

// ---------------------------------------------------------------------------
// Site navigation seed.
//
// Two separate holes this plugs. The seed below used to carry an <h1> and one
// paragraph and nothing else, so a crawler that does not run JS read every
// page as an orphan with no outbound links at all. And the header's Tools
// menu is a Radix dropdown, whose links live in a portal that is not mounted
// until a human opens it, so /calculator, /compare, /policychecker and
// /find-provider were reachable only from the footer.
//
// These are the pages we want treated as the site's primary entry points,
// with the anchor text we want them labelled by. The first seven match the
// ItemList in client/index.html, in the same order.
const SITE_NAV = [
  { name: "Health policy checker", url: "/policychecker" },
  { name: "How it works", url: "/how-it-works" },
  { name: "Cover calculator", url: "/calculator" },
  { name: "Compare policies", url: "/compare" },
  { name: "Pricing", url: "/pricing" },
  { name: "Clause library", url: "/learn" },
  { name: "Advisor Portal", url: "/agent" },
  { name: "Your insurance portfolio", url: "/start" },
  { name: "Network hospital finder", url: "/find-provider" },
];

// Rendered into every prerendered page's seed, minus a self-link.
function navHtml(currentPath) {
  const items = SITE_NAV.filter((x) => x.url !== currentPath)
    .map((x) => `<li><a href="${x.url}">${escText(x.name)}</a></li>`)
    .join("");
  return `<nav aria-label="Site"><h2>IndSure</h2><ul>${items}</ul></nav>`;
}

// BreadcrumbList JSON-LD from [{name, url}] items.
function breadcrumbLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

async function writeRoute(path, html) {
  const outPath =
    path === "/" ? join(DIST, "index.html") : join(DIST, path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html);
}

// ---------------------------------------------------------------------------
// Static marketing / product routes
//
// Title and description come from PAGE_SEO (client/src/data/seo-pages.ts), the
// same table the pages hand to useSEO, so the raw HTML and the rendered page
// can no longer disagree. `src` is the page's source, used for sitemap lastmod.
// ---------------------------------------------------------------------------
const STATIC_ROUTES = [
  {
    path: "/",
    src: ["pages/home.tsx"],
    h1: "Your family's insurance, explained in one place",
    intro:
      "IndSure reads your Indian health, term life, or motor insurance policy PDF and explains what it actually covers: room-rent cap, co-pay, sub-limits, waiting periods, exclusions, and the gaps that cost people money at claim time. Free, private, and with no sales calls.",
  },
  {
    path: "/how-it-works",
    src: ["pages/how-it-works.tsx"],
    h1: "How IndSure works",
    intro:
      "Upload your policy PDF, and IndSure reads it clause by clause, extracts the terms that matter, and shows you a plain-language verdict on your coverage, limits, and gaps.",
  },
  {
    path: "/policychecker",
    src: ["pages/policychecker.tsx", "components/PolicyCheckerLanding.tsx"],
    h1: "Health insurance policy checker",
    intro:
      "Upload a health or mediclaim policy and IndSure shows your room-rent cap, co-pay, sub-limits, pre-existing-disease waiting periods, and the coverage gaps that matter, in plain language.",
  },
  {
    path: "/life",
    src: ["pages/life.tsx"],
    h1: "Life and term insurance policy checker",
    intro:
      "Upload a life or term insurance policy and IndSure explains your sum assured, riders, claim conditions, and exclusions, so you know whether your family is actually protected.",
  },
  {
    path: "/term",
    src: ["pages/term.tsx"],
    h1: "Term life insurance policy checker",
    intro:
      "Upload a term life policy and IndSure explains your sum assured, claim conditions, and exclusions, so you can see whether your pure-protection cover is enough for your family.",
  },
  {
    path: "/vehicle",
    src: ["pages/vehicle.tsx"],
    h1: "Vehicle insurance policy checker",
    intro:
      "Upload a car or bike policy and IndSure shows whether you are third-party or comprehensive, your IDV, deductibles, and No Claim Bonus, plus what a claim will really cost you.",
  },
  {
    path: "/compare",
    src: ["pages/compare/catalog-compare.tsx"],
    h1: "Compare health insurance policies",
    intro:
      "Put up to four health plans side by side and IndSure compares them wording to wording, so you can see the real differences in room limits, waiting periods, co-pay and exclusions.",
  },
  {
    path: "/pricing",
    src: ["pages/pricing.tsx"],
    h1: "IndSure pricing",
    intro:
      "The free plan does not expire: one health policy checked in plain language and one of each other type stored, with renewal reminders and PDF reports. The Personal plan is ₹99 a month or ₹999 a year, and covers 4 health policy checks a year, room for 12 more term life and vehicle policies, and replies from our team within 2 working days. IndSure earns zero commissions and never sells your data as a lead.",
  },
  {
    path: "/start",
    src: ["pages/start.tsx"],
    h1: "Start your insurance portfolio",
    intro:
      "Add your policy, and IndSure reads the wording (room rent limits, co-pay, sub-limits and waiting periods) in plain language. Every policy sits in one portfolio with a reminder 30 days before anything expires. One policy of each type is free forever, with no card needed. IndSure earns no commission from any insurer.",
  },
  {
    path: "/advisors/pricing",
    src: ["pages/advisors-pricing.tsx"],
    h1: "IndSure pricing for advisors",
    intro:
      "Your daily tools (leads, renewals, the cover calculator and WhatsApp drafts) are free forever. The Agent plan is ₹1,499 a month or ₹14,990 a year and adds 12 policy checks every month. IndSure takes no commission on anything you sell.",
  },
  {
    path: "/blog",
    src: ["pages/blog.tsx"],
    h1: "IndSure insurance guides",
    intro:
      "Plain-language guides to Indian insurance, covering health, term life, and motor: room-rent caps, co-pay, waiting periods, IDV, No Claim Bonus, and the concepts that decide your claim.",
  },
  {
    path: "/why-indsure",
    src: ["pages/why-indsure.tsx"],
    h1: "Why IndSure",
    intro:
      "IndSure earns zero commissions and sells zero leads. We decode your policy so you understand your cover, with no cold calls and no pressure to buy.",
  },
  {
    path: "/agent",
    src: ["pages/agent/Landing.tsx"],
    h1: "The CRM built for insurance advisors",
    intro:
      "IndSure gives insurance advisors one simple dashboard to manage clients, track every renewal, and decode any policy for their customers in plain language. Built for how Indian agents actually work.",
    image: "/opengraph-agent.jpg",
    imageAlt: "IndSure for advisors: the CRM built for insurance agents.",
  },
  {
    path: "/calculator",
    src: ["pages/calculator.tsx", "components/CalculatorLanding.tsx"],
    h1: "Health cover calculator",
    intro:
      "How much health cover your family actually needs, worked out from hospital costs in your city, your ages and your obligations. It takes two to three minutes, asks for no policy upload and no medical history, and there is nothing to buy at the end of it.",
  },
  {
    path: "/find-provider",
    src: ["pages/hospitals.tsx"],
    h1: "Cashless network hospital finder",
    intro:
      "A policy is only cashless at hospitals the insurer has a tie-up with. Check which insurers actually cover your area before you buy, not after a claim.",
  },
  {
    path: "/team",
    src: ["pages/team.tsx"],
    h1: "Three people, one fine-print problem",
    intro:
      "IndSure is built by a small team that got tired of watching people find out what their policy actually covers only after a claim gets rejected.",
  },
  {
    path: "/help",
    src: ["pages/help.tsx"],
    h1: "Help and support",
    intro: "Find answers to common questions or get in touch with our support team.",
  },
  {
    path: "/mission",
    src: ["pages/mission.tsx"],
    h1: "Why IndSure?",
    intro:
      "Insurance was designed to protect you. Somewhere along the way, it became about confusing you.",
  },
  {
    path: "/vision",
    src: ["pages/vision.tsx"],
    h1: "Our vision",
    intro:
      "A future where insurance decisions are made with complete clarity, where every policyholder understands exactly what they are buying and how it protects them.",
  },

  // noindex (PAGE_SEO marks them). Prerendered anyway so the raw HTML carries
  // their own title, a self-canonical and the noindex. Before this the legal
  // pages served the HOMEPAGE head, canonical and all, to any crawler.
  { path: "/privacy-policy", h1: "Privacy Policy" },
  { path: "/terms", h1: "Terms of Service" },
  { path: "/cookie-policy", h1: "Cookie Policy" },
  { path: "/grievance", h1: "Grievance Officer" },
  {
    path: "/signup",
    h1: "Create your free IndSure account",
    image: "/opengraph-signup.jpg",
    imageAlt: "IndSure: all your insurance policies, organised in one clear place.",
  },
  { path: "/login", h1: "Sign in to IndSure" },
  { path: "/agent/login", h1: "Advisor sign in" },
  { path: "/agent/signup", h1: "Create your advisor account" },
  { path: "/agent/playground", h1: "Advisor Portal demo" },
];

// ---------------------------------------------------------------------------
// Build-time checks on the SEO table. A failure stops the build, so a title
// that grows past what Google shows, or a description that drops the brand
// name, never reaches production. (The brand check is the one that matters:
// without "IndSure" in the description, Google quotes whatever other line on
// the page names the brand, which is how the footer tagline became a sitelink.)
// ---------------------------------------------------------------------------
function checkPageSeo(PAGE_SEO) {
  const problems = [];
  for (const r of STATIC_ROUTES) {
    if (!PAGE_SEO[r.path]) problems.push(`${r.path}: no PAGE_SEO entry`);
  }
  for (const [path, p] of Object.entries(PAGE_SEO)) {
    if (!STATIC_ROUTES.some((r) => r.path === path) && path !== "/learn") {
      problems.push(`${path}: in PAGE_SEO but not prerendered`);
    }
    if (p.noindex) continue;
    if (p.title.length > 60) problems.push(`${path}: title is ${p.title.length} chars (max 60)`);
    if (p.description.length > 160)
      problems.push(`${path}: description is ${p.description.length} chars (max 160)`);
    if (!p.description.includes("IndSure")) problems.push(`${path}: description never says IndSure`);
  }
  if (problems.length) {
    console.error("[prerender] PAGE_SEO problems:\n  " + problems.join("\n  "));
    process.exit(1);
  }
}

// Last commit date (YYYY-MM-DD) touching any of `files`, or null when git has
// no answer (no .git in the build, or a shallow clone that never saw the file).
// A missing lastmod is honest; stamping every URL with the build date, as the
// sitemap used to, told Google that all 125 pages changed on every deploy.
// Vercel builds from a shallow clone, where `git log -- file` for a file not
// touched in the fetched window returns the OLDEST fetched commit's date: a
// made-up date that moves every deploy. So a shallow clone means no dates.
let shallow;
function gitDate(files) {
  if (!files?.length) return null;
  try {
    shallow ??=
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() !== "false";
    if (shallow) return null;
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", ...files], {
      cwd: join(ROOT, "client", "src"),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
async function main() {
  if (!existsSync(DIST)) {
    console.error("[prerender] dist/ not found. Run `vite build` first.");
    process.exit(1);
  }
  const template = await readFile(join(DIST, "index.html"), "utf8");

  const {
    blogPosts,
    slugFor,
    POST_SLUGS,
    FOUNDERS,
    authorForId,
    displayName,
    CLAUSE_LIBRARY,
    PAGE_SEO,
    clauseTitle,
    blogTitle,
    blogDescription,
    metaDescription,
    TITLE_MAX,
  } = await loadBlogData();
  checkPageSeo(PAGE_SEO);

  // Shells for everything that is not a prerendered page. Written first, from
  // the pristine template, before "/" overwrites dist/index.html.
  //
  // app-shell.html: vercel.json rewrites the app's own routes (dashboards,
  // reports, password reset...) here. They used to get the homepage's head,
  // canonical included, so each one told Google it was the homepage.
  //
  // 404.html: Vercel serves it with a real 404 status for any path that is
  // neither a file nor one of those rewrites. Before, every unknown URL
  // answered 200 with the homepage (a soft 404).
  const shell = (title) =>
    applyHead(template, {
      title,
      description: "IndSure explains your insurance policy in plain language.",
      canonical: null,
      noindex: true,
    })
      .replace(/<div id="root">[\s\S]*?<\/div>/, `<div id="root"></div>`)
      .replace(/\s*<meta (?:property="og:url"|name="twitter:url") content="[^"]*"\s*\/>/g, "");
  // (applyHead points og:url at the homepage when there is no canonical; drop
  // it here so a shared /report/<token> link does not preview as the homepage.)
  await writeFile(join(DIST, "app-shell.html"), shell("IndSure"));
  await writeFile(join(DIST, "404.html"), shell("Page not found | IndSure"));

  // Static pages
  for (const r of STATIC_ROUTES) {
    const seo = PAGE_SEO[r.path];
    const canonical = SITE + (r.path === "/" ? "/" : r.path);
    let html = applyHead(template, {
      title: seo.title,
      description: seo.description,
      canonical,
      image: r.image,
      imageAlt: r.imageAlt,
      noindex: seo.noindex,
    });

    const blocks = [];
    // Breadcrumbs (Home > Page) for every indexable non-home page.
    if (r.path !== "/" && !seo.noindex) {
      blocks.push(
        breadcrumbLd([
          { name: "Home", url: `${SITE}/` },
          { name: r.h1, url: canonical },
        ]),
      );
    }
    if (r.path === "/how-it-works") {
      blocks.push({
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "How to understand your insurance policy with IndSure",
        description: seo.description,
        step: [
          { "@type": "HowToStep", position: 1, name: "Upload your policy", text: "Upload your health, term life, or motor insurance policy PDF." },
          { "@type": "HowToStep", position: 2, name: "IndSure reads it", text: "IndSure reads the policy clause by clause and extracts the terms that matter." },
          { "@type": "HowToStep", position: 3, name: "Get a plain-language verdict", text: "See your coverage, limits, waiting periods, exclusions, and gaps explained simply." },
        ],
      });
    }
    if (blocks.length) html = injectJsonLd(html, blocks);

    const body = `<main><h1>${escText(r.h1)}</h1><p>${escText(r.intro || seo.description)}</p></main>`;
    html = injectBody(html, body, r.path);
    await writeRoute(r.path, html);
  }

  // Blog posts
  let postCount = 0;
  const longTitles = [];
  for (const post of blogPosts) {
    const slug = slugFor(post.id);
    const path = `/blog/${slug}`;
    const canonical = SITE + path;
    const title = blogTitle(post.title, slug);
    if (title.length > TITLE_MAX) longTitles.push(path);
    const description = blogDescription(post.excerpt, slug);
    const author = authorForId(post.id);

    let html = applyHead(template, { title, description, canonical, ogType: "article" });

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.excerpt,
        author: {
          "@type": "Person",
          name: author.name,
          ...(author.suffix ? { honorificSuffix: author.suffix } : {}),
          jobTitle: author.role,
          url: `${SITE}/author/${author.slug}`,
          sameAs: [author.linkedin],
        },
        datePublished: post.date,
        dateModified: post.date,
        publisher: { "@id": `${SITE}/#org` },
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
    jsonLd.push(
      breadcrumbLd([
        { name: "Home", url: `${SITE}/` },
        { name: "Blog", url: `${SITE}/blog` },
        { name: post.title, url: canonical },
      ]),
    );
    html = injectJsonLd(html, jsonLd);

    const faqHtml =
      Array.isArray(post.faqs) && post.faqs.length
        ? `<section><h2>Frequently asked questions</h2>${post.faqs
            .map((f) => `<h3>${escText(f.question)}</h3><p>${escText(f.answer)}</p>`)
            .join("")}</section>`
        : "";
    const byline = `<p>By <a href="/author/${author.slug}">${escText(displayName(author))}</a>, ${escText(author.role)}, IndSure</p>`;
    const body =
      `<article><h1>${escText(post.title)}</h1>` +
      `<p>${escText(post.excerpt)}</p>${byline}` +
      `${post.content || ""}${faqHtml}</article>`;
    html = injectBody(html, body, path);

    await writeRoute(path, html);
    postCount++;
  }

  // Author pages (E-E-A-T entity pages)
  for (const f of FOUNDERS) {
    const path = `/author/${f.slug}`;
    const canonical = SITE + path;
    const name = displayName(f);
    let html = applyHead(template, {
      title: `${name}, ${f.role} at IndSure`,
      description: metaDescription(`${name} is ${f.role} at IndSure. ${f.bio}`),
      canonical,
      ogType: "profile",
    });
    const authored = blogPosts.filter((p) => authorForId(p.id).slug === f.slug);
    const blocks = [
      breadcrumbLd([
        { name: "Home", url: `${SITE}/` },
        { name: "Team", url: `${SITE}/team` },
        { name: name, url: canonical },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "Person",
        name: f.name,
        ...(f.suffix ? { honorificSuffix: f.suffix } : {}),
        jobTitle: f.role,
        description: f.bio,
        url: canonical,
        sameAs: [f.linkedin],
        worksFor: { "@id": `${SITE}/#org` },
      },
    ];
    html = injectJsonLd(html, blocks);
    const list = authored
      .map((p) => `<li><a href="/blog/${slugFor(p.id)}">${escText(p.title)}</a></li>`)
      .join("");
    const body =
      `<main><h1>${escText(name)}</h1>` +
      `<p>${escText(f.role)}, IndSure</p>` +
      `<p>${escText(f.bio)}</p>` +
      (list ? `<h2>Articles by ${escText(f.name)}</h2><ul>${list}</ul>` : "") +
      `</main>`;
    html = injectBody(html, body, path);
    await writeRoute(path, html);
  }

  // Clause library hub (/learn)
  {
    const canonical = `${SITE}/learn`;
    let html = applyHead(template, {
      title: PAGE_SEO["/learn"].title,
      description: PAGE_SEO["/learn"].description,
      canonical,
    });
    html = injectJsonLd(html, [
      breadcrumbLd([
        { name: "Home", url: `${SITE}/` },
        { name: "Learn", url: canonical },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "IndSure Insurance Clause Library",
        description:
          "A plain-language library of Indian insurance clauses, waiting periods, sub-limits, and benefits.",
        url: canonical,
        hasPart: CLAUSE_LIBRARY.map((c) => ({
          "@type": "DefinedTerm",
          name: c.term,
          url: `${SITE}/learn/${c.slug}`,
        })),
      },
    ]);
    const list = CLAUSE_LIBRARY.map(
      (c) =>
        `<li><a href="/learn/${c.slug}">${escText(c.term)}</a>: ${escText(c.shortAnswer)}</li>`,
    ).join("");
    const body =
      `<main><h1>Every insurance clause, explained plainly</h1>` +
      `<p>The plain-language library of the clauses, waiting periods, and benefits that decide whether your claim gets paid.</p>` +
      `<ul>${list}</ul></main>`;
    html = injectBody(html, body, "/learn");
    await writeRoute("/learn", html);
  }

  // Clause library detail pages (/learn/:slug)
  for (const c of CLAUSE_LIBRARY) {
    const path = `/learn/${c.slug}`;
    const canonical = SITE + path;
    const title = clauseTitle(c.term);
    if (title.length > TITLE_MAX) longTitles.push(path);
    let html = applyHead(template, {
      title,
      description: metaDescription(c.shortAnswer),
      canonical,
      ogType: "article",
    });

    const blocks = [
      breadcrumbLd([
        { name: "Home", url: `${SITE}/` },
        { name: "Learn", url: `${SITE}/learn` },
        { name: c.term, url: canonical },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "DefinedTerm",
        name: c.term,
        ...(c.aka?.length ? { alternateName: c.aka } : {}),
        description: c.shortAnswer,
        inDefinedTermSet: {
          "@type": "DefinedTermSet",
          name: "IndSure Insurance Clause Library",
          url: `${SITE}/learn`,
        },
        url: canonical,
      },
    ];
    if (Array.isArray(c.faqs) && c.faqs.length) {
      blocks.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: c.faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      });
    }
    html = injectJsonLd(html, blocks);

    const sectionsHtml = c.sections
      .map(
        (s) =>
          `<h2>${escText(s.h2)}</h2>${s.body.map((p) => `<p>${escText(p)}</p>`).join("")}`,
      )
      .join("");
    const exampleHtml = c.example ? `<h2>Example</h2><p>${escText(c.example)}</p>` : "";
    const mistakesHtml =
      c.mistakes && c.mistakes.length
        ? `<h2>Common mistakes</h2><ul>${c.mistakes.map((m) => `<li>${escText(m)}</li>`).join("")}</ul>`
        : "";
    const faqHtml =
      c.faqs && c.faqs.length
        ? `<h2>Frequently asked questions</h2>${c.faqs
            .map((f) => `<h3>${escText(f.question)}</h3><p>${escText(f.answer)}</p>`)
            .join("")}`
        : "";
    const relatedHtml =
      c.related && c.related.length
        ? `<h2>Related concepts</h2><ul>${c.related
            .map((s) => {
              const r = CLAUSE_LIBRARY.find((x) => x.slug === s);
              return r ? `<li><a href="/learn/${r.slug}">${escText(r.term)}</a></li>` : "";
            })
            .join("")}</ul>`
        : "";
    const body =
      `<article><h1>${escText(c.term)}, explained</h1>` +
      `<p>${escText(c.shortAnswer)}</p>` +
      `${sectionsHtml}${exampleHtml}${mistakesHtml}${faqHtml}${relatedHtml}</article>`;
    html = injectBody(html, body, path);
    await writeRoute(path, html);
  }

  await checkRoutesServed(POST_SLUGS);
  const urlCount = await writeSitemap(blogPosts, slugFor, FOUNDERS, CLAUSE_LIBRARY, PAGE_SEO);

  if (longTitles.length) {
    // A warning, not a failure: these are article headlines, and Google
    // truncating the tail of a long headline is acceptable.
    console.warn(`[prerender] ${longTitles.length} blog/clause titles exceed ${TITLE_MAX} chars.`);
  }
  console.log(
    `[prerender] wrote ${STATIC_ROUTES.length} static pages + ${postCount} blog posts + ${FOUNDERS.length} author pages + ${CLAUSE_LIBRARY.length} clause pages + 404/app shells + sitemap (${urlCount} URLs).`,
  );
}

// vercel.json no longer rewrites every path to the SPA; unknown paths get a
// real 404. The price is that a client route which is neither prerendered nor
// in the rewrite allowlist would 404 when someone refreshes it. This fails the
// build instead. Routes whose valid URLs are all prerendered (blog posts,
// clause pages, authors) are exempt: an unknown slug SHOULD 404.
async function checkRoutesServed(POST_SLUGS) {
  const app = await readFile(join(ROOT, "client", "src", "App.tsx"), "utf8");
  const vercel = JSON.parse(await readFile(join(ROOT, "vercel.json"), "utf8"));
  const rewrites = vercel.rewrites
    .filter((r) => !r.source.includes(":"))
    .map((r) => new RegExp(`^${r.source}$`));
  const exempt = new Set(["/a/:slug", "/blog/:id", "/learn/:slug", "/author/:slug"]);
  const unserved = [];
  // A <Route> whose path is not a plain string literal cannot be checked, so
  // it fails loudly rather than being skipped.
  for (const [tag] of app.matchAll(/<Route\b[^>]*>/g)) {
    if (/\bpath=/.test(tag) && !/\bpath="[^"]+"/.test(tag)) unserved.push(`uncheckable: ${tag}`);
  }
  // Old numeric blog links (/blog/4) are no longer rewritten to the SPA, so
  // each needs its 301 to the slug URL in vercel.json.
  const redirected = new Set((vercel.redirects ?? []).map((r) => r.source));
  for (const [id, slug] of Object.entries(POST_SLUGS)) {
    if (!redirected.has(`/blog/${id}`)) unserved.push(`/blog/${id} (needs a redirect to /blog/${slug})`);
  }
  for (const [, route] of app.matchAll(/<Route\b[^>]*?\bpath="([^"]+)"/g)) {
    if (exempt.has(route)) continue;
    const sample = route.replace(/:[A-Za-z]+\*?/g, "x");
    const file = sample === "/" ? join(DIST, "index.html") : join(DIST, sample.slice(1), "index.html");
    if (existsSync(file) || rewrites.some((re) => re.test(sample))) continue;
    unserved.push(route);
  }
  if (unserved.length) {
    console.error(
      "[prerender] routes that would 404 on refresh (add to vercel.json rewrites or prerender them):\n  " +
        unserved.join("\n  "),
    );
    process.exit(1);
  }
}

// Regenerate dist/sitemap.xml. Only indexable pages go in (a noindex URL in a
// sitemap is a contradiction Search Console reports). lastmod is the post date
// for blog posts and the last git commit of the page's source for everything
// else, and is left out when neither is known.
async function writeSitemap(blogPosts, slugFor, FOUNDERS, CLAUSE_LIBRARY, PAGE_SEO) {
  const priority = {
    "/": ["1.0", "weekly"],
    "/policychecker": ["0.9", "weekly"],
    "/compare": ["0.9", "weekly"],
    "/calculator": ["0.9", "monthly"],
    "/start": ["0.9", "monthly"],
    "/agent": ["0.9", "monthly"],
    "/life": ["0.8", "monthly"],
    "/term": ["0.8", "monthly"],
    "/vehicle": ["0.8", "monthly"],
    "/pricing": ["0.8", "monthly"],
    "/blog": ["0.8", "weekly"],
    "/help": ["0.6", "monthly"],
    "/mission": ["0.5", "monthly"],
    "/vision": ["0.5", "monthly"],
    "/team": ["0.5", "monthly"],
  };
  const url = (loc, lastmod, changefreq, prio) =>
    `  <url>\n    <loc>${SITE}${loc}</loc>\n` +
    (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : "") +
    `    <changefreq>${changefreq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`;

  const rows = [];
  const locs = [];
  const add = (loc, ...rest) => {
    rows.push(url(loc, ...rest));
    locs.push(loc);
  };
  for (const r of STATIC_ROUTES) {
    if (PAGE_SEO[r.path].noindex) continue;
    const [prio, freq] = priority[r.path] ?? ["0.7", "monthly"];
    add(r.path, gitDate(r.src), freq, prio);
  }
  const clauseDate = gitDate(["data/clause-library.ts"]);
  add("/learn", clauseDate, "weekly", "0.8");
  for (const c of CLAUSE_LIBRARY) add(`/learn/${c.slug}`, clauseDate, "monthly", "0.7");
  const teamDate = gitDate(["data/team.ts"]);
  for (const f of FOUNDERS) add(`/author/${f.slug}`, teamDate, "monthly", "0.4");
  for (const post of blogPosts) {
    const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(post.date || "") ? post.date : null;
    add(`/blog/${slugFor(post.id)}`, lastmod, "monthly", "0.6");
  }

  // Every sitemap URL must have a prerendered file behind it. Without one,
  // Vercel would now answer 404 (see vercel.json), and before that it served
  // the homepage head, which is how /calculator once got the homepage's title.
  const missing = locs.filter(
    (loc) => !existsSync(loc === "/" ? join(DIST, "index.html") : join(DIST, loc.slice(1), "index.html")),
  );
  if (missing.length) {
    console.error("[prerender] sitemap URLs with no prerendered page:\n  " + missing.join("\n  "));
    process.exit(1);
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    rows.join("\n") +
    `\n</urlset>\n`;
  await writeFile(join(DIST, "sitemap.xml"), xml);
  return locs.length;
}

main().catch((err) => {
  console.error("[prerender] failed:", err);
  process.exit(1);
});
