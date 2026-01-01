// src/renderer/src/components/mcp/ToolStepGroup.tsx
// Phase 6: Enhanced with keyboard navigation and accessibility
// Container component for grouped tool steps with accordion behavior

import { memo, useMemo, useRef, useCallback } from 'react'
import { cn } from '../../lib/utils'
import { useStepKeyboardNav } from '../../hooks/useStepKeyboardNav'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import type { ToolStep, ToolApprovalCallbacks } from './types'
import { ToolStepGroupProvider, useToolStepGroup } from './ToolStepGroupContext'
import { StepMasterToggle } from './StepMasterToggle'
import { ToolStepItem } from './ToolStepItem'
import { InlineToolCallV2 } from './InlineToolCallV2'
import { ThoughtProcessSection } from './ThoughtProcessSection'
import {
  StepAnnouncer,
  formatStatusAnnouncement
} from './StepAnnouncer'

interface ToolStepGroupProps extends ToolApprovalCallbacks {
  /** Unique identifier for this group */
  groupId: string
  /** Steps to display in this group */
  steps: ToolStep[]
  /** Initial visibility state */
  initialVisible?: boolean
  /** Initial expanded step ID */
  initialExpandedId?: string | null
  /** Additional CSS classes */
  className?: string
}

/**
 * Inner content component that uses the context
 */
const ToolStepGroupContent = memo(function ToolStepGroupContent({
  steps,
  onApprove,
  onAlwaysApprove,
  onReject
}: Pick<ToolStepGroupProps, 'steps' | 'onApprove' | 'onAlwaysApprove' | 'onReject'>) {
  const { 
    isGroupVisible, 
    toggleGroupVisibility, 
    toggleStep, 
    isExpanded, 
    stepCount,
    expandedStepId
  } = useToolStepGroup()
  
  // Refs for scrolling steps into view
  const stepRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
  
  // Reduced motion preference
  const prefersReducedMotion = useReducedMotion()
  
  // Get step IDs for keyboard navigation
  const stepIds = useMemo(() => steps.map(s => s.id), [steps])
  
  // Handle focus step - scroll into view
  const handleFocusStep = useCallback((stepId: string) => {
    const element = stepRefsMap.current.get(stepId)
    if (element) {
      element.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'nearest'
      })
    }
  }, [prefersReducedMotion])
  
  // Keyboard navigation hook
  const {
    isFocused,
    getTabIndex,
    handleKeyDown,
    containerRef
  } = useStepKeyboardNav({
    stepIds,
    expandedId: expandedStepId,
    onExpandStep: (id) => {
      if (id) {
        toggleStep(id)
      } else if (expandedStepId) {
        toggleStep(expandedStepId)
      }
    },
    onFocusStep: handleFocusStep,
    isGroupVisible,
    onToggleGroupVisibility: toggleGroupVisibility
  })
  
  // Generate announcement message for status changes
  const announcement = useMemo(() => {
    // Find any pending or recently changed tool calls
    for (const step of steps) {
      if (step.type === 'tool_call' && step.toolCall) {
        if (step.toolCall.status === 'pending' || 
            step.toolCall.status === 'executing' ||
            step.toolCall.status === 'completed' ||
            step.toolCall.status === 'error') {
          return formatStatusAnnouncement(
            step.toolCall.name,
            step.toolCall.status,
            step.toolCall.error?.slice(0, 50)
          )
        }
      }
    }
    return ''
  }, [steps])
  
  // Get animation delay for stagger effect
  const getAnimationDelay = useCallback((index: number): string => {
    if (prefersReducedMotion) return '0ms'
    return `${index * 30}ms`
  }, [prefersReducedMotion])

  return (
    <div 
      ref={containerRef}
      className="space-y-0.5"
      role="region"
      aria-label={`Tool execution steps (${stepCount} steps)`}
      onKeyDown={handleKeyDown}
    >
      {/* Screen reader announcements */}
      <StepAnnouncer message={announcement} />
      
      {/* Master toggle header */}
      <StepMasterToggle
        isVisible={isGroupVisible}
        onToggle={toggleGroupVisibility}
        stepCount={stepCount}
      />

      {/* Steps list with visibility animation */}
      <div
        className={cn(
          'grid',
          !prefersReducedMotion && 'transition-all duration-200 ease-out',
          isGroupVisible
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        )}
        aria-hidden={!isGroupVisible}
      >
        <div className="overflow-hidden">
          <div 
            className="space-y-0.5 pb-2"
            role="list"
            aria-label="Tool steps"
          >
            {steps.map((step, index) => {
              const stepExpanded = isExpanded(step.id)
              const stepFocused = isFocused(step.id)
              const tabIndex = getTabIndex(step.id)
              const handleToggle = () => toggleStep(step.id)
              
              // Stagger animation styles
              const animationStyle = {
                animationDelay: getAnimationDelay(index)
              }
              
              const animationClass = cn(
                isGroupVisible && !prefersReducedMotion && 'animate-in fade-in slide-in-from-left-2',
                prefersReducedMotion && 'animate-none'
              )

              // Render based on step type
              switch (step.type) {
                case 'tool_call':
                  return step.toolCall ? (
                    <div
                      key={step.id}
                      ref={(el) => {
                        if (el) stepRefsMap.current.set(step.id, el)
                        else stepRefsMap.current.delete(step.id)
                      }}
                      role="listitem"
                      style={animationStyle}
                      className={animationClass}
                    >
                      <InlineToolCallV2
                        id={step.id}
                        toolName={step.toolCall.name}
                        serverName={step.toolCall.serverName}
                        args={step.toolCall.args}
                        status={step.toolCall.status}
                        result={step.toolCall.result}
                        error={step.toolCall.error}
                        duration={step.toolCall.duration}
                        autoApproved={step.toolCall.autoApproved}
                        explanation={step.toolCall.explanation}
                        riskLevel={step.toolCall.riskLevel}
                        isExpanded={stepExpanded}
                        isFocused={stepFocused}
                        tabIndex={tabIndex}
                        onToggleExpand={handleToggle}
                        onApprove={onApprove}
                        onAlwaysApprove={onAlwaysApprove}
                        onReject={onReject}
                      />
                    </div>
                  ) : null

                case 'thought_process':
                  return (
                    <div
                      key={step.id}
                      ref={(el) => {
                        if (el) stepRefsMap.current.set(step.id, el)
                        else stepRefsMap.current.delete(step.id)
                      }}
                      role="listitem"
                      style={animationStyle}
                      className={animationClass}
                    >
                      <ThoughtProcessSection
                        content={step.content}
                        isExpanded={stepExpanded}
                        isFocused={stepFocused}
                        tabIndex={tabIndex}
                        onToggleExpand={handleToggle}
                      />
                    </div>
                  )

                case 'thinking':
                case 'verification':
                default:
                  return (
                    <div
                      key={step.id}
                      ref={(el) => {
                        if (el) stepRefsMap.current.set(step.id, el)
                        else stepRefsMap.current.delete(step.id)
                      }}
                      role="listitem"
                      style={animationStyle}
                      className={animationClass}
                    >
                      <ToolStepItem
                        step={step}
                        isExpanded={stepExpanded}
                        isFocused={stepFocused}
                        tabIndex={tabIndex}
                        onToggleExpand={handleToggle}
                      />
                    </div>
                  )
              }
            })}
          </div>
        </div>
      </div>
    </div>
  )
})


