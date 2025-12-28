// src/renderer/src/components/mcp/ToolApprovalCard.tsx

import { useState } from 'react'
import { cn } from '../../lib/utils'
import {
  Terminal,
  FileText,
  Search,
  Cpu,
  AlertTriangle,
  Check,
  CheckCheck,
  X,
  Edit3,
  Eye
} from 'lucide-react'

interface ToolApprovalCardProps {
  id: string
  toolName: string
  args: Record<string, unknown>
  explanation?: string
  riskLevel: 'safe' | 'moderate' | 'dangerous'
  onApprove: (id: string, modifiedArgs?: Record<string, unknown>) => void
  onAlwaysApprove?: (id: string, toolName: string, modifiedArgs?: Record<string, unknown>) => void
  onReject: (id: string) => void
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

export function ToolApprovalCard({
  id,
  toolName,
  args,
  explanation,
  riskLevel,
  onApprove,
  onAlwaysApprove,
  onReject
}: ToolApprovalCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedArgs, setEditedArgs] = useState(JSON.stringify(args, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)

  const Icon = TOOL_ICONS[toolName] || Cpu

  const riskStyles = {
    safe: 'border-green-500/50 bg-green-500/10',
    moderate: 'border-yellow-500/50 bg-yellow-500/10',
    dangerous: 'border-red-500/50 bg-red-500/10'
  }

  const riskBadgeStyles = {
    safe: 'bg-green-500/20 text-green-400',
    moderate: 'bg-yellow-500/20 text-yellow-400',
    dangerous: 'bg-red-500/20 text-red-400'
  }

  const riskLabels = {
    safe: 'Safe',
    moderate: 'Moderate',
    dangerous: 'Dangerous'
  }

  const handleApprove = () => {
    if (isEditing) {
      try {
        const parsed = JSON.parse(editedArgs)
        setParseError(null)
        onApprove(id, parsed)
      } catch (e) {
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
      } catch (e) {
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

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-4 my-3 transition-all',
        riskStyles[riskLevel]
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className="text-primary" />
        <span className="font-semibold text-text-normal">{toolName}</span>
        <span className={cn('text-xs px-2 py-0.5 rounded-full', riskBadgeStyles[riskLevel])}>
          {riskLabels[riskLevel]}
        </span>
      </div>

      {/* Explanation */}
      {explanation && (
        <p className="text-sm text-text-muted mb-3">{explanation}</p>
      )}

      {/* Arguments */}
      <div className="bg-tertiary rounded-md p-3 font-mono text-xs mb-3 overflow-x-auto">
        {isEditing ? (
          <textarea
            value={editedArgs}
            onChange={(e) => handleArgsChange(e.target.value)}
            className={cn(
              'w-full bg-transparent focus:outline-none resize-none min-h-[100px] text-text-normal',
              parseError && 'text-red-400'
            )}
            spellCheck={false}
          />
        ) : (
          <pre className="text-text-muted whitespace-pre-wrap">
            {JSON.stringify(args, null, 2)}
          </pre>
        )}
      </div>

      {/* Parse error */}
      {parseError && (
        <p className="text-xs text-red-400 mb-3">{parseError}</p>
      )}

      {/* Dangerous warning */}
      {riskLevel === 'dangerous' && (
        <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
          <AlertTriangle size={16} />
          <span>This action may have irreversible effects</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleApprove}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-md font-medium transition-colors text-sm',
            riskLevel === 'dangerous'
              ? 'bg-red-600 hover:bg-red-500'
              : 'bg-green-600 hover:bg-green-500',
            'text-white'
          )}
        >
          <Check size={14} />
          {riskLevel === 'dangerous' ? 'Execute Anyway' : 'Approve'}
        </button>

        {onAlwaysApprove && riskLevel !== 'dangerous' && (
          <button
            onClick={handleAlwaysApprove}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors text-sm"
          >
            <CheckCheck size={14} />
            Always Approve
          </button>
        )}

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-secondary hover:bg-secondary/80 text-text-normal text-sm transition-colors"
        >
          {isEditing ? (
            <>
              <Eye size={14} />
              Preview
            </>
          ) : (
            <>
              <Edit3 size={14} />
              Edit
            </>
          )}
        </button>

        <button
          onClick={() => onReject(id)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-tertiary hover:bg-tertiary/80 text-text-muted text-sm transition-colors"
        >
          <X size={14} />
          Reject
        </button>
      </div>
    </div>
  )
}

export default ToolApprovalCard
