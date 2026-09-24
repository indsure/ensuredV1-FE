/**
 * Re-shoot the screenshots used by the advisor docs (/docs).
 *
 * Every image comes from the PLAYGROUND, the no-account demo that runs the real
 * portal against in-memory sample data, so no real advisor or customer ever
 * appears in a public image.
 *
 * Usage:
 *   npm run build --prefix frontend              (fonts only load from a build)
 *   npx vite preview frontend --port 5414        (or any served build)
 *   node frontend/scripts/capture-docs-screens.mjs [baseUrl] [onlyName...]
 *
 * Writes client/public/docs/screens/<name>.webp (1x) and <name>@2x.webp.
 * Chromium does the WebP encoding, so there is no image library to install.
 * Playwright comes from the repo root's devDependencies.
 *
 * When a screen changes, re-run this and look at the new images: a doc that
 * describes a button the new screenshot no longer shows is now wrong.
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(HERE, "..", "..", "package.json"));
const { chromium } = require("playwright");

const OUT = join(HERE, "..", "client", "public", "docs", "screens");
const BASE = (process.argv[2] && process.argv[2].startsWith("http") ? process.argv[2] : "http://localhost:5414").replace(/\/$/, "");
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("http"));

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

/**
 * name: output file. path: route. device: desktop (default) or phone.
 * scroll: px to scroll the page (or the main pane) before shooting.
 * act: async (page) => void, for dialogs and filled-in states.
 * demo: false for public pages that must be shot OUTSIDE demo mode.
 */
const SHOTS = [
  // Getting started (public, no demo)
  { name: "agent-landing", path: "/agent", demo: false },
  { name: "signup-step1", path: "/agent/signup/step1", demo: false },
  { name: "login", path: "/agent/login", demo: false },

  // The portal
  { name: "dashboard", path: "/agent/dashboard" },
  { name: "dashboard-phone", path: "/agent/dashboard", device: "phone" },
  {
    name: "menu-phone", path: "/agent/dashboard", device: "phone",
    act: async (p) => { await p.getByRole("button", { name: "More" }).click(); await p.waitForTimeout(600); },
  },
  { name: "insights", path: "/agent/insights" },
  { name: "queue", path: "/agent/my-queue" },

  // People
  { name: "customers", path: "/agent/customers" },
  { name: "customer-detail", path: "/agent/customers/cust-1" },
  { name: "leads", path: "/agent/leads" },
  {
    name: "lead-add", path: "/agent/leads",
    act: async (p) => { await p.getByRole("button", { name: "Add Lead" }).first().click(); await p.waitForTimeout(700); },
  },
  { name: "lead-detail", path: "/agent/leads/lead-1" },
  { name: "renewals", path: "/agent/renewals" },
  {
    name: "whatsapp-draft", path: "/agent/renewals",
    act: async (p) => { await p.locator('button[title="Draft a message"]').first().click(); await p.waitForTimeout(700); },
  },
  { name: "renewals-phone", path: "/agent/renewals", device: "phone" },

  // Policies
  { name: "uploads", path: "/agent/uploads" },
  { name: "policies", path: "/agent/policies" },
  { name: "report-top", path: "/agent/policies/pol-1" },
  { name: "report-middle", path: "/agent/policies/pol-1", scroll: 750 },
  { name: "report-lower", path: "/agent/policies/pol-1", scroll: 1500 },
  { name: "report-phone", path: "/agent/policies/pol-1", device: "phone" },

  // Tools
  { name: "compare-empty", path: "/agent/compare" },
  {
    name: "compare-result", path: "/agent/compare",
    act: async (p) => {
      for (const plan of ["Optima Secure", "ReAssure 2.0"]) {
        await p.getByRole("button", { name: /Add a plan/ }).first().click();
        await p.getByPlaceholder(/Search insurer or plan/).fill(plan);
        await p.locator("div.max-h-80 button", { hasText: plan }).first().click();
        await p.waitForTimeout(900);
      }
      await p.waitForTimeout(1500);
    },
  },
  {
    name: "compare-result-lower", path: "/agent/compare", scroll: 600,
    act: async (p) => {
      for (const plan of ["Optima Secure", "ReAssure 2.0"]) {
        await p.getByRole("button", { name: /Add a plan/ }).first().click();
        await p.getByPlaceholder(/Search insurer or plan/).fill(plan);
        await p.locator("div.max-h-80 button", { hasText: plan }).first().click();
        await p.waitForTimeout(900);
      }
      await p.waitForTimeout(1500);
    },
  },
  { name: "compare-quotes", path: "/agent/compare/quotes" },
  { name: "calculator", path: "/agent/calculator" },
  { name: "values", path: "/agent/values" },
  { name: "riders", path: "/agent/riders" },
  { name: "claims", path: "/agent/claims" },
  {
    name: "claim-detail", path: "/agent/claims",
    act: async (p) => {
      await p.getByText("Meena Joshi").first().click();
      await p.waitForURL(/\/agent\/claims\/.+/);
      await p.waitForTimeout(1500);
    },
  },

  // Grow + account
  { name: "my-website", path: "/agent/my-page" },
  { name: "my-website-lower", path: "/agent/my-page", scroll: 700 },
  { name: "team", path: "/agent/team" },
  { name: "settings", path: "/agent/settings" },
  { name: "profile", path: "/agent/profile" },
  { name: "help", path: "/agent/help" },
];

