import { getFields, typeLabel, isDataEntryType, type InsuranceType } from "./insuranceTypes";
import { ADD_ON_FINDINGS_KEY } from "@shared/motorAddOns";
import { scoreMotorPolicy } from "@shared/motorScore";
import { isoDay } from "./lifePremium";
import type { LifeListRow } from "./lifeList";
import { niceName, planLabel, type LicRow } from "./lic";

/** Minimal shape the exporter needs from a policy row. */
export interface ExportablePolicy {
  policyholder_name?: string | null;
  name?: string | null;
  insurance_type?: string | null;
  insurer?: string | null;
  policy_name?: string | null;
  policy_identifier?: string | null;
  expiry_date?: string | null;
  sum_insured?: number | null;
  score?: number | null;
  created_at?: string | null;
  extracted_data?: Record<string, any> | null;
}

/**
 * The score column.
 *
 * Health reads the stored column. Motor is computed from the add-on scan on the
 * row, the same reading the portal shows, so a sheet mailed to a customer cannot
 * disagree with the screen the advisor is looking at. Everything else exports
 * blank, because nothing else is scored.
 */
function scoreFor(type: InsuranceType, p: ExportablePolicy): number | string {
  if (type === "health") return p.score ?? "";
  if (type !== "motor") return "";
  const ed = p.extracted_data;
  if (!ed || typeof ed !== "object") return "";
  const s = scoreMotorPolicy(
    (ed as any)[ADD_ON_FINDINGS_KEY] ?? null,
    typeof ed.coverage_type === "string" ? ed.coverage_type : null,
  );
  return s.score ?? "";
}

function baseRow(p: ExportablePolicy): Record<string, any> {
  const type = (p.insurance_type || "health") as InsuranceType;
  return {
    Customer: p.policyholder_name || p.name || "",
    Type: typeLabel(type),
    Insurer: p.insurer || "",
    "Plan / Policy": p.policy_name || "",
    "Policy ID": p.policy_identifier || "",
    "Expiry": p.expiry_date || "",
    "Sum Insured": p.sum_insured ?? "",
    Score: scoreFor(type, p),
    Created: p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN") : "",
  };
}

const LIC_MODE: Record<LicRow["mode"], string> = { Y: "Yearly", H: "Half-yearly", Q: "Quarterly", M: "Monthly", S: "Single premium" };
const LIC_STATUS: Record<LicRow["status"], string> = {
  paid: "Paid", part_paid: "Part paid", due: "Due soon", in_grace: "In grace", past_grace: "Past grace",
};
const LIC_FLAG: Record<string, string> = { LP: "Last premium", MT: "Matures after this premium", FY: "First year", ST: "2nd or 3rd year" };

/** LIC policies in the Policies sheet: the same columns as every other row. */
function licBaseRow(r: LicRow): Record<string, any> {
  return {
    Customer: niceName(r.holderName),
    Type: "LIC",
    Insurer: "LIC",
    "Plan / Policy": planLabel(r.planNo),
    "Policy ID": r.policyNo,
    "Expiry": "",
    "Sum Insured": "",
    Score: "",
    Created: "",
  };
}

/** LIC policies in their own sheet, with what the LIC sheets actually say. */
function licFullRow(r: LicRow): Record<string, any> {
  const unpaid = r.status !== "paid";
  return {
    Customer: niceName(r.holderName),
    "Policy number": r.policyNo,
    Plan: planLabel(r.planNo),
    Pays: LIC_MODE[r.mode] ?? r.mode,
    "Premium (each instalment)": r.instPrem,
    "Premiums owed": r.dueCount,
    Status: LIC_STATUS[r.status],
    "Still due": unpaid ? r.stillDue : 0,
    "Paid so far": r.paidAmount,
    "Unpaid since": unpaid ? r.fup : "",
    "Due date": unpaid ? r.dueDate : "",
    "Grace ends": unpaid ? r.graceEnds : "",
    "Policy term (years)": r.chosenTerm ?? "",
    "Commencement date": r.doc,
    Note: r.flag ? LIC_FLAG[r.flag] ?? r.flag : "",
    "Estimated commission": r.estComm,
  };
}

/**
 * Export the given (already-filtered) policy rows to an .xlsx file.
 * When the active filter is a single data-entry type, its extracted fields
 * are appended as extra columns so the sheet is genuinely useful for that type.
 * LIC policies from the agent's LIC sheets (founder, 2026-11-28) join the Policies sheet and
 * also get an "LIC" sheet of their own with the due and payment columns.
 */
export async function exportPoliciesToExcel(
  rows: ExportablePolicy[],
  // "others" is the sidebar's catch-all filter, not an insurance type. It has no
  // single field set, so it falls through to the base columns below.
  typeFilter: "all" | "others" | "lic" | InsuranceType,
  licRows: LicRow[] = []
): Promise<void> {
  // xlsx is ~280 kB and only ever runs on this one click, so it is pulled in
  // here rather than at the top of the file. Statically imported it rode along
  // in the Policies chunk, tripling the weight of the screen everyone opens for
  // a feature almost nobody uses in a given session.
  const XLSX = await import("xlsx");

  let data: Record<string, any>[];

  if (isDataEntryType(typeFilter)) {
    // Append the non-shared extracted fields (shared ones already live in baseRow).
    const extra = getFields(typeFilter).filter((f) => !f.shared);
    data = rows.map((p) => {
      const obj = baseRow(p);
      const ex = p.extracted_data || {};
      for (const f of extra) obj[f.label] = ex[f.key] ?? "";
      return obj;
    });
  } else {
    data = rows.map(baseRow);
  }
  data = [...data, ...licRows.map(licBaseRow)];

  const wb = XLSX.utils.book_new();
  // Under the LIC chip the Policies sheet would only repeat the LIC one, so it is left out.
  if (typeFilter !== "lic") XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Policies");
  if (licRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(licRows.map(licFullRow)), "LIC");

  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = typeFilter === "all" ? "" : `-${typeFilter}`;
  XLSX.writeFile(wb, `indsure-policies${suffix}-${stamp}.xlsx`);
}

/** The Life section's rows (lib/lifeList), in the columns that list shows. No surrender column:
 *  its figures come on different bases and the Free plan does not see them. */
export async function exportLifePolicies(
  rows: LifeListRow[],
  typeFilter: "all" | "life" | "term"
): Promise<void> {
  const XLSX = await import("xlsx");
  const data = rows.map((r) => ({
    Customer: r.clientName,
    Type: r.type === "term" ? "Term" : "Life",
    Insurer: r.insurer ?? "",
    "Plan / Policy": r.planName ?? "",
    "Policy number": r.policyNumber ?? "",
    "Sum assured": r.sumAssured ?? "",
    Premium: r.premium ?? "",
    "Premium frequency": r.frequency ?? "",
    "Next premium": r.due ? isoDay(r.due.date) : "",
    "Next premium basis": r.due ? r.due.basis : "",
    "Maturity / cover ends": r.endDate ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Life");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `indsure-life${typeFilter === "all" ? "" : `-${typeFilter}`}-${stamp}.xlsx`);
}
