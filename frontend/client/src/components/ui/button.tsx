import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-[var(--transition-fast)] [transition-timing-function:var(--ease-out)] focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
  {
    variants: {
      variant: {
        // PRIMARY BUTTON (Main CTA) - Cyan #00B4D8, white text, 8px radius
        default:
          "bg-[#00B4D8] text-white rounded-lg shadow-sm hover:bg-[#0099B4] hover:shadow-md active:bg-[#007D9A]",
        primary:
          "bg-[#00B4D8] text-white rounded-lg shadow-sm hover:bg-[#0099B4] hover:shadow-md active:bg-[#007D9A]",
        
        // SECONDARY BUTTON (Alternative action)
        secondary:
          "bg-gray-100 text-primary-500 border border-gray-300 shadow-sm hover:bg-gray-200 hover:-translate-y-0.5 active:bg-gray-300 active:translate-y-0",
        
        // TERTIARY BUTTON (Low priority)
        outline:
          "border border-gray-300 bg-transparent text-primary-500 hover:bg-primary-50 active:bg-primary-100",
        ghost: 
          "bg-transparent text-primary-500 hover:bg-primary-50 active:bg-primary-100",
        
        // DANGER BUTTON (Destructive action)
        destructive:
          "bg-error text-white shadow-sm hover:bg-error/90 hover:-translate-y-0.5 active:bg-error/80 active:translate-y-0",
        
        link: 
          "text-primary-500 underline-offset-4 hover:underline bg-transparent",
      },
      size: {
        // Small: 40px height
        sm: "h-10 px-6 text-sm min-w-[48px]",
        // Default: 44px height (touch-friendly)
        default: "h-11 px-6 md:px-8 text-sm font-semibold min-w-[48px]",
        // Large: 48px height
        lg: "h-12 px-8 text-sm font-semibold min-w-[48px]",
        // Icon button: 44px (touch-friendly)
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="opacity-0">{children}</span>
          </>
        ) : children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
