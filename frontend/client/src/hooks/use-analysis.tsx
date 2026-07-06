import { createContext, useContext, useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AnalysisResponse, AnalysisState } from "@/lib/types";
import { apiFetch } from "@/lib/api";

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
    sessionStorage.removeItem("IndSure_current_job");
    sessionStorage.removeItem("IndSure_report");
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const checkJobStatus = async (
    jobId: string
  ): Promise<{ status: string; result?: any; error?: string }> => {
    try {
      const response = await apiFetch(`/api/analyze/status/${jobId}`);
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }
      const data = await response.json();
      return { status: data.status, result: data.result, error: data.error };
    } catch (err: any) {
      return { status: "failed", error: err.message };
    }
  };

  const analyze = async (file: File, type?: string): Promise<{ jobId: string }> => {
    setStatus("loading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (type) {
        formData.append("type", type);
      }

      const response = await apiFetch("/api/analyze", {
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

      setCurrentJobId(data.jobId);
      sessionStorage.setItem("IndSure_current_job", data.jobId);
      return { jobId: data.jobId };
    } catch (err: any) {
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
    const jobId = currentJobId || sessionStorage.getItem("IndSure_current_job");
    if (!jobId) return;

    // Per-effect cancel flag — avoids the isMountedRef reset race condition.
    // Each time this effect re-runs (new jobId), the previous run's 'cancelled'
    // closure is set to true, so any in-flight async callback from the old job
    // stops processing even if it resolves after the new effect starts.
    let cancelled = false;

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    const jobStartTime = Date.now();

    // Hard cap on total polling time. A job stuck in pending/processing would
    // otherwise poll forever, leaving the UI in perpetual loading.
    const MAX_POLL_ELAPSED = 300_000; // 5 minutes

    const poll = async () => {
      if (cancelled) return;

      // Timeout guard: stop polling once we've exceeded the max elapsed time.
      if (Date.now() - jobStartTime > MAX_POLL_ELAPSED) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (!cancelled) {
          const timeoutMessage = "Analysis timed out. Please try again.";
          setError(timeoutMessage);
          setState((prev: AnalysisState) => ({ ...prev, error: timeoutMessage }));
          setStatus("error");
          setCurrentJobId(null);
          sessionStorage.removeItem("IndSure_current_job");
        }
        return;
      }

      const status = await checkJobStatus(jobId);
      if (cancelled) return;

      if (status.status === "completed" && status.result) {

        setState({
          analysis: status.result,
          analysisId: jobId,
          lastUpdated: Date.now(),
          error: null,
        });

        sessionStorage.setItem("IndSure_report", JSON.stringify(status.result));
        setStatus("success");

        setTimeout(() => {
          if (!cancelled) {
            sessionStorage.removeItem("IndSure_current_job");
            setCurrentJobId(null);
          }
        }, 2000);

        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } else if (status.status === "failed") {
        if (!cancelled) {
          setError(status.error || "Analysis failed");
          setState((prev: AnalysisState) => ({
            ...prev,
            error: status.error || "Analysis failed",
          }));
          setStatus("error");
          setCurrentJobId(null);
          sessionStorage.removeItem("IndSure_current_job");
        }

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
        if (!cancelled) {
          pollingIntervalRef.current = setInterval(poll, nextInterval);
        }
      }
    };

    // Start first poll after 3s
    pollingIntervalRef.current = setInterval(poll, 3_000);

    return () => {
      cancelled = true;
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
