// Who has paid: the latest Premium Due list checked against every Commission row the agent has.
//
// Pure functions, no database: the routes load rows and hand them here, and the tests feed the
// real sample sheets through the same code.

export type LicMode = "Y" | "H" | "Q" | "M" | "S";

export interface MatchDueRow {
  policyNo: string;
  holderName: string;
  doc: string; // YYYY-MM-DD
  planNo: number;
  licTerm: number;
  mode: LicMode;
  fup: string; // YYYY-MM
  flag: string | null;
  instPrem: number;
  dueCount: number;
  totalPrem: number;
  estComm: number;
}

export interface MatchPaidRow {
  policyNo: string;
  planNo: number;
  term: number;
  dueDate: string; // YYYY-MM-DD
  riskDate: string;
  adjDate: string;
  premium: number;
  commission: number;
}

export type LicStatus = "paid" | "part_paid" | "due" | "in_grace" | "past_grace";

export interface MatchedRow extends MatchDueRow {
  status: LicStatus;
  paidAmount: number;
  stillDue: number;
  /** The first unpaid instalment's due date, YYYY-MM-DD. */
  dueDate: string;
  /** Last day of the grace period, YYYY-MM-DD. */
  graceEnds: string;
  /** Whole months between the first unpaid instalment and the due list's month. */
  monthsBehind: number;
  /** Chosen term from the commission sheet when LIC printed it there, else null. */
  chosenTerm: number | null;
}

export interface MatchResult {
  rows: MatchedRow[];
  totals: {
    due: { count: number; amount: number };
    paid: { count: number; amount: number };
    notPaid: { count: number; amount: number };
    pastGrace: { count: number; amount: number };
    inGrace: { count: number; amount: number };
    notYetDue: { count: number; amount: number };
  };
  /** Commission rows that match no due row on this list. */
  extras: { newPolicies: number; newPremium: number; paidBeforeList: number };
}

/** Grace by mode, per LIC policy conditions (founder research 2026-11-28). */
export const GRACE_DAYS: Record<LicMode, number> = { M: 15, Q: 30, H: 30, Y: 30, S: 30 };

const STEP_MONTHS: Record<LicMode, number> = { M: 1, Q: 3, H: 6, Y: 12, S: 12 };

