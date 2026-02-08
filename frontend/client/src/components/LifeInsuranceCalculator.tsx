import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  GraduationCap,
  Home,
  AlertCircle,
  CheckCircle2,
  Target,
  TrendingUp,
  CreditCard,
  Calculator,
  Scale,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import {
  calculateLifeInsuranceNeed,
  type LifeInsuranceInput,
  type LifeInsuranceResult,
} from "@/lib/calculators/lifeInsuranceCalculator";
import { getAllStates, getCitiesForState } from "@/lib/indian-cities-data";
import { Combobox } from "@/components/ui/combobox";

export function LifeInsuranceCalculator({ variant = "life" }: { variant?: "life" | "term" } = {}) {
  const [, setLocation] = useLocation();
  const [result, setResult] = useState<LifeInsuranceResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedState, setSelectedState] = useState<string>("");
  const allStates = getAllStates();
  const availableCities = selectedState ? getCitiesForState(selectedState) : [];

  // Determine variant from URL if not provided
  const actualVariant = variant || (window.location.search.includes("type=term") ? "term" : "life");
  const isTerm = actualVariant === "term";

  const [formData, setFormData] = useState<Partial<LifeInsuranceInput>>({
    age: 35,
    gender: undefined,
    city: "",
    state: "",
    annualIncome: 1200000, // ₹12L default
    savings: 300000, // ₹3L default
    maritalStatus: "Married",
    childrenCount: 2,
    youngestChildAge: 5,
    educationType: "Private",
    homeLoan: 5000000, // ₹50L default
    carLoan: 1000000, // ₹10L default
    otherLoans: 0,
    hasExistingInsurance: false,
    existingInsuranceAmount: 0,
    spouseAge: 32,
    spouseIncome: 0,
    desiredRetirementAge: 60,
    legacyGoals: 0,
  });

  // Load saved form data
  useEffect(() => {
    const saved = localStorage.getItem(isTerm ? "ensured_term_calculator_form" : "ensured_life_calculator_form");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData((prev) => ({ ...prev, ...parsed }));
        if (parsed.state) setSelectedState(parsed.state);
      } catch (e) {
        // Ignore
      }
    }
  }, [isTerm]);

  // Auto-save form data
  useEffect(() => {
    if (Object.keys(formData).length > 0) {
      localStorage.setItem(isTerm ? "ensured_term_calculator_form" : "ensured_life_calculator_form", JSON.stringify(formData));
    }
  }, [formData, isTerm]);

  const updateFormData = (field: keyof LifeInsuranceInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.age || formData.age < 18 || formData.age > 75) {
      newErrors.age = "Please enter a valid age between 18 and 75";
    }
    if (!formData.gender) {
      newErrors.gender = "Please select your gender";
    }
    if (!formData.state) {
      newErrors.state = "Please select your state";
    }
    if (!formData.city) {
      newErrors.city = "Please select your city";
    }
    if (!formData.annualIncome || formData.annualIncome < 300000) {
      newErrors.annualIncome = "Please enter a valid annual income (minimum ₹3L)";
    }
    if (formData.maritalStatus === "Married") {
      if (!formData.spouseAge || formData.spouseAge < 20 || formData.spouseAge > 80) {
        newErrors.spouseAge = "Please enter a valid spouse age";
      }
      if (!formData.desiredRetirementAge) {
        newErrors.desiredRetirementAge = "Please select desired retirement age";
      }
    }
    if ((formData.childrenCount || 0) > 0 && (!formData.youngestChildAge || formData.youngestChildAge < 0 || formData.youngestChildAge > 25)) {
      newErrors.youngestChildAge = "Please enter a valid child age";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCalculate = () => {
    if (!validateForm()) return;

    const input: LifeInsuranceInput = {
      age: formData.age!,
      gender: formData.gender as "Male" | "Female",
      city: formData.city!,
      state: formData.state!,
      annualIncome: formData.annualIncome!,
      savings: formData.savings || 0,
      maritalStatus: formData.maritalStatus as "Single" | "Married",
      childrenCount: formData.childrenCount || 0,
      youngestChildAge: formData.youngestChildAge || 0,
      educationType: formData.educationType as "Public" | "Private" | "International",
      homeLoan: formData.homeLoan || 0,
      carLoan: formData.carLoan || 0,
      otherLoans: formData.otherLoans || 0,
      hasExistingInsurance: formData.hasExistingInsurance || false,
      existingInsuranceAmount: formData.existingInsuranceAmount || 0,
      spouseAge: formData.spouseAge || 0,
      spouseIncome: formData.spouseIncome || 0,
      desiredRetirementAge: formData.desiredRetirementAge || 60,
      legacyGoals: formData.legacyGoals || 0,
    };

    const calculation = calculateLifeInsuranceNeed(input);
    setResult(calculation);

    // Scroll to results
    setTimeout(() => {
      document.getElementById(isTerm ? "term-calculator-results" : "life-calculator-results")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const formatCurrencyFull = (amount: number): string => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Input Form Section */}
      <section className="bg-white dark:bg-[#0F1419] py-12 px-6 md:px-14">
        <div className="max-w-[600px] mx-auto">
          <h1 className="text-3xl font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
            Calculate Your {isTerm ? "Term Life" : ""} Coverage Need
          </h1>
          <p className="text-base text-[#6B7280] dark:text-[#9CA3AF] mb-8">
            Answer a few questions. We'll calculate how much {isTerm ? "term life insurance" : "life insurance"}
            your family actually needs.{isTerm && " Pure protection, maximum coverage per rupee, 20–30 year terms."}
          </p>
          {isTerm && (
            <div className="mb-6 p-4 bg-[#EFF6FF] dark:bg-[#1E3A5F]/30 rounded-lg border-l-4 border-[#00B4D8]">
              <p className="text-sm text-[#0F1419] dark:text-[#FAFBFC]">
                💡 <strong>Term Life Insurance:</strong> Pure protection for 20–30 years. Maximum coverage per rupee.
                No investment component. If you die during term, family gets sum assured. If you survive, policy expires.
                Most affordable option for maximum protection.
              </p>
            </div>
          )}

          <div className="space-y-6">
            {/* Section 1: Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                Basic Information
              </h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Your Age
                  </Label>
                  <Input
                    type="number"
                    value={formData.age || ""}
                    onChange={(e) => updateFormData("age", parseInt(e.target.value) || 0)}
                    className="h-10 mt-1"
                    min={18}
                    max={75}
                  />
                  {errors.age && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.age}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Your Gender
                  </Label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="gender"
                        value="Male"
                        checked={formData.gender === "Male"}
                        onChange={(e) => updateFormData("gender", e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Male</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="gender"
                        value="Female"
                        checked={formData.gender === "Female"}
                        onChange={(e) => updateFormData("gender", e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Female</span>
                    </label>
                  </div>
                  {errors.gender && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.gender}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Your State
                  </Label>
                  <Select
                    value={selectedState}
                    onValueChange={(value) => {
                      setSelectedState(value);
                      updateFormData("state", value);
                      updateFormData("city", ""); // Reset city when state changes
                    }}
                  >
                    <SelectTrigger className="h-10 mt-1">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {allStates.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.state && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.state}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Your City
                  </Label>
                  <Combobox
                    options={availableCities.map((city) => ({ value: city, label: city }))}
                    value={formData.city || ""}
                    onValueChange={(value) => updateFormData("city", value)}
                    placeholder="Select city"
                    className={`mt-1 ${!selectedState ? 'opacity-50 pointer-events-none' : ''}`}
                  />
                  {errors.city && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.city}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Financial Profile */}
            <div>
              <h3 className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                Financial Profile
              </h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Annual Income (Gross)
                  </Label>
                  <Input
                    type="number"
                    value={formData.annualIncome || ""}
                    onChange={(e) => updateFormData("annualIncome", parseInt(e.target.value) || 0)}
                    className="h-10 mt-1"
                    placeholder="₹12,00,000"
                  />
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                    Format: ₹[X] lakhs (Range: ₹3L–₹100L+)
                  </p>
                  {errors.annualIncome && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.annualIncome}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Current Savings/Emergency Fund
                  </Label>
                  <Input
                    type="number"
                    value={formData.savings || ""}
                    onChange={(e) => updateFormData("savings", parseInt(e.target.value) || 0)}
                    className="h-10 mt-1"
                    placeholder="₹3,00,000"
                  />
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                    Deducted from total need (one-time emergency buffer)
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Dependent Family */}
            <div>
              <h3 className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                Dependent Family
              </h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Marital Status
                  </Label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="maritalStatus"
                        value="Single"
                        checked={formData.maritalStatus === "Single"}
                        onChange={(e) => updateFormData("maritalStatus", e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Single</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="maritalStatus"
                        value="Married"
                        checked={formData.maritalStatus === "Married"}
                        onChange={(e) => updateFormData("maritalStatus", e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Married</span>
                    </label>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Number of Children
                  </Label>
                  <Select
                    value={formData.childrenCount?.toString() || "0"}
                    onValueChange={(value) => updateFormData("childrenCount", parseInt(value))}
                  >
                    <SelectTrigger className="h-10 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num === 4 ? "4+" : num.toString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.childrenCount && formData.childrenCount > 0 && (
                  <>
                    <div>
                      <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                        Youngest Child's Age
                      </Label>
                      <Input
                        type="number"
                        value={formData.youngestChildAge || ""}
                        onChange={(e) => updateFormData("youngestChildAge", parseInt(e.target.value) || 0)}
                        className="h-10 mt-1"
                        min={0}
                        max={25}
                      />
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                        Helps calculate education cost years
                      </p>
                      {errors.youngestChildAge && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.youngestChildAge}</p>
                      )}
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                        Where do you want kids to study?
                      </Label>
                      <div className="space-y-2 mt-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="educationType"
                            value="Public"
                            checked={formData.educationType === "Public"}
                            onChange={(e) => updateFormData("educationType", e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                            Public school (₹3L–5L total)
                          </span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="educationType"
                            value="Private"
                            checked={formData.educationType === "Private"}
                            onChange={(e) => updateFormData("educationType", e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                            Private school (₹15L–25L total)
                          </span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="educationType"
                            value="International"
                            checked={formData.educationType === "International"}
                            onChange={(e) => updateFormData("educationType", e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                            International school (₹30L–60L total)
                          </span>
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Section 4: Outstanding Loans */}
            <div>
              <h3 className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                Outstanding Loans/Obligations
              </h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Home Loan Remaining
                  </Label>
                  <Input
                    type="number"
                    value={formData.homeLoan || ""}
                    onChange={(e) => updateFormData("homeLoan", parseInt(e.target.value) || 0)}
                    className="h-10 mt-1"
                    placeholder="₹50,00,000"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Car/Vehicle Loan
                  </Label>
                  <Input
                    type="number"
                    value={formData.carLoan || ""}
                    onChange={(e) => updateFormData("carLoan", parseInt(e.target.value) || 0)}
                    className="h-10 mt-1"
                    placeholder="₹10,00,000"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Other Loans (Personal, Medical, etc)
                  </Label>
                  <Input
                    type="number"
                    value={formData.otherLoans || ""}
                    onChange={(e) => updateFormData("otherLoans", parseInt(e.target.value) || 0)}
                    className="h-10 mt-1"
                    placeholder="₹0"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Any Existing Life Insurance?
                  </Label>
                  <div className="flex gap-4 mt-2 mb-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="hasExistingInsurance"
                        checked={!formData.hasExistingInsurance}
                        onChange={() => updateFormData("hasExistingInsurance", false)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">No</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="hasExistingInsurance"
                        checked={formData.hasExistingInsurance}
                        onChange={() => updateFormData("hasExistingInsurance", true)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Yes</span>
                    </label>
                  </div>
                  {formData.hasExistingInsurance && (
                    <Input
                      type="number"
                      value={formData.existingInsuranceAmount || ""}
                      onChange={(e) => updateFormData("existingInsuranceAmount", parseInt(e.target.value) || 0)}
                      className="h-10 mt-2"
                      placeholder="₹1,00,00,000"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Section 5: Future Goals / Dependents */}
            {formData.maritalStatus === "Married" && (
              <div>
                <h3 className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                  Future Goals / Dependents
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                      Spouse's Age
                    </Label>
                    <Input
                      type="number"
                      value={formData.spouseAge || ""}
                      onChange={(e) => updateFormData("spouseAge", parseInt(e.target.value) || 0)}
                      className="h-10 mt-1"
                      min={20}
                      max={80}
                    />
                    {errors.spouseAge && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.spouseAge}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                      Spouse's Income (if any)
                    </Label>
                    <Input
                      type="number"
                      value={formData.spouseIncome || ""}
                      onChange={(e) => updateFormData("spouseIncome", parseInt(e.target.value) || 0)}
                      className="h-10 mt-1"
                      placeholder="₹0"
                    />
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                      Reduces needs (spouse can earn post-your-death)
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                      Desired Retirement Age for Spouse
                    </Label>
                    <Select
                      value={formData.desiredRetirementAge?.toString() || "60"}
                      onValueChange={(value) => updateFormData("desiredRetirementAge", parseInt(value))}
                    >
                      <SelectTrigger className="h-10 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[50, 55, 60, 65, 70].map((age) => (
                          <SelectItem key={age} value={age.toString()}>
                            {age === 70 ? "70+" : age.toString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                      After you die, when should spouse stop working?
                    </p>
                    {errors.desiredRetirementAge && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.desiredRetirementAge}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                Your Desired Legacy/Gifts
              </Label>
              <Input
                type="number"
                value={formData.legacyGoals || ""}
                onChange={(e) => updateFormData("legacyGoals", parseInt(e.target.value) || 0)}
                className="h-10 mt-1"
                placeholder="₹0"
              />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                Example: "₹10L for niece's wedding"
              </p>
            </div>

            {/* Form Buttons */}
            <div className="flex gap-4 pt-4">
              <Button
                onClick={handleCalculate}
                className="flex-1 bg-[#00B4D8] hover:bg-[#0099B4] text-white h-11"
              >
                Calculate Now
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFormData({
                    age: 35,
                    gender: undefined,
                    city: "",
                    state: "",
                    annualIncome: 1200000,
                    savings: 300000,
                    maritalStatus: "Married",
                    childrenCount: 2,
                    youngestChildAge: 5,
                    educationType: "Private",
                    homeLoan: 5000000,
                    carLoan: 1000000,
                    otherLoans: 0,
                    hasExistingInsurance: false,
                    existingInsuranceAmount: 0,
                    spouseAge: 32,
                    spouseIncome: 0,
                    desiredRetirementAge: 60,
                    legacyGoals: 0,
                  });
                  setSelectedState("");
                  setResult(null);
                }}
                className="h-11"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Results Display Section */}
      {result && (
        <section id={isTerm ? "term-calculator-results" : "life-calculator-results"} className="bg-white dark:bg-[#0F1419] py-12 px-6 md:px-14">
          <div className="max-w-[900px] mx-auto">
            {/* Result Header */}
            <div className="text-center mb-12">
              <div className="text-7xl font-bold text-[#00B4D8] mb-4">
                {formatCurrency(result.recommendedSumAssured)}
              </div>
              <div className="text-2xl font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
                Recommended {isTerm ? "Term Life" : ""} Sum Assured
              </div>
              <p className="text-base text-[#6B7280] dark:text-[#9CA3AF]">
                Based on your income, dependents, loans, and goals.
                {isTerm ? " Pure protection for 20–30 years. Maximum coverage per rupee." : " Covers everything your family needs for 25–30 years."}
              </p>
            </div>

            {/* Breakdown Cards */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <Card className="border-l-4 border-[#EF4444]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-8 h-8 text-[#EF4444]" />
                    <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                      💰 Immediate Debt Repayment
                    </h4>
                  </div>
                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF]">Home loan:</span>
                      <span className="font-semibold">{formatCurrencyFull(result.breakdown.immediateDebt)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    If you die today, this money immediately clears your family's debts. No home foreclosure.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-[#10B981]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <GraduationCap className="w-8 h-8 text-[#10B981]" />
                    <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                      🎓 Children's Education
                    </h4>
                  </div>
                  <div className="space-y-1 text-sm mb-3">
                    <div className="text-[#6B7280] dark:text-[#9CA3AF]">
                      {formData.childrenCount} children × {formData.educationType} school
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>TOTAL:</span>
                      <span>{formatCurrencyFull(result.breakdown.educationCost)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    Your kids go to {formData.educationType?.toLowerCase() || 'private'} school?
                    {formatCurrency(result.breakdown.educationCost)} covers both through degree.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-[#00B4D8]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Home className="w-8 h-8 text-[#00B4D8]" />
                    <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                      🏠 Spouse's Living Expenses
                    </h4>
                  </div>
                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex justify-between font-semibold">
                      <span>TOTAL (with inflation):</span>
                      <span>{formatCurrencyFull(result.breakdown.livingExpenses)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    Your spouse gets monthly expenses for 25 years. Covers rent, food, medical, basics.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-[#F59E0B]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-8 h-8 text-[#F59E0B]" />
                    <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                      🚨 Emergency/Funeral Buffer
                    </h4>
                  </div>
                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex justify-between font-semibold">
                      <span>TOTAL:</span>
                      <span>{formatCurrencyFull(result.breakdown.emergencyBuffer)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    Covers funeral, final medical, legal documentation, transition.
                  </p>
                </CardContent>
              </Card>

              {result.breakdown.legacyGoals > 0 && (
                <Card className="border-l-4 border-[#A78BFA]">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-8 h-8 text-[#A78BFA]" />
                      <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                        🎁 Your Legacy / Goals
                      </h4>
                    </div>
                    <div className="space-y-1 text-sm mb-3">
                      <div className="flex justify-between font-semibold">
                        <span>TOTAL:</span>
                        <span>{formatCurrencyFull(result.breakdown.legacyGoals)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                      Optional: Left-over money for gifts, wedding sponsorships.
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card className="border-l-4 border-[#10B981]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
                    <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                      ✅ What You Already Have
                    </h4>
                  </div>
                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex justify-between font-semibold">
                      <span>TOTAL AVAILABLE:</span>
                      <span>{formatCurrencyFull(result.breakdown.existingResources)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    This reduces your need. You get credit for existing resources.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Calculation Summary */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                  Calculation Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">Debt</span>
                    <span className="font-semibold">{formatCurrencyFull(result.breakdown.immediateDebt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">Education</span>
                    <span className="font-semibold">{formatCurrencyFull(result.breakdown.educationCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">Living</span>
                    <span className="font-semibold">{formatCurrencyFull(result.breakdown.livingExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">Emergency</span>
                    <span className="font-semibold">{formatCurrencyFull(result.breakdown.emergencyBuffer)}</span>
                  </div>
                  {result.breakdown.legacyGoals > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF]">Legacy</span>
                      <span className="font-semibold">{formatCurrencyFull(result.breakdown.legacyGoals)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Subtotal</span>
                      <span>{formatCurrencyFull(result.breakdown.totalNeed)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[#6B7280] dark:text-[#9CA3AF]">
                    <span>Minus: Existing Resources</span>
                    <span>-{formatCurrencyFull(result.breakdown.existingResources)}</span>
                  </div>
                  <div className="border-t-2 border-[#00B4D8] pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-xl font-bold text-[#00B4D8]">RECOMMENDATION</span>
                      <span className="text-xl font-bold text-[#00B4D8]">
                        {formatCurrency(result.recommendedSumAssured)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Premium Estimates - Scenarios */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {/* Conservative */}
              <Card className={result.scenarios.recommended.sumAssured === result.scenarios.conservative.sumAssured ? "" : "border border-[#E5E7EB]"}>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">
                    🔵 CONSERVATIVE APPROACH
                  </h4>
                  <div className="space-y-2 mb-4">
                    <div>
                      <div className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Sum Assured</div>
                      <div className="text-xl font-bold">{formatCurrency(result.scenarios.conservative.sumAssured)}</div>
                      <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">(80% of recommendation)</div>
                    </div>
                    <div>
                      <div className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Monthly Premium</div>
                      <div className="text-lg font-semibold">{formatCurrencyFull(result.scenarios.conservative.monthlyPremium)}</div>
                      <div className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Annual: {formatCurrencyFull(result.scenarios.conservative.annualPremium)}</div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">
                    <div>✅ Lower cost (affordable)</div>
                    <div>❌ Higher family burden</div>
                    <div>❌ Gap in education funding</div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setLocation(`/compare?type=${isTerm ? "term" : "life"}&scenario=conservative`)}
                    className="w-full"
                  >
                    Choose This
                  </Button>
                </CardContent>
              </Card>

              {/* Recommended */}
              <Card className="border-3 border-[#00B4D8] shadow-lg">
                <CardContent className="p-6">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">
                    🟢 RECOMMENDED (BALANCED)
                  </h4>
                  <div className="space-y-2 mb-4">
                    <div>
                      <div className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Sum Assured</div>
                      <div className="text-xl font-bold">{formatCurrency(result.scenarios.recommended.sumAssured)}</div>
                      <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">(Your calculated need)</div>
                    </div>
                    <div>
                      <div className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Monthly Premium</div>
                      <div className="text-lg font-semibold">{formatCurrencyFull(result.scenarios.recommended.monthlyPremium)}</div>
                      <div className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                        Annual: {formatCurrencyFull(result.scenarios.recommended.annualPremium)}
                      </div>
                      <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                        ({((result.scenarios.recommended.annualPremium / (formData.annualIncome || 1)) * 100).toFixed(1)}% of your annual income)
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">
                    <div>✅ Full education funding</div>
                    <div>✅ All living expenses</div>
                    <div>✅ Debt repayment</div>
                    <div>✅ Emergency buffer</div>
                  </div>
                  <Button
                    onClick={() => setLocation(`/compare?type=${isTerm ? "term" : "life"}&scenario=recommended`)}
                    className="w-full bg-[#00B4D8] hover:bg-[#0099B4] text-white"
                  >
                    Choose This
                  </Button>
                </CardContent>
              </Card>

              {/* Comprehensive */}
              <Card className={result.scenarios.recommended.sumAssured === result.scenarios.comprehensive.sumAssured ? "" : "border border-[#E5E7EB]"}>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">
                    🟡 COMPREHENSIVE (MAXIMUM)
                  </h4>
                  <div className="space-y-2 mb-4">
                    <div>
                      <div className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Sum Assured</div>
                      <div className="text-xl font-bold">{formatCurrency(result.scenarios.comprehensive.sumAssured)}</div>
                      <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">(130% of recommendation)</div>
                    </div>
                    <div>
                      <div className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Monthly Premium</div>
                      <div className="text-lg font-semibold">{formatCurrencyFull(result.scenarios.comprehensive.monthlyPremium)}</div>
                      <div className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Annual: {formatCurrencyFull(result.scenarios.comprehensive.annualPremium)}</div>
                      <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                        ({((result.scenarios.comprehensive.annualPremium / (formData.annualIncome || 1)) * 100).toFixed(1)}% of your annual income)
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">
                    <div>✅ All above + buffer</div>
                    <div>✅ Higher legacy fund</div>
                    <div>✅ Inflation cushion</div>
                    <div>✅ Peace of mind</div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setLocation(`/compare?type=${isTerm ? "term" : "life"}&scenario=comprehensive`)}
                    className="w-full"
                  >
                    Choose This
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Advanced Assumptions Section */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <details className="group">
                  <summary className="cursor-pointer list-none flex items-center justify-between">
                    <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                      ADVANCED ASSUMPTIONS (EDITABLE)
                    </h4>
                    <ChevronDown className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF] group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="mt-4 space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                        Spouse income grows with inflation
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                        Claim corpus invested post-claim (real return %)
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                        Parents financially dependent (₹/month)
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                        Spouse dependency reduces after X years
                      </span>
                    </label>
                  </div>
                </details>
              </CardContent>
            </Card>

            {/* Next Steps */}
            <section className="bg-[#FAFBFC] dark:bg-[#111827] py-12 px-6 rounded-xl border-t border-[#E5E7EB] dark:border-gray-700">
              <h3 className="text-2xl font-semibold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-8">
                What's next?
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => setLocation(`/compare?type=${isTerm ? "term" : "life"}&scenario=recommended`)}
                  className="bg-[#00B4D8] hover:bg-[#0099B4] text-white h-11"
                >
                  Compare Plans
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/blog/what-is-term-life-insurance")}
                  className="h-11"
                >
                  Learn More About Term Life
                </Button>
                <Button
                  variant="link"
                  onClick={() => setLocation(isTerm ? "/term" : "/life")}
                  className="h-11"
                >
                  Back to Analyzer
                </Button>
              </div>
            </section>
          </div>
        </section>
      )}
    </div>
  );
}
