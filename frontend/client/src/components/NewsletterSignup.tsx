import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";

interface NewsletterSignupProps {
  compact?: boolean;
}

export function NewsletterSignup({ compact = false }: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Integrate with email service
    console.log("Newsletter signup:", email);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setEmail("");
    }, 3000);
  };

  if (compact) {
    return (
      <div className="bg-white dark:bg-[#0F1419] border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-3">
          Get Weekly Tips
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-10 text-sm bg-white dark:bg-[#0F1419] border-gray-200 dark:border-gray-700"
          />
          <Button
            type="submit"
            className="w-full h-10 bg-[#00B4D8] hover:bg-[#0099B4] text-white text-sm font-semibold"
            disabled={submitted}
          >
            {submitted ? "Subscribed!" : "Subscribe"}
          </Button>
        </form>
        <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] italic mt-3">
          No spam, unsubscribe anytime
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-[#00B4D8] to-[#0F1419] rounded-2xl p-12 md:p-16 text-center max-w-2xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
        Get Insurance Insights Weekly
      </h2>
      <p className="text-sm md:text-base text-white/90 mb-8 leading-relaxed">
        Clarity on insurance in your inbox every week. No spam. No sales. Just honest insurance knowledge.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-0 max-w-lg mx-auto">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1 h-12 px-4 rounded-l-lg rounded-r-lg sm:rounded-r-none bg-white border-0 text-base"
        />
        <Button
          type="submit"
          className="h-12 px-8 rounded-r-lg sm:rounded-l-none bg-[#0F1419] hover:bg-[#1F2937] text-white font-semibold"
          disabled={submitted}
        >
          {submitted ? "Subscribed!" : "Subscribe"}
        </Button>
      </form>
      <p className="text-xs text-white/70 mt-4">
        We respect your privacy. Unsubscribe anytime.
      </p>
    </div>
  );
}
