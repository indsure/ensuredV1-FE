import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Heart,
  Users,
  Car,
  ArrowRight,
  FileText,
  Calculator,
  Scale,
  FileSearch,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { loadSampleReport, mockReport, mockReportLife, mockReportVehicle } from "@/lib/mock-data";

export default function AnalyzePage() {
  const [, setLocation] = useLocation();

  useSEO({
    title: "Analyze Your Insurance Policy | Health, Life, Vehicle Insurance Analyzer | Ensured",
    description: "Choose your insurance type: Health, Life, or Vehicle. Upload your policy PDF and get instant analysis of your coverage, gaps, and recommendations.",
    keywords: "insurance analyzer, health insurance analyzer, life insurance analyzer, vehicle insurance analyzer, policy analyzer",
    canonical: "/analyze",
  });

  const insuranceTypes = [
    {
      id: "health",
      title: "Health Insurance",
      description: "Upload your health insurance policy. Understand your room limits, co-pays, deductibles, coverage areas, and exclusions. See what a ₹5L or ₹20L hospitalization will really cost you.",
      icon: Heart,
      iconColor: "text-[#EF4444]",
      gradientFrom: "from-[#EF4444]/20",
      gradientTo: "to-[#FCA5A5]/20",
      darkGradientFrom: "dark:from-[#EF4444]/10",
      darkGradientTo: "dark:to-[#FCA5A5]/10",
      href: "/policychecker",
      badge: "Most Popular",
      sampleReport: mockReport,
    },
    {
      id: "life",
      title: "Life Insurance",
      description: "Upload your life insurance PDF. Instantly see if your sum assured is enough for your family's future, understand claim conditions, exclusions, and how your riders actually protect you.",
      icon: Users,
      iconColor: "text-[#00B4D8]",
      gradientFrom: "from-[#00B4D8]/20",
      gradientTo: "to-[#1A3A52]/20",
      darkGradientFrom: "dark:from-[#00B4D8]/10",
      darkGradientTo: "dark:to-[#1A3A52]/10",
      href: "/life",
      badge: null,
      sampleReport: mockReportLife,
    },
    {
      id: "vehicle",
      title: "Vehicle Insurance",
      description: "Upload your car or bike policy. Instantly see if you're third-party or comprehensive, your actual deductibles, IDV, no-claim bonus impact, and what a ₹50k or ₹2L accident will really cost you.",
      icon: Car,
      iconColor: "text-[#10B981]",
      gradientFrom: "from-[#10B981]/20",
      gradientTo: "to-[#059669]/20",
      darkGradientFrom: "dark:from-[#10B981]/10",
      darkGradientTo: "dark:to-[#059669]/10",
      href: "/vehicle",
      badge: null,
      sampleReport: mockReportVehicle,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F0FFFE] dark:bg-[#0F1419] flex flex-col">
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#0F1419] to-[#00B4D8] py-20 md:py-24 px-6 md:px-14 text-center text-white">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00B4D8]/20 rounded-full text-xs font-medium text-white/90 mb-4">
            <FileText className="w-3 h-3" />
            Choose your insurance type
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold leading-[1.1] mb-6 tracking-[-0.02em]">
            Analyze Your Insurance Policy
          </h1>
          <p className="text-base md:text-lg text-white/90 leading-relaxed mb-8 max-w-2xl mx-auto">
            Upload your policy PDF and get instant analysis. Understand your coverage, 
            identify gaps, and get actionable recommendations—all in seconds.
          </p>
        </div>
      </section>

      {/* Insurance Type Selector */}
      <section className="py-16 md:py-20 px-6 md:px-14">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {insuranceTypes.map((type) => {
              const Icon = type.icon;
              return (
                <Card
                  key={type.id}
                  className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-[#00B4D8] dark:hover:border-[#00B4D8]"
                  onClick={() => setLocation(type.href)}
                >
                  <CardContent className="p-6">
                    {/* Badge */}
                    {type.badge && (
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-[#EF4444]/10 text-[#EF4444] text-xs font-semibold rounded-full mb-4">
                        {type.badge}
                      </div>
                    )}
                    
                    {/* Icon */}
                    <div className={`aspect-[4/3] rounded-xl mb-6 flex-shrink-0 overflow-hidden bg-gradient-to-br ${type.gradientFrom} ${type.gradientTo} ${type.darkGradientFrom} ${type.darkGradientTo} flex items-center justify-center relative`}>
                      <div className="absolute top-4 right-4 w-20 h-20 bg-white/10 dark:bg-white/5 rounded-full blur-xl"></div>
                      <div className="absolute bottom-4 left-4 w-16 h-16 bg-white/10 dark:bg-white/5 rounded-full blur-xl"></div>
                      <div className="relative z-10">
                        <Icon className={`w-24 h-24 ${type.iconColor} opacity-90`} strokeWidth={1.5} />
                      </div>
                    </div>

                    {/* Content */}
                    <h3 className="text-[28px] font-semibold text-black dark:text-[#FAFBFC] mb-3 leading-[1.3]">
                      {type.title}
                    </h3>
                    <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed mb-6">
                      {type.description}
                    </p>

                    {/* CTA */}
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(type.href);
                      }}
                      className="w-full bg-[#00B4D8] hover:bg-[#0099B4] text-white group-hover:bg-[#0099B4]"
                    >
                      Analyze {type.title}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadSampleReport(type.sampleReport);
                        setLocation("/report?sample=" + type.id);
                      }}
                      className="mt-3 w-full text-center text-sm text-[#00B4D8] hover:text-[#0099B4] dark:text-cyan-400 dark:hover:text-cyan-300 flex items-center justify-center gap-2"
                    >
                      <FileSearch className="w-4 h-4" />
                      View sample report
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Related Tools */}
      <section className="bg-[#E0F7FA] dark:bg-[#1F2937] py-12 px-6 md:px-14 border-t border-[#E5E7EB] dark:border-gray-700">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-[28px] font-semibold text-center text-black dark:text-[#FAFBFC] mb-8 leading-[1.3]">
            Need more help? Use our tools:
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#00B4D8]/10 flex items-center justify-center">
                    <Calculator className="w-6 h-6 text-[#00B4D8]" />
                  </div>
                  <h4 className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Coverage Calculator
                  </h4>
                </div>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">
                  Calculate how much coverage you actually need based on your income, 
                  dependents, and financial goals.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/calculator")}
                  className="w-full"
                >
                  Go to Calculator
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#00B4D8]/10 flex items-center justify-center">
                    <Scale className="w-6 h-6 text-[#00B4D8]" />
                  </div>
                  <h4 className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
                    Policy Comparer
                  </h4>
                </div>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">
                  Compare multiple insurance policies side-by-side. Find the best 
                  coverage and rates for your needs.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/compare")}
                  className="w-full"
                >
                  Compare Policies
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
