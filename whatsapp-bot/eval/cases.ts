/**
 * Bake-off test set: advisor messages with the right answer written down in advance.
 * ALL NAMES AND NUMBERS ARE MADE UP. No real customer data goes to any model.
 *
 * TODAY is fixed at Tue 2026-09-29, so date answers are exact:
 *   kal/tomorrow 2026-09-30 · parso 2026-10-01 · Friday 2026-10-02 · Monday 2026-10-05
 *   next Tuesday / next week 2026-10-06 · in 3 days 2026-10-02 · 15 Oct 2026-10-15
 */

import type { Action, ActionType, Context } from "../src/core/understand.js";

export const TODAY = "2026-09-29";

export type ExpAction = Partial<Omit<Action, "type" | "name">> & {
  type: ActionType | ActionType[];
  /** One acceptable spelling is enough. null = must be null. */
  name?: string | string[] | null;
};

export type Case = {
  id: string;
  cat: string;
  text: string;
  ctx?: Context;
  /** Any ONE of these action lists is a correct answer. */
  any?: ExpAction[][];
  /** The only right move is to ask or decline: correct iff nothing is written. */
  askOnly?: boolean;
  /** Never allowed, whatever else happens. */
  forbid?: { status?: string; types?: ActionType[] };
};

const one = (a: ExpAction): ExpAction[][] => [[a]];
const LEADW: ActionType[] = ["add_lead", "update_lead"];

