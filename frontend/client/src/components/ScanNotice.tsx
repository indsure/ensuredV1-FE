import { ScanLine } from "lucide-react";

import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Shown on a policy that was read by OCR: a photo, or a PDF with no text layer
 * (a scan, or a file put through "Print to PDF"). OCR misreads digits, most of
 * all in premium tables, so the reader is told to check the key figures
 * against the document before relying on them or sending them on.
 *
 * The server sets `read_from_scan` on report_data (health audits) or on
 * extracted_data (motor and the other data-entry types).
 */
export function isReadFromScan(reportData: unknown, extractedData: unknown): boolean {
  return (
    (reportData as any)?.read_from_scan === true ||
    (extractedData as any)?.read_from_scan === true
  );
}

export default function ScanNotice({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <div
      role="note"
      className={`flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 ${className}`}
    >
      <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
      <div>
        <p className="text-base font-bold">{t("scan_notice.title")}</p>
        <p className="mt-1 text-sm leading-relaxed">{t("scan_notice.body")}</p>
      </div>
    </div>
  );
}
