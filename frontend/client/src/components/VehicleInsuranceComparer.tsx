import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  Star,
} from "lucide-react";
import { getAllVehiclePlans, getRecommendedVehiclePlan, type VehicleInsurancePlan } from "@/lib/vehicleInsurancePlans";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";

// Indicator component
function Indicator({ level }: { level: 1 | 2 | 3 | 4 | 5 }) {
  if (level === 5) return <span className="text-green-600 dark:text-green-400">✅✅✅</span>;
  if (level === 4) return <span className="text-green-500 dark:text-green-500">✅✅</span>;
  if (level === 3) return <span className="text-[#00B4D8]">✅</span>;
  if (level === 2) return <span className="text-orange-500">⚠️</span>;
  return <span className="text-red-500">❌</span>;
}

function getIndicatorLevel(value: number | string, type: "higher" | "lower" | "range"): 1 | 2 | 3 | 4 | 5 {
  if (typeof value === "string") {
    if (type === "range") {
      const days = parseInt(value.split("-")[0]);
      if (days <= 15) return 5;
      if (days <= 20) return 4;
      if (days <= 30) return 3;
      if (days <= 40) return 2;
      return 1;
    }
    return 3;
  }

  if (type === "higher") {
    if (value >= 98) return 5;
    if (value >= 95) return 4;
    if (value >= 90) return 3;
    if (value >= 85) return 2;
    return 1;
  }

  if (type === "lower") {
    if (value <= 1) return 5;
    if (value <= 3) return 4;
    if (value <= 5) return 3;
    if (value <= 7) return 2;
    return 1;
  }

  return 3;
}

