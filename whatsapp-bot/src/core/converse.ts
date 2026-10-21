/**
 * Talking like a person, without a model.
 *
 * Three small, pure steps the bot runs on every typed message before its rules:
 *   rephrase()    everyday ways of asking ("what do we have on Kavita", "which is better, A
 *                 or B", "Ramesh ko renewal yaad dilao") become the command the rules know
 *   withPerson()  "him", "her", "uska", "unka" become the person we were just talking about
 *   suggest()     when nothing matched, the closest commands, offered as a numbered list
 *
 * Nothing here looks anything up or changes data. Every write still goes through the
 * bot's one-tap YES.
 */

import { ruleIntent } from "./intents.js";

const INTEREST: [RegExp, string][] = [
  [/\b(health|mediclaim|medical|hospital)\b/i, "health"],
  [/\b(term)\b/i, "term"],
  [/\b(life|lic)\b/i, "life"],
  [/\b(motor|car|bike|vehicle)\b/i, "motor"],
  [/\b(travel)\b/i, "travel"],
  [/\b(property|home|house|fire)\b/i, "property"],
];
const interestOf = (s: string) => {
  const hit = INTEREST.find(([re]) => re.test(s));
  return hit ? ` ${hit[1]}` : "";
};
const PHONE = String.raw`(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}`;
const END = String.raw`[?.!।]*$`;

/** [pattern, rewrite, force]. A rule without force only applies when the rules don't already
 *  understand the message, so "show me renewals" stays RENEWALS and never becomes a name search. */
type Rule = [RegExp, (m: RegExpMatchArray) => string, true?];

