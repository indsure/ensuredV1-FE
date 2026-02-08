import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react"

export type ComparisonValue = "best" | "worst" | "average" | "ok"

export interface ComparisonRow {
  policy: string
  values: Record<string, { value: string | number; status: ComparisonValue }>
}

export interface ComparisonTableProps {
  rows: ComparisonRow[]
  columns: string[]
  className?: string
}

export function ComparisonTable({ rows, columns, className }: ComparisonTableProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">
              Policy
            </th>
            {columns.map((col) => (
              <th
                key={col}
                className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <td className="p-4 font-medium text-gray-900 dark:text-gray-100">
                {row.policy}
              </td>
              {columns.map((col) => {
                const cell = row.values[col]
                if (!cell) return <td key={col} className="p-4" />

                const { value, status } = cell
                const statusClasses = {
                  best: "bg-success/10 text-success",
                  worst: "bg-error/10 text-error",
                  average: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
                  ok: "bg-warning/10 text-warning",
                }

                const Icon = {
                  best: CheckCircle2,
                  worst: XCircle,
                  average: null,
                  ok: AlertTriangle,
                }[status]

                return (
                  <td
                    key={col}
                    className={cn("p-4", statusClasses[status])}
                  >
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className="h-4 w-4" />}
                      <span>{value}</span>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

