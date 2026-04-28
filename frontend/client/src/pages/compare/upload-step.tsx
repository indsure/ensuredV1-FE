import { useState, useEffect } from "react";
import { getApiBase } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
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
      ? "Compare Term Life Insurance Plans | Best Life Insurance Comparison | IndSure"
      : compareType === "term"
        ? "Compare Term Life Insurance Plans | Pure Protection Comparison | IndSure"
        : compareType === "vehicle"
          ? "Compare Vehicle Insurance Plans | Car Insurance Comparison | IndSure"
          : "Compare Health Insurance Policies Side-by-Side | IndSure",
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
          sessionStorage.removeItem("IndSure_comparison_policies");
          sessionStorage.removeItem("IndSure_comparison_profile");
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
          return prev;
        }
        policyFile = policy.file;
        return prev;
      });
    }

    if (!policyFile) {
      return;
    }

    setPolicies((prev) =>
      prev.map((p) =>
        p.id === policyId ? { ...p, status: "uploading", progress: "Uploading file...", progressPercent: 5 } : p
      )
    );

    let uploadProgressInterval: ReturnType<typeof setInterval> | null = null;
    let extractionProgressInterval: ReturnType<typeof setInterval> | null = null;

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

      const response = await apiFetch("/api/extract-policy", {
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
      <section className="relative z-10 bg-gradient-to-b from-[#FAFBFC] to-white dark:from-[#0F1419] dark:to-[#1F2937] pt-32 sm:pt-36 md:pt-40 pb-16 md:pb-20 px-4 sm:px-6">
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
              Compare up to 4 policies side-by-side
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

      <main id="upload-section" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-6 sm:pb-8">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-1 bg-[#E5E7EB] dark:bg-[#374151] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00B4D8] to-[#10B981] rounded-full transition-all duration-600 ease-out"
              style={{ width: '33%' }}
            />
          </div>
        </div>

        {/* Upload Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">
            Upload Your Policies
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
            Drag PDFs anywhere, or click a slot to browse
          </p>

          {/* Four Upload Slots */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {[0, 1, 2, 3].map((slotIndex) => {
              const policy = policies[slotIndex];
              const isEmpty = !policy;
              
              return (
                <div
                  key={slotIndex}
                  {...(isEmpty ? getRootProps() : {})}
                  className={`relative h-36 rounded-xl border-2 transition-all ${
                    isEmpty
                      ? isDragActive
                        ? "border-[#00B4D8] border-solid bg-[#00B4D8]/10 shadow-lg shadow-[#00B4D8]/20"
                        : "border-[#00B4D8] border-dashed hover:border-solid hover:bg-[#00B4D8]/5 hover:shadow-md cursor-pointer"
                      : "border-[#00B4D8] border-solid bg-[#00B4D8]/5"
                  } ${policies.length >= 4 && isEmpty ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isEmpty && <input {...getInputProps()} />}
                  
                  {isEmpty ? (
                    <div className="flex flex-col items-center justify-center h-full p-4">
                      <Upload className="w-8 h-8 text-[#00B4D8] mb-2" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Policy {slotIndex + 1}
                      </span>
                      {isDragActive && (
                        <span className="text-xs text-[#00B4D8] mt-1">Drop here</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-4 relative">
                      {/* Remove button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePolicy(policy.id)}
                        className="absolute top-1 right-1 h-6 w-6 hover:bg-red-100 dark:hover:bg-red-900/20"
                        aria-label={`Remove ${policy.file.name}`}
                      >
                        <X className="w-3 h-3 text-gray-500 hover:text-red-600" />
                      </Button>

                      {/* Status indicator */}
                      {policy.status === "success" && (
                        <CheckCircle2 className="absolute top-1 left-1 w-5 h-5 text-green-600 dark:text-green-400" />
                      )}

                      {/* Content */}
                      {policy.status === "uploading" || policy.status === "extracting" ? (
                        <div className="flex flex-col items-center">
                          <CircularProgress progress={policy.progressPercent || 0} size={40} />
                          <span className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">
                            {policy.progressPercent && policy.progressPercent < 50 ? "Uploading..." : "Extracting..."}
                          </span>
                        </div>
                      ) : (
                        <>
                          <FileText className="w-8 h-8 text-[#00B4D8] mb-2" />
                          <span className="text-xs font-medium text-gray-900 dark:text-gray-100 text-center truncate w-full px-2">
                            {policy.file.name.length > 20 ? policy.file.name.substring(0, 20) + "..." : policy.file.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {(policy.file.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                          {policy.status === "error" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => extractPolicy(policy.id)}
                              className="text-xs mt-2 h-6 px-2"
                            >
                              Retry
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* File requirements and trust line */}
          <div className="text-center space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              PDF only • Max 10MB each
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
              <span>🔒</span>
              <span>Your documents are processed securely and deleted after analysis. We never share your data.</span>
            </p>
          </div>

          {/* Primary CTA */}
          <div className="mt-6 text-center">
            <Button
              onClick={() => setLocation("/compare/profile")}
              disabled={!canProceed}
              className="bg-[#00B4D8] hover:bg-[#0099B4] text-white font-semibold h-12 px-8 text-base shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {policies.length === 0
                ? "Upload at least 2 policies to compare"
                : policies.length === 1
                  ? "Add 1 more to compare"
                  : `Compare ${policies.length} Policies →`}
            </Button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Free • No signup required
            </p>
          </div>

          {/* Scroll to example link */}
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                const exampleSection = document.getElementById('example-comparison');
                if (exampleSection) {
                  exampleSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="text-sm text-[#00B4D8] hover:text-[#0099B4] dark:text-cyan-400 dark:hover:text-cyan-300 underline"
            >
              See what a comparison looks like ↓
            </button>
          </div>
        </div>

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
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-l-4 border-[#00B4D8] flex flex-col shadow-sm">
                  <h3 className="text-base font-semibold text-[#00B4D8] mb-3">Total Coverage Limit</h3>
                  <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed mb-4 flex-grow">
                    ₹5L, ₹10L, ₹15L? Higher is generally better, but look at room limits too. A ₹10L limit with a ₹1.5k room cap may not be better than ₹5L with ₹5k cap.
                  </p>
                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
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
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-l-4 border-[#F59E0B] flex flex-col shadow-sm">
                  <h3 className="text-base font-semibold text-[#F59E0B] mb-3">Room Limit Per Day</h3>
                  <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed mb-4 flex-grow">
                    Most critical. Hotels charge ₹4k–8k/day in metros. A ₹2k room cap means you pay the gap. Higher is better.
                  </p>
                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
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
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-l-4 border-[#6366F1] flex flex-col shadow-sm">
                  <h3 className="text-base font-semibold text-[#6366F1] mb-3">Co-pay %</h3>
                  <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed mb-4 flex-grow">
                    You pay this % after hitting room limits. Lower is better. 0% co-pay is ideal but rare.
                  </p>
                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
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
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-l-4 border-[#10B981] flex flex-col shadow-sm">
                  <h3 className="text-base font-semibold text-[#10B981] mb-3">Exclusions & Waiting Periods</h3>
                  <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed mb-4 flex-grow">
                    Pre-existing conditions (usually 2–4 years), maternity (10–12 months), certain surgeries. Compare waiting periods; shorter is better.
                  </p>
                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
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
          <section id="example-comparison" className="relative z-10 py-10 md:py-12 px-6">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-bold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-12">
                Example: Three Popular Plans Compared
              </h2>

              <div className="overflow-x-auto mb-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg">
                <table className="w-full border-collapse bg-white dark:bg-[#0F1419]">
                  <thead>
                    <tr className="bg-[#0F1419] dark:bg-[#0F1419] text-white">
                      <th className="text-left p-4 text-sm font-semibold sticky left-0 bg-[#0F1419] z-10">Feature</th>
                      <th className="text-center p-4 text-sm font-semibold">
                        <div className="flex flex-col items-center gap-2">
                          <span>Policy A</span>
                        </div>
                      </th>
                      <th className="text-center p-4 text-sm font-semibold">
                        <div className="flex flex-col items-center gap-2">
                          <span>Policy B</span>
                        </div>
                      </th>
                      <th className="text-center p-4 text-sm font-semibold relative">
                        <div className="flex flex-col items-center gap-2">
                          <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#00B4D8] text-white text-xs font-semibold rounded-full mb-1">
                            RECOMMENDED
                          </span>
                          <span>Policy C</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-[#00B4D8]/5 transition-colors">
                      <td className="p-4 text-sm font-semibold text-[#0F1419] dark:text-[#FAFBFC] sticky left-0 bg-white dark:bg-[#0F1419]">Coverage Limit</td>
                      <td className="p-4 text-sm text-center text-[#6B7280] dark:text-[#D1D5DB]">₹3 lakh</td>
                      <td className="p-4 text-sm text-center text-[#6B7280] dark:text-[#D1D5DB]">₹5 lakh</td>
                      <td className="p-4 text-sm text-center bg-green-50 dark:bg-green-900/20">
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-[#0F1419] dark:text-[#FAFBFC] font-medium">₹10 lakh</span>
                        </div>
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-[#F9FAFB] dark:bg-[#1F2937] hover:bg-[#00B4D8]/5 transition-colors">
                      <td className="p-4 text-sm font-semibold text-[#0F1419] dark:text-[#FAFBFC] sticky left-0 bg-[#F9FAFB] dark:bg-[#1F2937]">Room Limit/Day</td>
                      <td className="p-4 text-sm text-center bg-red-50 dark:bg-red-900/20">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-red-600 dark:text-red-400">🚩</span>
                          <span className="text-[#0F1419] dark:text-[#FAFBFC]">₹2k</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-center text-[#6B7280] dark:text-[#D1D5DB]">₹4k</td>
                      <td className="p-4 text-sm text-center bg-green-50 dark:bg-green-900/20">
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-[#0F1419] dark:text-[#FAFBFC] font-medium">₹5k</span>
                        </div>
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-[#00B4D8]/5 transition-colors">
                      <td className="p-4 text-sm font-semibold text-[#0F1419] dark:text-[#FAFBFC] sticky left-0 bg-white dark:bg-[#0F1419]">Co-pay</td>
                      <td className="p-4 text-sm text-center bg-red-50 dark:bg-red-900/20">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-red-600 dark:text-red-400">🚩</span>
                          <span className="text-[#0F1419] dark:text-[#FAFBFC]">20%</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-center text-[#6B7280] dark:text-[#D1D5DB]">15%</td>
                      <td className="p-4 text-sm text-center bg-green-50 dark:bg-green-900/20">
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-[#0F1419] dark:text-[#FAFBFC] font-medium">10%</span>
                        </div>
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-[#F9FAFB] dark:bg-[#1F2937] hover:bg-[#00B4D8]/5 transition-colors">
                      <td className="p-4 text-sm font-semibold text-[#0F1419] dark:text-[#FAFBFC] sticky left-0 bg-[#F9FAFB] dark:bg-[#1F2937]">Maternity</td>
                      <td className="p-4 text-sm text-center text-[#6B7280] dark:text-[#D1D5DB]">Not covered</td>
                      <td className="p-4 text-sm text-center text-[#6B7280] dark:text-[#D1D5DB]">₹1.5L rider (extra ₹2k/yr)</td>
                      <td className="p-4 text-sm text-center text-[#0F1419] dark:text-[#FAFBFC] font-medium">₹2L included</td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-[#00B4D8]/5 transition-colors">
                      <td className="p-4 text-sm font-semibold text-[#0F1419] dark:text-[#FAFBFC] sticky left-0 bg-white dark:bg-[#0F1419]">Pre-existing</td>
                      <td className="p-4 text-sm text-center bg-red-50 dark:bg-red-900/20">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-red-600 dark:text-red-400">🚩</span>
                          <span className="text-[#0F1419] dark:text-[#FAFBFC]">4 years</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-center text-[#6B7280] dark:text-[#D1D5DB]">3 years</td>
                      <td className="p-4 text-sm text-center bg-green-50 dark:bg-green-900/20">
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-[#0F1419] dark:text-[#FAFBFC] font-medium">2 years</span>
                        </div>
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-[#F9FAFB] dark:bg-[#1F2937] hover:bg-[#00B4D8]/5 transition-colors">
                      <td className="p-4 text-sm font-semibold text-[#0F1419] dark:text-[#FAFBFC] sticky left-0 bg-[#F9FAFB] dark:bg-[#1F2937]">Annual Premium</td>
                      <td className="p-4 text-sm text-center bg-green-50 dark:bg-green-900/20">
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-[#0F1419] dark:text-[#FAFBFC] font-medium">₹8k</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-center text-[#6B7280] dark:text-[#D1D5DB]">₹12k</td>
                      <td className="p-4 text-sm text-center bg-red-50 dark:bg-red-900/20">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-red-600 dark:text-red-400">🚩</span>
                          <span className="text-[#0F1419] dark:text-[#FAFBFC]">₹18k</span>
                        </div>
                      </td>
                    </tr>
                    <tr className="hover:bg-[#00B4D8]/5 transition-colors">
                      <td className="p-4 text-sm font-semibold text-[#0F1419] dark:text-[#FAFBFC] sticky left-0 bg-white dark:bg-[#0F1419]">Best For</td>
                      <td className="p-4 text-sm text-center text-[#6B7280] dark:text-[#D1D5DB]">Budget-conscious</td>
                      <td className="p-4 text-sm text-center text-[#6B7280] dark:text-[#D1D5DB]">Balanced</td>
                      <td className="p-4 text-sm text-center text-[#0F1419] dark:text-[#FAFBFC] font-medium">Comprehensive</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-[#EFF6FF] dark:bg-[#00B4D8]/20 rounded-xl p-6 border-l-4 border-[#00B4D8]">
                <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                  <strong className="text-[#0F1419] dark:text-[#FAFBFC]">Verdict:</strong> Policy C offers the best overall coverage with highest limits and shortest waiting periods, making it ideal for comprehensive protection. Policy B provides good balance for those seeking moderate coverage. Policy A is risky for metro residents due to low room limit and high co-pay.
                </p>
              </div>
            </div>
          </section>

          {/* Ready to Compare CTA Section */}
          <section className="relative z-10 py-12 md:py-16 px-6 bg-gradient-to-b from-white to-[#F0FFFE] dark:from-[#0F1419] dark:to-[#1F2937]">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                Ready to compare your own policies?
              </h2>
              <p className="text-lg text-[#6B7280] dark:text-[#D1D5DB] mb-8">
                Free, no signup required. Results in 30 seconds.
              </p>
              <Button
                onClick={() => {
                  const uploadSection = document.getElementById('upload-section');
                  if (uploadSection) {
                    uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="bg-[#00B4D8] hover:bg-[#0099B4] text-white font-semibold h-12 px-8 text-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Upload Your Policies →
              </Button>
            </div>
          </section>
        </>
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}