const RULES: Rule[] = [
  // Switching topic: "chhodo, meri follow ups batao", "actually show me renewals"
  [new RegExp(`^(?:actually|leave it|chhodo|chodo|never ?mind|no wait|wait|rehne do|छोड़ो|रहने दो)[,.!]?\\s+(.+)$`, "i"), (m) => rephrase(m[1]), true],

  // Looking someone up
  [new RegExp(`^(?:what|what's|whats|what is)\\s+(?:do\\s+(?:we|i)\\s+have|have\\s+(?:we|i)\\s+got)\\s+(?:on|for|about)\\s+(.+?)${END}`, "i"), (m) => `find ${m[1]}`],
  [new RegExp(`^(?:tell me about|show me|details of|info on|everything on)\\s+(?!my\\b|all\\b|the\\b)(.+?)${END}`, "i"), (m) => `find ${m[1]}`],
  [new RegExp(`^(?:what'?s\\s+|what is\\s+|give me\\s+|send me\\s+)?(.+?)'s\\s+(?:number|phone|mobile|contact)(?:\\s+number)?${END}`, "i"), (m) => `find ${m[1]}`],
  [new RegExp(`^(.+?)\\s+(?:ka|ki|ke)\\s+(?:number|phone|mobile|contact)(?:\\s+number)?(?:\\s+(?:kya hai|kya h|batao|bhejo|do|dikhao))?${END}`, "i"), (m) => `find ${m[1]}`],

  // Sharing
  [new RegExp(`^(?:send|forward|share)\\s+(?:it|this|that|the report|this report|the calculator|the comparison)\\s+to\\s+(?:him|her|them|the customer|the client|customer|client)${END}`, "i"), () => "share"],
  [new RegExp(`^(?:send|forward)\\s+(?!the\\b|my\\b|a\\b|it\\b)(.+?)\\s+(?:his|her|their)\\s+(?:report|policy report|policy)${END}`, "i"), (m) => `share ${m[1]}`],

  // Drafts: "send a premium due reminder to Ramesh", "thank you note for Pooja"
  [new RegExp(`^(?:send\\s+)?(?:a\\s+|an\\s+)?(premium due|premium|renewal|thank you|thanks|follow[\\s-]?up|review|upgrade|birthday|anniversary|diwali|holi)\\s+(?:reminder|note|wish(?:es)?)\\s+(?:to|for)\\s+(.+?)${END}`, "i"), (m) => `${m[1].replace(/^thanks$/i, "thank you")} message for ${m[2]}`, true],
  [new RegExp(`^(.+?)\\s+(?:ko)\\s+(renewal|premium)\\s+(?:ki\\s+)?(?:yaad dilao|yaad dila do|remind karo|remind kar do)${END}`, "i"), (m) => `${m[2]} message for ${m[1]}`, true],

  // Comparing plans
  [new RegExp(`^(?:which is better|which one is better|what'?s better|which is best)[,:]?\\s+(.+?)\\s+(?:or|vs\\.?|versus)\\s+(.+?)${END}`, "i"), (m) => `compare ${m[1]} vs ${m[2]}`],
  [new RegExp(`^(.+?)\\s+(?:aur|and|vs\\.?)\\s+(.+?)\\s+(?:compare|ka comparison|ki tulna)(?:\\s+(?:karo|kar do|karke batao|batao))?${END}`, "i"), (m) => `compare ${m[1]} vs ${m[2]}`],

  // Cover calculator
  [/^how much (?:health )?cover\b|^(?:kitna|kitni) cover\b/i, () => "calculator"],

  // Claims: "any queries on Meena's claim"
  [new RegExp(`^(?:any\\s+)?(?:queries|query|status|update|news)\\s+(?:on|of|for|about)\\s+(.+?)(?:'s)?\\s+claim${END}`, "i"), (m) => `claims ${m[1]}`],

  // One claim: "where is Sunita's claim", "Sunita ka claim kahan tak", "what's pending for Sunita"
  [new RegExp(`^(?:where is|where'?s|status of|what'?s the status of)\\s+(.+?)'s\\s+claim${END}`, "i"), (m) => `claims ${m[1]}`, true],
  [new RegExp(`^(.+?)\\s+(?:ka|ki)\\s+claim\\b.*$`, "i"), (m) => `claims ${m[1]}`, true],
  [new RegExp(`^what'?s\\s+(?:pending|missing|left)\\s+(?:for|in|on)\\s+(.+?)(?:'s claim)?${END}`, "i"), (m) => `claims ${m[1]}`],

  // Who opened a report
  [new RegExp(`^(?:did|has)\\s+.+?\\s+(?:open|opened|see|seen|read|view|viewed)\\s+(?:the\\s+|his\\s+|her\\s+|my\\s+)?report${END}`, "i"), () => "views"],

  // Surrender value
  [new RegExp(`^how much will (.+?) get if (?:he|she|they) surrenders?\\b.*$`, "i"), (m) => `surrender value for ${m[1]}`],
  [new RegExp(`^(.+?)\\s+(?:ka|ki|ke)\\s+(?:surrender value|surrender|loan value|policy value)\\b.*$`, "i"), (m) => `surrender value for ${m[1]}`, true],

  // Adding a lead: "add Pooja as a lead, she wants health cover", "Rohit 98761 23450 wants term, add him"
  [/^add\s+(.+?)\s+as\s+(?:a\s+)?(?:new\s+)?lead\b[,.]?\s*(.*)$/i, (m) => `lead ${m[1]}${interestOf(m[2])}`],
  [new RegExp(`^(.+?)\\s+(${PHONE})\\b(.*?)[,.]?\\s*(?:add (?:him|her|them)(?: as (?:a )?lead)?|lead bana(?:o| do)|lead mein (?:daalo|jodo))${END}`, "i"), (m) => `lead ${m[1]} ${m[2]}${interestOf(m[3])}`],
  [new RegExp(`^(.+?)\\s+(?:को|ko)\\s+(?:लीड|lead)\\s+(?:में|mein|me)\\s+(?:जोड़ो|जोड़ें|jodo|daalo|डालो)\\s*(.*)$`, "i"), (m) => {
    // Only the phone and the kind of cover come from the rest; other words never join the name.
    const phone = m[2].match(new RegExp(PHONE));
    return `lead ${m[1]}${phone ? ` ${phone[0]}` : ""}${interestOf(m[2])}`;
  }],

  // Lead updates the rules then read: "spoke to Rohit today", "set Neha's follow-up for friday"
  [new RegExp(`^(?:spoke|talked|spoken)\\s+(?:to|with)\\s+(.+?)(?:\\s+(?:today|just now|now))?${END}`, "i"), (m) => `${m[1]} contacted`],
  [new RegExp(`^set\\s+(.+?)'s\\s+follow[\\s-]?up\\s+(?:for|on|to)\\s+(.+?)${END}`, "i"), (m) => `follow up ${m[1]} ${m[2]}`],
  [new RegExp(`^((?:call|follow[\\s-]?up|call back)\\s+.+?)\\s+(?:morning|evening|afternoon|night|subah|shaam)${END}`, "i"), (m) => m[1]],

  // Undo, said the way people say it
  [/^(?:galti se[^,]*,?\s*)?(?:wapas karo|wapas kar do|undo karo|undo it)[.!।]*$/i, () => "undo"],
  [/^(?:that was a mistake|my mistake|wrong one),?\s*(?:undo|undo it|go back)?[.!]*$/i, () => "undo"],
];

/** The command the rules know for an everyday phrasing, or the text unchanged. */
export function rephrase(textRaw: string): string {
  const t = textRaw.trim();
  const known = !!ruleIntent(t);
  for (const [re, to, force] of RULES) {
    if (known && !force) continue;
    const m = t.match(re);
    if (m) return to(m).replace(/\s+/g, " ").trim();
  }
  return t;
}

/* ── He, she, uska: the person we were just talking about ─────────────── */

