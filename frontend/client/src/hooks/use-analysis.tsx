import { createContext, useContext, useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AnalysisResponse, AnalysisState } from "@/lib/types";
import { getApiBase } from "@/lib/api";

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

  const checkJobStatus = async (
    jobId: string
  ): Promise<{ status: string; result?: any; error?: string }> => {
    try {
      const response = await fetch(`${getApiBase()}/api/analyze/status/${jobId}`);
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

      console.log("📤 Sending POST to /api/analyze", type ? `(type: ${type})` : "");
      const response = await fetch(`${getApiBase()}/api/analyze`, {
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
        console.error("❌ Backend error response:", errorData);

        throw new Error(
          `Backend returned ${response.status}: ${errorData.error || "Unknown error"}`
        );
      }

      const data = await response.json();

      if (data.jobId) {
        console.log("✅ Job created:", data.jobId);
        setCurrentJobId(data.jobId);
        sessionStorage.setItem("ensured_current_job", data.jobId);
        return { jobId: data.jobId };
      } else {
        console.log("✅ Received full result (legacy mode)");
        if (!data.page1 || !data.details) {
          throw new Error("Backend response missing required fields");
        }

        setState({
          analysis: data,
          analysisId: data.id || `report-${Date.now()}`,
          lastUpdated: Date.now(),
          error: null,
        });

        sessionStorage.setItem("ensured_report", JSON.stringify(data));
        setStatus("success");
        return { jobId: `legacy-${Date.now()}` };
      }
    } catch (err: any) {
      console.error("❌ Analysis error:", err);
      let errorMessage = err.message || "Analysis failed - check console for details";

      if (err.name === "TypeError" && err.message === "Failed to fetch") {
        errorMessage =
          "Cannot connect to backend server. Please make sure the backend is running on port 5000.";
      }

      setError(errorMessage);
      setState((prev: AnalysisState) => ({ ...prev, error: errorMessage }));
      setStatus("error");
      throw err;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const jobId = currentJobId || sessionStorage.getItem("ensured_current_job");
    if (!jobId || jobId.startsWith("legacy-")) return;

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    pollingIntervalRef.current = setInterval(async () => {
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

        setState({
          analysis: status.result,
          analysisId: jobId,
          lastUpdated: Date.now(),
          error: null,
        });

        sessionStorage.setItem("ensured_report", JSON.stringify(status.result));
        sessionStorage.removeItem("ensured_current_job");
        setCurrentJobId(null);
        setStatus("success");

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
      }
    }, 30000);

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

        /* ================= ADD (STEP 2) ================= */
        policyText,
        setPolicyText,
        /* =============================================== */

        analyze,
        checkJobStatus,
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
