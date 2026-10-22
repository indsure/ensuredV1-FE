/**
 * Stage 2a: reading edit requests ("change Amit's phone to 98123 45678", "Amit ka city Pune
 * kar do", "make Amit a customer", "this is Sunita's"). Pure: text in, request out. Nothing
 * here looks anything up or writes; the bot resolves names and asks YES first, and the
 * server re-checks everything (backend/server/whatsapp/edits.ts).
 */

import { POLICY_FIX_FIELDS, strictAmount } from "../shared/editRules.js";

export type Field = "name" | "phone" | "email" | "city" | "source" | "insurance_interest" | "expected_value" | "dob";
export type EditAsk = { who: string; field: Field | null; value: string | null };

/** Words for each field, longest first so "phone number" wins over "phone". */
const FIELD_WORDS: [RegExp, Field][] = [
  [/^(?:mobile number|phone number|contact number|mobile no\.?|phone no\.?|whatsapp number|number|mobile|phone|contact|nambar|नंबर|फ़ोन|फोन|मोबाइल)$/, "phone"],
  [/^(?:email(?: id| address)?|e-mail|mail(?: id)?|ईमेल)$/, "email"],
  [/^(?:city|town|shehar|sheher|shahar|शहर)$/, "city"],
  [/^(?:lead source|source|सोर्स)$/, "source"],
  [/^(?:interests?|insurance interest|interested in|insurance|इंटरेस्ट)$/, "insurance_interest"],
  [/^(?:expected premium|expected value|expected amount|premium budget|budget|expected|बजट)$/, "expected_value"],
  [/^(?:full name|name|naam|नाम)$/, "name"],
  [/^(?:dob|d\.o\.b\.?|date of birth|birth date|birthday|birth day|janamdin|janmdin|जन्मदिन|जन्म तिथि)$/, "dob"],
];
const FIELD_ALT = "mobile number|phone number|contact number|mobile no\\.?|phone no\\.?|whatsapp number|number|mobile|phone|contact|nambar|नंबर|फ़ोन|फोन|मोबाइल|email(?: id| address)?|e-mail|mail(?: id)?|ईमेल|city|town|shehar|sheher|shahar|शहर|lead source|source|सोर्स|interests?|insurance interest|insurance|इंटरेस्ट|expected premium|expected value|expected amount|premium budget|budget|expected|बजट|full name|name|naam|नाम|dob|d\\.o\\.b\\.?|date of birth|birth date|birthday|birth day|janamdin|janmdin|जन्मदिन|जन्म तिथि";

export function fieldOf(word: string): Field | null {
  const w = word.trim().toLowerCase();
  return FIELD_WORDS.find(([re]) => re.test(w))?.[1] ?? null;
}

/** Words that are never a person in these sentences ("change city", "edit it"). */
const NOT_WHO = /^(?:it|this|that|him|her|them|my|the|me|his|their|lead|customer|policy|details|city|phone|number|name|email|plan|cover|claim|report|everything|all)$/i;
/** Words that mean the message is about something else: adding a lead ("add lead Amit wants
 *  health"), my own page or book ("edit my page"), or a date ("next week"). Digits too: a
 *  person is never "Ramesh 98123 45678". */
const NOT_A_PERSON = /\b(?:lead|leads|add|new|naya|nayi|create|save|enter|my|mera|meri|mere|next|this week|today|tomorrow|renewals?|review|page|website|site|book)\b|\d/i;
const okWho = (w: string | undefined) => !!w && w.trim().length >= 2 && !NOT_WHO.test(w.trim()) && !fieldOf(w) && !NOT_A_PERSON.test(w);
/** A "value" that is really a question: "Kavita ka number kya hai" is a lookup, not an edit. */
const QUESTION_VALUE = /^(?:kya|kya hai|kitna|kitni|kaun|kaunsa|batao|bata do|dikhao|what|which|\?)$/i;
const clean = (s: string) => s.trim().replace(/[.!?।]+$/, "").trim();

