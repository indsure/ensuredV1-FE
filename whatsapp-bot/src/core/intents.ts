/**
 * Intent routing, rules first (brief §6). The model is only asked when no rule matches,
 * and even then it may only pick from this fixed list.
 */

export type Intent =
  | "link" | "unlink" | "cancel" | "help" | "renewals" | "remind" | "share" | "ask" | "unknown"
  | "website" | "lead" | "calc" | "compare" | "clients"
  | "followups" | "draft" | "lookup" | "checks" | "views" | "claims" | "surrender" | "more";

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

export function linkCode(text: string): string | null {
  const m = norm(text).match(/^link\s*[:#-]?\s*(\d{3}\s?\d{3})$/);
  return m ? m[1].replace(/\s/g, "") : null;
}

export function ruleIntent(textRaw: string): Intent | null {
  const t = norm(textRaw);
  if (!t) return null;
  if (linkCode(t)) return "link";
  if (/^unlink$/.test(t)) return "unlink";
  if (/^(more|all commands|everything|full menu|help all|all features|what else)[.!?]*$/.test(t)) return "more";
  // Bare "link" (no code) is the advisor's own website. "LINK 123456" is connecting, above.
  if (/^(link|my link|website|my website|my site|my page|site link|website link|share my (website|page|link))[.!?]*$/.test(t)) return "website";
  if (/^((please\s+)?(enter|add|new|create|save)\s+(a\s+)?(new\s+)?leads?\b|leads?\b(?!s?\s*(list|page)))/.test(t)) return "lead";
  if (/^compare\b/.test(t)) return "compare";
  // Order matters below: a "follow up message for X" is a draft, "follow ups" is the list,
  // "follow up X Friday" is a lead update (handled in bot.ts before intents).
  if (/\b(message|msg|wishes|greeting)\b/.test(t) && !/^share\b/.test(t)) return "draft";
  if (/^(follow[\s-]?ups?|followups|pending follow[\s-]?ups?|today'?s (calls|follow[\s-]?ups?)|calls today|who (do|should) i call( today)?)[?.!]*$/.test(t)) return "followups";
  if (/\b(checks? left|how many checks|my balance|balance|credits? left|policy checks)\b/.test(t)) return "checks";
  if (/\b(views|who (opened|viewed|saw|read)|opened (my|the) reports?|report views)\b/.test(t)) return "views";
  if (/^claims?\b|\bclaim status\b|\bopen claims\b/.test(t)) return "claims";
  if (/\b(surrender|loan value|policy value|paid[\s-]?up value)\b/.test(t)) return "surrender";
  if (/^(find|search|lookup|look up|who is|details (of|for))\s+\S/.test(t) || /^\+?[\d\s-]{10,15}$/.test(t)) return "lookup";
  if (/^(my |all )?(clients?|customers?|policies|book)$/.test(t) ||
      /\b(list|show|all|my)\b.*\b(clients?|customers?|policies|policyholders?)\b/.test(t)) return "clients";
  if (/\b(calculator|calculate|calc|cover calculator)\b/.test(t)) return "calc";
  if (/^(cancel|stop|band karo|rehne do)$/.test(t)) return "cancel";
  if (/^(hi|hello|hey|hii+|namaste|namaskar|help|menu|start|\?)[.!]*$/.test(t)) return "help";
  if (/^remind\b/.test(t)) return "remind";
  if (/\b(renewals?|renew|who'?s due|due this week|expiring|expiry list)\b/.test(t)) return "renewals";
  if (/^share\b|\bsend (it |this |the report )?to (the )?(customer|client)\b|\bshare .*report\b|\bbhej do\b/.test(t)) return "share";
  return null;
}

/** "share Ramesh's report", "Ramesh's policy", "for ramesh kumar" -> "ramesh" / "ramesh kumar". */
export function namedPerson(textRaw: string): string | null {
  const t = norm(textRaw);
  const poss = t.match(/\b([a-z]+(?: [a-z]+)?)'s (policy|report|plan)\b/);
  if (poss) return cleanName(poss[1]);
  const share = t.match(/^share\s+(?:the )?(?:report\s+)?(?:with|for|of)?\s*([a-z]+(?: [a-z]+)?)$/);
  if (share) return cleanName(share[1]);
  const remind = t.match(/^remind\s+([a-z]+(?: [a-z]+)?)(?:\s+(?:in\s+)?(english|hinglish|hindi))?$/);
  if (remind) return cleanName(remind[1]);
  return null;
}

const STOP = new Set([
  "the", "my", "this", "that", "it", "report", "policy", "customer", "client", "english", "hinglish", "hindi", "in",
  "share", "send", "remind", "what", "whats", "is", "about", "check", "show", "open", "for", "of", "with", "and",
]);
function cleanName(s: string): string | null {
  const words = s.split(" ").filter((w) => !STOP.has(w));
  return words.length ? words.join(" ") : null;
}

/** Words that make free text a question ABOUT a policy report. */
const REPORT_TOPIC = /\b(room|rent|co-?pay|sub-?limits?|waiting|ped|pre-?existing|claim|cover(ed|age)?|sum insured|premium|restor|bonus|ncb|cashless|network|maternity|exclu|deductible|score|verdict|gap|risk|works|cataract|icu|ayush|opd|day ?care|hospital|renewal date|expiry)/;
const QUESTION = /\?|^(what|how|does|do|is|are|can|will|why|which|when|kya|kitna|kitni|kaun|any)\b/;

/** Should free text be answered from the current report? Only if it is about a policy
 *  topic, or it is a question asked while the report is still fresh. Everything else is
 *  "I didn't catch that", never "the report doesn't cover that". */
export function isReportQuestion(textRaw: string, reportFresh: boolean): boolean {
  const t = norm(textRaw);
  if (REPORT_TOPIC.test(t)) return true;
  return reportFresh && QUESTION.test(t);
}

export function langIn(textRaw: string): "english" | "hinglish" | "hindi" | null {
  const t = norm(textRaw);
  if (/\bhinglish\b/.test(t)) return "hinglish";
  if (/\bhindi\b|हिंदी/.test(t)) return "hindi";
  if (/\benglish\b/.test(t)) return "english";
  return null;
}

/** A numbered reply "2" or "2)" to a pick list. */
export function pickNumber(textRaw: string, max: number): number | null {
  const m = norm(textRaw).match(/^(\d{1,2})\)?\.?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= max ? n : null;
}

export const isYes = (t: string) => /^(yes|y|haan|ha|han|ok|okay|sure|yes please)[.!]*$/.test(norm(t));
export const isNo = (t: string) => /^(no|n|nahi|nahin|na|nope)[.!]*$/.test(norm(t));
export const isSkip = (t: string) => /^(skip|later|none|leave it|no|na|n\/a|nahi|don'?t have|dont know|not now|pass)[.!]*$/.test(norm(t));

/** Caption on a PDF: "Ramesh Kumar 9812345678" -> name + phone. */
export function parseCaption(textRaw: string): { name: string | null; phone: string | null } {
  const t = String(textRaw || "").trim();
  if (!t) return { name: null, phone: null };
  const digits = t.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
  const phone = digits ? digits[0].replace(/\D/g, "").slice(-10) : null;
  const name = t.replace(digits ? digits[0] : "", "").replace(/[^A-Za-zऀ-ॿ .]/g, " ").replace(/\s+/g, " ").trim();
  return { name: name.length >= 2 ? name.slice(0, 80) : null, phone };
}
