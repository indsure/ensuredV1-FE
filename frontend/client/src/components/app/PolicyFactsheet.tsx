import AddOnChecklist from "@/components/agent/AddOnChecklist";
import { formatINRFull } from "@/lib/format";
import { getFields, typeLabel } from "@/lib/insuranceTypes";
import type { ExtractionField } from "@/lib/insuranceTypes";
import { ADD_ON_FINDINGS_KEY } from "@shared/motorAddOns";

/**
 * What a customer sees for a policy that has no forensic audit.
 *
 * Motor, life, term, travel, property, fire, marine and CAR go through the OCR
 * lane, which produces `extracted_data` and never a `report_data`. The consumer
 * policy page tested only for a valid audit report, so the owner of a perfectly
 * well-read motor policy was told "the stored report for this policy is missing
 * or in an old format" about their own document.
 *
 * WHY THIS SHOWS EVERYTHING, UNLIKE THE PUBLIC SHARE VIEW
 * shared/dataEntryShare.ts withholds policy, engine, chassis and registration
 * numbers, nominees and site addresses, because a share link has no login and
 * the audience is whoever holds the URL. This page is the opposite: it is
 * behind auth and the viewer owns the row. Those fields are the customer's own
 * details, and the policy number in particular is what they will be asked for
 * when they call to make a claim. Hiding it here would be withholding a
 * person's data from that person, so the allowlist deliberately does not apply.
 *
 * Type floor is 14px and muted text stops at slate-500, matching the rest of
 * the product's rule for the 40-plus audience.
 */

interface Props {
  insuranceType: string;
  data: Record<string, any> | null | undefined;
}

function formatValue(value: unknown, field: ExtractionField): string {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (raw === "") return "";

  if (field.type === "number") {
    const n = typeof value === "number" ? value : Number(raw.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(n)) return raw;
    // Counts and percentages are not money; only amounts get a rupee sign.
    const isCount = /(_years|_months|percent|age|frequency)/.test(field.key);
    return isCount ? String(n) : formatINRFull(n);
  }

  if (field.type === "date") {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  return raw;
}

export default function PolicyFactsheet({ insuranceType, data }: Props) {
  // `json` fields hold structured objects (the charges table) that a label and
  // value row cannot render honestly, so they are left to the surfaces built
  // for them rather than stringified here.
  const rows = getFields(insuranceType)
    .filter((f) => f.type !== "json")
    .map((f) => ({ label: f.label, value: formatValue(data?.[f.key], f) }))
    .filter((r) => r.value !== "");

  const addOns = data?.[ADD_ON_FINDINGS_KEY] ?? null;

  if (rows.length === 0 && !addOns) return null;

  return (
    <div className="space-y-6">
      {rows.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-white">
          <header className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-serif text-xl text-[var(--color-navy-900)]">
              {typeLabel(insuranceType)} policy details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Read from your policy document. Your policy wording is the final word on what is
              covered.
            </p>
          </header>
          <dl>
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-1 gap-1 border-b border-slate-100 px-6 py-4 last:border-b-0 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:gap-6"
              >
                <dt className="text-sm text-slate-500">{row.label}</dt>
                <dd className="break-words text-base font-medium text-slate-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Motor only, and it renders nothing unless the document was read. */}
      {addOns ? <AddOnChecklist data={data} /> : null}
    </div>
  );
}
