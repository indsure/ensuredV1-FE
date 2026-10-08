/**
 * Looks at a PDF BEFORE any policy check is spent: is it locked, is it in Hindi, and what
 * kind of policy is it. Pure text heuristics with pdfjs, the same PDF library the backend
 * uses. No model is involved (brief §7 step 9: "the engine's classifier ... not the chat
 * model"). The engine has no classifier of its own today; the portal makes the advisor pick.
 *
 * When the guess is not clear the bot ASKS. A wrong guess of "health" would spend a policy
 * check and hand back a forensic verdict on a document nobody asked us to audit.
 */

import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const POLICY_TYPES = [
  "health", "motor", "life", "term", "travel", "property", "fire", "marine", "contractor_all_risk",
] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export const TYPE_LABEL: Record<PolicyType, string> = {
  health: "health",
  motor: "motor",
  life: "life",
  term: "term life",
  travel: "travel",
  property: "property",
  fire: "fire",
  marine: "marine",
  contractor_all_risk: "contractor all risk",
};

export type Inspection =
  | { kind: "locked" }
  | { kind: "unreadable" }
  | {
      kind: "ok"; text: string; hindi: boolean; guess: PolicyType | null; scores: Record<string, number>;
      /** Looks like a super top-up / top-up product (see looksLikeTopUp). */
      topUp?: boolean;
      /** Insured / proposer names read from labelled fields, Title Case, validated. */
      names?: string[];
    };

/** Keyword families. Each hit counts once per distinct phrase, so a word repeated on every
 *  page does not outvote the rest. */
