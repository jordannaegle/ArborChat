// src/renderer/src/components/mcp/ToolStepGroupContext.tsx
// Context provider for tool step group accordion behavior
// Manages exclusive expansion state and master visibility toggle

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode
} from 'react'

/**
 * Context value shape for tool step group state management
 */
interface ToolStepGroupContextValue {
  /** ID of currently expanded step (null = all collapsed) */
  expandedStepId: string | null
  /** Toggle expansion for a specific step (collapses others) */
  toggleStep: (stepId: string) => void
  /** Check if a specific step is expanded */
  isExpanded: (stepId: string) => boolean
  /** Collapse all steps */
  collapseAll: () => void
  /** Whether the entire group is visible (master toggle) */
  isGroupVisible: boolean
  /** Toggle master visibility */
  toggleGroupVisibility: () => void
  /** Total number of steps in the group */
  stepCount: number
}

const ToolStepGroupContext = createContext<ToolStepGroupContextValue | null>(null)

/**
 * Props for the ToolStepGroupProvider
 */
interface ToolStepGroupProviderProps {
  children: ReactNode
  /** Number of steps in this group */
  stepCount: number
  /** Initial expanded step ID (optional) */
  initialExpandedId?: string | null
  /** Initial visibility state (default: true) */
  initialVisible?: boolean
}

/**
 * Provider component for tool step group state
 * Wrap a group of ToolStepItems with this to enable accordion behavior
 */
export function ToolStepGroupProvider({
  children,
  stepCount,
  initialExpandedId = null,
  initialVisible = true
}: ToolStepGroupProviderProps) {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(initialExpandedId)
  const [isGroupVisible, setIsGroupVisible] = useState(initialVisible)

  // Toggle expansion for a step (implements exclusive accordion)
  const toggleStep = useCallback((stepId: string) => {
    setExpandedStepId((prev) => (prev === stepId ? null : stepId))
  }, [])

  // Check if a step is currently expanded
  const isExpanded = useCallback(
    (stepId: string) => expandedStepId === stepId,
    [expandedStepId]
  )

  // Collapse all steps
  const collapseAll = useCallback(() => {
    setExpandedStepId(null)
  }, [])

  // Toggle master visibility
  const toggleGroupVisibility = useCallback(() => {
    setIsGroupVisible((prev) => !prev)
  }, [])

  const value = useMemo<ToolStepGroupContextValue>(
    () => ({
      expandedStepId,
      toggleStep,
      isExpanded,
      collapseAll,
      isGroupVisible,
      toggleGroupVisibility,
      stepCount
    }),
    [
      expandedStepId,
      toggleStep,
      isExpanded,
      collapseAll,
      isGroupVisible,
      toggleGroupVisibility,
      stepCount
    ]
  )

  return (
    <ToolStepGroupContext.Provider value={value}>
      {children}
    </ToolStepGroupContext.Provider>
  )
}

/**
 * Hook to access tool step group context
 * Must be used within a ToolStepGroupProvider
 */
export function useToolStepGroup(): ToolStepGroupContextValue {
  const context = useContext(ToolStepGroupContext)
  if (!context) {
    throw new Error(
      'useToolStepGroup must be used within a ToolStepGroupProvider'
    )
  }
  return context
}

/**
 * Standalone hook for accordion behavior (can be used without context)
 * Useful for simple accordion patterns or custom implementations
 */
export function useAccordion(initialExpanded: string | null = null) {
  const [expandedId, setExpandedId] = useState<string | null>(initialExpanded)

  const toggleItem = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const collapseAll = useCallback(() => {
    setExpandedId(null)
  }, [])

  const isExpanded = useCallback(
    (id: string) => expandedId === id,
    [expandedId]
  )

  return {
    expandedId,
    toggleItem,
    collapseAll,
    isExpanded
  }
}
