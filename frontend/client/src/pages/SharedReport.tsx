import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { PolicyAuditReport } from "@/components/PolicyAuditReport";
import SharedPolicySummary from "@/components/SharedPolicySummary";
import { validateForensicAuditReport } from "@shared/policy";
import { getApiBase } from "@/lib/queryClient";

/** The data-entry lane's payload. `kind` comes from the server, which is the
 *  only side that knows which lane produced the row. */
type DataEntryPayload = {
  kind: "data_entry";
  insurance_type: string;
  fields: Record<string, unknown>;
  add_ons?: unknown;
  insurer?: string | null;
  policy_name?: string | null;
  policyholder_name?: string | null;
  created_at?: string | null;
};

interface SharedReportProps {
  token: string;
}

/** Header and footer shared by both lanes. Extracted rather than copied: the
 *  two views differ in their body and in one label, and nothing else. */
function PageChrome({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-cream-main)]">
      <div className="bg-white border-b border-[var(--color-border-light)] py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="IndSure" className="h-8" />
            <span className="text-lg font-semibold text-[var(--color-navy-900)]">IndSure</span>
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">{label}</div>
        </div>
      </div>

      {children}

      <div className="bg-white border-t border-[var(--color-border-light)] py-6 px-6 mt-12">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            Powered by <span className="font-semibold text-[var(--color-teal-600)]">IndSure</span> ·
            Policy Analysis Platform
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SharedReport({ token }: SharedReportProps) {
  const [data, setData] = useState<any | null>(null);
  const [dataEntry, setDataEntry] = useState<DataEntryPayload | null>(null);
  // Identity for the PDF. The report payload has no insurer or plan name; the
  // row wrapping it does, and this page was already throwing those fields away.
  const [meta, setMeta] = useState<{ insurer?: string; policyName?: string; policyholderName?: string; sourceFilename?: string; generatedAt?: string }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedReport() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${getApiBase()}/api/shared/report/${token}`);
        
        if (!res.ok) {
          const errorData = await res.json();
          
          if (errorData.error === "invalid_or_revoked") {
            setError("invalid_or_revoked");
          } else if (errorData.error === "report_not_ready") {
            setError("report_not_ready");
          } else if (errorData.error === "rate_limited") {
            setError("rate_limited");
          } else {
            setError("unknown");
          }
          return;
        }

        const reportData = await res.json();

        /* The data-entry lane has no forensic report to validate: the server
           already reduced it to the publishable fields, so there is nothing
           left for the browser to check or strip. */
        if (reportData.kind === "data_entry") {
          setDataEntry(reportData as DataEntryPayload);
          return;
        }

        if (reportData.report_data && validateForensicAuditReport(reportData.report_data)) {
          setData(reportData.report_data);
          setMeta({
            insurer: reportData.insurer ?? undefined,
            policyName: reportData.policy_name ?? undefined,
            policyholderName: reportData.policyholder_name ?? undefined,
            sourceFilename: reportData.filename ?? undefined,
            generatedAt: reportData.created_at ?? undefined,
          });
        } else {
          console.error("[SharedReport] Validation failed");
          setError("invalid_format");
        }
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError("network");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchSharedReport();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-cream-main)] flex items-center justify-center px-6">
        <div className="flex flex-col items-center text-center">
          <Loader2 className="w-12 h-12 text-[var(--color-teal-600)] animate-spin mb-4" />
          <p className="text-sm text-[var(--color-text-secondary)]">Loading report…</p>
        </div>
      </div>
    );
  }

  if (error === "invalid_or_revoked") {
    return (
      <div className="min-h-screen bg-[var(--color-cream-main)] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="inline-flex p-4 bg-red-100 rounded-full mb-6 text-red-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif text-[var(--color-navy-900)] mb-4">
            Report Not Available
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-8">
            This report link is no longer available. It may have been revoked by the agent or has expired.
          </p>
          <div className="text-xs text-[var(--color-text-muted)] pt-6 border-t border-[var(--color-border-light)]">
            Powered by <span className="font-semibold">IndSure</span>
          </div>
        </div>
      </div>
    );
  }

  if (error === "report_not_ready") {
    return (
      <div className="min-h-screen bg-[var(--color-cream-main)] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="inline-flex p-4 bg-amber-100 rounded-full mb-6 text-amber-600">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <h2 className="text-2xl font-serif text-[var(--color-navy-900)] mb-4">
            Report In Progress
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-8">
            This report is still being generated. Please check back in a few minutes.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[var(--color-cta)] text-white rounded-lg hover:bg-[var(--color-teal-700)] transition-colors"
          >
            Refresh Page
          </button>
          <div className="text-xs text-[var(--color-text-muted)] pt-6 mt-6 border-t border-[var(--color-border-light)]">
            Powered by <span className="font-semibold">IndSure</span>
          </div>
        </div>
      </div>
    );
  }

  if (error === "rate_limited") {
    return (
      <div className="min-h-screen bg-[var(--color-cream-main)] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="inline-flex p-4 bg-amber-100 rounded-full mb-6 text-amber-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif text-[var(--color-navy-900)] mb-4">
            Too Many Requests
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-8">
            Please wait a moment before trying again.
          </p>
          <div className="text-xs text-[var(--color-text-muted)] pt-6 border-t border-[var(--color-border-light)]">
            Powered by <span className="font-semibold">IndSure</span>
          </div>
        </div>
      </div>
    );
  }

  /* Data-entry lane. Placed before the "no data" guard below, which tests the
     audit payload and would otherwise reject a perfectly good summary. */
  if (dataEntry) {
    return (
      <PageChrome label="Shared Policy Summary">
        <SharedPolicySummary
          insuranceType={dataEntry.insurance_type}
          fields={dataEntry.fields}
          addOns={dataEntry.add_ons}
          insurer={dataEntry.insurer}
          policyName={dataEntry.policy_name}
          policyholderName={dataEntry.policyholder_name}
          createdAt={dataEntry.created_at}
        />
      </PageChrome>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--color-cream-main)] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="inline-flex p-4 bg-red-100 rounded-full mb-6 text-red-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif text-[var(--color-navy-900)] mb-4">
            Unable to Load Report
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-8">
            There was an error loading this report. Please contact the agent who shared this link.
          </p>
          <div className="text-xs text-[var(--color-text-muted)] pt-6 border-t border-[var(--color-border-light)]">
            Powered by <span className="font-semibold">IndSure</span>
          </div>
        </div>
      </div>
    );
  }

  // Render the report with hideNav=true to hide agent-only controls
  return (
    <PageChrome label="Shared Policy Report">
      <PolicyAuditReport data={data} hideNav={true} pdfMeta={meta} />
    </PageChrome>
  );
}
