// src/renderer/src/components/mcp/InlineToolCall.tsx
// Collapsible inline tool call display similar to Claude Desktop
/**
 * @deprecated Use InlineToolCallV2 instead. This component is maintained
 * for backward compatibility only and will be removed in a future version.
 * 
 * Migration guide:
 * 1. Replace `<InlineToolCall />` with `<InlineToolCallV2 />`
 * 2. Add required props: `isExpanded`, `onToggleExpand`
 * 3. Optionally add a11y props: `isFocused`, `tabIndex`
 * 
 * @see InlineToolCallV2
 */

import { useState, useCallback } from 'react'
import { cn } from '../../lib/utils'
import {
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Loader2,
  Clock,
  Copy,
  CheckCheck,
  Terminal,
  FileText,
  Search,
  Cpu,
  AlertTriangle,
  Edit3,
  Eye,
  CheckCircle2
} from 'lucide-react'

// Tool status types
export type ToolCallStatus = 'pending' | 'approved' | 'executing' | 'completed' | 'error' | 'rejected'

export interface InlineToolCallProps {
  id: string
  toolName: string
  args: Record<string, unknown>
  status: ToolCallStatus
  result?: unknown
  error?: string
  duration?: number
  autoApproved?: boolean
  explanation?: string
  riskLevel?: 'safe' | 'moderate' | 'dangerous'
  // Approval callbacks (only needed for pending status)
  onApprove?: (id: string, modifiedArgs?: Record<string, unknown>) => void
  onAlwaysApprove?: (id: string, toolName: string, modifiedArgs?: Record<string, unknown>) => void
  onReject?: (id: string) => void
}

// Map tool names to icons
const TOOL_ICONS: Record<string, typeof Terminal> = {
  read_file: FileText,
  read_multiple_files: FileText,
  write_file: FileText,
  create_directory: FileText,
  list_directory: FileText,
  move_file: FileText,
  get_file_info: FileText,
  edit_block: FileText,
  start_search: Search,
  get_more_search_results: Search,
  stop_search: Search,
  list_searches: Search,
  start_process: Terminal,
  read_process_output: Terminal,
  interact_with_process: Terminal,
  force_terminate: Terminal,
  list_sessions: Terminal,
  list_processes: Cpu,
  kill_process: Cpu
}


// Status styling configuration
const STATUS_STYLES: Record<ToolCallStatus, { border: string; bg: string; icon: React.ReactNode; label: string }> = {
  pending: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/5',
    icon: <Clock size={14} className="text-amber-400" />,
    label: 'Waiting for approval'
  },
  approved: {
    border: 'border-blue-500/40',
    bg: 'bg-blue-500/5',
    icon: <Loader2 size={14} className="text-blue-400 animate-spin" />,
    label: 'Approved'
  },
  executing: {
    border: 'border-blue-500/40',
    bg: 'bg-blue-500/5',
    icon: <Loader2 size={14} className="text-blue-400 animate-spin" />,
    label: 'Executing...'
  },
  completed: {
    border: 'border-green-500/30',
    bg: 'bg-green-500/5',
    icon: <CheckCircle2 size={14} className="text-green-400" />,
    label: 'Completed'
  },
  error: {
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    icon: <X size={14} className="text-red-400" />,
    label: 'Failed'
  },
  rejected: {
    border: 'border-gray-500/30',
    bg: 'bg-gray-500/5',
    icon: <X size={14} className="text-gray-400" />,
    label: 'Rejected'
  }
}

const RISK_STYLES = {
  safe: 'bg-green-500/20 text-green-400',
  moderate: 'bg-yellow-500/20 text-yellow-400',
  dangerous: 'bg-red-500/20 text-red-400'
}

