// src/renderer/src/components/mcp/MemoryIndicator.tsx
// Visual indicator for memory loading and usage status

import { Brain, Loader2, Check, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export type MemoryStatus = 'idle' | 'loading' | 'loaded' | 'empty' | 'error'

interface MemoryIndicatorProps {
  status: MemoryStatus
  itemCount?: number
  className?: string
  compact?: boolean
}

/**
 * Visual indicator showing memory loading and usage status
 * Displays in the chat header or input area
 */
export function MemoryIndicator({
  status,
  itemCount = 0,
  className,
  compact = false
}: MemoryIndicatorProps) {
  // Don't show anything when idle
  if (status === 'idle') return null

  const statusConfig = {
    loading: {
      icon: Loader2,
      iconClass: 'animate-spin text-violet-400',
      bgClass: 'bg-violet-500/10 border-violet-500/20',
      textClass: 'text-violet-400',
      label: 'Loading memory...',
      shortLabel: 'Loading...'
    },
    loaded: {
      icon: Brain,
      iconClass: 'text-violet-400',
      bgClass: 'bg-violet-500/10 border-violet-500/20',
      textClass: 'text-violet-400',
      label: `Memory active (${itemCount} items)`,
      shortLabel: `${itemCount} memories`
    },
    empty: {
      icon: Brain,
      iconClass: 'text-text-muted',
      bgClass: 'bg-secondary/50 border-secondary',
      textClass: 'text-text-muted',
      label: 'No memories stored',
      shortLabel: 'No memories'
    },
    error: {
      icon: AlertCircle,
      iconClass: 'text-amber-400',
      bgClass: 'bg-amber-500/10 border-amber-500/20',
      textClass: 'text-amber-400',
      label: 'Memory unavailable',
      shortLabel: 'Unavailable'
    }
  }

  const config = statusConfig[status]
  const Icon = config.icon

  if (compact) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full',
          'border text-xs font-medium',
          'animate-in fade-in slide-in-from-bottom-2 duration-200',
          config.bgClass,
          className
        )}
        title={config.label}
      >
        <Icon size={12} className={config.iconClass} />
        <span className={config.textClass}>{config.shortLabel}</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg',
        'border text-sm',
        'animate-in fade-in slide-in-from-top-2 duration-200',
        config.bgClass,
        className
      )}
    >
      <Icon size={16} className={config.iconClass} />
      <span className={config.textClass}>{config.label}</span>
      {status === 'loaded' && (
        <Check size={14} className="text-green-400 ml-1" />
      )}
    </div>
  )
}

/**
 * Inline memory badge for use in message headers or compact spaces
 */
export function MemoryBadge({
  active,
  className
}: {
  active: boolean
  className?: string
}) {
  if (!active) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded',
        'bg-violet-500/10 text-violet-400 text-xs',
        className
      )}
      title="Memory context loaded"
    >
      <Brain size={10} />
      <span>Memory</span>
    </span>
  )
}

export default MemoryIndicator
