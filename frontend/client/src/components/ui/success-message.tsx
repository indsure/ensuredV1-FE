import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link } from "wouter"

export interface SuccessMessageProps {
  title?: string
  message: string
  nextAction?: {
    label: string
    href?: string
    onClick?: () => void
  }
  onDismiss?: () => void
  variant?: "toast" | "inline"
  showAchievement?: boolean
  className?: string
}

export function SuccessMessage({
  title,
  message,
  nextAction,
  onDismiss,
  variant = "toast",
  showAchievement = false,
  className,
}: SuccessMessageProps) {
  const [isVisible, setIsVisible] = React.useState(true)

  React.useEffect(() => {
    if (variant === "toast") {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onDismiss?.()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [variant, onDismiss])

  if (!isVisible) return null

  if (variant === "toast") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 p-4 rounded-lg bg-success text-white shadow-lg animate-slide-up",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1 space-y-1">
          {title && (
            <div className="font-semibold text-sm">
              {showAchievement && "Great! "}
              {title}
            </div>
          )}
          <div className="text-sm">{message}</div>
          {nextAction && (
            <div className="mt-2">
              {nextAction.href ? (
                <Link href={nextAction.href}>
                  <a className="text-xs underline hover:no-underline">
                    {nextAction.label}
                  </a>
                </Link>
              ) : (
                <button
                  onClick={nextAction.onClick}
                  className="text-xs underline hover:no-underline"
                >
                  {nextAction.label}
                </button>
              )}
            </div>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={() => {
              setIsVisible(false)
              onDismiss()
            }}
            className="text-white hover:text-white/80 transition-colors"
            aria-label="Dismiss success message"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  // Inline variant
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-md bg-success/10 border border-success/20",
        className
      )}
      role="status"
    >
      <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
      <div className="flex-1 space-y-2">
        {title && (
          <div className="font-semibold text-success text-sm">
            {showAchievement && "Success! "}
            {title}
          </div>
        )}
        <div className="text-sm text-success">{message}</div>
        {nextAction && (
          <div className="mt-2">
            {nextAction.href ? (
              <Link href={nextAction.href}>
                <a>
                  <Button variant="default" size="sm">
                    {nextAction.label}
                  </Button>
                </a>
              </Link>
            ) : (
              <Button variant="default" size="sm" onClick={nextAction.onClick}>
                {nextAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-success hover:text-success/80 transition-colors"
          aria-label="Dismiss success message"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

