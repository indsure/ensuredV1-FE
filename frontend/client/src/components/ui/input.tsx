import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  error?: string
  helperText?: string
  label?: string
  required?: boolean
  showValidState?: boolean
  isValid?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, helperText, label, required, id, showValidState, isValid, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
    const errorId = error ? `${inputId}-error` : undefined
    const helperId = helperText ? `${inputId}-helper` : undefined
    const validId = isValid && showValidState ? `${inputId}-valid` : undefined
    const describedBy = [errorId, helperId, validId, ariaDescribedBy].filter(Boolean).join(" ") || undefined

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "block text-xs font-semibold mb-1 transition-colors duration-200",
              "text-gray-700 dark:text-gray-300"
            )}
          >
            {label}
            {required && (
              <span className="text-error ml-1" aria-label="required">
                *
              </span>
            )}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            type={type}
            className={cn(
              // Base styles
              "flex h-10 w-full rounded-md border bg-transparent px-3 py-2.5 text-sm",
              // Border and focus
              "border-gray-300 transition-all duration-[var(--transition-fast)]",
              "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10 focus:bg-primary-50/50",
              // Valid state
              isValid && showValidState && !error && "border-success focus:border-success focus:ring-success/10",
              // Invalid state
              error && "border-error focus:border-error focus:ring-error/10",
              // Disabled state
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100",
              // Placeholder
              "placeholder:text-gray-400 placeholder:text-sm placeholder:transition-opacity placeholder:duration-200",
              "focus:placeholder:opacity-0",
              // Text colors
              "text-gray-900 dark:text-gray-100",
              // Shadow
              "shadow-sm",
              className
            )}
            ref={ref}
            aria-invalid={error ? "true" : undefined}
            aria-required={required ? "true" : undefined}
            aria-describedby={describedBy}
            {...props}
          />
          {/* Valid state icon */}
          {isValid && showValidState && !error && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
              <svg className="h-4 w-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          {/* Error state icon */}
          {error && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
              <svg className="h-4 w-4 text-error" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
        {/* Helper text or error message */}
        {(helperText || error || (isValid && showValidState)) && (
          <div
            id={error ? errorId : isValid && showValidState ? validId : helperId}
            className={cn(
              "mt-1 flex items-center gap-1 text-xs transition-opacity duration-200",
              error ? "text-error" : isValid && showValidState ? "text-success" : "text-gray-500"
            )}
            role={error ? "alert" : undefined}
          >
            {error && (
              <svg className="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            {isValid && showValidState && !error && (
              <svg className="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            <span>{error || (isValid && showValidState ? "Verified" : helperText)}</span>
          </div>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
