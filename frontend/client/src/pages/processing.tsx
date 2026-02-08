
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, AlertCircle, ShieldCheck, ChevronDown, FileText, Search, Clock } from "lucide-react";
import { useAnalysis } from "@/hooks/use-analysis";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { motion, AnimatePresence } from "framer-motion";

// Enhanced "Live Insight" Lines - Rotating
const LIVE_INSIGHTS = [
  "Scanning for room rent caps and silent sub-limits...",
  "Checking if restoration clauses actually restore...",
  "Identifying exclusions most claims fail on...",
  "Comparing coverage wording against real hospital billing..."
];

// Revamped Steps (Forensic)
const STEPS = [
  { id: 1, title: "Reading policy structure", desc: "Sections, schedules, endorsements" },
  { id: 2, title: "Parsing exclusions & sub-limits", desc: "Hidden caps, waiting periods, conditions" },
  { id: 3, title: "Stress-testing claim scenarios", desc: "Real hospital + treatment situations" },
  { id: 4, title: "Preparing coverage verdict", desc: "What works, what fails, what misleads" },
];

export default function Processing() {
  const [, setLocation] = useLocation();
  const { status, error, currentJobId, checkJobStatus } = useAnalysis();
  const [activeStep, setActiveStep] = useState(0);
  const [insightIndex, setInsightIndex] = useState(0);
  const [isWhyOpen, setIsWhyOpen] = useState(false);

  // Poll for job status
  useEffect(() => {
    const jobId = currentJobId || sessionStorage.getItem("ensured_current_job");
    if (!jobId || jobId.startsWith("legacy-")) return;

    const pollStatus = async () => {
      const status = await checkJobStatus(jobId);
      if (status.status === "completed" && status.result) {
        sessionStorage.setItem("ensured_report", JSON.stringify(status.result));
        sessionStorage.removeItem("ensured_current_job");
        setTimeout(() => setLocation("/report"), 800);
      } else if (status.status === "failed") {
        sessionStorage.removeItem("ensured_current_job");
      }
    };

    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [currentJobId, checkJobStatus, setLocation]);

  // Simulate Forensic Progress (Steps + Insights)
  useEffect(() => {
    if (status === "error") return;

    // Step Timer Matches typical analysis time
    const t1 = setTimeout(() => setActiveStep(0), 500);
    const t2 = setTimeout(() => setActiveStep(1), 3500);
    const t3 = setTimeout(() => setActiveStep(2), 8500);
    const t4 = setTimeout(() => setActiveStep(3), 15500);

    // Insight Rotation
    const insightInterval = setInterval(() => {
      setInsightIndex((prev) => (prev + 1) % LIVE_INSIGHTS.length);
    }, 4000);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
      clearInterval(insightInterval);
    };
  }, [status]);

  const hasError = status === "error" || !!error;

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] flex flex-col font-sans text-[var(--color-navy-900)] selection:bg-[var(--color-teal-100)] selection:text-[var(--color-teal-900)]">
      <Header />

      <main className="flex-grow flex flex-col items-center justify-start relative px-6 pt-32 pb-40">

        {/* Ambient Glow - Subtle Teal on Cream */}
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--color-teal-600)]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-2xl flex flex-col gap-24 items-center">

          {/* 1. FORENSIC STATUS HEADER */}
          <div className="flex flex-col items-center text-center">

            {/* Circular Indicator */}
            <div className="relative mb-8">
              {/* Spinning Outer Ring */}
              <div className="absolute inset-0 border border-dashed border-[var(--color-teal-600)] rounded-full animate-[spin_12s_linear_infinite] opacity-30" />

              <div className="relative w-40 h-40 flex items-center justify-center">
                {/* Inner Static Ring */}
                <div className="absolute inset-2 border border-[var(--color-teal-600)]/20 rounded-full" />

                {hasError ? (
                  <AlertCircle className="w-10 h-10 text-red-600" />
                ) : (
                  <div className="w-12 h-12 bg-[var(--color-teal-50)] rounded-full flex items-center justify-center animate-pulse border border-[var(--color-teal-200)]">
                    <ShieldCheck className="w-6 h-6 text-[var(--color-teal-600)]" />
                  </div>
                )}
              </div>
            </div>

            {/* Status Text */}
            <h2 className="text-2xl font-serif text-[var(--color-navy-900)] mb-2">
              {STEPS[activeStep]?.title || "Finalizing..."}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] opacity-80 mb-8 font-mono uppercase tracking-widest text-[10px]">
              {STEPS[activeStep]?.desc}
            </p>

            {/* Live Insight Line (Rotating) */}
            <div className="h-6 overflow-hidden relative w-full max-w-[400px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={insightIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5 }}
                  className="text-sm font-mono text-[var(--color-teal-600)] text-center w-full absolute top-0"
                >
                  {">"} {LIVE_INSIGHTS[insightIndex]}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>


          {/* 2. ACTIVE AUDIT STEPS (Vertical List) */}
          <div className="w-full max-w-lg border-l border-[var(--color-border-main)] pl-8 py-2">
            {STEPS.map((step, i) => {
              const isActive = i === activeStep;
              const isCompleted = i < activeStep;

              return (
                <div key={i} className={`flex items-start gap-4 mb-8 last:mb-0 transition-all duration-700 ${isActive || isCompleted ? "opacity-100" : "opacity-30 blur-[0.5px]"}`}>
                  <div className={`
                        w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono border mt-0.5 shrink-0 transition-colors duration-500
                        ${isCompleted
                      ? "bg-[var(--color-teal-100)] border-[var(--color-teal-200)] text-[var(--color-teal-600)]"
                      : isActive
                        ? "bg-[var(--color-teal-600)] border-[var(--color-teal-600)] text-white shadow-[0_0_15px_rgba(20,184,166,0.2)]"
                        : "border-[var(--color-border-light)] text-[var(--color-text-muted)]"
                    }
                      `}>
                    {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : `0${step.id}`}
                  </div>
                  <div>
                    <h4 className={`font-serif text-lg leading-tight mb-1 transition-colors ${isActive ? "text-[var(--color-navy-900)]" : "text-[var(--color-text-muted)]"}`}>
                      {step.title}
                    </h4>
                    {isActive && (
                      <motion.p
                        initial={{ opacity: 0 }} animate={{ opacity: 0.7 }}
                        className="text-[10px] font-mono text-[var(--color-text-secondary)] uppercase tracking-widest mt-1"
                      >
                        {step.desc}
                      </motion.p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>


          {/* 3. WHAT WE'RE CHECKING (Stacked Panels) */}
          <div className="w-full max-w-lg">
            <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-6 text-center">
              What this audit is actively checking
            </h3>

            <div className="grid gap-4">
              {/* Panel 1 */}
              <div className="bg-white border border-[var(--color-border-light)] p-5 rounded-lg shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-4 h-4 text-[var(--color-teal-600)]" />
                  <h4 className="font-serif text-[var(--color-navy-900)]">Policy Structure</h4>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed opacity-80">
                  Analyzing the base policy, attached schedules, and endorsement overrides.
                </p>
              </div>

              {/* Panel 2 */}
              <div className="bg-white border border-[var(--color-border-light)] p-5 rounded-lg shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <Search className="w-4 h-4 text-[var(--color-teal-600)]" />
                  <h4 className="font-serif text-[var(--color-navy-900)]">Claim Failure Triggers</h4>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed opacity-80">
                  Scanning for room rent caps, co-pay clauses, and hidden sub-limits.
                </p>
              </div>

              {/* Panel 3 */}
              <div className="bg-white border border-[var(--color-border-light)] p-5 rounded-lg shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-4 h-4 text-[var(--color-teal-600)]" />
                  <h4 className="font-serif text-[var(--color-navy-900)]">Time-Based Risks</h4>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed opacity-80">
                  Calculating waiting period completion and pre-existing disease exclusions.
                </p>
              </div>
            </div>
          </div>


          {/* 4. WHY THIS TAKES A MINUTE (Collapsible) */}
          <div className="text-center w-full">
            <button
              onClick={() => setIsWhyOpen(!isWhyOpen)}
              className="group flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-teal-600)] transition-colors mx-auto mb-4"
            >
              Why this takes a minute
              <span className={`transition-transform duration-300 ${isWhyOpen ? "rotate-180" : ""}`}>
                <ChevronDown className="w-3 h-3" />
              </span>
            </button>
            <AnimatePresence>
              {isWhyOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden max-w-md mx-auto"
                >
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed bg-white p-4 rounded border border-[var(--color-border-light)] shadow-sm">
                    We don’t just keyword-scan PDFs. We read definitions, find cross-references in annexures, and interpret complex conditions the way a claims team would. This ensures accuracy over speed.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* 5. PRIVACY & ISOLATION */}
        <div className="absolute bottom-6 w-full text-center px-6">
          <p className="text-[10px] text-[var(--color-text-muted)] opacity-60 flex items-center justify-center gap-2 font-mono tracking-wide">
            <ShieldCheck className="w-3 h-3 text-[var(--color-teal-600)] opacity-70" />
            ANALYSIS IN ISOLATION • NO HUMAN REVIEW • PRIVATE ENCLAVE
          </p>
        </div>

        {hasError && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-white border border-red-200 p-6 rounded-lg text-center shadow-xl max-w-sm w-full mx-4">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-3" />
            <p className="text-[var(--color-navy-900)] text-sm mb-4 font-mono">{error || "Analysis failed to complete."}</p>
            <button onClick={() => setLocation("/policychecker")} className="w-full bg-red-50 hover:bg-red-100 text-red-700 py-2 rounded uppercase text-xs font-bold tracking-widest transition-colors border border-red-200">Try Again</button>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}