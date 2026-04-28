import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CalculatorProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
  className?: string;
}

export function CalculatorProgress({
  currentStep,
  totalSteps,
  stepLabels,
  className,
}: CalculatorProgressProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className={cn("w-full", className)}>
      {/* Progress Bar */}
      <div className="relative">
        <div className="h-2 bg-[var(--color-border-light)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-teal-600)] transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        {/* Step Indicators */}
        <div className="flex justify-between mt-4">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            const label = stepLabels?.[index];

            return (
              <div
                key={index}
                className="flex flex-col items-center"
                style={{ width: `${100 / totalSteps}%` }}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                    isCompleted &&
                      "bg-[var(--color-teal-600)] text-white scale-100",
                    isCurrent &&
                      "bg-[var(--color-teal-600)] text-white scale-110 ring-4 ring-[var(--color-teal-100)]",
                    !isCompleted &&
                      !isCurrent &&
                      "bg-[var(--color-border-light)] text-[var(--color-text-muted)]"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    stepNumber
                  )}
                </div>
                {label && (
                  <span
                    className={cn(
                      "text-xs mt-2 text-center transition-colors duration-300",
                      (isCompleted || isCurrent)
                        ? "text-[var(--color-navy-900)] font-medium"
                        : "text-[var(--color-text-muted)]"
                    )}
                  >
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Percentage Text */}
      <div className="text-center mt-4">
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
          {percentage}% Complete
        </span>
      </div>
    </div>
  );
}

/**
 * Simplified progress dots for mobile
 */
export function CalculatorProgressDots({
  currentStep,
  totalSteps,
  className,
}: Omit<CalculatorProgressProps, "stepLabels">) {
  return (
    <div className={cn("flex gap-2 justify-center", className)}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <div
            key={index}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              isCurrent && "w-8 bg-[var(--color-teal-600)]",
              isCompleted && "w-8 bg-[var(--color-teal-600)]",
              !isCompleted && !isCurrent && "w-2 bg-[var(--color-border-medium)]"
            )}
          />
        );
      })}
    </div>
  );
}
