/**
 * Color coding utilities for data visualization
 */

export function getCoverageColor(value: number): string {
  if (value >= 70) return "var(--success)" // Green - sufficient
  if (value >= 30) return "var(--warning)" // Amber - caution
  return "var(--error)" // Red - insufficient
}

export function getCoverageStatus(value: number): {
  label: string
  color: string
  icon: "check" | "warning" | "error"
} {
  if (value >= 70) {
    return {
      label: "Sufficient",
      color: "var(--success)",
      icon: "check",
    }
  }
  if (value >= 30) {
    return {
      label: "Caution",
      color: "var(--warning)",
      icon: "warning",
    }
  }
  return {
    label: "Insufficient",
    color: "var(--error)",
    icon: "error",
  }
}

export function getCategoryColor(category: "covered" | "partial" | "not-covered" | "neutral"): string {
  const colors = {
    covered: "var(--success)",
    "not-covered": "var(--error)",
    partial: "var(--warning)",
    neutral: "var(--gray-500)",
  }
  return colors[category]
}

export function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`
  } else if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`
  }
  return `₹${amount}`
}

