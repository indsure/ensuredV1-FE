import { useEffect, useState } from "react";
import { useParams } from "wouter";
import CalculatorReportPage from "../pages/calculator-report";
import PublicReport from "../pages/report/PublicReport";
import Report from "../pages/report";
import { Skeleton } from "./ui/skeleton";
import { apiFetch } from "@/lib/api";

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

    if (reportId.startsWith("sample-")) {
      setReportType("legacy");
      setLoading(false);
      return;
    }

    const detectReportType = async () => {
      try {
        const publicRes = await apiFetch(`/api/public-report/${reportId}`);
        if (publicRes.ok) {
          setReportType("agent");
          setLoading(false);
          return;
        }

        const calcRes = await apiFetch(`/api/calculator/report/${reportId}`);
        if (calcRes.ok) {
          setReportType("calculator");
          setLoading(false);
          return;
        }

        const clientRes = await apiFetch(`/api/client-report/${reportId}`);
        if (clientRes.ok) {
          setReportType("legacy");
          setLoading(false);
          return;
        }

        setReportType("legacy");
      } catch (err) {
        setReportType("legacy");
      } finally {
        setLoading(false);
      }
    };

    detectReportType();
  }, [reportId]);

  if (loading) return <PageLoader />;
  if (!reportId) return <Report />;

  if (reportType === "agent") return <PublicReport />;
  if (reportType === "calculator") return <CalculatorReportPage />;

  return <Report params={{ id: reportId }} />;
}
