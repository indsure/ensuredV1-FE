/**
 * Stage 2d: reading life-policy records ("Ramesh paid premium 25,000 on 5 Oct 2026", "no loan on
 * Ramesh's policy", "Ramesh's surrender value is 1.2 lakh", "Ramesh's policy is lapsed"). Pure:
 * text in, request out. The bot finds the policy and asks YES first; the server builds and checks
 * the record with the portal's own rules (shared/policyEvidence.ts) before saving.
 */

export type LifeAsk = { who: string | null; typeWord: string | null } & (
  | { kind: "payment"; amount: string; paidOn: string | null; dueDate: string | null }
  | { kind: "loan"; status: "none" }
  | { kind: "loan"; status: "outstanding"; amount: string }
  /* An insurer's figure carries the date of its statement (quoteDate); null = not said, the bot asks. */
  | { kind: "quote"; quoteType: "surrender_payable" | "loan_available"; amount: string; quoteDate: string | null }
  | { kind: "quote"; quoteType: "policy_status"; status: "in_force" | "lapsed" | "paid_up" | "surrendered" | "matured"; quoteDate: string | null }
  | { kind: "quote"; quoteType: "premiums_paid_to"; paidTo: string }
);

const clean = (s: string) => s.trim().replace(/[.!।]+$/, "").trim();
const NOT_WHO = /^(?:the|this|that|my|a|an|it|his|her|their|all|every|any|premium|policy)$|\d|\bcustomer\b/i;
const NOT_WHO_START = /^(?:is|was|has|had|did|does|do|add|kya|this|that|which|what|where|when|how)\s/i;
const PRONOUN = /^(?:he|she|they|him|them|unhone|unhon ne|usne|us ne|inhone|isne|unka|uska|inka|iska|उन्होंने|उसने)$/i;
const okWho = (w: string | undefined | null) => !!w && w.trim().length >= 2 && !NOT_WHO.test(w.trim()) && !NOT_WHO_START.test(w.trim());

const AMT = "((?:rs\\.?\\s*|₹\\s*|inr\\s*)?\\d[\\d,]*(?:\\.\\d+)?(?:\\s*(?:k|thousand|lakh|lakhs|lac|l|cr|crore))?(?:\\s*\\/-)?)";
const DATE = "(\\d{1,2}(?:st|nd|rd|th)?\\s+[a-z]{3,9},?\\s+\\d{2,4}|\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{4}-\\d{1,2}-\\d{1,2}|[a-z]{3,9}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{2,4})";
const TY = "(?:(life|term|lic|endowment|money back)\\s+)?";
/** "Ramesh's (life) policy" / "this policy" -> group for the name, then the type word. */
const POL = `(?:this\\s+policy|(.+?)'s\\s+${TY}policy)`;

const STATUS: [RegExp, "in_force" | "lapsed" | "paid_up" | "surrendered" | "matured"][] = [
  // Only the insurer's own words: "active" or "running" is a loose impression, not a status.
  [/^(?:in force|in-force)$/i, "in_force"],
  [/^(?:lapsed|lapse|lapse ho gayi|band ho gayi)$/i, "lapsed"],
  [/^(?:paid up|paid-up|made paid up)$/i, "paid_up"],
  [/^(?:surrendered|surrender ho gayi)$/i, "surrendered"],
  [/^(?:matured|maturity ho gayi)$/i, "matured"],
];

