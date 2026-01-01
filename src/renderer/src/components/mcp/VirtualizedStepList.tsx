// src/renderer/src/components/mcp/VirtualizedStepList.tsx
// Phase 6.3: Virtualized step list for performance with many tool calls
// Uses windowed rendering for conversations with 20+ tool calls

import {
  memo,
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
  type CSSProperties
} from 'react'
import { cn } from '../../lib/utils'
import type { ToolStep, ToolApprovalCallbacks } from './types'
import { ToolStepItem } from './ToolStepItem'
import { InlineToolCallV2 } from './InlineToolCallV2'
import { ThoughtProcessSection } from './ThoughtProcessSection'

interface VirtualizedStepListProps extends ToolApprovalCallbacks {
  /** Steps to render */
  steps: ToolStep[]
  /** Estimated height per collapsed step in pixels */
  itemHeight?: number
  /** Extra items to render above/below viewport */
  overscan?: number
  /** Currently expanded step ID */
  expandedId: string | null
  /** Toggle step expansion */
  onToggleStep: (stepId: string) => void
  /** Get focused state for a step */
  isFocused: (stepId: string) => boolean
  /** Get tabIndex for a step */
  getTabIndex: (stepId: string) => number
  /** Height of the container */
  containerHeight?: number
  /** Additional CSS classes */
  className?: string
}

/** Threshold above which virtualization kicks in */
const VIRTUALIZATION_THRESHOLD = 20

/** Default item height estimate */
const DEFAULT_ITEM_HEIGHT = 36

/** Expanded item height estimate */
const EXPANDED_ITEM_HEIGHT = 200

/**
 * Virtualized step list for rendering large numbers of tool calls
 * 
 * Uses windowed rendering with dynamic height adjustments for expanded items.
 * Only renders items visible in the viewport plus overscan.
 * 
 * Falls back to regular rendering for < 20 items.
 * 
 * @example
 * ```tsx
 * <VirtualizedStepList
 *   steps={steps}
 *   expandedId={expandedId}
 *   onToggleStep={toggleStep}
 *   isFocused={isFocused}
 *   getTabIndex={getTabIndex}
 *   containerHeight={400}
 *   onApprove={handleApprove}
 * />
 * ```
 */
export const VirtualizedStepList = memo(function VirtualizedStepList({
  steps,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  overscan = 3,
  expandedId,
  onToggleStep,
  isFocused,
  getTabIndex,
  containerHeight = 400,
  className,
  onApprove,
  onAlwaysApprove,
  onReject
}: VirtualizedStepListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  
  // Track measured heights for expanded items
  const measuredHeights = useRef<Map<string, number>>(new Map())
  
  // Calculate heights for each item
  const itemHeights = useMemo(() => {
    return steps.map(step => {
      // Use measured height if available
      const measured = measuredHeights.current.get(step.id)
      if (measured) return measured
      
      // Estimate: expanded items are taller
      return step.id === expandedId ? EXPANDED_ITEM_HEIGHT : itemHeight
    })
  }, [steps, expandedId, itemHeight])
  
  // Calculate cumulative offsets
  const offsets = useMemo(() => {
    const result: number[] = [0]
    for (let i = 0; i < itemHeights.length; i++) {
      result.push(result[i] + itemHeights[i])
    }
    return result
  }, [itemHeights])
  
  // Total height of all items
  const totalHeight = offsets[offsets.length - 1] || 0
  
  // Find visible range based on scroll position
  const { startIndex, endIndex } = useMemo(() => {
    // Binary search for start index
    let start = 0
    let end = offsets.length - 1
    
    while (start < end) {
      const mid = Math.floor((start + end) / 2)
      if (offsets[mid] < scrollTop) {
        start = mid + 1
      } else {
        end = mid
      }
    }
    
    const visibleStart = Math.max(0, start - 1 - overscan)
    
    // Find end index
    const viewportEnd = scrollTop + containerHeight
    let visibleEnd = visibleStart
    
    while (visibleEnd < steps.length && offsets[visibleEnd] < viewportEnd) {
      visibleEnd++
    }
    
    return {
      startIndex: visibleStart,
      endIndex: Math.min(steps.length, visibleEnd + overscan)
    }
  }, [scrollTop, containerHeight, offsets, steps.length, overscan])
  
  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])
  
  // Scroll to expanded item when it changes
  useEffect(() => {
    if (!expandedId || !containerRef.current) return
    
    const index = steps.findIndex(s => s.id === expandedId)
    if (index === -1) return
    
    const itemTop = offsets[index]
    const itemBottom = offsets[index + 1]
    const viewportTop = scrollTop
    const viewportBottom = scrollTop + containerHeight
    
    // Scroll into view if needed
    if (itemTop < viewportTop) {
      containerRef.current.scrollTo({ top: itemTop, behavior: 'smooth' })
    } else if (itemBottom > viewportBottom) {
      containerRef.current.scrollTo({ 
        top: itemBottom - containerHeight, 
        behavior: 'smooth' 
      })
    }
  }, [expandedId, steps, offsets, scrollTop, containerHeight])

  // Phase 7: Clean up stale height measurements when steps are removed
  // Prevents unbounded memory growth in long-running agent sessions
  useEffect(() => {
    const currentStepIds = new Set(steps.map(s => s.id))
    
    // Remove measurements for steps no longer in the list
    let cleanedCount = 0
    measuredHeights.current.forEach((_, stepId) => {
      if (!currentStepIds.has(stepId)) {
        measuredHeights.current.delete(stepId)
        cleanedCount++
      }
    })
    
    if (cleanedCount > 0) {
      console.debug(`[VirtualizedStepList] Cleaned ${cleanedCount} stale height measurements`)
    }
  }, [steps])

  // Phase 7: Clear all measurements on unmount to prevent memory retention
  useEffect(() => {
    return () => {
      measuredHeights.current.clear()
    }
  }, [])
  
  // Measure item height after render
  const measureItem = useCallback((stepId: string, height: number) => {
    const current = measuredHeights.current.get(stepId)
    // Only update if the height changed by more than 1px (avoid floating-point noise)
    if (current === undefined || Math.abs(current - height) > 1) {
      measuredHeights.current.set(stepId, height)
      // Use a microtask to batch potential multiple measurements
      queueMicrotask(() => {
        setScrollTop(s => s) // Force layout recalculation
      })
    }
  }, [])
  
  // For small lists, render directly without virtualization
  if (steps.length < VIRTUALIZATION_THRESHOLD) {
    return (
      <div className={cn('space-y-0.5', className)}>
        {steps.map(step => (
          <StepRenderer
            key={step.id}
            step={step}
            isExpanded={step.id === expandedId}
            isFocused={isFocused(step.id)}
            tabIndex={getTabIndex(step.id)}
            onToggleExpand={() => onToggleStep(step.id)}
            onApprove={onApprove}
            onAlwaysApprove={onAlwaysApprove}
            onReject={onReject}
          />
        ))}
      </div>
    )
  }
  
  // Virtualized rendering
  const visibleSteps = steps.slice(startIndex, endIndex)
  
  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
      role="list"
      aria-label={`Tool steps (${steps.length} total, showing ${startIndex + 1}-${endIndex})`}
    >
      {/* Spacer for items above viewport */}
      <div style={{ height: offsets[startIndex] }} aria-hidden="true" />
      
      {/* Visible items */}
      {visibleSteps.map((step, relativeIndex) => {
        const absoluteIndex = startIndex + relativeIndex
        const style: CSSProperties = {
          minHeight: itemHeights[absoluteIndex]
        }
        
        return (
          <MeasuredStepWrapper
            key={step.id}
            stepId={step.id}
            style={style}
            onMeasure={measureItem}
          >
            <StepRenderer
              step={step}
              isExpanded={step.id === expandedId}
              isFocused={isFocused(step.id)}
              tabIndex={getTabIndex(step.id)}
              onToggleExpand={() => onToggleStep(step.id)}
              onApprove={onApprove}
              onAlwaysApprove={onAlwaysApprove}
              onReject={onReject}
            />
          </MeasuredStepWrapper>
        )
      })}
      
      {/* Spacer for items below viewport */}
      <div 
        style={{ height: totalHeight - offsets[endIndex] }} 
        aria-hidden="true" 
      />
    </div>
  )
})

