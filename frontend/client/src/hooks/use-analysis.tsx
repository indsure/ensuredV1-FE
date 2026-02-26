import { createContext, useContext, useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AnalysisResponse, AnalysisState } from "@/lib/types";

interface AnalysisContextType {
  state: AnalysisState;
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  currentJobId: string | null;

  /* ===================== ADD (STEP 2) ===================== */
  policyText: string;
  setPolicyText: (text: string) => void;
  /* ======================================================== */

  analyze: (file: File, type?: string) => Promise<{ jobId: string }>;
  checkJobStatus: (jobId: string) => Promise<{ status: string; result?: any; error?: string }>;
  clearAuditState: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnalysisState>({
    analysis: null,
    analysisId: null,
    lastUpdated: null,
    error: null,
  });

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  /* ===================== ADD (STEP 2) ===================== */
  const [policyText, setPolicyText] = useState<string>("");
  /* ======================================================== */

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const clearAuditState = () => {
    setState({
      analysis: null,
      analysisId: null,
      lastUpdated: null,
      error: null,
    });
    setStatus("idle");
    setError(null);
    setCurrentJobId(null);
    setPolicyText("");
    sessionStorage.removeItem("ensured_current_job");
    sessionStorage.removeItem("ensured_report");
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const checkJobStatus = async (
    jobId: string
  ): Promise<{ status: string; result?: any; error?: string }> => {
    try {
      const response = await fetch(`/api/analyze/status/${jobId}`);
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }
      const data = await response.json();
      return { status: data.status, result: data.result, error: data.error };
    } catch (err: any) {
      console.error("Error checking job status:", err);
      return { status: "failed", error: err.message };
    }
  };

  const analyze = async (file: File, type?: string): Promise<{ jobId: string }> => {
    console.log("🔍 Starting analysis for file:", file.name, type ? `(type: ${type})` : "");
    setStatus("loading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (type) {
        formData.append("type", type);
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          const errorText = await response.text();
          errorData = { error: errorText };
        }
        throw new Error(
          `Backend returned ${response.status}: ${errorData.error || "Unknown error"}`
        );
      }

      const data = await response.json();

      if (!data.jobId) {
        throw new Error("Backend response missing jobId");
      }

      console.log("✅ Job created:", data.jobId);
      setCurrentJobId(data.jobId);
      sessionStorage.setItem("ensured_current_job", data.jobId);
      return { jobId: data.jobId };
    } catch (err: any) {
      console.error("❌ Analysis error:", err);
      let errorMessage = err.message || "Analysis failed";

      if (err.name === "TypeError" && err.message === "Failed to fetch") {
        errorMessage =
          "Cannot connect to backend server. Please ensure the server is running.";
      }

      setError(errorMessage);
      setState((prev: AnalysisState) => ({ ...prev, error: errorMessage }));
      setStatus("error");
      throw err;
    }
  };

  // Adaptive polling: 3s for the first 60s, then 5s after
  useEffect(() => {
    isMountedRef.current = true;
    const jobId = currentJobId || sessionStorage.getItem("ensured_current_job");
    if (!jobId) return;

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    const jobStartTime = Date.now();

    const poll = async () => {
      if (!isMountedRef.current) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        return;
      }

      const status = await checkJobStatus(jobId);
      if (!isMountedRef.current) return;

      if (status.status === "completed" && status.result) {
        console.log("✅ Job completed, storing result");
        console.log('[Debug] auditResult set:', !!status.result);
        console.log('[Debug] Setting isProcessing to false...');

        // 1. Set result into state FIRST
        setState({
          analysis: status.result,
          analysisId: jobId,
          lastUpdated: Date.now(),
          error: null,
        });

        sessionStorage.setItem("ensured_report", JSON.stringify(status.result));

        // 2. ONLY THEN stop the loader (set success)
        setStatus("success");
        console.log('[Debug] isProcessing set to false');

        // Fix Race Condition: Delay teardown to give processing.tsx time to redirect
        setTimeout(() => {
          sessionStorage.removeItem("ensured_current_job");
          setCurrentJobId(null);
        }, 2000);

        // 3. Clear the polling interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } else if (status.status === "failed") {
        console.error("❌ Job failed:", status.error);

        setError(status.error || "Analysis failed");
        setState((prev: AnalysisState) => ({
          ...prev,
          error: status.error || "Analysis failed",
        }));
        setStatus("error");

        setCurrentJobId(null);
        sessionStorage.removeItem("ensured_current_job");

        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } else {
        // Adaptive interval: fast polling for first 60s, then slower
        const elapsed = Date.now() - jobStartTime;
        const nextInterval = elapsed < 60_000 ? 3_000 : 5_000;

        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        pollingIntervalRef.current = setInterval(poll, nextInterval);
      }
    };

    // Start first poll after 3s
    pollingIntervalRef.current = setInterval(poll, 3_000);

    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [currentJobId]);

  return (
    <AnalysisContext.Provider
      value={{
        state,
        status,
        error,
        currentJobId,
        policyText,
        setPolicyText,
        analyze,
        checkJobStatus,
        clearAuditState,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error("useAnalysis must be used within AnalysisProvider");
  }
  return context;
}
