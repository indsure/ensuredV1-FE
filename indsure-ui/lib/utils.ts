/**
 * Utility functions for IndSure UI
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in Indian Rupees
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format large numbers with Indian numbering system
 */
export function formatNumber(num: number): string {
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(1)}Cr`;
  } else if (num >= 100000) {
    return `₹${(num / 100000).toFixed(1)}L`;
  } else if (num >= 1000) {
    return `₹${(num / 1000).toFixed(1)}K`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
}

/**
 * Get medal emoji
 */
export function getMedalEmoji(medal: string): string {
  switch (medal) {
    case 'WINNER':
      return '🥇';
    case 'RUNNER_UP':
      return '🥈';
    case 'BUDGET_PICK':
      return '🥉';
    case 'NOT_RECOMMENDED':
      return '📋';
    default:
      return '';
  }
}

/**
 * Get confidence badge color
 */
export function getConfidenceBadgeColor(confidence: string): string {
  switch (confidence) {
    case 'HIGH':
      return 'bg-success/10 text-success border-success/20';
    case 'MEDIUM':
      return 'bg-warning/10 text-warning border-warning/20';
    case 'LOW':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'UNAVAILABLE':
      return 'bg-slate-50 text-slate-400 border-slate-100';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

/**
 * Get dimension display name
 */
export function getDimensionDisplayName(dimensionId: string): string {
  const names: Record<string, string> = {
    coverage_adequacy: 'Coverage Adequacy',
    cost: 'Cost & Value',
    waiting_periods: 'Waiting Periods',
    exclusions_sublimits: 'Exclusions & Sub-limits',
    maternity_family_fit: 'Maternity & Family',
    insurer_claim_performance: 'Claim Performance',
    insurer_complaint_rate: 'Complaint Rate',
    insurer_financial_health: 'Financial Health',
    network_strength: 'Network Strength',
    renewal_terms: 'Renewal Terms',
  };
  return names[dimensionId] || dimensionId;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate PDF file
 */
export function validatePDFFile(file: File): { valid: boolean; error?: string } {
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'Only PDF files are allowed' };
  }
  
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }
  
  return { valid: true };
}

/**
 * Get score color class
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-teal-primary';
  if (score >= 40) return 'text-warning';
  return 'text-danger';
}

/**
 * Get score background color
 */
export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-success/10';
  if (score >= 60) return 'bg-teal-50';
  if (score >= 40) return 'bg-warning/10';
  return 'bg-danger/10';
}

/**
 * Sleep utility for demos
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