const FAMILIES: Record<PolicyType, RegExp[]> = {
  health: [
    /hospitali[sz]ation/, /room rent/, /pre[- ]existing/, /cashless/, /day ?care/, /co[- ]?pay/,
    /restoration|recharge|reinstatement/, /no claim bonus|cumulative bonus/, /\bayush\b/, /domiciliary/,
    /mediclaim|health insurance|health policy/, /sub[- ]limit/, /\bicu\b/, /network hospital/,
  ],
  motor: [
    /\bidv\b|insured declared value/, /registration (no|number)/, /chassis/, /engine (no|number)/,
    /own damage/, /third party (liability|premium)/, /private car|two wheeler|goods carrying/,
    /\bncb\b/, /cubic capacity|\bcc\b/, /zero dep(reciation)?/, /motor (insurance|policy)/,
  ],
  life: [
    /sum assured/, /maturity benefit/, /death benefit/, /\bnominee\b/, /surrender value/,
    /policy term/, /premium paying term/, /bonus.*(reversionary|terminal)|(reversionary|terminal).*bonus/,
    /endowment|money back|ulip|unit linked/, /life (insurance|assured)/,
  ],
  term: [/\bterm (plan|insurance|assurance)\b/, /pure (risk|protection)/, /return of premium/, /critical illness rider/],
  travel: [
    /\btrip\b/, /passport/, /baggage/, /flight delay|trip (delay|cancellation)/, /overseas|international travel/,
    /travel (insurance|policy)/, /destination/,
  ],
  property: [/home insurance|householder|home shield|griha/, /building and contents|contents cover/, /burglary/],
  fire: [/standard fire|fire and special perils|sfsp/, /bharat (sookshma|laghu|griha) udyam/, /\bstfi\b/],
  marine: [/marine (cargo|hull|open cover|policy)/, /bill of lading|\bb\/l\b/, /institute cargo clauses/, /\bvoyage\b/],
  contractor_all_risk: [/contractor'?s? all risk|\bcar policy\b/, /erection all risk|\bear\b/, /contract (works|value)/],
};

/** Under this many letters a PDF is a scan: no type guess, no names, and a super top-up
 *  sent with a base policy cannot be read (the engine reads companions as text only). */
export const MIN_TEXT = 200;

/* ── Super top-up ──────────────────────────────────────────────────────
 * Measured on the 516 health wordings in corpus/ (2026-10-08): the product name near the top
 * of the document, or "top-up" said 6+ times, finds 25 of 29 top-ups with 2 false alarms
 * among 487 base policies. "Deductible" is useless as a signal: every IRDAI wording defines
 * it. A wrong guess costs one question, never a policy check. */
const TOP_UP_TITLE = /super[- ]?top[- ]?up|\btop[- ]?up\b|health recharge|super surplus|health booster|extra care|high deductible/;
const TOP_UP_WORD = /super[- ]?top[- ]?up|\btop[- ]?up\b/g;

export function looksLikeTopUp(textRaw: string): boolean {
  const t = textRaw.toLowerCase().replace(/\s+/g, " ");
  if (TOP_UP_TITLE.test(t.slice(0, 1500))) return true;
  return (t.match(TOP_UP_WORD) || []).length >= 6;
}

/* ── Who is insured ────────────────────────────────────────────────────
 * Labelled fields on the policy schedule. pdfjs joins table cells with spaces, so a label is
 * often followed by the NEXT label ("Name of Insured Date of Birth ..."), not a name: every
 * capture is validated and anything that looks like a label word is thrown away. A policy
 * WORDING has no names at all; expect none more often than not. */
const NAME_LABEL = /(?:name of (?:the )?(?:proposer|policy ?holder|insured(?: person)?)|(?:proposer|policy ?holder|insured(?: person)?)(?:'s)? name)\s*[:\-]?\s*/gi;
const TITLES = new Set(["mr", "mrs", "ms", "miss", "shri", "smt", "sri", "kumari", "dr", "master", "baby"]);
const NOT_NAME = new Set([
  "date", "birth", "dob", "age", "gender", "sex", "male", "female", "address", "policy", "relationship", "relation",
  "sum", "insured", "period", "mobile", "phone", "email", "plan", "no", "number", "customer", "id", "code", "of",
  "from", "to", "the", "and", "self", "spouse", "son", "daughter", "father", "mother", "proposer", "name", "nominee",
  "pan", "member", "members", "occupation", "premium", "details", "type", "city", "state", "pin", "pincode", "branch",
  "agent", "intermediary", "issued", "start", "end", "years", "year", "as", "per", "schedule", "cover", "person", "persons",
  // Policy WORDINGS say "the name of the insured person for whom ..." in running prose.
  "for", "whom", "whose", "who", "in", "respect", "will", "be", "is", "are", "shall", "which", "with", "by", "under",
  "any", "all", "such", "this", "that", "has", "have", "been", "on", "at", "or", "if", "considered", "mentioned", "stated",
]);

function titleCase(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** A real-looking name from the words right after a label, or null. */
function nameAfter(rest: string): string | null {
  const words = rest.split(/\s+/).slice(0, 7);
  const out: string[] = [];
  for (const raw of words) {
    const w = raw.replace(/[.,;:]+$/, "");
    const low = w.toLowerCase().replace(/\./g, "");
    if (!out.length && TITLES.has(low)) continue;
    // Schedules print names capitalised ("RAMESH KUMAR", "Ramesh Kumar"); prose is lowercase.
    if (!/^[A-Z][A-Za-z.']*$/.test(w) || NOT_NAME.has(low)) break;
    out.push(w);
    if (out.length === 4) break;
  }
  if (out.length < 2) return null;
  // At least one real word (not an initial): "R. K." alone is not a name.
  if (!out.some((w) => w.replace(/\./g, "").length >= 3)) return null;
  return out.map(titleCase).join(" ");
}

export function extractNames(textRaw: string): string[] {
  const t = textRaw.replace(/\s+/g, " ");
  const found: string[] = [];
  for (const m of t.matchAll(NAME_LABEL)) {
    const n = nameAfter(t.slice(m.index! + m[0].length, m.index! + m[0].length + 80));
    if (n && !found.includes(n)) found.push(n);
    if (found.length >= 6) break;
  }
  return found;
}

const nameWords = (n: string) =>
  n.toLowerCase().replace(/\./g, " ").split(/\s+/).filter((w) => w.length >= 3 && !TITLES.has(w));

/** Do two documents name the same person? "match": a name on each shares its first AND last
 *  word. "mismatch": both have names and no name word is shared at all. Anything else
 *  (initials, reordered names, surname only, no names) is "unknown", and the bot asks. */
export function sameInsured(a: string[], b: string[]): "match" | "mismatch" | "unknown" {
  if (!a.length || !b.length) return "unknown";
  let overlap = false;
  for (const x of a) for (const y of b) {
    const wx = nameWords(x), wy = nameWords(y);
    if (wx.length >= 2 && wy.length >= 2 && wx[0] === wy[0] && wx.at(-1) === wy.at(-1)) return "match";
    if (wx.some((w) => wy.includes(w))) overlap = true;
  }
  return overlap ? "unknown" : "mismatch";
}

/** Score text against the families; a winner needs at least 3 hits and a clear lead. */
export function guessType(textRaw: string): { guess: PolicyType | null; scores: Record<string, number> } {
  const text = textRaw.toLowerCase().replace(/\s+/g, " ");
  const scores: Record<string, number> = {};
  for (const t of POLICY_TYPES) scores[t] = FAMILIES[t].filter((re) => re.test(text)).length;

  // Term is a kind of life policy; a term document also scores on life. Fold them: if term
  // shows real evidence, prefer term over life.
  if (scores.term >= 2 && scores.life >= 2) scores.life = 0;

  const ranked = [...POLICY_TYPES].sort((a, b) => scores[b] - scores[a]);
  const [top, second] = ranked;
  const lead = scores[top] - scores[second];
  if (scores[top] >= 3 && lead >= 2) return { guess: top, scores };
  if (top === "term" && scores.term >= 2 && lead >= 1) return { guess: "term", scores };
  return { guess: null, scores };
}

/** Share of letters that are Devanagari. */
export function devanagariShare(text: string): number {
  const letters = text.match(/[A-Za-zऀ-ॿ]/g) || [];
  if (letters.length === 0) return 0;
  const dev = letters.filter((c) => c >= "ऀ" && c <= "ॿ").length;
  return dev / letters.length;
}

const require = createRequire(import.meta.url);
// pdfjs wants a URL ending in "/"; a bare Windows path fails its check, a file URL works everywhere.
const STANDARD_FONTS = pathToFileURL(path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts") + path.sep).href;

export async function inspectPdf(buf: Buffer): Promise<Inspection> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let doc: any;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: false, standardFontDataUrl: STANDARD_FONTS, verbosity: 0,
    }).promise;
  } catch (e: any) {
    if (e?.name === "PasswordException" || /password/i.test(String(e?.message))) return { kind: "locked" };
    return { kind: "unreadable" };
  }
  const pages = Math.min(doc.numPages, 12);
  let text = "";
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const c = await page.getTextContent();
    text += " " + c.items.map((it: any) => it.str || "").join(" ");
  }
  await doc.destroy().catch(() => {});
  if (text.replace(/\s/g, "").length < MIN_TEXT) {
    // A scan. We cannot guess the type from nothing, so the bot will ask. (The engine can
    // read a scanned MAIN policy, but never a scanned super top-up sent alongside it.)
    return { kind: "ok", text, hindi: false, guess: null, scores: {}, topUp: false, names: [] };
  }
  const { guess, scores } = guessType(text);
  return { kind: "ok", text, hindi: devanagariShare(text) > 0.4, guess, scores, topUp: looksLikeTopUp(text), names: extractNames(text) };
}

/** Is this file a PDF? Checks the magic bytes, not just the name. */
export function looksLikePdf(buf: Buffer): boolean {
  return buf.length > 4 && buf.subarray(0, 5).toString("latin1") === "%PDF-";
}