/** Words that say "the person we were talking about". */
// "use" is left out on purpose: in English it is a verb ("use this plan").
export const PERSON_WORD = /\b(he|she|him|her|his|hers|he's|she's|uska|uski|uske|unka|unki|unke|usko|unko|unhe|usne|unhone|unhonne)\b|उसका|उसकी|उसके|उनका|उनकी|उनके|उसको|उनको|उसे|उन्हें|उसने|उन्होंने/i;

/** Words that name someone in the message itself: then a pronoun is about THAT person. */
const NAMED_HERE = /(?:^|[\s,])(?!(?:He|She|Him|Her|His|They|I|Hi|Ok|Okay|Haan|Yes|No|Also|Mark|Call|Send|Share|Add|Find|Please|Pls|What|Whats|Who|Why|How|When|Did|Does|Do|Is|Has|Can|The|Note|Follow|Set|Tomorrow|Today|Kal|Aaj|Parso|Uska|Uski|Unka|Unki|Usko|Unko|Usne|Unhone|Remind|Update|Change|Show|Tell|Give)\b)[A-Z][a-z]{2,}|\b(?!(?:premium|policy|report|plan|claim|renewal|cover|number|phone|lead|follow|call|abhi|bas|aaj|kal)\b)\w{3,}\s+(?:ko|ka|ki|ke|ne)\b(?!\s+(?:lead|policy|report|plan)\b)|[ऀ-ॿ]{2,}\s+(?:को|का|की|के|ने)\s/;

/** "her" is possessive before a policy word ("her room rent"), an object otherwise ("call her"). */
const HER_POSS = /^(report|policy|plan|room|co-?pay|copay|waiting|cover|premium|claim|renewal|sum|ncb|bonus|follow[\s-]?up|number|phone|details?|lead|maternity|deductible|score|sub-?limits?)\b/i;

/**
 * Puts the last person's name where a pronoun stands. Returns null when the message has
 * no such word. "add a note: ..." becomes "note <person>: ...".
 */
export function withPerson(textRaw: string, person: string | null): string | null {
  const t = textRaw.trim();
  if (!person) return null;
  const note = t.match(/^(?:add\s+)?(?:a\s+)?note\s*:\s*(.+)$/i);
  if (note) return `note ${person}: ${note[1]}`;
  if (!PERSON_WORD.test(t)) return null;
  // "Sunita, she said no" / "Rohit ko lead mein jodo, unhe health chahiye": the pronoun is
  // about the person named right there, not the one from before. Same when the first clause
  // has no pronoun and names nobody we know: leave the message as typed.
  const firstClause = t.split(",")[0];
  // Phone keyboards capitalise the first word ("Abhi usko call karo"), so its capital letter
  // says nothing about a name.
  const probe = t.replace(new RegExp(PERSON_WORD.source, "gi"), " ").replace(/^\s*\S+/, (w) => w.toLowerCase());
  if (NAMED_HERE.test(probe) || (t.includes(",") && !PERSON_WORD.test(firstClause))) return null;
  const P = person;
  let out = t
    .replace(/\b(he|she)'s\b/gi, `${P} is`)
    .replace(/\b(his|hers)\b/gi, `${P}'s`)
    .replace(/\bher\b(\s+)(\S+)/gi, (_m, sp: string, next: string) => (HER_POSS.test(next) ? `${P}'s${sp}${next}` : `${P}${sp}${next}`))
    .replace(/\b(him|her|he|she)\b/gi, P)
    .replace(/\bu[sn]k([aie])\b/gi, (_m, v: string) => `${P} k${v.toLowerCase()}`)
    .replace(/\b(usko|unko|unhe)\b/gi, `${P} ko`)
    .replace(/\b(usne|unhone|unhonne)\b/gi, `${P} ne`)
    .replace(/(उसने|उन्होंने)/g, `${P} ने`)
    .replace(/(उसका|उनका)/g, `${P} का`).replace(/(उसकी|उनकी)/g, `${P} की`).replace(/(उसके|उनके)/g, `${P} के`)
    .replace(/(उसको|उनको|उसे|उन्हें)/g, `${P} को`);
  // "mark Ramesh Kumar's lead won" reads better without the possessive
  out = out.replace(new RegExp(`${escapeRe(P)}'s lead\\b`, "g"), P);
  return out === t ? null : out;
}
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A lead name that is really a pronoun ("call him next week" with nobody in mind). */
export const isPronounName = (name: string) =>
  /^(he|she|him|her|his|them|they|uska|uski|uske|unka|unki|unke|usko|unko|use|unhe|usne|unhone|unhonne|उसने|उन्होंने|उसका|उसकी|उसके|उनका|उनकी|उनके|उसको|उनको|उसे|उन्हें)$/i.test(name.trim());

/* ── Did you mean ...? ────────────────────────────────────────────────── */

export type Suggestion = { label: string; command: string };

const VOCAB: { words: string[]; s: Suggestion }[] = [
  { words: ["renewal", "renewals", "renew", "expiry", "expiring", "due"], s: { label: "Renewals due", command: "renewals" } },
  { words: ["followup", "followups", "follow", "call", "calls", "callback"], s: { label: "Today's follow-ups", command: "follow ups" } },
  { words: ["lead", "leads", "prospect", "prospects"], s: { label: "Your leads", command: "show my leads" } },
  { words: ["calculator", "calculate", "cover"], s: { label: "Cover calculator", command: "calculator" } },
  { words: ["compare", "comparison", "better"], s: { label: "Compare two plans", command: "compare" } },
  { words: ["claim", "claims"], s: { label: "Claims", command: "claims" } },
  { words: ["client", "clients", "customer", "customers", "policies", "book"], s: { label: "Your policies", command: "my clients" } },
  { words: ["website", "site", "page", "link"], s: { label: "Your website link", command: "website" } },
  { words: ["checks", "balance", "credit", "credits", "left"], s: { label: "Policy checks left", command: "checks" } },
  { words: ["share", "send", "bhejo", "forward"], s: { label: "Share a report with a customer", command: "share" } },
  { words: ["message", "draft", "wishes", "greeting", "birthday", "diwali"], s: { label: "Write a message for a customer", command: "draft a message" } },
  { words: ["surrender"], s: { label: "Surrender value (life policies)", command: "surrender value" } },
  { words: ["opened", "views", "viewed"], s: { label: "Who opened their report", command: "views" } },
];

/** Edit distance, capped: enough to catch "renwals", "folow up", "calcultor". */
export function closeWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  const max = b.length >= 8 ? 2 : 1;
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...cur) > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

