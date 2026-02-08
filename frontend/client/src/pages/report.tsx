import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Shield,
  Printer,
  ChevronDown,
  AlertCircle,
  FileText,
  Share2,
  Download
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
import { validateForensicAuditReport } from "@/types/master_audit_schema";

export default function Report({ params }: { params?: { id?: string } }) {
  const [, setLocation] = useLocation();
  const [data, setData] = useState(null as any | null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check for Direct Sample ID in URL (Demo Mode)
    const sampleId = params?.id;
    console.log("Report Page Loaded. Sample ID:", sampleId);

    if (sampleId === "sample-health") {
      setData(mockReportHealth);
      setLoading(false);
      return;
    }
    if (sampleId === "sample-life") {
      setData(mockReportLife);
      setLoading(false);
      return;
    }
    if (sampleId === "sample-vehicle") {
      setData(mockReportVehicle);
      setLoading(false);
      return;
    }

    // 2. Try to load from session (Real User Data)
    const raw = sessionStorage.getItem("ensured_report");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // STRICT VALIDATION: Only accept if it matches V3 Schema
        // NO FALLBACKS allowed for main product flow
        if (validateForensicAuditReport(parsed)) {
          setData(parsed);
        } else {
          console.error("Session data failed V3 validation.", parsed);
          // Data remains null, triggering Error UI
        }
      } catch (e) {
        console.error("Failed to parse report JSON", e);
      }
    }
    setLoading(false);
  }, [params?.id]);

  if (loading) return null;

  // Final Validation Check
  const isValid = data && validateForensicAuditReport(data);

  if (isValid) {
    return <PolicyAuditReport data={data} />;
  }

  // 3. ERROR / LEGACY FORMAT UI
  // This is shown when data is missing or invalid (Real Product Behavior)
  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] pb-20">
      <Header />
      <main className="max-w-5xl mx-auto pt-40 px-6">
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