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
  { title, description, canonical, ogType = "website", image = "/opengraph.jpg", imageAlt },
) {
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

// The seed is for crawlers that do not run JavaScript. Browsers do run it, but
// not instantly: the markup carries no classes, so for the ~90ms between first
// paint and createRoot replacing #root, a real visitor sees an unstyled <h1>
// and paragraph fill the screen. <noscript> keeps the markup in the document
// for the crawlers that need it and renders nothing for everyone else.
function injectBody(html, bodyHtml) {
  return html.replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root"><noscript>${bodyHtml}</noscript></div>`,
  );
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
// ---------------------------------------------------------------------------
const STATIC_ROUTES = [
  {
    path: "/",
    title: "Understand Any Insurance Policy in Plain Language | IndSure India",
    description:
      "IndSure decodes your health, term life, or motor insurance policy. See your limits, co-pay, waiting periods, and coverage gaps in plain language in about 60 seconds. Free, private, no sales calls.",
    imageAlt: "IndSure — understand any insurance policy in plain language.",
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
    title: "IndSure Pricing: Free Plan, ₹99 a Month or ₹999 a Year | IndSure",
    description:
      "One policy of each type checked free, forever, no card needed. Personal is ₹99 a month or ₹999 a year: 4 health policy checks, room for 12 term life and vehicle policies, renewal reminders and unlimited consultation. No commissions.",
    h1: "IndSure pricing",
    intro:
      "The free plan does not expire: one policy of each type — health, term life and vehicle — checked in plain language, with renewal reminders and PDF reports. The Personal plan is ₹99 a month or ₹999 a year, and covers 4 health policy checks, space for 12 more term life and vehicle policies, and unlimited consultation. IndSure earns zero commissions and never sells your data as a lead.",
  },
  {
    path: "/start",
    title: "Review Your Insurance. Make Your Portfolio Today | IndSure",
    description:
      "Upload your health, term life or vehicle policy and see what it actually covers in plain language. Keep every policy in one portfolio with renewal reminders. Free forever for one policy of each type, no card needed.",
    h1: "Review your insurance. Make your portfolio today.",
    intro:
      "Add your policy, and IndSure reads the wording — room rent limits, co-pay, sub-limits and waiting periods — in plain language. Every policy sits in one portfolio with a reminder 30 days before anything expires. One policy of each type is free forever, with no card needed. IndSure earns no commission from any insurer.",
  },
  {
    path: "/advisors/pricing",
    title: "Pricing for Insurance Advisors: Free, ₹999, ₹9,999 | IndSure",
    description:
      "IndSure plans for insurance agents and advisors. Free daily tools, ₹999 a month for the full plan, ₹9,999 a year. Leads, customer portfolios, renewals and policy checks. No commissions.",
    h1: "IndSure pricing for advisors",
    intro:
      "Your daily tools — leads, customer portfolios, renewals, the cover calculator and message drafts — are free forever. The full plan is ₹999 a month or ₹9,999 a year and adds monthly policy checks, the Sach assistant and priority support. IndSure takes no commission on anything you sell.",
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
  {
    path: "/signup",
    title: "Your Insurance Portfolio, All in One Place | IndSure",
    description:
      "Create a free IndSure account to store every policy, get renewal reminders before they lapse, and see exactly where your family is under-covered. Private, no sales calls.",
    h1: "Your insurance portfolio, all in one place",
    intro:
      "Create a free IndSure account to keep every policy in one place. Store your health, term life, and motor policies, get renewal reminders before they lapse, and see exactly where your cover falls short, in plain language.",
    image: "/opengraph-signup.jpg",
    imageAlt: "IndSure — all your insurance policies, organised in one clear place.",
  },
  {
    path: "/agent",
    title: "IndSure for Advisors: The CRM Built for Insurance Agents | IndSure",
    description:
      "Manage clients, never miss a renewal, and decode any policy for your customers — all from one simple dashboard. IndSure is the CRM built for Indian insurance advisors.",
    h1: "The CRM built for insurance advisors",
    intro:
      "IndSure gives insurance advisors one simple dashboard to manage clients, track every renewal, and decode any policy for their customers in plain language. Built for how Indian agents actually work.",
    image: "/opengraph-agent.jpg",
    imageAlt: "IndSure for advisors — the CRM built for insurance agents.",
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
      image: r.image,
      imageAlt: r.imageAlt,
    });

    const blocks = [];
    // Breadcrumbs (Home > Page) for every non-home page.
    if (r.path !== "/") {
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
        description: r.description,
        step: [
          { "@type": "HowToStep", position: 1, name: "Upload your policy", text: "Upload your health, term life, or motor insurance policy PDF." },
          { "@type": "HowToStep", position: 2, name: "IndSure reads it", text: "IndSure reads the policy clause by clause and extracts the terms that matter." },
          { "@type": "HowToStep", position: 3, name: "Get a plain-language verdict", text: "See your coverage, limits, waiting periods, exclusions, and gaps explained simply." },
        ],
      });
    }
    if (r.path === "/") {
      blocks.push({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "IndSure",
        url: `${SITE}/`,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        description: r.description,
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      });
    }
    if (blocks.length) html = injectJsonLd(html, blocks);

    const body = `<main><h1>${escText(r.h1)}</h1><p>${escText(r.intro)}</p></main>`;
    html = injectBody(html, body);
    await writeRoute(r.path, html);
  }

  // Blog posts
  const { blogPosts, slugFor, FOUNDERS, authorForId, displayName, CLAUSE_LIBRARY } =
    await loadBlogData();
  let postCount = 0;
  for (const post of blogPosts) {
    const slug = slugFor(post.id);
    const path = `/blog/${slug}`;
    const canonical = SITE + path;
    const title = `${post.title} | IndSure Blog`;
    const description = post.excerpt;
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
    html = injectBody(html, body);

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
      description: `${name} is ${f.role} at IndSure. ${f.bio}`.slice(0, 300),
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
        worksFor: { "@type": "Organization", name: "IndSure", url: SITE },
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
    html = injectBody(html, body);
    await writeRoute(path, html);
  }

  // Clause library hub (/learn)
  {
    const canonical = `${SITE}/learn`;
    let html = applyHead(template, {
      title: "Insurance Clause Library: Every Term Explained Plainly | IndSure",
      description:
        "A plain-language library of Indian insurance clauses, waiting periods, sub-limits, and benefits. Understand room-rent caps, co-pay, PED, restoration, IDV, and more before you claim.",
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
        `<li><a href="/learn/${c.slug}">${escText(c.term)}</a> — ${escText(c.shortAnswer)}</li>`,
    ).join("");
    const body =
      `<main><h1>Every insurance clause, explained plainly</h1>` +
      `<p>The plain-language library of the clauses, waiting periods, and benefits that decide whether your claim gets paid.</p>` +
      `<ul>${list}</ul></main>`;
    html = injectBody(html, body);
    await writeRoute("/learn", html);
  }

  // Clause library detail pages (/learn/:slug)
  for (const c of CLAUSE_LIBRARY) {
    const path = `/learn/${c.slug}`;
    const canonical = SITE + path;
    let html = applyHead(template, {
      title: `What is a ${c.term}? Meaning, Examples & Mistakes | IndSure`,
      description: c.shortAnswer.slice(0, 300),
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
      `<article><h1>What is a ${escText(c.term)}?</h1>` +
      `<p>${escText(c.shortAnswer)}</p>` +
      `${sectionsHtml}${exampleHtml}${mistakesHtml}${faqHtml}${relatedHtml}</article>`;
    html = injectBody(html, body);
    await writeRoute(path, html);
  }

  await writeSitemap(blogPosts, slugFor, FOUNDERS, CLAUSE_LIBRARY);

  console.log(
    `[prerender] wrote ${STATIC_ROUTES.length} static pages + ${postCount} blog posts + ${FOUNDERS.length} author pages + ${CLAUSE_LIBRARY.length} clause pages + sitemap.`,
  );
}

// Regenerate dist/sitemap.xml with honest lastmod: blog posts use their own
// publish date; marketing pages use the build date.
async function writeSitemap(blogPosts, slugFor, FOUNDERS = [], CLAUSE_LIBRARY = []) {
  const buildDate = new Date().toISOString().slice(0, 10);
  const marketing = [
    { path: "/", priority: "1.0", changefreq: "weekly" },
    { path: "/policychecker", priority: "0.9", changefreq: "weekly" },
    { path: "/life", priority: "0.8", changefreq: "monthly" },
    { path: "/term", priority: "0.8", changefreq: "monthly" },
    { path: "/vehicle", priority: "0.8", changefreq: "monthly" },
    { path: "/compare", priority: "0.9", changefreq: "weekly" },
    { path: "/calculator", priority: "0.8", changefreq: "monthly" },
    { path: "/how-it-works", priority: "0.7", changefreq: "monthly" },
    { path: "/why-indsure", priority: "0.7", changefreq: "monthly" },
    { path: "/pricing", priority: "0.8", changefreq: "monthly" },
    { path: "/advisors/pricing", priority: "0.7", changefreq: "monthly" },
    { path: "/blog", priority: "0.8", changefreq: "weekly" },
    { path: "/signup", priority: "0.9", changefreq: "monthly" },
    { path: "/agent", priority: "0.8", changefreq: "monthly" },
    { path: "/mission", priority: "0.5", changefreq: "monthly" },
    { path: "/vision", priority: "0.5", changefreq: "monthly" },
    { path: "/team", priority: "0.5", changefreq: "monthly" },
    { path: "/help", priority: "0.6", changefreq: "monthly" },
  ];
  const url = (loc, lastmod, changefreq, priority) =>
    `  <url>\n    <loc>${SITE}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

  const rows = [];
  for (const m of marketing) rows.push(url(m.path, buildDate, m.changefreq, m.priority));
  rows.push(url("/learn", buildDate, "weekly", "0.8"));
  for (const c of CLAUSE_LIBRARY) rows.push(url(`/learn/${c.slug}`, buildDate, "monthly", "0.7"));
  for (const f of FOUNDERS) rows.push(url(`/author/${f.slug}`, buildDate, "monthly", "0.4"));
  for (const post of blogPosts) {
    const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(post.date || "") ? post.date : buildDate;
    rows.push(url(`/blog/${slugFor(post.id)}`, lastmod, "monthly", "0.6"));
  }
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    rows.join("\n") +
    `\n</urlset>\n`;
  await writeFile(join(DIST, "sitemap.xml"), xml);
}

main().catch((err) => {
  console.error("[prerender] failed:", err);
  process.exit(1);
});
