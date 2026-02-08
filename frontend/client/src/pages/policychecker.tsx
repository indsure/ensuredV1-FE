import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  Shield,
  Lock,
  Clock,
  AlertCircle
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useAnalysis } from "@/hooks/use-analysis";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { loadSampleReport, mockReportHealth, mockReportLife, mockReportVehicle } from "@/lib/mock-data";
import { PolicyCheckerLanding } from "@/components/PolicyCheckerLanding";

export default function PolicyChecker() {
  const { analyze, error: analysisError, setPolicyText } = useAnalysis();
  const [, setLocation] = useLocation();

  useSEO({
    title: "Decode Your Health Policy | Ensured",
    description: "Upload your health insurance policy PDF. Get a clear verdict.",
  });

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    const file = acceptedFiles[0];

    // Validate
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File is too large. Max 25MB.`);
      return;
    }

    setError(null);
    setUploading(true);
    setLocation("/processing");

    try {
      setPolicyText(`Policy: ${file.name}`);
      await analyze(file);
    } catch (err: any) {
      console.error("Analysis failed:", err);
      setError(err?.message || "Analysis failed");
      setLocation("/policychecker");
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: uploading,
  });

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] flex flex-col font-sans text-[var(--color-navy-900)]">
      <Header />

      <main className="flex-grow pt-24 px-6 max-w-7xl mx-auto w-full">
        <PolicyCheckerLanding
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          isDragActive={isDragActive}
          uploading={uploading}
          error={error}
        />
      </main>

      <Footer />
    </div>
  );
}
