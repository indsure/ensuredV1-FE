/**
 * Intent routing, rules first (brief §6). The model is only asked when no rule matches,
 * and even then it may only pick from this fixed list.
 */

import { devanagariToLatin } from "./i18n.js";

export type Intent =
  | "link" | "unlink" | "cancel" | "help" | "renewals" | "remind" | "share" | "ask" | "unknown"
  | "website" | "lead" | "calc" | "compare" | "clients"
  | "followups" | "draft" | "lookup" | "checks" | "views" | "claims" | "surrender" | "more"
  | "balance" | "today" | "morning_off" | "morning_on" | "leadlist"
  // Stage 1: read-only views of the book
  | "queue" | "status" | "book" | "portfolio" | "values" | "insights" | "pagestats";

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

export function linkCode(text: string): string | null {
  const m = norm(text).match(/^link\s*[:#-]?\s*(\d{3}\s?\d{3})$/);
  return m ? m[1].replace(/\s/g, "") : null;
}

/** Everyday Hindi and Hinglish ways of asking for the same commands. */
function hindiIntent(t: string): Intent | null {
  const end = "[?.!।]*$";
  if (new RegExp(`^(aaj\\s+)?(kisko|kise|kis ko)\\s+(call|phone)(\\s+(karna|karu|karun|karoon|karni))?(\\s+(hai|h))?${end}`).test(t)) return "followups";
  if (new RegExp(`^(आज\\s+)?(किसे|किसको|किस को)\\s+(कॉल|फ़ोन|फोन)(\\s+(करना|करूँ|करूं))?(\\s+है)?${end}`).test(t)) return "followups";
  if (new RegExp(`^(aaj ke|आज के)\\s+(calls?|follow[\\s-]?ups?|कॉल|फॉलो[\\s-]?अप)${end}`).test(t)) return "followups";
  if (new RegExp(`^((meri|mere|my|मेरी|मेरे)\\s+)?(follow[\\s-]?ups?|फॉलो[\\s-]?अप)\\s+(dikhao|batao|दिखाओ|बताओ)${end}`).test(t)) return "followups";
  if (/रिन्यूअल|नवीनीकरण/.test(t)) return "renewals";
  if (new RegExp(`^(madad|help karo|kya kya kar sakte ho|kya kar sakte ho|aap kya karte ho|मदद|हेल्प|क्या कर सकते हो|क्या क्या कर सकते हो)${end}`).test(t)) return "help";
  if (new RegExp(`^(mere|meri|sab|saare|sare|मेरे|सारे|सब)\\s+(clients?|customers?|policies|policy|क्लाइंट्स|क्लाइंट|कस्टमर्स|कस्टमर|ग्राहकों|ग्राहक|पॉलिसियाँ|पॉलिसी)(\\s+(dikhao|batao|दिखाओ|बताओ))?${end}`).test(t)) return "clients";
  if (new RegExp(`^(aaj ka kaam|aaj kya karna hai|aaj ka to-?do|आज का काम|आज क्या करना है)${end}`).test(t)) return "today";
  if (new RegExp(`^((mera |मेरा )?(balance|बैलेंस)( kitna hai| कितना है)?|kitne (checks|replies|jawab) bache( hain)?|कितने (चेक|जवाब) बचे( हैं)?)${end}`).test(t)) return "balance";
  if (/कैलकुलेटर|kitna cover chahiye|कितना कवर चाहिए/.test(t)) return "calc";
  if (/^(naya|nayi|नया|नई)\s+(lead|लीड)\b|^(lead|लीड)\s+(jodo|add karo|जोड़ो|जोड़ें)/.test(t)) return "lead";
  if (/\bclaim\s+(ka\s+)?(status|kya hua|kahan tak)|क्लेम/.test(t)) return "claims";
  if (/\b(kisne|kis ne)\s+(report\s+)?(dekhi|kholi|dekha|khola)|किसने\s+(रिपोर्ट\s+)?(देखी|खोली)/.test(t)) return "views";
  if (new RegExp(`^(chhodo|chodo|rehne do|cancel karo|band karo|रहने दो|छोड़ो|बंद करो|कैंसल)${end}`).test(t)) return "cancel";
  if (new RegExp(`^(subah ka (message|brief) band karo|सुबह का मैसेज बंद करो)${end}`).test(t)) return "morning_off";
  if (new RegExp(`^(subah ka (message|brief) (chalu|shuru) karo|सुबह का मैसेज (चालू|शुरू) करो)${end}`).test(t)) return "morning_on";
  return null;
}

export function ruleIntent(textRaw: string): Intent | null {
  const t = norm(textRaw);
  if (!t) return null;
  if (linkCode(t)) return "link";
  // "note on Vikram: renewal in March" is a note, whatever words it contains.
  if (/^(?:add\s+)?(?:a\s+)?note\s+(?:for\s+|on\s+)?[^:]{2,40}:/.test(t)) return null;
  if (/^unlink$/.test(t)) return "unlink";
  const hindi = hindiIntent(t);
  if (hindi) return hindi;
  if (/^(more|all commands|everything|full menu|help all|all features|what else)[.!?]*$/.test(t)) return "more";
  const stage1 = bookIntent(t);
  if (stage1) return stage1;
  if (/^(?:(?:show|list|see|view)(?: me)?\s+(?:my |all (?:my )?)?|(?:my|all) )leads?(?: list)?[?.!]*$|^leads? list[?.!]*$|^(?:mere|meri|sab|saare|sare)\s+leads?(?:\s+(?:dikhao|batao))?[?.!]*$|^(?:मेरी|मेरे|सारी)\s+(?:लीड|लीड्स)(?:\s+(?:दिखाओ|बताओ))?[?.!।]*$/.test(t)) return "leadlist";
  if (/^(?:(?:send|share|give)(?: me)?|what'?s|whats|what is|where is)\s+(?:my|the)\s+(?:website|site|page|web page)(?:\s+link)?[?.!]*$|^(?:mera|meri)\s+(?:website|site|page)(?:\s+(?:ka\s+)?link)?(?:\s+(?:bhejo|do|dikhao|batao|kya hai))?[?.!]*$/.test(t)) return "website";
  // Bare "link" (no code) is the advisor's own website. "LINK 123456" is connecting, above.
  if (/^(link|my link|website|my website|my site|my page|site link|website link|share my (website|page|link))[.!?]*$/.test(t)) return "website";
  if (/^((please\s+)?(enter|add|new|create|save)\s+(a\s+)?(new\s+)?leads?\b|leads?\b(?!s?\s*(list|page)))/.test(t)) return "lead";
  if (/^compare\b/.test(t)) return "compare";
  // Order matters below: a "follow up message for X" is a draft, "follow ups" is the list,
  // "follow up X Friday" is a lead update (handled in bot.ts before intents).
  if ((/\b(message|msg|wishes|greeting)\b/.test(t) || /^wish\s/.test(t) || /\b(birthday|anniversary)\s+(wish|message|msg)\b|जन्मदिन|सालगिरह/.test(t)) && !/^share\b/.test(t)) return "draft";
  if (/^(follow[\s-]?ups?|followups|pending follow[\s-]?ups?|today'?s (calls|follow[\s-]?ups?)|calls today|who (do|should) i call( today)?)[?.!]*$/.test(t)) return "followups";
  if (/^((my |check )?balance|sach( assistant)?|smart replies( left)?|how many replies( left)?)[?.!]*$/.test(t)) return "balance";
  if (/^(today|my day|to[\s-]?do|my to[\s-]?do|brief|morning brief|aaj ka kaam)[?.!]*$/.test(t)) return "today";
  if (/^(morning off|stop morning( brief)?|no morning( brief)?|morning brief off)[.!]*$/.test(t)) return "morning_off";
  if (/^(morning on|start morning( brief)?|morning brief on)[.!]*$/.test(t)) return "morning_on";
  if (/^checks?[?.!]*$/.test(t) || /\b(checks? left|how many checks|credits? left|policy checks)\b/.test(t)) return "checks";
  if (/\b(views|who (opened|viewed|saw|read)|opened (my|the) reports?|report views)\b/.test(t)) return "views";
  if (/^claims?\b|\bclaim status\b|\bopen claims\b/.test(t)) return "claims";
  if (/\b(surrender|loan value|policy value|paid[\s-]?up value)\b/.test(t)) return "surrender";
  if (/^(find|search|lookup|look up|who is|details (of|for))\s+\S/.test(t) || /^\+?[\d\s-]{10,15}$/.test(t)) return "lookup";
  if (/^(my |all )?(clients?|customers?|policies|book)$/.test(t) ||
      /\b(list|show|all|my)\b.*\b(clients?|customers?|policies|policyholders?)\b/.test(t)) return "clients";
  if (/\b(calculator|calculate|calc|cover calculator)\b/.test(t)) return "calc";
  if (/^(cancel|stop|band karo|rehne do|never ?mind|leave it|forget it|chhodo|chodo)[.!]*$/.test(t)) return "cancel";
  if (/^(hi+|hello+|hey+|helo|namaste|namaskar|namaskaar|ram ram|good (morning|afternoon|evening)|gm|help|menu|start|\?)(\s+(ji|sir|madam|bhai|there|team))?[.!🙏 ]*$/u.test(t)) return "help";
  if (/^(what can you do|what do you do|what all can you do|how do i use (this|you)|how does this work)[?.!]*$/.test(t)) return "help";
  if (/^(नमस्ते|नमस्कार|राम राम)(\s+जी)?[.!।🙏 ]*$/u.test(t)) return "help";
  if (/^remind\b(?! me\b)/.test(t)) return "remind";
  if (/\b(renewals?|renew|renewing|who'?s due|due this week|expiring|expiry list)\b/.test(t)) return "renewals";
  if (/^share\b|\bsend (it |this |the report )?to (the )?(customer|client)\b|\bshare .*report\b|\bbhej do\b/.test(t)) return "share";
  return null;
}

/** "share Ramesh's report", "Ramesh's policy", "for ramesh kumar" -> "ramesh" / "ramesh kumar". */
export function namedPerson(textRaw: string): string | null {
  const t = norm(textRaw);
  const poss = t.match(/\b([a-z]+(?: [a-z]+)?)'s (policy|report|plan)\b/);
  if (poss) return cleanName(poss[1]);
  // "what is Ramesh's NCB?": a possessive on a policy topic names whose policy.
  const possTopic = REPORT_TOPIC.test(t) && t.match(/\b([a-z]+(?: [a-z]+)?)'s\b/);
  if (possTopic) {
    const n = cleanName(possTopic[1]);
    if (n) return n;
  }
  // "Palash ki policy", "Palash ka plan", "पलाश की पॉलिसी" (Hindi names are matched as spoken)
  const hi = t.match(/^([a-z]+(?: [a-z]+)?) (?:ki|ka|ke) (policy|report|plan)\b/) || t.match(/^([ऀ-ॿ]+(?: [ऀ-ॿ]+)?) (?:की|का|के) (?:पॉलिसी|रिपोर्ट|प्लान)/);
  if (hi) return cleanName(/[ऀ-ॿ]/.test(hi[1]) ? devanagariToLatin(hi[1]) : hi[1]);
  const share = t.match(/^share\s+(?:the )?(?:report\s+)?(?:with|for|of)?\s*([a-z]+(?: [a-z]+)?)$/);
  if (share) return cleanName(share[1]);
  const remind = t.match(/^remind\s+([a-z]+(?: [a-z]+)?)(?:\s+(?:in\s+)?(english|hinglish|hindi))?$/);
  if (remind) return cleanName(remind[1]);
  // "details Ramesh", "Ramesh details", "Ramesh policy", "Ramesh car policy kab khatam"
  const det = t.match(/^(?:policy )?details? ([a-z]+(?: [a-z]+)?)[?.!]*$/) || t.match(/^([a-z]+(?: [a-z]+)?) (?:policy )?details?[?.!]*$/);
  if (det) return cleanName(det[1]);
  const pol = t.match(/^([a-z]+(?: [a-z]+)?) (?:(?:car|bike|motor|vehicle|life|term|health) )?(?:policy|plan)\b/);
  if (pol) return cleanName(pol[1]);
  return null;
}

const STOP = new Set([
  "the", "my", "this", "that", "it", "report", "policy", "customer", "client", "english", "hinglish", "hindi", "in",
  "share", "send", "remind", "what", "whats", "is", "about", "check", "show", "open", "for", "of", "with", "and",
  // Plan kinds and question words, so "term policy" or "which plan" is never read as a name.
  "car", "bike", "motor", "vehicle", "life", "term", "health", "travel", "mediclaim", "new", "old", "next", "last",
  "which", "whose", "who", "any", "a", "an", "plan", "details", "detail", "kya", "kaunsi", "konsi", "upload", "renew",
  "batao", "bata", "dikhao", "dikha", "bhejo", "please", "pls", "do", "hai", "kab", "khatam",
  "let", "he", "she", "there", "here", "today", "today's",
]);
function cleanName(s: string): string | null {
  const words = s.split(" ").filter((w) => !STOP.has(w));
  return words.length ? words.join(" ") : null;
}

/** Words that make free text a question ABOUT a policy report. */
const REPORT_TOPIC = /\b(room|rent|co-?pay|sub-?limits?|waiting|ped|pre-?existing|claim|cover(ed|age)?|sum insured|premium|restor|bonus|ncb|cashless|network|maternity|exclu|deductible|score|verdict|gap|risk|works|cataract|icu|ayush|opd|day ?care|hospital|renewal date|expiry|details?|idv|sum assured|maturity|khatam|kab tak|jaa?nkari)/;
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
  // "6", "6)", "number 6", "no. 6", "option 6", "#6", "6th", "6 number", "6 wala", "६"
  const t = norm(textRaw).replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)));
  const m = t.match(/^(?:(?:number|num|no\.?|option|opt|#|नंबर)\s*)?(\d{1,2})(?:st|nd|rd|th)?\)?\.?(?:\s*(?:number|no|wala|vala|वाला|नंबर))?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= max ? n : null;
}

export const isYes = (t: string) => /^(yes|y|haan|ha|han|ok|okay|sure|yes please|haan ji|ji haan|ha ji|theek hai|thik hai|kar do|हाँ|हां|हाँ जी|जी हाँ|ठीक है|कर दो)[.!।]*$/.test(norm(t));
export const isNo = (t: string) => /^(no|n|nahi|nahin|na|nope|nahi ji|mat karo|नहीं|ना|मत करो|नहीं चाहिए)[.!।]*$/.test(norm(t));
/** "Check this one by itself / separately", for the super top-up question. */
export const isAlone = (t: string) =>
  /^(alone|only this( one)?|just this( one)?|this one only|by itself|separate(ly)?|sirf (ye|yeh|yahi|isko|ise)|akele|akela|alag( alag)?|alag se|सिर्फ (यह|ये|यही|इसे)|अकेले|अलग( अलग)?|अलग से)[.!।]*$/.test(norm(t));

/** "1+2", "1 and 2", "1, 2", "1 2": two different numbers from 1..max, in the order given. */
export function parsePair(t: string, max: number): [number, number] | null {
  const m = norm(t).match(/^(\d{1,2})\s*(?:\+|,|&|and|aur|or|\s)\s*(\d{1,2})[.!]*$/);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  if (a === b || a < 1 || b < 1 || a > max || b > max) return null;
  return [a, b];
}

export const isSkip =(t: string) => /^(skip|later|none|leave it|no|na|n\/a|nahi|don'?t have|dont know|not now|pass)[.!]*$/.test(norm(t));

/** Caption on a PDF: "Ramesh Kumar 9812345678" -> name + phone. */
export function parseCaption(textRaw: string): { name: string | null; phone: string | null } {
  const t = String(textRaw || "").trim();
  if (!t) return { name: null, phone: null };
  const digits = t.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
  const phone = digits ? digits[0].replace(/\D/g, "").slice(-10) : null;
  const name = t.replace(digits ? digits[0] : "", "").replace(/[^A-Za-zऀ-ॿ .]/g, " ").replace(/\s+/g, " ").trim();
  return { name: name.length >= 2 ? name.slice(0, 80) : null, phone };
}

/* ── Stage 1: read-only views of the book ────────────────────────────── */

const END = "[?.!।]*$";

/** Words that are never a customer's name in these questions ("is my policy done?",
 *  "how is my portfolio"). The name search is a loose ILIKE, so "my" would match "Ramya". */
const NOT_A_PERSON = /^(?:my|all|the|this|that|it|his|her|their|our|your|a|an|mera|meri|mere)$|\bmy$|^(?:how|what|my|all|the|mere|meri)\b/;

/** "is Ramesh's policy done?", "Ramesh ki policy ho gayi?" -> "ramesh". */
export function statusName(textRaw: string): string | null {
  const t = norm(textRaw);
  const m = t.match(new RegExp(`^(?:is|has)\\s+(.+?)(?:'s)?\\s+(?:policy|report|check|pdf)\\s+(?:done|ready|finished|complete|completed|checked)(?:\\s+yet)?${END}`))
    || t.match(new RegExp(`^(.+?)\\s+(?:ki|ka|के|की|का)\\s+(?:policy|report|पॉलिसी|रिपोर्ट)\\s+(?:ho gayi|ho gaya|ready hai|ban gayi|bani|aa gayi|हो गई|तैयार है)${END}`));
  const name = m ? m[1].trim() : null;
  return name && !NOT_A_PERSON.test(name) ? name : null;
}

/** "which policies should switch?", "lowest scores", "healthy policies". */
export function bookAsk(textRaw: string): { view: "all" | "switch" | "healthy"; sort: "expiry" | "score" } | null {
  // Whole-message patterns only: "Ramesh wants to switch to Niva" is about a lead, not a list.
  const t = norm(textRaw).replace(/[?.!।]+$/, "");
  if (/^(?:which|what|show(?: me)?|list|any)?\s*(?:of\s+)?(?:my\s+)?(?:health\s+)?(?:policies|policy)?\s*(?:that\s+|which\s+)?(?:should|need(?:s)?\s+to|must|to)\s+(?:be\s+)?switch(?:ed)?$/.test(t)
    || /^(?:show\s+(?:me\s+)?|list\s+)?(?:my\s+)?(?:weak|bad)\s+(?:health\s+)?policies$/.test(t)
    || /^(?:kaun\s*si|konsi|kaunsi)\s+polic(?:y|ies)\s+(?:switch|badalni)\s*(?:karni|chahiye)?(?:\s+(?:hai|hain|chahiye))?$/.test(t)
    || /^(?:kamzor|कमज़ोर|कमजोर)\s+(?:policies|policy|पॉलिसी|पॉलिसियाँ)$/.test(t)) return { view: "switch", sort: "score" };
  if (/^(?:show\s+(?:me\s+)?|list\s+)?(?:my\s+)?(?:healthy|good|strong)\s+policies$|^which\s+policies\s+are\s+(?:healthy|good|strong)$|^अच्छी\s+(?:पॉलिसी|पॉलिसियाँ)$/.test(t)) return { view: "healthy", sort: "score" };
  if (/^(?:show\s+(?:me\s+)?)?(?:my\s+)?(?:lowest|worst|weakest)\s+(?:health\s+)?(?:scores?|policies)$|^sort(?:ed)?\s+by\s+score$/.test(t)) return { view: "all", sort: "score" };
  return null;
}

/** "Sunita's portfolio", "is Sunita covered enough?", "cover gap for Sunita". */
export function portfolioName(textRaw: string): string | null {
  const t = norm(textRaw);
  // The Hinglish form first: "Ramesh ka portfolio" is Ramesh, not "ramesh ka".
  const m = t.match(new RegExp(`^(.+?)\\s+(?:ka|ki|के|का|की)\\s+(?:portfolio|cover gap|पोर्टफोलियो)${END}`))
    || t.match(new RegExp(`^(.+?)(?:'s)?\\s+portfolio${END}`))
    || t.match(new RegExp(`^portfolio\\s+(?:of\\s+|for\\s+)?(.+?)${END}`))
    || t.match(new RegExp(`^(?:is|are)\\s+(.+?)\\s+(?:covered enough|under-?insured|fully covered|covered properly)${END}`))
    || t.match(new RegExp(`^(?:cover gap|gap)\\s+(?:for\\s+|of\\s+)?(.+?)${END}`))
    || t.match(new RegExp(`^(.+?)\\s+(?:ka|ki|के|का|की)\\s+(?:portfolio|cover gap|पोर्टफोलियो)${END}`))
    || t.match(new RegExp(`^(.+?)\\s+(?:ka|ki|का|की)\\s+cover\\s+(?:kaafi|kafi|enough|पूरा)\\s+(?:hai|है)${END}`));
  const name = m ? m[1].trim() : null;
  return name && !NOT_A_PERSON.test(name) ? name : null;
}

function bookIntent(t: string): Intent | null {
  // Whole messages only: these skip the model at any length, so "what failed with Ramesh,
  // follow up friday" must stay free text for the lead rules and the model.
  if (/^(?:what|which|any)\s+(?:checks?|uploads?|policies)?\s*(?:have\s+|has\s+)?(?:failed|didn'?t work|did not work|got stuck)(?:\s+(?:today|yet|so far))?[?.!]*$|^failed(?: checks?| policies| uploads?)?[?.!]*$|^(?:my\s+)?queue[?.!]*$|^(?:stuck|pending|running) (?:checks?|uploads?)[?.!]*$|^(?:kya|kaun sa|konsa|kaunsi)\s+fail\s+(?:hua|hui|hue)(?:\s+(?:hai|hain))?[?.!]*$|^kya atka hai[?.!]*$/.test(t)) return "queue";
  if (statusName(t)) return "status";
  if (bookAsk(t)) return "book";
  if (/^(?:all\s+|my\s+)?(?:surrender values|policy values|values list|surrender list)[?.!]*$|^(?:sab(?:hi)?|saari)\s+surrender values?[?.!]*$/.test(t)) return "values";
  if (/^(?:how is|how'?s|hows)\s+my\s+(?:book|business|portfolio)[?.!]*$|^(?:insights|book summary|business summary|my insights|book insights)[?.!]*$|^(?:mera|meri)\s+(?:book|business)\s+kaisa\s+(?:hai|chal raha hai)[?.!]*$|^मेरा बिज़नेस कैसा है/.test(t)) return "insights";
  // After insights: "how is my portfolio" is the book, not a customer called "how is my".
  if (portfolioName(t)) return "portfolio";
  if (/^(?:show\s+(?:me\s+)?)?(?:my\s+)?(?:page|website|site) (?:stats|views|visits)[?.!]*$|^how many (?:people )?(?:saw|visited|opened|viewed) my (?:page|website|site)(?:\s+(?:this month|so far|lately))?[?.!]*$|^(?:mere\s+)?(?:page|website) par kitne log(?:\s+aaye)?(?:\s+(?:hain|the))?[?.!]*$/.test(t)) return "pagestats";
  return null;
}
