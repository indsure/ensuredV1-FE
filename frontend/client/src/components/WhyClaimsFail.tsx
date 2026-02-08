import { AlertTriangle } from "lucide-react";

interface WhyClaimsFailProps {
  reasons: string[];
}

export function WhyClaimsFail({ reasons }: WhyClaimsFailProps) {
  if (!reasons || reasons.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-800">
      <div className="flex items-start gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs font-semibold text-red-800 dark:text-red-200">
          WHY CLAIMS FAIL HERE (MOST COMMON):
        </p>
      </div>
      <ul className="space-y-1 ml-6">
        {reasons.map((reason, idx) => (
          <li key={idx} className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
            • {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
