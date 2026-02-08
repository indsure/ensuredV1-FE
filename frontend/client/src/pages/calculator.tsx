import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, ArrowRight, MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  calculateHealthCover, UserInputs, EngineResult,
  AgeBand, CityTier
} from "@/lib/health-engine-logic";
import { getCityTier, getTierDescription } from "@/lib/city-tier-util";
import { getAllStates, getCitiesForState } from "@/lib/indian-cities-data";
import { CalculatorLanding } from "@/components/CalculatorLanding";

// --- Components ---

const OptionCard = ({
  label,
  selected,
  onClick,
  subLabel
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  subLabel?: string;
}) => (
  <div
    onClick={onClick}
    className={cn(
      "cursor-pointer rounded-xl border-2 p-6 transition-all duration-200 flex flex-col items-center text-center justify-center gap-2",
      selected
        ? "border-[var(--color-teal-600)] bg-[var(--color-teal-50)] shadow-md scale-[1.02]"
        : "border-[var(--color-border-light)] bg-white hover:border-[var(--color-teal-300)] hover:bg-gray-50"
    )}
  >
    <div className={cn("font-medium text-lg", selected ? "text-[var(--color-teal-900)]" : "text-[var(--color-text-main)]")}>
      {label}
    </div>
    {subLabel && <div className="text-xs text-[var(--color-text-muted)]">{subLabel}</div>}
    {selected && <div className="absolute top-3 right-3 text-[var(--color-teal-600)]"><Check className="w-5 h-5" /></div>}
  </div>
);

// --- Steps Configuration ---

const STEPS = [
  {
    id: "intro",
    title: "IndSure Intelligence Engine",
    subtitle: "Objective Analysis. No Sales Push.",
    description: "I will calculate your exact coverage needs based on medical inflation and lifestyle risks.",
    buttonText: "Start Analysis"
  },
  {
    id: "location", // Custom Step Type
    question: "Where do you live?",
    subtext: "Your pincode helps us determine medical zone costs.",
  },
  {
    id: "familyStructure",
    question: "Who needs coverage?",
    options: ["Individual", "Couple", "Couple + kids", "Parents included"]
  },
  {
    id: "detailedProfile", // New Custom Step
    question: "Member Details"
  },
  {
    id: "employerCover",
    question: "Do you have employer coverage?",
    options: ["None", "< 5L", "5-10L", "> 10L"]
  },
  {
    id: "riskPosture",
    question: "What is your risk attitude?",
    description: "Honest answer determines cushion vs efficiency.",
    options: [
      { label: "Minimum but safe", sub: "Cover big risks, pay minor bills" },
      { label: "Balanced", sub: "Standard protection" },
      { label: "Zero financial shock", sub: "I want 100% cashless everywhere" }
    ]
  },
  // Level 2 - Conditional triggers implemented in logic
  {
    id: "hospitalPreference",
    level: 2,
    question: "Preferred Hospital Type?",
    options: ["Any good hospital", "Large private hospitals", "Premium corporate hospitals"]
  },
  {
    id: "recurringExpenses",
    level: 2,
    question: "Any recurring medical expenses?",
    options: ["None", "Minor (tests/OPD/meds)", "Chronic but stable"]
  }
];

