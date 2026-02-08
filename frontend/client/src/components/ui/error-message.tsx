import * as React from "react"
import { cn } from "@/lib/utils"
import { AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface ErrorMessageProps {
  title?: string
  message: string
  suggestion?: string
  action?: {
    label: string
    onClick: () => void
  }
  onDismiss?: () => void
  variant?: "inline" | "toast" | "modal"
  className?: string
}

export function ErrorMessage({
  title,
  message,
  suggestion,
  action,
  onDismiss,
  variant = "inline",
  className,
}: ErrorMessageProps) {
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-start gap-2 p-3 rounded-md bg-error/10 border border-error/20",
          className
        )}
        role="alert"
      >
        <AlertCircle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          {title && (
            <div className="font-semibold text-error text-sm">{title}</div>
          )}
          <div className="text-sm text-error">{message}</div>
          {suggestion && (
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              {suggestion}
            </div>
          )}
          {action && (
            <Button
              variant="outline"
              size="sm"
              onClick={action.onClick}
              className="mt-2"
            >
              {action.label}
            </Button>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-error hover:text-error/80 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  if (variant === "toast") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 p-4 rounded-lg bg-error text-white shadow-lg",
          className
        )}
        role="alert"
      >
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1 space-y-1">
          {title && <div className="font-semibold text-sm">{title}</div>}
          <div className="text-sm">{message}</div>
          {suggestion && (
            <div className="text-xs opacity-90 mt-1">{suggestion}</div>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-white hover:text-white/80 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  // Modal variant
  return (
    <div
      className={cn(
        "p-6 rounded-lg bg-error/10 border border-error/20",
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-6 w-6 text-error flex-shrink-0" />
        <div className="flex-1 space-y-2">
          {title && (
            <div className="font-semibold text-error text-base">{title}</div>
          )}
          <div className="text-sm text-error">{message}</div>
          {suggestion && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {suggestion}
            </div>
          )}
          {action && (
            <Button
              variant="default"
              onClick={action.onClick}
              className="mt-4"
            >
              {action.label}
            </Button>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-error hover:text-error/80 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
}