/** One-shot edits with a value, and guided "edit Amit". Null when it is neither. */
export function parseEditAsk(textRaw: string): EditAsk | null {
  const t = clean(textRaw);
  const F = `(${FIELD_ALT})`;
  const tries: [RegExp, (m: RegExpMatchArray) => EditAsk | null][] = [
    // change / update / set Amit's phone to 98123 45678
    [new RegExp(`^(?:please\\s+)?(?:change|update|set|edit|correct|fix|make)\\s+(.+?)'s\\s+${F}\\s+(?:to|as|into|=|:)\\s+(.+)$`, "i"), (m) => ({ who: m[1], field: fieldOf(m[2]), value: m[3] })],
    // change the phone of Amit to 98...
    [new RegExp(`^(?:please\\s+)?(?:change|update|set|correct|fix)\\s+(?:the\\s+)?${F}\\s+(?:of|for)\\s+(.+?)\\s+(?:to|as)\\s+(.+)$`, "i"), (m) => ({ who: m[2], field: fieldOf(m[1]), value: m[3] })],
    // Amit's phone is 98... / Amit's city should be Pune
    [new RegExp(`^(.+?)'s\\s+${F}\\s+(?:is now|should be|is|=|:)\\s+(.+)$`, "i"), (m) => ({ who: m[1], field: fieldOf(m[2]), value: m[3] })],
    // Amit ka city Pune kar do / Amit ki email x@y.com daal do / Amit ka number 98... hai
    [new RegExp(`^(.+?)\\s+(?:ka|ki|ke|का|की|के)\\s+${F}\\s+(.+?)\\s+(?:kar do|kardo|karo|kar dijiye|daal do|daalo|likh do|likho|rakh do|hai|कर दो|करो|है)$`, "i"), (m) => ({ who: m[1], field: fieldOf(m[2]), value: m[3] })],
    // rename Amit to Amit Shah
    [/^rename\s+(.+?)\s+(?:to|as)\s+(.+)$/i, (m) => ({ who: m[1], field: "name", value: m[2] })],
    // Amit is interested in health and motor
    [/^(.+?)\s+(?:is\s+)?(?:interested in|wants|ko chahiye)\s+((?:health|motor|life|term|travel|property)(?:\s*(?:,|and|aur|&|\/)\s*(?:health|motor|life|term|travel|property))*)(?:\s+insurance|\s+cover)?$/i,
      (m) => ({ who: m[1], field: "insurance_interest", value: m[2] })],
    // Guided: edit Amit / edit Amit's details / change Amit's details / Amit ki details badlo
    [/^(?:edit|correct)\s+(.+?)(?:'s)?(?:\s+(?:details|info|information|lead|customer))?$/i, (m) => ({ who: m[1], field: null, value: null })],
    [/^(?:change|update)\s+(.+?)'s\s+(?:details|info|information)$/i, (m) => ({ who: m[1], field: null, value: null })],
    [/^(.+?)\s+(?:ki|ka|ke|की|का|के)\s+(?:details|detail|jankari|jaankari|जानकारी)\s+(?:badlo|badal do|edit karo|change karo|theek karo|बदलो|बदल दो)$/i, (m) => ({ who: m[1], field: null, value: null })],
    [/^(.+?)\s+(?:edit|change)\s+karo$/i, (m) => ({ who: m[1], field: null, value: null })],
  ];
  for (const [re, f] of tries) {
    const m = t.match(re);
    if (!m) continue;
    const ask = f(m);
    if (!ask || !okWho(ask.who)) continue;
    if (ask.value !== null && (QUESTION_VALUE.test(ask.value.trim()) || !ask.value.trim())) continue;
    if (ask.field === null && ask.value !== null) continue;
    return { who: clean(ask.who), field: ask.field, value: ask.value === null ? null : clean(ask.value) };
  }
  return null;
}

/** "make Amit a customer", "convert Amit", "Amit ko customer bana do", "Amit bought, make him a customer". */
export function parseConvert(textRaw: string): string | null {
  const t = clean(textRaw);
  const m = t.match(/^(?:make|convert|turn|save)\s+(.+?)\s+(?:into\s+|as\s+)?(?:a\s+)?customer$/i)
    || t.match(/^convert\s+(?:lead\s+)?(.+?)(?:\s+to\s+(?:a\s+)?customer)?$/i)
    || t.match(/^(.+?)\s+(?:ko|को)\s+(?:customer|कस्टमर)\s+(?:bana do|banao|bana dijiye|बना दो|बनाओ)$/i)
    || t.match(/^(.+?)\s+(?:bought|has bought|took the policy|bought the policy)[,.]?\s+(?:make|convert)\s+(?:him|her|them|it)\s+(?:a\s+|to\s+a\s+)?customer$/i);
  // "convert ramesh into lead that is won" is about a LEAD, never a customer.
  return m && okWho(m[1]) && !/\b(?:into|lead|won|lost|interested|contacted|new)\b/i.test(m[1]) && m[1].trim().split(/\s+/).length <= 4 ? clean(m[1]) : null;
}

/** "add customer Sunita Rao 98123 45678, Pune" -> parts. Null when it is not that. */
export function parseAddCustomer(textRaw: string): { name: string | null; phone: string | null; city: string | null; email: string | null } | null {
  const t = clean(textRaw);
  const m = t.match(/^(?:please\s+)?(?:add|new|create|save)\s+(?:a\s+)?(?:new\s+)?customer\b[:\s,-]*(.*)$/i)
    || t.match(/^(?:naya|nayi|नया)\s+(?:customer|कस्टमर)\s*(.*)$/i);
  if (!m) return null;
  let rest = m[1].trim();
  const ph = rest.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
  const phone = ph ? ph[0].replace(/\D/g, "").slice(-10) : null;
  if (ph) rest = rest.replace(ph[0], " ");
  const em = rest.match(/[^\s@,]+@[^\s@,]+\.[^\s@,]+/);
  const email = em ? em[0] : null;
  if (em) rest = rest.replace(em[0], " ");
  const cityM = rest.match(/(?:,\s*|\s+from\s+|\s+in\s+|\s+city\s+)([A-Za-z][A-Za-z .]{1,40})\s*$/i);
  const city = cityM ? clean(cityM[1]) : null;
  if (cityM) rest = rest.slice(0, cityM.index);
  const name = rest.replace(/[,]/g, " ").replace(/\s+/g, " ").trim();
  return { name: name.length >= 2 ? name : null, phone, city, email };
}

export type FileAsk =
  | { kind: "file"; policyOf: string | null; customer: string }      // policyOf null = the policy we are on
  | { kind: "newCustomer" }                                          // a customer from this policy's holder
  | { kind: "unfile"; policyOf: string | null };

/** Filing a policy under a customer, or taking it out. */
export function parseFile(textRaw: string): FileAsk | null {
  const t = clean(textRaw);
  // "this" on its own only with file/put + under ("file this under Sunita"); move/add/link need
  // the word policy, so "add this to my renewals" or "move this to next week" never file anything.
  let m = t.match(/^(?:file|put)\s+(?:this\s+(?:policy\s+)?|(.+?)'s\s+(?:\w+\s+){0,3}?polic(?:y|ies)\s+)under\s+(.+?)(?:'s)?(?:\s+(?:customer|profile|name))?$/i)
    || t.match(/^(?:file|put|move|add|link)\s+(?:this\s+policy\s+|(.+?)'s\s+(?:\w+\s+){0,3}?polic(?:y|ies)\s+)(?:under|to|in|with|for)\s+(.+?)(?:'s)?(?:\s+(?:customer|profile|name))?$/i);
  if (m && okWho(m[2]) && (!m[1] || okWho(m[1]))) return { kind: "file", policyOf: m[1] ? clean(m[1]) : null, customer: clean(m[2]) };
  m = t.match(/^(?:this|this policy|it)\s+(?:is|belongs to)\s+(.+?)'s(?:\s+policy)?$/i) || t.match(/^(?:this|this policy)\s+belongs to\s+(.+)$/i)
    || t.match(/^(?:ye|yeh|यह|ये)\s+(.+?)\s+(?:ki|का|की)\s+(?:policy|पॉलिसी)\s+(?:hai|है)$/i);
  if (m && okWho(m[1])) return { kind: "file", policyOf: null, customer: clean(m[1]) };
  if (/^(?:new|make a|create a|add a)\s+customer\s+(?:from|for)\s+(?:this|this policy|the policyholder|this policyholder)$|^(?:is policy se|iss policy se)\s+(?:naya\s+)?customer\s+(?:bana do|banao)$/i.test(t)) return { kind: "newCustomer" };
  m = t.match(/^(?:unfile|un-file)\s+(?:this(?:\s+policy)?|(.+?)'s\s+polic(?:y|ies))$/i)
    || t.match(/^(?:remove|take|move)\s+(?:this(?:\s+policy)?|(.+?)'s\s+polic(?:y|ies))\s+(?:from|out of)\s+.+$/i);
  if (m && (!m[1] || okWho(m[1]))) return { kind: "unfile", policyOf: m[1] ? clean(m[1]) : null };
  return null;
}

/* ── Values, as an advisor types them ───────────────────────────────── */

/** "25k", "1.5 lakh", "₹25,000" -> 25000; null when it is not an amount. */
export function amountWords(s: string): number | null {
  const t = s.toLowerCase().replace(/[₹,\s]/g, "").replace(/rs\.?|rupees?/g, "");
  const m = t.match(/^(\d+(?:\.\d+)?)(k|thousand|l|lac|lakh|lakhs|cr|crore|crores)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = !m[2] ? 1 : /^k|thousand/.test(m[2]) ? 1e3 : /^cr/.test(m[2]) ? 1e7 : 1e5;
  return Math.round(n * mult);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** A past date as typed: "2 May 1970", "02/05/1970", "1970-05-02" -> "1970-05-02". */
export function pastDate(s: string): string | null {
  const t = s.trim().toLowerCase();
  let y: number, mo: number, d: number;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else if ((m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*,?\s+(\d{4})$/)) && MONTHS.includes(m[2])) [d, mo, y] = [+m[1], MONTHS.indexOf(m[2]) + 1, +m[3]];
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || y < 1900 || dt.getTime() > Date.now()) return null;
  return dt.toISOString().slice(0, 10);
}

const SOURCE_WORDS: [RegExp, string][] = [
  [/refer|reference|referred|friend|relative/, "Referral"],
  [/walk/, "Walk-in"],
  [/website|site|google|online/, "Website"],
  [/insta|facebook|social|linkedin|youtube/, "Social media"],
  [/whats\s*app/, "WhatsApp"],
  [/call|phone/, "Phone call"],
  [/other/, "Other"],
];
/** The value to send for a field, as typed -> as the portal stores it. */
export function valueFor(field: Field, raw: string): string | number | null {
  const v = raw.trim();
  if (/^(?:none|remove|clear|blank|empty|nothing|-)$/i.test(v)) return null;
  if (field === "expected_value") return amountWords(v) ?? v;
  if (field === "dob") return pastDate(v) ?? v;
  if (field === "source") return SOURCE_WORDS.find(([re]) => re.test(v.toLowerCase()))?.[1] ?? v;
  if (field === "name") return v.replace(/\b\w/g, (c) => c.toUpperCase());
  return v;
}

/** Plain field names, as the advisor sees them (translated in i18n.ts). */
export const FIELD_LABEL: Record<Field, string> = {
  name: "Name", phone: "Phone", email: "Email", city: "City", source: "Source",
  insurance_interest: "Interested in", expected_value: "Expected premium", dob: "Date of birth",
};
export const LEAD_FIELDS: Field[] = ["name", "phone", "email", "city", "insurance_interest", "source", "expected_value"];
export const CUSTOMER_FIELDS: Field[] = ["name", "phone", "email", "city", "dob"];

/* ── Stage 2b: policies ─────────────────────────────────────────────── */

/** "premium is 14,500 not 15,400", "change Ramesh's car policy premium to 14500", "edit this
 *  policy". `policyOf` null = the policy we are on. `word` is matched to a field later, for
 *  that policy's type (bot.ts), so "cover" means IDV on a car and sum assured on life. */
export type PolicyFixAsk = { policyOf: string | null; typeWord: string | null; word: string | null; value: string | null };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Saved-detail words, longest first. */
const FIX_WORDS = [...new Set(Object.values(POLICY_FIX_FIELDS).flat().flatMap((f) => f.words))].sort((a, b) => b.length - a.length);
/** Client details: only with the word "policy", since "Amit's phone" alone is a lead or customer. */
export const CLIENT_WORDS: [string[], string][] = [
  [["policyholder name", "policy holder name", "policyholder", "policy holder", "holder name", "proposer name", "insured name"], "policyholder_name"],
  [["mobile number", "phone number", "contact number", "whatsapp number", "mobile", "phone"], "client_phone"],
  [["email id", "email address", "email"], "client_email"],
];
const CLIENT_ALT = CLIENT_WORDS.flatMap(([w]) => w).sort((a, b) => b.length - a.length).map(esc).join("|");
const FIX_ALT = FIX_WORDS.map(esc).join("|");
/** Words that only ever mean an amount, a date or a percentage: their value must have a number, so
 *  "cover calculate karna hai" or "premium is too high" is never an edit. */
const NUMBER_WORDS = new Set(FIX_WORDS.filter((w) => Object.values(POLICY_FIX_FIELDS).flat().every((f) => !f.words.includes(w) || f.kind !== "text")));
const TYPE_ALT = "car|bike|two wheeler|motor|vehicle|life|term|travel|home|house|property|fire|marine|health|mediclaim";

export function clientKeyOf(word: string): string | null {
  const w = word.trim().toLowerCase().replace(/\s+/g, " ");
  return CLIENT_WORDS.find(([ws]) => ws.includes(w))?.[1] ?? null;
}

export function parsePolicyFix(textRaw: string): PolicyFixAsk | null {
  // A question is never an edit: "premium is 15,400?", "premium 15000 hai na", "... right".
  if (/\?\s*$/.test(textRaw.trim()) || /\s(?:right|kya|na|naa|correct|sahi)\s*[.!।]*$/i.test(textRaw.trim())) return null;
  const t = clean(textRaw).replace(/[’']/g, "'");
  const IS = `(?:\\s*[:=]\\s*|\\s+(?:is actually|should be|is)\\s+)`;
  const W = `(${FIX_ALT})`;
  const C = `(${CLIENT_ALT})`;
  const TY = `(?:(${TYPE_ALT})\\s+)?`;
  const TO = `\\s+(?:to|as|into|=|:)\\s+(.+)`;
  // The old value after "not" is only the advisor's check: "premium is 14,500 not 15,400".
  const val = (v: string) => clean(v.replace(/,?\s+(?:not|instead of|nahi|नहीं)\s+.*$/i, ""));
  const tries: [RegExp, (m: RegExpMatchArray) => PolicyFixAsk][] = [
    // change Ramesh's (car) (policy) premium to 14500
    [new RegExp(`^(?:please\\s+)?(?:change|update|set|correct|fix|make)\\s+(?:the\\s+)?(?:(.+?)'s\\s+)?${TY}(?:policy\\s+)?${W}${TO}$`, "i"), (m) => ({ policyOf: m[1] ?? null, typeWord: m[2] ?? null, word: m[3], value: val(m[4]) })],
    // change the IDV of this policy / of Ramesh's car policy to ...
    [new RegExp(`^(?:please\\s+)?(?:change|update|set|correct|fix)\\s+(?:the\\s+)?${W}\\s+(?:of|on|for|in)\\s+(?:this\\s+policy|this|(.+?)'s\\s+${TY}policy)${TO}$`, "i"), (m) => ({ policyOf: m[2] ?? null, typeWord: m[3] ?? null, word: m[1], value: val(m[4]) })],
    // Client details need the word policy: change Ramesh's policy phone to ... / this policy's email to ...
    [new RegExp(`^(?:please\\s+)?(?:change|update|set|correct|fix)\\s+(?:the\\s+)?(?:(.+?)'s\\s+|this\\s+)${TY}policy(?:'s)?\\s+${C}${TO}$`, "i"), (m) => ({ policyOf: m[1] ?? null, typeWord: m[2] ?? null, word: m[3], value: val(m[4]) })],
    [new RegExp(`^(?:please\\s+)?(?:change|update|set|correct|fix)\\s+(?:the\\s+)?${C}\\s+(?:of|on|for|in)\\s+(?:this\\s+policy|(.+?)'s\\s+${TY}policy)${TO}$`, "i"), (m) => ({ policyOf: m[2] ?? null, typeWord: m[3] ?? null, word: m[1], value: val(m[4]) })],
    [new RegExp(`^(?:this\\s+)?policy(?:'s)?\\s+${C}\\s+(?:is|should be|=|:)\\s+(.+)$`, "i"), (m) => ({ policyOf: null, typeWord: null, word: m[1], value: val(m[2]) })],
    // About the policy we are on: "premium is 14,500 not 15,400", "the IDV should be 5.2 lakh"
    [new RegExp(`^(?:the\\s+)?(?:policy\\s+)?${W}${IS}(.+)$`, "i"), (m) => ({ policyOf: null, typeWord: null, word: m[1], value: val(m[2]) })],
    // Named: "Ramesh's premium is 15000", "Ramesh's car policy due date is 5 March 2027"
    [new RegExp(`^(.+?)'s\\s+${TY}(?:policy(?:'s)?\\s+)?${W}${IS}(.+)$`, "i"), (m) => ({ policyOf: m[1], typeWord: m[2] ?? null, word: m[3], value: val(m[4]) })],
    // Hinglish, named without "policy": "Sunita ka premium 15000 hai"
    [new RegExp(`^(.+?)\\s+(?:ki|ka|ke|की|का|के)\\s+${W}\\s+(.+?)\\s+(?:kar do|kardo|karo|hai|likh do|likho|कर दो|करो|है)$`, "i"), (m) => ({ policyOf: m[1], typeWord: null, word: m[2], value: val(m[3]) })],
    // Hinglish: premium 14500 hai / Ramesh ki policy ka premium 14500 kar do
    [new RegExp(`^(?:(.+?)\\s+(?:ki|ka|ke|की|का|के)\\s+${TY}(?:policy|पॉलिसी)\\s+(?:ka|ki|ke|का|की|के)\\s+)?${W}\\s+(.+?)\\s+(?:kar do|kardo|karo|hai|likh do|likho|कर दो|करो|है)$`, "i"), (m) => ({ policyOf: m[1] ?? null, typeWord: m[2] ?? null, word: m[3], value: val(m[4]) })],
    // Guided: edit this policy / edit Ramesh's car policy
    [new RegExp(`^(?:edit|correct|fix|change|update)\\s+(?:this\\s+policy|the\\s+policy|(.+?)'s\\s+${TY}policy)(?:'s)?(?:\\s+(?:details|info))?$`, "i"), (m) => ({ policyOf: m[1] ?? null, typeWord: m[2] ?? null, word: null, value: null })],
    [new RegExp(`^(?:(.+?)\\s+(?:ki|ka|की|का)\\s+${TY})?(?:policy|पॉलिसी)\\s+(?:ki\\s+|की\\s+)?(?:details|detail|jankari|jaankari|जानकारी)\\s+(?:badlo|badal do|edit karo|theek karo|बदलो|बदल दो)$`, "i"), (m) => ({ policyOf: m[1] ?? null, typeWord: m[2] ?? null, word: null, value: null })],
  ];
  for (const [re, f] of tries) {
    const m = t.match(re);
    if (!m) continue;
    const a = f(m);
    if (a.policyOf !== null && !okWho(a.policyOf)) continue;
    if (a.value !== null && (!a.value.trim() || QUESTION_VALUE.test(a.value.trim()))) continue;
    // An amount or date word needs a value that reads as one: "cover 1 crore for family of 4" is a question.
    if (a.value !== null && a.word && NUMBER_WORDS.has(a.word.toLowerCase()) && !readsAsNumber(a.value)) continue;
    return { policyOf: a.policyOf === null ? null : clean(a.policyOf), typeWord: a.typeWord?.toLowerCase() ?? null, word: a.word?.toLowerCase() ?? null, value: a.value };
  }
  return null;
}

/** "stop sharing Ramesh's report", "unshare this", "Ramesh ki report band karo". */
export function parseUnshare(textRaw: string): { policyOf: string | null } | null {
  const t = clean(textRaw).replace(/[’']/g, "'");
  const m = t.match(/^(?:please\s+)?(?:stop|turn off|disable|end)\s+sharing(?:\s+(?:of\s+)?(?:(.+?)'s\s+(?:report|policy|link)|this(?:\s+report|\s+policy|\s+link)?|the\s+(?:report|link)|it))?$/i)
    || t.match(/^unshare(?:\s+(?:(.+?)'s\s+(?:report|policy|link)|this(?:\s+report|\s+policy)?|the\s+report|it))?$/i)
    // A name is needed here: "report band karo" alone may mean the morning brief.
    || t.match(/^(.+?)\s+(?:ki|ka|की|का)\s+(?:report|link|रिपोर्ट|लिंक)\s+(?:ka\s+)?(?:share\s+|sharing\s+)?(?:band karo|band kar do|bandh karo|बंद करो|बंद कर दो)$/i)
    || t.match(/^(?:sharing|share)\s+(?:band karo|band kar do|बंद करो)$/i);
  if (!m) return null;
  if (m[1] && !okWho(m[1])) return null;
  return { policyOf: m[1] ? clean(m[1]) : null };
}

/** A date as typed, past or future: "1 March 2027", "01/03/2027", "2027-03-01", "March 1, 2027". */
export function anyDate(s: string): string | null {
  const t = s.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  let y: number, mo: number, d: number;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/))) [d, mo, y] = [+m[1], +m[2], yyyy(m[3])];
  else if ((m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*\s+(\d{4}|\d{2})$/)) && MONTHS.includes(m[2])) [d, mo, y] = [+m[1], MONTHS.indexOf(m[2]) + 1, yyyy(m[3])];
  else if ((m = t.match(/^([a-z]{3})[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4}|\d{2})$/)) && MONTHS.includes(m[1])) [d, mo, y] = [+m[2], MONTHS.indexOf(m[1]) + 1, yyyy(m[3])];
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || y < 1950 || y > 2125) return null;
  return dt.toISOString().slice(0, 10);
}

/** "27" -> 2027 (policy dates are this century); four digits as typed. */
const yyyy = (s: string) => (s.length === 2 ? 2000 + +s : +s);

/** Reads as an amount, a date or a percentage. */
function readsAsNumber(v: string): boolean {
  const s = v.trim();
  return amountWords(s) !== null || anyDate(s) !== null || strictAmount(s) !== null || /^\d+(?:\.\d+)?\s*(?:%|percent)$/i.test(s);
}

/** A policy value as typed -> as the portal stores it. The server checks it again. */
export function policyValueFor(kind: "money" | "percent" | "date" | "text" | "client", raw: string): string | number {
  const v = raw.trim();
  if (kind === "money") return amountWords(v) ?? v;
  if (kind === "percent") { const n = v.replace(/\s*(?:%|percent)$/i, "").trim(); return /^\d+(?:\.\d+)?$/.test(n) ? parseFloat(n) : v; }
  if (kind === "date") return anyDate(v) ?? v;
  return v;
}
