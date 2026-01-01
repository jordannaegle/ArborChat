/**
 * EntryCard Component
 * 
 * Renders an individual work journal entry with expandable details.
 * Shows entry type icon, summary, and timestamp with collapsible content.
 * 
 * @module components/workJournal/EntryCard
 */

import { useState } from 'react'
import {
  Brain,
  Wrench,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Flag,
  MessageSquare,
  FileEdit,
  Lightbulb
} from 'lucide-react'

// Replicate types for isolation
interface WorkEntry {
  id: number
  sessionId: string
  sequenceNum: number
  entryType: string
  timestamp: number
  content: Record<string, unknown>
  tokenEstimate: number
  importance: 'low' | 'normal' | 'high' | 'critical'
}

interface EntryCardProps {
  entry: WorkEntry
}

export function EntryCard({ entry }: EntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const content = entry.content as Record<string, unknown>

  const getIcon = () => {
    switch (entry.entryType) {
      case 'thinking':
        return <Brain className="w-4 h-4 text-violet-400" />
      case 'tool_request':
        return <Wrench className="w-4 h-4 text-blue-400" />
      case 'tool_result':
        return content.success ? (
          <CheckCircle className="w-4 h-4 text-green-400" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400" />
        )
      case 'tool_approved':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'tool_rejected':
        return <XCircle className="w-4 h-4 text-red-400" />
      case 'file_read':
        return <FileText className="w-4 h-4 text-cyan-400" />
      case 'file_written':
        return <FileEdit className="w-4 h-4 text-amber-400" />
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-400" />
      case 'checkpoint':
        return <Flag className="w-4 h-4 text-green-400" />
      case 'decision':
        return <Lightbulb className="w-4 h-4 text-yellow-400" />
      case 'user_feedback':
        return <MessageSquare className="w-4 h-4 text-blue-400" />
      default:
        return <Clock className="w-4 h-4 text-zinc-400" />
    }
  }

  const getTitle = () => {
    switch (entry.entryType) {
      case 'thinking':
        return 'AI Thinking'
      case 'tool_request':
        return `Tool: ${content.toolName}`
      case 'tool_result':
        return `Result: ${content.toolName}`
      case 'tool_approved':
        return `Approved: ${content.toolName}`
      case 'tool_rejected':
        return `Rejected: ${content.toolName}`
      case 'file_read':
        return `Read: ${(content.filePath as string)?.split('/').pop()}`
      case 'file_written':
        return `Write: ${(content.filePath as string)?.split('/').pop()}`
      case 'error':
        return `Error: ${content.errorType}`
      case 'checkpoint':
        return 'Checkpoint'
      case 'decision':
        return 'Decision'
      case 'user_feedback':
        return 'User Feedback'
      case 'session_start':
        return 'Session Started'
      case 'session_end':
        return 'Session Ended'
      default:
        return entry.entryType.replace(/_/g, ' ')
    }
  }

  const getPreview = () => {
    switch (entry.entryType) {
      case 'thinking': {
        const reasoning = content.reasoning as string
        return reasoning?.slice(0, 100) + (reasoning?.length > 100 ? '...' : '')
      }
      case 'tool_request':
        return JSON.stringify(content.toolInput).slice(0, 80) + '...'
      case 'tool_result': {
        const output = content.output as string
        return output?.slice(0, 100) + (output?.length > 100 ? '...' : '')
      }
      case 'error':
        return content.message as string
      case 'decision':
        return `${content.question}: ${content.chosenOption}`
      case 'checkpoint':
        return content.summary as string
      default:
        return null
    }
  }

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const importanceColors: Record<string, string> = {
    low: 'border-l-zinc-600',
    normal: 'border-l-zinc-500',
    high: 'border-l-amber-500',
    critical: 'border-l-red-500'
  }

  return (
    <div
      className={`
        border-l-2 ${importanceColors[entry.importance] || importanceColors.normal}
        bg-zinc-800/50 rounded-r-lg overflow-hidden
      `}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-start gap-3 text-left hover:bg-zinc-700/30 transition-colors"
      >
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-200 text-sm">{getTitle()}</span>
            <span className="text-xs text-zinc-500">{formatTime(entry.timestamp)}</span>
          </div>
          {!isExpanded && getPreview() && (
            <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{getPreview()}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pl-10">
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap bg-zinc-900/50 p-2 rounded overflow-x-auto max-h-60">
            {JSON.stringify(content, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default EntryCard
