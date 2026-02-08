import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Calculator,
  Scale,
  ChevronDown,
  DollarSign,
  TrendingUp,
  CreditCard,
  Clock3,
  Shield,
  CheckCircle,
  AlertTriangle,
  Target,
  Zap,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useAnalysis } from "@/hooks/use-analysis";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { SchemaMarkup, createFAQSchema } from "@/components/SEO";

// TermAnalyzer Component
function TermAnalyzer({ onFileUpload }: { onFileUpload: (file: File) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;

    const file = acceptedFiles[0];
    
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'text/plain'];
    const isValidType = validTypes.includes(file.type) || 
                        file.name.toLowerCase().endsWith('.pdf') ||
                        file.name.toLowerCase().endsWith('.png') ||
                        file.name.toLowerCase().endsWith('.jpg') ||
                        file.name.toLowerCase().endsWith('.jpeg');
    
    if (!isValidType) {
      setError(`Unsupported file type. Please upload a PDF, PNG, JPG, or text file.`);
      return;
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError(`File is too large (${formatFileSize(file.size)}). Maximum size is 10 MB.`);
      return;
    }
    
    setSelectedFile(file);
    setError(null);
    setUploading(true);
    
    try {
      await onFileUpload(file);
    } catch (err: any) {
      setError(err.message || "Upload failed. Try again.");
      setUploading(false);
    }
  };

  const dropzoneOptions = {
    onDrop,
    accept: { 
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    multiple: false,
    disabled: uploading,
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions as any);

  return (
    <div className="max-w-[600px] mx-auto">
      {error && (
        <div className="mb-4 rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">Upload Failed</p>
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div
        {...getRootProps()}
        className={`relative transition-all duration-300 ${
          uploading 
            ? "cursor-wait" 
            : isDragActive 
            ? "scale-[1.01]" 
            : "hover:scale-[1.005] cursor-pointer"
        }`}
      >
        <div className={`relative bg-white dark:bg-[#1F2937] rounded-xl border-2 transition-all ${
          isDragActive 
            ? "border-[#00B4D8] dark:border-[#00B4D8] bg-[#F0FFFE] dark:bg-[#00B4D8]/10 ring-4 ring-[#00B4D8]/20" 
            : selectedFile && !uploading
            ? "border-[#10B981] dark:border-[#10B981] bg-[#F0FFFE] dark:bg-[#10B981]/10"
            : "border-[#00B4D8] dark:border-[#00B4D8] bg-[#F0FFFE] dark:bg-[#00B4D8]/5 hover:bg-[#E0F7FA] dark:hover:bg-[#00B4D8]/10"
        }`}>
          <input {...getInputProps()} />
          
          <div className="p-10 min-h-[150px] flex flex-col items-center justify-center text-center">
            {selectedFile && !uploading ? (
              <div className="flex flex-col items-center gap-4">
                <CheckCircle2 className="w-12 h-12 text-[#10B981]" />
                <div>
                  <p className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC]">File Selected</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">{selectedFile.name}</p>
                </div>
              </div>
            ) : uploading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-[#00B4D8]/20 border-t-[#00B4D8] rounded-full animate-spin"></div>
                <div>
                  <p className="text-lg font-bold text-[#0F1419] dark:text-[#FAFBFC]">Analyzing your term policy...</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <FileText className="w-12 h-12 text-[#00B4D8]" />
                <div>
                  <p className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
                    📄 Click or drag policy here
                  </p>
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                    PDF, JPG, or PNG (max 10MB)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TermPage() {
  const [, setLocation] = useLocation();
  const { analyze } = useAnalysis();

  // SEO
  useSEO({
    title: "Understand Your Term Life Insurance Policy | Pure Protection Analyzer | Ensured",
    description: "Upload your term life insurance PDF. Instantly see if your sum assured is enough for your family's future, understand claim conditions, exclusions, and maximize coverage per rupee. Pure protection, maximum affordability.",
    keywords: "term life insurance analyzer, term insurance policy checker, term life insurance explained, pure protection insurance, affordable term life, term insurance calculator",
    canonical: "/term",
  });

  // FAQ Schema - Term-specific
  const faqList = [
    {
      question: "What is term life insurance? How is it different from whole life?",
      answer: "Term life insurance is pure protection—you pay premium for 20–30 years. If you die during the term, your family gets the sum assured. If you survive the term, the policy expires (no return). Cost: ₹500–₹1500/month for ₹1cr at age 30. Whole life insurance: You pay premium for LIFE (or until age 100). If you die anytime, family gets sum assured. Also builds cash value (like savings). Cost: ₹5000–₹10000+/month for ₹1cr (10x expensive). For most Indians: Term life is best—pure protection, maximum coverage per rupee, affordable.",
    },
    {
      question: "How much term life insurance should I buy? ₹50L or ₹1cr?",
      answer: "Formula: Get 10–12x your annual income as sum assured. Age 30 with ₹12L income? Get ₹1.2cr–₹1.4cr term life. Age 50 with ₹25L income? Get ₹2.5cr–₹3cr term life. Why? Because term life is pure protection—maximum coverage per rupee. ₹50L covers home loan + 5 years living = NOT ENOUGH. ₹1cr covers home loan + 10 years living + partial education. ₹1.5–2cr covers all above + spouse's 20-year retirement. Benchmark by life stage: Age 25–35 (young professional): 10–12x income. Age 35–45 (parent): 12–15x income. Age 45–55 (peak earner): 8–10x income (lower, kids grown). Age 55+ (near retirement): 5–7x income. Use calculator: Tell us your income + dependents + goals → we compute exact need.",
    },
    {
      question: "Why choose term life over whole life or endowment?",
      answer: "Term life = Pure protection, maximum coverage per rupee, affordable. Whole life = 10x expensive, builds cash value (but returns are low). Endowment = Hybrid, 2–3x expensive, returns mediocre. For most Indians: Term life is best because: 1) Maximum coverage per rupee (₹1cr for ₹1000/month vs ₹5000/month for whole life). 2) Pure protection focus (no investment confusion). 3) Affordable (1–2% of income vs 5–10% for whole life). 4) Flexible (can increase/decrease coverage as needs change). 5) Better returns if you invest the premium difference separately in mutual funds. Bottom line: Buy term life ₹1cr and invest ₹4000/month separately = Better protection + better returns.",
    },
    {
      question: "What's the suicide clause? Why does it matter?",
      answer: "Suicide clause: If you die by suicide within [12–24 months] of policy start, family gets ₹0 (policy denied). Why? Insurers prevent fraud (someone buying insurance planning suicide). Reality: Most people don't buy insurance with suicide intent. Clause protects insurer from this tiny risk. After 12–24 months, clause expires. Impact on you: If you're suicidal NOW, don't buy insurance expecting to use this. If you're healthy, this clause doesn't matter. Most claims happen from accidents/illness, not suicide. Bottom line: Standard legal protection. Don't overthink it.",
    },
    {
      question: "What if I don't disclose a health condition (diabetes, BP) at purchase?",
      answer: "RISK: If claim happens and insurer discovers non-disclosure: Claim DENIED (entire ₹1cr, not partial). Family gets ₹0. Possible legal case against you. Reality: 30% of policy buyers don't fully disclose. But risk = ₹1cr loss if caught. Solution: Be 100% honest at purchase. Disclose: 'I have diabetes, controlled with insulin'. Disclose: 'I had depression in 2020, treated'. Disclose: 'My father died of heart disease at 50'. These increase premium 10–30%, but claims are APPROVED. Bottom line: Higher premium now > ₹0 claim later. Always declare.",
    },
    {
      question: "Can I get term life if I smoke?",
      answer: "YES, but cost is 2–3x higher. Non-smoker: ₹500–₹800/month for ₹1cr at age 35. Smoker: ₹1500–₹2400+/month for same ₹1cr. Reason: Smokers have higher death risk (lung cancer, heart disease). Solution: ✅ Disclose: Insurer charges high but claims covered. ❌ Don't disclose: Premium cheaper, but claim can be DENIED if death is smoking-related. Recommendation: If smoker, disclose and pay higher premium. Better than risking claim denial.",
    },
    {
      question: "What if my claim gets denied? Can I appeal?",
      answer: "YES. Claim denial process: Step 1: Insurer denies claim (sends letter with reason). Step 2: You can appeal (within 30 days typically). Step 3: Ombudsman review (free, neutral party). Step 4: Legal case (if still denied, escalate). Common denial reasons + appeal chances: 1. Non-disclosure: 80% denial upheld (hard to appeal). 2. Suicide within clause: 95% denial upheld (legal). 3. High-risk activity: 60% appeal success. 4. Incomplete documentation: 30% denial upheld (easy to appeal, resubmit docs). Timeline: Appeal + ombudsman = 3–6 months. Pro tip: Get ombudsman involved immediately if denied. Pressure often works.",
    },
    {
      question: "Should I add Accidental Death (ADB) or Critical Illness (CI) rider?",
      answer: "Depends on your risk profile and age: ACCIDENTAL DEATH RIDER (+₹200–500/month): ✅ If: Age <50, drive daily, live in metro (accident risk high). ❌ If: Retired, don't commute, low-risk job. Amount: Usually adds ₹50L–₹1cr more death benefit for accidents only. CRITICAL ILLNESS RIDER (+₹500–1500/month): ✅ If: Age 35–50, sole earner, significant loans, high medical costs possible. ✅ Covers: Cancer, heart attack, stroke, kidney failure (diagnosis = gets ₹X lump sum while alive). ❌ If: Already have health insurance, age 50+ (expensive), low cancer risk. DISABILITY RIDER (+₹300–800/month): ✅ If: Age 30–50, sole income earner. ✅ Covers: If you become disabled, premiums auto-waived + family still protected. RECOMMENDATION: Age 25–35, healthy: Get ADB only (cheap, useful for accident). Age 35–50, prime earner: Get CI rider (more likely to face critical illness). Age 50+: Skip riders (expensive, limited time left). My take: If income ₹15L+, add CI rider. Protects against illness-caused income loss.",
    },
    {
      question: "Can I cancel my term policy early? Will I get my money back?",
      answer: "YES, you can cancel anytime. But NO refund (unless policy has rider). Scenario: You bought 20-year term at age 30. At age 40, you want to cancel. You've paid 10 years of premiums: ₹2,00,000+. Insurer says: Policy is EXPIRED (no death benefit after cancellation). You get: ₹0 back (pure insurance, not savings). Options if you want to cancel: 1. Stop paying premium → policy lapses (after grace period). 2. Surrender policy formally. 3. Convert to lower sum assured (keep some protection, reduce premium). AVOID cancellation if: You have dependents (they lose protection). Your health has deteriorated (can't get new policy). You still have loans. Recommendation: Only cancel if you've upgraded to better policy elsewhere.",
    },
    {
      question: "What if I miss a premium payment? Does my policy lapse immediately?",
      answer: "NO, there's a GRACE PERIOD (usually 30 days). Timeline: Day 1: Premium due. Day 1–30: Grace period (missed but recoverable). Day 31: Policy lapses (protection ENDS). If you pay during grace period: ✅ Policy continues. ✅ All previous terms still valid. If you miss grace period: 🔴 Policy LAPSES. 🔴 If you die while lapsed, family gets ₹0. AVOID LAPSING by: ✅ Setting auto-debit (premium auto-paid). ✅ Setting phone reminder (manual payment). Pro tip: If you lapsed accidentally, contact insurer ASAP (within 1–2 years, they may restart without full medical exam).",
    },
    {
      question: "Does term life insurance have any investment/savings component?",
      answer: "NO (standard term life). You pay premium, get death protection only. If policy expires and you're alive, you get ₹0 (no return). This is WHY it's affordable—pure protection, maximum coverage per rupee. BUT: Some insurers offer optional add-ons: ✅ Return of premium rider (if alive at end, get all premiums back). Cost: 2–3x higher premium. Example: 20-year term, ₹1000/month → ₹2000–3000/month with rider. Verdict: Usually not worth it (better to invest separately). ❌ Money-back policies (insurer pays 10% every 5 years if alive). Cost: 1.5–2x higher premium. Verdict: Waste (invest separately instead). ❌ ULIPs (Unit-linked insurance) – Part insurance, part mutual fund. Cost: 2–4x higher than term life. Risk: Returns depend on market (can lose money). My take: Keep term life PURE and cheap. Buy term life ₹1cr and invest ₹1000/month separately in mutual funds. Better returns, lower insurance cost.",
    },
  ];
  
  const faqData = createFAQSchema(faqList);

  const handleFileUpload = async (file: File) => {
    sessionStorage.removeItem("ensured_report");
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      await analyze(file);
      setLocation("/processing");
    } catch (err: any) {
      console.error("Analysis failed:", err);
      throw err;
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FFFE] dark:bg-[#0F1419] flex flex-col">
      <SchemaMarkup type="FAQPage" data={faqData} />
      <Header />

      {/* Hero Section */}
      <section 
        className="bg-gradient-to-br from-[#0F1419] to-[#00B4D8] py-20 md:py-24 px-6 md:px-14 text-center text-white"
        style={{ background: "linear-gradient(15deg, #0F1419 0%, #00B4D8 100%)" }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00B4D8]/20 rounded-full text-xs font-medium text-white/90 mb-4">
            <Zap className="w-3 h-3" />
            Pure protection • Maximum coverage per rupee
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold leading-tight mb-6">
            Understand Your Term Life Insurance Policy
          </h1>
          <p className="text-base md:text-lg text-white/90 leading-relaxed mb-8 max-w-2xl mx-auto">
            Upload your term life insurance PDF. Instantly see if your sum assured 
            is enough for your family's future, understand claim conditions, 
            exclusions, and maximize coverage per rupee. Pure protection, maximum affordability.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <Button
              onClick={() => {
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                if (fileInput) fileInput.click();
              }}
              className="bg-[#00B4D8] hover:bg-[#0099B4] text-white h-12 px-8 text-base font-semibold"
            >
              Upload Policy PDF
            </Button>
          </div>
          <p className="text-xs text-white/70">
            Secure upload • No data stored • Free analysis
          </p>
        </div>
      </section>

      {/* Analyzer Tool Section */}
      <section className="bg-white dark:bg-[#0F1419] py-16 md:py-20 px-6 md:px-14">
        <TermAnalyzer onFileUpload={handleFileUpload} />
      </section>

      {/* "What You'll Discover" Band */}
      <section className="bg-[#EFF6FF] dark:bg-[#1E3A5F]/30 py-12 px-6 md:px-14 border-l-4 border-[#00B4D8] my-12">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-6">
            What you'll discover:
          </h3>
          <div className="space-y-4 text-sm text-[#0F1419] dark:text-[#FAFBFC] leading-relaxed">
            <div className="flex gap-3">
              <span className="text-lg">1️⃣</span>
              <p>
                Whether your ₹1cr / ₹50L / ₹2cr sum assured is actually enough for your 
                dependents' needs—based on your income, loans, children's education costs, 
                and spouse's retirement timeline (20–30 years pure protection)
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-lg">2️⃣</span>
              <p>
                The real claim conditions, suicide clause waiting period, 
                non-disclosure penalties that could get your entire claim rejected 
                (most common reason: not telling insurer about diabetes at purchase)
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-lg">3️⃣</span>
              <p>
                How your riders (accidental death, critical illness, disability) 
                actually trigger and what they don't cover—most people get this 
                completely wrong and are shocked at claim time
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-6">
            <Button
              variant="link"
              className="text-[#00B4D8] text-sm font-medium p-0 h-auto"
              onClick={() => setLocation("/calculator?type=term")}
            >
              See real scenario breakdown →
            </Button>
            <Button
              variant="link"
              className="text-[#00B4D8] text-sm font-medium p-0 h-auto"
              onClick={() => setLocation("/compare?type=term")}
            >
              Compare and find better terms →
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-white dark:bg-[#0F1419] py-12 px-6 md:px-14 border-t border-[#E5E7EB] dark:border-gray-700 border-b border-[#E5E7EB] dark:border-gray-700">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-8">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-3">
            {faqList.map((faq, index) => (
              <details key={index} className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC] pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" />
                </summary>
                <p className="mt-3 text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed whitespace-pre-line">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Related Tools Section */}
      <section className="bg-[#FAFBFC] dark:bg-[#111827] py-12 px-6 md:px-14 border-t border-[#E5E7EB] dark:border-gray-700">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-2xl font-semibold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-8">
            Use our tools to maximize coverage per rupee:
          </h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Calculator Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#E5E7EB] dark:border-gray-700 p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#00B4D8]/10 flex items-center justify-center mx-auto mb-4">
                <Calculator className="w-6 h-6 text-[#00B4D8]" />
              </div>
              <h4 className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
                🧮 Coverage Calculator
              </h4>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4 leading-relaxed">
                Calculate exact sum assured needed
              </p>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4 leading-relaxed">
                Enter your income, dependents, loans. We'll calculate exact sum assured needed
                for maximum coverage per rupee—pure protection, 20–30 year terms.
              </p>
              <div className="bg-[#F3F4F6] dark:bg-gray-700 rounded-lg p-3 mb-4 text-left text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                <div>Example:</div>
                <div>Income: ₹12L</div>
                <div>Dependents: 2 kids + spouse</div>
                <div>Loans: ₹50L home + ₹10L car</div>
                <div className="font-semibold text-[#00B4D8] mt-1">→ Recommended: ₹1.5cr–₹1.8cr</div>
              </div>
              <Button
                onClick={() => setLocation("/calculator?type=term")}
                className="w-full bg-[#00B4D8] hover:bg-[#0099B4] text-white h-11"
              >
                Calculate My Need
              </Button>
            </div>

            {/* Comparer Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#E5E7EB] dark:border-gray-700 p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#00B4D8]/10 flex items-center justify-center mx-auto mb-4">
                <Scale className="w-6 h-6 text-[#00B4D8]" />
              </div>
              <h4 className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">
                ↔️ Policy Comparer
              </h4>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4 leading-relaxed">
                Find the best term plan for maximum coverage per rupee
              </p>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4 leading-relaxed">
                Compare HDFC vs ICICI vs Religare term plans. See premiums, claim settlement
                ratios, riders, terms. We recommend the best unbiased winner—maximum protection, minimum cost.
              </p>
              <div className="bg-[#F3F4F6] dark:bg-gray-700 rounded-lg p-3 mb-4 text-left text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                <div className="font-medium mb-1">Compare by:</div>
                <div>• Lowest premium (maximum coverage per rupee)</div>
                <div>• Best claim settlement ratio</div>
                <div>• Riders included</div>
                <div>• Customer reviews</div>
              </div>
              <Button
                onClick={() => setLocation("/compare?type=term")}
                className="w-full bg-[#00B4D8] hover:bg-[#0099B4] text-white h-11"
              >
                Compare Policies
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-gradient-to-br from-[#00B4D8] to-[#0F1419] py-16 px-6 md:px-14 my-16 rounded-2xl max-w-[600px] mx-auto text-center text-white">
        <h3 className="text-3xl font-semibold mb-4">
          Ready to maximize your coverage per rupee?
        </h3>
        <p className="text-base text-white/90 mb-6 leading-relaxed">
          Get the right amount of pure protection based on your actual needs. 
          Our calculator shows exactly what you need—and our comparer finds 
          the best term plan for maximum coverage, minimum cost.
        </p>
        <Button
          onClick={() => setLocation("/calculator?type=term")}
          className="bg-[#0F1419] hover:bg-[#1A3A52] text-white h-12 px-8 text-base font-semibold mb-4"
        >
          Start Coverage Calculator
        </Button>
        <div>
          <Button
            variant="link"
            onClick={() => setLocation("/compare?type=term")}
            className="text-white text-sm underline-offset-4 hover:underline"
          >
            Or compare policies directly
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