export function InlineToolCall({
  id,
  toolName,
  args,
  status,
  result,
  error,
  duration,
  autoApproved,
  explanation,
  riskLevel = 'moderate',
  onApprove,
  onAlwaysApprove,
  onReject
}: InlineToolCallProps) {
  // Auto-expand for pending status, collapse for completed
  const [expanded, setExpanded] = useState(status === 'pending')
  const [showFullOutput, setShowFullOutput] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedArgs, setEditedArgs] = useState(JSON.stringify(args, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const Icon = TOOL_ICONS[toolName] || Cpu
  const statusStyle = STATUS_STYLES[status]

  // Format result for display
  const displayResult = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  const isLongContent = (displayResult?.length || 0) > 300 || (error?.length || 0) > 300

  // Get a summary for collapsed view
  const getArgsSummary = useCallback(() => {
    const entries = Object.entries(args)
    if (entries.length === 0) return 'no arguments'
    
    // Show first 1-2 key args
    const summaryParts: string[] = []
    for (const [key, value] of entries.slice(0, 2)) {
      let valStr = typeof value === 'string' 
        ? value.length > 40 ? value.slice(0, 40) + '...' : value
        : JSON.stringify(value).slice(0, 40)
      summaryParts.push(`${key}: ${valStr}`)
    }
    if (entries.length > 2) summaryParts.push(`+${entries.length - 2} more`)
    return summaryParts.join(', ')
  }, [args])

  const handleCopy = async () => {
    const content = error || displayResult || JSON.stringify(args, null, 2)
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }


  const handleApprove = () => {
    if (!onApprove) return
    if (isEditing) {
      try {
        const parsed = JSON.parse(editedArgs)
        setParseError(null)
        onApprove(id, parsed)
      } catch {
        setParseError('Invalid JSON. Please fix the syntax.')
        return
      }
    } else {
      onApprove(id)
    }
  }

  const handleAlwaysApprove = () => {
    if (!onAlwaysApprove) return
    if (isEditing) {
      try {
        const parsed = JSON.parse(editedArgs)
        setParseError(null)
        onAlwaysApprove(id, toolName, parsed)
      } catch {
        setParseError('Invalid JSON. Please fix the syntax.')
        return
      }
    } else {
      onAlwaysApprove(id, toolName)
    }
  }

  const handleArgsChange = (value: string) => {
    setEditedArgs(value)
    setParseError(null)
  }

  // Toggle expansion (except when pending - that needs explicit action)
  const toggleExpand = () => {
    if (status !== 'pending') {
      setExpanded(!expanded)
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border my-2 transition-all overflow-hidden',
        statusStyle.border,
        statusStyle.bg
      )}
    >
      {/* Collapsed Header - Always visible */}
      <div
        onClick={toggleExpand}
        className={cn(
          'flex items-center gap-2 px-3 py-2',
          status !== 'pending' && 'cursor-pointer hover:bg-white/5'
        )}
      >
        {/* Expand/Collapse chevron */}
        {status !== 'pending' && (
          <button
            className="p-0.5 rounded hover:bg-white/10 transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronDown size={14} className="text-text-muted" />
            ) : (
              <ChevronRight size={14} className="text-text-muted" />
            )}
          </button>
        )}
        
        {/* Status icon */}
        {statusStyle.icon}
        
        {/* Tool icon and name */}
        <Icon size={14} className="text-primary" />
        <span className="font-medium text-sm text-text-normal">{toolName}</span>
        
        {/* Auto-approved badge */}
        {autoApproved && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
            auto
          </span>
        )}
        
        {/* Risk level badge (for pending) */}
        {status === 'pending' && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded', RISK_STYLES[riskLevel])}>
            {riskLevel}
          </span>
        )}
        
        {/* Duration */}
        {duration !== undefined && status === 'completed' && (
          <span className="text-[10px] text-text-muted flex items-center gap-1 ml-auto">
            <Clock size={10} />
            {duration}ms
          </span>
        )}
        
        {/* Args summary when collapsed */}
        {!expanded && status !== 'pending' && (
          <span className="text-[11px] text-text-muted truncate ml-2 flex-1">
            {getArgsSummary()}
          </span>
        )}
        
        {/* Copy button (only when not pending) */}
        {status !== 'pending' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCopy()
            }}
            className="p-1 rounded hover:bg-white/10 text-text-muted transition-colors ml-auto"
            title="Copy output"
          >
            {copied ? <CheckCheck size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>
        )}
      </div>


      {/* Expanded Content */}
      {(expanded || status === 'pending') && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/5">
          {/* Explanation (if provided) */}
          {explanation && (
            <p className="text-xs text-text-muted pt-2">{explanation}</p>
          )}

          {/* Arguments */}
          <div className="pt-2">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Arguments</div>
            <div className="bg-tertiary rounded-md p-2 font-mono text-xs overflow-x-auto">
              {status === 'pending' && isEditing ? (
                <textarea
                  value={editedArgs}
                  onChange={(e) => handleArgsChange(e.target.value)}
                  className={cn(
                    'w-full bg-transparent focus:outline-none resize-none min-h-[80px] text-text-normal',
                    parseError && 'text-red-400'
                  )}
                  spellCheck={false}
                />
              ) : (
                <pre className="text-text-muted whitespace-pre-wrap break-words">
                  {JSON.stringify(args, null, 2)}
                </pre>
              )}
            </div>
            {parseError && <p className="text-xs text-red-400 mt-1">{parseError}</p>}
          </div>

          {/* Result/Error (only for completed/error status) */}
          {(status === 'completed' || status === 'error') && (result !== undefined || error) && (
            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                {error ? 'Error' : 'Result'}
              </div>
              <div
                className={cn(
                  'bg-tertiary rounded-md p-2 font-mono text-xs overflow-hidden',
                  !showFullOutput && isLongContent && 'max-h-24'
                )}
              >
                <pre
                  className={cn(
                    'whitespace-pre-wrap break-words',
                    error ? 'text-red-400' : 'text-text-muted'
                  )}
                >
                  {error || displayResult || '(no output)'}
                </pre>
              </div>
              {isLongContent && (
                <button
                  onClick={() => setShowFullOutput(!showFullOutput)}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                >
                  {showFullOutput ? (
                    <>
                      <ChevronDown size={10} />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronRight size={10} />
                      Show more
                    </>
                  )}
                </button>
              )}
            </div>
          )}


          {/* Dangerous warning */}
          {status === 'pending' && riskLevel === 'dangerous' && (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertTriangle size={14} />
              <span>This action may have irreversible effects</span>
            </div>
          )}

          {/* Approval Actions (only for pending status) */}
          {status === 'pending' && onApprove && onReject && (
            <div className="flex gap-2 flex-wrap pt-1">
              <button
                onClick={handleApprove}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors text-xs',
                  riskLevel === 'dangerous'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-green-600 hover:bg-green-500',
                  'text-white'
                )}
              >
                <Check size={12} />
                {riskLevel === 'dangerous' ? 'Execute Anyway' : 'Approve'}
              </button>

              {onAlwaysApprove && riskLevel !== 'dangerous' && (
                <button
                  onClick={handleAlwaysApprove}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors text-xs"
                >
                  <CheckCheck size={12} />
                  Always
                </button>
              )}

              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-text-normal text-xs transition-colors"
              >
                {isEditing ? (
                  <>
                    <Eye size={12} />
                    Preview
                  </>
                ) : (
                  <>
                    <Edit3 size={12} />
                    Edit
                  </>
                )}
              </button>

              <button
                onClick={() => onReject(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tertiary hover:bg-tertiary/80 text-text-muted text-xs transition-colors"
              >
                <X size={12} />
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default InlineToolCall
