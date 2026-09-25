import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guessType, devanagariShare, looksLikePdf, inspectPdf } from "../src/core/pdfInspect.js";
import { parseCaption, ruleIntent, namedPerson, linkCode } from "../src/core/intents.js";
import { redact } from "../src/log.js";
import { captionIsFileName } from "../src/core/bot.js";
import { waMeLink, inr } from "../src/core/templates.js";

const here = path.dirname(fileURLToPath(import.meta.url));

test("the bot's copies of the portal's modules are identical to the portal's", () => {
  for (const rel of ["draftMessage.ts", "health-engine-logic.ts", "data/rider-data.ts", "data/insurer-aliases.ts", "city-tier-util.ts", "data/zones.ts"]) {
    const a = fs.readFileSync(path.resolve(here, "../src/shared", rel), "utf8");
    const b = fs.readFileSync(path.resolve(here, "../../frontend/client/src/lib", rel), "utf8");
    assert.equal(a, b, `${rel} drifted: run npm run sync`);
  }
});

test("type guess: clear health and motor texts, ambiguous text asks", () => {
  const health = "Sum insured 5,00,000. Hospitalisation expenses, room rent up to 1%, pre-existing diseases after 36 months, cashless at network hospital, day care procedures, co-payment 10%.";
  const motor = "Private car package policy. IDV 6,40,000. Registration No MH12AB1234, chassis no, engine no, own damage premium, third party liability, NCB 20%.";
  assert.equal(guessType(health).guess, "health");
  assert.equal(guessType(motor).guess, "motor");
  assert.equal(guessType("Premium receipt. Thank you for your payment.").guess, null);
});

test("Hindi share", () => {
  assert.ok(devanagariShare("यह पॉलिसी हिंदी में है policy") > 0.4);
  assert.ok(devanagariShare("This policy is in English") < 0.1);
});

test("PDF magic bytes", () => {
  assert.ok(looksLikePdf(Buffer.from("%PDF-1.7\n...")));
  assert.ok(!looksLikePdf(Buffer.from("PK\u0003\u0004 docx")));
});

test("real pdfjs read of a generated text PDF", async () => {
  const pdf = makePdf("Health insurance policy. Hospitalisation cover, room rent limit, pre-existing disease waiting period, cashless network hospital, day care, co-payment. ".repeat(3));
  const r = await inspectPdf(pdf);
  assert.equal(r.kind, "ok");
  if (r.kind === "ok") assert.equal(r.guess, "health");
});

test("caption parsing", () => {
  assert.deepEqual(parseCaption("Ramesh Kumar 98123 45678"), { name: "Ramesh Kumar", phone: "9812345678" });
  assert.deepEqual(parseCaption("+91 9812345678"), { name: null, phone: "9812345678" });
  assert.deepEqual(parseCaption(""), { name: null, phone: null });
});

test("intent rules", () => {
  assert.equal(ruleIntent("RENEWALS"), "renewals");
  assert.equal(ruleIntent("who's due"), "renewals");
  assert.equal(ruleIntent("send to customer"), "share");
  assert.equal(ruleIntent("Hi!"), "help");
  assert.equal(ruleIntent("what is the room rent"), null);
  assert.equal(linkCode("LINK 123456"), "123456");
  assert.equal(namedPerson("share Ramesh's report"), "ramesh");
  assert.equal(namedPerson("remind sunita in hindi"), "sunita");
});

test("logs mask phone numbers", () => {
  assert.equal(redact("from 919812345678 and 9812345678"), "from …5678 and …5678");
});

test("wa.me and rupee formatting", () => {
  assert.equal(waMeLink("98123 45678", "hi"), "https://wa.me/919812345678?text=hi");
  assert.equal(waMeLink(null, "hi"), "https://wa.me/?text=hi");
  assert.equal(inr(1500000), "₹15,00,000");
  assert.equal(inr(null), null);
});

/** Smallest valid one-page PDF with a line of Helvetica text. */
function makePdf(textStr: string): Buffer {
  const esc = textStr.replace(/[()\\]/g, "\\$&");
  const content = `BT /F1 8 Tf 20 700 Td (${esc}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 3000 800] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

test("a caption that is just the file name is not a customer", () => {
  assert.equal(captionIsFileName("Policy Kit_PROHLV050040281.pdf", "Policy Kit_PROHLV050040281.pdf"), true);
  assert.equal(captionIsFileName("Policy Kit_PROHLV050040281", "Policy Kit_PROHLV050040281.pdf"), true);
  assert.equal(captionIsFileName("scan.PDF", null), true);
  assert.equal(captionIsFileName("Ramesh Kumar 9812345678", "Policy Kit.pdf"), false);
  assert.equal(captionIsFileName("", "x.pdf"), false);
});
