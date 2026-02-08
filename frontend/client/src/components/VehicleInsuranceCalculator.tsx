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
  Car,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  Scale,
  TrendingDown,
} from "lucide-react";
import {
  calculateVehicleInsuranceCost,
  type VehicleInsuranceInput,
  type VehicleInsuranceResult,
} from "@/lib/calculators/vehicleInsuranceCalculator";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";

const VEHICLE_MAKES = [
  "Maruti Swift",
  "Hyundai Creta",
  "Mahindra XUV700",
  "Tata Nexon",
  "Honda City",
  "Toyota Innova",
  "BMW i5",
  "Mercedes-Benz C-Class",
  "Other",
];

const NCB_LEVELS = [
  { value: 0, label: "0% (No NCB)" },
  { value: 10, label: "10% (1 year claim-free)" },
  { value: 20, label: "20% (2 years claim-free)" },
  { value: 30, label: "30% (3 years claim-free)" },
  { value: 40, label: "40% (4 years claim-free)" },
  { value: 50, label: "50% (5+ years claim-free)" },
];

export function VehicleInsuranceCalculator() {
  const [, setLocation] = useLocation();
  const [result, setResult] = useState<VehicleInsuranceResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<Partial<VehicleInsuranceInput>>({
    vehicleMake: "",
    vehicleModel: "",
    yearOfPurchase: 2020,
    currentIDV: 600000,
    deductible: 3000,
    currentNCB: 40,
    annualPremium: 10000,
    coverageType: "Comprehensive",
    accidentDamage: 50000,
    faultStatus: "Your fault (100%)",
    hasZeroDepreciation: false,
    hasEngineProtection: false,
    hasRoadsideAssistance: false,
    hasNCBProtection: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem("ensured_vehicle_calculator_form");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData((prev) => ({ ...prev, ...parsed }));
      } catch (e) {
        // Ignore
      }
    }
  }, []);

  useEffect(() => {
    if (Object.keys(formData).length > 0) {
      localStorage.setItem("ensured_vehicle_calculator_form", JSON.stringify(formData));
    }
  }, [formData]);

  const updateFormData = (field: keyof VehicleInsuranceInput, value: any) => {
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

    if (!formData.vehicleMake) {
      newErrors.vehicleMake = "Please select vehicle make";
    }
    if (!formData.yearOfPurchase || formData.yearOfPurchase < 2010 || formData.yearOfPurchase > 2025) {
      newErrors.yearOfPurchase = "Please enter a valid year";
    }
    if (!formData.currentIDV || formData.currentIDV < 100000) {
      newErrors.currentIDV = "Please enter a valid IDV (minimum ₹1L)";
    }
    if (!formData.accidentDamage || formData.accidentDamage < 1000) {
      newErrors.accidentDamage = "Please enter accident damage amount";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCalculate = () => {
    if (!validateForm()) return;

    const input: VehicleInsuranceInput = {
      vehicleMake: formData.vehicleMake!,
      vehicleModel: formData.vehicleModel || "",
      yearOfPurchase: formData.yearOfPurchase!,
      currentIDV: formData.currentIDV!,
      deductible: formData.deductible || 3000,
      currentNCB: formData.currentNCB || 0,
      annualPremium: formData.annualPremium || 10000,
      coverageType: formData.coverageType as "Third-Party" | "Comprehensive",
      accidentDamage: formData.accidentDamage!,
      faultStatus: formData.faultStatus as "Your fault (100%)" | "Shared (50%)" | "Not your fault (0%)",
      hasZeroDepreciation: formData.hasZeroDepreciation || false,
      hasEngineProtection: formData.hasEngineProtection || false,
      hasRoadsideAssistance: formData.hasRoadsideAssistance || false,
      hasNCBProtection: formData.hasNCBProtection || false,
    };

    const calculation = calculateVehicleInsuranceCost(input);
    setResult(calculation);
    
    setTimeout(() => {
      document.getElementById("vehicle-calculator-results")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const formatCurrencyFull = (amount: number): string => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  useSEO({
    title: "Vehicle Insurance Accident Cost Calculator | NCB Impact Calculator | Ensured",
    description: "Calculate your real accident costs. Enter vehicle details and damage amount. See out-of-pocket cost, NCB impact, depreciation, and whether to claim or pay yourself.",
    keywords: "vehicle insurance calculator, car insurance calculator, accident cost calculator, NCB impact calculator, vehicle insurance claim calculator",
    canonical: "/calculator?type=vehicle",
  });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Input Form Section */}
      <section className="bg-white dark:bg-[#0F1419] py-12 px-6 md:px-14">
        <div className="max-w-[600px] mx-auto">
          <h1 className="text-3xl font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
            Calculate Your Accident Cost
          </h1>
          <p className="text-base text-[#6B7280] dark:text-[#9CA3AF] mb-8">
            Enter your vehicle details and accident scenario. See your real 
            out-of-pocket cost, NCB impact, and whether you should claim or pay yourself.
          </p>

          <div className="space-y-6">
            {/* Section 1: Your Vehicle */}
            <div>
              <h3 className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                Your Vehicle
              </h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Car Make/Model
                  </Label>
                  <Select
                    value={formData.vehicleMake || ""}
                    onValueChange={(value) => updateFormData("vehicleMake", value)}
                  >
                    <SelectTrigger className="h-10 mt-1">
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_MAKES.map((make) => (
                        <SelectItem key={make} value={make}>
                          {make}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.vehicleMake && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.vehicleMake}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Year of Purchase
                  </Label>
                  <Input
                    type="number"
                    value={formData.yearOfPurchase || ""}
                    onChange={(e) => updateFormData("yearOfPurchase", parseInt(e.target.value) || 0)}
                    className="h-10 mt-1"
                    min={2010}
                    max={2025}
                  />
                  {errors.yearOfPurchase && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.yearOfPurchase}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Current Insured Value (IDV)
                  </Label>
                  <Input
                    type="number"
                    value={formData.currentIDV || ""}
                    onChange={(e) => updateFormData("currentIDV", parseInt(e.target.value) || 0)}
                    className="h-10 mt-1"
                    placeholder="₹6,00,000"
                  />
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                    Maximum amount insurer pays if car is totaled/stolen
                  </p>
                  {errors.currentIDV && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.currentIDV}</p>
                  )}
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-400">
                    <p className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-1">
                      MARKET VALUE ESTIMATION:
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      Based on depreciation table + resale benchmarks. Confidence: Medium.
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Your Deductible
                  </Label>
                  <Select
                    value={formData.deductible?.toString() || "3000"}
                    onValueChange={(value) => updateFormData("deductible", parseInt(value))}
                  >
                    <SelectTrigger className="h-10 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1000, 2000, 3000, 5000].map((amount) => (
                        <SelectItem key={amount} value={amount.toString()}>
                          {formatCurrencyFull(amount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                    Your share of each claim (compulsory + voluntary)
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Current NCB Level
                  </Label>
                  <Select
                    value={formData.currentNCB?.toString() || "0"}
                    onValueChange={(value) => updateFormData("currentNCB", parseInt(value))}
                  >
                    <SelectTrigger className="h-10 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NCB_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value.toString()}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Annual Premium
                  </Label>
                  <Input
                    type="number"
                    value={formData.annualPremium || ""}
                    onChange={(e) => updateFormData("annualPremium", parseInt(e.target.value) || 0)}
                    className="h-10 mt-1"
                    placeholder="₹10,000"
                  />
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                    Used to calculate NCB loss
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Coverage Type
                  </Label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="coverageType"
                        value="Third-Party"
                        checked={formData.coverageType === "Third-Party"}
                        onChange={(e) => updateFormData("coverageType", e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Third-Party</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="coverageType"
                        value="Comprehensive"
                        checked={formData.coverageType === "Comprehensive"}
                        onChange={(e) => updateFormData("coverageType", e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Comprehensive</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Accident Scenarios */}
            <div>
              <h3 className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                Accident Scenario
              </h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Accident Damage Amount
                  </Label>
                  <div className="flex flex-wrap gap-2 mt-2 mb-2">
                    {[25000, 50000, 100000, 200000, 500000].map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        onClick={() => updateFormData("accidentDamage", amount)}
                        className={formData.accidentDamage === amount ? "bg-[#00B4D8] text-white" : ""}
                      >
                        {formatCurrency(amount)}
                      </Button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    value={formData.accidentDamage || ""}
                    onChange={(e) => updateFormData("accidentDamage", parseInt(e.target.value) || 0)}
                    className="h-10 mt-1"
                    placeholder="₹50,000"
                  />
                  {errors.accidentDamage && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.accidentDamage}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Fault Status
                  </Label>
                  <div className="space-y-2 mt-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="faultStatus"
                        value="Your fault (100%)"
                        checked={formData.faultStatus === "Your fault (100%)"}
                        onChange={(e) => updateFormData("faultStatus", e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Your fault (100%)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="faultStatus"
                        value="Shared (50%)"
                        checked={formData.faultStatus === "Shared (50%)"}
                        onChange={(e) => updateFormData("faultStatus", e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Shared (50%)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="faultStatus"
                        value="Not your fault (0%)"
                        checked={formData.faultStatus === "Not your fault (0%)"}
                        onChange={(e) => updateFormData("faultStatus", e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Not your fault (0%)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Add-ons */}
            <div>
              <h3 className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                Add-ons
              </h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.hasZeroDepreciation || false}
                    onChange={(e) => updateFormData("hasZeroDepreciation", e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                    Zero Depreciation (no depreciation deduction)
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.hasEngineProtection || false}
                    onChange={(e) => updateFormData("hasEngineProtection", e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                    Engine Protection (flood/water damage)
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.hasRoadsideAssistance || false}
                    onChange={(e) => updateFormData("hasRoadsideAssistance", e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                    Roadside Assistance
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.hasNCBProtection || false}
                    onChange={(e) => updateFormData("hasNCBProtection", e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                    NCB Protection (one claim doesn't reset NCB)
                  </span>
                </label>
              </div>
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
                    vehicleMake: "",
                    vehicleModel: "",
                    yearOfPurchase: 2020,
                    currentIDV: 600000,
                    deductible: 3000,
                    currentNCB: 40,
                    annualPremium: 10000,
                    coverageType: "Comprehensive",
                    accidentDamage: 50000,
                    faultStatus: "Your fault (100%)",
                    hasZeroDepreciation: false,
                    hasEngineProtection: false,
                    hasRoadsideAssistance: false,
                    hasNCBProtection: false,
                  });
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
        <section id="vehicle-calculator-results" className="bg-white dark:bg-[#0F1419] py-12 px-6 md:px-14">
          <div className="max-w-[900px] mx-auto">
            {/* Result Header */}
            <div className="text-center mb-12">
              <div className={`text-4xl font-bold mb-4 ${result.shouldClaim ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                {result.shouldClaim ? "✅ CLAIM IT" : "❌ DON'T CLAIM"}
              </div>
              <p className="text-lg text-[#6B7280] dark:text-[#9CA3AF]">
                {result.claimReason}
              </p>
            </div>

            {/* Cost Breakdown */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                  Cost Breakdown
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">Accident Damage:</span>
                    <span className="font-semibold">{formatCurrencyFull(formData.accidentDamage || 0)}</span>
                  </div>
                  {result.depreciationAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF]">Depreciation:</span>
                      <span className="font-semibold text-[#F59E0B]">-{formatCurrencyFull(result.depreciationAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">Deductible:</span>
                    <span className="font-semibold text-[#F59E0B]">-{formatCurrencyFull(formData.deductible || 0)}</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Your Out-of-Pocket:</span>
                      <span className="text-[#EF4444]">{formatCurrencyFull(result.outOfPocketCost)}</span>
                    </div>
                    <div className="flex justify-between font-semibold mt-2">
                      <span>Insurer Pays:</span>
                      <span className="text-[#10B981]">{formatCurrencyFull(result.insurerPays)}</span>
                    </div>
                  </div>
                  {result.ncbLoss > 0 && (
                    <div className="mt-4 p-4 bg-[#FEF3C7] dark:bg-[#F59E0B]/10 rounded-lg border-l-4 border-[#F59E0B]">
                      <div className="text-sm font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">
                        NCB Impact (if you claim):
                      </div>
                      <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-3">
                        Your current NCB: {formData.currentNCB}% (saves ₹{(formData.annualPremium || 0) * (formData.currentNCB || 0) / 100}/year)
                      </div>
                      <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-3">
                        If you claim now, NCB resets to 0%. Over 5 years rebuilding:
                      </div>
                      <div className="space-y-1 text-xs">
                        {result.ncbYearlyBreakdown.map((year) => (
                          <div key={year.year} className="flex justify-between">
                            <span>Year {year.year}:</span>
                            <span className="font-medium">
                              {formatCurrencyFull(year.premium)} ({year.ncb}% NCB, save {formatCurrencyFull(year.savings)})
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-[#F59E0B]/20">
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total paid over 5 years:</span>
                          <span>{formatCurrencyFull(result.ncbYearlyBreakdown.reduce((sum, y) => sum + y.premium, 0))}</span>
                        </div>
                        <div className="flex justify-between text-sm text-[#10B981] mt-1">
                          <span>If hadn't claimed (keep {formData.currentNCB}%):</span>
                          <span>{formatCurrencyFull((formData.annualPremium || 0) * 5 * (1 - (formData.currentNCB || 0) / 100))}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold text-[#EF4444] mt-2 pt-2 border-t border-[#F59E0B]/20">
                          <span>NET LOSS from claim:</span>
                          <span>{formatCurrencyFull(result.ncbLoss)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Scenarios */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {Object.entries(result.scenarios).map(([key, scenario]) => (
                <Card key={key} className={scenario.shouldClaim ? "border-l-4 border-[#10B981]" : "border-l-4 border-[#EF4444]"}>
                  <CardContent className="p-5">
                    <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2 capitalize">
                      {key === "minor" && "Minor Damage (₹25k)"}
                      {key === "moderate" && "Moderate Damage (₹80k)"}
                      {key === "major" && "Major Damage (₹2L)"}
                      {key === "totaled" && "Car Totaled"}
                    </h4>
                    <div className="space-y-2 text-sm mb-3">
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] dark:text-[#9CA3AF]">Your cost:</span>
                        <span className="font-semibold">{formatCurrencyFull(scenario.outOfPocket)}</span>
                      </div>
                      <div className={`font-medium ${scenario.shouldClaim ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                        {scenario.shouldClaim ? "✅ Claim it" : "❌ Don't claim"}
                      </div>
                    </div>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                      {scenario.reason}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Decision Matrix */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                  Decision Matrix
                </h4>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className={`p-4 rounded-lg border-2 ${result.shouldClaim ? "border-[#10B981] bg-[#10B981]/5" : "border-[#EF4444] bg-[#EF4444]/5"}`}>
                    <h5 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
                      Option A: Claim the {formatCurrency(formData.accidentDamage || 0)}
                    </h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] dark:text-[#9CA3AF]">Out-of-pocket:</span>
                        <span className="font-medium">{formatCurrencyFull(result.decisionMatrix.claimOption.outOfPocket)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] dark:text-[#9CA3AF]">Insurer pays:</span>
                        <span className="font-medium text-[#10B981]">{formatCurrencyFull(result.decisionMatrix.claimOption.insurerPays)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] dark:text-[#9CA3AF]">NCB loss:</span>
                        <span className="font-medium text-[#F59E0B]">{formatCurrencyFull(result.decisionMatrix.claimOption.ncbLoss)}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between font-semibold">
                          <span>Total cost to you:</span>
                          <span>{formatCurrencyFull(result.decisionMatrix.claimOption.totalCost)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg border-2 ${!result.shouldClaim ? "border-[#10B981] bg-[#10B981]/5" : "border-gray-300 dark:border-gray-700"}`}>
                    <h5 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
                      Option B: Pay Yourself {formatCurrency(formData.accidentDamage || 0)}
                    </h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] dark:text-[#9CA3AF]">Out-of-pocket:</span>
                        <span className="font-medium">{formatCurrencyFull(result.decisionMatrix.payYourselfOption.outOfPocket)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] dark:text-[#9CA3AF]">NCB protected:</span>
                        <span className="font-medium text-[#10B981]">{formatCurrencyFull(result.decisionMatrix.payYourselfOption.ncbProtected)}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between font-semibold">
                          <span>Total cost to you:</span>
                          <span>{formatCurrencyFull(result.decisionMatrix.payYourselfOption.totalCost)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={`p-4 rounded-lg ${result.shouldClaim ? "bg-[#10B981]/10 border-l-4 border-[#10B981]" : "bg-[#EF4444]/10 border-l-4 border-[#EF4444]"}`}>
                  <div className="text-sm font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
                    VERDICT: {result.shouldClaim ? "🟢 CLAIM IT" : "❌ DON'T CLAIM"}
                  </div>
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    {result.decisionMatrix.verdict}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Total Loss & Theft Scenarios */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardContent className="p-5">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">
                    Total Loss Scenario
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF]">Accident damage:</span>
                      <span className="font-medium">{formatCurrencyFull(result.scenarios.totaled.damage)}+</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF]">Your IDV:</span>
                      <span className="font-medium">{formatCurrencyFull(result.scenarios.totaled.idv)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF]">Insurer pays:</span>
                      <span className="font-medium text-[#10B981]">{formatCurrencyFull(result.scenarios.totaled.insurerPays)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF]">Replacement cost:</span>
                      <span className="font-medium">{formatCurrencyFull(result.scenarios.totaled.replacementCost)}</span>
                    </div>
                    <div className="flex justify-between text-[#EF4444] font-semibold pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span>Your gap:</span>
                      <span>{formatCurrencyFull(result.scenarios.totaled.gap)}</span>
                    </div>
                    <div className="mt-3 p-2 bg-[#10B981]/10 rounded text-xs">
                      <strong>VERDICT:</strong> ✅ MUST CLAIM
                    </div>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2 leading-relaxed">
                      {result.scenarios.totaled.reason}
                    </p>
                    <p className="text-xs text-[#00B4D8] mt-2 font-medium">
                      Recommendation: Increase IDV to {formatCurrency(result.scenarios.totaled.replacementCost)} at renewal to avoid gap.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">
                    Theft Scenario
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF]">Car value:</span>
                      <span className="font-medium">{formatCurrencyFull(result.scenarios.theft.carValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF]">Your IDV:</span>
                      <span className="font-medium">{formatCurrencyFull(result.scenarios.theft.idv)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF]">Insurer pays:</span>
                      <span className="font-medium text-[#10B981]">{formatCurrencyFull(result.scenarios.theft.insurerPays)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF]">Replacement cost:</span>
                      <span className="font-medium">{formatCurrencyFull(result.scenarios.theft.replacementCost)}</span>
                    </div>
                    <div className="flex justify-between text-[#EF4444] font-semibold pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span>Your gap:</span>
                      <span>{formatCurrencyFull(result.scenarios.theft.gap)}</span>
                    </div>
                    <div className="mt-3 p-2 bg-[#10B981]/10 rounded text-xs">
                      <strong>VERDICT:</strong> ✅ CLAIM IT
                    </div>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2 leading-relaxed">
                      {result.scenarios.theft.reason}
                    </p>
                    <p className="text-xs text-[#00B4D8] mt-2 font-medium">
                      Recommendation: Theft frequent in your area? Add theft-specific rider or increase IDV.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <Card className="mb-8">
                <CardContent className="p-6">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                    Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-[#6B7280] dark:text-[#9CA3AF] flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#00B4D8] mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Next Steps */}
            <section className="bg-[#FAFBFC] dark:bg-[#111827] py-12 px-6 rounded-xl border-t border-[#E5E7EB] dark:border-gray-700">
              <h3 className="text-2xl font-semibold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-8">
                What's next?
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => setLocation("/compare?type=vehicle")}
                  className="bg-[#00B4D8] hover:bg-[#0099B4] text-white h-11"
                >
                  Compare Vehicle Policies
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/vehicle")}
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
