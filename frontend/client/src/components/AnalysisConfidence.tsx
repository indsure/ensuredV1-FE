import { AlertCircle, CheckCircle2, Info } from "lucide-react";

interface AnalysisConfidenceProps {
  confidenceScore: number;
  confidenceDrivers?: string[];
  confidenceLimitations?: string[];
}

export function AnalysisConfidence({
  confidenceScore,
  confidenceDrivers = [],
  confidenceLimitations = [],
}: AnalysisConfidenceProps) {
  const isHighConfidence = confidenceScore >= 85;
  const isLowConfidence = confidenceScore < 70;

  return (
    <div className="bg-white dark:bg-[#1F2937] rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={`p-2 rounded-lg ${
          isHighConfidence 
            ? "bg-green-100 dark:bg-green-900/30" 
            : isLowConfidence 
            ? "bg-orange-100 dark:bg-orange-900/30" 
            : "bg-blue-100 dark:bg-blue-900/30"
        }`}>
          {isHighConfidence ? (
            <CheckCircle2 className={`w-5 h-5 ${
              isHighConfidence 
                ? "text-green-600 dark:text-green-400" 
                : "text-blue-600 dark:text-blue-400"
            }`} />
          ) : (
            <AlertCircle className={`w-5 h-5 ${
              isLowConfidence 
                ? "text-orange-600 dark:text-orange-400" 
                : "text-blue-600 dark:text-blue-400"
            }`} />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC]">
              Policy Interpretation Confidence
            </h3>
            <span className={`text-2xl font-bold ${
              isHighConfidence 
                ? "text-green-600 dark:text-green-400" 
                : isLowConfidence 
                ? "text-orange-600 dark:text-orange-400" 
                : "text-blue-600 dark:text-blue-400"
            }`}>
              {confidenceScore}%
            </span>
          </div>

          <div className="mb-3">
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
              This score represents confidence in policy wording match, clause extraction, and rule application accuracy.
            </p>
          </div>

          {isLowConfidence && (
            <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Indicative Analysis Only
              </p>
            </div>
          )}

          {isHighConfidence && (
            <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                High confidence in policy interpretation
              </p>
            </div>
          )}

          {confidenceDrivers.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] mb-2">
                Confidence Drivers:
              </p>
              <ul className="space-y-1">
                {confidenceDrivers.map((driver, idx) => (
                  <li key={idx} className="text-sm text-[#0F1419] dark:text-[#FAFBFC] flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                    <span>{driver}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {confidenceLimitations.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] mb-2">
                Confidence Limitations:
              </p>
              <ul className="space-y-1">
                {confidenceLimitations.map((limitation, idx) => (
                  <li key={idx} className="text-sm text-[#0F1419] dark:text-[#FAFBFC] flex items-start gap-2">
                    <span className="text-gray-400 dark:text-gray-500 mt-0.5">•</span>
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] italic">
              This score does not predict claim approval probability.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
