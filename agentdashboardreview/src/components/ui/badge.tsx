
import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> { 
  variant?: "default" | "secondary" | "outline" | "destructive"
}

const variantStyles = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border-border",
  destructive: "bg-destructive text-destructive-foreground"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return <div className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none ${variantStyles[variant]} ${className || ""}`} {...props} />
}
export { Badge }
