import * as React from "react"

import { cn } from "@/lib/utils"

export interface SectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  titleLevel?: 3 | 4
  divider?: boolean
}

const Section = React.forwardRef<HTMLDivElement, SectionProps>(
  ({ className, title, titleLevel = 3, divider = false, children, ...props }, ref) => {
    const TitleTag = titleLevel === 3 ? "h3" : "h4"

    return (
      <section ref={ref} className={cn("", className)} {...props}>
        {title && (
          <TitleTag className={cn(
            titleLevel === 3 ? "text-2xl" : "text-xl",
            "font-semibold mb-8"
          )}>
            {title}
          </TitleTag>
        )}
        <div>{children}</div>
        {divider && <div className="h-px bg-gray-200 dark:bg-gray-700 my-10" />}
      </section>
    )
  }
)
Section.displayName = "Section"

export { Section }

