// src/renderer/src/components/mcp/ThoughtProcessSection.tsx
// Phase 6: Enhanced with keyboard focus states and accessibility
// Component for displaying AI reasoning/thought process

import { memo, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import type { AccordionItemProps } from './types'

interface ThoughtProcessSectionProps extends AccordionItemProps {
  /** Main content/summary text */
  content: string
  /** Optional bullet points for detailed reasoning */
  bulletPoints?: string[]
  /** Optional concluding statement */
  conclusion?: string
  /** Custom title (default: "Thought process") */
  title?: string
  /** Whether this step has keyboard focus */
  isFocused?: boolean
  /** Tab index for keyboard navigation */
  tabIndex?: number
}

/**
 * Thought process section for displaying AI reasoning
 * 
 * Phase 6 enhancements:
 * - Visual focus ring for keyboard navigation
 * - ARIA labels for screen readers
 * - Reduced motion support
 * - Proper tabIndex for roving focus
 */
export const ThoughtProcessSection = memo(function ThoughtProcessSection({
  content,
  bulletPoints,
  conclusion,
  title = 'Thought process',
  isExpanded,
  onToggleExpand,
  isFocused = false,
  tabIndex = 0
}: ThoughtProcessSectionProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  
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

  const ariaLabel = `${title}, ${isExpanded ? 'expanded' : 'collapsed'}`

  return (
    <div className="select-none">
      {/* Header row */}
      <div
        ref={headerRef}
        role="button"
        tabIndex={tabIndex}
        onClick={onToggleExpand}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-label={ariaLabel}
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
        {/* Bullet indicator */}
        <span className="mt-[7px] flex-shrink-0" aria-hidden="true">
          <span className="block w-1.5 h-1.5 rounded-full bg-text-muted" />
        </span>

        {/* Title */}
        <span className="flex-1 text-sm text-text-normal">
          {title}
        </span>

        {/* Chevron */}
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

      {/* Expandable content */}
      <div
        role="region"
        aria-label={`${title} content`}
        className={cn(
          'grid',
          !prefersReducedMotion && 'transition-all duration-200 ease-out',
          isExpanded
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="pl-8 pr-4 pb-3 space-y-3">
            {/* Main content */}
            <p className="text-sm text-text-muted leading-relaxed">
              {content}
            </p>

            {/* Bullet points (if provided) */}
            {bulletPoints && bulletPoints.length > 0 && (
              <ul className="space-y-1.5" aria-label="Reasoning points">
                {bulletPoints.map((point, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-text-muted"
                  >
                    <span className="mt-[7px] flex-shrink-0" aria-hidden="true">
                      <span className="block w-1 h-1 rounded-full bg-text-muted/60" />
                    </span>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Conclusion (if provided) */}
            {conclusion && (
              <p className="text-sm text-text-muted leading-relaxed border-t border-white/5 pt-3">
                {conclusion}
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
    prevProps.content === nextProps.content &&
    prevProps.title === nextProps.title &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.tabIndex === nextProps.tabIndex &&
    prevProps.bulletPoints?.length === nextProps.bulletPoints?.length &&
    prevProps.conclusion === nextProps.conclusion
  )
})

export default ThoughtProcessSection
