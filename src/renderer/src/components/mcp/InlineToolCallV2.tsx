// src/renderer/src/components/mcp/InlineToolCallV2.tsx
// Phase 6: Enhanced with keyboard focus states and accessibility
// Phase 7: Refactored to use shared hook and configuration
// Tool call display with Request/Response sections

import { memo, useRef, useEffect } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Check,
  CheckCheck,
  X,
  Copy,
  Edit3,
  Eye,
  AlertTriangle,
  Clock
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useToolCallState } from '../../hooks/useToolCallState'
import {
  STATUS_CONFIG,
  getStatusIcon,
  RISK_STYLES,
  isLongContent,
  formatResult
} from './toolCallConfig'
import type {
  ToolCallStatus,
  RiskLevel,
  ToolApprovalCallbacks,
  AccordionItemProps
} from './types'
import { getServerIcon } from '../../lib/serverIcons'

export interface InlineToolCallV2Props extends AccordionItemProps, ToolApprovalCallbacks {
  /** Unique identifier for this tool call */
  id: string
  /** Tool function name */
  toolName: string
  /** MCP server name (for icon display) */
  serverName?: string
  /** Arguments passed to the tool */
  args: Record<string, unknown>
  /** Current execution status */
  status: ToolCallStatus
  /** Execution result (if completed) */
  result?: unknown
  /** Error message (if failed) */
  error?: string
  /** Execution duration in ms */
  duration?: number
  /** Whether auto-approved */
  autoApproved?: boolean
  /** AI explanation for this call */
  explanation?: string
  /** Risk classification */
  riskLevel?: RiskLevel
  /** Whether this step has keyboard focus */
  isFocused?: boolean
  /** Tab index for keyboard navigation */
  tabIndex?: number
}

/**
 * Section component for Request/Response display
 */
function ToolSection({
  title,
  children,
  className
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-lg overflow-hidden bg-tertiary', className)}>
      {/* Section header */}
      <div className="px-3 py-1.5 bg-black/20">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          {title}
        </span>
      </div>
      {/* Section content */}
      <div className="p-3 font-mono text-xs leading-relaxed overflow-x-auto">
        {children}
      </div>
    </div>
  )
}

/**
 * Enhanced inline tool call component with Request/Response sections
 * 
 * Phase 6 enhancements:
 * - Visual focus ring for keyboard navigation
 * - Enhanced ARIA attributes for screen readers
 * - Reduced motion support
 * - Proper tabIndex for roving focus
 * - Status label announcements
 * 
 * Phase 7 enhancements:
 * - Uses shared useToolCallState hook for state management
 * - Uses shared configuration from toolCallConfig
 * - Reduced code duplication with InlineToolCall (V1)
 */
