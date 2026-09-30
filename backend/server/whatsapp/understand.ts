/**
 * Understanding a free-form advisor message (the "form" a small model fills in).
 *
 * The model's ONLY job: read one WhatsApp message (plus a little context) and fill this
 * form: which action(s), and the names, dates and statuses the advisor typed. It never
 * looks anything up, never answers, never computes. The bot's code then resolves the names
 * against the book and asks for a one-tap YES before anything changes.
 *
 * Used by the model bake-off (eval/) and, if a model passes, by the bot.
 */

export const ACTION_TYPES = [
  "ask_report",      // a question about a checked policy ("room rent?", "Santosh ki policy mein co-pay?")
  "share",           // send a report / calculator / comparison to the customer
  "renewals",        // who is due for renewal
  "followups",       // leads to call today
  "list_leads",      // show my leads
  "add_lead",        // create a new lead
  "update_lead",     // change a lead's status, follow-up date or add a note
  "lookup",          // everything on a name or number
  "list_clients",    // list my policies / customers
  "draft_message",   // a ready-to-send message (upgrade, renewal, premium due, review, follow up, thank you, festival, birthday, anniversary)
  "calculator",      // cover calculator
  "compare",         // compare plans by name
  "website",         // the advisor's own website link
  "checks",          // policy checks left
  "views",           // which customers opened their report
  "claims",          // claims desk status
  "surrender_value", // life policy surrender value
  "help",
  "cancel",          // stop what we are doing
  "undo",            // undo the last change
  "unknown",         // not something the assistant does, or unclear: ask
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/** Actions that change stored data. These always need a one-tap YES in the bot. */
export const WRITE_ACTIONS: ActionType[] = ["add_lead", "update_lead", "undo"];

export const STATUSES = ["new", "contacted", "interested", "won", "lost"] as const;
export const INTERESTS = ["Health", "Motor", "Life", "Term", "Travel", "Property"] as const;
export const DRAFT_KINDS = ["upgrade_weak", "renewal", "premium_due", "review", "follow_up", "thank_you", "festival", "birthday", "anniversary"] as const;

export type Action = {
  type: ActionType;
  name: string | null;
  phone: string | null;
  status: (typeof STATUSES)[number] | null;
  follow_up_date: string | null; // YYYY-MM-DD
  note: string | null;
  interest: (typeof INTERESTS)[number] | null;
  draft_kind: (typeof DRAFT_KINDS)[number] | null;
  language: "english" | "hinglish" | "hindi" | null;
  plans: string[] | null;
  question: string | null;
  policy_type: string | null;
};

export type Understanding = { actions: Action[]; clarify: string | null };

export type Context = {
  /** The person the chat was last about, e.g. "Ramesh Kumar". Used for he/she/him/uska. */
  lastPerson?: string | null;
  /** What the bot last produced: "policy report", "calculator result", "comparison". */
  lastItem?: string | null;
  /** A question the bot is waiting on, e.g. "calculator: which city". */
  pending?: string | null;
  /** The last change the bot made, for "undo" and "no, I meant Suresh". */
  lastChange?: string | null;
};

/** Gemini response schema (OpenAPI subset). Every field is always present, null when unused. */
export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    actions: {
      type: "ARRAY",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: [...ACTION_TYPES] },
          name: { type: "STRING", nullable: true },
          phone: { type: "STRING", nullable: true },
          status: { type: "STRING", enum: [...STATUSES], nullable: true },
          follow_up_date: { type: "STRING", nullable: true },
          note: { type: "STRING", nullable: true },
          interest: { type: "STRING", enum: [...INTERESTS], nullable: true },
          draft_kind: { type: "STRING", enum: [...DRAFT_KINDS], nullable: true },
          language: { type: "STRING", enum: ["english", "hinglish", "hindi"], nullable: true },
          plans: { type: "ARRAY", items: { type: "STRING" }, nullable: true },
          question: { type: "STRING", nullable: true },
          policy_type: { type: "STRING", nullable: true },
        },
        required: ["type", "name", "phone", "status", "follow_up_date", "note", "interest", "draft_kind", "language", "plans", "question", "policy_type"],
      },
    },
    clarify: { type: "STRING", nullable: true },
  },
  required: ["actions", "clarify"],
};