/**
 * Wrapper that measures its rendered height
 */
const MeasuredStepWrapper = memo(function MeasuredStepWrapper({
  stepId,
  style,
  onMeasure,
  children
}: {
  stepId: string
  style: CSSProperties
  onMeasure: (id: string, height: number) => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const lastHeight = useRef<number | null>(null)
  
  // Measure height only on mount and when stepId changes
  // Use ResizeObserver for dynamic height changes instead of running every render
  useEffect(() => {
    if (!ref.current) return
    
    const measureHeight = () => {
      if (ref.current) {
        const height = ref.current.getBoundingClientRect().height
        // Only call onMeasure if height actually changed
        if (lastHeight.current !== height) {
          lastHeight.current = height
          onMeasure(stepId, height)
        }
      }
    }
    
    // Initial measurement
    measureHeight()
    
    // Watch for resize changes
    const resizeObserver = new ResizeObserver(measureHeight)
    resizeObserver.observe(ref.current)
    
    return () => {
      resizeObserver.disconnect()
    }
  }, [stepId, onMeasure])
  
  return (
    <div ref={ref} style={style} role="listitem">
      {children}
    </div>
  )
})

/**
 * Renders the appropriate component based on step type
 */
const StepRenderer = memo(function StepRenderer({
  step,
  isExpanded,
  isFocused,
  tabIndex,
  onToggleExpand,
  onApprove,
  onAlwaysApprove,
  onReject
}: {
  step: ToolStep
  isExpanded: boolean
  isFocused: boolean
  tabIndex: number
  onToggleExpand: () => void
  onApprove?: ToolApprovalCallbacks['onApprove']
  onAlwaysApprove?: ToolApprovalCallbacks['onAlwaysApprove']
  onReject?: ToolApprovalCallbacks['onReject']
}) {
  switch (step.type) {
    case 'tool_call':
      return step.toolCall ? (
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
          isExpanded={isExpanded}
          isFocused={isFocused}
          tabIndex={tabIndex}
          onToggleExpand={onToggleExpand}
          onApprove={onApprove}
          onAlwaysApprove={onAlwaysApprove}
          onReject={onReject}
        />
      ) : null

    case 'thought_process':
      return (
        <ThoughtProcessSection
          content={step.content}
          isExpanded={isExpanded}
          isFocused={isFocused}
          tabIndex={tabIndex}
          onToggleExpand={onToggleExpand}
        />
      )

    case 'thinking':
    case 'verification':
    default:
      return (
        <ToolStepItem
          step={step}
          isExpanded={isExpanded}
          isFocused={isFocused}
          tabIndex={tabIndex}
          onToggleExpand={onToggleExpand}
        />
      )
  }
})

export default VirtualizedStepList
