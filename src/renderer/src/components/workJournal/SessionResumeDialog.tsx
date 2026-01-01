/**
 * SessionResumeDialog Component
 * 
 * Modal dialog for selecting and resuming interrupted agent sessions.
 * Shows a list of paused/crashed sessions and generates resumption context.
 * 
 * Security considerations:
 * - Resumption context is validated before injection
 * - Session ownership not currently enforced (single-user desktop app)
 * 
 * @module components/workJournal/SessionResumeDialog
 */

import { useState, useCallback } from 'react'
import { X, Play, Loader2, FileText, AlertCircle, Files, Brain, Flag, AlertTriangle } from 'lucide-react'
import { SessionList } from './SessionList'
import { useWorkJournal } from '../../hooks/useWorkJournal'

// Replicate types for isolation
interface WorkSession {
  id: string
  conversationId: string
  originalPrompt: string
  status: 'active' | 'paused' | 'completed' | 'crashed'
  createdAt: number
  updatedAt: number
  completedAt?: number
  tokenEstimate: number
  entryCount: number
}

interface ResumptionContext {
  originalPrompt: string
  workSummary: string
  keyDecisions: string[]
  currentState: string
  filesModified: string[]
  pendingActions: string[]
  errorHistory: string[]
  suggestedNextSteps: string[]
  tokenCount: number
}

interface SessionResumeDialogProps {
  isOpen: boolean
  onClose: () => void
  onResume: (session: WorkSession, context: ResumptionContext) => void
}

export function SessionResumeDialog({ isOpen, onClose, onResume }: SessionResumeDialogProps) {
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null)
  const [resumptionContext, setResumptionContext] = useState<ResumptionContext | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { generateResumptionContext } = useWorkJournal()

  const handleSelectSession = useCallback(
    async (session: WorkSession) => {
      setSelectedSession(session)
      setError(null)
      setIsGenerating(true)
      setResumptionContext(null)

      try {
        const context = await generateResumptionContext(session.id)
        setResumptionContext(context)
      } catch (err) {
        console.error('[SessionResumeDialog] Failed to generate context:', err)
        setError(err instanceof Error ? err.message : 'Failed to generate resumption context')
      } finally {
        setIsGenerating(false)
      }
    },
    [generateResumptionContext]
  )

  const handleResume = useCallback(() => {
    if (selectedSession && resumptionContext) {
      onResume(selectedSession, resumptionContext)
      handleClose()
    }
  }, [selectedSession, resumptionContext, onResume])

  const handleClose = useCallback(() => {
    setSelectedSession(null)
    setResumptionContext(null)
    setError(null)
    onClose()
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Play className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Resume Agent Session</h2>
              <p className="text-sm text-zinc-500">Pick up where you left off</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Session List (left) */}
          <div className="w-1/2 border-r border-zinc-700 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Interrupted Sessions
            </h3>
            <SessionList
              onSelectSession={handleSelectSession}
              selectedSessionId={selectedSession?.id}
            />
          </div>

          {/* Context Preview (right) */}
          <div className="w-1/2 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Resumption Context
            </h3>

            {!selectedSession && (
              <div className="text-zinc-500 text-center py-12">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Select a session</p>
                <p className="text-sm mt-1 text-zinc-600">
                  Choose a session to preview its resumption context
                </p>
              </div>
            )}

            {isGenerating && (
              <div className="text-zinc-500 text-center py-12">
                <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-violet-400" />
                <p className="font-medium">Generating context...</p>
                <p className="text-sm mt-1 text-zinc-600">
                  Analyzing session history and checkpoints
                </p>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
                <p className="font-medium text-red-400">Generation Failed</p>
                <p className="text-sm mt-1 text-zinc-500">{error}</p>
              </div>
            )}

            {resumptionContext && (
              <div className="space-y-4 text-sm">
                {/* Work Summary */}
                <div>
                  <h4 className="font-medium text-zinc-300 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-violet-400" />
                    Work Summary
                  </h4>
                  <p className="text-zinc-400 bg-zinc-800/50 p-3 rounded-lg whitespace-pre-wrap">
                    {resumptionContext.workSummary}
                  </p>
                </div>

                {/* Key Decisions */}
                {resumptionContext.keyDecisions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-zinc-300 mb-2 flex items-center gap-2">
                      <Flag className="w-4 h-4 text-amber-400" />
                      Key Decisions ({resumptionContext.keyDecisions.length})
                    </h4>
                    <ul className="space-y-1 bg-zinc-800/50 p-3 rounded-lg">
                      {resumptionContext.keyDecisions.slice(0, 5).map((d, i) => (
                        <li key={i} className="text-zinc-400 flex items-start gap-2">
                          <span className="text-zinc-600">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                      {resumptionContext.keyDecisions.length > 5 && (
                        <li className="text-zinc-600 italic">
                          +{resumptionContext.keyDecisions.length - 5} more...
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Current State */}
                <div>
                  <h4 className="font-medium text-zinc-300 mb-2">Current State</h4>
                  <p className="text-zinc-400 bg-zinc-800/50 p-3 rounded-lg">
                    {resumptionContext.currentState}
                  </p>
                </div>

                {/* Files Modified */}
                {resumptionContext.filesModified.length > 0 && (
                  <div>
                    <h4 className="font-medium text-zinc-300 mb-2 flex items-center gap-2">
                      <Files className="w-4 h-4 text-cyan-400" />
                      Files Modified ({resumptionContext.filesModified.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5 bg-zinc-800/50 p-3 rounded-lg">
                      {resumptionContext.filesModified.slice(0, 10).map((f, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-zinc-700 rounded text-xs text-zinc-300 font-mono"
                        >
                          {f.split('/').pop()}
                        </span>
                      ))}
                      {resumptionContext.filesModified.length > 10 && (
                        <span className="px-2 py-0.5 text-xs text-zinc-500">
                          +{resumptionContext.filesModified.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Error History */}
                {resumptionContext.errorHistory.length > 0 && (
                  <div>
                    <h4 className="font-medium text-zinc-300 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      Previous Errors
                    </h4>
                    <ul className="space-y-1 bg-red-950/30 border border-red-900/50 p-3 rounded-lg">
                      {resumptionContext.errorHistory.map((e, i) => (
                        <li key={i} className="text-red-300/80 text-xs flex items-start gap-2">
                          <span className="text-red-500">!</span>
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Token Count */}
                <div className="pt-3 border-t border-zinc-800 text-zinc-500 flex items-center justify-between">
                  <span>Context size</span>
                  <span className="font-mono">~{Math.round(resumptionContext.tokenCount / 1000)}k tokens</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-700 bg-zinc-900/50">
          <p className="text-sm text-zinc-500">
            {selectedSession
              ? `Session: ${selectedSession.id.slice(0, 8)}...`
              : 'Select a session to continue'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleResume}
              disabled={!resumptionContext || isGenerating}
              className="
                flex items-center gap-2 px-4 py-2 rounded-lg
                bg-violet-600 text-white font-medium
                hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            >
              <Play className="w-4 h-4" />
              Resume Session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SessionResumeDialog