// Sample data is invented, but it borrows REAL insurer and plan names, and a
// public page showing "Family Health Optima: 58, Needs action" would read as
// IndSure rating a real product. Real-format phone and policy numbers could
// belong to someone. So every screenshot swaps them for neutral stand-ins,
// consistently, so the same insurer keeps the same letter within a screen.
const INSURER_BRANDS = [
  "Star Health", "Niva Bupa", "HDFC ERGO", "HDFC Ergo", "Care Health", "Bajaj Allianz", "Tata AIG", "Tata AIA",
  "Go Digit", "Digit", "ICICI Lombard", "ICICI Prudential", "HDFC Life", "Life Insurance Corporation", "LIC",
  "SBI General", "SBI Life", "Aditya Birla", "ManipalCigna", "Max Life", "Axis Max Life", "Reliance", "Royal Sundaram",
  "Kotak", "Future Generali", "Cholamandalam", "IFFCO Tokio", "New India", "United India", "Oriental",
  "National Insurance", "Acko", "Galaxy", "Zuno", "Magma", "Universal Sompo", "Liberty", "Edelweiss", "Canara HSBC",
  "PNB MetLife", "Bharti AXA", "Shriram", "Raheja", "Navi", "Aviva", "Ageas Federal", "Bandhan",
];
const PLAN_NAMES = [
  "Family Health Optima", "Optima Secure", "ReAssure 2.0", "Care Supreme", "Care Senior", "Activ One MAX",
  "Senior Citizen Red Carpet", "Young Star", "Health Companion", "Jeevan Anand", "Jeevan Labh",
  "New Endowment Plan", "Click 2 Achieve", "Click 2 Protect Super", "Smart Protection Goal", "Sanchay Plus",
  "Secure Benefit",
];

// Runs inside the page. Kept as a plain function so its regexes are ordinary
// source, not strings escaped twice.
function scrubPage({ host, brands, plans }) {
  const letters = { insurer: new Map(), plan: new Map() };
  const letter = (map, key) => {
    if (!map.has(key)) map.set(key, String.fromCharCode(65 + map.size));
    return map.get(key);
  };
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Brand plus whatever legal tail follows it: "Star Health and Allied Insurance Co Ltd".
  const brandRe = new RegExp(
    "\\b(" + brands.map(esc).join("|") + ")\\b(?:[A-Za-z&.' ]*?(?:Insurance|Assurance)(?: Co(?:mpany)?\\.?)?(?: Ltd\\.?| Limited)?)?",
    "g",
  );
  const planRe = new RegExp("\\b(" + plans.map(esc).join("|") + ")\\b", "g");
  const scrub = (text) =>
    text
      .split("http://" + host).join("https://indsure.in")
      .split(host).join("indsure.in")
      .replace(planRe, (m) => "Sample Plan " + letter(letters.plan, m))
      .replace(brandRe, (_m, brand) => "Sample Insurer " + letter(letters.insurer, brand.toLowerCase()))
      // Indian mobile numbers, with or without +91 and spacing.
      .replace(/(\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g, "+91 90000 00000")
      // Policy numbers: letters then a slash or dash run with 4+ digits, or a long bare digit run.
      .replace(/\b[A-Z]{1,5}[/-][A-Z0-9/-]*\d{4,}[A-Z0-9/-]*/g, "SAMPLE/0000")
      .replace(/\b\d{8,12}\b/g, "00000000")
      // IRDAI UINs sit beside the plan they identify.
      .replace(/\b[A-Z]{5,6}[A-Z0-9]{5,}V\d{6}\b/g, "SAMPLEUIN0000")
      // Real hospitals and TPAs sit beside a sample patient's diagnosis.
      .replace(/\b(Apollo Hospitals|Bombay Hospital|CHL Hospitals|Chirayu Hospital|Medanta|Shri Mahakal Eye Hospital)\b/g, "Sample Hospital")
      .replace(/\b(Medi Assist|Paramount|Vidal Health)\b/g, "Sample TPA")
      .replace(/Sample Insurer ([A-Z]) of India/g, "Sample Insurer $1")
      .replace(/shreyasinsure\.in/gi, "example.com")
      .replace(/Shreyas Insurance Services/g, "Sample Insurance Services");

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue) continue;
    const next = scrub(n.nodeValue);
    if (next !== n.nodeValue) n.nodeValue = next;
  }
  for (const input of document.querySelectorAll("input, textarea")) {
    if (input.value) input.value = scrub(input.value);
  }
  // The demo banner is not part of the product.
  for (const el of document.querySelectorAll("div")) {
    if (el.children.length && /^Playground: demo data/.test(el.textContent || "") && String(el.className).includes("bg-[#0D9488]")) {
      el.style.display = "none";
    }
  }
}

