/**
 * Held-out messages for eval/rules-baseline.ts --holdout: written AFTER the conversational
 * rules (converse.ts) were tuned on cases.ts, and never tuned on. If the score here is far
 * below cases.ts, the rules learned the test, not the language. Names are made up.
 */
import type { Case } from "./cases.js";

const one = (a: any) => [[a]];

export const HOLDOUT: Case[] = [
  { id: "z1", cat: "holdout", text: "hello ji", any: one({ type: "help" }) },
  { id: "z2", cat: "holdout", text: "which renewals are coming up", any: one({ type: "renewals" }) },
  { id: "z3", cat: "holdout", text: "Anil Mehta said no to the plan", any: one({ type: "update_lead", name: "Anil Mehta", status: "lost" }) },
  { id: "z4", cat: "holdout", text: "Kavita has bought it", any: one({ type: "update_lead", name: "Kavita", status: "won" }) },
  { id: "z5", cat: "holdout", text: "talked with Vikram just now", any: one({ type: "update_lead", name: "Vikram", status: "contacted" }) },
  { id: "z6", cat: "holdout", text: "what is his co-pay", ctx: { lastPerson: "Santosh Vartak", lastItem: "policy report" }, any: one({ type: "ask_report" }) },
  { id: "z7", cat: "holdout", text: "call her on friday", ctx: { lastPerson: "Priya Nair" }, any: one({ type: "update_lead", name: "Priya Nair", follow_up_date: "2026-10-02" }) },
  { id: "z8", cat: "holdout", text: "uski report bhej do", ctx: { lastPerson: "Santosh Vartak", lastItem: "policy report" }, any: one({ type: "share" }) },
  { id: "z9", cat: "holdout", text: "tell me about Meena", any: one({ type: "lookup", name: "Meena" }) },
  { id: "z10", cat: "holdout", text: "Rohit ka phone number", any: one({ type: "lookup", name: "Rohit" }) },
  { id: "z11", cat: "holdout", text: "send me my website link", any: one({ type: "website" }) },
  { id: "z12", cat: "holdout", text: "list my leads", any: one({ type: "list_leads" }) },
  { id: "z13", cat: "holdout", text: "birthday wishes for Sunita", any: one({ type: "draft_message", name: "Sunita", draft_kind: "birthday" }) },
  { id: "z14", cat: "holdout", text: "send a renewal reminder to Anil", any: one({ type: "draft_message", name: "Anil", draft_kind: "renewal" }) },
  { id: "z15", cat: "holdout", text: "which one is better, Care Supreme or ReAssure 2.0", any: one({ type: "compare" }) },
  { id: "z16", cat: "holdout", text: "folow ups", any: one({ type: "followups" }) },
  { id: "z17", cat: "holdout", text: "renwals pls", any: one({ type: "renewals" }) },
  { id: "z18", cat: "holdout", text: "calcualtor", any: one({ type: "calculator" }) },
  { id: "z19", cat: "holdout", text: "who all opened the reports", any: one({ type: "views" }) },
  { id: "z20", cat: "holdout", text: "Neha is no longer interested", any: one({ type: "update_lead", name: "Neha", status: "lost" }) },
  { id: "z21", cat: "holdout", text: "remove Kavita", askOnly: true },
  { id: "z22", cat: "holdout", text: "is it going to rain today", askOnly: true },
  { id: "z23", cat: "holdout", text: "Pooja ko kal call karna", any: one({ type: "update_lead", name: "Pooja", follow_up_date: "2026-09-30" }) },
  { id: "z24", cat: "holdout", text: "good evening sir", any: one({ type: "help" }) },
  { id: "z25", cat: "holdout", text: "any claim updates", any: one({ type: "claims" }) },
];
