/**
 * Stage 3: files. Reading a document's caption ("final bill for Sunita's claim"), the request to
 * start putting documents into a claim, and requests for files back ("send Ramesh's policy PDF",
 * "send Sunita's claim documents"). Pure: text in, request out.
 *
 * The checklist labels are the portal's own, character for character (frontend/client/src/lib/
 * claims.ts PERSONAL_DOCS and CASE_DOCS; test/docs.test.ts compares them), so a document added
 * here ticks the same item on the portal's checklist.
 */

export const PERSONAL_DOCS = [
  "Aadhaar — patient",
  "PAN card",
  "Policy copy or e-card",
  "Cancelled cheque",
  "NEFT mandate",
];
export const CASE_DOCS: Record<"cashless" | "reimbursement", string[]> = {
  cashless: [
    "Pre-authorisation form",
    "TPA or insurer health card",
    "Doctor's advice for admission",
    "Hospital cost estimate",
    "Final bill",
    "Discharge summary",
  ],
  reimbursement: [
    "Claim form Part A",
    "Claim form Part B (hospital)",
    "Discharge summary",
    "Itemised final bill",
    "Payment receipts",
    "Diagnostic reports",
    "Prescriptions and pharmacy bills",
    "Implant sticker or invoice",
    "FIR or MLC copy (if accident)",
  ],
};

/** A label as the advisor reads it in a message (the portal's dash shown as a comma). */
export const showLabel = (label: string) => label.replace(/\s+—\s+/g, ", ");

