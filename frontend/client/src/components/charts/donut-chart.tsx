import * as React from "react"
import { cn } from "@/lib/utils"

export interface DonutChartProps {
  value: number // 0-100
  total: number
  covered: number
  label: string
  size?: number
  strokeWidth?: number
  sufficient?: boolean
  className?: string
  animated?: boolean
}

export function DonutChart({
  value,
  total,
  covered,
  label,
  size = 200,
  strokeWidth = 20,
  sufficient = true,
  className,
  animated = true,
}: DonutChartProps) {
  const [animatedValue, setAnimatedValue] = React.useState(animated ? 0 : value)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animatedValue / 100) * circumference

  React.useEffect(() => {
    if (animated) {
      const duration = 1000 // 1 second
      const steps = 60
      const increment = value / steps
      let current = 0
      const timer = setInterval(() => {
        current += increment
        if (current >= value) {
          setAnimatedValue(value)
          clearInterval(timer)
        } else {
          setAnimatedValue(current)
        }
      }, duration / steps)
      return () => clearInterval(timer)
    }
  }, [value, animated])

  const color = sufficient ? "var(--success)" : "var(--error)"
  const gapColor = "var(--gray-200)"

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={gapColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-[var(--transition-normal)] [transition-timing-function:var(--ease-out)]"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold" style={{ color }}>
            {Math.round(animatedValue)}%
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {label}
          </div>
        </div>
      </div>
      {/* Labels */}
      <div className="mt-4 text-center space-y-1">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Covered: <span className="font-semibold text-success">₹{formatCurrency(covered)}</span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Total: <span className="font-semibold">₹{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  )
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(1)}Cr`
  } else if (amount >= 100000) {
    return `${(amount / 100000).toFixed(1)}L`
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`
  }
  return amount.toString()
}

