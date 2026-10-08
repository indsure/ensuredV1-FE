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
  | { kind: "ok"; text: string; hindi: boolean; guess: PolicyType | null; scores: Record<string, number> };

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

const MIN_TEXT = 200;

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
    // A scan. The engine may still read it (it has its own OCR path), but we cannot guess
    // the type from nothing, so the bot will ask.
    return { kind: "ok", text, hindi: false, guess: null, scores: {} };
  }
  const { guess, scores } = guessType(text);
  return { kind: "ok", text, hindi: devanagariShare(text) > 0.4, guess, scores };
}

/** Is this file a PDF? Checks the magic bytes, not just the name. */
export function looksLikePdf(buf: Buffer): boolean {
  return buf.length > 4 && buf.subarray(0, 5).toString("latin1") === "%PDF-";
}
