import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import CalculatorReportPage from "../pages/calculator-report";
import PublicReport from "../pages/report/PublicReport";
import Report from "../pages/report";
import { Skeleton } from "./ui/skeleton";

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-cream-main)]">
      <div className="space-y-4 w-full max-w-md px-4 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--color-teal-600)] mx-auto mb-4" />
        <p className="text-[var(--color-text-secondary)] font-medium">Loading Insurance Report...</p>
      </div>
    </div>
  );
}

export default function ReportDispatcher() {
  const { id, uuid } = useParams();
  const reportId = id || uuid;
  const [reportType, setReportType] = useState<"calculator" | "agent" | "legacy" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reportId) {
      setLoading(false);
      return;
    }

    // Special case for samples
    if (reportId.startsWith("sample-")) {
      setReportType("legacy");
      setLoading(false);
      return;
    }

    const detectReportType = async () => {
      try {
        // 1. Try public-report (Agent share) first as it's common for shares
        const publicRes = await fetch(`/api/public-report/${reportId}`);
        if (publicRes.ok) {
          setReportType("agent");
          setLoading(false);
          return;
        }

        // 2. Try calculator report
        const calcRes = await fetch(`/api/calculator/report/${reportId}`);
        if (calcRes.ok) {
          setReportType("calculator");
          setLoading(false);
          return;
        }

        // 3. Fallback to legacy client-report if needed
        const clientRes = await fetch(`/api/client-report/${reportId}`);
        if (clientRes.ok) {
          setReportType("legacy");
          setLoading(false);
          return;
        }

        // Default to legacy for error handling component in Report.tsx
        setReportType("legacy");
      } catch (err) {
        console.error("Error detecting report type:", err);
        setReportType("legacy");
      } finally {
        setLoading(false);
      }
    };

    detectReportType();
  }, [reportId]);

  if (loading) return <PageLoader />;
  if (!reportId) return <Report />;

  if (reportType === "agent") {
    // We pass the id if needed, PublicReport uses useParams internally anyway
    // but ensures it works with react-router-dom context
    return <PublicReport />;
  }

  if (reportType === "calculator") {
    return <CalculatorReportPage />;
  }

  // Fallback to the main Report component that handles samples and legacy session data
  return <Report params={{ id: reportId }} />;
}
