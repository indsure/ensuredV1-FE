// Regenerates the SYNTHETIC PDFs for the general benefit-illustration reader tests.
//   node backend/server/tests/fixtures/policyDocs/genericGenerate.mjs
// Outputs (committed, synthetic only): generic-moneyback.pdf and generic-variants/*.pdf.
// Uses Playwright's Chromium, already a repo dependency. No network.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { genericPages, GENERIC_CSS } from "./genericTemplate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = (ps) => `<!doctype html><html><head><meta charset="utf-8"><title>Synthetic test policy</title><style>${GENERIC_CSS}</style></head><body>${ps.map((p) => `<div class="page">${p.blocks.join("\n")}</div>`).join("")}</body></html>`;

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
async function pdf(ps, file) {
  await page.setContent(html(ps), { waitUntil: "load" });
  await page.pdf({ path: path.join(here, file), format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
}
await pdf(genericPages(), "generic-moneyback.pdf");
const VARIANTS = {
  reordered: { reordered: true },
  "two-gsv": { twoGsv: true },
  "no-gsv": { noGsv: true },
  "gap-year": { gapYear: 7 },
  "no-illustration": { noIllustration: true },
};
fs.mkdirSync(path.join(here, "generic-variants"), { recursive: true });
for (const [name, v] of Object.entries(VARIANTS)) await pdf(genericPages(v), `generic-variants/${name}.pdf`);
await browser.close();
console.log("written", 1 + Object.keys(VARIANTS).length);
