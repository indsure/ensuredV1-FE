import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "text" | "circular" | "rectangular"
  width?: string | number
  height?: string | number
  lines?: number
}

function Skeleton({
  className,
  variant = "default",
  width,
  height,
  lines,
  style,
  ...props
}: SkeletonProps) {
  const baseStyles = {
    background: "linear-gradient(90deg, var(--gray-200) 0%, var(--gray-300) 50%, var(--gray-200) 100%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 2s infinite linear",
  }

  const variantStyles = {
    default: "rounded-md",
    text: "rounded-md h-4",
    circular: "rounded-full",
    rectangular: "rounded-none",
  }

  const combinedStyle = {
    ...baseStyles,
    ...(width && { width: typeof width === "number" ? `${width}px` : width }),
    ...(height && { height: typeof height === "number" ? `${height}px` : height }),
    ...style,
  }

  if (lines && lines > 1) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "animate-shimmer rounded-md bg-gray-200 dark:bg-gray-700",
              variantStyles[variant],
              index === lines - 1 && "w-3/4", // Last line shorter
              className
            )}
            style={combinedStyle}
            {...props}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "animate-shimmer rounded-md bg-gray-200 dark:bg-gray-700",
        variantStyles[variant],
        className
      )}
      style={combinedStyle}
      aria-busy="true"
      aria-label="Loading"
      {...props}
    />
  )
}

// Policy Card Skeleton Component
export function PolicyCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-5 space-y-4">
      <Skeleton variant="text" width="60%" height={20} />
      <Skeleton variant="text" width="40%" height={16} />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton variant="text" width="50%" height={12} />
          <Skeleton variant="text" width="80%" height={16} />
        </div>
        <div className="space-y-2">
          <Skeleton variant="text" width="50%" height={12} />
          <Skeleton variant="text" width="80%" height={16} />
        </div>
      </div>
    </div>
  )
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="p-4">
          <Skeleton variant="text" width="80%" height={16} />
        </td>
      ))}
    </tr>
  )
}

// Form Field Skeleton
export function FormFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton variant="text" width="30%" height={12} />
      <Skeleton variant="rectangular" width="100%" height={40} />
    </div>
  )
}

export { Skeleton }