async function tidy(page) {
  await page.addStyleTag({
    content: `
      [aria-label="Open Sach, your policy assistant"] { display: none !important; }
      [role="dialog"][aria-labelledby^="tour-"] { display: none !important; }
      * { caret-color: transparent !important; }
    `,
  });
  await page.evaluate(scrubPage, { host: new URL(BASE).host, brands: INSURER_BRANDS, plans: PLAN_NAMES });
}

async function toWebp(browser, png, width, height, scale = 1) {
  const page = await browser.newPage();
  const dataUrl = await page.evaluate(
    async ({ b64, w, h, s }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = Math.round(w * s);
      c.height = Math.round(h * s);
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/webp", 0.82);
    },
    { b64: png.toString("base64"), w: width, h: height, s: scale },
  );
  await page.close();
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const shots = ONLY.length ? SHOTS.filter((s) => ONLY.includes(s.name)) : SHOTS;
  let failed = 0;

  for (const shot of shots) {
    const vp = shot.device === "phone" ? PHONE : DESKTOP;
    const context = await browser.newContext({
      viewport: vp,
      deviceScaleFactor: 2,
      isMobile: shot.device === "phone",
      hasTouch: shot.device === "phone",
      locale: "en-IN",
    });
    const page = await context.newPage();
    try {
      await page.addInitScript(() => { try { localStorage.setItem("indsure_lang", "en"); } catch {} });
      if (shot.demo !== false) {
        // ?go= skips the welcome card; the tour stays off.
        await page.goto(`${BASE}/agent/playground?go=%2Fagent%2Fdashboard`, { waitUntil: "networkidle" });
        await page.waitForURL(/\/agent\/dashboard/);
        await page.evaluate(() => sessionStorage.removeItem("indsure_playground_tour"));
        // Client-side navigation keeps the in-memory demo state.
        await page.evaluate((path) => { history.pushState(null, "", path); dispatchEvent(new PopStateEvent("popstate")); }, shot.path);
      } else {
        await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
      }
      await page.waitForTimeout(2200);
      if (shot.act) await shot.act(page);
      if (shot.scroll) {
        await page.evaluate((y) => {
          window.scrollTo(0, y);
          const main = document.querySelector("main");
          if (main && main.scrollHeight > main.clientHeight) main.scrollTo(0, y);
        }, shot.scroll);
        await page.waitForTimeout(600);
      }
      await tidy(page);
      await page.waitForTimeout(300);
      const png = await page.screenshot({ type: "png" });
      // name@2x.webp for sharp screens, name.webp at 1x for phones on slow data.
      const webp2x = await toWebp(browser, png, vp.width * 2, vp.height * 2);
      const webp1x = await toWebp(browser, png, vp.width * 2, vp.height * 2, 0.5);
      await writeFile(join(OUT, `${shot.name}@2x.webp`), webp2x);
      await writeFile(join(OUT, `${shot.name}.webp`), webp1x);
      console.log(`ok   ${shot.name}  ${(webp1x.length / 1024).toFixed(0)} / ${(webp2x.length / 1024).toFixed(0)} KB  ${page.url().replace(BASE, "")}`);
    } catch (err) {
      failed++;
      console.log(`FAIL ${shot.name}: ${err.message.split("\n")[0]}`);
    } finally {
      await context.close();
    }
  }
  await browser.close();
  if (failed) process.exit(1);
}

main();
