import * as React from "react"
import { cn } from "@/lib/utils"

export interface BarChartData {
  label: string
  hospitalCost: number
  policyCovers: number
  yourPay: number
}

export interface BarChartProps {
  data: BarChartData[]
  className?: string
  showTooltip?: boolean
}

export function BarChart({ data, className, showTooltip = true }: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)

  const maxValue = Math.max(
    ...data.map((d) => d.hospitalCost)
  )

  return (
    <div className={cn("space-y-4", className)}>
      {data.map((item, index) => {
        const hospitalPercent = (item.hospitalCost / maxValue) * 100
        const policyPercent = (item.policyCovers / maxValue) * 100
        const yourPayPercent = (item.yourPay / maxValue) * 100

        return (
          <div key={index} className="space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {item.label}
            </div>
            <div
              className="relative h-12 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Hospital cost (gray background) */}
              <div
                className="absolute inset-0 bg-gray-300 dark:bg-gray-600"
                style={{ width: `${hospitalPercent}%` }}
              />
              {/* Policy covers (green) */}
              <div
                className="absolute inset-0 bg-success"
                style={{ width: `${policyPercent}%` }}
              />
              {/* Your pay (red, right side) */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-error"
                style={{ width: `${yourPayPercent}%` }}
              />
              {/* Labels */}
              <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-semibold text-white">
                <span>₹{formatCurrency(item.policyCovers)}</span>
                <span>₹{formatCurrency(item.yourPay)}</span>
              </div>
              {/* Tooltip */}
              {showTooltip && hoveredIndex === index && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg z-10 whitespace-nowrap">
                  <div>Hospital: ₹{formatCurrency(item.hospitalCost)}</div>
                  <div>Policy Covers: ₹{formatCurrency(item.policyCovers)}</div>
                  <div>You Pay: ₹{formatCurrency(item.yourPay)}</div>
                </div>
              )}
            </div>
          </div>
        )
      })}
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