function addMonths(yyyyMm: string, n: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

const ym = (d: string) => d.slice(0, 7);
const monthIndex = (yyyyMm: string) => {
  const [y, m] = yyyyMm.split("-").map(Number);
  return y * 12 + (m - 1);
};

/** The D.o.C day in the FUP month, clamped to the month's last day. */
export function instalmentDueDate(doc: string, fup: string): string {
  const day = Number(doc.slice(8, 10));
  const [y, m] = fup.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${fup}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today in India, YYYY-MM-DD. */
export function todayIST(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

export function matchDueList(
  dueRows: MatchDueRow[],
  duePeriod: string, // YYYY-MM of the due list
  paidRows: MatchPaidRow[],
  today: string, // YYYY-MM-DD, IST
): MatchResult {
  // One payment per policy + instalment. The same CM sheet downloaded twice carries a different
  // footer id (so a different file hash), and counting its rows twice would turn a half-paid
  // Due=2 row into "paid" (critic 2026-11-28, item 3).
  const seenPay = new Set<string>();
  const unique = paidRows.filter((p) => {
    const k = `${p.policyNo}|${p.dueDate}`;
    if (seenPay.has(k)) return false;
    seenPay.add(k);
    return true;
  });
  const byPolicy = new Map<string, MatchPaidRow[]>();
  for (const p of unique) {
    const list = byPolicy.get(p.policyNo) ?? [];
    list.push(p);
    byPolicy.set(p.policyNo, list);
  }

  const used = new Set<MatchPaidRow>();
  const rows: MatchedRow[] = dueRows.map((r) => {
    // A payment counts toward this row when it is for an instalment from the FUP month up to the
    // list's month. One row per instalment on the CM sheet, so Due=2 needs two (or one big one).
    const hits = (byPolicy.get(r.policyNo) ?? []).filter((p) => {
      const m = ym(p.dueDate);
      return m >= r.fup && m <= duePeriod;
    });
    hits.forEach((h) => used.add(h));
    const paidAmount = hits.reduce((s, h) => s + h.premium, 0);
    // Paid is judged by instalments, not rupees: TotPrem can carry GST that the CM premium
    // column may not (critic item 5). Every sample row has GST 0, so both agree there.
    const instalmentsPaid = hits.length;
    const fullyPaid = instalmentsPaid >= Math.max(1, r.dueCount) || (paidAmount > 0 && paidAmount + 0.5 >= r.totalPrem);
    const stillDue = fullyPaid ? 0 : Math.max(0, Math.round((r.totalPrem - paidAmount) * 100) / 100);
    // A part-paid row is late from its NEXT unpaid instalment, not from the FUP (critic item 4).
    const step = STEP_MONTHS[r.mode] ?? 12;
    const firstUnpaid = addMonths(r.fup, fullyPaid ? 0 : instalmentsPaid * step);
    const dueDate = instalmentDueDate(r.doc, firstUnpaid);
    const graceEnds = addDays(dueDate, GRACE_DAYS[r.mode] ?? 30);

    let status: LicStatus;
    if (fullyPaid) status = "paid";
    else if (paidAmount > 0) status = "part_paid";
    else if (today < dueDate) status = "due";
    else if (today <= graceEnds) status = "in_grace";
    else status = "past_grace";

    return {
      ...r,
      status,
      paidAmount,
      stillDue,
      dueDate,
      graceEnds,
      monthsBehind: Math.max(0, monthIndex(duePeriod) - monthIndex(firstUnpaid)),
      // From ANY commission row for this policy: the Prem Due "Tm" is LIC's own term, which
      // for whole-life plans is 100 minus entry age (149/77 vs chosen 30), so it is never shown.
      chosenTerm: (byPolicy.get(r.policyNo) ?? [])[0]?.term ?? null,
    };
  });

  // A part-paid row is still owed money; its grace is judged like an unpaid one for the
  // totals, but it keeps its own label so the agent sees something was paid.
  const add = (acc: { count: number; amount: number }, amt: number) => {
    acc.count += 1;
    acc.amount += amt;
  };
  const z = () => ({ count: 0, amount: 0 });
  const totals = { due: z(), paid: z(), notPaid: z(), pastGrace: z(), inGrace: z(), notYetDue: z() };
  for (const r of rows) {
    add(totals.due, r.totalPrem);
    if (r.status === "paid") {
      add(totals.paid, r.totalPrem);
      continue;
    }
    add(totals.notPaid, r.stillDue);
    const late = today > r.graceEnds;
    const onTime = today < r.dueDate;
    if (late) add(totals.pastGrace, r.stillDue);
    else if (onTime) add(totals.notYetDue, r.stillDue);
    else add(totals.inGrace, r.stillDue);
  }
  for (const k of Object.keys(totals) as (keyof typeof totals)[]) {
    totals[k].amount = Math.round(totals[k].amount * 100) / 100;
  }

  const extrasRows = unique.filter((p) => !used.has(p));
  const isNew = (p: MatchPaidRow) => ym(p.riskDate) === ym(p.dueDate) && p.riskDate === p.dueDate;
  const extras = {
    newPolicies: extrasRows.filter(isNew).length,
    newPremium: Math.round(extrasRows.filter(isNew).reduce((s, p) => s + p.premium, 0) * 100) / 100,
    paidBeforeList: extrasRows.filter((p) => !isNew(p)).length,
  };

  // Longest unpaid first, then biggest amount; paid rows last.
  const rank: Record<LicStatus, number> = { past_grace: 0, part_paid: 1, in_grace: 2, due: 3, paid: 4 };
  rows.sort((a, b) => rank[a.status] - rank[b.status] || a.dueDate.localeCompare(b.dueDate) || b.stillDue - a.stillDue);

  return { rows, totals, extras };
}
