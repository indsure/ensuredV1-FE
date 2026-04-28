import { apiFetch } from "./api";
import { UserInputs, EngineResult } from "./health-engine-logic";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

interface SaveReportResponse {
  uuid: string;
  success: boolean;
}

interface SaveReportError {
  error: string;
  retryable?: boolean;
  code?: string;
}

/**
 * Save calculator report to backend with retry logic
 */
export async function saveCalculatorReport(
  inputs: UserInputs | any,
  resultData: EngineResult | any,
  retryCount = 0
): Promise<{ success: true; uuid: string } | { success: false; error: string }> {
  try {
    const res = await apiFetch("/api/calculator/save-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs, result_data: resultData }),
    });

    if (!res.ok) {
      const errorData: SaveReportError = await res.json().catch(() => ({
        error: "Failed to save report",
      }));

      // Retry on server errors if retryable
      if (res.status >= 500 && errorData.retryable && retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return saveCalculatorReport(inputs, resultData, retryCount + 1);
      }

      return {
        success: false,
        error: errorData.error || "Failed to save report",
      };
    }

    const data: SaveReportResponse = await res.json();
    return { success: true, uuid: data.uuid };
  } catch (error) {
    console.error("Error saving calculator report:", error);

    // Retry on network errors
    if (retryCount < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return saveCalculatorReport(inputs, resultData, retryCount + 1);
    }

    return {
      success: false,
      error: "Network error. Please check your connection and try again.",
    };
  }
}

/**
 * Save to sessionStorage as fallback (temporary)
 */
export function saveToSessionStorage(inputs: any, resultData: any): void {
  try {
    sessionStorage.setItem("calculator_result", JSON.stringify(resultData));
    sessionStorage.setItem("calculator_inputs", JSON.stringify(inputs));
    sessionStorage.setItem("calculator_saved_at", new Date().toISOString());
  } catch (error) {
    console.error("Failed to save to sessionStorage:", error);
  }
}

/**
 * Load from sessionStorage
 */
export function loadFromSessionStorage(): {
  inputs: any;
  result: any;
  savedAt: string;
} | null {
  try {
    const result = sessionStorage.getItem("calculator_result");
    const inputs = sessionStorage.getItem("calculator_inputs");
    const savedAt = sessionStorage.getItem("calculator_saved_at");

    if (!result || !inputs) return null;

    return {
      inputs: JSON.parse(inputs),
      result: JSON.parse(result),
      savedAt: savedAt || new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to load from sessionStorage:", error);
    return null;
  }
}

/**
 * Clear sessionStorage
 */
export function clearSessionStorage(): void {
  try {
    sessionStorage.removeItem("calculator_result");
    sessionStorage.removeItem("calculator_inputs");
    sessionStorage.removeItem("calculator_saved_at");
  } catch (error) {
    console.error("Failed to clear sessionStorage:", error);
  }
}

/**
 * Save calculator progress (for resume functionality)
 */
export function saveProgress(step: string, inputs: Partial<any>): void {
  try {
    const progress = {
      step,
      inputs,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("calculator_progress", JSON.stringify(progress));
  } catch (error) {
    console.error("Failed to save progress:", error);
  }
}

/**
 * Load calculator progress
 */
export function loadProgress(): {
  step: string;
  inputs: Partial<any>;
  savedAt: string;
} | null {
  try {
    const progress = localStorage.getItem("calculator_progress");
    if (!progress) return null;

    const parsed = JSON.parse(progress);
    
    // Check if progress is older than 7 days
    const savedAt = new Date(parsed.savedAt);
    const now = new Date();
    const daysDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 7) {
      clearProgress();
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to load progress:", error);
    return null;
  }
}

/**
 * Clear calculator progress
 */
export function clearProgress(): void {
  try {
    localStorage.removeItem("calculator_progress");
  } catch (error) {
    console.error("Failed to clear progress:", error);
  }
}

/**
 * Check if user has unsaved progress
 */
export function hasUnsavedProgress(): boolean {
  const progress = loadProgress();
  return progress !== null;
}
