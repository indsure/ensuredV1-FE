// Regenerates the SYNTHETIC ABSLI Nishchit Aayush PDFs used by the adapter tests.
//   node backend/server/tests/fixtures/policyDocs/absliGenerate.mjs
// Outputs (committed, synthetic only): absli-digital.pdf and absli-variants/*.pdf.
// Uses Playwright's Chromium, already a repo dependency. No network.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { absliPages, ABSLI_CSS } from "./absliTemplate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = (ps) => `<!doctype html><html><head><meta charset="utf-8"><title>Synthetic test policy</title><style>${ABSLI_CSS}</style></head><body>${ps.map((p) => `<div class="page">${p.blocks.join("\n")}</div>`).join("")}</body></html>`;

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
async function pdf(ps, file) {
  await page.setContent(html(ps), { waitUntil: "load" });
  await page.pdf({ path: path.join(here, file), format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
}
await pdf(absliPages(), "absli-digital.pdf");
const VARIANTS = {
  "other-version": { uin: "109N137V02" },
  "other-option": { option: "Whole Life Income" },
  "no-uin": { noUin: true },
  "two-uins": { secondUin: "109N137V02" },
  "conflicting-sa": { conflictSa: true },
  "gsv-year-missing": { dropGsvYear: 17 },
  "modal-loading": { modalLoading: "1.50%" },
  "short-income": { shortIncome: true },
  "term-35": { term: 35 },
};
fs.mkdirSync(path.join(here, "absli-variants"), { recursive: true });
for (const [name, v] of Object.entries(VARIANTS)) await pdf(absliPages(v), `absli-variants/${name}.pdf`);
await browser.close();
console.log("written", 1 + Object.keys(VARIANTS).length);
