/**
 * The morning brief: Mon-Fri at 9 AM IST, paid plans only (Sach Assistant). Built by rules
 * from the advisor's own book, never the model, so it costs nothing to send. Also what
 * TODAY returns on demand.
 */
import type { LeadRow, ClaimRow } from "./crm.js";
import type { RenewalRow } from "../engine.js";
import { b, dayMonth, firstName, titleName } from "./format.js";

const IST_MS = 5.5 * 3600_000;

/** Today in IST: date, weekday (0 = Sunday) and minutes past midnight. */
export function istClock(nowMs: number) {
  const d = new Date(nowMs + IST_MS);
  return { iso: d.toISOString().slice(0, 10), weekday: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

/** Send window: weekdays, 9:00 to 12:00 IST (the later part only catches up after a restart). */
export function inMorningWindow(nowMs: number): boolean {
  const c = istClock(nowMs);
  return c.weekday >= 1 && c.weekday <= 5 && c.minutes >= 9 * 60 && c.minutes < 12 * 60;
}

/** Midnight IST of the previous working day: Monday looks back to Friday. */
export function sincePreviousWorkday(nowMs: number): number {
  const c = istClock(nowMs);
  const back = c.weekday === 1 ? 3 : c.weekday === 0 ? 2 : 1;
  return Date.parse(`${c.iso}T00:00:00Z`) - IST_MS - back * 86_400_000;
}

export type BriefInput = {
  name: string | null;
  followups: LeadRow[];
  renewals: { leads: RenewalRow[]; customers: RenewalRow[] };
  views: { name: string | null; lastViewed: string }[];
  claims: ClaimRow[];
  sinceMs: number;
};

const names = (list: (string | null)[], max = 3) => {
  const clean = list.map((n) => titleName(n)).filter(Boolean) as string[];
  const shown = clean.slice(0, max).join(", ");
  return clean.length > max ? `${shown}, +${clean.length - max}` : shown;
};

/** The brief, or null when there is nothing on the list (no "nothing today" messages). */
export function morningBrief(x: BriefInput): string | null {
  const today = x.followups.filter((r) => (r.days ?? 0) >= 0);
  const overdue = x.followups.filter((r) => (r.days ?? 0) < 0);
  const renew = [...x.renewals.leads, ...x.renewals.customers]
    .filter((r) => r.days_left >= 0 && r.days_left <= 7)
    .sort((a, c) => a.days_left - c.days_left);
  const opened = x.views.filter((v) => Date.parse(v.lastViewed) >= x.sinceMs);
  const queries = x.claims.reduce((n, c) => n + (c.openQueries?.length || 0), 0);

  const lines: string[] = [];
  if (today.length) lines.push(`${b("Follow-ups today:")} ${today.length} (${names(today.map((r) => r.name))})`);
  if (overdue.length) lines.push(`${b("Overdue follow-ups:")} ${overdue.length} (${names(overdue.map((r) => r.name))})`);
  if (renew.length) {
    const first = renew.slice(0, 3).map((r) => `${titleName(r.name) || "Unnamed"} ${dayMonth(r.due_date)}`).join(", ");
    lines.push(`${b("Renewals this week:")} ${renew.length} (${first}${renew.length > 3 ? `, +${renew.length - 3}` : ""})`);
  }
  if (opened.length) lines.push(`${b("Opened their report:")} ${names(opened.map((v) => v.name))}`);
  if (x.claims.length) {
    lines.push(`${b("Open claims:")} ${x.claims.length}${queries ? ` (${queries} insurer ${queries === 1 ? "query" : "queries"} waiting)` : ""}`);
  }
  if (!lines.length) return null;

  const hello = firstName(titleName(x.name)) ? `Good morning ${firstName(titleName(x.name))}.` : "Good morning.";
  const next = [today.length || overdue.length ? "FOLLOW UPS" : null, renew.length ? "RENEWALS" : null, x.claims.length ? "CLAIMS" : null]
    .filter(Boolean).join(", ");
  return [`☀️ ${hello} Here's your to-do:`, "", ...lines, "", `Reply ${next || "HELP"} for the full list.`].join("\n");
}

export const MORNING = {
  empty: () => "☀️ Nothing on your list right now: no follow-ups, renewals this week or open claims.",
  off: () => "Okay, no more morning briefs. Send MORNING ON to start them again.",
  on: () => "Done. You'll get your to-do at 9 AM, Monday to Friday. Send MORNING OFF to stop.",
  paidOnly: (url: string) => `The 9 AM morning brief is part of Sach Assistant, which comes with the paid plan: ${url}`,
};
