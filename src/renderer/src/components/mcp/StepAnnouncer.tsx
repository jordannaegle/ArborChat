// src/renderer/src/components/mcp/StepAnnouncer.tsx
// Phase 6.2: ARIA live region for screen reader announcements
// Announces tool status changes politely without interrupting

import { useEffect, useState, useRef, memo } from 'react'
import type { ToolCallStatus } from './types'

interface StepAnnouncerProps {
  /** Current message to announce */
  message: string
}

/**
 * Hidden live region for screen reader announcements
 * 
 * Uses aria-live="polite" to avoid interrupting current speech.
 * Messages are cleared after announcement to prevent re-reading.
 */
export const StepAnnouncer = memo(function StepAnnouncer({ 
  message 
}: StepAnnouncerProps) {
  const [announcement, setAnnouncement] = useState('')
  const prevMessageRef = useRef('')

  useEffect(() => {
    // Only announce if message changed
    if (message && message !== prevMessageRef.current) {
      setAnnouncement(message)
      prevMessageRef.current = message
      
      // Clear after a short delay to allow re-announcement of same message
      const timer = setTimeout(() => {
        setAnnouncement('')
      }, 1000)
      
      return () => clearTimeout(timer)
    }
    return undefined
  }, [message])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  )
})

/**
 * Format a tool status change for announcement
 */
export function formatStatusAnnouncement(
  toolName: string,
  status: ToolCallStatus,
  errorSummary?: string
): string {
  switch (status) {
    case 'pending':
      return `Tool ${toolName} pending approval`
    case 'approved':
      return `Tool ${toolName} approved, preparing to execute`
    case 'executing':
      return `Tool ${toolName} executing`
    case 'completed':
      return `Tool ${toolName} completed successfully`
    case 'error':
      return `Tool ${toolName} failed${errorSummary ? `: ${errorSummary.slice(0, 50)}` : ''}`
    case 'rejected':
      return `Tool ${toolName} rejected`
    default:
      return `Tool ${toolName} status updated`
  }
}

/**
 * Format step focus announcement
 */
export function formatFocusAnnouncement(
  stepType: string,
  stepContent: string,
  position: number,
  total: number
): string {
  const typeLabel = stepType === 'tool_call' 
    ? 'Tool call' 
    : stepType.replace('_', ' ')
  
  const truncatedContent = stepContent.length > 50 
    ? `${stepContent.slice(0, 50)}...` 
    : stepContent
    
  return `${typeLabel}: ${truncatedContent}. Step ${position} of ${total}`
}

/**
 * Format expansion state announcement
 */
export function formatExpansionAnnouncement(
  isExpanded: boolean,
  stepType: string
): string {
  if (isExpanded) {
    return stepType === 'tool_call'
      ? 'Expanded, showing request and response'
      : 'Expanded, showing full content'
  }
  return 'Collapsed'
}

export default StepAnnouncer