export const InlineToolCallV2 = memo(function InlineToolCallV2({
  id,
  toolName,
  serverName = 'unknown',
  args,
  status,
  result,
  error,
  duration,
  autoApproved,
  explanation,
  riskLevel = 'moderate',
  isExpanded,
  onToggleExpand,
  onApprove,
  onAlwaysApprove,
  onReject,
  isFocused = false,
  tabIndex = 0
}: InlineToolCallV2Props) {
  const headerRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  // Use shared hook for state management
  const {
    isEditing,
    toggleEditing,
    editedArgs,
    setEditedArgs,
    parseError,
    copied,
    handleCopy,
    showFullResult,
    toggleShowFullResult,
    handleApprove,
    handleAlwaysApprove,
    handleReject
  } = useToolCallState({
    initialArgs: args,
    id,
    toolName,
    onApprove,
    onAlwaysApprove,
    onReject
  })

  // Use shared configuration
  const statusConfig = STATUS_CONFIG[status]
  const statusIcon = getStatusIcon(status, 14)
  const riskConfig = RISK_STYLES[riskLevel]
  const serverIcon = getServerIcon(serverName)

  // Format result for display using shared utility
  const displayResult = formatResult(result)
  const isLongResult = isLongContent(displayResult) || isLongContent(error)

  // Focus the header element when this step becomes focused
  useEffect(() => {
    if (isFocused && headerRef.current) {
      headerRef.current.focus()
    }
  }, [isFocused])

  // Copy to clipboard handler (wraps shared handler with content)
  const onCopyClick = async () => {
    const content = error || displayResult || JSON.stringify(args, null, 2)
    await handleCopy(content)
  }

  // Handle keyboard for expand toggle
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (status !== 'pending' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onToggleExpand()
    }
  }
  
  // Build ARIA label
  const ariaLabel = `Tool ${toolName}, ${statusConfig.label}${duration ? `, ${duration} milliseconds` : ''}`

  return (
    <div className="select-none">
      {/* Collapsed header row */}
      <div
        ref={headerRef}
        role="button"
        tabIndex={status !== 'pending' ? tabIndex : -1}
        onClick={status !== 'pending' ? onToggleExpand : undefined}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-label={ariaLabel}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded',
          status !== 'pending' && 'cursor-pointer hover:bg-white/5',
          !prefersReducedMotion && 'transition-colors duration-150',
          // Focus ring for keyboard navigation
          'focus:outline-none',
          isFocused && status !== 'pending' && 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background',
          'focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background'
        )}
      >
        {/* Status icon */}
        <span title={statusConfig.label} aria-hidden="true">
          {statusIcon}
        </span>

        {/* Server icon badge */}
        <span
          className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: `${serverIcon.color}20`,
            color: serverIcon.color
          }}
          aria-label={`Server: ${serverIcon.name}`}
        >
          {serverIcon.abbrev}
        </span>

        {/* Tool name */}
        <span className="font-mono text-sm text-text-normal">
          {toolName}
        </span>

        {/* Auto-approved badge */}
        {autoApproved && (
          <span 
            className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400"
            title="Automatically approved"
          >
            auto
          </span>
        )}

        {/* Risk level badge (pending only) */}
        {status === 'pending' && (
          <span 
            className={cn('text-[10px] px-1.5 py-0.5 rounded', riskConfig.className)}
            title={riskConfig.label}
          >
            {riskLevel}
          </span>
        )}

        {/* Duration (completed only) */}
        {duration !== undefined && status === 'completed' && (
          <span 
            className="text-[10px] text-text-muted flex items-center gap-1 ml-auto"
            aria-label={`Duration: ${duration} milliseconds`}
          >
            <Clock size={10} aria-hidden="true" />
            {duration}ms
          </span>
        )}

        {/* Copy button (non-pending) */}
        {status !== 'pending' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCopyClick()
            }}
            className="p-1 rounded hover:bg-white/10 text-text-muted transition-colors ml-auto"
            title="Copy output"
            aria-label={copied ? 'Copied to clipboard' : 'Copy output to clipboard'}
          >
            {copied ? (
              <CheckCheck size={12} className="text-green-400" aria-hidden="true" />
            ) : (
              <Copy size={12} aria-hidden="true" />
            )}
          </button>
        )}

        {/* Chevron */}
        <span
          className={cn(
            'text-text-muted',
            !prefersReducedMotion && 'transition-transform duration-200',
            isExpanded ? 'rotate-0' : '-rotate-90'
          )}
          aria-hidden="true"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </div>

      {/* Expanded content with animation */}
      <div
        id={`tool-content-${id}`}
        role="region"
        aria-label={`${toolName} details`}
        className={cn(
          'grid',
          !prefersReducedMotion && 'transition-all duration-200 ease-out',
          isExpanded || status === 'pending'
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="pl-6 pr-2 pb-3 pt-2 space-y-3">
            {/* Explanation */}
            {explanation && (
              <p className="text-xs text-text-muted">{explanation}</p>
            )}

            {/* Request Section */}
            <ToolSection title="Request">
              {status === 'pending' && isEditing ? (
                <textarea
                  value={editedArgs}
                  onChange={(e) => setEditedArgs(e.target.value)}
                  className={cn(
                    'w-full bg-transparent focus:outline-none resize-none min-h-[80px]',
                    parseError ? 'text-red-400' : 'text-text-muted'
                  )}
                  spellCheck={false}
                  aria-label="Edit tool arguments"
                  aria-invalid={!!parseError}
                  aria-describedby={parseError ? `parse-error-${id}` : undefined}
                />
              ) : (
                <pre className="text-text-muted whitespace-pre-wrap break-words">
                  {JSON.stringify(args, null, 2)}
                </pre>
              )}
            </ToolSection>
            {parseError && (
              <p id={`parse-error-${id}`} className="text-xs text-red-400" role="alert">
                {parseError}
              </p>
            )}

            {/* Response Section (completed/error only) */}
            {(status === 'completed' || status === 'error') && (result !== undefined || error) && (
              <>
                <ToolSection title={error ? 'Error' : 'Response'}>
                  <pre
                    className={cn(
                      'whitespace-pre-wrap break-words',
                      error ? 'text-red-400' : 'text-text-muted',
                      !showFullResult && isLongResult && 'max-h-32 overflow-hidden'
                    )}
                  >
                    {error || displayResult || '(no output)'}
                  </pre>
                </ToolSection>
                {isLongResult && (
                  <button
                    type="button"
                    onClick={toggleShowFullResult}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                    aria-expanded={showFullResult}
                  >
                    {showFullResult ? (
                      <>
                        <ChevronDown size={10} aria-hidden="true" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronRight size={10} aria-hidden="true" />
                        Show more
                      </>
                    )}
                  </button>
                )}
              </>
            )}

            {/* Dangerous warning */}
            {status === 'pending' && riskLevel === 'dangerous' && (
              <div className="flex items-center gap-2 text-red-400 text-xs" role="alert">
                <AlertTriangle size={14} aria-hidden="true" />
                <span>This action may have irreversible effects</span>
              </div>
            )}

            {/* Approval actions (pending only) */}
            {status === 'pending' && onApprove && onReject && (
              <div className="flex gap-2 flex-wrap pt-1" role="group" aria-label="Tool approval actions">
                <button
                  type="button"
                  onClick={handleApprove}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs text-white transition-colors',
                    riskLevel === 'dangerous'
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-green-600 hover:bg-green-500'
                  )}
                >
                  <Check size={12} aria-hidden="true" />
                  {riskLevel === 'dangerous' ? 'Execute Anyway' : 'Approve'}
                </button>

                {onAlwaysApprove && riskLevel !== 'dangerous' && (
                  <button
                    type="button"
                    onClick={handleAlwaysApprove}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
                    title={`Always approve ${toolName} calls`}
                  >
                    <CheckCheck size={12} aria-hidden="true" />
                    Always
                  </button>
                )}

                <button
                  type="button"
                  onClick={toggleEditing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-text-normal text-xs transition-colors"
                  aria-pressed={isEditing}
                >
                  {isEditing ? (
                    <>
                      <Eye size={12} aria-hidden="true" />
                      Preview
                    </>
                  ) : (
                    <>
                      <Edit3 size={12} aria-hidden="true" />
                      Edit
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleReject}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tertiary hover:bg-tertiary/80 text-text-muted text-xs transition-colors"
                >
                  <X size={12} aria-hidden="true" />
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-renders
  return (
    prevProps.id === nextProps.id &&
    prevProps.toolName === nextProps.toolName &&
    prevProps.status === nextProps.status &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.tabIndex === nextProps.tabIndex &&
    prevProps.result === nextProps.result &&
    prevProps.error === nextProps.error &&
    prevProps.duration === nextProps.duration
  )
})

export default InlineToolCallV2
