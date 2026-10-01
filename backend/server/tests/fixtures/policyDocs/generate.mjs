// Regenerates the SYNTHETIC policy PDFs used by the document-rules tests.
//   node backend/server/tests/fixtures/policyDocs/generate.mjs
// Outputs (committed, synthetic only):
//   c2a-digital.pdf  every page has a text layer
//   c2a-scanned.pdf  every page is an image (no text layer): OCR path
//   c2a-mixed.pdf    page 4 (Part D) is an image, the rest are text
// Uses Playwright's Chromium, already a repo dependency. No network.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pages, CSS } from "./template.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

function pageHtml(p) {
  const foot = p.blocks.filter((b) => b.includes('class="foot"')).join("");
  const body = p.blocks.filter((b) => b && !b.includes('class="foot"')).join("\n");
  return `<div class="page">${p.columns === 2 ? `<div class="cols">${body}</div>` : body}${foot}</div>`;
}
const doc = (inner) => `<!doctype html><html><head><meta charset="utf-8"><title>Synthetic test policy</title><style>${CSS}</style></head><body>${inner}</body></html>`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2.2, viewport: { width: 794, height: 1123 } });
const page = await ctx.newPage();

async function pdfOf(inner, file) {
  await page.setContent(doc(inner), { waitUntil: "load" });
  await page.pdf({ path: path.join(here, file), format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
}

async function imagesOf(ps) {
  await page.setContent(doc(ps.map(pageHtml).join("")), { waitUntil: "load" });
  const els = await page.$$(".page");
  const out = [];
  for (const el of els) out.push((await el.screenshot({ type: "png" })).toString("base64"));
  return out;
}
const imgPage = (b64) =>
  `<div class="page" style="padding:0"><img src="data:image/png;base64,${b64}" style="width:210mm;height:297mm;display:block"></div>`;

const ps = pages();
await pdfOf(ps.map(pageHtml).join(""), "c2a-digital.pdf");
const imgs = await imagesOf(ps);
await pdfOf(imgs.map(imgPage).join(""), "c2a-scanned.pdf");
await pdfOf(ps.map((p, i) => (i === 3 ? imgPage(imgs[i]) : pageHtml(p))).join(""), "c2a-mixed.pdf");

await browser.close();
for (const f of ["c2a-digital.pdf", "c2a-scanned.pdf", "c2a-mixed.pdf"]) {
  console.log(f, fs.statSync(path.join(here, f)).size, "bytes");
}
