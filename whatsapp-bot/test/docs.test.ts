/** Stage 3: files. Claim documents in (caption, album, session), files back to the advisor's own
 *  chat, the policy PDF, and undo of a file this chat saved. ALL NAMES AND NUMBERS ARE MADE UP. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeBot, text, pdf, healthClient, ADVISOR, type FakeTransport } from "./fakes.js";
import { CASE_DOCS, PERSONAL_DOCS, parseDocCaption } from "../src/core/docParse.js";
import { ruleIntent } from "../src/core/intents.js";
import type { InboundMessage } from "../src/transport/types.js";

const CUST = "33333333-3333-4333-8333-333333333333";
const CLM = "88888888-8888-4888-8888-888888888888";
const POL = "77777777-7777-4777-8777-777777777777";
let n = 0;
function photo(t: FakeTransport, caption = "", mimeType = "image/jpeg"): InboundMessage {
  const id = `photo${++n}`;
  t.files.set(id, Buffer.from("\xff\xd8\xff photo bytes"));
  return { id, from: ADVISOR, replyTo: `${ADVISOR}@s.whatsapp.net`, kind: "image", text: caption, fileName: null, mimeType, fileSize: 2000, timestampMs: Date.now(), raw: null };
}
function setup(over: Record<string, unknown> = {}) {
  const t = makeBot();
  t.engine.customers.push({ id: CUST, name: "Sunita Rao", phone: "9800000002" } as any);
  t.engine.claimStore.set(CLM, {
    id: CLM, status: "submitted", claim_type: "cashless", insurer: "Some Health", tpa: null, policy_number: null, hospital: "City Hospital",
    ailment: null, claimed_amount: "150000.00", settled_amount: null, admitted_on: "2026-10-01", discharged_on: null, customer_id: CUST, ...over,
  });
  return t;
}
const uploads = (e: any) => e.writes.filter((w: any) => w.kind === "claimDocUpload");

test("the checklist labels are the portal's, character for character", () => {
  const src = fs.readFileSync(new URL("../../frontend/client/src/lib/claims.ts", import.meta.url), "utf8");
  const arr = (name: string) => src.match(new RegExp(`${name}[^=]*=\\s*(\\[[\\s\\S]*?\\]);`))![1];
  assert.deepEqual(PERSONAL_DOCS, eval(arr("PERSONAL_DOCS")));
  const cases = src.match(/CASE_DOCS[^=]*=\s*(\{[\s\S]*?\n\});/)![1];
  assert.deepEqual(CASE_DOCS, eval(`(${cases})`));
});

test("a caption must say 'claim': a name alone is still a policy caption", () => {
  assert.equal(parseDocCaption("Sunita health"), null);
  assert.equal(parseDocCaption("Ramesh Kumar 98123 45678"), null);
  assert.deepEqual(parseDocCaption("final bill for Sunita's claim"), { who: "Sunita", words: "final bill", reply: false, thisClaim: false });
  assert.equal(ruleIntent("add documents to Sunita's claim"), "claimdocs");
  assert.equal(ruleIntent("send Sunita's claim documents"), "docsend");
  assert.equal(ruleIntent("send Ramesh's policy PDF"), "policypdf");
  assert.equal(ruleIntent("send the report to the customer"), "share");
});

test("captioned photo: the claim named in full with the deletion date, saved only on YES, UNDO removes it", async () => {
  const { bot, transport, engine } = setup({ purge_on: "2026-11-21" });
  await bot.handle(photo(transport, "final bill for Sunita's claim"));
  const ask = transport.last();
  assert.match(ask, /Add Final bill \(photo\) to Sunita Rao's claim \(Some Health, cashless, admitted .*1 Oct\)\. Kept until .*21 Nov, then deleted/);
  assert.equal(uploads(engine).length, 0, "nothing stored before YES");
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Final bill added to Sunita Rao's claim/);
  assert.deepEqual([engine.docStore[0].label, engine.docStore[0].category], ["Final bill", "case"]);
  await bot.handle(text("undo"));
  assert.match(transport.last(), /Undo: remove Final bill from Sunita Rao's claim/);
  await bot.handle(text("yes"));
  assert.equal(engine.docStore.length, 0);
});

test("an album: photos sent together are held and added with one YES", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(photo(transport, "Sunita claim pharmacy bills"));
  await bot.handle(photo(transport));
  await bot.handle(photo(transport));
  assert.match(transport.last(), /Add 3 files \(Prescriptions and pharmacy bills \(photo\), Claim document \(photo\), Claim document \(photo\)\) to Sunita Rao's claim/);
  await bot.handle(text("yes"));
  assert.equal(engine.docStore.length, 3);
});

test("session: one YES, then each file is saved as it arrives; DONE ends it; identity papers keep the portal label and category", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("add documents to Sunita's claim"));
  assert.match(transport.last(), /Files you send in the next 15 minutes go into Sunita Rao's claim/);
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Send the files now/);
  await bot.handle(photo(transport, "aadhaar"));
  assert.match(transport.last(), /Aadhaar, patient added to Sunita Rao's claim/, "the portal's dash is shown as a comma");
  assert.deepEqual([engine.docStore[0].label, engine.docStore[0].category], ["Aadhaar — patient", "personal"]);
  await bot.handle(pdf(transport, "discharge summary text", { caption: "discharge summary", name: "ds.pdf" }));
  assert.equal(engine.docStore[1].label, "Discharge summary");
  await bot.handle(text("done"));
  assert.match(transport.last(), /Done: 2 files added to Sunita Rao's claim/);
  await bot.handle(photo(transport));
  assert.equal(engine.docStore.length, 2, "after DONE a bare photo is not a claim document");
});

test("session: an uncaptioned PDF that reads like a policy is asked about, never saved", async () => {
  const t = makeBot({ inspect: async () => ({ kind: "ok", text: "Policy Schedule. Period of Insurance 1 Oct 2026 to 30 Sep 2027", hindi: false, guess: "health", scores: {} }) as any });
  t.engine.customers.push({ id: CUST, name: "Sunita Rao", phone: "9800000002" } as any);
  t.engine.claimStore.set(CLM, { id: CLM, status: "submitted", claim_type: "cashless", insurer: null, admitted_on: null, customer_id: CUST });
  await t.bot.handle(text("add documents to Sunita's claim"));
  await t.bot.handle(text("yes"));
  await t.bot.handle(pdf(t.transport, "policy schedule"));
  assert.match(t.transport.last(), /This looks like a policy document/);
  assert.equal(t.engine.docStore.length, 0);
});

test("refused before anything is stored: HEIC, a purged claim, a claim with two open claims for the name", async () => {
  const { bot, transport, engine } = setup();
  const heic = { ...photo(transport, "final bill for Sunita's claim"), kind: "document" as const, mimeType: "image/heic", fileName: "IMG_1.HEIC" };
  await bot.handle(heic);
  assert.match(transport.last(), /HEIC/);
  engine.claimStore.get(CLM).documents_purged_at = "2026-10-01";
  await bot.handle(photo(transport, "final bill for Sunita's claim"));
  assert.match(transport.last(), /documents were deleted when it closed/);
  assert.equal(engine.docStore.length, 0);
});

test("the same WhatsApp message twice is one document", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("add documents to Sunita's claim"));
  await bot.handle(text("yes"));
  const m = photo(transport, "pan card");
  await bot.handle(m);
  await engine.claimDocUpload("a", CLM, { buffer: Buffer.from("x"), mime: "image/jpeg", fileName: "x.jpg" }, { docType: "PAN card", category: "personal", msgId: m.id, queryId: null });
  assert.equal(engine.docStore.length, 1);
});

test("a reply document is linked to the claim's open insurer query", async () => {
  const { bot, transport, engine } = setup({ status: "query_raised" });
  engine.queryStore.push({ claim_id: CLM, seq: 1, question: "Final bill", resolved_on: null });
  await bot.handle(photo(transport, "reply to query for Sunita's claim"));
  await bot.handle(text("yes"));
  assert.equal(engine.docStore[0].queryId, "q-1");
  assert.match(transport.last(), /Linked to the open insurer query\. When it is answered, type: Sunita Rao's claim query answered/);
});

test("files back: one by number with a delete-after-use note; ALL with identity papers asks first", async () => {
  const { bot, transport, engine } = setup({ purge_on: "2026-11-21" });
  engine.docStore.push(
    { id: "d1", msgId: "x1", claimId: CLM, label: "Final bill", category: "case", mime: "application/pdf", size: 10, queryId: null },
    { id: "d2", msgId: "x2", claimId: CLM, label: "Aadhaar — patient", category: "personal", mime: "image/jpeg", size: 10, queryId: null },
  );
  await bot.handle(text("send Sunita's claim documents"));
  assert.match(transport.last(), /Which document of Sunita Rao's claim.*\n1\) Final bill\n2\) Aadhaar, patient/s);
  await bot.handle(text("1"));
  assert.equal(transport.documents.length, 1);
  assert.match(transport.documents[0].caption!, /Final bill · Sunita Rao's claim.*Deleted from IndSure on .*21 Nov\. Delete from this chat after use\./);
  await bot.handle(text("send Sunita's claim documents"));
  await bot.handle(text("all"));
  assert.match(transport.last(), /Send all 2 documents .* including identity papers/);
  await bot.handle(text("yes"));
  assert.equal(transport.documents.length, 3);
  await bot.handle(text("send Sunita's claim final bill"));
  assert.equal(transport.documents.length, 4, "a named document goes straight away");
});

test("the policy PDF comes back to the advisor's chat, named; none stored is said plainly", async () => {
  const { bot, transport, engine } = setup();
  engine.clients.set(POL, healthClient(POL, { policyholderName: "Ramesh Kumar" }));
  await bot.handle(text("send Ramesh's policy PDF"));
  assert.match(transport.last(), /No PDF is stored for Ramesh Kumar's/);
  engine.pdfs.set(POL, { buffer: Buffer.from("%PDF"), mime: "application/pdf", fileName: "policy.pdf" });
  await bot.handle(text("send Ramesh's policy PDF"));
  assert.equal(transport.documents.length, 1);
  assert.match(transport.documents[0].caption!, /Ramesh Kumar's .*Delete from this chat after use/);
});

test("a photo with no claim caption and no session still gets the usual reply", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(photo(transport));
  assert.doesNotMatch(transport.last(), /claim/i);
  assert.equal(engine.docStore.length, 0);
});

/* ── Critic findings (2026-10-23) ── */