/** The standing instructions. Kept short: the schema carries the structure. */
export function systemPrompt(): string {
  return [
    "You read one WhatsApp message from an Indian insurance advisor to their assistant and fill a form. You do not answer, look anything up, or calculate. Messages may be English, Hinglish or Hindi.",
    "",
    "Actions: ask_report (question about a checked policy), share (send a report, calculator result or comparison to a customer), renewals, followups (leads to call today), list_leads, add_lead, update_lead (status, follow-up date or note on an existing lead), lookup (everything on a name or number), list_clients (optionally policy_type), draft_message (draft_kind), calculator, compare (plans = plan names), website (the advisor's own site link), checks (policy checks left), views (who opened their report), claims, surrender_value, help, cancel, undo, unknown.",
    "",
    "Rules:",
    "1. name: the person exactly as written, in English letters (transliterate Hindi script). Never put status or command words in a name: in 'lead Ramesh won', name is Ramesh and status is won.",
    "2. he/she/him/her/uska/unka/it: use CONTEXT.lastPerson. Use CONTEXT.lastPerson ONLY for such a pronoun; a message that names no person and has no pronoun has name null. Never invent a name.",
    "3. status: bought, took the policy, policy le li, converted, signed = won. not interested, said no, mana kar diya, dropped = lost. spoke, called, baat ho gayi = contacted. interested, keen = interested.",
    "4. 'lead X won' or 'convert X into a lead that is won' is ONE action: add_lead or update_lead with name X and status won.",
    "5. follow_up_date: YYYY-MM-DD, worked out from TODAY. kal = tomorrow (for plans), parso = day after tomorrow. A weekday means its next occurrence after today.",
    "6. Two requests in one message: up to 3 actions, in order.",
    "7. Deleting or removing anything is not supported: use unknown with a clarify question.",
    "8. Sports, weather, jokes, or 'I won' about the advisor themself: unknown. Only lead updates change a status.",
    "9. If you are unsure what they want, use unknown and put a short question in clarify, written in the same language and script as the message. Guessing is worse than asking.",
    "10. phone: 10 digits only. interest: Health, Motor (car, bike), Life, Term, Travel, Property.",
    "11. A status, follow-up or note about a named person ('Vikram is interested', 'Neha said no', 'Pooja bought', 'spoke to Rohit') is update_lead. Use add_lead only when they ask to add, save or create a lead (add, new lead, naya lead, jodo) or give a new person to save.",
    "12. 'mark' at the start is the command, not a name: in 'mark won' or 'mark as lost' no person is named, so name is null and clarify asks who. A name must be a person actually written in the message or CONTEXT.lastPerson.",
    "13. Keep every word of a person's name together, even words that look like commands: 'Share Khan', 'Link Singh', 'Help Desai' are full names.",
    "14. While CONTEXT.pending is set, 'no', 'don't', 'wait', 'stop', 'never mind', 'chhodo' mean cancel. Use undo only to reverse a change already made (CONTEXT.lastChange).",
    "15. Whether a customer opened, saw or read their report is views (with name), not ask_report. Anything about a claim (status, queries, settlement) is claims (with name), not ask_report.",
    "16. Every draft_message action needs its draft_kind: renewal message or reminder = renewal, premium or payment due = premium_due, upgrade or better plan = upgrade_weak, thank you = thank_you, birthday (janmdin) = birthday, wedding anniversary (saalgirah) = anniversary, a festival (Diwali, Holi, Eid, New Year...) = festival, follow up = follow_up, review = review. 'Wish X happy birthday' is draft_message birthday for X.",
    "17. How much cover or insurance someone needs is calculator.",
    "18. A message that is only an insurer or plan name ('Manipal Lifetime Health', 'Optima Secure', 'Care Supreme and ReAssure') is compare with those plans. It is never calculator.",
  ].join("\n");
}

export function userPrompt(message: string, ctx: Context, todayIso: string): string {
  const weekday = new Date(`${todayIso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return [
    `TODAY: ${todayIso} (${weekday})`,
    `CONTEXT: ${JSON.stringify({ lastPerson: ctx.lastPerson ?? null, lastItem: ctx.lastItem ?? null, pending: ctx.pending ?? null, lastChange: ctx.lastChange ?? null })}`,
    `MESSAGE: ${message}`,
  ].join("\n");
}

/** Normalise what the model returned. Anything malformed becomes a single "unknown". */
export function normalise(raw: unknown): Understanding {
  const fallback: Understanding = { actions: [blank("unknown")], clarify: null };
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as any;
  const actions: Action[] = (Array.isArray(r.actions) ? r.actions : [])
    .slice(0, 3)
    .map((a: any) => ({
      ...blank((ACTION_TYPES as readonly string[]).includes(a?.type) ? a.type : "unknown"),
      name: str(a?.name),
      phone: (() => { const d = String(a?.phone ?? "").replace(/\D/g, "").slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : null; })(),
      status: (STATUSES as readonly string[]).includes(a?.status) ? a.status : null,
      follow_up_date: /^\d{4}-\d{2}-\d{2}$/.test(String(a?.follow_up_date ?? "")) ? a.follow_up_date : null,
      note: str(a?.note),
      interest: (INTERESTS as readonly string[]).includes(a?.interest) ? a.interest : null,
      draft_kind: (DRAFT_KINDS as readonly string[]).includes(a?.draft_kind) ? a.draft_kind : null,
      language: ["english", "hinglish", "hindi"].includes(a?.language) ? a.language : null,
      plans: Array.isArray(a?.plans) ? a.plans.map(String).filter(Boolean).slice(0, 4) : null,
      question: str(a?.question),
      policy_type: str(a?.policy_type),
    }));
  return actions.length ? { actions, clarify: str(r.clarify) } : fallback;
}

function blank(type: ActionType): Action {
  return { type, name: null, phone: null, status: null, follow_up_date: null, note: null, interest: null, draft_kind: null, language: null, plans: null, question: null, policy_type: null };
}
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
