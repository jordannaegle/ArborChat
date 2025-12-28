// src/renderer/src/components/mcp/ToolResultCard.tsx

import { useState } from 'react'
import { cn } from '../../lib/utils'
import { Check, X, ChevronDown, ChevronUp, Copy, CheckCheck, Clock } from 'lucide-react'

interface ToolResultCardProps {
  toolName: string
  result?: unknown
  error?: string
  duration?: number
  autoApproved?: boolean
}

export function ToolResultCard({
  toolName,
  result,
  error,
  duration,
  autoApproved
}: ToolResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const isSuccess = !error
  const displayResult = typeof result === 'string'
    ? result
    : JSON.stringify(result, null, 2)

  const isLongContent = (displayResult?.length || 0) > 500 || (error?.length || 0) > 500

  const handleCopy = async () => {
    const content = error || displayResult || ''
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-3 my-2 transition-all',
        isSuccess
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-red-500/30 bg-red-500/5'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500/20">
              <Check size={12} className="text-green-400" />
            </span>
          ) : (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20">
              <X size={12} className="text-red-400" />
            </span>
          )}
          <span className="font-medium text-sm text-text-normal">{toolName}</span>
          {autoApproved && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
              auto
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {duration !== undefined && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Clock size={12} />
              {duration}ms
            </span>
          )}
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-secondary/50 text-text-muted transition-colors"
            title="Copy output"
          >
            {copied ? (
              <CheckCheck size={14} className="text-green-400" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Output */}
      <div
        className={cn(
          'font-mono text-xs bg-tertiary rounded p-2 overflow-hidden',
          !expanded && isLongContent && 'max-h-32'
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

      {/* Expand/collapse button */}
      {isLongContent && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
        >
          {expanded ? (
            <>
              <ChevronUp size={12} />
              Show less
            </>
          ) : (
            <>
              <ChevronDown size={12} />
              Show more
            </>
          )}
        </button>
      )}
    </div>
  )
}

export default ToolResultCard
