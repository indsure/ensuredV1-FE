/**
 * Stage 2c: reading claim requests ("open a claim for Sunita", "Sunita's claim submitted",
 * "insurer wants discharge summary for Sunita's claim"). Pure: text in, request out. The bot
 * resolves the name and asks YES first; the server re-checks everything
 * (backend/server/whatsapp/edits.ts, stage 2c).
 */

export type ClaimStageTo = "docs_received" | "submitted" | "under_process";
export type ClaimAsk =
  | { kind: "open"; who: string; claimType: "cashless" | "reimbursement" | null }
  | { kind: "stage"; who: string | null; to: ClaimStageTo }
  | { kind: "close"; who: string | null; outcome: "settled" | "rejected" | "closed" }
  | { kind: "query"; who: string | null; question: string }
  | { kind: "answered"; who: string | null }
  | { kind: "extend"; who: string | null }
  | { kind: "edit"; who: string | null; word: string | null; value: string | null };

/** Claim detail words -> the claim column. Longest first when matching. */
export const CLAIM_WORDS: [string[], string][] = [
  [["hospital name", "hospital"], "hospital"],
  [["insurance company", "insurer"], "insurer"],
  [["tpa"], "tpa"],
  [["policy number", "policy no", "policy no."], "policy_number"],
  [["what happened", "illness", "disease", "diagnosis", "ailment", "reason", "bimari"], "ailment"],
  [["claimed amount", "claim amount", "bill amount", "amount claimed", "amount", "bill"], "claimed_amount"],
  [["admission date", "date of admission", "admitted on", "admitted"], "admitted_on"],
  [["discharge date", "date of discharge", "discharged on", "discharged"], "discharged_on"],
  [["claim type", "type"], "claim_type"],
];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const WORD_ALT = CLAIM_WORDS.flatMap(([w]) => w).sort((a, b) => b.length - a.length).map(esc).join("|");
export function claimKeyOf(word: string): string | null {
  const w = word.trim().toLowerCase().replace(/\s+/g, " ");
  return CLAIM_WORDS.find(([ws]) => ws.includes(w))?.[1] ?? null;
}

const clean = (s: string) => s.trim().replace(/[.!?।]+$/, "").trim();
/** Never a person: "the", "this", "my" ... and digits. */
const NOT_WHO = /^(?:the|this|that|my|a|an|it|his|her|their|new|naya|nayi|all|every|any)$|\d/i;
const okWho = (w: string | undefined | null) => !!w && w.trim().length >= 2 && !NOT_WHO.test(w.trim());
const QUESTION = /\?\s*$|\s(?:kya|kya hua|kahan tak|right|na)\s*[?.!।]*$/i;

const STAGE_WORDS: [RegExp, ClaimStageTo][] = [
  [/^(?:submitted|submit(?:ted)? to (?:the )?(?:insurer|tpa|company)|sent to (?:the )?(?:insurer|tpa|company)|submit ho gaya|submit kar diya|submit kiya|jama ho gaya|jama kar diya)$/i, "submitted"],
  [/^(?:docs received|documents received|papers received|docs in|documents in|all documents received|documents aa gaye|docs aa gaye|papers aa gaye|kagaz aa gaye)$/i, "docs_received"],
  [/^(?:under process|in process|processing|being processed|under processing|process mein hai|process me hai)$/i, "under_process"],
];
const stageOf = (w: string) => STAGE_WORDS.find(([re]) => re.test(w.trim()))?.[1] ?? null;
const CLOSE = /^(?:settled|approved|paid|passed|rejected|denied|closed|repudiated|settle ho gaya|pass ho gaya|reject ho gaya|mil gaya)$/i;
const closeOf = (w: string): "settled" | "rejected" | "closed" =>
  /reject|denied|repudiat/i.test(w) ? "rejected" : /closed/i.test(w) ? "closed" : "settled";