export function VehicleInsuranceComparer() {
  const [, setLocation] = useLocation();
  
  const searchParams = new URLSearchParams(window.location.search);
  const idv = parseInt(searchParams.get("idv") || "600000"); // Default ₹6L IDV
  const vehicleAge = parseInt(searchParams.get("age") || "5"); // Default 5 years old

  const plans = getAllVehiclePlans();
  const recommended = getRecommendedVehiclePlan(idv, vehicleAge, "premium");

  useSEO({
    title: "Compare Vehicle Insurance Plans | Car Insurance Comparison | Ensured",
    description: `Compare top vehicle insurance plans: HDFC Ergo, ICICI Lombard, Bajaj Allianz, New India Assurance. See premiums, add-ons, claim settlement ratios, deductibles for ₹${(idv / 100000).toFixed(1)}L IDV.`,
    keywords: "compare vehicle insurance, car insurance comparison, motor insurance comparison, vehicle insurance plans India, comprehensive vs third party, best car insurance",
    canonical: `/compare?type=vehicle&idv=${idv}&age=${vehicleAge}`,
  });

  const formatCurrency = (amount: number): string => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const formatCurrencyFull = (amount: number): string => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F1419] flex flex-col">
      <Header />

      <div className="flex-1 py-12 px-6 md:px-14">
        <div className="max-w-[1200px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
              Compare Vehicle Insurance Plans
            </h1>
            <p className="text-base text-[#6B7280] dark:text-[#9CA3AF]">
              We've analyzed top insurers. Here are the best vehicle insurance plans for your needs 
              ({formatCurrency(idv)} IDV, {vehicleAge} year old vehicle).
            </p>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto mb-12">
            <div className="inline-block min-w-full">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#0F1419] dark:bg-gray-800 text-white">
                    <th className="sticky left-0 z-10 bg-[#0F1419] dark:bg-gray-800 p-4 text-left text-sm font-semibold border-r border-gray-700">
                      Plan Features
                    </th>
                    {plans.map((plan) => (
                      <th key={plan.id} className="p-4 text-center text-sm font-semibold min-w-[180px]">
                        <div className="font-bold">{plan.insurer}</div>
                        <div className="text-xs mt-1 opacity-90">{plan.planName}</div>
                        <div className="text-xs mt-1 font-normal">
                          {formatCurrencyFull(plan.getAnnualPremium(idv, vehicleAge))}/year
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Premium */}
                  <tr className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-4 text-sm font-medium border-r border-gray-200 dark:border-gray-700">
                      Annual Premium
                    </td>
                    {plans.map((plan) => {
                      const premium = plan.getAnnualPremium(idv, vehicleAge);
                      const minPremium = Math.min(...plans.map((p) => p.getAnnualPremium(idv, vehicleAge)));
                      const level = premium <= minPremium * 1.05 ? 5 : premium <= minPremium * 1.15 ? 4 : premium <= minPremium * 1.25 ? 3 : 2;
                      return (
                        <td key={plan.id} className="p-4 text-center text-sm">
                          <div className="font-semibold">{formatCurrencyFull(premium)}</div>
                          <div className="mt-1"><Indicator level={level as 1 | 2 | 3 | 4 | 5} /></div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Claim Settlement Ratio */}
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 p-4 text-sm font-medium border-r border-gray-200 dark:border-gray-700">
                      Claim Settlement Ratio
                    </td>
                    {plans.map((plan) => (
                      <td key={plan.id} className="p-4 text-center text-sm">
                        <div className="font-semibold">{plan.claimSettlementRatio}%</div>
                        <div className="mt-1"><Indicator level={getIndicatorLevel(plan.claimSettlementRatio, "higher")} /></div>
                      </td>
                    ))}
                  </tr>

                  {/* Average Claim Settlement Time */}
                  <tr className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-4 text-sm font-medium border-r border-gray-200 dark:border-gray-700">
                      Avg Claim Settlement Time
                    </td>
                    {plans.map((plan) => (
                      <td key={plan.id} className="p-4 text-center text-sm">
                        <div className="font-semibold">{plan.averageClaimSettlementTime}</div>
                        <div className="mt-1"><Indicator level={getIndicatorLevel(plan.averageClaimSettlementTime, "range")} /></div>
                      </td>
                    ))}
                  </tr>

                  {/* Network Garages */}
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 p-4 text-sm font-medium border-r border-gray-200 dark:border-gray-700">
                      Network Garages
                    </td>
                    {plans.map((plan) => (
                      <td key={plan.id} className="p-4 text-center text-sm">
                        <div className="font-semibold">{plan.networkGarages.toLocaleString()}</div>
                        <div className="mt-1"><Indicator level={getIndicatorLevel(plan.networkGarages, "higher")} /></div>
                      </td>
                    ))}
                  </tr>

                  {/* Zero Depreciation Add-on */}
                  <tr className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-4 text-sm font-medium border-r border-gray-200 dark:border-gray-700">
                      Zero Depreciation Add-on
                    </td>
                    {plans.map((plan) => (
                      <td key={plan.id} className="p-4 text-center text-sm">
                        {plan.addOns.zeroDepreciation.available ? (
                          <>
                            <div className="font-semibold text-[#10B981]">Available</div>
                            <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                              {formatCurrencyFull(plan.addOns.zeroDepreciation.cost)}/year
                            </div>
                          </>
                        ) : (
                          <span className="text-red-500">❌</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Engine Protection */}
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 p-4 text-sm font-medium border-r border-gray-200 dark:border-gray-700">
                      Engine Protection
                    </td>
                    {plans.map((plan) => (
                      <td key={plan.id} className="p-4 text-center text-sm">
                        {plan.addOns.engineProtection.available ? (
                          <>
                            <div className="font-semibold text-[#10B981]">Available</div>
                            <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                              {formatCurrencyFull(plan.addOns.engineProtection.cost)}/year
                            </div>
                          </>
                        ) : (
                          <span className="text-red-500">❌</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* NCB Protection */}
                  <tr className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-4 text-sm font-medium border-r border-gray-200 dark:border-gray-700">
                      NCB Protection
                    </td>
                    {plans.map((plan) => (
                      <td key={plan.id} className="p-4 text-center text-sm">
                        {plan.addOns.ncbProtection.available ? (
                          <>
                            <div className="font-semibold text-[#10B981]">Available</div>
                            <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                              {formatCurrencyFull(plan.addOns.ncbProtection.cost)}/year
                            </div>
                          </>
                        ) : (
                          <span className="text-red-500">❌</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Policyholder Reviews */}
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 p-4 text-sm font-medium border-r border-gray-200 dark:border-gray-700">
                      Customer Reviews
                    </td>
                    {plans.map((plan) => (
                      <td key={plan.id} className="p-4 text-center text-sm">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold">{plan.policyholderReviews}/5</span>
                        </div>
                        <div className="mt-1"><Indicator level={getIndicatorLevel(plan.policyholderReviews * 20, "higher")} /></div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Final Verdict */}
          <div className="mb-12">
            <h3 className="text-2xl font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
              SYSTEM PICK (NON-ADVISORY): {recommended.plan.insurer} (for most users)
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-2">
              Based on reliability, features, and claims data. Not personalized underwriting approval.
            </p>
            <p className="text-base text-[#6B7280] dark:text-[#9CA3AF] mb-6 italic">
              {recommended.reason}
            </p>
            
            {/* Runner-up and Special Cases */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <Card className="border-l-4 border-[#10B981]">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
                    Runner-up: Bajaj Allianz (Cheapest Option)
                  </h4>
                  <ul className="text-sm text-[#6B7280] dark:text-[#9CA3AF] space-y-1">
                    <li>✅ ₹200–300 cheaper monthly</li>
                    <li>✅ 94% settlement ratio (acceptable)</li>
                    <li>✅ Good network</li>
                    <li>⚠️ Slightly slower (30 days)</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-[#00B4D8]">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
                    Special Case: ICICI Lombard (Best Add-ons)
                  </h4>
                  <ul className="text-sm text-[#6B7280] dark:text-[#9CA3AF] space-y-1">
                    <li>✅ Premium add-ons (NCB protection, zero deductible)</li>
                    <li>✅ Excellent customer service</li>
                    <li>⚠️ Premium cost (₹300–500 more)</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="p-5">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">
                    Competitive Premium
                  </h4>
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    {recommended.plan.insurer} offers competitive premium at {formatCurrencyFull(recommended.plan.getAnnualPremium(idv, vehicleAge))}/year 
                    with excellent settlement ratio ({recommended.plan.claimSettlementRatio}%).
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">
                    Fast Claim Settlement
                  </h4>
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    Average claim settlement time: {recommended.plan.averageClaimSettlementTime}. 
                    {recommended.plan.networkGarages.toLocaleString()} network garages ensure easy access to cashless repairs.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">
                    Best Add-ons
                  </h4>
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    All essential add-ons available: Zero Depreciation ({formatCurrencyFull(recommended.plan.addOns.zeroDepreciation.cost)}/year), 
                    Engine Protection ({formatCurrencyFull(recommended.plan.addOns.engineProtection.cost)}/year), 
                    NCB Protection ({formatCurrencyFull(recommended.plan.addOns.ncbProtection.cost)}/year).
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recommendation Box */}
            <Card className="bg-[#00B4D8] text-white border-none">
              <CardContent className="p-6">
                <h4 className="text-xl font-semibold mb-4">✅ OUR RECOMMENDATION</h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong>Plan:</strong> {recommended.plan.planName}
                  </div>
                  <div>
                    <strong>IDV:</strong> {formatCurrency(idv)}
                  </div>
                  <div>
                    <strong>Annual Premium:</strong> {formatCurrencyFull(recommended.plan.getAnnualPremium(idv, vehicleAge))}
                  </div>
                  <div className="mt-4">
                    <strong>Recommended Add-ons:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Zero Depreciation (+{formatCurrencyFull(recommended.plan.addOns.zeroDepreciation.cost)}/year)</li>
                      <li>Engine Protection (+{formatCurrencyFull(recommended.plan.addOns.engineProtection.cost)}/year)</li>
                      <li>NCB Protection (+{formatCurrencyFull(recommended.plan.addOns.ncbProtection.cost)}/year)</li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <strong>Total:</strong> {formatCurrencyFull(
                      recommended.plan.getAnnualPremium(idv, vehicleAge) +
                      recommended.plan.addOns.zeroDepreciation.cost +
                      recommended.plan.addOns.engineProtection.cost +
                      recommended.plan.addOns.ncbProtection.cost
                    )}/year
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                  <Button
                    onClick={() => window.open(`https://www.${recommended.plan.insurer.toLowerCase().replace(/\s+/g, '')}.com`, '_blank')}
                    className="bg-white text-[#00B4D8] hover:bg-gray-100"
                  >
                    Buy {recommended.plan.insurer} Policy
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/calculator?type=vehicle")}
                    className="border-white text-white hover:bg-white/10"
                  >
                    Calculate Different Scenario
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
