import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  DollarSign,
  TrendingUp,
  CreditCard,
  Clock3,
  Shield,
  CheckCircle,
  AlertTriangle,
  Target,
  Zap,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { seoFor } from "@/data/seo-pages";
import { PAGE_FAQS } from "@/data/page-faqs";
import { useLanguage } from "@/i18n/LanguageContext";

import { loadSampleReport, mockReportLife } from "@/lib/mock-data";

// TermAnalyzer Component
function TermAnalyzer() {
  const [, setLocation] = useLocation();
  const [uploading] = useState(false);
  const [error] = useState<string | null>(null);
  const [selectedFile] = useState<File | null>(null);

  // Analysis now requires a free account (D2C hard wall). Dropping a file
  // funnels to signup rather than the retired anonymous analyze path.
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
    },
    multiple: false,
    disabled: uploading,
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions as any);

  return (
    <div className="max-w-[600px] mx-auto">
      {error && (
        <div className="mb-4 rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">Upload Failed</p>
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div
        {...getRootProps()}
        className={`relative transition-all duration-300 ${uploading
            ? "cursor-wait"
            : isDragActive
              ? "scale-[1.01]"
              : "hover:scale-[1.005] cursor-pointer"
          }`}
      >
        <div className={`relative bg-white dark:bg-[#1F2937] rounded-xl border-2 transition-all ${isDragActive
            ? "border-[#00B4D8] dark:border-[#00B4D8] bg-[#F0FFFE] dark:bg-[#00B4D8]/10 ring-4 ring-[#00B4D8]/20"
            : selectedFile && !uploading
              ? "border-[#10B981] dark:border-[#10B981] bg-[#F0FFFE] dark:bg-[#10B981]/10"
              : "border-[#00B4D8] dark:border-[#00B4D8] bg-[#F0FFFE] dark:bg-[#00B4D8]/5 hover:bg-[#E0F7FA] dark:hover:bg-[#00B4D8]/10"
          }`}>
          <input {...getInputProps()} />

          <div className="p-10 min-h-[150px] flex flex-col items-center justify-center text-center">
            {selectedFile && !uploading ? (
              <div className="flex flex-col items-center gap-4">
                <CheckCircle2 className="w-12 h-12 text-[#10B981]" />
                <div>
                  <p className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC]">File Selected</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">{selectedFile.name}</p>
                </div>
              </div>
            ) : uploading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-[#00B4D8]/20 border-t-[#00B4D8] rounded-full animate-spin"></div>
                <div>
                  <p className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC]">Analyzing your term policy...</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <FileText className="w-12 h-12 text-[#00B4D8]" />
                <div>
                  <p className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
                    📄 Click or drag policy here
                  </p>
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                    PDF, JPG, or PNG (max 10MB)
                  </p>
                </div>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); loadSampleReport(mockReportLife); setLocation("/report?sample=life"); }}
                    className="mt-2 text-sm font-semibold text-[#00B4D8] hover:text-[#0099B4] hover:underline inline-flex items-center gap-2"
                >
                    <FileText className="w-4 h-4" />
                    View sample term life analysis directly
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TermPage() {
  const [, setLocation] = useLocation();

  // SEO
  useSEO(seoFor("/term"));

  // Same keys as the FAQPage JSON-LD the prerender writes (data/page-faqs.ts).
  const { t } = useLanguage();
  const faqList = (PAGE_FAQS["/term"] ?? []).map(([q, a]) => ({ question: t(q), answer: t(a) }));

  return (
    <div className="min-h-screen bg-[#F0FFFE] dark:bg-[#0F1419] flex flex-col">
      <Header />

      {/* Hero Section */}
      <section
        className="bg-gradient-to-br from-[#0F1419] to-[#00B4D8] py-20 md:py-24 px-6 md:px-14 text-center text-white"
        style={{ background: "linear-gradient(15deg, #0F1419 0%, #00B4D8 100%)" }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00B4D8]/20 rounded-full text-xs font-medium text-white/90 mb-4">
            <Zap className="w-3 h-3" />
            Pure protection • Maximum coverage per rupee
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold leading-tight mb-6">
            Understand Your Term Life Insurance Policy
          </h1>
          <p className="text-base md:text-lg text-white/90 leading-relaxed mb-8 max-w-2xl mx-auto">
            Upload your term life insurance PDF. Instantly see if your sum assured
            is enough for your family's future, understand claim conditions,
            exclusions, and maximize coverage per rupee. Pure protection, maximum affordability.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <Button
              onClick={() => {
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                if (fileInput) fileInput.click();
              }}
              className="bg-[#00B4D8] hover:bg-[#0099B4] text-white h-12 px-8 text-base font-semibold"
            >
              Upload Policy PDF
            </Button>
          </div>
          <p className="text-xs text-white/70">
            Secure upload • Delete it any time • Free analysis
          </p>
        </div>
      </section>

      {/* Analyzer Tool Section */}
      <section className="bg-white dark:bg-[#0F1419] py-16 md:py-20 px-6 md:px-14">
        <TermAnalyzer />
      </section>

      {/* "What You'll Discover" Band */}
      <section className="bg-[#EFF6FF] dark:bg-[#1E3A5F]/30 py-12 px-6 md:px-14 border-l-4 border-[#00B4D8] my-12">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-6">
            What you'll discover:
          </h3>
          <div className="space-y-4 text-sm text-[#0F1419] dark:text-[#FAFBFC] leading-relaxed">
            <div className="flex gap-3">
              <span className="text-lg">1️⃣</span>
              <p>
                Whether your ₹1cr / ₹50L / ₹2cr sum assured is actually enough for your
                dependents' needs—based on your income, loans, children's education costs,
                and spouse's retirement timeline (20–30 years pure protection)
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-lg">2️⃣</span>
              <p>
                The real claim conditions, suicide clause waiting period,
                non-disclosure penalties that could get your entire claim rejected
                (most common reason: not telling insurer about diabetes at purchase)
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-lg">3️⃣</span>
              <p>
                How your riders (accidental death, critical illness, disability)
                actually trigger and what they don't cover—most people get this
                completely wrong and are shocked at claim time
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-6">
            <Button
              variant="link"
              className="text-[#00B4D8] text-sm font-medium p-0 h-auto"
              onClick={() => setLocation("/compare?type=term")}
            >
              Compare and find better terms →
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-white dark:bg-[#0F1419] py-12 px-6 md:px-14 border-t border-[#E5E7EB] dark:border-gray-700 border-b border-[#E5E7EB] dark:border-gray-700">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-8">
            Frequently Asked Questions
          </h2>

          <div className="space-y-3">
            {faqList.map((faq, index) => (
              <details key={index} className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <summary className="flex min-h-11 items-center justify-between gap-3 cursor-pointer list-none">
                  <span className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC] pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" />
                </summary>
                <p className="mt-3 text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed whitespace-pre-line">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
