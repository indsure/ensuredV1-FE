import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  AlertCircle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  mockReportHealth,
  mockReportLife,
  mockReportVehicle
} from "@/lib/mock-data";
import { PolicyAuditReport } from "@/components/PolicyAuditReport";
import { validateForensicAuditReport } from "@/lib/policy-types";
import { useAnalysis } from "@/hooks/use-analysis";
import { apiFetch } from "@/lib/api";

export default function Report({ params }: { params?: { id?: string } }) {
  const [, setLocation] = useLocation();
  const { clearAuditState } = useAnalysis();
  const [data, setData] = useState(null as any | null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check for sample query-param (?sample=health|life|vehicle) set by analyze.tsx
    const searchParams = new URLSearchParams(window.location.search);
    const sampleType = searchParams.get("sample");
    if (sampleType === "health") { setData(mockReportHealth); setLoading(false); return; }
    if (sampleType === "life")   { setData(mockReportLife);   setLoading(false); return; }
    if (sampleType === "vehicle"){ setData(mockReportVehicle);setLoading(false); return; }

    // 2. Check for Direct Sample path ID (legacy demo mode)
    const sampleId = params?.id;
    if (sampleId === "sample-health")  { setData(mockReportHealth);  setLoading(false); return; }
    if (sampleId === "sample-life")    { setData(mockReportLife);    setLoading(false); return; }
    if (sampleId === "sample-vehicle") { setData(mockReportVehicle); setLoading(false); return; }

    // 2. Try to load from session (Real User Data - D2C Flow)
    const raw = sessionStorage.getItem("IndSure_report");
    if (raw && !params?.id) {
      try {
        const parsed = JSON.parse(raw);
        if (validateForensicAuditReport(parsed)) {
          setData(parsed);
          setLoading(false);
          return;
        } else {
        }
      } catch (e) {
      }
    }

    // 3. Try to fetch from database using ID (Agent Flow)
    if (params?.id && params.id !== "sample-health" && params.id !== "sample-life" && params.id !== "sample-vehicle") {
      apiFetch(`/api/client-report/${params.id}`)
        .then(res => res.json())
        .then(dbData => {
          if (dbData && dbData.report_data && validateForensicAuditReport(dbData.report_data)) {
            setData(dbData.report_data);
          } else {
          }
          setLoading(false);
        })
        .catch(err => {
          setLoading(false);
        });
      return;
    }

    setLoading(false);

    // CLEANUP: Reset state on unmount
    return () => {
      clearAuditState();
    };
  }, [params?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-cream-main)] flex items-center justify-center px-6">
        <div className="flex flex-col items-center text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--color-teal-600)]" />
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Preparing your report…</p>
        </div>
      </div>
    );
  }

  // Final Validation Check
  const isValid = data && validateForensicAuditReport(data);

  if (isValid) {
    return <PolicyAuditReport data={data as any} />;
  }

  // 3. ERROR / LEGACY FORMAT UI
  // This is shown when data is missing or invalid (Real Product Behavior)
  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] pb-20">
      <Header />
      <main className="max-w-5xl mx-auto pt-32 sm:pt-36 md:pt-40 px-4 sm:px-6 overflow-x-hidden">
        <div className="p-12 text-center border border-dashed border-red-200 bg-red-50/50 rounded-xl mb-12">
          <div className="inline-flex p-4 bg-red-100 rounded-full mb-6 text-red-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif text-[var(--color-navy-900)] mb-4">Report Generation Failed</h2>
          <p className="text-[var(--color-text-secondary)] max-w-md mx-auto mb-8">
            The policy data found in your session matches an older format or is corrupted.
            Please run the audit again with the latest engine.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/policychecker">
              <Button size="lg" className="bg-[var(--color-navy-900)] text-white hover:bg-[var(--color-navy-800)]">
                Start New Audit
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}