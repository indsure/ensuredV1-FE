/**
 * The number guard for WhatsApp answers (plan §4, brief §11).
 *
 * The model is allowed to PHRASE an answer from report fields the engine already computed.
 * It is never allowed to produce a number of its own. So every number in its reply must
 * appear, digit for digit, somewhere in the facts it was given. One stray number and the
 * whole reply is thrown away in favour of the plain template answer.
 *
 * Deliberately strict: "5 lakh" against a fact of 500000 FAILS. The prompt tells the model
 * to copy numbers exactly as written; a guard that tried to understand lakh and crore would
 * be a second engine, and a second engine is how wrong numbers get in.
 */

/** Every number in a string, commas dropped, trailing ".0" dropped. "₹1,50,000.00" -> "150000". */
export function numbersIn(text: string): string[] {
  const out: string[] = [];
  for (const m of String(text).matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    let n = m[0].replace(/,/g, "");
    if (n.includes(".")) n = n.replace(/\.?0+$/, "");
    if (n) out.push(n);
  }
  return out;
}

export type GuardResult = { ok: true } | { ok: false; stray: string[] };

/** `allowedExtra` covers numbers the reply may legitimately carry that are not facts,
 *  such as "100" in "72/100". Kept tiny on purpose. */
export function checkAnswerNumbers(answer: string, facts: unknown, allowedExtra: string[] = ["100"]): GuardResult {
  const allowed = new Set([...numbersIn(JSON.stringify(facts ?? {})), ...allowedExtra]);
  const stray = numbersIn(answer).filter((n) => !allowed.has(n));
  return stray.length === 0 ? { ok: true } : { ok: false, stray };
}

/** The only intents the model may return. Anything else is "unknown". */
export const WA_INTENTS = ["analyze", "ask", "share", "renewals", "help", "unknown"] as const;
export type WaIntent = (typeof WA_INTENTS)[number];

export function parseIntent(raw: string): WaIntent {
  const word = String(raw || "").toLowerCase().replace(/[^a-z]/g, " ").trim().split(/\s+/)[0] || "";
  return (WA_INTENTS as readonly string[]).includes(word) ? (word as WaIntent) : "unknown";
}
