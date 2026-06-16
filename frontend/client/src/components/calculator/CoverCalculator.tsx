import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Check, MapPin, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  calculateHealthCover, UserInputs, EngineResult,
  AgeBand, CityTier,
} from "@/lib/health-engine-logic";
import { getCityTier, getTierDescription } from "@/lib/city-tier-util";
import { getAllStates, getCitiesForState } from "@/lib/data/indian-cities-data";
import { CalculatorLanding } from "@/components/CalculatorLanding";
import { CalculatorErrorBoundary } from "@/components/CalculatorErrorBoundary";
import { CalculatorProgressDots } from "@/components/CalculatorProgress";
import {
  saveCalculatorReport,
  saveProgress,
  loadProgress,
  clearProgress,
  hasUnsavedProgress,
} from "@/lib/calculator-storage";
import {
  showError,
  showWarning,
} from "@/lib/calculator-notifications";
import {
  sanitizeIntegerInput,
  getAgeError,
} from "@/lib/validation/calculator-validation";

/**
 * The cover-need wizard, shared between the consumer site (/calculator) and
 * the agent portal (/agent/calculator).
 *
 * Default (consumer) mode is behavior-identical to the original page: intro
 * landing, localStorage resume, and navigation to /calculator/report on
 * completion. `embedded` mode (agent portal) skips the landing + resume
 * prompt, never navigates, and reports the outcome through `onComplete`.
 */
export interface CoverCalculatorCompletion {
  uuid: string | null;
  inputs: UserInputs;
  result: EngineResult;
}

export interface CoverCalculatorProps {
  embedded?: boolean;
  /** Prefill wizard fields (agent flow: from the tagged customer). */
  initialInputs?: Partial<UserInputs>;
  /** Step to open on. Defaults to the landing (consumer) or location (embedded).
   *  Pass "review" to re-open a completed run for adjustment. */
  initialStepId?: string;
  /** Prefill the location step. */
  initialState?: string;
  initialCity?: string;
  /** Supabase access token — stamps the saved report with the agent's id. */
  authToken?: string | null;
  /** Customer to attach the saved report to (validated server-side). */
  customerId?: string | null;
  /** Agent's partnered insurers (canonical rider-DB names). Activates the
   *  agent-only rider bias; omitted ⇒ neutral consumer output. */
  partnerCompanies?: string[];
  /** Called after the engine runs and the save attempt finishes. */
  onComplete?: (done: CoverCalculatorCompletion) => void;
}

const OptionCard = ({
  label,
  selected,
  onClick,
  subLabel,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  subLabel?: string;
}) => (
  <div
    onClick={onClick}
    className={cn(
      "relative cursor-pointer rounded-xl border-2 p-6 transition-all duration-200 flex flex-col items-center text-center justify-center gap-2",
      selected
        ? "border-[var(--color-teal-600)] bg-[var(--color-teal-50)] shadow-md scale-[1.02]"
        : "border-[var(--color-border-light)] bg-white hover:border-[var(--color-teal-300)] hover:bg-gray-50"
    )}
  >
    <div
      className={cn(
        "font-medium text-lg",
        selected ? "text-[var(--color-teal-900)]" : "text-[var(--color-text-main)]"
      )}
    >
      {label}
    </div>
    {subLabel && <div className="text-xs text-[var(--color-text-muted)]">{subLabel}</div>}
    {selected && (
      <div className="absolute top-3 right-3 text-[var(--color-teal-600)]">
        <Check className="w-5 h-5" />
      </div>
    )}
  </div>
);

