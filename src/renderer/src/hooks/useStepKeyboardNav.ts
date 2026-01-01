// src/renderer/src/hooks/useStepKeyboardNav.ts
// Phase 6.1: Keyboard navigation hook for tool step groups
// Implements WCAG 2.1 AA compliant keyboard navigation

import { useState, useCallback, useRef, useEffect, type RefObject } from 'react'

export interface UseStepKeyboardNavOptions {
  /** Array of step IDs in display order */
  stepIds: string[]
  /** Currently expanded step ID (null = none) */
  expandedId: string | null
  /** Callback to expand/collapse a step */
  onExpandStep: (id: string | null) => void
  /** Callback when focus changes (for scroll into view) */
  onFocusStep?: (id: string) => void
  /** Whether the entire group is visible */
  isGroupVisible: boolean
  /** Callback to toggle group visibility */
  onToggleGroupVisibility: () => void
}

export interface UseStepKeyboardNavReturn {
  /** Currently focused step ID */
  focusedStepId: string | null
  /** Key down handler for the container */
  handleKeyDown: (e: React.KeyboardEvent) => void
  /** Programmatically set focused step */
  setFocusedStep: (id: string | null) => void
  /** Get tabIndex for a step (-1 or 0) */
  getTabIndex: (stepId: string) => number
  /** Whether a step is the focused one */
  isFocused: (stepId: string) => boolean
  /** Container ref for focus management */
  containerRef: RefObject<HTMLDivElement | null>
}

/**
 * Hook for keyboard navigation within tool step groups
 * 
 * Keyboard mappings:
 * - ArrowUp/ArrowDown: Navigate between steps
 * - Enter/Space: Toggle expansion of focused step
 * - Escape: Collapse current step, then collapse group
 * - Home/End: Jump to first/last step
 * - Tab: Standard focus movement
 * 
 * @example
 * ```tsx
 * const { focusedStepId, handleKeyDown, getTabIndex } = useStepKeyboardNav({
 *   stepIds: ['step-1', 'step-2', 'step-3'],
 *   expandedId: 'step-2',
 *   onExpandStep: (id) => setExpandedId(id),
 *   isGroupVisible: true,
 *   onToggleGroupVisibility: () => setGroupVisible(v => !v)
 * })
 * ```
 */
export function useStepKeyboardNav(
  options: UseStepKeyboardNavOptions
): UseStepKeyboardNavReturn {
  const {
    stepIds,
    expandedId,
    onExpandStep,
    onFocusStep,
    isGroupVisible,
    onToggleGroupVisibility
  } = options

  const [focusedStepId, setFocusedStepIdState] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  
  // Track if we've entered the group via keyboard
  const hasEnteredGroup = useRef(false)

  // Set focused step with optional scroll callback
  const setFocusedStep = useCallback((id: string | null) => {
    setFocusedStepIdState(id)
    if (id && onFocusStep) {
      onFocusStep(id)
    }
  }, [onFocusStep])

  // Get the index of a step ID
  const getStepIndex = useCallback((stepId: string): number => {
    return stepIds.indexOf(stepId)
  }, [stepIds])

  // Navigate to next/previous step
  const navigateStep = useCallback((direction: 'up' | 'down') => {
    if (stepIds.length === 0) return

    const currentIndex = focusedStepId ? getStepIndex(focusedStepId) : -1
    let nextIndex: number

    if (direction === 'down') {
      nextIndex = currentIndex < stepIds.length - 1 ? currentIndex + 1 : 0
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : stepIds.length - 1
    }

    setFocusedStep(stepIds[nextIndex])
  }, [stepIds, focusedStepId, getStepIndex, setFocusedStep])

  // Jump to first/last step
  const jumpToStep = useCallback((position: 'first' | 'last') => {
    if (stepIds.length === 0) return
    
    const targetId = position === 'first' 
      ? stepIds[0] 
      : stepIds[stepIds.length - 1]
    
    setFocusedStep(targetId)
  }, [stepIds, setFocusedStep])

  // Toggle expansion of focused step
  const toggleFocusedStep = useCallback(() => {
    if (!focusedStepId) return
    
    // If already expanded, collapse it
    if (expandedId === focusedStepId) {
      onExpandStep(null)
    } else {
      onExpandStep(focusedStepId)
    }
  }, [focusedStepId, expandedId, onExpandStep])

  // Handle escape key: collapse step first, then group
  const handleEscape = useCallback(() => {
    if (expandedId) {
      // First escape: collapse expanded step
      onExpandStep(null)
    } else if (isGroupVisible) {
      // Second escape: collapse the entire group
      onToggleGroupVisibility()
      hasEnteredGroup.current = false
    }
  }, [expandedId, isGroupVisible, onExpandStep, onToggleGroupVisibility])

  // Main keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Only handle if group is visible
    if (!isGroupVisible) {
      // If collapsed, Enter/Space should expand
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onToggleGroupVisibility()
        hasEnteredGroup.current = true
        // Focus first step after opening
        if (stepIds.length > 0) {
          setTimeout(() => setFocusedStep(stepIds[0]), 50)
        }
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        navigateStep('down')
        break
        
      case 'ArrowUp':
        e.preventDefault()
        navigateStep('up')
        break
        
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusedStepId) {
          toggleFocusedStep()
        }
        break
        
      case 'Escape':
        e.preventDefault()
        handleEscape()
        break
        
      case 'Home':
        e.preventDefault()
        jumpToStep('first')
        break
        
      case 'End':
        e.preventDefault()
        jumpToStep('last')
        break
        
      case 'Tab':
        // Allow default tab behavior but track exit
        hasEnteredGroup.current = false
        break
        
      default:
        // Don't prevent default for other keys
        break
    }
  }, [
    isGroupVisible,
    navigateStep,
    focusedStepId,
    toggleFocusedStep,
    handleEscape,
    jumpToStep,
    onToggleGroupVisibility,
    stepIds,
    setFocusedStep
  ])

  // Get tabIndex for roving tabindex pattern
  const getTabIndex = useCallback((stepId: string): number => {
    // If no step is focused, first step gets tabIndex 0
    if (!focusedStepId) {
      return stepId === stepIds[0] ? 0 : -1
    }
    // Otherwise, only focused step gets tabIndex 0
    return stepId === focusedStepId ? 0 : -1
  }, [focusedStepId, stepIds])

  // Check if a step is focused
  const isFocused = useCallback((stepId: string): boolean => {
    return focusedStepId === stepId
  }, [focusedStepId])

  // Reset focus when step list changes
  useEffect(() => {
    if (focusedStepId && !stepIds.includes(focusedStepId)) {
      // Focused step was removed, focus first step if available
      setFocusedStep(stepIds.length > 0 ? stepIds[0] : null)
    }
  }, [stepIds, focusedStepId, setFocusedStep])

  // Clear focus when group collapses
  useEffect(() => {
    if (!isGroupVisible) {
      setFocusedStep(null)
    }
  }, [isGroupVisible, setFocusedStep])

  return {
    focusedStepId,
    handleKeyDown,
    setFocusedStep,
    getTabIndex,
    isFocused,
    containerRef
  }
}

export default useStepKeyboardNav
