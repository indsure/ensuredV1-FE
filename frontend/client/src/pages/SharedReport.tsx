import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { PolicyAuditReport } from "@/components/PolicyAuditReport";
import { validateForensicAuditReport } from "@/lib/policy-types";
import { getApiBase } from "@/lib/queryClient";

interface SharedReportProps {
  token: string;
}

export default function SharedReport({ token }: SharedReportProps) {
  const [data, setData] = useState<any | null>(null);
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
        
        console.log("[SharedReport] Received report data:", {
          hasReportData: !!reportData.report_data,
          hasIdentity: !!reportData.report_data?.identity,
          hasPolicyTimeline: !!reportData.report_data?.policy_timeline,
          hasCoverageStructure: !!reportData.report_data?.coverage_structure,
          zone: reportData.report_data?.identity?.assumed_zone,
          verdict: reportData.report_data?.final_verdict?.label,
          score: reportData.report_data?.audit_score?.score,
          hasClaimSimulations: !!reportData.report_data?.claim_simulations,
          claimSimulationsLength: reportData.report_data?.claim_simulations?.length,
          hasCriticalActions: !!reportData.report_data?.recommendations?.critical_actions,
        });
        
        if (reportData.report_data && validateForensicAuditReport(reportData.report_data)) {
          console.log("[SharedReport] Validation passed, setting data");
          setData(reportData.report_data);
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
            className="px-6 py-3 bg-[var(--color-teal-600)] text-white rounded-lg hover:bg-[var(--color-teal-700)] transition-colors"
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
    <div className="min-h-screen bg-[var(--color-cream-main)]">
      {/* Minimal header with IndSure logo */}
      <div className="bg-white border-b border-[var(--color-border-light)] py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="IndSure" className="h-8" />
            <span className="text-lg font-semibold text-[var(--color-navy-900)]">IndSure</span>
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            Shared Policy Report
          </div>
        </div>
      </div>

      {/* Report content */}
      <PolicyAuditReport data={data} hideNav={true} />

      {/* Footer */}
      <div className="bg-white border-t border-[var(--color-border-light)] py-6 px-6 mt-12">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs text-[var(--color-text-muted)]">
            Powered by <span className="font-semibold text-[var(--color-teal-600)]">IndSure</span> • 
            Policy Analysis Platform
          </p>
        </div>
      </div>
    </div>
  );
}
