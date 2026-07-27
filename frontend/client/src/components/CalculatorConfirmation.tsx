import { Button } from "@/components/ui/button";
import { Check, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalculatorConfirmationProps {
  question: string;
  selectedValue: string;
  onConfirm: () => void;
  onEdit: () => void;
  className?: string;
}

export function CalculatorConfirmation({
  question,
  selectedValue,
  onConfirm,
  onEdit,
  className,
}: CalculatorConfirmationProps) {
  return (
    <div
      className={cn(
        "bg-[var(--color-teal-50)] border-2 border-[var(--color-teal-200)] rounded-xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-300",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-[var(--color-teal-600)] flex items-center justify-center shrink-0">
          <Check className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">
            {question}
          </p>
          <p className="text-lg font-bold text-[var(--color-navy-900)] mb-4">
            {selectedValue}
          </p>
          <div className="flex gap-3">
            <Button
              onClick={onConfirm}
              className="bg-[var(--color-teal-600)] text-white hover:bg-[var(--color-teal-700)]"
            >
              Continue
            </Button>
            <Button
              onClick={onEdit}
              variant="outline"
              className="border-[var(--color-teal-300)] text-[var(--color-teal-700)] hover:bg-[var(--color-teal-50)]"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Change
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
