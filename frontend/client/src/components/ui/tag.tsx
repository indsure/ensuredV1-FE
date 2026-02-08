import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface TagProps extends React.HTMLAttributes<HTMLDivElement> {
  onRemove?: () => void
  removable?: boolean
}

const Tag = React.forwardRef<HTMLDivElement, TagProps>(
  ({ className, children, onRemove, removable = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2 h-8 px-3 rounded-md bg-gray-100 dark:bg-gray-700 text-sm",
          "transition-opacity duration-200",
          className
        )}
        {...props}
      >
        <span>{children}</span>
        {removable && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-1 rounded-sm hover:bg-gray-200 dark:hover:bg-gray-600 p-0.5 transition-colors"
            aria-label="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }
)
Tag.displayName = "Tag"

export { Tag }

