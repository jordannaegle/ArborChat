// src/renderer/src/components/mcp/toolCallConfig.ts
// Phase 7: Shared configuration for tool call components

import type { ReactNode } from 'react'
import { Clock, Loader2, CheckCircle2, X } from 'lucide-react'
import type { ToolCallStatus, RiskLevel } from './types'
import { createElement } from 'react'

/**
 * Status display configuration
 */
export interface StatusConfig {
  borderColor: string
  bgColor: string
  label: string
}

/**
 * Risk styling configuration
 */
export interface RiskConfig {
  className: string
  label: string
}

/**
 * Status configuration for each tool call state (without icons to avoid JSX in object)
 */
export const STATUS_CONFIG: Record<ToolCallStatus, StatusConfig> = {
  pending: {
    borderColor: 'border-amber-500/40',
    bgColor: 'bg-amber-500/5',
    label: 'Pending approval'
  },
  approved: {
    borderColor: 'border-blue-500/40',
    bgColor: 'bg-blue-500/5',
    label: 'Approved, preparing'
  },
  executing: {
    borderColor: 'border-blue-500/40',
    bgColor: 'bg-blue-500/5',
    label: 'Executing'
  },
  completed: {
    borderColor: 'border-green-500/30',
    bgColor: 'bg-green-500/5',
    label: 'Completed successfully'
  },
  error: {
    borderColor: 'border-red-500/30',
    bgColor: 'bg-red-500/5',
    label: 'Failed with error'
  },
  rejected: {
    borderColor: 'border-gray-500/30',
    bgColor: 'bg-gray-500/5',
    label: 'Rejected by user'
  }
}

/**
 * Get status icon component (avoids JSX in config object)
 */
export function getStatusIcon(status: ToolCallStatus, size: number = 14): ReactNode {
  const iconProps = { size }
  
  switch (status) {
    case 'pending':
      return createElement(Clock, { ...iconProps, className: 'text-amber-400' })
    case 'approved':
    case 'executing':
      return createElement(Loader2, { ...iconProps, className: 'text-blue-400 animate-spin' })
    case 'completed':
      return createElement(CheckCircle2, { ...iconProps, className: 'text-green-400' })
    case 'error':
      return createElement(X, { ...iconProps, className: 'text-red-400' })
    case 'rejected':
      return createElement(X, { ...iconProps, className: 'text-gray-400' })
    default:
      return null
  }
}

/**
 * Risk level styling
 */
export const RISK_STYLES: Record<RiskLevel, RiskConfig> = {
  safe: {
    className: 'bg-green-500/20 text-green-400',
    label: 'Safe operation'
  },
  moderate: {
    className: 'bg-yellow-500/20 text-yellow-400',
    label: 'Moderate risk'
  },
  dangerous: {
    className: 'bg-red-500/20 text-red-400',
    label: 'Dangerous operation'
  }
}

/**
 * Check if content is long enough to need truncation
 */
export function isLongContent(content: string | undefined, threshold: number = 500): boolean {
  return (content?.length || 0) > threshold
}

/**
 * Format result for display
 */
export function formatResult(result: unknown): string {
  if (result === undefined || result === null) return ''
  return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
}

/**
 * Get summarized args for collapsed view
 */
export function getArgsSummary(args: Record<string, unknown>, maxLength: number = 40): string {
  const entries = Object.entries(args)
  if (entries.length === 0) return 'no arguments'

  const summaryParts: string[] = []
  for (const [key, value] of entries.slice(0, 2)) {
    const valStr = typeof value === 'string'
      ? (value.length > maxLength ? value.slice(0, maxLength) + '...' : value)
      : JSON.stringify(value).slice(0, maxLength)
    summaryParts.push(`${key}: ${valStr}`)
  }
  
  if (entries.length > 2) {
    summaryParts.push(`+${entries.length - 2} more`)
  }
  
  return summaryParts.join(', ')
}
