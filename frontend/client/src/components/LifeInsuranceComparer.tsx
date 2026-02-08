import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  Star,
} from "lucide-react";
import { LIFE_INSURANCE_PLANS, getRecommendedPlan, type LifeInsurancePlan } from "@/lib/lifeInsurancePlans";
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
    // For time ranges, parse and compare
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

export function LifeInsuranceComparer() {
  const [, setLocation] = useLocation();
  
  // Get query parameters
  const searchParams = new URLSearchParams(window.location.search);
  const scenario = searchParams.get("scenario") || "recommended";
  const compareType = searchParams.get("type") || "life"; // "life" or "term"
  
  // Default values based on scenario
  const getSumAssured = () => {
    switch (scenario) {
      case "conservative":
        return 15000000; // ₹1.5cr
      case "comprehensive":
        return 25000000; // ₹2.5cr
      default:
        return 19000000; // ₹1.9cr (recommended)
    }
  };

  const sumAssured = getSumAssured();
  const age = 35; // Default age, could be made configurable
  const annualIncome = 1200000; // Default ₹12L, could be from calculator

  const recommended = getRecommendedPlan(sumAssured, age);

  // SEO
  useSEO({
    title: compareType === "term" 
      ? "Compare Term Life Insurance Plans | Pure Protection Comparison | Ensured"
      : "Compare Term Life Insurance Plans | Best Life Insurance Comparison | Ensured",
    description: compareType === "term"
      ? `Compare top term life insurance plans: HDFC, ICICI, Religare, LIC, Canara HSBC. Pure protection, maximum coverage per rupee. See premiums, claim settlement ratios, riders for ₹${(sumAssured / 10000000).toFixed(1)}cr coverage.`
      : `Compare top term life insurance plans: HDFC, ICICI, Religare, LIC, Canara HSBC. See premiums, claim settlement ratios, riders, and get unbiased recommendations for ₹${(sumAssured / 10000000).toFixed(1)}cr coverage.`,
    keywords: compareType === "term"
      ? "compare term life insurance, term insurance comparison, pure protection comparison, maximum coverage per rupee, affordable term life comparison"
      : "compare life insurance, term life insurance comparison, best term life insurance India, HDFC life vs ICICI life, life insurance premium comparison",
    canonical: `/compare?type=${compareType}&scenario=${scenario}`,
  });

  const formatCurrency = (amount: number): string => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const formatCurrencyFull = (amount: number): string => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const formatRange = (min: number, max: number): string => {
    return `${formatCurrency(min)} to ${formatCurrency(max)}`;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F1419] flex flex-col">
      <Header />

      <div className="flex-1 py-12 px-6 md:px-14">
        <div className="max-w-[1200px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
              Compare Term Life Plans
            </h1>
            <p className="text-base text-[#6B7280] dark:text-[#9CA3AF]">
              We've analyzed 20+ insurers. Here are the top term life plans for your needs 
              ({formatCurrency(sumAssured)} sum assured, age {age}, non-smoker). 
              {compareType === "term" && " Pure protection, maximum coverage per rupee, 20–30 year terms."}
            </p>
            {compareType === "term" && (
              <div className="mt-4 p-4 bg-[#EFF6FF] dark:bg-[#1E3A5F]/30 rounded-lg border-l-4 border-[#00B4D8]">
                <p className="text-sm text-[#0F1419] dark:text-[#FAFBFC]">
                  <strong>Term Life Insurance:</strong> Pure protection for 20–30 years. Maximum coverage per rupee. 
                  No investment component. If you die during term, family gets sum assured. If you survive, policy expires. 
                  Most affordable option for maximum protection.
                </p>
              </div>
            )}
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
                    {LIFE_INSURANCE_PLANS.map((plan) => (
                      <th key={plan.id} className="p-4 text-center text-sm font-semibold min-w-[180px]">
                        <div className="font-bold mb-1">{plan.name}</div>
                        <div className="text-xs font-normal opacity-90">{plan.insurer}</div>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${
                                i < Math.floor(plan.rating)
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-400"
                              }`}
                            />
                          ))}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Sum Assured Available */}
                  <tr className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-4 font-semibold text-sm border-r border-gray-200 dark:border-gray-700">
                      Sum Assured Available
                    </td>
                    {LIFE_INSURANCE_PLANS.map((plan) => {
                      const inRange =
                        sumAssured >= plan.sumAssuredRange.min &&
                        sumAssured <= plan.sumAssuredRange.max;
                      return (
                        <td key={plan.id} className="p-4 text-center text-sm">
                          <div className="flex items-center justify-center gap-2">
                            <Indicator level={inRange ? 5 : 1} />
                            <span>{formatRange(plan.sumAssuredRange.min, plan.sumAssuredRange.max)}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 2: Term Lengths */}
                  <tr className="bg-[#F9F9F9] dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-[#F9F9F9] dark:bg-gray-900 p-4 font-semibold text-sm border-r border-gray-200 dark:border-gray-700">
                      Term Lengths
                    </td>
                    {LIFE_INSURANCE_PLANS.map((plan) => {
                      const maxTerm = Math.max(...plan.termLengths);
                      const level = maxTerm >= 40 ? 5 : maxTerm >= 30 ? 4 : maxTerm >= 20 ? 3 : 2;
                      return (
                        <td key={plan.id} className="p-4 text-center text-sm">
                          <div className="flex items-center justify-center gap-2">
                            <Indicator level={level} />
                            <span>{plan.termLengths.join(", ")} years</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 3: Monthly Premium */}
                  <tr className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-4 font-semibold text-sm border-r border-gray-200 dark:border-gray-700">
                      Monthly Premium
                    </td>
                    {LIFE_INSURANCE_PLANS.map((plan) => {
                      const premium = plan.getMonthlyPremium(sumAssured, age);
                      const premiums = LIFE_INSURANCE_PLANS.map((p) => p.getMonthlyPremium(sumAssured, age));
                      const minPremium = Math.min(...premiums);
                      const maxPremium = Math.max(...premiums);
                      let level: 1 | 2 | 3 | 4 | 5;
                      if (premium === minPremium) level = 5;
                      else if (premium <= minPremium * 1.05) level = 4;
                      else if (premium <= minPremium * 1.1) level = 3;
                      else if (premium <= minPremium * 1.2) level = 2;
                      else level = 1;
                      return (
                        <td key={plan.id} className="p-4 text-center text-sm">
                          <div className="flex items-center justify-center gap-2">
                            <Indicator level={level} />
                            <div>
                              <div className="font-semibold">{formatCurrencyFull(premium)}</div>
                              <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                                Annual: {formatCurrencyFull(plan.getAnnualPremium(sumAssured, age))}
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 4: Claim Settlement Ratio */}
                  <tr className="bg-[#F9F9F9] dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-[#F9F9F9] dark:bg-gray-900 p-4 font-semibold text-sm border-r border-gray-200 dark:border-gray-700">
                      Claim Settlement Ratio
                    </td>
                    {LIFE_INSURANCE_PLANS.map((plan) => (
                      <td key={plan.id} className="p-4 text-center text-sm">
                        <div className="flex items-center justify-center gap-2">
                          <Indicator level={getIndicatorLevel(plan.claimSettlementRatio, "higher")} />
                          <span className="font-semibold">{plan.claimSettlementRatio}%</span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Row 5: Average Claim Settlement Time */}
                  <tr className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-4 font-semibold text-sm border-r border-gray-200 dark:border-gray-700">
                      Average Claim Settlement Time
                    </td>
                    {LIFE_INSURANCE_PLANS.map((plan) => (
                      <td key={plan.id} className="p-4 text-center text-sm">
                        <div className="flex items-center justify-center gap-2">
                          <Indicator level={getIndicatorLevel(plan.averageClaimSettlementTime, "range")} />
                          <span>{plan.averageClaimSettlementTime}</span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Row 6: Riders Included */}
                  <tr className="bg-[#F9F9F9] dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-[#F9F9F9] dark:bg-gray-900 p-4 font-semibold text-sm border-r border-gray-200 dark:border-gray-700">
                      Riders Included (Base plan)
                    </td>
                    {LIFE_INSURANCE_PLANS.map((plan) => {
                      const hasRiders = plan.riders.adb.included || plan.riders.ci.included;
                      return (
                        <td key={plan.id} className="p-4 text-center text-sm">
                          <div className="flex items-center justify-center gap-2">
                            <Indicator level={hasRiders ? 4 : 3} />
                            <div className="text-xs">
                              {plan.riders.adb.included && "ADB "}
                              {plan.riders.ci.included && "CI "}
                              {!hasRiders && "Optional"}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 7: Accidental Death Rider Cost */}
                  <tr className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-4 font-semibold text-sm border-r border-gray-200 dark:border-gray-700">
                      Accidental Death Rider Cost
                    </td>
                    {LIFE_INSURANCE_PLANS.map((plan) => {
                      const cost = plan.riders.adb.costRange;
                      const avgCost = parseInt(cost.split("-")[0].replace("₹", "").replace("/month", ""));
                      let level: 1 | 2 | 3 | 4 | 5;
                      if (avgCost <= 150) level = 5;
                      else if (avgCost <= 200) level = 4;
                      else if (avgCost <= 250) level = 3;
                      else if (avgCost <= 300) level = 2;
                      else level = 1;
                      return (
                        <td key={plan.id} className="p-4 text-center text-sm">
                          <div className="flex items-center justify-center gap-2">
                            <Indicator level={level} />
                            <span>{cost}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 8: Critical Illness Rider Cost */}
                  <tr className="bg-[#F9F9F9] dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-[#F9F9F9] dark:bg-gray-900 p-4 font-semibold text-sm border-r border-gray-200 dark:border-gray-700">
                      Critical Illness Rider Cost
                    </td>
                    {LIFE_INSURANCE_PLANS.map((plan) => {
                      const cost = plan.riders.ci.costRange;
                      const avgCost = parseInt(cost.split("-")[0].replace("₹", "").replace("/month", ""));
                      let level: 1 | 2 | 3 | 4 | 5;
                      if (avgCost <= 500) level = 5;
                      else if (avgCost <= 600) level = 4;
                      else if (avgCost <= 800) level = 3;
                      else if (avgCost <= 1000) level = 2;
                      else level = 1;
                      return (
                        <td key={plan.id} className="p-4 text-center text-sm">
                          <div className="flex items-center justify-center gap-2">
                            <Indicator level={level} />
                            <span>{cost}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 9: Underwriting Process */}
                  <tr className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-4 font-semibold text-sm border-r border-gray-200 dark:border-gray-700">
                      Underwriting Process
                    </td>
                    {LIFE_INSURANCE_PLANS.map((plan) => {
                      const limit = plan.nonMedicalLimit;
                      let level: 1 | 2 | 3 | 4 | 5;
                      if (limit >= 7500000) level = 5;
                      else if (limit >= 5000000) level = 4;
                      else if (limit >= 3000000) level = 3;
                      else if (limit > 0) level = 2;
                      else level = 1;
                      return (
                        <td key={plan.id} className="p-4 text-center text-sm">
                          <div className="flex items-center justify-center gap-2">
                            <Indicator level={level} />
                            <span className="text-xs">
                              {limit > 0
                                ? `Non-medical up to ${formatCurrency(limit)}`
                                : "Medical required"}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 10: Policyholder Reviews */}
                  <tr className="bg-[#F9F9F9] dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-[#F9F9F9] dark:bg-gray-900 p-4 font-semibold text-sm border-r border-gray-200 dark:border-gray-700">
                      Policyholder Reviews
                    </td>
                    {LIFE_INSURANCE_PLANS.map((plan) => (
                      <td key={plan.id} className="p-4 text-center text-sm">
                        <div className="flex items-center justify-center gap-2">
                          <Indicator level={getIndicatorLevel(plan.policyholderReviews * 20, "higher")} />
                          <span>{plan.policyholderReviews}/5 stars</span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Row 11: Claim Denial Rate */}
                  <tr className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-4 font-semibold text-sm border-r border-gray-200 dark:border-gray-700">
                      Claim Denial Rate
                    </td>
                    {LIFE_INSURANCE_PLANS.map((plan) => (
                      <td key={plan.id} className="p-4 text-center text-sm">
                        <div className="flex items-center justify-center gap-2">
                          <Indicator level={getIndicatorLevel(plan.claimDenialRate, "lower")} />
                          <span>~{plan.claimDenialRate}%</span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Row 12: Conversion Option */}
                  <tr className="bg-[#F9F9F9] dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <td className="sticky left-0 z-10 bg-[#F9F9F9] dark:bg-gray-900 p-4 font-semibold text-sm border-r border-gray-200 dark:border-gray-700">
                      Conversion Option
                    </td>
                    {LIFE_INSURANCE_PLANS.map((plan) => (
                      <td key={plan.id} className="p-4 text-center text-sm">
                        <div className="flex items-center justify-center gap-2">
                          <Indicator level={plan.conversionOption ? 5 : 1} />
                          <span>
                            {plan.conversionOption
                              ? `Yes (before age ${plan.conversionAgeLimit || 60})`
                              : "No"}
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

            {/* Final Verdict Section */}
          <section className="mt-12">
            <h3 className="text-3xl font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
              SYSTEM PICK (NON-ADVISORY): {recommended.plan.name}
            </h3>
            <p className="text-base text-[#6B7280] dark:text-[#9CA3AF] mb-2">
              Based on reliability, features, and claims data. Not personalized underwriting approval.
            </p>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-8 italic">
              {compareType === "term" 
                ? `${recommended.reason} Pure protection, maximum coverage per rupee, affordable premiums.`
                : recommended.reason}
            </p>

            {/* 3-Column Layout */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">
                    {compareType === "term" ? "Maximum Coverage Per Rupee" : "Competitive Premium"}
                  </h4>
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    {compareType === "term" 
                      ? `Among top 3 reliable insurers, ${recommended.plan.insurer} offers maximum coverage per rupee—pure protection at ${formatCurrencyFull(recommended.plan.getMonthlyPremium(sumAssured, age))}/month with far better settlement ratio (${recommended.plan.claimSettlementRatio}%). Most affordable term life option.`
                      : `Among top 3 reliable insurers, ${recommended.plan.insurer} offers competitive premium. ${formatCurrencyFull(recommended.plan.getMonthlyPremium(sumAssured, age))}/month with far better settlement ratio (${recommended.plan.claimSettlementRatio}%).`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">
                    Highest Claim Settlement
                  </h4>
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    {recommended.plan.claimSettlementRatio}% settlement ratio (highest among all). Your family's claim will almost certainly pay.
                    Not worth saving a few hundred rupees if it means higher claim denial risk.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">
                    {compareType === "term" ? "Best Pure Protection" : "Best Overall Coverage"}
                  </h4>
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    {compareType === "term"
                      ? `Flexible 20–30 year terms (${recommended.plan.termLengths.join(", ")} years available), optional riders (ADB, CI), non-medical up to ${formatCurrency(recommended.plan.nonMedicalLimit)}. Fast settlement (${recommended.plan.averageClaimSettlementTime}). Excellent customer reviews (${recommended.plan.policyholderReviews}/5). Pure protection focus—no investment confusion.`
                      : `Flexible terms (${recommended.plan.termLengths.join(", ")} years), optional riders (ADB, CI), non-medical up to ${formatCurrency(recommended.plan.nonMedicalLimit)}. Fast settlement (${recommended.plan.averageClaimSettlementTime}). Excellent customer reviews (${recommended.plan.policyholderReviews}/5).`}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Why Not Others */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <h4 className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-4">
                  Why Not The Others?
                </h4>
                <div className="space-y-4 text-sm">
                  {LIFE_INSURANCE_PLANS.filter((p) => p.id !== recommended.plan.id).map((plan) => {
                    const premium = plan.getMonthlyPremium(sumAssured, age);
                    const winnerPremium = recommended.plan.getMonthlyPremium(sumAssured, age);
                    const diff = premium - winnerPremium;
                    return (
                      <div key={plan.id} className="border-l-4 border-gray-300 dark:border-gray-600 pl-4">
                        <div className="font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
                          {plan.name} ({diff > 0 ? `+${formatCurrencyFull(diff)}` : formatCurrencyFull(Math.abs(diff))}/month)
                        </div>
                        <div className="space-y-1 text-[#6B7280] dark:text-[#9CA3AF]">
                          {premium < winnerPremium && (
                            <div>✅ Cheaper premium</div>
                          )}
                          {plan.claimSettlementRatio < recommended.plan.claimSettlementRatio && (
                            <div>❌ Lower settlement ratio ({plan.claimSettlementRatio}%)</div>
                          )}
                          {plan.averageClaimSettlementTime.split("-")[0] > recommended.plan.averageClaimSettlementTime.split("-")[0] && (
                            <div>❌ Slower settlement ({plan.averageClaimSettlementTime})</div>
                          )}
                          {plan.policyholderReviews < recommended.plan.policyholderReviews && (
                            <div>❌ Lower customer reviews ({plan.policyholderReviews}/5)</div>
                          )}
                          <div className="mt-2 italic">
                            Verdict: {diff > 0 ? "Pay more" : "Save"} {formatCurrencyFull(Math.abs(diff))}/month, but {plan.claimSettlementRatio < recommended.plan.claimSettlementRatio ? `${recommended.plan.claimSettlementRatio - plan.claimSettlementRatio}% more risk. Not worth.` : "similar risk. Consider if budget constrained."}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recommendation Box */}
            <Card className="bg-[#00B4D8] text-white mb-8">
              <CardContent className="p-8">
                <div className="flex items-center gap-2 mb-6">
                  <CheckCircle2 className="w-6 h-6" />
                  <h4 className="text-2xl font-semibold">OUR RECOMMENDATION</h4>
                </div>
                <div className="space-y-4 mb-6">
                  <div>
                    <div className="text-sm opacity-90">Plan:</div>
                    <div className="text-xl font-bold">{recommended.plan.name}</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-90">Sum Assured:</div>
                    <div className="text-xl font-bold">{formatCurrency(sumAssured)}</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-90">Monthly Premium:</div>
                    <div className="text-xl font-bold">
                      {formatCurrencyFull(recommended.plan.getMonthlyPremium(sumAssured, age))}
                    </div>
                    <div className="text-sm opacity-90">
                      Annual: {formatCurrencyFull(recommended.plan.getAnnualPremium(sumAssured, age))} ({((recommended.plan.getAnnualPremium(sumAssured, age) / annualIncome) * 100).toFixed(1)}% of income)
                    </div>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="font-semibold mb-2">Why {recommended.plan.insurer}?</div>
                  <ul className="space-y-1 text-sm opacity-90 list-disc list-inside">
                    <li>Competitive premium (not cheapest, good value)</li>
                    <li>Highest claim settlement ({recommended.plan.claimSettlementRatio}%)</li>
                    <li>Fast claim processing ({recommended.plan.averageClaimSettlementTime})</li>
                    <li>Excellent customer service</li>
                    <li>Flexible options (term lengths, riders)</li>
                  </ul>
                </div>
                <div className="mb-6">
                  <div className="font-semibold mb-2">Add-ons we recommend:</div>
                  <div className="space-y-2 text-sm">
                    <div>✅ Accidental Death Rider (+₹200/month)</div>
                    <div className="opacity-90 ml-4">Why: You drive daily in metro</div>
                    <div>✅ Critical Illness Rider (+₹750/month)</div>
                    <div className="opacity-90 ml-4">Why: Age {age}, high earner, protect against income loss from illness</div>
                  </div>
                  <div className="mt-4 p-3 bg-white/10 rounded-lg">
                    <div className="text-sm">
                      Total monthly: {formatCurrencyFull(recommended.plan.getMonthlyPremium(sumAssured, age))} + ₹200 + ₹750 ={" "}
                      <span className="font-bold">
                        {formatCurrencyFull(recommended.plan.getMonthlyPremium(sumAssured, age) + 950)} per month
                      </span>{" "}
                      ({(((recommended.plan.getMonthlyPremium(sumAssured, age) + 950) * 12 / annualIncome) * 100).toFixed(1)}% of income)
                    </div>
                    <div className="text-xs mt-1 opacity-90">Still very affordable & comprehensive.</div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={() => window.open("https://www.hdfclife.com", "_blank")}
                    className="bg-white text-[#00B4D8] hover:bg-gray-100 h-12 text-base font-semibold flex-1"
                  >
                    Buy {recommended.plan.name}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/calculator?type=life")}
                    className="border-white text-white hover:bg-white/10 h-12 flex-1"
                  >
                    Compare Different Scenarios
                  </Button>
                  <Button
                    variant="link"
                    onClick={() => setLocation(`/blog/${recommended.plan.id.toLowerCase().replace(/\s+/g, "-")}-review`)}
                    className="text-white underline-offset-4 h-12"
                  >
                    Read Full Policy Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
