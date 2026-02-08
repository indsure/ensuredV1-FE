import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  error?: string
  helperText?: string
  maxLength?: number
  showCounter?: boolean
  label?: string
  required?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, helperText, maxLength, showCounter, label, required, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const [charCount, setCharCount] = React.useState(0)
    const value = props.value as string || ""
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`
    const errorId = error ? `${textareaId}-error` : undefined
    const helperId = helperText ? `${textareaId}-helper` : undefined
    const describedBy = [errorId, helperId, ariaDescribedBy].filter(Boolean).join(" ") || undefined
    
    React.useEffect(() => {
      setCharCount(value.length)
    }, [value])

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            {label}
            {required && (
              <span className="text-error ml-1" aria-label="required">
                *
              </span>
            )}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            // Base styles
            "flex min-h-[100px] w-full rounded-md border bg-transparent px-3 py-2.5 text-sm",
            // Border and focus
            "border-gray-300 focus:border-primary-500 focus:outline-2 focus:outline-primary-500 focus:outline-offset-2",
            // Invalid state
            error && "border-error focus:border-error focus:outline-error",
            // Disabled state
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100",
            // Placeholder
            "placeholder:text-gray-400 placeholder:text-sm",
            // Text colors
            "text-gray-900 dark:text-gray-100",
            // Shadow
            "shadow-sm transition-colors resize-y",
            // Max height
            "max-h-[200px] overflow-y-auto",
            className
          )}
          ref={ref}
          rows={4}
          maxLength={maxLength}
          aria-invalid={error ? "true" : undefined}
          aria-required={required ? "true" : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            setCharCount(e.target.value.length)
            props.onChange?.(e)
          }}
          {...props}
        />
        {/* Character counter and helper text */}
        <div className="mt-1 flex items-center justify-between">
          {(helperText || error) && (
            <div
              id={error ? errorId : helperId}
              className={cn(
                "flex items-center gap-1 text-xs",
                error ? "text-error" : "text-gray-500"
              )}
              role={error ? "alert" : undefined}
            >
              {error && (
                <svg className="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
              <span>{error || helperText}</span>
            </div>
          )}
          {showCounter && maxLength && (
            <span className={cn(
              "text-xs ml-auto",
              charCount > maxLength * 0.8 ? "text-gray-500" : "text-gray-400"
            )}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
