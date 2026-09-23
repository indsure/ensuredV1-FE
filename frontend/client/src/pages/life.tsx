import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  ChevronRight,
  ArrowRight,
  Lock,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calculator,
  Scale,
  Lightbulb,
  Shield,
  Info,
  ChevronDown,
  Brain,
  DollarSign,
  TrendingUp,
  CreditCard,
  Clock3,
  CheckCircle,
  AlertTriangle,
  Target,
  Zap,
  Users,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useLanguage } from "@/i18n/LanguageContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { SchemaMarkup, createFAQSchema } from "@/components/SEO";
import { loadSampleReport, mockReportLife } from "@/lib/mock-data";

export default function LifePage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  // SEO
  useSEO({
    title: "Life & Term Insurance Policy Checker: Sum Assured, Riders, Claims | IndSure",
    description: "Upload your life or term insurance PDF and instantly see whether your sum assured is enough for your family, plus claim conditions, exclusions, and how your riders actually protect you. Free and private.",
    keywords: "life insurance analyzer, term life insurance, life insurance policy checker, sum assured calculator, life insurance riders",
    canonical: "/life",
  });

  // FAQ Schema
  const faqData = createFAQSchema([
    {
      question: "How do you analyze policies?",
      answer: "The engine reads your policy PDF clause by clause and pulls out the key terms: sum assured, riders, claim conditions, exclusions, waiting periods, maturity age and so on. Then it turns them into a plain-language verdict.",
    },
    {
      question: "Is my data safe?",
      answer: "Yes. Your document is stored so you can open and download it again from your portfolio, and it is encrypted in transit. We never sell it and never pass it to an insurer or an advisor unless you ask us to. You can delete any policy, and the file behind it, whenever you want.",
    },
    {
      question: "What if my policy is unusual or custom?",
      answer: "We handle standard term life, whole life, and endowment policies. Custom policies with unusual terms may need manual cross-checking with your insurer, and we flag this in the report.",
    },
    {
      question: "Can I download my analysis?",
      answer: "Yes. Your full verdict, findings, and recommendations are downloadable as PDF, shareable with family, advisors, or agents.",
    },
  ]);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);

  // Analysis now requires a free account (D2C hard wall). Dropping a file
  // funnels the visitor to signup rather than running the retired anonymous
  // analyze path. The upload card below is kept as-is pending the LoB-page
  // redesign; it simply routes here.
  const onDrop = (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    setLocation("/signup");
  };

  const dropzoneOptions = {
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "text/plain": [".txt"]
    },
    multiple: false,
    disabled: uploading,
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions as any);

  return (
    <div className="min-h-screen bg-[#F0FFFE] dark:bg-[#0F1419] flex flex-col relative">
      <SchemaMarkup type="FAQPage" data={faqData} />
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 -left-40 w-80 h-80 bg-blue-400/30 dark:bg-blue-500/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -right-40 w-96 h-96 bg-cyan-400/30 dark:bg-cyan-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-400/25 dark:bg-teal-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-indigo-400/20 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>
      <Header />

      {/* Hero Section with Upload on Right */}
      <section className="relative z-10 pt-32 sm:pt-36 md:pt-40 pb-10 md:pb-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left: Content */}
            <div className="flex flex-col justify-center">
              <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold text-black dark:text-[#FAFBFC] mb-5 leading-[1.1] tracking-[-0.02em]">
                {t("lobp.l_h")}
              </h1>
              <p className="text-lg md:text-xl text-[#4B5563] dark:text-[#D1D5DB] mb-6 leading-relaxed">
                {t("lobp.l_sub")}
              </p>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF]">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#00B4D8]" />
                  <span>{t("lobp.irdai")}</span>
                </div>
                <span className="text-[#9CA3AF]">•</span>
                <span>{t("lobp.every_clause")}</span>
                <span className="text-[#9CA3AF]">•</span>
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>{t("lobp.private100")}</span>
                </div>
                <span className="text-[#9CA3AF]">•</span>
                {/* claim-source: backend/server/routes.ts:772-798 (FREE_SLOTS_PER_TYPE is the only gate; the 30-day trial gate was removed). Verified 2026-09-07. */}
                <span>{t("lobp.free_forever")}</span>
              </div>

              {/* Feature highlights */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#00B4D8] rounded-full"></div>
                  <span className="text-sm font-medium text-[#0F1419] dark:text-[#FAFBFC]">{t("lobp.sixty")}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#10B981] rounded-full"></div>
                  <span className="text-sm font-medium text-[#0F1419] dark:text-[#FAFBFC]">{t("lobp.l_sa_gaps")}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#00B4D8] rounded-full"></div>
                  <span className="text-sm font-medium text-[#0F1419] dark:text-[#FAFBFC]">{t("lobp.downloadable")}</span>
                </div>
              </div>
            </div>

            {/* Right: Upload Card */}
            <div className="lg:sticky lg:top-24">
              {error && (
                <div className="mb-4 rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">{t("lobp.upload_failed")}</p>
                      <p className="text-xs text-red-700 dark:text-red-300 mb-2">{error}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setError(null);
                            setSelectedFile(null);
                            setFileSize(null);
                          }}
                          className="border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-xs h-7"
                        >
                          {t("lobp.dismiss")}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setError(null);
                            setSelectedFile(null);
                            setFileSize(null);
                            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                            if (fileInput) fileInput.click();
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs h-7"
                        >
                          {t("lobp.try_again")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Card */}
              <div
                {...getRootProps()}
                className={`relative group transition-all duration-300 ${uploading
                    ? "cursor-wait"
                    : isDragActive
                      ? "scale-[1.01]"
                      : "hover:scale-[1.005] cursor-pointer"
                  }`}
              >
                {/* Subtle glow on hover */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#00B4D8]/20 via-[#10B981]/20 to-[#00B4D8]/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>

                <div className={`relative bg-white dark:bg-[#1F2937] rounded-2xl border-2 transition-all shadow-xl ${isDragActive
                    ? "border-[#00B4D8] dark:border-[#00B4D8] bg-[#EFF6FF] dark:bg-[#00B4D8]/10 ring-4 ring-[#00B4D8]/20"
                    : selectedFile && !uploading
                      ? "border-[#10B981] dark:border-[#10B981] bg-[#F0FDF4] dark:bg-[#10B981]/10"
                      : "border-gray-200 dark:border-gray-700 hover:border-[#00B4D8] dark:hover:border-[#00B4D8] hover:shadow-2xl"
                  }`}>
                  {/* @ts-ignore */}
                  <input {...getInputProps()} />

                  <div className="p-8">
                    {selectedFile && !uploading ? (
                      <div className="flex flex-col items-center justify-center gap-4 text-center">
                        <div className="relative">
                          <div className="absolute inset-0 bg-[#10B981] rounded-2xl blur-2xl opacity-20 animate-pulse"></div>
                          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#3CBBA0] flex items-center justify-center shadow-xl">
                            <CheckCircle2 className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC]">{t("lobp.file_selected")}</p>
                          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono bg-[#F3F4F6] dark:bg-[#0F1419] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                            {selectedFile.name}
                          </p>
                          {fileSize && (
                            <p className="text-xs text-[#9CA3AF] dark:text-[#6B7280]">{t("lobp.size", { size: fileSize })}</p>
                          )}
                        </div>
                      </div>
                    ) : uploading ? (
                      <div className="flex flex-col items-center justify-center gap-4 text-center">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-[#00B4D8]/20 border-t-[#00B4D8] rounded-full animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-[#00B4D8]" />
                          </div>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-1">{t("lobp.analyzing")}</p>
                          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t("lobp.reading")}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-5 text-center">
                        {/* Upload Icon */}
                        <div className="relative">
                          <div className="absolute inset-0 bg-[#00B4D8] rounded-2xl blur-2xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00B4D8] to-[#10B981] flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
                            <Upload className="w-10 h-10 text-white" />
                          </div>
                        </div>

                        {/* Main text */}
                        <div className="space-y-2">
                          <p className="text-xl font-bold text-[#0F1419] dark:text-[#FAFBFC]">{t("lobp.drop")}</p>
                          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                            {t("lobp.or")} <span className="text-[#00B4D8] dark:text-[#00B4D8] font-semibold hover:underline">{t("lobp.browse")}</span>
                          </p>
                        </div>

                        {/* File info */}
                        <div className="w-full space-y-2 pt-2">
                          <p className="text-xs text-[#9CA3AF] dark:text-[#6B7280]">
                            {t("lobp.formats")}
                          </p>
                          <div className="flex flex-wrap justify-center gap-2">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F4F6] dark:bg-[#0F1419] rounded-full border border-gray-200 dark:border-gray-700">
                              <Clock className="w-3.5 h-3.5 text-[#00B4D8]" />
                              <span className="text-xs font-medium text-[#0F1419] dark:text-[#FAFBFC]">~60s</span>
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F4F6] dark:bg-[#0F1419] rounded-full border border-gray-200 dark:border-gray-700">
                              <Lock className="w-3.5 h-3.5 text-[#10B981]" />
                              <span className="text-xs font-medium text-[#0F1419] dark:text-[#FAFBFC]">{t("lobp.private")}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); loadSampleReport(mockReportLife); setLocation("/report?sample=life"); }}
                            className="mt-4 min-h-11 text-sm font-semibold text-[#00B4D8] hover:text-[#0099B4] hover:underline inline-flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            {t("lobp.l_sample")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How IndSure Works Section */}
      <section className="relative z-10 py-8 md:py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-[48px] font-semibold text-center text-black dark:text-[#FAFBFC] mb-12 md:mb-16 leading-[1.15] tracking-[-0.01em]">
            {t("lobp.three_steps")}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto relative">
            {/* Connector Line 1-2 - Desktop only */}
            <div className="hidden md:block absolute top-[104px] left-[calc(16.666%+2rem)] w-[calc(33.333%-1rem)] h-0.5 bg-[#00B4D8] opacity-60" />

            {/* Connector Line 2-3 - Desktop only */}
            <div className="hidden md:block absolute top-[104px] left-[calc(50%+2rem)] w-[calc(33.333%-1rem)] h-0.5 bg-[#00B4D8] opacity-60" />

            {/* Step 1 */}
            <div className="text-center relative z-10">
              <div className="relative mb-8">
                {/* Numbered Badge */}
                <div className="w-20 h-20 rounded-full bg-[#0F1419] dark:bg-[#00B4D8] text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                  1
                </div>
                {/* Icon Box */}
                <div className="w-16 h-16 rounded-2xl bg-[#00B4D8]/10 dark:bg-[#00B4D8]/20 flex items-center justify-center mx-auto border border-[#00B4D8]/20 dark:border-[#00B4D8]/30">
                  <Upload className="w-8 h-8 text-[#00B4D8]" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">{t("lobp.upload_policy")}</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                {t("lobp.pdf_only")}
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center relative z-10">
              <div className="relative mb-8">
                {/* Numbered Badge */}
                <div className="w-20 h-20 rounded-full bg-[#0F1419] dark:bg-[#00B4D8] text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                  2
                </div>
                {/* Icon Box */}
                <div className="w-16 h-16 rounded-2xl bg-[#00B4D8]/10 dark:bg-[#00B4D8]/20 flex items-center justify-center mx-auto border border-[#00B4D8]/20 dark:border-[#00B4D8]/30">
                  <Brain className="w-8 h-8 text-[#00B4D8]" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">{t("lobp.we_analyze")}</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                {t("lobp.l_reads")}
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center relative z-10">
              <div className="relative mb-8">
                {/* Numbered Badge */}
                <div className="w-20 h-20 rounded-full bg-[#0F1419] dark:bg-[#00B4D8] text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                  3
                </div>
                {/* Icon Box */}
                <div className="w-16 h-16 rounded-2xl bg-[#00B4D8]/10 dark:bg-[#00B4D8]/20 flex items-center justify-center mx-auto border border-[#00B4D8]/20 dark:border-[#00B4D8]/30">
                  <Lightbulb className="w-8 h-8 text-[#00B4D8]" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">{t("lobp.you_understand")}</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                {t("lobp.l_verdict")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What You'll Discover Section */}
      <section className="relative z-10 py-10 md:py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-8">
            {t("lobp.understand_after")}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sum Assured Adequacy */}
            <div className="relative group bg-gradient-to-br from-white via-blue-50/30 to-white dark:from-gray-800 dark:via-blue-950/20 dark:to-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              {/* Glow effect on hover */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00B4D8]/20 to-[#10B981]/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
              {/* Decorative elements */}
              <div className="absolute top-2 right-2 w-16 h-16 bg-blue-400/10 dark:bg-blue-500/5 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00B4D8]/20 to-[#10B981]/20 dark:from-[#00B4D8]/20 dark:to-[#10B981]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="w-6 h-6 text-[#00B4D8]" />
                </div>
                <h3 className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">{t("lobp.l_sa")}</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                  {t("lobp.l_1cr")}
                </p>
              </div>
            </div>

            {/* Claim Conditions */}
            <div className="relative group bg-gradient-to-br from-white via-cyan-50/30 to-white dark:from-gray-800 dark:via-cyan-950/20 dark:to-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              {/* Glow effect on hover */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#10B981]/20 to-[#00B4D8]/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
              {/* Decorative elements */}
              <div className="absolute top-2 right-2 w-16 h-16 bg-cyan-400/10 dark:bg-cyan-500/5 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#10B981]/20 to-[#00B4D8]/20 dark:from-[#10B981]/20 dark:to-[#00B4D8]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-6 h-6 text-[#10B981]" />
                </div>
                <h3 className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">{t("lobp.l_claim")}</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                  {t("lobp.l_claim_d")}
                </p>
              </div>
            </div>

            {/* Riders & Protection */}
            <div className="relative group bg-gradient-to-br from-white via-teal-50/30 to-white dark:from-gray-800 dark:via-teal-950/20 dark:to-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              {/* Glow effect on hover */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#F59E0B]/20 to-[#EF4444]/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
              {/* Decorative elements */}
              <div className="absolute top-2 right-2 w-16 h-16 bg-orange-400/10 dark:bg-orange-500/5 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F59E0B]/20 to-[#EF4444]/20 dark:from-[#F59E0B]/20 dark:to-[#EF4444]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-6 h-6 text-[#F59E0B]" />
                </div>
                <h3 className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">{t("lobp.l_riders")}</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                  {t("lobp.l_riders_d")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative z-10 py-10 md:py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-8">
            {t("lobp.questions")}
          </h2>

          <div className="space-y-3">
            <details className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <summary className="flex min-h-11 items-center justify-between gap-3 cursor-pointer list-none">
                <span className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC]">{t("lobp.q_how")}</span>
                <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="mt-3 text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                {t("lobp.l_a_how")}
              </p>
            </details>

            <details className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <summary className="flex min-h-11 items-center justify-between gap-3 cursor-pointer list-none">
                <span className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC]">{t("lobp.q_safe")}</span>
                <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="mt-3 text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                {t("lobp.a_safe")}
              </p>
            </details>

            <details className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <summary className="flex min-h-11 items-center justify-between gap-3 cursor-pointer list-none">
                <span className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC]">{t("lobp.q_custom")}</span>
                <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="mt-3 text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                {t("lobp.l_a_custom")}
              </p>
            </details>

            <details className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <summary className="flex min-h-11 items-center justify-between gap-3 cursor-pointer list-none">
                <span className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC]">{t("lobp.q_download")}</span>
                <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="mt-3 text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                {t("lobp.a_download")}
              </p>
            </details>

            <details className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <summary className="flex min-h-11 items-center justify-between gap-3 cursor-pointer list-none">
                <span className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC]">{t("lobp.q_disagree")}</span>
                <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="mt-3 text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                {t("lobp.a_disagree")}
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* Next Steps Section */}
      <section className="relative z-10 py-10 md:py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-8">
            {t("lobp.now_what")}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Calculate Needs */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#00B4D8]/10 flex items-center justify-center mx-auto mb-4">
                <Calculator className="w-6 h-6 text-[#00B4D8]" />
              </div>
              <h3 className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">{t("lobp.l_calc")}</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] mb-4 leading-relaxed">
                {t("lobp.l_gaps")}
              </p>
              <Button
                variant="outline"
                onClick={() => setLocation("/calculator?type=life")}
                className="border-gray-300 dark:border-gray-600"
              >
                {t("lobp.l_calc")}
              </Button>
            </div>

            {/* Compare Policies */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 text-center hover:shadow-lg transition-shadow duration-200">
              <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 flex items-center justify-center mx-auto mb-4">
                <Scale className="w-6 h-6 text-[#10B981]" />
              </div>
              <h3 className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">{t("lobp.compare_alt")}</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] mb-5 leading-relaxed">
                {t("lobp.l_switch")}
              </p>
              <Button
                onClick={() => setLocation("/compare?type=life")}
                className="bg-[#10B981] hover:bg-[#059669] text-white font-semibold h-10 px-5"
              >
                {t("lobp.compare_pol")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Share Analysis */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#00B4D8]/10 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-[#00B4D8]" />
              </div>
              <h3 className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">{t("lobp.share")}</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] mb-4 leading-relaxed">
                {t("lobp.share_d")}
              </p>
              <Button
                variant="outline"
                disabled
                className="border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed"
              >
                {t("lobp.download_report")}
              </Button>
            </div>
          </div>
        </div>
      </section>


      <Footer />
    </div>
  );
}
