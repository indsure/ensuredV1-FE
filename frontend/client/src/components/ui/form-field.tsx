import * as React from "react"
import { cn } from "@/lib/utils"
import { Input, InputProps } from "@/components/ui/input"
import { Textarea, TextareaProps } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"

export interface FormFieldProps {
  label: string
  required?: boolean
  optional?: boolean
  helperText?: string
  error?: string
  className?: string
  children: React.ReactNode
}

export function FormField({
  label,
  required = false,
  optional = false,
  helperText,
  error,
  className,
  children,
}: FormFieldProps) {
  const fieldId = React.useId()

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={fieldId}
        className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && (
          <span className="text-error ml-1" aria-label="required">
            *
          </span>
        )}
        {optional && (
          <span className="text-gray-500 ml-1 text-xs font-normal">
            (Optional)
          </span>
        )}
      </label>
      {React.cloneElement(children as React.ReactElement, {
        id: fieldId,
        error,
        helperText,
        required,
        "aria-describedby": error
          ? `${fieldId}-error`
          : helperText
          ? `${fieldId}-helper`
          : undefined,
      })}
    </div>
  )
}

export interface FormGroupProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function FormGroup({
  title,
  description,
  children,
  className,
}: FormGroupProps) {
  return (
    <div className={cn("space-y-5 mb-6", className)}>
      {title && (
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="space-y-4">{children}</div>
      {title && (
        <div className="h-px bg-gray-200 dark:bg-gray-700 mt-6" />
      )}
    </div>
  )
}

export interface FormStepIndicatorProps {
  currentStep: number
  totalSteps: number
  stepLabels?: string[]
}

export function FormStepIndicator({
  currentStep,
  totalSteps,
  stepLabels,
}: FormStepIndicatorProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-xs text-gray-500">
          {Math.round((currentStep / totalSteps) * 100)}% complete
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-primary-500 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
        />
      </div>
      {stepLabels && stepLabels.length > 0 && (
        <div className="flex justify-between mt-3">
          {stepLabels.map((label, index) => (
            <div
              key={index}
              className={cn(
                "text-xs text-center flex-1",
                index + 1 <= currentStep
                  ? "text-primary-500 font-medium"
                  : "text-gray-500"
              )}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export interface FormNavigationProps {
  onPrevious?: () => void
  onNext?: () => void
  previousLabel?: string
  nextLabel?: string
  showPrevious?: boolean
  showNext?: boolean
  isLoading?: boolean
  isNextDisabled?: boolean
}

export function FormNavigation({
  onPrevious,
  onNext,
  previousLabel = "Previous",
  nextLabel = "Continue",
  showPrevious = true,
  showNext = true,
  isLoading = false,
  isNextDisabled = false,
}: FormNavigationProps) {
  return (
    <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
      {showPrevious && onPrevious ? (
        <button
          type="button"
          onClick={onPrevious}
          className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
        >
          {previousLabel}
        </button>
      ) : (
        <div />
      )}
      {showNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={isNextDisabled || isLoading}
          className="px-6 py-2.5 text-sm font-medium text-white bg-primary-500 rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 flex items-center gap-2"
        >
          {isLoading && (
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {nextLabel}
        </button>
      )}
    </div>
  )
}

