import { tOr } from "@/i18n";
import { LEAD_STATUS_META, type LeadStatus } from "@/lib/leads";

// Display labels for lead fields. The saved values (status, source, interest)
// stay English in the database; these only change what is shown.
type T = (key: string, vars?: Record<string, string | number>) => string;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "_");

export const statusLabel = (t: T, s: LeadStatus) => tOr(t, `leads.status_${s}`, LEAD_STATUS_META[s].label);
export const sourceLabel = (t: T, s: string) => tOr(t, `leads.source_${slug(s)}`, s);
export const interestLabel = (t: T, s: string) => tOr(t, `common.type_${slug(s)}`, s);
