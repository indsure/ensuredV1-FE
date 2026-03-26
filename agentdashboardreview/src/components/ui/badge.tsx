
import * as React from "react"
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> { variant?: string }
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={"inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none " + (className || "")} {...props} />
}
export { Badge }
