/**
 * WorkJournalPanel Component
 * 
 * Collapsible sidebar panel displaying live agent work journal entries.
 * Shows session status, filterable entry list, and action buttons.
 * 
 * Features:
 * - Real-time entry updates via WorkJournalProvider
 * - Entry type filtering
 * - Manual checkpoint creation
 * - Session export to JSON
 * 
 * @module components/workJournal/WorkJournalPanel
 */

import { useState, useCallback } from 'react'
import {
  BookOpen,
  X,
  Download,
  Flag,
  RefreshCw,
  Filter
} from 'lucide-react'
import { useWorkSession } from '../../hooks/useWorkSession'
import { EntryCard } from './EntryCard'
import { SessionHeader } from './SessionHeader'
import { ResizablePanel } from '../shared'

interface WorkJournalPanelProps {
  sessionId: string | null
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

export function WorkJournalPanel({
  sessionId,
  isOpen,
  onToggle,
  onClose
}: WorkJournalPanelProps) {
  const {
    session,
    entries,
    isActive,
    createCheckpoint,
    refreshEntries,
    isLoading
  } = useWorkSession(sessionId)

  const [filter, setFilter] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Filter entries by type
  const filteredEntries = filter ? entries.filter((e) => e.entryType === filter) : entries

  // Get unique entry types for filter buttons
  const entryTypes = [...new Set(entries.map((e) => e.entryType))]

  // Handle session export to JSON
  const handleExport = useCallback(async () => {
    if (!session) return

    setIsExporting(true)
    try {
      const data = {
        session,
        entries,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `session-${session.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[WorkJournalPanel] Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }, [session, entries])

  // Handle manual checkpoint creation
  const handleCheckpoint = useCallback(async () => {
    try {
      await createCheckpoint(true)
      // Could show a toast here
    } catch (err) {
      console.error('[WorkJournalPanel] Checkpoint failed:', err)
    }
  }, [createCheckpoint])

  // Collapsed state - just show toggle button
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="
          fixed right-0 top-1/2 -translate-y-1/2 z-40
          bg-zinc-800 border border-zinc-700 border-r-0
          rounded-l-lg p-2.5 hover:bg-zinc-700 transition-colors
          group
        "
        title="Open Work Journal"
      >
        <BookOpen className="w-5 h-5 text-zinc-400 group-hover:text-violet-400 transition-colors" />
      </button>
    )
  }

  return (
    <ResizablePanel
      storageKey="work-journal"
      defaultWidth={320}
      minWidth={280}
      maxWidth={600}
      isOpen={isOpen}
      className="fixed right-0 top-0 h-full z-40"
    >
      <div
        className="
          h-full w-full
          bg-zinc-900 border-l border-zinc-700
          flex flex-col shadow-2xl
        "
      >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-700 bg-zinc-800/50">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-violet-400" />
          <span className="font-medium text-zinc-200">Work Journal</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => refreshEntries()}
            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Refresh entries"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Session Header */}
      {session && <SessionHeader session={session} />}

      {/* Filter Bar */}
      {entryTypes.length > 1 && (
        <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-800/20">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-3 h-3 text-zinc-500" />
            <span className="text-xs text-zinc-500">Filter by type</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFilter(null)}
              className={`
                px-2 py-0.5 rounded text-xs transition-colors
                ${!filter ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}
              `}
            >
              All ({entries.length})
            </button>
            {entryTypes.map((type) => {
              const count = entries.filter((e) => e.entryType === type).length
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`
                    px-2 py-0.5 rounded text-xs transition-colors
                    ${
                      filter === type
                        ? 'bg-violet-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }
                  `}
                >
                  {type.replace(/_/g, ' ')} ({count})
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Entry List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* No session state */}
        {!sessionId && (
          <div className="text-center text-zinc-500 py-12">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No Active Session</p>
            <p className="text-sm mt-1 text-zinc-600">
              Start an agent task to see work entries here
            </p>
          </div>
        )}

        {/* Empty entries state */}
        {sessionId && filteredEntries.length === 0 && (
          <div className="text-center text-zinc-500 py-8">
            {filter ? (
              <>
                <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No {filter.replace(/_/g, ' ')} entries</p>
                <button
                  onClick={() => setFilter(null)}
                  className="text-sm mt-2 text-violet-400 hover:text-violet-300"
                >
                  Clear filter
                </button>
              </>
            ) : (
              <>
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No entries yet</p>
                <p className="text-sm mt-1 text-zinc-600">Entries will appear as the agent works</p>
              </>
            )}
          </div>
        )}

        {/* Entry cards */}
        {filteredEntries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>

      {/* Actions Footer */}
      {session && (
        <div className="p-3 border-t border-zinc-700 bg-zinc-800/30">
          <div className="flex gap-2">
            <button
              onClick={handleCheckpoint}
              disabled={!isActive}
              className="
                flex-1 flex items-center justify-center gap-2
                px-3 py-2 rounded-lg text-sm font-medium
                bg-zinc-700 text-zinc-200 hover:bg-zinc-600
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
              title={isActive ? 'Create a manual checkpoint' : 'Session not active'}
            >
              <Flag className="w-4 h-4" />
              Checkpoint
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="
                p-2 rounded-lg bg-zinc-700 text-zinc-200
                hover:bg-zinc-600 disabled:opacity-50
                transition-colors
              "
              title="Export session as JSON"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-pulse' : ''}`} />
            </button>
          </div>
        </div>
      )}
    </div>
    </ResizablePanel>
  )
}

export default WorkJournalPanel
