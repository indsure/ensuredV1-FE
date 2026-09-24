import { FileText } from "lucide-react";

import AddOnChecklist from "@/components/agent/AddOnChecklist";
import { Card, CardContent } from "@/components/ui/card";
import { formatINRFull } from "@/lib/format";
import {
  SHAREABLE_FIELDS,
  isShareableType,
  type ShareFormat,
} from "@shared/dataEntryShare";
import { ADD_ON_FINDINGS_KEY } from "@shared/motorAddOns";
import { useLanguage } from "@/i18n/LanguageContext";
import { intlLocale, tOr, type Locale } from "@/i18n";

// Same key scheme the advisor data-entry form uses, so both share one set of labels.
const labelKey = (s: string) => "xform.f_" + s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/**
 * The customer-facing view of a data-entry policy.
 *
 * Motor, life, term, travel, property, fire, marine and CAR policies go through
 * the OCR lane and never produce a forensic audit, so this is what a shared
 * link shows for them instead of the audit report.
 *
 * It renders exactly what the server chose to send and nothing else. The
 * allowlist lives in shared/dataEntryShare.ts and is applied before the payload
 * leaves the backend, so a field withheld there is not merely hidden here — it
 * was never in the response. This component therefore has no business deciding
 * what is sensitive, and does not try to.
 *
 * Type floor is 14px and muted text stops at slate-500, matching the rest of
 * the product's rule for the 40-plus audience.
 */

interface Props {
  insuranceType: string;
  fields: Record<string, unknown>;
  addOns?: unknown;
  insurer?: string | null;
  policyName?: string | null;
  policyholderName?: string | null;
  createdAt?: string | null;
}

function formatValue(value: unknown, format: ShareFormat, locale: Locale = "en"): string {
  if (value === null || value === undefined) return "";

  if (format === "money") {
    const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? formatINRFull(n) : String(value);
  }

  if (format === "percent") {
    const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? `${n}%` : String(value);
  }

  if (format === "date") {
    const d = new Date(String(value));
    // An unparseable date is shown as written rather than as "Invalid Date".
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString(intlLocale(locale), { day: "numeric", month: "short", year: "numeric" });
  }

  return String(value);
}

export default function SharedPolicySummary({
  insuranceType,
  fields,
  addOns,
  insurer,
  policyName,
  policyholderName,
  createdAt,
}: Props) {
  const { t, locale } = useLanguage();
  if (!isShareableType(insuranceType)) return null;

  // Server order is not guaranteed by JSON; the registry is the reading order.
  const rows = SHAREABLE_FIELDS[insuranceType]
    .map((f) => ({ label: tOr(t, labelKey(f.label), f.label), value: formatValue(fields[f.key], f.format, locale) }))
    .filter((r) => r.value !== "");

  const heading = [insurer, policyName].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">
          {t("share_sum.glance")}
        </p>
        <h1 className="font-serif text-3xl leading-tight text-[var(--color-navy-900)]">
          {heading || t("share_sum.summary")}
        </h1>
        {policyholderName && (
          <p className="mt-2 text-base text-slate-600">{t("share_sum.held_by", { name: policyholderName })}</p>
        )}
      </header>

      <Card className="overflow-hidden border-slate-200">
        <CardContent className="p-0">
          <dl>
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-1 gap-1 border-b border-slate-100 px-6 py-4 last:border-b-0 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-6"
              >
                <dt className="text-sm text-slate-500">{row.label}</dt>
                <dd className="break-words text-base font-medium text-slate-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Motor only, and it renders nothing unless the document was read. */}
      {addOns ? (
        <div className="mt-8">
          <AddOnChecklist data={{ [ADD_ON_FINDINGS_KEY]: addOns }} />
        </div>
      ) : null}

      <p className="mt-8 flex items-start gap-2 text-sm leading-relaxed text-slate-500">
        <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {createdAt ? t("share_sum.read_on", { date: formatValue(createdAt, "date", locale) }) : t("share_sum.read")}{" "}
          {t("share_sum.final_word")}
        </span>
      </p>
    </div>
  );
}
