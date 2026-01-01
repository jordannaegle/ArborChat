// src/renderer/src/components/mcp/AccessibleStepGroup.tsx
// Phase 6.2: Higher-order accessibility wrapper for step groups
// Provides screen reader context and keyboard navigation wrapper

import { memo, useMemo, useCallback, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { useStepKeyboardNav } from '../../hooks/useStepKeyboardNav'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import {
  StepAnnouncer,
  formatStatusAnnouncement,
  formatFocusAnnouncement
} from './StepAnnouncer'
import type { ToolStep } from './types'

interface AccessibleStepGroupProps {
  /** Accessible label for the group */
  groupLabel: string
  /** Array of steps for navigation */
  steps: ToolStep[]
  /** Whether the group content is visible */
  isGroupVisible: boolean
  /** Toggle group visibility */
  onToggleGroupVisibility: () => void
  /** Currently expanded step ID */
  expandedStepId: string | null
  /** Toggle step expansion */
  onToggleStep: (stepId: string) => void
  /** Additional CSS classes */
  className?: string
  /** Child render function with navigation props */
  children: (props: AccessibleStepGroupRenderProps) => ReactNode
}

export interface AccessibleStepGroupRenderProps {
  /** Check if a step is focused */
  isFocused: (stepId: string) => boolean
  /** Get tabIndex for a step */
  getTabIndex: (stepId: string) => number
  /** Handle scroll into view when focusing */
  scrollStepIntoView: (stepId: string) => void
  /** Whether reduced motion is preferred */
  prefersReducedMotion: boolean
  /** Animation delay for stagger effect (0 if reduced motion) */
  getAnimationDelay: (index: number) => string
}

/**
 * Accessibility wrapper for tool step groups
 * 
 * Provides:
 * - ARIA region labeling
 * - Keyboard navigation via useStepKeyboardNav
 * - Live announcements for status changes
 * - Reduced motion support
 * - Stagger animation utilities
 * 
 * @example
 * ```tsx
 * <AccessibleStepGroup
 *   groupLabel="Tool execution steps"
 *   steps={steps}
 *   isGroupVisible={isVisible}
 *   onToggleGroupVisibility={toggleVisible}
 *   expandedStepId={expandedId}
 *   onToggleStep={toggleStep}
 * >
 *   {({ isFocused, getTabIndex }) => (
 *     steps.map(step => (
 *       <ToolStepItem
 *         key={step.id}
 *         isFocused={isFocused(step.id)}
 *         tabIndex={getTabIndex(step.id)}
 *         // ...
 *       />
 *     ))
 *   )}
 * </AccessibleStepGroup>
 * ```
 */
export const AccessibleStepGroup = memo(function AccessibleStepGroup({
  groupLabel,
  steps,
  isGroupVisible,
  onToggleGroupVisibility,
  expandedStepId,
  onToggleStep,
  className,
  children
}: AccessibleStepGroupProps) {
  // Refs for step elements (for scroll into view)
  const stepRefs = useRef<Map<string, HTMLElement>>(new Map())
  
  // Reduced motion preference
  const prefersReducedMotion = useReducedMotion()
  
  // Track current announcement
  const lastAnnouncementRef = useRef('')
  
  // Get step IDs for navigation
  const stepIds = useMemo(() => steps.map(s => s.id), [steps])
  
  // Callback when focus changes - scroll into view
  const handleFocusStep = useCallback((stepId: string) => {
    const element = stepRefs.current.get(stepId)
    if (element) {
      element.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'nearest'
      })
    }
  }, [prefersReducedMotion])
  
  // Keyboard navigation hook
  const {
    focusedStepId,
    handleKeyDown,
    isFocused,
    getTabIndex,
    containerRef
  } = useStepKeyboardNav({
    stepIds,
    expandedId: expandedStepId,
    onExpandStep: (id) => {
      if (id) {
        onToggleStep(id)
      } else if (expandedStepId) {
        onToggleStep(expandedStepId)
      }
    },
    onFocusStep: handleFocusStep,
    isGroupVisible,
    onToggleGroupVisibility
  })
  
  // Generate announcement for current state
  const announcement = useMemo(() => {
    // Check for status changes in tool calls
    for (const step of steps) {
      if (step.type === 'tool_call' && step.toolCall) {
        const toolAnnouncement = formatStatusAnnouncement(
          step.toolCall.name,
          step.toolCall.status,
          step.toolCall.error?.slice(0, 50)
        )
        
        // Only announce if it's new
        if (toolAnnouncement !== lastAnnouncementRef.current) {
          lastAnnouncementRef.current = toolAnnouncement
          return toolAnnouncement
        }
      }
    }
    
    // Announce focus changes
    if (focusedStepId) {
      const focusedStep = steps.find(s => s.id === focusedStepId)
      if (focusedStep) {
        const index = steps.indexOf(focusedStep)
        const focusAnnouncement = formatFocusAnnouncement(
          focusedStep.type,
          focusedStep.content,
          index + 1,
          steps.length
        )
        
        if (focusAnnouncement !== lastAnnouncementRef.current) {
          lastAnnouncementRef.current = focusAnnouncement
          return focusAnnouncement
        }
      }
    }
    
    return ''
  }, [steps, focusedStepId])
  
  // Calculate animation delay (0 if reduced motion)
  const getAnimationDelay = useCallback((index: number): string => {
    if (prefersReducedMotion) return '0ms'
    return `${index * 30}ms`
  }, [prefersReducedMotion])
  
  // Build render props
  const renderProps = useMemo<AccessibleStepGroupRenderProps>(() => ({
    isFocused,
    getTabIndex,
    scrollStepIntoView: handleFocusStep,
    prefersReducedMotion,
    getAnimationDelay
  }), [isFocused, getTabIndex, handleFocusStep, prefersReducedMotion, getAnimationDelay])

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={groupLabel}
      aria-expanded={isGroupVisible}
      onKeyDown={handleKeyDown}
      className={cn('relative', className)}
    >
      {/* Screen reader announcements */}
      <StepAnnouncer message={announcement} />
      
      {/* Description for screen readers */}
      <div id={`${groupLabel.replace(/\s+/g, '-')}-desc`} className="sr-only">
        {steps.length} steps. Use arrow keys to navigate, Enter to expand.
      </div>
      
      {/* Render children with navigation props */}
      {children(renderProps)}
    </div>
  )
})

export default AccessibleStepGroup