/**
 * Tool Step Group - Container with exclusive accordion behavior
 * 
 * Phase 6 enhancements:
 * - Full keyboard navigation (Arrow keys, Enter, Escape, Home, End)
 * - WCAG 2.1 AA compliant ARIA attributes
 * - Screen reader announcements for status changes
 * - Reduced motion support
 * - Stagger animations for step reveal
 * 
 * Usage:
 * ```tsx
 * <ToolStepGroup
 *   groupId="group-1"
 *   steps={[
 *     { id: 's1', type: 'thinking', content: 'Planning...', timestamp: Date.now() },
 *     { id: 's2', type: 'tool_call', content: '', timestamp: Date.now(), toolCall: {...} },
 *     { id: 's3', type: 'verification', content: 'Verified...', timestamp: Date.now() }
 *   ]}
 *   onApprove={(id, args) => handleApprove(id, args)}
 *   onReject={(id) => handleReject(id)}
 * />
 * ```
 */
export const ToolStepGroup = memo(function ToolStepGroup({
  groupId,
  steps,
  initialVisible = true,
  initialExpandedId = null,
  className,
  onApprove,
  onAlwaysApprove,
  onReject
}: ToolStepGroupProps) {
  // Memoize step count
  const stepCount = useMemo(() => steps.length, [steps.length])

  // Auto-expand pending tool calls
  const effectiveInitialExpanded = useMemo(() => {
    if (initialExpandedId) return initialExpandedId
    // Find first pending tool call and expand it
    const pendingStep = steps.find(
      (s) => s.type === 'tool_call' && s.toolCall?.status === 'pending'
    )
    return pendingStep?.id ?? null
  }, [initialExpandedId, steps])

  return (
    <div
      className={cn(
        'rounded-lg border border-white/10 bg-secondary/50',
        'overflow-hidden',
        className
      )}
      data-group-id={groupId}
    >
      <ToolStepGroupProvider
        stepCount={stepCount}
        initialExpandedId={effectiveInitialExpanded}
        initialVisible={initialVisible}
      >
        <ToolStepGroupContent
          steps={steps}
          onApprove={onApprove}
          onAlwaysApprove={onAlwaysApprove}
          onReject={onReject}
        />
      </ToolStepGroupProvider>
    </div>
  )
})

export default ToolStepGroup