const ALL_STEPS = [
  {
    id: "intro",
    title: "IndSure Intelligence Engine",
    subtitle: "Objective Analysis. No Sales Push.",
    description:
      "I will calculate your exact coverage needs based on medical inflation and lifestyle risks.",
    buttonText: "Start Analysis",
  },
  {
    id: "location",
    question: "Where do you live?",
    subtext: "Your city helps us determine the medical cost zone for your area.",
  },
  {
    id: "familyStructure",
    question: "Who needs coverage?",
    options: ["Individual", "Couple", "Couple + kids", "Parents included"],
  },
  {
    id: "detailedProfile",
    question: "Member Details",
  },
  {
    id: "employerCover",
    question: "Do you have employer coverage?",
    options: ["None", "< 5L", "5-10L", "> 10L"],
  },
  {
    id: "riskPosture",
    question: "What is your risk attitude?",
    description: "Honest answer determines cushion vs efficiency.",
    options: [
      { label: "Minimum but safe", sub: "Cover big risks, pay minor bills" },
      { label: "Balanced", sub: "Standard protection" },
      { label: "Zero financial shock", sub: "I want 100% cashless everywhere" },
    ],
  },
  {
    id: "hospitalPreference",
    question: "Preferred Hospital Type?",
    options: [
      "Any good hospital",
      "Large private hospitals",
      "Premium corporate hospitals",
    ],
  },
  {
    id: "recurringExpenses",
    question: "Any recurring medical expenses?",
    options: ["None", "Minor (tests/OPD/meds)", "Chronic but stable"],
  },
  {
    id: "review",
    question: "Review the answers",
    subtext: "Confirm everything looks right — edit any answer before we calculate.",
  },
] as const;

type StepId = (typeof ALL_STEPS)[number]["id"];

type StepDef = (typeof ALL_STEPS)[number];
function getStepCopy(step: StepDef): { question?: string; subtext?: string } {
  if (!("question" in step)) return {};
  return {
    question: (step as any).question,
    subtext: (step as any).subtext,
  };
}

function shouldShowStep(stepId: StepId, inputs: Partial<UserInputs>): boolean {
  if (stepId === "hospitalPreference") {
    return (
      inputs.riskPosture === "Zero financial shock" ||
      inputs.cityTier === "Metro"
    );
  }
  if (stepId === "recurringExpenses") {
    return (
      inputs.familyStructure === "Parents included" ||
      inputs.riskPosture !== "Minimum but safe"
    );
  }
  return true;
}

function getVisibleStepIds(inputs: Partial<UserInputs>): StepId[] {
  return ALL_STEPS.map((s) => s.id).filter(
    (id) => id === "intro" || shouldShowStep(id as StepId, inputs)
  ) as StepId[];
}

function deriveAgeBand(age: number): AgeBand {
  if (age <= 30) return "18-30";
  if (age <= 45) return "31-45";
  if (age <= 60) return "46-60";
  return "60+";
}

/** First visible step still missing a required answer, or null when complete.
 *  Used after editing from the review screen to collect anything a changed
 *  answer newly requires, then return to review. */
function firstUnfilledStep(inputs: Partial<UserInputs>): StepId | null {
  const required: Array<[StepId, boolean]> = [
    ["location", !inputs.cityTier],
    ["familyStructure", !inputs.familyStructure],
    ["detailedProfile", !inputs.exactAge || !inputs.annualIncome],
    ["employerCover", !inputs.employerCover],
    ["riskPosture", !inputs.riskPosture],
    ["hospitalPreference", shouldShowStep("hospitalPreference", inputs) && !inputs.hospitalPreference],
    ["recurringExpenses", shouldShowStep("recurringExpenses", inputs) && !inputs.recurringExpenses],
  ];
  for (const [id, missing] of required) if (missing) return id;
  return null;
}

/** Editable summary rows for the review step. Conditional rows appear only
 *  when they hold a value. */
function buildReviewRows(inputs: Partial<UserInputs>): Array<{ label: string; value: string; stepId: StepId }> {
  const rows: Array<{ label: string; value: string; stepId: StepId }> = [];
  const push = (label: string, value: string | number | undefined, stepId: StepId) => {
    if (value !== undefined && value !== null && value !== "") rows.push({ label, value: String(value), stepId });
  };

  push("Location", inputs.city ? `${inputs.city} · ${inputs.cityTier}` : inputs.cityTier, "location");
  push("Who's covered", inputs.familyStructure, "familyStructure");
  push("Age", inputs.exactAge, "detailedProfile");
  push("Gender", inputs.gender, "detailedProfile");
  push("Annual income", inputs.annualIncome, "detailedProfile");
  push("Spouse age", inputs.spouseAge, "detailedProfile");
  push("Children", inputs.childCount, "detailedProfile");
  if (inputs.fatherAge || inputs.motherAge) {
    push("Parents' ages", [inputs.fatherAge, inputs.motherAge].filter(Boolean).join(" / "), "detailedProfile");
  }
  push("Employer cover", inputs.employerCover, "employerCover");
  push("Risk attitude", inputs.riskPosture, "riskPosture");
  push("Hospital preference", inputs.hospitalPreference, "hospitalPreference");
  push("Recurring expenses", inputs.recurringExpenses, "recurringExpenses");
  return rows;
}

