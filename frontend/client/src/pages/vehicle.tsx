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
  Car,
  Wrench,
  Award,
  Gavel,
  Zap,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useAnalysis } from "@/hooks/use-analysis";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { SchemaMarkup, createFAQSchema } from "@/components/SEO";
import { loadSampleReport, mockReportVehicle } from "@/lib/mock-data";

export default function VehiclePage() {
  const [, setLocation] = useLocation();
  const { analyze, error: analysisError } = useAnalysis();

  // SEO
  useSEO({
    title: "Know Your Vehicle Coverage Before Claim Time | Vehicle Insurance Analyzer | Ensured",
    description: "Upload your car or bike policy. Instantly see if you're third-party or comprehensive, your actual deductibles, IDV, no-claim bonus impact, and what a ₹50k or ₹2L accident will really cost you.",
    keywords: "vehicle insurance analyzer, car insurance checker, motor insurance policy checker, vehicle insurance explained, comprehensive vs third party, IDV calculator, NCB impact",
    canonical: "/vehicle",
  });

  // FAQ Schema
  const faqData = createFAQSchema([
    {
      question: "How do you analyze policies?",
      answer: "We use AI to read your policy PDF clause-by-clause, extracting key terms: coverage type, IDV, deductibles, NCB level, add-ons, claim conditions, exclusions, etc. Then we structure it into a human-readable verdict.",
    },
    {
      question: "Is my data safe?",
      answer: "Yes. We delete your PDF after analysis. We don't store, log, or sell data. Compliant with IRDAI guidelines and RBI data residency requirements.",
    },
    {
      question: "What if my policy is unusual or custom?",
      answer: "We handle standard comprehensive and third-party policies. Custom policies with unusual terms may need manual cross-checking with your insurer, and we flag this in the report.",
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

  // Helper function to store file in sessionStorage
  const storeFileInSession = async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const base64String = reader.result as string;
            sessionStorage.setItem("ensured_pending_file", JSON.stringify({
              name: file.name,
              type: file.type,
              size: file.size,
              data: base64String,
            }));
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      } catch (err) {
        reject(err);
      }
    });
  };

  // Helper function to restore file from sessionStorage
  const restoreFileFromSession = (): File | null => {
    try {
      const stored = sessionStorage.getItem("ensured_pending_file");
      if (stored) {
        const fileData = JSON.parse(stored);
        // Convert base64 back to blob, then to File
        const byteCharacters = atob(fileData.data.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: fileData.type });
        const file = new File([blob], fileData.name, { type: fileData.type });
        sessionStorage.removeItem("ensured_pending_file");
        return file;
      }
    } catch (err) {
      console.error("Failed to restore file from sessionStorage:", err);
    }
    return null;
  };


  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;

    const file = acceptedFiles[0];
    
    // Validate file type
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'text/plain'];
    const isValidType = validTypes.includes(file.type) || 
                        file.name.toLowerCase().endsWith('.pdf') ||
                        file.name.toLowerCase().endsWith('.png') ||
                        file.name.toLowerCase().endsWith('.jpg') ||
                        file.name.toLowerCase().endsWith('.jpeg');
    
    if (!isValidType) {
      setError(`Unsupported file type. Please upload a PDF, PNG, JPG, or text file.`);
      return;
    }
    
    // Validate file size (max 25MB)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File is too large (${formatFileSize(file.size)}). Maximum size is 25 MB.`);
      return;
    }
    
    setSelectedFile(file);
    setFileSize(formatFileSize(file.size));
    setError(null);
    
    // Store file in sessionStorage
    await storeFileInSession(file);
    
    sessionStorage.removeItem("ensured_report");
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setUploading(true);
    setLocation("/processing");

    try {
      await analyze(file, "vehicle");
      // If successful, job is created and processing page will poll for status
    } catch (err: any) {
      console.error("Analysis failed:", err);
      
      
      let errorMessage = "Analysis failed";
      if (err?.message) {
        if (err.message.includes("timeout") || err.message.includes("took too long")) {
          errorMessage = "Analysis timed out. This can happen with very large documents. Please try again.";
        } else if (err.message.includes("encrypted") || err.message.includes("password")) {
          errorMessage = "PDF is encrypted. Please unlock your PDF and try again.";
        } else if (err.message.includes("quota") || err.message.includes("429")) {
          errorMessage = "API is busy. This usually clears in a few seconds. Please try again.";
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setLocation("/vehicle");
      setUploading(false);
    }
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
      <section className="relative z-10 pt-6 pb-10 md:pt-10 md:pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left: Content */}
            <div className="flex flex-col justify-center">
              <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold text-black dark:text-[#FAFBFC] mb-5 leading-[1.1] tracking-[-0.02em]">
                Know Your Vehicle Coverage Before Claim Time
              </h1>
              <p className="text-lg md:text-xl text-[#4B5563] dark:text-[#D1D5DB] mb-6 leading-relaxed">
                Upload a PDF. Understand your deductibles, IDV, NCB impact. No agents, no storage, no sales pitch.
              </p>
              
              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF]">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#00B4D8]" />
                  <span>IRDAI-aligned</span>
                </div>
                <span className="text-[#9CA3AF]">•</span>
                <span>10,000+ analyzed</span>
                <span className="text-[#9CA3AF]">•</span>
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>100% private</span>
                </div>
                <span className="text-[#9CA3AF]">•</span>
                <span>Free forever</span>
              </div>

              {/* Feature highlights */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#00B4D8] rounded-full"></div>
                  <span className="text-sm font-medium text-[#0F1419] dark:text-[#FAFBFC]">60-second analysis</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#10B981] rounded-full"></div>
                  <span className="text-sm font-medium text-[#0F1419] dark:text-[#FAFBFC]">Coverage type + real costs</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#00B4D8] rounded-full"></div>
                  <span className="text-sm font-medium text-[#0F1419] dark:text-[#FAFBFC]">Downloadable report</span>
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
                      <p className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">Upload Failed</p>
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
                          Dismiss
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
                          Try Again
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Card */}
              <div
                {...getRootProps()}
                className={`relative group transition-all duration-300 ${
                  uploading 
                    ? "cursor-wait" 
                    : isDragActive 
                    ? "scale-[1.01]" 
                    : "hover:scale-[1.005] cursor-pointer"
                }`}
              >
                {/* Subtle glow on hover */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#00B4D8]/20 via-[#10B981]/20 to-[#00B4D8]/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
                
                <div className={`relative bg-white dark:bg-[#1F2937] rounded-2xl border-2 transition-all shadow-xl ${
                  isDragActive 
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
                          <p className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC]">File Selected</p>
                          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono bg-[#F3F4F6] dark:bg-[#0F1419] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                            {selectedFile.name}
                          </p>
                          {fileSize && (
                            <p className="text-xs text-[#9CA3AF] dark:text-[#6B7280]">Size: {fileSize}</p>
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
                          <p className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-1">Analyzing...</p>
                          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Reading your policy</p>
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
                          <p className="text-xl font-bold text-[#0F1419] dark:text-[#FAFBFC]">Drop your PDF here</p>
                          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                            or <span className="text-[#00B4D8] dark:text-[#00B4D8] font-semibold hover:underline">click to browse</span>
                          </p>
                        </div>

                        {/* File info */}
                        <div className="w-full space-y-2 pt-2">
                          <p className="text-xs text-[#9CA3AF] dark:text-[#6B7280]">
                            PDF, PNG, JPG • Max 25 MB
                          </p>
                          <div className="flex flex-wrap justify-center gap-2">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F4F6] dark:bg-[#0F1419] rounded-full border border-gray-200 dark:border-gray-700">
                              <Clock className="w-3.5 h-3.5 text-[#00B4D8]" />
                              <span className="text-xs font-medium text-[#0F1419] dark:text-[#FAFBFC]">~60s</span>
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F4F6] dark:bg-[#0F1419] rounded-full border border-gray-200 dark:border-gray-700">
                              <Lock className="w-3.5 h-3.5 text-[#10B981]" />
                              <span className="text-xs font-medium text-[#0F1419] dark:text-[#FAFBFC]">Private</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); loadSampleReport(mockReportVehicle); setLocation("/report?sample=vehicle"); }}
                            className="mt-3 text-xs font-medium text-[#00B4D8] hover:underline inline-flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View sample report
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

      {/* How Ensured Works Section */}
      <section className="relative z-10 py-8 md:py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-[48px] font-semibold text-center text-black dark:text-[#FAFBFC] mb-12 md:mb-16 leading-[1.15] tracking-[-0.01em]">
            Three steps to total clarity.
          </h2>

          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto relative">
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
              <h3 className="text-xl font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">Upload Your Policy</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                PDF only. Takes 10 seconds.
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
              <h3 className="text-xl font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">We Analyze</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                Our AI reads every clause, every deductible, every add-on.
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
              <h3 className="text-xl font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">You Understand</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                Get a verdict on your coverage type, gaps, and real accident costs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What You'll Discover Section */}
      <section className="relative z-10 py-10 md:py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-8">
            What You'll Understand After Analysis
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Coverage Type */}
            <div className="relative group bg-gradient-to-br from-white via-blue-50/30 to-white dark:from-gray-800 dark:via-blue-950/20 dark:to-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              {/* Glow effect on hover */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00B4D8]/20 to-[#10B981]/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
              {/* Decorative elements */}
              <div className="absolute top-2 right-2 w-16 h-16 bg-blue-400/10 dark:bg-blue-500/5 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00B4D8]/20 to-[#10B981]/20 dark:from-[#00B4D8]/20 dark:to-[#10B981]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Car className="w-6 h-6 text-[#00B4D8]" />
                </div>
                <h3 className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">Coverage Type</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                  Third-party only? Your car damage = you pay 100%. Comprehensive? You're covered (minus deductible). We show you exactly what you have.
                </p>
              </div>
            </div>

            {/* Real Accident Costs */}
            <div className="relative group bg-gradient-to-br from-white via-cyan-50/30 to-white dark:from-gray-800 dark:via-cyan-950/20 dark:to-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              {/* Glow effect on hover */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#10B981]/20 to-[#00B4D8]/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
              {/* Decorative elements */}
              <div className="absolute top-2 right-2 w-16 h-16 bg-cyan-400/10 dark:bg-cyan-500/5 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#10B981]/20 to-[#00B4D8]/20 dark:from-[#10B981]/20 dark:to-[#00B4D8]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Calculator className="w-6 h-6 text-[#10B981]" />
                </div>
                <h3 className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">Real Accident Costs</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                  ₹50k damage sounds manageable, but add deductible + NCB loss over 5 years = ₹70k+ total cost. Should you claim? We calculate it for you.
                </p>
              </div>
            </div>

            {/* Missing Add-ons */}
            <div className="relative group bg-gradient-to-br from-white via-teal-50/30 to-white dark:from-gray-800 dark:via-teal-950/20 dark:to-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              {/* Glow effect on hover */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#F59E0B]/20 to-[#EF4444]/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
              {/* Decorative elements */}
              <div className="absolute top-2 right-2 w-16 h-16 bg-orange-400/10 dark:bg-orange-500/5 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F59E0B]/20 to-[#EF4444]/20 dark:from-[#F59E0B]/20 dark:to-[#EF4444]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <AlertCircle className="w-6 h-6 text-[#F59E0B]" />
                </div>
                <h3 className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">Missing Add-ons</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                  Engine protection (crucial for floods), zero depreciation, NCB protection—critical add-ons you're missing that could save you ₹1L+ in a claim.
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
            Questions About Your Analysis
          </h2>
          
          <div className="space-y-3">
            <details className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC]">How do you analyze policies?</span>
                <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="mt-3 text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                We use AI to read your policy PDF clause-by-clause, extracting key terms: coverage type, IDV, deductibles, NCB level, add-ons, claim conditions, exclusions, etc. Then we structure it into a human-readable verdict.
              </p>
            </details>

            <details className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC]">Is my data safe?</span>
                <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="mt-3 text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                Yes. We delete your PDF after analysis. We don't store, log, or sell data. Compliant with IRDAI guidelines and RBI data residency requirements.
              </p>
            </details>

            <details className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC]">What if my policy is unusual or custom?</span>
                <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="mt-3 text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                We handle standard comprehensive and third-party policies. Custom policies with unusual terms may need manual cross-checking with your insurer, and we flag this in the report.
              </p>
            </details>

            <details className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC]">Can I download my analysis?</span>
                <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="mt-3 text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                Yes. Your full verdict, findings, and recommendations are downloadable as PDF, shareable with family, advisors, or agents.
              </p>
            </details>

            <details className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC]">What if I disagree with the analysis?</span>
                <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="mt-3 text-sm text-[#6B7280] dark:text-[#D1D5DB] leading-relaxed">
                We read the policy as written. If there's ambiguity, we flag it and recommend you confirm with your insurer. Insurance terms can be subject to interpretation.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* Next Steps Section */}
      <section className="relative z-10 py-10 md:py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-8">
            Now What?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Calculate Costs */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#00B4D8]/10 flex items-center justify-center mx-auto mb-4">
                <Calculator className="w-6 h-6 text-[#00B4D8]" />
              </div>
              <h3 className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">See Real Costs</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] mb-4 leading-relaxed">
                Found gaps in your policy? Use our Calculator to see what you'd actually pay in different accident scenarios.
              </p>
              <Button
                variant="outline"
                onClick={() => setLocation("/calculator?type=vehicle")}
                className="border-gray-300 dark:border-gray-600"
              >
                Calculate Your Costs
              </Button>
            </div>

            {/* Compare Policies */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 text-center hover:shadow-lg transition-shadow duration-200">
              <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 flex items-center justify-center mx-auto mb-4">
                <Scale className="w-6 h-6 text-[#10B981]" />
              </div>
              <h3 className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">Compare Alternatives</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] mb-5 leading-relaxed">
                Thinking about switching? Compare popular vehicle insurance plans side-by-side and see which one covers your needs best.
              </p>
              <Button
                onClick={() => setLocation("/compare?type=vehicle")}
                className="bg-[#10B981] hover:bg-[#059669] text-white font-semibold h-10 px-5"
              >
                Compare Policies
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Share Analysis */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#00B4D8]/10 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-[#00B4D8]" />
              </div>
              <h3 className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-3">Share Your Analysis</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] mb-4 leading-relaxed">
                Download your report as PDF. Share with family, discuss with your agent, or keep for your records.
              </p>
              <Button
                variant="outline"
                disabled
                className="border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed"
              >
                Download Report
              </Button>
            </div>
          </div>
        </div>
      </section>


      <Footer />
    </div>
  );
}