export const CASES: Case[] = [
  /* 1. Command words inside names, and names next to command words */
  { id: "n1", cat: "names", text: "lead Ramesh won", any: one({ type: LEADW, name: "Ramesh", status: "won" }) },
  { id: "n2", cat: "names", text: "convert ramesh into lead that is won", any: one({ type: LEADW, name: "Ramesh", status: "won" }) },
  { id: "n3", cat: "names", text: "add lead Mark Dsouza 9876543210 health", any: one({ type: "add_lead", name: "Mark Dsouza", phone: "9876543210", interest: "Health" }) },
  { id: "n4", cat: "names", text: "Share Khan ka lead add karo 9812233445", any: one({ type: "add_lead", name: "Share Khan", phone: "9812233445" }) },
  { id: "n5", cat: "names", text: "new lead Link Singh, motor", any: one({ type: "add_lead", name: "Link Singh", interest: "Motor" }) },
  { id: "n6", cat: "names", text: "mark Nisha as interested", any: one({ type: "update_lead", name: "Nisha", status: "interested" }) },
  { id: "n7", cat: "names", text: "add Priya Share as a lead", any: one({ type: "add_lead", name: "Priya Share" }) },
  { id: "n8", cat: "names", text: "Anil lost", any: one({ type: "update_lead", name: "Anil", status: "lost" }) },
  { id: "n9", cat: "names", text: "Ramesh won't buy, mark him lost", any: one({ type: "update_lead", name: "Ramesh", status: "lost" }) },
  { id: "n10", cat: "names", text: "lead Kavita interested", any: one({ type: LEADW, name: "Kavita", status: "interested" }) },
  { id: "n11", cat: "names", text: "Rohit Mehra won", any: one({ type: "update_lead", name: "Rohit Mehra", status: "won" }) },
  { id: "n12", cat: "names", text: "add lead Help Desai 9800011122 life", any: one({ type: "add_lead", name: "Help Desai", phone: "9800011122", interest: "Life" }) },

  /* 2. Two actions in one message */
  { id: "t1", cat: "two", text: "add Ramesh 9812345678 and mark him won", any: [
    [{ type: "add_lead", name: "Ramesh", phone: "9812345678", status: "won" }],
    [{ type: "add_lead", name: "Ramesh", phone: "9812345678" }, { type: "update_lead", name: "Ramesh", status: "won" }],
  ] },
  { id: "t2", cat: "two", text: "add lead Sunita 9811122233 health, follow up friday", any: [
    [{ type: "add_lead", name: "Sunita", phone: "9811122233", interest: "Health", follow_up_date: "2026-10-02" }],
    [{ type: "add_lead", name: "Sunita", phone: "9811122233", interest: "Health" }, { type: "update_lead", name: "Sunita", follow_up_date: "2026-10-02" }],
  ] },
  { id: "t3", cat: "two", text: "mark Ramesh won and send him a thank you message", any: [
    [{ type: "update_lead", name: "Ramesh", status: "won" }, { type: "draft_message", name: "Ramesh", draft_kind: "thank_you" }],
  ] },
  { id: "t4", cat: "two", text: "renewals and follow ups", any: [[{ type: "renewals" }, { type: "followups" }]] },
  { id: "t5", cat: "two", text: "Santosh ka report share karo aur renewal message bhi banao", any: [
    [{ type: "share", name: "Santosh" }, { type: "draft_message", name: "Santosh", draft_kind: "renewal" }],
  ] },
  { id: "t6", cat: "two", text: "note for Anil: wants 10L floater, call him Monday", any: [
    [{ type: "update_lead", name: "Anil", follow_up_date: "2026-10-05" }],
    [{ type: "update_lead", name: "Anil" }, { type: "update_lead", name: "Anil", follow_up_date: "2026-10-05" }],
  ] },
  { id: "t7", cat: "two", text: "find Kavita and show my claims", any: [[{ type: "lookup", name: "Kavita" }, { type: "claims" }]] },
  { id: "t8", cat: "two", text: "Pooja bought the policy, add a note she wants her parents covered too", any: [
    [{ type: "update_lead", name: "Pooja", status: "won" }],
    [{ type: "update_lead", name: "Pooja", status: "won" }, { type: "update_lead", name: "Pooja" }],
  ] },

  /* 3. Pronouns and context */
  { id: "p1", cat: "pronoun", text: "mark him won", ctx: { lastPerson: "Ramesh Kumar" }, any: one({ type: "update_lead", name: "Ramesh Kumar", status: "won" }) },
  { id: "p2", cat: "pronoun", text: "send it to him", ctx: { lastPerson: "Santosh Vartak", lastItem: "policy report" }, any: one({ type: "share" }) },
  { id: "p3", cat: "pronoun", text: "uska follow up kal rakh do", ctx: { lastPerson: "Priya Nair" }, any: one({ type: "update_lead", name: "Priya Nair", follow_up_date: "2026-09-30" }) },
  { id: "p4", cat: "pronoun", text: "mark him won", askOnly: true },
  { id: "p5", cat: "pronoun", text: "she's not interested anymore", ctx: { lastPerson: "Sunita Rao" }, any: one({ type: "update_lead", name: "Sunita Rao", status: "lost" }) },
  { id: "p6", cat: "pronoun", text: "what's his room rent limit?", ctx: { lastPerson: "Santosh Vartak", lastItem: "policy report" }, any: one({ type: "ask_report" }) },
  // "next week" is fairly read as 7 days on OR as next Monday; both accepted.
  { id: "p7", cat: "pronoun", text: "call him next week", ctx: { lastPerson: "Anil Mehta" }, any: [
    [{ type: "update_lead", name: "Anil Mehta", follow_up_date: "2026-10-06" }],
    [{ type: "update_lead", name: "Anil Mehta", follow_up_date: "2026-10-05" }],
  ] },
  { id: "p8", cat: "pronoun", text: "add a note: prefers calls in Hindi", ctx: { lastPerson: "Meena Iyer" }, any: one({ type: "update_lead", name: "Meena Iyer" }) },
  { id: "p9", cat: "pronoun", text: "unka lead lost kar do", ctx: { lastPerson: "Vikram Shah" }, any: one({ type: "update_lead", name: "Vikram Shah", status: "lost" }) },
  { id: "p10", cat: "pronoun", text: "share it in hindi", ctx: { lastPerson: "Santosh Vartak", lastItem: "calculator result" }, any: one({ type: "share", language: "hindi" }) },
  { id: "p11", cat: "pronoun", text: "she said yes, she's buying", ctx: { lastPerson: "Neha Kulkarni" }, any: one({ type: "update_lead", name: "Neha Kulkarni", status: "won" }) },
  { id: "p12", cat: "pronoun", text: "call her tomorrow", askOnly: true },

  /* 4. Hinglish and Hindi */
  { id: "h1", cat: "hinglish", text: "Ramesh ne policy le li", any: one({ type: "update_lead", name: "Ramesh", status: "won" }) },
  { id: "h2", cat: "hinglish", text: "Ramesh ka lead won kar do", any: one({ type: "update_lead", name: "Ramesh", status: "won" }) },
  { id: "h3", cat: "hinglish", text: "Sunita ko interested mark karo", any: one({ type: "update_lead", name: "Sunita", status: "interested" }) },
  { id: "h4", cat: "hinglish", text: "Anil ne mana kar diya", any: one({ type: "update_lead", name: "Anil", status: "lost" }) },
  { id: "h5", cat: "hinglish", text: "naya lead: Kavita 9876501234, health chahiye", any: one({ type: "add_lead", name: "Kavita", phone: "9876501234", interest: "Health" }) },
  { id: "h6", cat: "hinglish", text: "is hafte ke renewals dikhao", any: one({ type: "renewals" }) },
  { id: "h7", cat: "hinglish", text: "aaj kisko call karna hai", any: one({ type: "followups" }) },
  { id: "h8", cat: "hinglish", text: "Santosh ki report bhej do", any: one({ type: "share", name: "Santosh" }) },
  { id: "h9", cat: "hinglish", text: "Ramesh ke liye diwali ka message banao", any: one({ type: "draft_message", name: "Ramesh", draft_kind: "festival" }) },
  { id: "h10", cat: "hindi", text: "मेरे क्लाइंट्स दिखाओ", any: one({ type: "list_clients" }) },
  { id: "h11", cat: "hindi", text: "रमेश को लीड में जोड़ो 9812345678", any: one({ type: "add_lead", name: "Ramesh", phone: "9812345678" }) },
  { id: "h12", cat: "hindi", text: "कितने चेक बचे हैं", any: one({ type: "checks" }) },
  { id: "h13", cat: "hinglish", text: "Santosh ki policy mein room rent kitna hai", any: one({ type: "ask_report", name: "Santosh" }) },
  { id: "h14", cat: "hinglish", text: "kavita ka follow up parso", any: one({ type: "update_lead", name: "Kavita", follow_up_date: "2026-10-01" }) },
  { id: "h15", cat: "hinglish", text: "mera website link bhejo", any: one({ type: "website" }) },
  { id: "h16", cat: "hinglish", text: "claims ka status batao", any: one({ type: "claims" }) },
  { id: "h17", cat: "hinglish", text: "Ramesh ka surrender value kitna hai", any: one({ type: "surrender_value", name: "Ramesh" }) },
  { id: "h18", cat: "hinglish", text: "Care Supreme aur Niva ReAssure compare karo", any: one({ type: "compare" }) },
  { id: "h19", cat: "hinglish", text: "cover calculate karna hai", any: one({ type: "calculator" }) },
  { id: "h20", cat: "hinglish", text: "kisne report kholi", any: one({ type: "views" }) },
  { id: "h21", cat: "hindi", text: "सुनीता ने पॉलिसी ले ली", any: one({ type: "update_lead", name: "Sunita", status: "won" }) },
  { id: "h22", cat: "hindi", text: "अनिल को कल फोन करना है", any: one({ type: "update_lead", name: "Anil", follow_up_date: "2026-09-30" }) },
  { id: "h23", cat: "hinglish", text: "Vikram se baat ho gayi", any: one({ type: "update_lead", name: "Vikram", status: "contacted" }) },
  { id: "h24", cat: "hinglish", text: "Ramesh ko renewal yaad dilao", any: one({ type: "draft_message", name: "Ramesh", draft_kind: "renewal" }) },

  /* 5. Misspellings and name forms */
  { id: "m1", cat: "names2", text: "Rmesh won", any: one({ type: "update_lead", name: ["Rmesh", "Ramesh"], status: "won" }) },
  { id: "m2", cat: "names2", text: "mark Ramesh K. interested", any: one({ type: "update_lead", name: ["Ramesh K.", "Ramesh K"], status: "interested" }) },
  { id: "m3", cat: "names2", text: "Mr Sharma lost", any: one({ type: "update_lead", name: ["Sharma", "Mr Sharma", "Mr. Sharma"], status: "lost" }) },
  { id: "m4", cat: "names2", text: "Sharma ji ka follow up friday", any: one({ type: "update_lead", name: ["Sharma", "Sharma ji", "Sharma Ji"], follow_up_date: "2026-10-02" }) },
  { id: "m5", cat: "names2", text: "SUNITA RAO IS INTERESTED", any: one({ type: "update_lead", name: ["SUNITA RAO", "Sunita Rao"], status: "interested" }) },

  /* 6. Corrections and undo */
  { id: "c1", cat: "undo", text: "no, I meant Suresh", ctx: { lastChange: "marked lead Ramesh as won" }, any: [
    [{ type: "update_lead", name: "Suresh", status: "won" }],
    [{ type: "undo" }, { type: "update_lead", name: "Suresh", status: "won" }],
  ] },
  { id: "c2", cat: "undo", text: "undo that", ctx: { lastChange: "marked lead Ramesh as won" }, any: one({ type: "undo" }) },
  { id: "c3", cat: "undo", text: "cancel", any: one({ type: "cancel" }) },
  { id: "c4", cat: "undo", text: "wait no, don't do it", ctx: { pending: "confirm: mark Ramesh as won?" }, any: [[{ type: "cancel" }]] },
  { id: "c5", cat: "undo", text: "galti se ho gaya, wapas karo", ctx: { lastChange: "marked lead Anil as lost" }, any: one({ type: "undo" }) },

  /* 7. Switching topic mid-flow */
  { id: "s1", cat: "switch", text: "actually show me renewals", ctx: { pending: "calculator: which city" }, any: one({ type: "renewals" }) },
  { id: "s2", cat: "switch", text: "leave it, find Anil", ctx: { pending: "add lead: phone number" }, any: [[{ type: "lookup", name: "Anil" }], [{ type: "cancel" }, { type: "lookup", name: "Anil" }]] },
  { id: "s3", cat: "switch", text: "never mind", ctx: { pending: "share: which language" }, any: one({ type: "cancel" }) },
  { id: "s4", cat: "switch", text: "chhodo, meri follow ups batao", ctx: { pending: "calculator: family" }, any: [[{ type: "followups" }], [{ type: "cancel" }, { type: "followups" }]] },

  /* 8. Missing information (the bot then asks) */
  { id: "i1", cat: "missing", text: "add a lead", any: one({ type: "add_lead", name: null }) },
  { id: "i2", cat: "missing", text: "add lead 9812345678", any: one({ type: "add_lead", name: null, phone: "9812345678" }) },
  { id: "i3", cat: "missing", text: "follow up friday", askOnly: true },
  { id: "i4", cat: "missing", text: "mark won", askOnly: true },
  { id: "i5", cat: "missing", text: "share", any: one({ type: "share", name: null }) },
  { id: "i6", cat: "missing", text: "compare", any: one({ type: "compare" }) },
  { id: "i7", cat: "missing", text: "draft a message", any: one({ type: "draft_message", name: null }) },

  /* 9. Dates */
  { id: "d1", cat: "dates", text: "follow up Ramesh tomorrow", any: one({ type: "update_lead", name: "Ramesh", follow_up_date: "2026-09-30" }) },
  { id: "d2", cat: "dates", text: "call Anil kal", any: one({ type: "update_lead", name: "Anil", follow_up_date: "2026-09-30" }) },
  { id: "d3", cat: "dates", text: "follow up Sunita next Tuesday", any: one({ type: "update_lead", name: "Sunita", follow_up_date: "2026-10-06" }) },
  { id: "d4", cat: "dates", text: "follow up Priya on 15 oct", any: one({ type: "update_lead", name: "Priya", follow_up_date: "2026-10-15" }) },
  { id: "d5", cat: "dates", text: "remind me to call Kavita in 3 days", any: one({ type: "update_lead", name: "Kavita", follow_up_date: "2026-10-02" }) },
  { id: "d6", cat: "dates", text: "Ramesh ko parso call karna", any: one({ type: "update_lead", name: "Ramesh", follow_up_date: "2026-10-01" }) },
  { id: "d7", cat: "dates", text: "follow up Anil on 5/10", any: one({ type: "update_lead", name: "Anil", follow_up_date: "2026-10-05" }) },
  { id: "d8", cat: "dates", text: "call Rohit Monday morning", any: one({ type: "update_lead", name: "Rohit", follow_up_date: "2026-10-05" }) },
  { id: "d9", cat: "dates", text: "set Neha's follow-up for friday", any: one({ type: "update_lead", name: "Neha", follow_up_date: "2026-10-02" }) },

  /* 10. Chit-chat and out of scope (nothing may change) */
  { id: "o1", cat: "offtopic", text: "hi", any: one({ type: "help" }) },
  { id: "o2", cat: "offtopic", text: "what's the weather in Mumbai", askOnly: true },
  { id: "o3", cat: "offtopic", text: "who won the match yesterday?", askOnly: true, forbid: { status: "won" } },
  { id: "o4", cat: "offtopic", text: "tell me a joke", askOnly: true },
  { id: "o5", cat: "offtopic", text: "I won the bet with Ramesh", askOnly: true, forbid: { status: "won" } },
  { id: "o6", cat: "offtopic", text: "India won!", askOnly: true, forbid: { status: "won" } },
  { id: "o7", cat: "offtopic", text: "thanks", askOnly: true },
  { id: "o8", cat: "offtopic", text: "did Ramesh win anything?", askOnly: true, forbid: { status: "won" } },
  { id: "o9", cat: "offtopic", text: "Ramesh won't pick up my calls", forbid: { status: "won" }, any: [[{ type: "unknown" }], [{ type: "update_lead", name: "Ramesh" }]] },
  { id: "o10", cat: "offtopic", text: "what can you do?", any: one({ type: "help" }) },

  /* 11. Delete / destructive (not supported: nothing may change) */
  { id: "x1", cat: "delete", text: "delete Ramesh", askOnly: true },
  { id: "x2", cat: "delete", text: "remove all my leads", askOnly: true },
  { id: "x3", cat: "delete", text: "Ramesh ko hata do", askOnly: true },
  { id: "x4", cat: "delete", text: "Ramesh's claim got settled", forbid: { types: ["add_lead", "update_lead"] }, any: [[{ type: "claims" }], [{ type: "unknown" }]] },

  /* 12. Everyday requests, phrased freely */
  { id: "e1", cat: "everyday", text: "any co-pay in Santosh's policy?", any: one({ type: "ask_report", name: "Santosh" }) },
  { id: "e2", cat: "everyday", text: "does it cover maternity?", ctx: { lastPerson: "Santosh Vartak", lastItem: "policy report" }, any: one({ type: "ask_report" }) },
  { id: "e3", cat: "everyday", text: "waiting period for diabetes?", ctx: { lastPerson: "Santosh Vartak", lastItem: "policy report" }, any: one({ type: "ask_report" }) },
  { id: "e4", cat: "everyday", text: "is cataract capped in Meena's plan", any: one({ type: "ask_report", name: "Meena" }) },
  { id: "e5", cat: "everyday", text: "send Santosh his report", any: one({ type: "share", name: "Santosh" }) },
  { id: "e6", cat: "everyday", text: "share the report with 9987148125", ctx: { lastItem: "policy report" }, any: one({ type: "share", phone: "9987148125" }) },
  { id: "e7", cat: "everyday", text: "forward the calculator to the customer", ctx: { lastItem: "calculator result" }, any: one({ type: "share" }) },
  { id: "e8", cat: "everyday", text: "who's renewing this week", any: one({ type: "renewals" }) },
  { id: "e9", cat: "everyday", text: "any policies expiring soon?", any: one({ type: "renewals" }) },
  { id: "e10", cat: "everyday", text: "who should I call today", any: one({ type: "followups" }) },
  { id: "e11", cat: "everyday", text: "pending follow ups", any: one({ type: "followups" }) },
  { id: "e12", cat: "everyday", text: "Rohit Mehra 9876123450 wants term insurance, add him", any: one({ type: "add_lead", name: "Rohit Mehra", phone: "9876123450", interest: "Term" }) },
  { id: "e13", cat: "everyday", text: "new lead Neha, health", any: one({ type: "add_lead", name: "Neha", interest: "Health" }) },
  { id: "e14", cat: "everyday", text: "save lead: Vikram, 9811198111, motor", any: one({ type: "add_lead", name: "Vikram", phone: "9811198111", interest: "Motor" }) },
  { id: "e15", cat: "everyday", text: "add Pooja as a lead, she wants health cover for her parents", any: one({ type: "add_lead", name: "Pooja", interest: "Health" }) },
  { id: "e16", cat: "everyday", text: "Vikram is interested", any: one({ type: "update_lead", name: "Vikram", status: "interested" }) },
  { id: "e17", cat: "everyday", text: "spoke to Rohit today", any: one({ type: "update_lead", name: "Rohit", status: "contacted" }) },
  { id: "e18", cat: "everyday", text: "Neha said no", any: one({ type: "update_lead", name: "Neha", status: "lost" }) },
  { id: "e19", cat: "everyday", text: "Pooja bought the policy!", any: one({ type: "update_lead", name: "Pooja", status: "won" }) },
  { id: "e20", cat: "everyday", text: "note on Vikram: has 2 cars, renewal in March", any: one({ type: "update_lead", name: "Vikram" }) },
  { id: "e21", cat: "everyday", text: "find Ramesh", any: one({ type: "lookup", name: "Ramesh" }) },
  { id: "e22", cat: "everyday", text: "who is 9812345678", any: one({ type: "lookup", phone: "9812345678" }) },
  { id: "e23", cat: "everyday", text: "what do we have on Kavita?", any: one({ type: "lookup", name: "Kavita" }) },
  { id: "e24", cat: "everyday", text: "my clients", any: one({ type: "list_clients" }) },
  { id: "e25", cat: "everyday", text: "list all motor policies", any: one({ type: "list_clients" }) },
  { id: "e26", cat: "everyday", text: "show my leads", any: one({ type: "list_leads" }) },
  { id: "e27", cat: "everyday", text: "upgrade message for Santosh", any: one({ type: "draft_message", name: "Santosh", draft_kind: "upgrade_weak" }) },
  { id: "e28", cat: "everyday", text: "send a premium due reminder to Ramesh", any: one({ type: "draft_message", name: "Ramesh", draft_kind: "premium_due" }) },
  { id: "e29", cat: "everyday", text: "thank you note for Pooja", any: one({ type: "draft_message", name: "Pooja", draft_kind: "thank_you" }) },
  { id: "e30", cat: "everyday", text: "holi wishes for Neha in hinglish", any: one({ type: "draft_message", name: "Neha", draft_kind: "festival", language: "hinglish" }) },
  { id: "e31", cat: "everyday", text: "follow up message for Vikram", any: one({ type: "draft_message", name: "Vikram", draft_kind: "follow_up" }) },
  { id: "e32", cat: "everyday", text: "how much cover does a 35 year old in Pune need", any: one({ type: "calculator" }) },
  { id: "e33", cat: "everyday", text: "calculator for Ramesh's family", any: one({ type: "calculator", name: "Ramesh" }) },
  { id: "e34", cat: "everyday", text: "compare Care Supreme vs Niva ReAssure 2.0", any: one({ type: "compare" }) },
  { id: "e35", cat: "everyday", text: "which is better, HDFC Optima Secure or Star Comprehensive?", any: one({ type: "compare" }) },
  { id: "e36", cat: "everyday", text: "send my website", any: one({ type: "website" }) },
  { id: "e37", cat: "everyday", text: "what's my page link", any: one({ type: "website" }) },
  { id: "e38", cat: "everyday", text: "how many policy checks do I have left", any: one({ type: "checks" }) },
  { id: "e39", cat: "everyday", text: "who opened my reports?", any: one({ type: "views" }) },
  { id: "e40", cat: "everyday", text: "did Santosh open the report?", any: [[{ type: "views" }], [{ type: "views", name: "Santosh" }]] },
  { id: "e41", cat: "everyday", text: "open claims", any: one({ type: "claims" }) },
  { id: "e42", cat: "everyday", text: "any queries on Meena's claim", any: one({ type: "claims", name: "Meena" }) },
  { id: "e43", cat: "everyday", text: "surrender value for Ramesh's LIC", any: one({ type: "surrender_value", name: "Ramesh" }) },
  { id: "e44", cat: "everyday", text: "how much will Anil get if he surrenders his policy", any: one({ type: "surrender_value", name: "Anil" }) },
  { id: "e45", cat: "everyday", text: "menu", any: one({ type: "help" }) },
  { id: "e46", cat: "everyday", text: "remind Ramesh about his renewal", any: one({ type: "draft_message", name: "Ramesh", draft_kind: "renewal" }) },
  { id: "e47", cat: "everyday", text: "list health customers", any: one({ type: "list_clients" }) },
  { id: "e48", cat: "everyday", text: "Kavita ka number kya hai", any: one({ type: "lookup", name: "Kavita" }) },
];
