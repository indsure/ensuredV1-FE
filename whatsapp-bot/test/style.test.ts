import { test } from "node:test";
import assert from "node:assert/strict";
import { polish, customerText, stripMarkers } from "../src/core/style.js";
import { makeBot, text } from "./fakes.js";

const out = (s: string, intent: string | null = null) => stripMarkers(polish(s, intent));

test("commands to type are bold; ordinary words are not", () => {
  assert.equal(out("Reply YES to save, or NO."), "Reply *YES* to save, or *NO*.");
  assert.equal(out("• TODAY: your to-do · MORNING OFF / ON"), "• *TODAY*: your to-do · *MORNING OFF / ON*");
  assert.equal(out("Reply *YES* now"), "Reply *YES* now", "already bold stays single");
  assert.equal(out("No lead yet. Nothing to share."), "No lead yet. Nothing to share.");
  assert.equal(out("HDFC OPTIMA SECURE"), "HDFC OPTIMA SECURE");
});

test("numbers: phones spaced, dates readable, rupees in Indian style", () => {
  assert.equal(out("1) Ramesh · 9812345678 · due 2026-10-02"), "1. Ramesh · 98123 45678 · due 2 Oct 2026");
  assert.equal(out("Claimed: ₹125000"), "Claimed: ₹1,25,000");
  assert.equal(out("🧮 ₹40 Lakhs cover, or ₹1.5 Crores"), "🧮 ₹40 lakh cover, or ₹1.5 crore");
  assert.equal(out("₹40,000 on a ₹3L bill"), "₹40,000 on a ₹3L bill", "already formatted: unchanged");
});

test("lists: '1.' numbering, capitalised types and statuses", () => {
  assert.equal(out("1) *Ramesh* · health · new\n2) *Sunita* · motor · interested"), "1. *Ramesh* · Health · New\n2. *Sunita* · Motor · Interested");
});

test("links never swallow punctuation, and are never restyled", () => {
  assert.equal(out("Full report: https://indsure.in/r/abc."), "Full report: https://indsure.in/r/abc");
  assert.equal(out("See https://indsure.in/x?text=YES%209812345678 now"), "See https://indsure.in/x?text=YES%209812345678 now");
});

test("spacing: no trailing spaces, at most one blank line", () => {
  assert.equal(out("a  \n\n\n\nb   "), "a\n\nb");
});

test("one emoji for the kind of reply, never doubled", () => {
  assert.equal(out("Please confirm:", "confirm_ask"), "📝 Please confirm:");
  assert.equal(out("📋 2 follow-ups due:", "followups"), "📋 2 follow-ups due:");
  assert.equal(out("🧮 Result", "calc"), "🧮 Result");
  assert.equal(out("Hello", "some_other"), "Hello");
});

test("a customer's message is sent exactly as written", () => {
  const msg = customerText("Hello Ramesh,\nReply YES on 9812345678 by 2026-10-02. https://x.y/z.");
  assert.equal(out(`Here it is:\n${msg}`, "share"), "📤 Here it is:\nHello Ramesh,\nReply YES on 9812345678 by 2026-10-02. https://x.y/z.");
});

test("end to end: the confirm message as an advisor sees it", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [{ id: "l1", name: "Ramesh Kumar", phone: "9812345678", status: "new", insurance_interest: "Health", next_follow_up: null, notes: null }];
  await bot.handle(text("Ramesh won"));
  assert.equal(transport.lastRaw(), "📝 Please confirm:\n• *Ramesh Kumar* (98123 45678): mark won\n\nReply *YES* to save, or *NO*.");
});

test("end to end: the share message keeps the customer's text untouched", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [{ id: "l1", name: "Aniket Bang", phone: "9284142611", status: "new", insurance_interest: null, next_follow_up: null, notes: null }];
  await bot.handle(text("Wish Aniket Happy Birthday"));
  const raw = transport.lastRaw();
  assert.match(raw, /^📤 Here's a message for Aniket Bang\./);
  assert.ok(!raw.includes("⁤"), "markers removed before sending");
  assert.match(raw, /The message:\nHello Aniket,\nWishing you a very happy birthday!/);
});
