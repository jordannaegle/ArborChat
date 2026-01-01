// src/renderer/src/components/mcp/ToolStepItem.tsx
// Phase 6: Enhanced with keyboard focus states and accessibility
// Individual step item component with expand/collapse support

import { memo, useRef, useEffect, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import type { ToolStep, ToolApprovalCallbacks, AccordionItemProps } from './types'
import { getServerIcon, getServerFromToolName } from '../../lib/serverIcons'

interface ToolStepItemProps extends AccordionItemProps, ToolApprovalCallbacks {
  /** Step data to display */
  step: ToolStep
  /** Content to render when expanded */
  expandedContent?: ReactNode
  /** Whether this step has keyboard focus */
  isFocused?: boolean
  /** Tab index for keyboard navigation */
  tabIndex?: number
}

/**
 * Get display title for a step based on its type
 */
function getStepTitle(step: ToolStep): ReactNode {
  switch (step.type) {
    case 'thinking':
    case 'verification':
      // Truncate long content with ellipsis
      return step.content.length > 50
        ? `${step.content.slice(0, 50)}...`
        : step.content

    case 'tool_call':
      if (step.toolCall) {
        const serverName =
          step.toolCall.serverName || getServerFromToolName(step.toolCall.name)
        const serverIcon = getServerIcon(serverName || 'unknown')

        return (
          <span className="flex items-center gap-2">
            {/* Server abbreviation badge */}
            <span
              className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${serverIcon.color}20`,
                color: serverIcon.color
              }}
            >
              {serverIcon.abbrev}
            </span>
            {/* Tool name */}
            <span className="font-mono text-sm">{step.toolCall.name}</span>
          </span>
        )
      }
      return step.content

    case 'thought_process':
      return 'Thought process'

    default:
      return step.content
  }
}

/**
 * Get ARIA label for screen readers
 */
function getAriaLabel(step: ToolStep, isExpanded: boolean): string {
  const typeLabels: Record<string, string> = {
    thinking: 'Thinking step',
    verification: 'Verification step',
    tool_call: 'Tool call',
    thought_process: 'Thought process'
  }
  
  const typeLabel = typeLabels[step.type] || 'Step'
  const contentPreview = step.content.length > 30 
    ? `${step.content.slice(0, 30)}...` 
    : step.content
    
  const expandState = isExpanded ? 'expanded' : 'collapsed'
  
  if (step.type === 'tool_call' && step.toolCall) {
    return `${typeLabel}: ${step.toolCall.name}, ${expandState}`
  }
  
  return `${typeLabel}: ${contentPreview}, ${expandState}`
}

/**
 * Individual tool step item with expand/collapse behavior
 * 
 * Phase 6 enhancements:
 * - Visual focus ring for keyboard navigation
 * - ARIA labels for screen readers
 * - Reduced motion support
 * - Proper tabIndex for roving focus
 */
export const ToolStepItem = memo(function ToolStepItem({
  step,
  isExpanded,
  onToggleExpand,
  expandedContent,
  isFocused = false,
  tabIndex = 0
}: ToolStepItemProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  
  // Determine if this step shows a bullet indicator
  const showBullet = step.type === 'thinking' ||
    step.type === 'verification' ||
    step.type === 'thought_process'

  // Handle keyboard interaction
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggleExpand()
    }
  }
  
  // Focus the header element when this step becomes focused
  useEffect(() => {
    if (isFocused && headerRef.current) {
      headerRef.current.focus()
    }
  }, [isFocused])

  return (
    <div className="select-none">
      {/* Collapsed header - always visible */}
      <div
        ref={headerRef}
        role="button"
        tabIndex={tabIndex}
        onClick={onToggleExpand}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-controls={`step-content-${step.id}`}
        aria-label={getAriaLabel(step, isExpanded)}
        className={cn(
          'flex items-start gap-2',
          'px-2 py-1.5',
          'cursor-pointer rounded',
          'hover:bg-white/5',
          !prefersReducedMotion && 'transition-colors duration-150',
          // Focus ring for keyboard navigation
          'focus:outline-none',
          isFocused && 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background',
          'focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background'
        )}
      >
        {/* Bullet indicator for thinking/verification steps */}
        {showBullet && (
          <span className="mt-[7px] flex-shrink-0" aria-hidden="true">
            <span className="block w-1.5 h-1.5 rounded-full bg-text-muted" />
          </span>
        )}

        {/* Step title/content */}
        <span
          className={cn(
            'flex-1 min-w-0 text-sm text-text-normal leading-relaxed',
            // Truncate for non-expanded state
            !isExpanded && 'truncate'
          )}
        >
          {getStepTitle(step)}
        </span>

        {/* Expand/collapse chevron */}
        <span
          className={cn(
            'flex-shrink-0 text-text-muted',
            !prefersReducedMotion && 'transition-transform duration-200',
            isExpanded ? 'rotate-0' : '-rotate-90'
          )}
          aria-hidden="true"
        >
          {isExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </span>
      </div>

      {/* Expandable content with animation */}
      <div
        id={`step-content-${step.id}`}
        role="region"
        aria-labelledby={`step-header-${step.id}`}
        className={cn(
          'grid',
          !prefersReducedMotion && 'transition-all duration-200 ease-out',
          isExpanded
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          {/* Indented content area */}
          <div className={cn('pl-6 pr-2 pb-2', showBullet && 'pl-8')}>
            {expandedContent || (
              // Default expanded content for thinking/verification
              <p className="text-sm text-text-muted leading-relaxed">
                {step.content}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-renders
  return (
    prevProps.step.id === nextProps.step.id &&
    prevProps.step.type === nextProps.step.type &&
    prevProps.step.content === nextProps.step.content &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.tabIndex === nextProps.tabIndex
  )
})

export default ToolStepItem
