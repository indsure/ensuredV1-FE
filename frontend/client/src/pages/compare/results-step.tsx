import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Home, Sun, Moon, Scale, CheckCircle2, X, ChevronDown, ChevronUp, Building2, AlertCircle, AlertTriangle, Shield, ShieldCheck, Calculator } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useComparison } from "@/hooks/use-comparison";
import type { PolicyData } from "@/types/policy";
import { analyzeComparison } from "@/lib/comparison-analyzer";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { evaluateRiskMeter, type RiskRatingResult } from "@/lib/risk-meter-evaluator";
import { RiskMeterSkeleton } from "@/components/RiskMeterSkeleton";
import { RiskSpeedometer } from "@/components/RiskSpeedometer";

export default function ResultsStep() {
  const [, setLocation] = useLocation();
  const { policies, profile, clearAll, setPolicies } = useComparison();
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());

  // Clear on unmount (when navigating away from compare flow)
  useEffect(() => {
    return () => {
      const isStillInCompareFlow = window.location.pathname.startsWith("/compare");
      if (!isStillInCompareFlow) {
        sessionStorage.removeItem("ensured_comparison_policies");
        sessionStorage.removeItem("ensured_comparison_profile");
      }
    };
  }, []);

  const successfulPolicies = policies.filter((p) => p.status === "success" && p.policyData);

  // Early return if no policies
  if (successfulPolicies.length === 0) {
    return (
      <div className="min-h-screen bg-[#F0FFFE] dark:bg-[#0F1419] flex items-center justify-center relative">
        {/* Animated background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-20 -left-40 w-80 h-80 bg-blue-400/20 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 -right-40 w-96 h-96 bg-cyan-400/20 dark:bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-400/20 dark:bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No policies to compare</CardTitle>
            <CardDescription>Please upload policies first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/compare")}>Go to Upload</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Evaluate risk meter for each policy
  const riskRatingOrder: Record<string, number> = {
    strong: 5,
    adequate: 4,
    meaningful_risk: 3,
    high_risk: 2,
    not_suitable: 1,
  };

  // Check if we're still evaluating (some policies might be extracting)
  const isEvaluating = policies.some((p) => p.status === "extracting" || p.status === "uploading");
  
  if (isEvaluating) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFBFC] via-blue-50/30 via-cyan-50/20 to-[#F3F4F6] dark:from-[#0F1419] dark:via-blue-950/20 dark:via-cyan-950/20 dark:to-[#111827] relative">
        {/* Animated background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-20 -left-40 w-80 h-80 bg-blue-400/20 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 -right-40 w-96 h-96 bg-cyan-400/20 dark:bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-400/20 dark:bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        <Header />
        <Breadcrumbs items={[{ label: "Compare" }]} />
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <RiskMeterSkeleton />
        </main>
        <Footer />
      </div>
    );
  }

  const policiesWithRatings = successfulPolicies
    .filter((p) => p.policyData) // Additional safety check
    .map((p) => {
      if (!p.policyData) {
        throw new Error(`Policy ${p.id} has no policyData`);
      }
      const riskRating = evaluateRiskMeter(p.policyData, {
        city: profile.city || "",
        preExistingConditions: profile.preExistingConditions || [],
      });
      return {
        policy: p.policyData,
        riskRating,
        id: p.id,
      };
    })
    .sort((a, b) => riskRatingOrder[b.riskRating.rating] - riskRatingOrder[a.riskRating.rating]);

  if (policiesWithRatings.length === 0) {
    return (
      <div className="min-h-screen bg-[#F0FFFE] dark:bg-[#0F1419] flex items-center justify-center relative">
        {/* Animated background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-20 -left-40 w-80 h-80 bg-blue-400/20 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 -right-40 w-96 h-96 bg-cyan-400/20 dark:bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-400/20 dark:bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No valid policies to compare</CardTitle>
            <CardDescription>Please upload and extract policies first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/compare")}>Go to Upload</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bestMatch = policiesWithRatings[0];

  // Analyze comparison to get categories and key differences
  // Convert to format expected by analyzeComparison (with score for compatibility)
  const policiesForAnalysis = policiesWithRatings.map((p) => ({
    policy: p.policy,
    id: p.id,
    score: p.riskRating.internalScore, // Use internal score for sorting compatibility
  }));
  const comparisonAnalysis = analyzeComparison(policiesForAnalysis);

  // Helper to format premium without double ₹ symbol
  const formatPremiumDisplay = (premium: { display?: string; amount?: number } | undefined): string => {
    if (!premium) return "Not specified";
    if (premium.display) {
      // If display already has ₹, use as-is, otherwise add it
      return premium.display.startsWith('₹') ? premium.display : `₹${premium.display}`;
    }
    if (premium.amount) {
      return `₹${premium.amount.toLocaleString("en-IN")}/year`;
    }
    return "Not specified";
  };

  // Generate summary based on risk rating
  const generateSummary = () => {
    if (!bestMatch) return { line1: "", line2: "", line3: "" };

    const policy = bestMatch.policy;
    const rating = bestMatch.riskRating;

    let line1 = `${policy.basic_info?.insurer || "Unknown"} - ${policy.basic_info?.plan_name || "Unknown"} has been rated as "${rating.label}".`;
    let line2 = "";
    let line3 = "";

    // Generate context-specific summary based on rating
    if (rating.rating === "strong") {
      line2 = `This policy meets all core adequacy requirements with ${policy.coverage.base_si?.display || "N/A"} base coverage.`;
      line3 = `Key strengths include ${policy.coverage.room_rent?.unlimited ? "unlimited room rent" : `room rent of ${policy.coverage.room_rent?.display || "N/A"}`}, ${policy.coverage.copay?.exists ? `${policy.coverage.copay.percent}%` : "no"} co-pay, and ${policy.restoration?.type === "unlimited" ? "unlimited restoration" : policy.restoration?.type || "restoration benefits"}.`;
    } else if (rating.rating === "adequate") {
      line2 = `This policy provides adequate coverage with ${policy.coverage.base_si?.display || "N/A"} base SI, but has some minor gaps to watch.`;
      line3 = `The policy offers ${policy.coverage.room_rent?.unlimited ? "unlimited room rent" : `room rent of ${policy.coverage.room_rent?.display || "N/A"}`} and ${policy.coverage.copay?.exists ? `${policy.coverage.copay.percent}%` : "no"} co-pay at ${formatPremiumDisplay(policy.coverage.annual_premium)}.`;
    } else if (rating.rating === "meaningful_risk") {
      line2 = `This policy has meaningful gaps that could impact claims. Coverage includes ${policy.coverage.base_si?.display || "N/A"} base SI.`;
      line3 = `Key concerns: ${rating.reasons.slice(0, 2).join(", ")}. Review these limitations carefully before making a decision.`;
    } else if (rating.rating === "high_risk") {
      line2 = `This policy poses high risk due to significant coverage limitations.`;
      line3 = `Primary concerns: ${rating.reasons.join(", ")}. Consider alternative policies or significant upgrades.`;
    } else {
      // not_suitable
      line2 = `This policy does not meet minimum coverage requirements.`;
      line3 = `Reason: ${rating.reasons.join(", ")}. This policy is not recommended for your needs.`;
    }

    return { line1, line2, line3 };
  };

  const summary = generateSummary();

  const toggleFeature = (featureName: string) => {
    setExpandedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(featureName)) {
        next.delete(featureName);
      } else {
        next.add(featureName);
      }
      return next;
    });
  };

  const removePolicy = (policyId: string) => {
    setPolicies((prev) => prev.filter((p) => p.id !== policyId));
    if (policies.length <= 2) {
      setLocation("/compare");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFBFC] via-blue-50/30 via-cyan-50/20 to-[#F3F4F6] dark:from-[#0F1419] dark:via-blue-950/20 dark:via-cyan-950/20 dark:to-[#111827] relative flex flex-col">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 -left-40 w-80 h-80 bg-blue-400/30 dark:bg-blue-500/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -right-40 w-96 h-96 bg-cyan-400/30 dark:bg-cyan-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-400/25 dark:bg-teal-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-indigo-400/20 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>
      {/* Header */}
      <Header />
      <Breadcrumbs items={[{ label: "Compare" }]} />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-1 bg-[#E5E7EB] dark:bg-[#374151] rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#00B4D8] to-[#10B981] rounded-full transition-all duration-600 ease-out"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className="space-y-6">
          {/* Comparison Summary Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Comparison Results</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {comparisonAnalysis.keyDifferencesTotal} key differences
              </p>
            </div>
          </div>

          {/* Policy Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-live="polite" aria-label="Policy comparison results">
            {policiesWithRatings.map((p, idx) => (
              <Card
                key={p.id}
                className={`relative border-2 ${
                  idx === 0
                    ? "border-[#3CBBA0] dark:border-[#4A9B9E] bg-gradient-to-br from-green-50 to-teal-50 dark:from-gray-800 dark:to-gray-700"
                    : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                }`}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => removePolicy(p.id)}
                  aria-label={`Remove ${p.policy.basic_info?.insurer || "policy"} from comparison`}
                >
                  <X className="h-4 w-4" />
                </Button>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-8 h-8 text-[#1A3A52] dark:text-[#4A9B9E]" />
                    <div>
                      <div className="font-bold text-sm text-gray-900 dark:text-gray-100">
                        {p.policy.basic_info?.insurer || "Unknown"}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {p.policy.basic_info?.plan_name || "Unknown"}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Cover</div>
                      <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                        {p.policy.coverage?.base_si?.display || "N/A"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Premium</div>
                      <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                        {p.policy.coverage.annual_premium?.display || `₹${(p.policy.coverage.annual_premium?.amount || 0).toLocaleString("en-IN")}`}
                      </div>
                      {p.policy.coverage.annual_premium?.amount && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ₹{Math.round(p.policy.coverage.annual_premium.amount / 12).toLocaleString("en-IN")}/month
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {idx === 0 && (
                        <span className="text-xs bg-[#3CBBA0] text-white px-2 py-1 rounded flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Best Match
                        </span>
                      )}
                      <span className={`text-xs ${p.riskRating.bgColor} text-white px-2 py-1 rounded flex items-center gap-1`} aria-label={`Risk rating: ${p.riskRating.label}`}>
                        {p.riskRating.rating === "strong" && <ShieldCheck className="w-3 h-3" />}
                        {p.riskRating.rating === "adequate" && <Shield className="w-3 h-3" />}
                        {p.riskRating.rating === "meaningful_risk" && <AlertCircle className="w-3 h-3" />}
                        {p.riskRating.rating === "high_risk" && <AlertTriangle className="w-3 h-3" />}
                        {p.riskRating.rating === "not_suitable" && <X className="w-3 h-3" />}
                        {p.riskRating.label}
                      </span>
                    </div>
                    <Button
                      className="w-full mt-3 bg-orange-500 hover:bg-orange-600 text-white"
                      size="sm"
                      disabled
                      aria-label="Customize plan coming soon"
                    >
                      Customize plan &gt;
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Best Match Recommendation */}
          {bestMatch && (
            <Card className="relative group shadow-lg border-2 border-[#3CBBA0] dark:border-[#4A9B9E] bg-gradient-to-br from-green-50 via-teal-50/50 to-green-50 dark:from-gray-800 dark:via-teal-950/20 dark:to-gray-700 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              {/* Glow effect on hover */}
              <div className="absolute -inset-1 bg-gradient-to-r from-[#10B981]/30 to-[#3CBBA0]/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
              {/* Decorative elements */}
              <div className="absolute top-2 right-2 w-20 h-20 bg-green-400/10 dark:bg-green-500/5 rounded-full blur-2xl"></div>
              <div className="relative z-10">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <CheckCircle2 className="w-6 h-6 text-[#3CBBA0]" />
                      Best Match for You
                    </CardTitle>
                    <CardDescription className="text-base mt-1 text-gray-700 dark:text-gray-300">
                      Risk Assessment
                    </CardDescription>
                  </div>
                  <div aria-live="polite">
                    <RiskSpeedometer
                      value={bestMatch.riskRating.internalScore}
                      label={bestMatch.riskRating.label}
                      subtitle="Protection score"
                      labelClassName={bestMatch.riskRating.color}
                      size={140}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-base text-gray-900 dark:text-gray-100 leading-relaxed mb-2">
                    {summary.line1}
                  </p>
                  <p className="text-base text-gray-900 dark:text-gray-100 leading-relaxed mb-2">
                    {summary.line2}
                  </p>
                  <p className="text-base text-gray-900 dark:text-gray-100 leading-relaxed mb-3">
                    {summary.line3}
                  </p>
                  {bestMatch.riskRating.reasons.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Why this rating:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        {bestMatch.riskRating.reasons.map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
              </div>
            </Card>
          )}

          {/* Detailed Comparison by Categories */}
          <Card className="shadow-lg border-gray-200 dark:border-gray-600 bg-white/90 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Detailed comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                      <th className="text-left p-3 font-semibold text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800 z-10 min-w-[250px]">
                        Feature
                      </th>
                      {policiesWithRatings.map((p) => (
                        <th
                          key={p.id}
                          className="text-center p-3 font-semibold text-gray-900 dark:text-gray-100 min-w-[200px]"
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div className="text-sm font-bold">{p.policy.basic_info?.insurer || "Unknown"}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {p.policy.basic_info?.plan_name || "Unknown"}
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonAnalysis.categories.map((category) => (
                      <React.Fragment key={category.name}>
                        {/* Category Header */}
                        <tr className="bg-gray-100 dark:bg-gray-700/50">
                          <td
                            colSpan={policiesWithRatings.length + 1}
                            className="p-3 font-bold text-gray-900 dark:text-gray-100"
                          >
                            <div className="flex items-center justify-between">
                              <span>{category.name}</span>
                              {category.keyDifferencesCount > 0 && (
                                <span className="text-xs font-normal text-gray-600 dark:text-gray-400">
                                  {category.keyDifferencesCount} key difference{category.keyDifferencesCount > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Category Features */}
                        {category.features.map((feature) => {
                          const isExpanded = expandedFeatures.has(feature.name);
                          return (
                            <tr
                              key={feature.name}
                              className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                            >
                              <td className="p-3 font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800 z-10">
                                <button
                                  onClick={() => toggleFeature(feature.name)}
                                  className="flex items-center gap-2 w-full text-left hover:text-[#3CBBA0] transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                  <span>{feature.name}</span>
                                </button>
                                {isExpanded && feature.description && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-6">
                                    {feature.description}
                                  </p>
                                )}
                              </td>
                              {feature.values.map((val) => (
                                <td key={val.policyId} className="p-3 text-center text-gray-700 dark:text-gray-300">
                                  <div className="flex flex-col items-center gap-1">
                                    {val.isBest && (
                                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Best in this comparison
                                      </span>
                                    )}
                                    {val.isAvailable ? (
                                      <span>{String(val.value)}</span>
                                    ) : (
                                      <X className="w-5 h-5 text-red-500" />
                                    )}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between gap-4 pt-6">
                <Button variant="outline" onClick={() => setLocation("/compare/profile")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Clear everything synchronously
                    clearAll();
                    // Force immediate navigation - the provider's useEffect will catch the flag
                    setLocation("/compare");
                  }}
                >
                  Compare More Policies
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Next Steps Section */}
      <section className="relative z-10 bg-[#F3F4F6] dark:bg-[#111827] py-16 md:py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-12">
            After Comparing, What Next?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative group bg-gradient-to-br from-white via-blue-50/20 to-white dark:from-[#0F1419] dark:via-blue-950/10 dark:to-[#0F1419] rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              {/* Glow effect on hover */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00B4D8]/20 to-[#10B981]/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
              {/* Decorative elements */}
              <div className="absolute top-2 right-2 w-16 h-16 bg-blue-400/10 dark:bg-blue-500/5 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00B4D8]/20 to-[#10B981]/20 dark:from-[#00B4D8]/20 dark:to-[#10B981]/20 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-6 h-6 text-[#00B4D8]" />
                </div>
                <h3 className="text-xl font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-4">Understand Your Current Policy First</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] mb-6 leading-relaxed">
                  Upload your existing policy and see exactly what it covers. Then compare side-by-side with alternatives.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/policychecker")}
                  className="border-gray-300 dark:border-gray-600"
                >
                  Analyze My Current Policy
                </Button>
              </div>
            </div>

            <div className="relative group bg-gradient-to-br from-white via-cyan-50/20 to-white dark:from-[#0F1419] dark:via-cyan-950/10 dark:to-[#0F1419] rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              {/* Glow effect on hover */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#10B981]/20 to-[#00B4D8]/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
              {/* Decorative elements */}
              <div className="absolute top-2 right-2 w-16 h-16 bg-cyan-400/10 dark:bg-cyan-500/5 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#10B981]/20 to-[#00B4D8]/20 dark:from-[#10B981]/20 dark:to-[#00B4D8]/20 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Calculator className="w-6 h-6 text-[#10B981]" />
                </div>
                <h3 className="text-xl font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-4">Calculate Real Costs in Both Policies</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] mb-6 leading-relaxed">
                  See what you'd pay in different scenarios using each policy's room limits and co-pay terms.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/calculator")}
                  className="border-gray-300 dark:border-gray-600"
                >
                  Compare Costs
                </Button>
              </div>
            </div>

            <div className="relative group bg-gradient-to-br from-white via-teal-50/20 to-white dark:from-[#0F1419] dark:via-teal-950/10 dark:to-[#0F1419] rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              {/* Glow effect on hover */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#F59E0B]/20 to-[#00B4D8]/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
              {/* Decorative elements */}
              <div className="absolute top-2 right-2 w-16 h-16 bg-orange-400/10 dark:bg-orange-500/5 rounded-full blur-2xl"></div>
              <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-[#00B4D8]/10 flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-6 h-6 text-[#00B4D8]" />
              </div>
              <h3 className="text-xl font-bold text-[#0F1419] dark:text-[#FAFBFC] mb-4">Talk to an Advisor</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#D1D5DB] mb-6 leading-relaxed">
                Ready to switch? Share your comparison results with an insurance advisor or broker for expert guidance.
              </p>
              <Button
                variant="outline"
                disabled
                className="border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed"
              >
                Get Advisor Contact
              </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
