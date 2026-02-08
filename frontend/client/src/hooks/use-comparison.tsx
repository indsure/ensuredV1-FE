import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import type { PolicyData } from "@/types/policy";

type UploadStatus = "idle" | "uploading" | "extracting" | "success" | "error";

export interface UploadedPolicy {
  id: string;
  file: File;
  status: UploadStatus;
  policyData?: PolicyData;
  error?: string;
  progress?: string;
  progressPercent?: number;
}

export interface ComparisonProfile {
  age: number | undefined;
  city: string;
  state: string;
  preExistingConditions: string[];
  householdIncome: number | undefined;
  familySize: number | undefined;
}

interface ComparisonContextType {
  policies: UploadedPolicy[];
  setPolicies: (policies: UploadedPolicy[] | ((prev: UploadedPolicy[]) => UploadedPolicy[])) => void;
  profile: ComparisonProfile;
  setProfile: (profile: ComparisonProfile | ((prev: ComparisonProfile) => ComparisonProfile)) => void;
  clearAll: () => void;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  
  // Load initial state from sessionStorage if in compare flow
  const loadInitialPolicies = (): UploadedPolicy[] => {
    try {
      const stored = sessionStorage.getItem("ensured_comparison_policies");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert stored data back to UploadedPolicy format
        // Note: File objects can't be restored, so we create a placeholder
        return parsed.map((p: any) => ({
          id: p.id,
          file: new File([], p.fileName || "unknown.pdf", { type: "application/pdf" }), // Placeholder file
          status: p.status,
          policyData: p.policyData,
          error: p.error,
          progress: p.progress,
          progressPercent: p.progressPercent,
        }));
      }
    } catch (e) {
      console.error("Failed to load policies from sessionStorage:", e);
    }
    return [];
  };

  const loadInitialProfile = (): ComparisonProfile => {
    try {
      const stored = sessionStorage.getItem("ensured_comparison_profile");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to load profile from sessionStorage:", e);
    }
    return {
      age: undefined,
      city: "",
      state: "",
      preExistingConditions: [],
      householdIncome: undefined,
      familySize: undefined,
    };
  };

  const [policies, setPoliciesState] = useState<UploadedPolicy[]>(() => {
    const isInCompareFlow = window.location.pathname.startsWith("/compare");
    return isInCompareFlow ? loadInitialPolicies() : [];
  });
  
  const [profile, setProfileState] = useState<ComparisonProfile>(() => {
    const isInCompareFlow = window.location.pathname.startsWith("/compare");
    return isInCompareFlow ? loadInitialProfile() : {
      age: undefined,
      city: "",
      state: "",
      preExistingConditions: [],
      householdIncome: undefined,
      familySize: undefined,
      priorityNeed: "",
    };
  });

  // Reload from sessionStorage when navigating between compare steps
  useEffect(() => {
    const isInCompareFlow = location.startsWith("/compare");
    
    if (isInCompareFlow) {
      // Load policies from sessionStorage when navigating between steps
      try {
        const storedPolicies = sessionStorage.getItem("ensured_comparison_policies");
        if (storedPolicies) {
          const parsed = JSON.parse(storedPolicies);
          const loadedPolicies = parsed.map((p: any) => ({
            id: p.id,
            file: new File([], p.fileName || "unknown.pdf", { type: "application/pdf" }),
            status: p.status,
            policyData: p.policyData,
            error: p.error,
            progress: p.progress,
            progressPercent: p.progressPercent,
          }));
          // Always sync from sessionStorage when navigating between compare steps
          if (loadedPolicies.length > 0) {
            setPoliciesState((prev) => {
              // Check if we need to update by comparing policyData (the actual extracted data)
              const currentHasData = prev.some(p => p.policyData);
              const loadedHasData = loadedPolicies.some((p: any) => p.policyData);
              
              // If loaded has data but current doesn't, or IDs are different, update
              if (loadedHasData && !currentHasData) {
                return loadedPolicies;
              }
              
              // Compare IDs to see if policies changed
              const currentIds = prev.map(p => p.id).sort().join(',');
              const loadedIds = loadedPolicies.map((p: any) => p.id).sort().join(',');
              if (currentIds !== loadedIds || (loadedHasData && !currentHasData)) {
                return loadedPolicies;
              }
              
              return prev;
            });
          }
        }
      } catch (e) {
        console.error("Failed to load policies from sessionStorage:", e);
      }

      // Load profile from sessionStorage
      try {
        const storedProfile = sessionStorage.getItem("ensured_comparison_profile");
        if (storedProfile) {
          const loadedProfile = JSON.parse(storedProfile);
          // Always sync profile from sessionStorage
          setProfileState(loadedProfile);
        }
      } catch (e) {
        console.error("Failed to load profile from sessionStorage:", e);
      }
    } else {
      // Not in compare flow - clear sessionStorage
      sessionStorage.removeItem("ensured_comparison_policies");
      sessionStorage.removeItem("ensured_comparison_profile");
      setPoliciesState([]);
      setProfileState({
        age: undefined,
        city: "",
        state: "",
        preExistingConditions: [],
        householdIncome: undefined,
        familySize: undefined,
        priorityNeed: "",
      });
    }
  }, [location]);

  const setPolicies = (value: UploadedPolicy[] | ((prev: UploadedPolicy[]) => UploadedPolicy[])) => {
    setPoliciesState((prev) => {
      const newPolicies = typeof value === "function" ? value(prev) : value;
      // Save to sessionStorage (clears on tab close) - without File objects
      try {
        const toStore = newPolicies.map((p) => ({
          id: p.id,
          fileName: p.file.name,
          status: p.status,
          policyData: p.policyData,
          error: p.error,
          progress: p.progress,
          progressPercent: p.progressPercent,
        }));
        sessionStorage.setItem("ensured_comparison_policies", JSON.stringify(toStore));
        console.log("💾 Saved policies to sessionStorage:", toStore.length, "policies");
      } catch (e) {
        console.error("Failed to save policies to sessionStorage:", e);
      }
      return newPolicies;
    });
  };

  const setProfile = (value: ComparisonProfile | ((prev: ComparisonProfile) => ComparisonProfile)) => {
    setProfileState((prev) => {
      const newProfile = typeof value === "function" ? value(prev) : value;
      // Save to sessionStorage (clears on tab close)
      try {
        sessionStorage.setItem("ensured_comparison_profile", JSON.stringify(newProfile));
      } catch (e) {
        console.error("Failed to save profile to sessionStorage:", e);
      }
      return newProfile;
    });
  };

  const clearAll = () => {
    // Clear sessionStorage
    sessionStorage.removeItem("ensured_comparison_policies");
    sessionStorage.removeItem("ensured_comparison_profile");
    sessionStorage.removeItem("ensured_force_clear");
    // Clear state immediately
    setPoliciesState([]);
    setProfileState({
      age: undefined,
      city: "",
      state: "",
      preExistingConditions: [],
      householdIncome: undefined,
      familySize: undefined,
      priorityNeed: "",
    });
  };

  return (
    <ComparisonContext.Provider value={{ policies, setPolicies, profile, setProfile, clearAll }}>
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error("useComparison must be used within ComparisonProvider");
  }
  return context;
}

