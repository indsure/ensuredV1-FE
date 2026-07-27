import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface LeadCollectionCTAProps {
  policyData?: {
    insured_names?: string[];
    city?: string;
  };
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  variant?: "consider" | "yes";
}

export function LeadCollectionCTA({ policyData, className, isOpen, onClose, variant = "consider" }: LeadCollectionCTAProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: policyData?.insured_names?.[0] || "",
    email: "",
    phone: "",
    city: policyData?.city || "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiFetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          source: "policy_report",
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        console.error("Failed to submit lead");
      }
    } catch (error) {
      console.error("Error submitting lead:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const bgColor = variant === "yes" ? "from-red-50 to-rose-50" : "from-amber-50 to-orange-50";
  const borderColor = variant === "yes" ? "border-red-200" : "border-amber-200";
  const badgeBg = variant === "yes" ? "bg-red-100" : "bg-amber-100";
  const badgeText = variant === "yes" ? "text-red-800" : "text-amber-800";
  const badgeBorder = variant === "yes" ? "border-red-200" : "border-amber-200";
  const buttonBg = variant === "yes" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700";
  const inputBorder = variant === "yes" ? "border-red-200 focus:ring-red-400" : "border-amber-200 focus:ring-amber-400";

  if (isSubmitted) {
    return (
      <div className={cn(
        "border rounded-xl p-8 shadow-sm relative",
        variant === "yes" ? "border-green-200 bg-gradient-to-br from-green-50 to-emerald-50" : "border-green-200 bg-gradient-to-br from-green-50 to-emerald-50",
        className
      )}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/50 rounded-full transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-serif text-[var(--color-navy-900)] mb-2">
            Thank You!
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-md">
            Our advisor will reach out to you within 24 hours to discuss your policy options.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      `border ${borderColor} bg-gradient-to-br ${bgColor} rounded-xl p-8 shadow-sm relative overflow-hidden`,
      className
    )}>
      {/* Background decoration */}
      <div className={`absolute top-0 right-0 w-64 h-64 ${variant === "yes" ? "bg-red-100" : "bg-amber-100"} rounded-full opacity-20 blur-3xl -mr-32 -mt-32`} />
      
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 hover:bg-white/50 rounded-full transition-colors z-10"
      >
        <X className="w-4 h-4 text-gray-500" />
      </button>

      <div className="relative z-10">
        <div className="mb-6">
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4 ${badgeBg} ${badgeText} border ${badgeBorder}`}>
            {variant === "yes" ? "⚠ ACTION REQUIRED" : "→ CONSIDER"}
          </span>
          <h3 className="text-2xl font-serif text-[var(--color-navy-900)] mb-3">
            {variant === "yes" ? "Find a Better Policy Now" : "Talk to an IndSure Advisor"}
          </h3>
          <p className="text-[var(--color-text-secondary)] leading-relaxed mb-2">
            {variant === "yes" 
              ? "Your current policy has critical gaps that could leave you exposed during claims. Our advisors can help you find comprehensive coverage."
              : "While the policy is mature (6 years old), the base cover is low and the room rent proportional deduction is a major risk. Porting to a policy with 'Any Room' coverage and no proportional deductions is highly recommended."
            }
          </p>
          <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
              <span>No room rent limits (Any Room category)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
              <span>No proportional deductions</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
              <span>Consumables cover rider</span>
            </li>
          </ul>
        </div>

        <div className={`border-t ${variant === "yes" ? "border-red-200" : "border-amber-200"} pt-6`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className={`w-full px-4 py-2.5 border ${inputBorder} rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-white text-sm`}
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  pattern="[0-9]{10}"
                  className={`w-full px-4 py-2.5 border ${inputBorder} rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-white text-sm`}
                  placeholder="10-digit mobile number"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={`w-full px-4 py-2.5 border ${inputBorder} rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-white text-sm`}
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label htmlFor="city" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  className={`w-full px-4 py-2.5 border ${inputBorder} rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-white text-sm`}
                  placeholder="Your city"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={`w-full ${buttonBg} text-white h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Talk to an IndSure Advisor about this
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
            <p className="text-xs text-center text-[var(--color-text-muted)] mt-2">
              Our advisors will help you find the best policy for your needs
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
