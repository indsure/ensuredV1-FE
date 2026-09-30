/**
 * House style for every message the bot sends: one pass, just before sending, after the
 * reply has been put in the advisor's language. Presentation only; the words and numbers
 * are never changed in meaning.
 *
 *   • Commands to type are bold: *YES*, *SHARE*, *RENEWALS* (so they stand out as things to send)
 *   • Mobile numbers read 98123 45678; dates read 2 Oct 2026; rupees use Indian commas (₹1,25,000)
 *     and plain units (₹40 lakh, ₹1.5 crore)
 *   • Numbered choices use "1." so WhatsApp shows them as a list
 *   • Policy types and statuses in lists are capitalised (Health, Interested)
 *   • A link is never followed by punctuation (WhatsApp would make it part of the link)
 *   • No trailing spaces, never more than one blank line
 *   • The first line carries one emoji for the kind of reply (✅ saved, 📝 confirm, ⚠️ problem)
 *
 * A customer's message (what the advisor forwards) sits between CUSTOMER markers and is
 * sent exactly as written: no bold, no emoji, no translation.
 */

/** Wraps a customer-facing message inside a reply, so nothing restyles or translates it. */
export const CUSTOMER = "⁤";
export const customerText = (s: string) => `${CUSTOMER}${s}${CUSTOMER}`;

/** Applies `f` to the bot's own text only, leaving customer messages exactly as written. */
export function outsideCustomer(text: string, f: (s: string) => string): string {
  return text.split(/(⁤[\s\S]*?⁤)/).map((part) => (part.startsWith(CUSTOMER) ? part : f(part))).join("");
}

export const stripMarkers = (s: string) => s.split(CUSTOMER).join("");

// Longest first, so "MORNING OFF / ON" is one command, not three.
const COMMANDS = [
  "MORNING OFF / ON", "MORNING OFF", "MORNING ON", "FOLLOW UPS", "MY CLIENTS", "SURRENDER VALUE", "UPGRADE MESSAGE",
  "DIWALI MESSAGE", "TIER 1", "TIER 2", "RENEWALS", "CALCULATOR", "COMPARE", "BALANCE", "HINGLISH", "ENGLISH", "HINDI",
  "REMIND", "CANCEL", "CHANGE", "CHECKS", "CLAIMS", "VIEWS", "SHARE", "TODAY", "METRO", "UNDO", "HELP", "MORE", "SKIP",
  "NONE", "LEAD", "FIND", "LINK", "YES", "NO",
];
const COMMAND_RE = new RegExp(`(?<![*\\w])(${COMMANDS.map((c) => c.replace(/[/]/g, "\\/")).join("|")})(?![*\\w])`, "g");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LIST_WORDS = /(· )(health|motor|life|term|travel|property|fire|marine|new|contacted|interested|won|lost)(?= ·|$)/g;
const URL_RE = /(https?:\/\/\S+)/;

/** One emoji for the kind of reply, on the first line (only if it has none already). */
const LEAD_EMOJI: Record<string, string> = {
  confirm_ask: "📝", confirm_saved: "✅", filed: "✅", link: "👋", lang: "🌐", balance: "📊", checks: "📊",
  error: "⚠️", not_pdf: "⚠️", too_large: "⚠️", unreadable: "⚠️", locked: "⚠️", failed: "⚠️", gave_up: "⚠️",
  no_checks: "⚠️", no_data_entry: "⚠️", hindi: "⚠️", link_failed: "⚠️", unknown: "🤔", compare_pick: "⚖️",
  calc: "🧮", lead: "👤", lead_pick: "👤", received: "⏳", queued: "⏳", still_working: "⏳", taking_long: "⏳",
  website: "🌐", share: "📤", share_tool: "📤", remind: "📤", draft_done: "📤", sach_warn: "ℹ️", sach_limit: "ℹ️",
};
const STARTS_WITH_EMOJI = /^\s*[\p{Extended_Pictographic}☀-➿]/u;

function styleLine(line: string): string {
  // A link must not swallow the punctuation after it ("...report: https://x/y." breaks the link).
  line = line.replace(/(https?:\/\/\S+?)[.,;।]+(?=\s|$)/g, "$1");
  // Style the words around links, never the links themselves.
  return line.split(URL_RE).map((part, i) => (i % 2 ? part : styleWords(part))).join("");
}

function styleWords(s: string): string {
  return s
    .replace(COMMAND_RE, "*$1*")
    .replace(/(?<![\d/=+.,₹])([6-9]\d{4})(\d{5})(?![\d,])/g, "$1 $2")
    .replace(/\b(20\d\d)-(\d\d)-(\d\d)\b/g, (m, y, mo, d) => (Number(mo) >= 1 && Number(mo) <= 12 ? `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}` : m))
    .replace(/₹\s?(\d{4,})(?![\d,])/g, (_, n) => "₹" + Number(n).toLocaleString("en-IN"))
    // "₹40 Lakhs" / "₹1.5 Crores" (the engine's wording) read as "₹40 lakh" / "₹1.5 crore".
    .replace(/(₹\s?\d+(?:\.\d+)?)\s?(lakhs?|lacs?|crores?)\b/gi, (_, n, u) => `${n} ${/^c/i.test(u) ? "crore" : "lakh"}`)
    .replace(LIST_WORDS, (_, sep, w) => sep + w[0].toUpperCase() + w.slice(1));
}

/** The house style, on the bot's own words. */
export function polish(text: string, intent: string | null = null): string {
  let out = outsideCustomer(text, (part) =>
    part.split("\n").map((l) => styleLine(l.replace(/[ \t]+$/, "")).replace(/^(\d{1,2})\) /, "$1. ")).join("\n"),
  );
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  const emoji = intent ? LEAD_EMOJI[intent] : undefined;
  if (emoji && !STARTS_WITH_EMOJI.test(out) && !out.startsWith(CUSTOMER)) out = `${emoji} ${out}`;
  return out;
}
