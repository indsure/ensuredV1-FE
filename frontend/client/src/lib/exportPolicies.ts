import * as XLSX from "xlsx";
import { getFields, typeLabel, isDataEntryType, type InsuranceType } from "./insuranceTypes";

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
    Score: type === "health" ? (p.score ?? "") : "",
    Created: p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN") : "",
  };
}

/**
 * Export the given (already-filtered) policy rows to an .xlsx file.
 * When the active filter is a single data-entry type, its extracted fields
 * are appended as extra columns so the sheet is genuinely useful for that type.
 */
export function exportPoliciesToExcel(
  rows: ExportablePolicy[],
  typeFilter: "all" | InsuranceType
): void {
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

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Policies");

  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = typeFilter === "all" ? "" : `-${typeFilter}`;
  XLSX.writeFile(wb, `indsure-policies${suffix}-${stamp}.xlsx`);
}