const SectionDivider = ({ label }: { label: string }) => (
  <div className="col-span-full flex items-center gap-3 mt-2">
    <div className="h-px flex-1 bg-[var(--color-border-light)]" />
    <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
      {label}
    </span>
    <div className="h-px flex-1 bg-[var(--color-border-light)]" />
  </div>
);

export default function CoverCalculator({
  embedded = false,
  initialInputs,
  initialStepId,
  initialState,
  initialCity,
  authToken,
  customerId,
  partnerCompanies,
  onComplete,
}: CoverCalculatorProps) {
  const [_, setLocation] = useLocation();
  const [inputs, setInputs] = useState<Partial<UserInputs>>(initialInputs ?? {});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [currentStepId, setCurrentStepId] = useState<StepId>(
    (initialStepId as StepId) ?? (embedded ? "location" : "intro")
  );
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editingFromReview = useRef(false);
  const [selectedState, setSelectedState] = useState(initialState ?? "");
  const [selectedCity, setSelectedCity] = useState(initialCity ?? "");
  const [cityTier, setCityTier] = useState<number | null>(
    initialCity ? getCityTier(initialCity) : null
  );
  const [availableCities, setAvailableCities] = useState<string[]>(
    initialState ? getCitiesForState(initialState) : []
  );
  const skipCityReset = useRef(true);

  const allStates = getAllStates();

  // Load saved progress on mount — consumer flow only. Agent runs are short
  // and the resume prompt would leak consumer progress into the portal.
  useEffect(() => {
    if (embedded) return;
    if (hasUnsavedProgress()) {
      const progress = loadProgress();
      if (progress && confirm("You have unsaved progress. Would you like to continue where you left off?")) {
        setInputs(progress.inputs);
        setCurrentStepId(progress.step as StepId);
        if (progress.inputs.cityTier) {
          // Restore location state if available
          const state = progress.inputs.state as string | undefined;
          const city = progress.inputs.city as string | undefined;
          if (state) setSelectedState(state);
          if (city) setSelectedCity(city);
        }
      } else {
        clearProgress();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save progress (consumer flow only)
  useEffect(() => {
    if (embedded) return;
    if (currentStepId !== "intro" && Object.keys(inputs).length > 0) {
      saveProgress(currentStepId, inputs);
    }
  }, [embedded, currentStepId, inputs]);

  useEffect(() => {
    setSelectedOption(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStepId]);

  useEffect(() => {
    if (skipCityReset.current) {
      // First run: keep any prefilled city instead of clearing it.
      skipCityReset.current = false;
      if (selectedState) setAvailableCities(getCitiesForState(selectedState));
      return;
    }
    if (selectedState) {
      setAvailableCities(getCitiesForState(selectedState));
      setSelectedCity("");
      setCityTier(null);
    } else {
      setAvailableCities([]);
    }
  }, [selectedState]);

  useEffect(() => {
    if (selectedCity) {
      setCityTier(getCityTier(selectedCity));
    }
  }, [selectedCity]);

  const advanceToNextStep = (updatedInputs: Partial<UserInputs>) => {
    const allIds = ALL_STEPS.map((s) => s.id) as StepId[];
    const currentAllIdx = allIds.indexOf(currentStepId);

    let nextAllIdx = currentAllIdx + 1;
    let nextStepId: StepId | null = null;

    while (nextAllIdx < allIds.length) {
      const candidateId = allIds[nextAllIdx];
      if (shouldShowStep(candidateId, updatedInputs)) {
        nextStepId = candidateId;
        break;
      } else {
        if (candidateId === "hospitalPreference") {
          updatedInputs = { ...updatedInputs, hospitalPreference: "Any good hospital" };
        }
        if (candidateId === "recurringExpenses") {
          updatedInputs = { ...updatedInputs, recurringExpenses: "None" };
        }
        nextAllIdx++;
      }
    }

    setInputs(updatedInputs);

    // Editing a single answer from the review screen: collect anything the
    // change newly requires, then snap back to review instead of re-walking.
    if (editingFromReview.current) {
      const missing = firstUnfilledStep(updatedInputs);
      setCurrentStepId(missing ?? "review");
      if (!missing) editingFromReview.current = false;
      return;
    }

    // "review" is always the last visible step, so normal flow lands there;
    // the actual calculation is triggered by the review screen's button.
    setCurrentStepId(nextStepId ?? "review");
  };

  const editStep = (stepId: StepId) => {
    editingFromReview.current = true;
    setCurrentStepId(stepId);
  };

  const goBack = () => {
    const allIds = ALL_STEPS.map((s) => s.id) as StepId[];
    const currentAllIdx = allIds.indexOf(currentStepId);
    let prevAllIdx = currentAllIdx - 1;

    while (prevAllIdx >= 0) {
      const candidateId = allIds[prevAllIdx];
      if (candidateId === "intro" && embedded) break;
      if (candidateId === "intro" || shouldShowStep(candidateId, inputs)) {
        setCurrentStepId(candidateId);
        return;
      }
      prevAllIdx--;
    }
    if (!embedded) setCurrentStepId("intro");
  };

  const handleOptionSelect = (
    key: keyof UserInputs,
    value: string,
    updatedInputs?: Partial<UserInputs>
  ) => {
    setSelectedOption(value);
    const merged = { ...(updatedInputs ?? inputs), [key]: value };

    // Agents are power users running repeat scenarios — advance immediately.
    // The consumer flow keeps the brief "selected" beat before advancing.
    if (embedded) {
      advanceToNextStep(merged);
      return;
    }
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      advanceToNextStep(merged);
    }, 1000);
  };

  const confirmLocation = () => {
    if (!selectedCity || !cityTier) return;
    let tierLabel: CityTier = "Other";
    if (cityTier === 1) tierLabel = "Metro";
    else if (cityTier === 2) tierLabel = "Tier-1";
    else tierLabel = "Tier-2";

    // Persist the chosen state/city so the review step can round-trip them.
    const merged = { ...inputs, cityTier: tierLabel, state: selectedState, city: selectedCity };
    advanceToNextStep(merged);
  };

  const confirmDetailedProfile = () => {
    // Validate age
    const age = inputs.exactAge;
    if (!age) {
      setValidationErrors({ exactAge: "Age is required" });
      return;
    }

    const ageError = getAgeError(age);
    if (ageError) {
      setValidationErrors({ exactAge: ageError });
      return;
    }

    if (!inputs.annualIncome) {
      setValidationErrors({ annualIncome: "Income is required" });
      return;
    }

    setValidationErrors({});
    const ageBand: AgeBand = deriveAgeBand(age);
    const merged = { ...inputs, ageBand };
    advanceToNextStep(merged);
  };

  const finishAnalysis = async (finalInputs: UserInputs) => {
    setIsAnalyzing(true);

    try {
      // Calculate the result. The pause is trust-building theatre for the
      // public funnel; agents running repeat scenarios don't need it.
      if (!embedded) await new Promise((r) => setTimeout(r, 1500));
      const analysis = calculateHealthCover(finalInputs, { partnerCompanies });

      // Save to backend with retry logic
      setIsSaving(true);
      const saveResult = await saveCalculatorReport(finalInputs, analysis, {
        authToken: authToken ?? undefined,
        customerId: customerId ?? undefined,
      });
      setIsSaving(false);

      if (embedded) {
        setIsAnalyzing(false);
        if (!saveResult.success) {
          showWarning(
            "Report not saved",
            "The result is shown below, but the share link could not be created."
          );
        }
        onComplete?.({
          uuid: saveResult.success ? saveResult.uuid : null,
          inputs: finalInputs,
          result: analysis,
        });
        return;
      }

      if (saveResult.success) {
        // Clear progress since we successfully saved
        clearProgress();
        // Set timestamp for success banner on report page
        sessionStorage.setItem("calculator_saved_timestamp", Date.now().toString());
        setIsAnalyzing(false);
        setLocation(`/calculator/report/${saveResult.uuid}`);
      } else {
        // Show error with retry option
        showError(
          "Failed to Save Report",
          saveResult.error,
          {
            label: "Retry",
            onClick: () => finishAnalysis(finalInputs),
          }
        );

        // Fallback: still show the report but without UUID
        showWarning(
          "Viewing Temporary Report",
          "Your report wasn't saved, but you can still view it. It will be lost if you close this tab."
        );

        // Store in sessionStorage as fallback
        sessionStorage.setItem("calculator_result", JSON.stringify(analysis));
        sessionStorage.setItem("calculator_inputs", JSON.stringify(finalInputs));
        setIsAnalyzing(false);
        setLocation("/calculator/report");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      showError(
        "Calculation Error",
        "Something went wrong during the analysis. Please try again."
      );
      setIsAnalyzing(false);
      setIsSaving(false);
    }
  };

  const visibleStepIds = getVisibleStepIds(inputs).filter((id) => id !== "intro" && id !== "review");
  const currentVisibleIdx = visibleStepIds.indexOf(currentStepId as Exclude<StepId, "intro" | "review">);
  const isIntro = currentStepId === "intro";

  const currentStepDef = ALL_STEPS.find((s) => s.id === currentStepId)!;
  const { question, subtext } = getStepCopy(currentStepDef);

  if (isAnalyzing) {
    return (
      <div
        className={cn(
          "w-full flex flex-col items-center justify-center",
          embedded ? "py-24" : "min-h-[60vh] py-24"
        )}
      >
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[var(--color-teal-600)] mb-8" />
        <h2 className="text-2xl font-serif text-[var(--color-navy-900)] animate-pulse mb-2">
          {isSaving ? "Saving Your Report..." : "Analysing 140+ Policy Combinations..."}
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          {isSaving
            ? "Securely storing your coverage analysis..."
            : `Checking inflation data for ${inputs.cityTier}...`}
        </p>
        {isSaving && (
          <p className="text-xs text-[var(--color-text-muted)] mt-4">
            This may take a few seconds. Please don't close this page.
          </p>
        )}
      </div>
    );
  }

  return (
    <CalculatorErrorBoundary>
      <div className="w-full flex flex-col items-center">
        {!isIntro && currentStepId !== "review" && (
          <div className="mb-8 w-full max-w-2xl">
            <CalculatorProgressDots
              currentStep={currentVisibleIdx + 1}
              totalSteps={visibleStepIds.length}
            />
            <div className="text-center mt-2 text-sm text-[var(--color-text-secondary)]">
              Step {currentVisibleIdx + 1} of {visibleStepIds.length}
            </div>
          </div>
        )}

        <div
          key={currentStepId}
          className={cn(
            "w-full transition-all duration-400 ease-in-out",
            currentStepId === "intro" ? "max-w-5xl" : "max-w-2xl"
          )}
        >
          {currentStepId === "intro" ? (
            <CalculatorLanding onStart={() => setCurrentStepId("location")} />

          ) : currentStepId === "location" ? (
            <div className="bg-white/50 backdrop-blur-sm border border-[var(--color-border-light)] p-8 md:p-12 rounded-3xl shadow-sm space-y-6">
              <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-navy-900)] mb-3">
                  {question}
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  {subtext}
                </p>
              </div>

              <div className="space-y-2">
                <Label>State</Label>
                <Combobox
                  options={allStates.map((s: string) => ({ value: s, label: s }))}
                  value={selectedState}
                  onValueChange={setSelectedState}
                  placeholder="Select State"
                  searchPlaceholder="Search state..."
                  className="bg-white border-[var(--color-border-medium)] h-12"
                />
              </div>

              <div className="space-y-2">
                <Label>City</Label>
                <Combobox
                  options={availableCities.map((c: string) => ({ value: c, label: c }))}
                  value={selectedCity}
                  onValueChange={setSelectedCity}
                  placeholder={selectedState ? "Select City" : "Select State First"}
                  searchPlaceholder="Search city..."
                  className={cn(
                    "bg-white border-[var(--color-border-medium)] h-12",
                    !selectedState && "opacity-50 pointer-events-none"
                  )}
                />
                {cityTier && (
                  <div className="flex items-center gap-2 mt-2 text-xs font-mono uppercase tracking-widest text-[var(--color-teal-600)]">
                    <MapPin className="w-3 h-3" />
                    {getTierDescription(cityTier as any)}
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-4 pt-2">
                {!embedded && (
                  <Button
                    variant="ghost"
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-navy-900)]"
                    onClick={goBack}
                  >
                    Back
                  </Button>
                )}
                <Button
                  disabled={!selectedCity}
                  className={cn(
                    "bg-[var(--color-teal-600)] text-white px-8",
                    !selectedCity && "opacity-50"
                  )}
                  onClick={confirmLocation}
                >
                  Next Step
                </Button>
              </div>
            </div>

          ) : currentStepId === "detailedProfile" ? (
            <div className="bg-white/50 backdrop-blur-sm border border-[var(--color-border-light)] p-8 md:p-12 rounded-3xl shadow-sm">
              <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-navy-900)] mb-3 text-center">
                {question}
              </h2>
              <p className="text-center text-[var(--color-text-secondary)] mb-8">
                Help us calculate risks precisely.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <SectionDivider label="Your Details" />

                <div className="space-y-2">
                  <Label>Your Age</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 30"
                    className={cn(
                      "bg-white h-12",
                      validationErrors.exactAge && "border-red-500"
                    )}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const value = sanitizeIntegerInput(e.target.value);
                      setInputs({ ...inputs, exactAge: value });
                      if (value) {
                        const error = getAgeError(value);
                        if (error) {
                          setValidationErrors({ ...validationErrors, exactAge: error });
                        } else {
                          const { exactAge, ...rest } = validationErrors;
                          setValidationErrors(rest);
                        }
                      }
                    }}
                    value={inputs.exactAge || ""}
                    min={18}
                    max={75}
                  />
                  {validationErrors.exactAge && (
                    <div className="flex items-center gap-1 text-red-600 text-xs mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.exactAge}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Your Gender</Label>
                  <Select
                    onValueChange={(v: "Male" | "Female") =>
                      setInputs({ ...inputs, gender: v })
                    }
                    defaultValue={inputs.gender}
                  >
                    <SelectTrigger className="bg-white h-12">
                      <SelectValue placeholder="Select Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Annual Family Income</Label>
                  <Select
                    onValueChange={(v: string) =>
                      setInputs({ ...inputs, annualIncome: v })
                    }
                    defaultValue={inputs.annualIncome}
                  >
                    <SelectTrigger className="bg-white h-12">
                      <SelectValue placeholder="Annual Income" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="< 5L">Less than ₹5 Lakhs</SelectItem>
                      <SelectItem value="5-10L">₹5 – ₹10 Lakhs</SelectItem>
                      <SelectItem value="10-20L">₹10 – ₹20 Lakhs</SelectItem>
                      <SelectItem value="20L+">More than ₹20 Lakhs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(inputs.familyStructure === "Couple" ||
                  inputs.familyStructure === "Couple + kids") && (
                  <>
                    <SectionDivider label="Spouse Details" />

                    <div className="space-y-2">
                      <Label>Spouse Age</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 28"
                        className="bg-white h-12"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setInputs({
                            ...inputs,
                            spouseAge: parseInt(e.target.value) || undefined,
                          })
                        }
                        defaultValue={inputs.spouseAge}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Spouse Income</Label>
                      <Select
                        onValueChange={(v: string) =>
                          setInputs({ ...inputs, spouseIncome: v })
                        }
                        defaultValue={inputs.spouseIncome}
                      >
                        <SelectTrigger className="bg-white h-12">
                          <SelectValue placeholder="Spouse Income" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="None">None / Homemaker</SelectItem>
                          <SelectItem value="< 5L">Less than ₹5 Lakhs</SelectItem>
                          <SelectItem value="5-10L">₹5 – ₹10 Lakhs</SelectItem>
                          <SelectItem value="10L+">More than ₹10 Lakhs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Spouse Employer Coverage</Label>
                      <Select
                        onValueChange={(v: any) =>
                          setInputs({ ...inputs, spouseEmployerCover: v })
                        }
                        defaultValue={inputs.spouseEmployerCover}
                      >
                        <SelectTrigger className="bg-white h-12">
                          <SelectValue placeholder="Employer Cover" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="None">None</SelectItem>
                          <SelectItem value="< 5L">Less than ₹5 Lakhs</SelectItem>
                          <SelectItem value="5-10L">₹5 – ₹10 Lakhs</SelectItem>
                          <SelectItem value="> 10L">More than ₹10 Lakhs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {inputs.familyStructure === "Couple + kids" && (
                  <>
                    <SectionDivider label="Children" />
                    <div className="space-y-2 md:col-span-2">
                      <Label>Number of Children</Label>
                      <Select
                        onValueChange={(v: string) =>
                          setInputs({ ...inputs, childCount: parseInt(v) })
                        }
                        defaultValue={inputs.childCount?.toString()}
                      >
                        <SelectTrigger className="bg-white h-12">
                          <SelectValue placeholder="Count" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Child</SelectItem>
                          <SelectItem value="2">2 Children</SelectItem>
                          <SelectItem value="3">3+ Children</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {inputs.familyStructure === "Parents included" && (
                  <>
                    <SectionDivider label="Parents" />

                    <div className="space-y-2">
                      <Label>Father's Age</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 65"
                        className="bg-white h-12"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setInputs({
                            ...inputs,
                            fatherAge: parseInt(e.target.value) || undefined,
                          })
                        }
                        defaultValue={inputs.fatherAge}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Mother's Age</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 60"
                        className="bg-white h-12"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setInputs({
                            ...inputs,
                            motherAge: parseInt(e.target.value) || undefined,
                          })
                        }
                        defaultValue={inputs.motherAge}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-center gap-4 mt-8">
                <Button
                  variant="ghost"
                  onClick={goBack}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-navy-900)]"
                >
                  Back
                </Button>
                <Button
                  className="bg-[var(--color-teal-600)] text-white px-8"
                  disabled={!inputs.exactAge || !inputs.annualIncome}
                  onClick={confirmDetailedProfile}
                >
                  Next Step
                </Button>
              </div>
            </div>

          ) : currentStepId === "review" ? (
            <div className="bg-white/50 backdrop-blur-sm border border-[var(--color-border-light)] p-8 md:p-12 rounded-3xl shadow-sm">
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-navy-900)] mb-3">{question}</h2>
                <p className="text-[var(--color-text-secondary)]">{subtext}</p>
              </div>

              <div className="divide-y divide-[var(--color-border-light)] rounded-2xl border border-[var(--color-border-light)] bg-white overflow-hidden">
                {buildReviewRows(inputs).map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">{row.label}</div>
                      <div className="text-sm font-semibold text-[var(--color-navy-900)] truncate">{row.value}</div>
                    </div>
                    <button
                      onClick={() => editStep(row.stepId)}
                      className="shrink-0 text-xs font-semibold text-[var(--color-teal-600)] hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-center gap-4 mt-8">
                <Button
                  variant="ghost"
                  onClick={goBack}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-navy-900)]"
                >
                  Back
                </Button>
                <Button
                  className="bg-[var(--color-teal-600)] text-white px-8"
                  onClick={() => finishAnalysis(inputs as UserInputs)}
                >
                  {embedded ? "Calculate Cover Need" : "See My Coverage Plan"}
                </Button>
              </div>
            </div>

          ) : (
            <div className="bg-white/50 backdrop-blur-sm border border-[var(--color-border-light)] p-8 md:p-12 rounded-3xl shadow-sm">
              <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-navy-900)] mb-3 text-center">
                {question}
              </h2>
              {subtext && (
                <p className="text-center text-[var(--color-text-secondary)] mb-8">
                  {subtext}
                </p>
              )}
              {(currentStepDef as any).description && (
                <p className="text-center text-[var(--color-text-secondary)] mb-8">
                  {(currentStepDef as any).description}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                {(currentStepDef as any).options?.map((opt: any, idx: number) => {
                  const isObj = typeof opt === "object";
                  const label = isObj ? opt.label : opt;
                  const sub = isObj ? opt.sub : undefined;

                  return (
                    <OptionCard
                      key={idx}
                      label={label}
                      subLabel={sub}
                      selected={selectedOption === label}
                      onClick={() =>
                        handleOptionSelect(
                          currentStepId as keyof UserInputs,
                          label
                        )
                      }
                    />
                  );
                })}
              </div>

              <div className="mt-8 flex justify-center">
                <Button
                  variant="ghost"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-navy-900)]"
                  onClick={goBack}
                >
                  Back
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </CalculatorErrorBoundary>
  );
}