export function parseClaimAsk(textRaw: string): ClaimAsk | null {
  const raw = textRaw.trim();
  if (QUESTION.test(raw)) return null;
  const t = clean(raw).replace(/[’']/g, "'");
  let m: RegExpMatchArray | null;

  // Open: "open a claim for Sunita", "new cashless claim for Sunita", "Sunita ka claim kholo"
  m = t.match(/^(?:please\s+)?(?:open|start|create|add|register|new)\s+(?:a\s+)?(?:new\s+)?(cashless\s+|reimbursement\s+)?claim\s+(?:for|of)\s+(.+?)(?:[,\s]+(cashless|reimbursement))?$/i)
    || t.match(/^(.+?)\s+(?:ka|ki|के|का|की)\s+(?:naya\s+)?(cashless\s+|reimbursement\s+)?(?:claim|क्लेम)\s+(?:kholo|khol do|open karo|banao|bana do|shuru karo|खोलो|बनाओ)$/i);
  if (m) {
    const forPat = /^(?:please\s+)?(?:open|start|create|add|register|new)/i.test(t);
    const who = forPat ? m[2] : m[1];
    const typ = (forPat ? (m[1] || m[3]) : m[2])?.trim().toLowerCase() as "cashless" | "reimbursement" | undefined;
    return okWho(who) ? { kind: "open", who: clean(who), claimType: typ ?? null } : null;
  }

  const WHO = `(?:(.+?)'s|this|the)\\s+claim`;
  // Query: "insurer wants discharge summary for Sunita's claim", "query on Sunita's claim: X"
  m = t.match(new RegExp(`^(?:the\\s+)?(?:insurer|insurance company|tpa|company)\\s+(?:wants|needs|asked for|asks for|has asked for|is asking for)\\s+(.+?)\\s+(?:for|on|in)\\s+${WHO}$`, "i"));
  if (m && (m[2] === undefined || okWho(m[2]))) return { kind: "query", who: m[2] ? clean(m[2]) : null, question: clean(m[1]) };
  m = t.match(new RegExp(`^(?:new\\s+)?query\\s+(?:on|for|in)\\s+${WHO}\\s*[:,-]\\s*(.+)$`, "i"))
    || t.match(new RegExp(`^${WHO}\\s+query\\s*[:,-]\\s*(.+)$`, "i"))
    || t.match(/^(.+?)\s+(?:ke|ki|ka|के|की|का)\s+claim\s+(?:mein|me|में)\s+query\s*[:,-]?\s*(.+)$/i);
  if (m && (m[1] === undefined || okWho(m[1])) && m[2] && m[2].trim().length >= 3) return { kind: "query", who: m[1] ? clean(m[1]) : null, question: clean(m[2]) };

  // Answered: "Sunita's claim query answered", "answered the query on Sunita's claim"
  m = t.match(new RegExp(`^${WHO}\\s+query\\s+(?:answered|replied|resolved|done|sent)$`, "i"))
    || t.match(new RegExp(`^(?:answered|replied to|resolved)\\s+(?:the\\s+)?query\\s+(?:on|for|of)\\s+${WHO}$`, "i"))
    || t.match(/^(.+?)\s+(?:ke|ki|का|की|के)\s+claim\s+(?:ki\s+)?query\s+(?:ka\s+)?(?:jawab de diya|jawab diya|answer kar diya|reply kar diya|ho gayi)$/i);
  if (m && (m[1] === undefined || okWho(m[1]))) return { kind: "answered", who: m[1] ? clean(m[1]) : null };

  // Extend: "extend Sunita's claim", "keep Sunita's claim documents 30 more days"
  m = t.match(new RegExp(`^(?:extend|keep)\\s+${WHO}(?:'s)?(?:\\s+(?:documents|docs|papers))?(?:\\s+(?:for\\s+)?(?:30 more days|30 days more|longer|another 30 days))?$`, "i"))
    || t.match(/^(.+?)\s+(?:ka|ke|का|के)\s+claim\s+(?:ke\s+documents\s+)?extend\s+karo$/i);
  if (m && (m[1] === undefined || okWho(m[1]))) return { kind: "extend", who: m[1] ? clean(m[1]) : null };

  // Stage / close: "Sunita's claim submitted", "Sunita's claim is under process", "mark Sunita's claim docs received"
  m = t.match(new RegExp(`^(?:mark\\s+)?${WHO}(?:\\s+(?:is|was|has been|as|to))?\\s+(.+)$`, "i"))
    || t.match(/^(.+?)\s+(?:ka|ki|का|की)\s+claim\s+(.+)$/i);
  if (m && (m[1] === undefined || okWho(m[1]))) {
    const rest = m[2].trim();
    const who = m[1] ? clean(m[1]) : null;
    const st = stageOf(rest);
    if (st) return { kind: "stage", who, to: st };
    if (CLOSE.test(rest)) return { kind: "close", who, outcome: closeOf(rest) };
  }
  m = t.match(new RegExp(`^(?:documents|docs|papers)\\s+received\\s+(?:for|on)\\s+${WHO}$`, "i"));
  if (m && (m[1] === undefined || okWho(m[1]))) return { kind: "stage", who: m[1] ? clean(m[1]) : null, to: "docs_received" };

  // Edit: "Sunita's claim hospital is Apollo", "change Sunita's claim amount to 2 lakh", "edit Sunita's claim"
  const W = `(${WORD_ALT})`;
  m = t.match(new RegExp(`^(?:please\\s+)?(?:change|update|set|correct|fix)\\s+(?:the\\s+)?${WHO}(?:'s)?\\s+${W}\\s+(?:to|as|=|:)\\s+(.+)$`, "i"));
  if (m) return okEdit(m[1], m[2], m[3]);
  m = t.match(new RegExp(`^(?:please\\s+)?(?:change|update|set|correct|fix)\\s+(?:the\\s+)?${W}\\s+(?:on|of|for|in)\\s+${WHO}\\s+(?:to|as)\\s+(.+)$`, "i"));
  if (m) return okEdit(m[2], m[1], m[3]);
  m = t.match(new RegExp(`^${WHO}(?:'s)?\\s+${W}(?:\\s*[:=]\\s*|\\s+(?:is|was|should be)\\s+)(.+)$`, "i"));
  if (m) return okEdit(m[1], m[2], m[3]);
  m = t.match(new RegExp(`^(?:edit|change|update|correct|fix)\\s+${WHO}(?:\\s+details)?$`, "i"));
  if (m && (m[1] === undefined || okWho(m[1]))) return { kind: "edit", who: m[1] ? clean(m[1]) : null, word: null, value: null };
  return null;
}

function okEdit(who: string | undefined, word: string, value: string): ClaimAsk | null {
  if (who !== undefined && !okWho(who)) return null;
  const v = clean(value);
  if (!v) return null;
  return { kind: "edit", who: who ? clean(who) : null, word: word.toLowerCase(), value: v };
}
