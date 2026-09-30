import { tOr } from "@/i18n";
import { LEAD_STATUS_META, type LeadStatus } from "@/lib/leads";

// Display labels for lead fields. The saved values (status, source, interest)
// stay English in the database; these only change what is shown.
type T = (key: string, vars?: Record<string, string | number>) => string;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "_");

export const statusLabel = (t: T, s: LeadStatus) => tOr(t, `leads.status_${s}`, LEAD_STATUS_META[s].label);
export const sourceLabel = (t: T, s: string) => tOr(t, `leads.source_${slug(s)}`, s);

/* A lead can want several kinds of insurance. They are saved in the one text
 * column as "Health, Motor" so every reader (lead cards, team page, WhatsApp
 * bot, admin app) keeps working without a schema change. Older single values
 * and free text from landing pages ("Family health") are just a list of one. */
export const INTEREST_OPTIONS = ["Health", "Motor", "Life", "Term", "Travel", "Property"];

export function splitInterest(s: string | null | undefined): string[] {
  return (s ?? "").split(",").map((p) => p.trim()).filter(Boolean);
}

export const joinInterest = (parts: string[]) => parts.join(", ");

export const interestLabel = (t: T, s: string) =>
  splitInterest(s).map((p) => tOr(t, `common.type_${slug(p)}`, p)).join(", ");