export function parseLifeAsk(textRaw: string): LifeAsk | null {
  const raw = textRaw.trim();
  if (/\?\s*$/.test(raw) || /\s(?:kya|right|na)\s*[.!।]*$/i.test(raw)) return null;
  const t = clean(raw).replace(/[’']/g, "'");
  let m: RegExpMatchArray | null;
  // "he paid ..." means the policy we are on, never a name search for "he" (Mahesh, Shekhar).
  const pronoun = (w: string | undefined) => w !== undefined && PRONOUN.test(w.trim());
  const who = (w: string | undefined) => (w === undefined || pronoun(w) ? null : clean(w));
  const ok = (w: string | undefined) => w === undefined || pronoun(w) || okWho(w);

  // Payment: "Ramesh paid premium 25000 on 5 Oct 2026 (for the due on 1 Oct 2026)"
  // The word "premium" is required: a bare "Ramesh paid 25000" may be a health renewal or a lead.
  m = t.match(new RegExp(`^(.+?)\\s+(?:has\\s+)?paid\\s+(?:the\\s+|his\\s+|her\\s+|a\\s+)?(?:${TY}premium\\s+(?:of\\s+)?${AMT}|${AMT}\\s+(?:life\\s+|term\\s+)?premium)(?:\\s+on\\s+${DATE})?(?:\\s+for\\s+(?:the\\s+)?(?:premium\\s+|instalment\\s+|installment\\s+)?due\\s+(?:on\\s+)?${DATE})?$`, "i"));
  if (m && ok(m[1])) return { kind: "payment", who: who(m[1]), typeWord: m[2]?.toLowerCase() ?? null, amount: m[3] ?? m[4], paidOn: m[5] ?? null, dueDate: m[6] ?? null };
  m = t.match(new RegExp(`^premium\\s+(?:of\\s+)?${AMT}\\s+paid\\s+(?:for|on)\\s+${POL}(?:\\s+on\\s+${DATE})?(?:\\s+for\\s+(?:the\\s+)?due\\s+(?:on\\s+)?${DATE})?$`, "i"));
  if (m && ok(m[2])) return { kind: "payment", who: who(m[2]), typeWord: m[3]?.toLowerCase() ?? null, amount: m[1], paidOn: m[4] ?? null, dueDate: m[5] ?? null };
  m = t.match(new RegExp(`^(.+?)\\s+ne\\s+${AMT}\\s+(?:ka\\s+)?premium\\s+(?:bhara|bhar diya|jama kiya|jama kar diya|de diya|diya)(?:\\s+${DATE}\\s+ko)?$`, "i"));
  if (m && ok(m[1])) return { kind: "payment", who: who(m[1]), typeWord: null, amount: m[2], paidOn: m[3] ?? null, dueDate: null };

  // Premiums paid up to a date: "Ramesh's premiums are paid up to 1 Oct 2026"
  m = t.match(new RegExp(`^(?:(.+?)'s|this policy's)\\s+${TY}(?:policy\\s+)?premiums?\\s+(?:are\\s+|is\\s+)?paid\\s+(?:up\\s+)?(?:to|till|until)\\s+${DATE}$`, "i"))
    || t.match(new RegExp(`^(.+?)\\s+has\\s+paid\\s+(?:all\\s+)?premiums?\\s+(?:up\\s+)?(?:to|till|until)\\s+${DATE}$`, "i"));
  if (m && ok(m[1])) {
    const typeWord = m.length > 3 ? m[2] : undefined;
    return { kind: "quote", quoteType: "premiums_paid_to", who: who(m[1]), typeWord: typeWord?.toLowerCase() ?? null, paidTo: m[m.length - 1] };
  }

  // No loan: "no loan on Ramesh's policy", "Ramesh has no loan", "Ramesh ki policy par koi loan nahi"
  m = t.match(new RegExp(`^(?:there\\s+is\\s+)?no\\s+(?:policy\\s+)?loan\\s+on\\s+${POL}$`, "i"));
  if (m && ok(m[1])) return { kind: "loan", status: "none", who: who(m[1]), typeWord: m[2]?.toLowerCase() ?? null };
  m = t.match(/^(.+?)\s+has\s+no\s+(?:policy\s+)?loan(?:\s+on\s+(?:his|her|the)\s+policy)?$/i)
    || t.match(/^(.+?)\s+(?:ki|ka|की|का)\s+policy\s+(?:par|pe|पर)\s+(?:koi\s+)?loan\s+(?:nahi|nahin|नहीं)(?:\s+hai|\s+है)?$/i);
  if (m && ok(m[1])) return { kind: "loan", status: "none", who: who(m[1]), typeWord: null };

  // Loan outstanding: "Ramesh has a loan of 50000 on his policy", "loan on Ramesh's policy is 50000"
  m = t.match(new RegExp(`^(.+?)\\s+has\\s+(?:a\\s+|taken\\s+a\\s+)?(?:policy\\s+)?loan\\s+of\\s+${AMT}(?:\\s+on\\s+(?:his|her|the)\\s+policy)?$`, "i"));
  if (m && ok(m[1])) return { kind: "loan", status: "outstanding", who: who(m[1]), typeWord: null, amount: m[2] };
  m = t.match(new RegExp(`^(?:the\\s+)?(?:policy\\s+)?loan\\s+(?:outstanding\\s+)?on\\s+${POL}\\s+is\\s+${AMT}$`, "i"));
  if (m && ok(m[1])) return { kind: "loan", status: "outstanding", who: who(m[1]), typeWord: m[2]?.toLowerCase() ?? null, amount: m[3] };

  // Insurer figures: surrender value, loan available
  // The date of the insurer's statement, when said: "... is 1.2 lakh as of 1 Oct 2026".
  const dated = t.match(new RegExp(`^(.*?)\\s+(?:as of|as on|dated|on)\\s+${DATE}$`, "i"));
  const tq = dated ? dated[1] : t;
  const quoteDate = dated ? dated[2] : null;
  m = tq.match(new RegExp(`^(?:the\\s+)?(?:insurer|company|lic)\\s+says\\s+(.+)$`, "i"));
  const q = m ? m[1] : tq;
  m = q.match(new RegExp(`^(?:(.+?)'s\\s+${TY}(?:policy\\s+)?|this\\s+policy's\\s+|the\\s+)(surrender value|loan available|available loan|loan limit)\\s+(?:is|=|:)\\s+${AMT}$`, "i"))
    || q.match(new RegExp(`^(surrender value|loan available|available loan|loan limit)\\s+(?:on|for|of)\\s+${POL}\\s+is\\s+${AMT}$`, "i"));
  if (m) {
    const first = /^(?:surrender value|loan available|available loan|loan limit)$/i.test(m[1]);
    const [w, ty, what, amt] = first ? [m[2], m[3], m[1], m[4]] : [m[1], m[2], m[3], m[4]];
    if (ok(w)) return { kind: "quote", quoteType: /surrender/i.test(what) ? "surrender_payable" : "loan_available", who: who(w), typeWord: ty?.toLowerCase() ?? null, amount: amt, quoteDate };
  }
  m = q.match(new RegExp(`^(.+?)\\s+(?:ki|ka|की|का)\\s+(?:policy\\s+(?:ki|ka|की|का)\\s+)?surrender\\s+value\\s+${AMT}(?:\\s+hai|\\s+है)?$`, "i"));
  if (m && ok(m[1])) return { kind: "quote", quoteType: "surrender_payable", who: who(m[1]), typeWord: null, amount: m[2], quoteDate };

  // Status: "Ramesh's policy is lapsed", "this policy is paid up", "Ramesh ki policy lapse ho gayi"
  m = tq.match(new RegExp(`^(?:(.+?)'s|this)\\s+${TY}policy\\s+(?:is|has|has been|was)\\s+(.+)$`, "i"))
    || tq.match(/^(.+?)\s+(?:ki|की)\s+policy\s+(.+)$/i);
  if (m) {
    const [w, ty, rest] = m.length > 3 ? [m[1], m[2], m[3]] : [m[1], undefined, m[2]];
    const st = STATUS.find(([re]) => re.test(rest.trim()))?.[1];
    if (st && ok(w)) return { kind: "quote", quoteType: "policy_status", status: st, who: who(w), typeWord: ty?.toLowerCase() ?? null, quoteDate };
  }
  return null;
}