export function wordsOf(textRaw: string): string[] {
  return textRaw.toLowerCase().replace(/follow[\s-]+ups?/g, "followup").split(/[^a-z]+/).filter(Boolean);
}

/** Commands the message is probably reaching for, best first, at most three. */
export function suggest(textRaw: string): Suggestion[] {
  const ws = wordsOf(textRaw);
  const out: Suggestion[] = [];
  for (const v of VOCAB) {
    if (ws.some((w) => v.words.some((x) => closeWord(w, x))) && !out.includes(v.s)) out.push(v.s);
  }
  return out.slice(0, 3);
}

/** Words that might be a customer's name: not a command word, not filler. */
const FILLER = new Set([
  "the", "and", "for", "with", "what", "whats", "about", "please", "pls", "can", "you", "show", "tell", "send", "give", "this", "that",
  "his", "her", "him", "she", "they", "them", "how", "much", "when", "where", "who", "why", "which", "any", "some", "have", "has",
  "did", "does", "will", "would", "should", "could", "today", "tomorrow", "kal", "aaj", "kya", "hai", "karo", "batao", "dikhao", "bhai",
  "ji", "sir", "madam", "mera", "meri", "mere", "uska", "uski", "unka", "policy", "report", "plan", "insurance", "new", "old", "all",
  "my", "me", "hi", "hello", "thanks", "okay", "yes", "no", "not", "nahi", "haan", "know", "want", "need", "like", "get", "got",
]);
export function nameCandidates(textRaw: string): string[] {
  const vocab = new Set(VOCAB.flatMap((v) => v.words));
  return [...new Set(textRaw.split(/[^A-Za-z]+/).filter((w) => w.length >= 3 && !FILLER.has(w.toLowerCase()) && !vocab.has(w.toLowerCase())))]
    .sort((a, b) => Number(/^[A-Z]/.test(b)) - Number(/^[A-Z]/.test(a)))
    .slice(0, 1);
}

/** The "did you mean" reply. Lines are fixed so they translate (i18n.ts). */
export function suggestReply(options: Suggestion[]): string {
  return [
    "I'm not sure I got that. Did you mean:",
    ...options.map((o, i) => `${i + 1}) ${o.label}`),
    "Reply with the number, or type HELP to see everything.",
  ].join("\n");
}

/** True when one word is the other with exactly one letter left out ("rmesh" / "ramesh"). */
export function oneLetterMissing(a: string, b: string): boolean {
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  if (l.length - s.length !== 1) return false;
  // A letter added at the end is often a different name: Ankit / Ankita, Harsh / Harsha.
  if (l.slice(0, -1) === s) return false;
  for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === s) return true;
  return false;
}

/** "chhodo, ...", "actually ...": the advisor is changing the subject on purpose. */
export const SWITCH_TOPIC = /^(?:actually|leave it|chhodo|chodo|never ?mind|no wait|wait|rehne do|छोड़ो|रहने दो)[,.!]?\s+\S/i;
