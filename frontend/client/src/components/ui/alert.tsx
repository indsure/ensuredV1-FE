import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"

const alertVariants = cva(
  "relative w-full rounded border-l-4 p-4 flex items-start gap-3",
  {
    variants: {
      variant: {
        default: "bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-600",
        success: "bg-green-50 border-success dark:bg-green-900/20 dark:border-success",
        warning: "bg-amber-50 border-warning dark:bg-amber-900/20 dark:border-warning",
        error: "bg-red-50 border-error dark:bg-red-900/20 dark:border-error",
        info: "bg-blue-50 border-info dark:bg-blue-900/20 dark:border-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const alertIcons = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
  default: Info,
}

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  onClose?: () => void
  closable?: boolean
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", onClose, closable = false, children, ...props }, ref) => {
    const Icon = variant ? alertIcons[variant] : alertIcons.default
    
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">{children}</div>
        {closable && onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
