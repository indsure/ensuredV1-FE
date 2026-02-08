import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Upload,
  CheckCircle2,
  ArrowRight,
  X,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useDropzone } from "react-dropzone";
import { useComparison, type UploadedPolicy } from "@/hooks/use-comparison";
import { getSampleHealthPoliciesForCompare, getSampleProfile } from "@/lib/sample-comparison-data";
import type { PolicyData } from "@/types/policy";
import { CircularProgress } from "./circular-progress";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useNotifications } from "@/hooks/use-notifications";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/use-seo";
import { getApiBase } from "@/lib/api";
import { LifeInsuranceComparer } from "@/components/LifeInsuranceComparer";
import { TermInsuranceComparer } from "@/components/TermInsuranceComparer";
import { VehicleInsuranceComparer } from "@/components/VehicleInsuranceComparer";

type UploadStatus = "idle" | "uploading" | "extracting" | "success" | "error";

export default function UploadStep() {
  const [, setLocation] = useLocation();
  const { policies, setPolicies, setProfile } = useComparison();

  // Check for type query parameter
  const searchParams = new URLSearchParams(window.location.search);
  const compareType = searchParams.get("type");

  // If type=life, show life insurance comparer
  if (compareType === "life") {
    return <LifeInsuranceComparer />;
  }

  // If type=term, show term insurance comparer
  if (compareType === "term") {
    return <TermInsuranceComparer />;
  }

  // If type=vehicle, show vehicle insurance comparer
  if (compareType === "vehicle") {
    return <VehicleInsuranceComparer />;
  }

  // SEO - Dynamic based on type
  useSEO({
    title: compareType === "life"
      ? "Compare Term Life Insurance Plans | Best Life Insurance Comparison | Ensured"
      : compareType === "term"
      ? "Compare Term Life Insurance Plans | Pure Protection Comparison | Ensured"
      : compareType === "vehicle"
      ? "Compare Vehicle Insurance Plans | Car Insurance Comparison | Ensured"
      : "Compare Health Insurance Policies Side-by-Side | Ensured",
    description: compareType === "life" || compareType === "term"
      ? "Compare top term life insurance plans: HDFC, ICICI, Religare, LIC, Canara HSBC. See premiums, claim settlement ratios, riders. Get unbiased recommendations for maximum coverage per rupee."
      : compareType === "vehicle"
      ? "Compare vehicle insurance plans: HDFC Ergo, ICICI Lombard, Bajaj Allianz, New India Assurance. See premiums, add-ons, claim settlement ratios, deductibles. Find the best car insurance for your vehicle."
      : "Upload up to 4 health insurance policies. Compare room limits, co-pays, coverage areas, and exclusions. Find the best policy for your needs.",
    keywords: compareType === "life" || compareType === "term"
      ? "compare term life insurance, term life insurance comparison, best term life insurance India, maximum coverage per rupee, pure protection comparison"
      : compareType === "vehicle"
      ? "compare vehicle insurance, car insurance comparison, motor insurance comparison, vehicle insurance plans India, comprehensive vs third party"
      : "compare health insurance, insurance comparison tool, compare insurance policies, health insurance comparison India, side-by-side insurance comparison",
    canonical: compareType === "life" ? "/compare?type=life" : compareType === "term" ? "/compare?type=term" : compareType === "vehicle" ? "/compare?type=vehicle" : "/compare",
  });
  const { requestPermission, showNotification, permission } = useNotifications();
  const { toast } = useToast();
  const [showBackgroundBanner, setShowBackgroundBanner] = useState(false);

  // Clear sessionStorage when navigating away from compare flow
  useEffect(() => {
    return () => {
      // Check if we're leaving the compare flow entirely
      setTimeout(() => {
        const isStillInCompareFlow = window.location.pathname.startsWith("/compare");
        if (!isStillInCompareFlow) {
          sessionStorage.removeItem("ensured_comparison_policies");
          sessionStorage.removeItem("ensured_comparison_profile");
        }
      }, 0);
    };
  }, []);

  // Show background banner when uploads are in progress
  useEffect(() => {
    const hasActiveUploads = policies.some(
      (p) => p.status === "uploading" || p.status === "extracting"
    );
    const allComplete = policies.length > 0 && policies.every(
      (p) => p.status === "success" || p.status === "error"
    );
    
    if (hasActiveUploads) {
      setShowBackgroundBanner(true);
    } else if (allComplete && showBackgroundBanner) {
      // Show notification when all uploads complete
      if (permission === "granted" && policies.every((p) => p.status === "success")) {
        showNotification("All policies uploaded!", {
          body: `${policies.length} policy${policies.length > 1 ? "ies" : ""} ready for comparison.`,
          icon: "/favicon.ico",
        });
      }
      setTimeout(() => setShowBackgroundBanner(false), 2000);
    }
  }, [policies, permission, showBackgroundBanner, showNotification]);

  const extractPolicy = async (policyId: string, file?: File) => {
    let policyFile: File | null = file || null;

    if (!policyFile) {
      setPolicies((prev) => {
        const policy = prev.find((p) => p.id === policyId);
        if (!policy) {
          console.error("❌ Policy not found:", policyId);
          return prev;
        }
        policyFile = policy.file;
        return prev;
      });
    }

    if (!policyFile) {
      console.error("❌ No policy file found!");
      return;
    }

    setPolicies((prev) =>
      prev.map((p) =>
        p.id === policyId ? { ...p, status: "uploading", progress: "Uploading file...", progressPercent: 5 } : p
      )
    );

    let uploadProgressInterval: NodeJS.Timeout | null = null;
    let extractionProgressInterval: NodeJS.Timeout | null = null;

    try {
      const formData = new FormData();
      formData.append("policy_pdf", policyFile);

      uploadProgressInterval = setInterval(() => {
        setPolicies((prev) => {
          const current = prev.find((p) => p.id === policyId);
          if (!current || current.status !== "uploading" || (current.progressPercent || 0) >= 50) {
            if ((current?.progressPercent || 0) >= 50 && uploadProgressInterval) {
              clearInterval(uploadProgressInterval);
            }
            return prev;
          }
          const currentPercent = current.progressPercent || 5;
          const newPercent = Math.min(50, currentPercent + 2);
          return prev.map((p) =>
            p.id === policyId
              ? { ...p, progressPercent: newPercent }
              : p
          );
        });
      }, 200);

      const response = await fetch(`${getApiBase()}/api/extract-policy`, {
        method: "POST",
        body: formData,
      });

      if (uploadProgressInterval) {
        clearInterval(uploadProgressInterval);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend returned ${response.status}: ${errorText}`);
      }

      setPolicies((prev) =>
        prev.map((p) =>
          p.id === policyId
            ? { ...p, status: "extracting", progress: "Extracting policy data... This may take 30-60 seconds", progressPercent: 50 }
            : p
        )
      );

      extractionProgressInterval = setInterval(() => {
        setPolicies((prev) => {
          const policy = prev.find((p) => p.id === policyId);
          if (!policy || policy.status !== "extracting" || (policy.progressPercent || 0) >= 95) {
            if (extractionProgressInterval) {
              clearInterval(extractionProgressInterval);
            }
            return prev;
          }
          const currentPercent = policy.progressPercent || 50;
          const increment = Math.random() * 3 + 1;
          const newPercent = Math.min(95, currentPercent + increment);
          return prev.map((p) =>
            p.id === policyId
              ? { ...p, progressPercent: newPercent }
              : p
          );
        });
      }, 300);

      const result = await response.json();

      if (!result.extracted_data) {
        throw new Error("Invalid response: missing extracted_data");
      }

      setPolicies((prev) =>
        prev.map((p) =>
          p.id === policyId
            ? {
                ...p,
                status: "success",
                policyData: result.extracted_data,
                progress: undefined,
                progressPercent: 100,
              }
            : p
        )
      );
    } catch (error: any) {
      if (uploadProgressInterval) {
        clearInterval(uploadProgressInterval);
      }
      if (extractionProgressInterval) {
        clearInterval(extractionProgressInterval);
      }
      setPolicies((prev) =>
        prev.map((p) =>
          p.id === policyId
            ? {
                ...p,
                status: "error",
                error: error.message || "Failed to extract policy",
                progress: undefined,
                progressPercent: undefined,
              }
            : p
        )
      );
    }
  };

  const removePolicy = (policyId: string) => {
    setPolicies((prev) => prev.filter((p) => p.id !== policyId));
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const remainingSlots = 4 - policies.length;
    const filesToAdd = acceptedFiles.slice(0, remainingSlots);

    const newPolicies: UploadedPolicy[] = filesToAdd.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: "idle" as UploadStatus,
    }));

    setPolicies((prev) => [...prev, ...newPolicies]);

    newPolicies.forEach((policy) => {
      extractPolicy(policy.id, policy.file);
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
    disabled: policies.length >= 4,
  });

  const canProceed = policies.length >= 2 && policies.every((p) => p.status === "success");
  const hasActiveUploads = policies.some(
    (p) => p.status === "uploading" || p.status === "extracting"
  );
  const uploadingCount = policies.filter(
    (p) => p.status === "uploading" || p.status === "extracting"
  ).length;

  return (
    <div className="min-h-screen bg-[#F0FFFE] dark:bg-[#0F1419] relative flex flex-col">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 -left-40 w-80 h-80 bg-blue-400/30 dark:bg-blue-500/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -right-40 w-96 h-96 bg-cyan-400/30 dark:bg-cyan-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-400/25 dark:bg-teal-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-indigo-400/20 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>
      {/* Floating Status Badge - Desktop (top-left, below header) */}
      {showBackgroundBanner && hasActiveUploads && (
        <div className="hidden md:block fixed top-20 left-6 z-40 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-[#00B4D8]/20 rounded-full animate-ping"></div>
              <div className="relative w-2 h-2 bg-[#00B4D8] rounded-full"></div>
            </div>
            <span className="text-xs font-medium text-[#6B7280]">
              {uploadingCount} {uploadingCount === 1 ? "policy" : "policies"} uploading...
            </span>
          </div>
        </div>
      )}

      {/* Status Indicator - Mobile (inline below header) */}
      {showBackgroundBanner && hasActiveUploads && (
        <div className="md:hidden px-6 py-3 border-b border-[#E5E7EB] dark:border-[#374151] bg-[#FAFBFC] dark:bg-[#0F1419]">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-[#00B4D8]/20 rounded-full animate-ping"></div>
              <div className="relative w-2 h-2 bg-[#00B4D8] rounded-full"></div>
            </div>
            <span className="text-xs font-medium text-[#6B7280]">
              {uploadingCount} {uploadingCount === 1 ? "policy" : "policies"} uploading...
            </span>
          </div>
        </div>
      )}

      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 -left-40 w-80 h-80 bg-blue-400/30 dark:bg-blue-500/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -right-40 w-96 h-96 bg-cyan-400/30 dark:bg-cyan-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-400/25 dark:bg-teal-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-indigo-400/20 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>

      {/* Header */}
      <Header />
      <Breadcrumbs items={[{ label: "Compare" }]} />

      {/* Mini-Landing Section */}
      <section className="relative z-10 bg-gradient-to-b from-[#FAFBFC] to-white dark:from-[#0F1419] dark:to-[#1F2937] py-16 md:py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-6 leading-tight">
            Find Your Best-Fit Health Policy
          </h1>
          
          <p className="text-xl md:text-2xl text-[#4B5563] dark:text-[#D1D5DB] mb-8 max-w-3xl mx-auto leading-relaxed">
            Comparing 4 policies by hand = 2 hours of spreadsheet hell.
          </p>
          
          <p className="text-base md:text-lg text-[#6B7280] dark:text-[#D1D5DB] mb-8 max-w-2xl mx-auto leading-relaxed">
            Room limits buried in one doc, co-pay in another, exclusions on PDF page 12. You give up and pick randomly—or stick with your mediocre plan.
          </p>
          
          <p className="text-base md:text-lg font-medium text-[#0F1419] dark:text-[#FAFBFC] mb-8 max-w-2xl mx-auto">
            Upload up to 4 PDFs. We align them on room limits, co-pays, coverage areas, exclusions, and riders. See which policy covers your needs best—instantly.
          </p>
          
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            <div className="flex items-center gap-2 text-sm font-medium text-[#0F1419] dark:text-[#FAFBFC]">
              <CheckCircle2 className="w-4 h-4 text-[#00B4D8]" />
              Up to 4 policies
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#0F1419] dark:text-[#FAFBFC]">
              <CheckCircle2 className="w-4 h-4 text-[#00B4D8]" />
              30-second analysis per upload
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#0F1419] dark:text-[#FAFBFC]">
              <CheckCircle2 className="w-4 h-4 text-[#00B4D8]" />
              Head-to-head comparison grid
            </div>
          </div>

          {/* Primary CTA Button */}
          <div className="flex justify-center">
            <Button
              onClick={() => {
                // Scroll to upload section
                const uploadSection = document.getElementById('upload-section');
                if (uploadSection) {
                  uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="bg-[#00B4D8] hover:bg-[#0099B4] text-white font-semibold h-12 px-8 text-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Start Comparing Policies
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      <main id="upload-section" className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-1 bg-[#E5E7EB] dark:bg-[#374151] rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#00B4D8] to-[#10B981] rounded-full transition-all duration-600 ease-out"
              style={{ width: '33%' }}
            />
          </div>
        </div>

        <Card className="relative group shadow-lg border-gray-200 dark:border-gray-600 bg-gradient-to-br from-white/90 via-blue-50/30 to-white/90 dark:from-gray-800/80 dark:via-blue-950/10 dark:to-gray-800/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:scale-[1.01] hover:-translate-y-1">
          {/* Glow effect on hover */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00B4D8]/20 to-[#10B981]/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
          <div className="relative z-10">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Upload Policies
            </CardTitle>
            <CardDescription className="text-base mt-1 text-gray-700 dark:text-gray-300">
              Add up to 4 policies for comparison
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload Area */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                isDragActive
                  ? "border-[#1A3A52] dark:border-[#4A9B9E] bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 dark:border-gray-600 hover:border-[#4A9B9E] dark:hover:border-[#3CBBA0]"
              } ${policies.length >= 4 ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {isDragActive
                  ? "Drop policies here"
                  : policies.length >= 4
                  ? "Maximum 4 policies reached"
                  : "Drag & drop policy PDFs here, or click to browse"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {policies.length >= 4
                  ? "Remove a policy to add another"
                  : `${policies.length}/4 policies uploaded`}
              </p>
              {policies.length === 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPolicies(getSampleHealthPoliciesForCompare());
                    setProfile(getSampleProfile());
                    setLocation("/compare/results");
                  }}
                  className="mt-4 inline-flex items-center justify-center gap-2 text-sm text-[#00B4D8] hover:text-[#0099B4] dark:text-cyan-400 dark:hover:text-cyan-300"
                >
                  <FileText className="w-4 h-4" />
                  View sample comparison
                </button>
              )}
            </div>

            {/* Uploaded Policies List */}
            {policies.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Uploaded Policies
                </h3>
                {policies.map((policy) => (
                  <div
                    key={policy.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700/50"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {policy.file.name}
                        </p>
                        {policy.status === "success" && policy.policyData && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {policy.policyData.basic_info.insurer} - {policy.policyData.basic_info.plan_name} • {policy.policyData.coverage.base_si.display} • {policy.policyData.coverage.annual_premium.display}
                          </p>
                        )}
                        {(policy.status === "uploading" || policy.status === "extracting") && policy.progress && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            {policy.progress}
                            {policy.progressPercent !== undefined && (
                              <>
                                {" "}
                                {policy.progressPercent < 50 
                                  ? `(${Math.round(policy.progressPercent)}%)` 
                                  : policy.progressPercent < 95
                                  ? `(${Math.round(policy.progressPercent)}%) - Processing...`
                                  : `(${Math.round(policy.progressPercent)}%) - Almost done...`}
                              </>
                            )}
                          </p>
                        )}
                        {policy.status === "error" && policy.error && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {policy.error}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {policy.status === "uploading" || policy.status === "extracting" ? (
                        <CircularProgress progress={policy.progressPercent || 0} size={48} />
                      ) : policy.status === "success" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : policy.status === "error" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => extractPolicy(policy.id)}
                          className="text-xs"
                        >
                          Retry
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePolicy(policy.id)}
                        className="h-8 w-8"
                        aria-label={`Remove ${policy.file.name} from upload list`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </CardContent>
          </div>
        </Card>

      </main>

      {/* Sticky CTA Bar - Only show when policies are uploaded */}
      {policies.length > 0 && (
        <div className="sticky bottom-0 z-50 bg-white/95 dark:bg-[#0F1419]/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
              >
                Cancel
              </Button>
              <Button
                onClick={() => setLocation("/compare/profile")}
                disabled={!canProceed}
                className="bg-[#1A3A52] hover:bg-[#2d5a7b] dark:bg-[#4A9B9E] dark:hover:bg-[#5aabb0] disabled:opacity-50"
              >
                Next: Enter Profile
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* What to Look For Section */}
      {policies.length === 0 && (
        <>
        <section className="relative z-10 py-10 md:py-12 px-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-10">
              Key Dimensions for Comparison
            </h2>

            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {/* Coverage Limit */}
              <div className="bg-[#DBEAFE] dark:bg-[#00B4D8]/10 rounded-xl p-6 border-l-4 border-[#00B4D8] flex flex-col">
                <h3 className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">Total Coverage Limit</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed mb-4 flex-grow">
                  ₹5L, ₹10L, ₹15L? Higher is generally better, but look at room limits too. A ₹10L limit with a ₹1.5k room cap may not be better than ₹5L with ₹5k cap.
                </p>
                <div className="space-y-2 pt-2 border-t border-[#00B4D8]/20">
                  <div className="text-sm font-semibold text-[#EF4444] flex items-start gap-2">
                    <span>🚩</span>
                    <span>Coverage limit less than ₹3 lakh in a metro city</span>
                  </div>
                  <div className="text-sm font-semibold text-[#10B981] flex items-start gap-2">
                    <span>✓</span>
                    <span>Coverage limit ₹5L+ with no co-pay</span>
                  </div>
                </div>
              </div>

              {/* Room Limit */}
              <div className="bg-[#FFEDD5] dark:bg-[#F59E0B]/10 rounded-xl p-6 border-l-4 border-[#F59E0B] flex flex-col">
                <h3 className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">Room Limit Per Day</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed mb-4 flex-grow">
                  Most critical. Hotels charge ₹4k–8k/day in metros. A ₹2k room cap means you pay the gap. Higher is better.
                </p>
                <div className="space-y-2 pt-2 border-t border-[#F59E0B]/20">
                  <div className="text-sm font-semibold text-[#EF4444] flex items-start gap-2">
                    <span>🚩</span>
                    <span>Room limit ₹2k or less in metro cities</span>
                  </div>
                  <div className="text-sm font-semibold text-[#10B981] flex items-start gap-2">
                    <span>✓</span>
                    <span>Room limit ₹5k+ (metro-realistic)</span>
                  </div>
                </div>
              </div>

              {/* Co-pay */}
              <div className="bg-[#DDD6FE] dark:bg-[#A78BFA]/10 rounded-xl p-6 border-l-4 border-[#A78BFA] flex flex-col">
                <h3 className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">Co-pay %</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed mb-4 flex-grow">
                  You pay this % after hitting room limits. Lower is better. 0% co-pay is ideal but rare.
                </p>
                <div className="space-y-2 pt-2 border-t border-[#A78BFA]/20">
                  <div className="text-sm font-semibold text-[#EF4444] flex items-start gap-2">
                    <span>🚩</span>
                    <span>Co-pay 30%+ or applies to all claims</span>
                  </div>
                  <div className="text-sm font-semibold text-[#10B981] flex items-start gap-2">
                    <span>✓</span>
                    <span>0% co-pay or co-pay only on specific treatments</span>
                  </div>
                </div>
              </div>

              {/* Exclusions */}
              <div className="bg-[#ECFDF5] dark:bg-[#10B981]/10 rounded-xl p-6 border-l-4 border-[#10B981] flex flex-col">
                <h3 className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">Exclusions & Waiting Periods</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed mb-4 flex-grow">
                  Pre-existing conditions (usually 2–4 years), maternity (10–12 months), certain surgeries. Compare waiting periods; shorter is better.
                </p>
                <div className="space-y-2 pt-2 border-t border-[#10B981]/20">
                  <div className="text-sm font-semibold text-[#EF4444] flex items-start gap-2">
                    <span>🚩</span>
                    <span>Maternity waiting period &gt; 2 years; no maternity coverage</span>
                  </div>
                  <div className="text-sm font-semibold text-[#10B981] flex items-start gap-2">
                    <span>✓</span>
                    <span>Maternity covered after 10 months; pre-existing after 2 years</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Typical Comparison Results Section */}
        <section className="relative z-10 py-10 md:py-12 px-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-12">
              Example: Three Popular Plans Compared
            </h2>

            <div className="overflow-x-auto mb-8">
              <table className="w-full border-collapse bg-white dark:bg-[#0F1419] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                <thead>
                  <tr className="bg-[#0F1419] dark:bg-[#0F1419] text-white">
                    <th className="text-left p-4 text-xs font-semibold">Feature</th>
                    <th className="text-center p-4 text-xs font-semibold">Policy A</th>
                    <th className="text-center p-4 text-xs font-semibold">Policy B</th>
                    <th className="text-center p-4 text-xs font-semibold">Policy C</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0F1419] even:bg-[#F9FAFB] dark:even:bg-[#1F2937]">
                    <td className="p-4 text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">Coverage Limit</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">₹3 lakh</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">₹5 lakh</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">₹10 lakh</td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0F1419] even:bg-[#F9FAFB] dark:even:bg-[#1F2937]">
                    <td className="p-4 text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">Room Limit/Day</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">₹2k</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">₹4k</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">₹5k</td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0F1419] even:bg-[#F9FAFB] dark:even:bg-[#1F2937]">
                    <td className="p-4 text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">Co-pay</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">20%</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">15%</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">10%</td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0F1419] even:bg-[#F9FAFB] dark:even:bg-[#1F2937]">
                    <td className="p-4 text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">Maternity</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">Not covered</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">₹1.5L rider (extra ₹2k/yr)</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">₹2L included</td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0F1419] even:bg-[#F9FAFB] dark:even:bg-[#1F2937]">
                    <td className="p-4 text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">Pre-existing</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">4 years</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">3 years</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">2 years</td>
                  </tr>
                  <tr className="bg-white dark:bg-[#0F1419] even:bg-[#F9FAFB] dark:even:bg-[#1F2937]">
                    <td className="p-4 text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">Annual Premium</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">₹8k</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">₹12k</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">₹18k</td>
                  </tr>
                  <tr className="bg-[#F9FAFB] dark:bg-[#1F2937]">
                    <td className="p-4 text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">Best For</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">Budget-conscious</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">Balanced</td>
                    <td className="p-4 text-xs text-center text-[#6B7280] dark:text-[#D1D5DB]">Comprehensive</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-[#EFF6FF] dark:bg-[#00B4D8]/20 rounded-xl p-6 border-l-4 border-[#00B4D8]">
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                <strong className="text-[#0F1419] dark:text-[#FAFBFC]">Verdict:</strong> Policy B offers the best balance of room limit, co-pay, and premium. Policy C is best if you need maternity and don't mind higher premiums. Policy A is risky for metro residents due to low room limit.
              </p>
            </div>
          </div>
        </section>
        </>
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}