/** Words for each checklist item; the claim's type picks among items that exist for it. */
const WORDS: [RegExp, string][] = [
  [/\b(?:aadhaar|aadhar|adhaar|adhar|आधार)\b/i, "Aadhaar — patient"],
  [/\bpan\b|पैन/i, "PAN card"],
  [/\b(?:cheque|check|chq)\b/i, "Cancelled cheque"],
  [/\b(?:neft|mandate)\b/i, "NEFT mandate"],
  [/\b(?:pre[\s-]?auth(?:orisation|orization)?|preauth)\b/i, "Pre-authorisation form"],
  [/\b(?:tpa card|health card|insurer card)\b/i, "TPA or insurer health card"],
  [/\b(?:e[\s-]?card|policy copy|policy card)\b/i, "Policy copy or e-card"],
  [/\b(?:doctor'?s? advice|admission advice|advice for admission|admission note)\b/i, "Doctor's advice for admission"],
  [/\b(?:estimate|cost estimate)\b/i, "Hospital cost estimate"],
  [/\b(?:discharge(?: summary| card)?)\b/i, "Discharge summary"],
  [/\b(?:part a|claim form a|form a)\b/i, "Claim form Part A"],
  [/\b(?:part b|claim form b|form b|hospital form)\b/i, "Claim form Part B (hospital)"],
  [/\b(?:receipts?|payment receipts?)\b/i, "Payment receipts"],
  [/\b(?:reports?|lab|test results?|diagnostic|x[\s-]?ray|scan|mri|ct)\b/i, "Diagnostic reports"],
  [/\b(?:prescriptions?|pharmacy|medicine bills?|chemist)\b/i, "Prescriptions and pharmacy bills"],
  [/\b(?:implant|sticker)\b/i, "Implant sticker or invoice"],
  [/\b(?:fir|mlc)\b/i, "FIR or MLC copy (if accident)"],
  [/\b(?:final bill|hospital bill|bill)\b/i, "__BILL__"],
];

/** The checklist item a caption means, for this claim's type; or a custom label. */
export function labelFor(words: string, claimType: string): { label: string; category: "personal" | "case"; custom: boolean } {
  const type = claimType === "cashless" ? "cashless" : "reimbursement";
  const w = words.trim();
  for (const [re, label] of WORDS) {
    if (!re.test(w)) continue;
    const real = label === "__BILL__" ? (type === "cashless" ? "Final bill" : "Itemised final bill") : label;
    if (PERSONAL_DOCS.includes(real)) return { label: real, category: "personal", custom: false };
    if (CASE_DOCS[type].includes(real)) return { label: real, category: "case", custom: false };
    // A cashless-only item on a reimbursement claim (or the reverse) is kept, as a custom item.
    return { label: real, category: "case", custom: true };
  }
  const custom = w.replace(/\s+/g, " ").slice(0, 60);
  return { label: custom ? custom.charAt(0).toUpperCase() + custom.slice(1) : "Claim document", category: "case", custom: true };
}

const clean = (s: string) => s.trim().replace(/[.!?।]+$/, "").trim();
const CLAIM = "(?:claim|क्लेम)";
const NOT_WHO = /^(?:the|this|that|my|a|an|it|his|her|their|for|of|is|are|new)$|\d/i;
const okWho = (w: string | undefined) => !!w && w.trim().length >= 2 && !NOT_WHO.test(w.trim()) && w.trim().split(/\s+/).length <= 4;

/**
 * A file's caption that puts it into a claim. It must say "claim" (or क्लेम): a name alone is a
 * policy caption ("Sunita health"), as before. `who` null = "this claim" / the claim we are on.
 * `words` = what the document is; `reply` = it answers an insurer query.
 */
export function parseDocCaption(captionRaw: string): { who: string | null; words: string; reply: boolean; thisClaim: boolean } | null {
  const t = clean(captionRaw).replace(/[’']/g, "'");
  if (!new RegExp(`\\b${CLAIM}\\b|क्लेम`, "i").test(t)) return null;
  let who: string | null = null;
  let rest = t;
  const pats = [
    new RegExp(`^(.*?)\\s*(?:for|of|on|in)\\s+(.+?)'s\\s+${CLAIM}\\s*(.*)$`, "i"),
    new RegExp(`^(.*?)\\s*(?:^|\\s)(.+?)'s\\s+${CLAIM}\\s*[:,-]?\\s*(.*)$`, "i"),
    new RegExp(`^()(.+?)\\s+(?:ka|ke|ki|का|के|की)\\s+${CLAIM}\\s+(?:ka|ke|ki|का|के|की|mein|में)?\\s*(.*)$`, "i"),
    new RegExp(`^()([A-Za-z]+(?:\\s+[A-Za-z]+)?)\\s+${CLAIM}\\s*[:,-]?\\s*(.*)$`, "i"),
  ];
  for (const re of pats) {
    const m = t.match(re);
    // "discharge summary claim Sunita" or "policy for claim": document words are never the person.
    if (!m || !okWho(m[2]) || /\b(?:this|the|my|policy)\b/i.test(m[2]) || !labelFor(m[2], "cashless").custom) continue;
    who = clean(m[2]);
    rest = `${m[1]} ${m[3]}`;
    break;
  }
  if (!who) rest = t.replace(new RegExp(`\\b(?:for|of|on|in)?\\s*(?:this|the)\\s+${CLAIM}\\b`, "i"), " ");
  rest = rest.replace(new RegExp(`\\b${CLAIM}\\b|क्लेम`, "gi"), " ").replace(/\s+/g, " ").trim().replace(/^[:,-]\s*|\s*[:,-]$/g, "");
  return {
    who, words: rest, reply: /\b(?:query|reply|answer|jawab)\b|जवाब/i.test(rest),
    // Only "this claim" / "the claim" / a caption starting "claim" means the claim we are on.
    thisClaim: !who && new RegExp(`\\b(?:this|the)\\s+${CLAIM}\\b|^${CLAIM}\\b`, "i").test(t),
  };
}

/** "add documents to Sunita's claim", "Sunita ke claim ke documents", "documents for Sunita's claim". */
export function parseDocSession(textRaw: string): { who: string | null } | null {
  const t = clean(textRaw).replace(/[’']/g, "'");
  const D = "(?:documents?|docs?|papers?|files?|photos?|kagaz|dastavez|डॉक्यूमेंट|कागज़|कागज)";
  const m = t.match(new RegExp(`^(?:please\\s+)?(?:add|upload|put|send|attach)\\s+(?:the\\s+)?${D}\\s+(?:to|for|in|into)\\s+(?:(.+?)'s|this|the)\\s+${CLAIM}$`, "i"))
    || t.match(new RegExp(`^${D}\\s+(?:for|of)\\s+(?:(.+?)'s|this|the)\\s+${CLAIM}$`, "i"))
    || t.match(new RegExp(`^(.+?)\\s+(?:ke|ka|ki|के|का|की)\\s+${CLAIM}\\s+(?:ke|ka|ki|के|का|की)\\s+${D}(?:\\s+(?:bhejta hoon|bhej raha hoon|bhejti hoon|daalo|dalo|add karo|भेजता हूँ|डालो))?$`, "i"));
  if (!m) return null;
  if (m[1] !== undefined && !okWho(m[1])) return null;
  return { who: m[1] ? clean(m[1]) : null };
}

/** "send Sunita's claim documents", "send Sunita's claim final bill", "Sunita ke claim ke documents bhejo". */
export function parseDocSend(textRaw: string): { who: string | null; words: string | null } | null {
  const t = clean(textRaw).replace(/[’']/g, "'");
  if (/\?$/.test(textRaw.trim())) return null;
  const m = t.match(new RegExp(`^(?:please\\s+)?(?:send|share|give|forward)(?:\\s+me)?\\s+(?:(.+?)'s|this|the)\\s+${CLAIM}\\s+(.+)$`, "i"))
    || t.match(new RegExp(`^(.+?)\\s+(?:ke|ka|ki|के|का|की)\\s+${CLAIM}\\s+(?:ke|ka|ki|के|का|की)\\s+(.+?)\\s+(?:bhejo|bhej do|send karo|भेजो|भेज दो)$`, "i"));
  if (!m) return null;
  if (m[1] !== undefined && !okWho(m[1])) return null;
  const what = m[2].trim();
  const all = /^(?:all\s+)?(?:documents?|docs?|papers?|files?)$|^saare\s+documents$|^सारे\s+डॉक्यूमेंट$/i.test(what);
  // Only a real document: "send Sunita's claim status" or "... update" stays a claim question.
  if (!all && labelFor(what, "reimbursement").custom && labelFor(what, "cashless").custom) return null;
  return { who: m[1] ? clean(m[1]) : null, words: all ? null : what };
}

/** "send Ramesh's policy PDF", "send the PDF", "Ramesh ki policy bhejo". who null = the policy we are on. */
export function parsePolicyPdf(textRaw: string): { who: string | null; typeWord: string | null } | null {
  const t = clean(textRaw).replace(/[’']/g, "'");
  if (/\?$/.test(textRaw.trim())) return null;
  const TY = "(?:(health|motor|car|bike|life|term|travel|home|property)\\s+)?";
  let m = t.match(new RegExp(`^(?:please\\s+)?(?:send|give|forward)(?:\\s+me)?\\s+(?:the\\s+|this\\s+)?(?:policy\\s+)?(?:pdf|policy document|policy copy)$`, "i"));
  if (m) return { who: null, typeWord: null };
  m = t.match(new RegExp(`^(?:please\\s+)?(?:send|give|forward)(?:\\s+me)?\\s+(.+?)'s\\s+${TY}policy(?:\\s+(?:pdf|document|copy))?$`, "i"))
    || t.match(new RegExp(`^(?:please\\s+)?(?:send|give|forward)(?:\\s+me)?\\s+(?:the\\s+)?${TY}(?:policy\\s+)?pdf\\s+(?:of|for)\\s+(.+)$`, "i"));
  if (m) {
    const [who, ty] = m[0].match(/'s\s/) ? [m[1], m[2]] : [m[2], m[1]];
    return okWho(who) ? { who: clean(who), typeWord: ty?.toLowerCase() ?? null } : null;
  }
  m = t.match(new RegExp(`^(.+?)\\s+(?:ki|ka|की|का)\\s+${TY}(?:policy|पॉलिसी)(?:\\s+(?:ki\\s+)?(?:pdf|copy|कॉपी))?\\s+(?:bhejo|bhej do|भेजो|भेज दो)$`, "i"));
  if (m && okWho(m[1])) return { who: clean(m[1]), typeWord: m[2]?.toLowerCase() ?? null };
  return null;
}
