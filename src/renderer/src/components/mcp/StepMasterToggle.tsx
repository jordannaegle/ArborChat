// src/renderer/src/components/mcp/StepMasterToggle.tsx
// Master toggle component for step group visibility
// Displays "Hide steps" when visible, "N steps" when collapsed

import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

interface StepMasterToggleProps {
  /** Whether the step group is currently visible */
  isVisible: boolean
  /** Callback to toggle visibility */
  onToggle: () => void
  /** Number of steps in the group */
  stepCount: number
  /** Additional CSS classes */
  className?: string
}

/**
 * Master toggle component that shows/hides entire step group
 * Mirrors Claude Desktop behavior:
 * - "Hide steps" with down chevron when visible
 * - "N steps" with right chevron when collapsed
 */
export function StepMasterToggle({
  isVisible,
  onToggle,
  stepCount,
  className
}: StepMasterToggleProps) {
  // Format step count text
  const stepText = stepCount === 1 ? '1 step' : `${stepCount} steps`

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1.5',
        'px-2 py-1.5',
        'text-xs text-text-muted',
        'hover:text-text-normal',
        'transition-colors duration-150',
        'rounded hover:bg-white/5',
        className
      )}
      aria-expanded={isVisible}
      aria-label={isVisible ? 'Hide steps' : `Show ${stepText}`}
    >
      {/* Chevron with rotation animation */}
      <span
        className={cn(
          'transition-transform duration-200',
          !isVisible && '-rotate-90'
        )}
      >
        {isVisible ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
      </span>

      {/* Toggle text */}
      <span className="select-none">
        {isVisible ? 'Hide steps' : stepText}
      </span>
    </button>
  )
}

export default StepMasterToggle
