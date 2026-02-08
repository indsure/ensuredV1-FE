import * as React from "react"
import { cn } from "@/lib/utils"

export interface TimelineProps {
  startDate: Date
  endDate: Date
  currentDate: Date
  label: string
  status: "complete" | "pending"
  onDateChange?: (date: Date) => void
  className?: string
}

export function Timeline({
  startDate,
  endDate,
  currentDate,
  label,
  status,
  onDateChange,
  className,
}: TimelineProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const timelineRef = React.useRef<HTMLDivElement>(null)

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const currentDays = Math.ceil((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const progress = Math.min(100, Math.max(0, (currentDays / totalDays) * 100))
  const remainingDays = Math.max(0, totalDays - currentDays)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (onDateChange) {
      setIsDragging(true)
      updateDate(e)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && onDateChange) {
      updateDate(e)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const updateDate = (e: React.MouseEvent) => {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))
    const days = Math.floor((percent / 100) * totalDays)
    const newDate = new Date(startDate)
    newDate.setDate(newDate.getDate() + days)
    onDateChange?.(newDate)
  }

  const color = status === "complete" ? "var(--success)" : "var(--error)"

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-600 dark:text-gray-400">
          {formatDate(startDate)}
        </div>
        <div className="text-gray-600 dark:text-gray-400">
          {formatDate(endDate)}
        </div>
      </div>
      <div
        ref={timelineRef}
        className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Progress bar */}
        <div
          className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-[var(--transition-normal)]"
          style={{
            width: `${progress}%`,
            backgroundColor: color,
          }}
        />
        {/* Current date indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-4 border-white dark:border-gray-800 shadow-lg cursor-grab active:cursor-grabbing"
          style={{
            left: `${progress}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="font-medium" style={{ color }}>
          {label}
        </div>
        <div className="text-gray-600 dark:text-gray-400">
          {remainingDays > 0 ? `${remainingDays} months remaining` : "Complete"}
        </div>
      </div>
    </div>
  )
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