export default function CalculatorPage() {
  const [_, setLocation] = useLocation();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [inputs, setInputs] = useState<Partial<UserInputs>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Location State
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [cityTier, setCityTier] = useState<number | null>(null);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  const allStates = getAllStates();

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStepIndex]);

  // Load cities when state changes
  useEffect(() => {
    if (selectedState) {
      setAvailableCities(getCitiesForState(selectedState));
    } else {
      setAvailableCities([]);
    }
  }, [selectedState]);

  // Update Tier when city changes
  useEffect(() => {
    if (selectedCity) {
      const tmptier = getCityTier(selectedCity);
      setCityTier(tmptier);
    }
  }, [selectedCity]);

  const handleCityChange = (val: string) => {
    setSelectedCity(val);
  };

  const confirmLocation = () => {
    if (!selectedCity || !cityTier) return;

    let tierLabel: CityTier = "Other";
    if (cityTier === 1) tierLabel = "Metro";
    else if (cityTier === 2) tierLabel = "Tier-1";
    else tierLabel = "Tier-2";

    handleNext("cityTier", tierLabel);
  };

  const handleNext = (key: keyof UserInputs, value: any) => {
    // Save input
    const newInputs = { ...inputs, [key]: value };
    setInputs(newInputs);

    // Determine next step
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex((prev: number) => prev + 1);
    } else {
      finishAnalysis(newInputs as UserInputs);
    }
  };

  const finishAnalysis = async (finalInputs: UserInputs) => {
    setIsAnalyzing(true);
    await new Promise(r => setTimeout(r, 1500));
    const analysis = calculateHealthCover(finalInputs);

    // Save to session storage and navigate
    sessionStorage.setItem("calculator_result", JSON.stringify(analysis));
    sessionStorage.setItem("calculator_inputs", JSON.stringify(finalInputs));

    setIsAnalyzing(false);
    setLocation("/calculator/report");
  };

  const currentStep = STEPS[currentStepIndex];

  // Render Loader
  if (isAnalyzing) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[var(--color-cream-main)]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[var(--color-teal-600)] mb-8"></div>
        <h2 className="text-2xl font-serif text-[var(--color-navy-900)] animate-pulse">Analysing 140+ Policy Combinations...</h2>
        <p className="text-[var(--color-text-secondary)] mt-2">Checking inflation data for {inputs.cityTier}...</p>
      </div>
    );
  }

  // Render Steps
  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans flex flex-col">
      <Header />
      <main className="flex-grow flex flex-col items-center justify-center p-6 pt-24">

        {/* Progress Bar (Optional) */}
        {currentStepIndex > 0 && (
          <div className="flex gap-2 mb-8">
            {STEPS.slice(1).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i < currentStepIndex ? "w-8 bg-[var(--color-teal-600)]" : "w-2 bg-[var(--color-border-medium)]"
                )}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-2xl"
          >
            {/* Intro Step */}
            {currentStep.id === "intro" ? (
              <CalculatorLanding onStart={() => setCurrentStepIndex(1)} />
            ) : currentStep.id === "location" ? (
              /* --- LOCATION WIZARD STEP --- */
              <div className="bg-white/50 backdrop-blur-sm border border-[var(--color-border-light)] p-8 md:p-12 rounded-3xl shadow-sm">
                <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-navy-900)] mb-3 text-center">
                  {currentStep.question}
                </h2>
                <p className="text-center text-[var(--color-text-secondary)] mb-8">{currentStep.subtext}</p>

                <div className="space-y-2">
                  <Label>State</Label>
                  <Combobox
                    options={allStates.map(s => ({ value: s, label: s }))}
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
                    options={availableCities.map(c => ({ value: c, label: c }))}
                    value={selectedCity}
                    onValueChange={handleCityChange}
                    placeholder={selectedState ? "Select City" : "Select State First"}
                    searchPlaceholder="Search city..."
                    className={cn("bg-white border-[var(--color-border-medium)] h-12", !selectedState && "opacity-50 pointer-events-none")}
                  />
                  {cityTier && (
                    <div className="flex items-center gap-2 mt-2 text-xs font-mono uppercase tracking-widest text-[var(--color-teal-600)]">
                      <MapPin className="w-3 h-3" />
                      {getTierDescription(cityTier as any)}
                    </div>
                  )}
                </div>

                <div className="flex justify-center gap-4 mt-8">
                  <Button variant="ghost" className="text-[var(--color-text-muted)] hover:text-[var(--color-navy-900)]" onClick={() => setCurrentStepIndex((prev: number) => prev - 1)}>
                    Back
                  </Button>
                  <Button
                    disabled={!selectedCity}
                    className={cn("bg-[var(--color-teal-600)] text-white px-8", !selectedCity && "opacity-50")}
                    onClick={confirmLocation}
                  >
                    Next Step
                  </Button>
                </div>
              </div>
            ) : currentStep.id === "detailedProfile" ? (
              /* --- NEW DETAILED PROFILE STEP --- */
              <div className="bg-white/50 backdrop-blur-sm border border-[var(--color-border-light)] p-8 md:p-12 rounded-3xl shadow-sm">
                <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-navy-900)] mb-3 text-center">
                  {currentStep.question}
                </h2>
                <p className="text-center text-[var(--color-text-secondary)] mb-8">
                  Help us calculate risks precisely.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Your Gender</Label>
                    <Select onValueChange={(v: "Male" | "Female") => setInputs({ ...inputs, gender: v })} defaultValue={inputs.gender}>
                      <SelectTrigger className="bg-white h-12"><SelectValue placeholder="Select Gender" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Your Age</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 30"
                      className="bg-white h-12"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputs({ ...inputs, exactAge: parseInt(e.target.value) || undefined })}
                      defaultValue={inputs.exactAge}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Gross Family Income</Label>
                    <Select onValueChange={(v: string) => setInputs({ ...inputs, annualIncome: v })} defaultValue={inputs.annualIncome}>
                      <SelectTrigger className="bg-white h-12"><SelectValue placeholder="Annual Income" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="< 5L">Less than 5 Lakhs</SelectItem>
                        <SelectItem value="5-10L">5 - 10 Lakhs</SelectItem>
                        <SelectItem value="10-20L">10 - 20 Lakhs</SelectItem>
                        <SelectItem value="20L+">More than 20 Lakhs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(inputs.familyStructure === "Couple" || inputs.familyStructure === "Couple + kids") && (
                    <>
                      <div className="space-y-2">
                        <Label>Spouse Age</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 28"
                          className="bg-white h-12"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputs({ ...inputs, spouseAge: parseInt(e.target.value) || undefined })}
                          defaultValue={inputs.spouseAge}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Spouse Income</Label>
                        <Select onValueChange={(v: string) => setInputs({ ...inputs, spouseIncome: v })} defaultValue={inputs.spouseIncome}>
                          <SelectTrigger className="bg-white h-12"><SelectValue placeholder="Spouse Income" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="None">None / Homemaker</SelectItem>
                            <SelectItem value="< 5L">Less than 5 Lakhs</SelectItem>
                            <SelectItem value="5-10L">5 - 10 Lakhs</SelectItem>
                            <SelectItem value="10L+">More than 10 Lakhs</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Spouse Employer Coverage</Label>
                        <Select onValueChange={(v: any) => setInputs({ ...inputs, spouseEmployerCover: v })} defaultValue={inputs.spouseEmployerCover}>
                          <SelectTrigger className="bg-white h-12"><SelectValue placeholder="Employer Cover" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="None">None</SelectItem>
                            <SelectItem value="< 5L">Less than 5 Lakhs</SelectItem>
                            <SelectItem value="5-10L">5 - 10 Lakhs</SelectItem>
                            <SelectItem value="> 10L">More than 10 Lakhs</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {(inputs.familyStructure === "Parents included") && (
                    <>
                      <div className="space-y-2">
                        <Label>Father's Age</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 65"
                          className="bg-white h-12"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputs({ ...inputs, fatherAge: parseInt(e.target.value) || undefined })}
                          defaultValue={inputs.fatherAge}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mother's Age</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 60"
                          className="bg-white h-12"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputs({ ...inputs, motherAge: parseInt(e.target.value) || undefined })}
                          defaultValue={inputs.motherAge}
                        />
                      </div>
                    </>
                  )}

                  {(inputs.familyStructure === "Couple + kids") && (
                    <div className="space-y-2">
                      <Label>Number of Children</Label>
                      <Select onValueChange={(v: string) => setInputs({ ...inputs, childCount: parseInt(v) })} defaultValue={inputs.childCount?.toString()}>
                        <SelectTrigger className="bg-white h-12"><SelectValue placeholder="Count" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Child</SelectItem>
                          <SelectItem value="2">2 Children</SelectItem>
                          <SelectItem value="3">3+ Children</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex justify-center gap-4 mt-8">
                  <Button variant="ghost" onClick={() => setCurrentStepIndex((prev: number) => prev - 1)}>Back</Button>
                  <Button
                    className="bg-[var(--color-teal-600)] text-white px-8"
                    disabled={!inputs.exactAge || !inputs.annualIncome}
                    onClick={() => {
                      // Infer AgeBand from Exact Age for compatibility
                      let band: AgeBand = "18-30";
                      if (inputs.exactAge! > 30) band = "31-45";
                      if (inputs.exactAge! > 45) band = "46-60";
                      if (inputs.exactAge! > 60) band = "60+";
                      setInputs({ ...inputs, ageBand: band });
                      handleNext("exactAge", inputs.exactAge);
                    }}
                  >
                    Next Step
                  </Button>
                </div>
              </div>
            ) : (
              /* Standard Question Steps */
              <div className="bg-white/50 backdrop-blur-sm border border-[var(--color-border-light)] p-8 md:p-12 rounded-3xl shadow-sm">
                <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-navy-900)] mb-3 text-center">
                  {currentStep.question}
                </h2>
                {currentStep.subtext && (
                  <p className="text-center text-[var(--color-text-secondary)] mb-8">{currentStep.subtext}</p>
                )}
                {currentStep.description && (
                  <p className="text-center text-[var(--color-text-secondary)] mb-8">{currentStep.description}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                  {currentStep.options?.map((opt: any, idx: number) => {
                    const isObj = typeof opt === "object";
                    const label = isObj ? opt.label : opt;
                    const sub = isObj ? opt.sub : undefined;

                    return (
                      <OptionCard
                        key={idx}
                        label={label}
                        subLabel={sub}
                        selected={false}
                        onClick={() => handleNext(currentStep.id as keyof UserInputs, label)}
                      />
                    );
                  })}
                </div>

                {currentStepIndex > 1 && (
                  <div className="mt-8 flex justify-center">
                    <Button variant="ghost" className="text-[var(--color-text-muted)] hover:text-[var(--color-navy-900)]" onClick={() => setCurrentStepIndex((prev: number) => prev - 1)}>
                      Back
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

      </main>
      <Footer />
    </div >
  );
}