test("critic: a claim question is never a document request; a vague caption never guesses the claim", async () => {
  for (const s of ["give me the claim status", "share Sunita's claim status"]) assert.notEqual(ruleIntent(s), "docsend", s);
  assert.equal(ruleIntent("send Sunita's claim update"), null);
  const { bot, transport, engine } = setup();
  await bot.handle(text("Sunita's claim hospital is Apollo"));
  await bot.handle(text("no"));
  await bot.handle(photo(transport, "aadhaar for my claim"));
  assert.match(transport.last(), /Which claim\? Send the file with a caption like/);
  assert.equal(engine.docStore.length, 0);
});

test("critic: in a session, any caption saves the PDF; another person's name is refused", async () => {
  const t = makeBot({ inspect: async () => ({ kind: "ok", text: "Claim form Part A. Policy No 123", hindi: false, guess: "health", scores: {} }) as any });
  t.engine.customers.push({ id: CUST, name: "Sunita Rao", phone: "9800000002" } as any);
  t.engine.claimStore.set(CLM, { id: CLM, status: "submitted", claim_type: "reimbursement", insurer: null, admitted_on: null, customer_id: CUST });
  await t.bot.handle(text("add documents to Sunita's claim"));
  await t.bot.handle(text("yes"));
  await t.bot.handle(pdf(t.transport, "claim form", { caption: "claim form part a" }));
  assert.equal(t.engine.docStore[0]?.label, "Claim form Part A");
  await t.bot.handle(pdf(t.transport, "form without caption"));
  assert.equal(t.engine.docStore.length, 2, "a claim form printing a policy number is not taken for a policy");
  await t.bot.handle(photo(t.transport, "Ramesh aadhaar"));
  assert.match(t.transport.last(), /Type DONE first, then send Ramesh's file/);
  assert.equal(t.engine.docStore.length, 2);
});

test("critic: NO drops waiting files for good; a session ended by other text says so", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(photo(transport, "final bill for Sunita's claim"));
  await bot.handle(text("no"));
  await bot.handle(photo(transport, "pan card for Sunita's claim"));
  assert.match(transport.last(), /Add PAN card \(photo\) to/);
  assert.doesNotMatch(transport.last(), /Final bill/, "the refused file does not come back");
  await bot.handle(text("no"));
  await bot.handle(text("add documents to Sunita's claim"));
  assert.match(transport.last(), /Any other message ends it/);
  await bot.handle(text("yes"));
  await bot.handle(text("next is discharge summary"));
  assert.match(transport.sent.map((m) => m.text).join("\n"), /Stopped adding files to Sunita Rao's claim .*\(0 added\)/);
  assert.equal(engine.docStore.length, 0);
});
