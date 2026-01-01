# Phase 5 Prompt: Session Resumption & Work Journal UI

Copy everything below this line to start Phase 5 in a new window:

---

## Project Context

I'm working on ArborChat, an Electron-based threaded AI chat desktop application.

**Location:** `/Users/cory.naegle/ArborChat`

**Tech Stack:**
- Electron 39, React 19, TypeScript 5.9
- Tailwind CSS v4, Vite 7
- better-sqlite3 for persistence
- @google/generative-ai for AI features
- @modelcontextprotocol/sdk for MCP integration
- Lucide React icons

**Architecture:**
- Main process: `src/main/`
- Preload scripts: `src/preload/`
- Renderer/UI: `src/renderer/src/`
- Shared types: `src/shared/types/`

---

## Task: Session Resumption & Work Journal UI - Phase 5

Please adopt the **Alex Chen persona** (Distinguished Software Architect) for this implementation.

Start responses with: `[Architecting as Alex Chen — evaluating through security boundaries, type safety, and scalable patterns...]`

### Design Document
Full design: `/Users/cory.naegle/ArborChat/docs/agent-context-memory-extension.md`

### Previous Phases: ✅ COMPLETE

**Phase 1 — Types + Manager Service:**
- `src/shared/types/workJournal.ts` — All TypeScript types
- `src/main/services/WorkJournalManager.ts` — Core service with SQLite

**Phase 2 — IPC Handlers + Preload API:**
- `src/main/workJournal/index.ts` — 11 IPC handlers with real-time subscriptions
- `src/preload/index.ts` — `window.api.workJournal` API surface
- `src/main/index.ts` — Handler wiring and cleanup

**Phase 3 — React Hooks + Provider:**
- `src/renderer/src/components/workJournal/WorkJournalProvider.tsx` — Context with state management
- `src/renderer/src/hooks/useWorkJournal.ts` — Main hook with typed logging helpers
- `src/renderer/src/hooks/useWorkSession.ts` — Session-specific hook
- `src/renderer/src/App.tsx` — Provider integrated into app hierarchy

**Phase 4 — Agent Integration:**
- `src/renderer/src/hooks/useAgentRunner.ts` — Full work journal integration
- Session creation, tool logging, checkpoint management
- Error logging, file operation detection
- Session status lifecycle management

---

## Phase 5: Session Resumption & Work Journal UI

**Estimate:** 4-5 hours

### Goals

1. **Session Resume Dialog** — Allow users to pick up crashed/paused agent sessions
2. **Work Journal Panel** — Live view of agent activity and session history
3. **Resumption Flow** — Generate context and inject into new agent execution
4. **Session Management** — View, delete, export session data

### Core Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Resume Dialog | Modal to select and resume interrupted sessions | High |
| Work Journal Panel | Collapsible sidebar showing live session entries | High |
| Resumption Context | AI-friendly summary for fresh context windows | High |
| Session History | View past sessions with filtering | Medium |
| Session Export | Export session data as JSON/Markdown | Low |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Session Resumption Flow                       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     SessionResumeDialog                        │ │
│  │                                                                 │ │
│  │  1. List interrupted sessions (paused/crashed)                 │ │
│  │  2. Show session summary + entry count + last activity         │ │
│  │  3. Generate resumption context on select                      │ │
│  │  4. Create new agent with resumption context injected          │ │
│  │  5. Link new agent to original conversation                    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     WorkJournalPanel                           │ │
│  │                                                                 │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  │  Session Header                                         │   │ │
│  │  │  - Original prompt (truncated)                         │   │ │
│  │  │  - Status badge (active/paused/completed/crashed)      │   │ │
│  │  │  - Entry count + token estimate                        │   │ │
│  │  └─────────────────────────────────────────────────────────┘   │ │
│  │                                                                 │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  │  Entry List (virtualized)                              │   │ │
│  │  │  - Thinking entries (collapsible)                      │   │ │
│  │  │  - Tool request/result pairs                          │   │ │
│  │  │  - File operations with previews                       │   │ │
│  │  │  - Errors (highlighted)                               │   │ │
│  │  │  - Checkpoints (marked)                               │   │ │
│  │  └─────────────────────────────────────────────────────────┘   │ │
│  │                                                                 │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  │  Actions Bar                                            │   │ │
│  │  │  - Create checkpoint (manual)                          │   │ │
│  │  │  - Export session                                       │   │ │
│  │  │  - Clear/delete session                                │   │ │
│  │  └─────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Reference Files (Read First)

Study these files to understand the integration points:

```
src/renderer/src/hooks/useWorkJournal.ts          — Work journal hook (USE)
src/renderer/src/hooks/useWorkSession.ts          — Session-specific hook (USE)
src/renderer/src/components/workJournal/WorkJournalProvider.tsx — Context (REFERENCE)
src/renderer/src/hooks/useAgentRunner.ts          — Agent execution (REFERENCE)
src/renderer/src/contexts/AgentContext.tsx        — Agent state management (MODIFY)
src/main/services/WorkJournalManager.ts           — Backend service (REFERENCE)
src/main/workJournal/index.ts                     — IPC handlers (REFERENCE)
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/src/components/workJournal/SessionResumeDialog.tsx` | Modal for resuming sessions |
| `src/renderer/src/components/workJournal/WorkJournalPanel.tsx` | Sidebar panel for live view |
| `src/renderer/src/components/workJournal/SessionList.tsx` | List of resumable sessions |
| `src/renderer/src/components/workJournal/EntryList.tsx` | Virtualized entry display |
| `src/renderer/src/components/workJournal/EntryCard.tsx` | Individual entry renderer |
| `src/renderer/src/components/workJournal/SessionHeader.tsx` | Session info header |
| `src/renderer/src/components/workJournal/index.ts` | Updated barrel exports |

## Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/src/contexts/AgentContext.tsx` | Add resumption support |
| `src/renderer/src/components/agents/AgentPanel.tsx` | Add resume button |
| `src/renderer/src/App.tsx` | Add WorkJournalPanel to layout |
| `src/preload/index.ts` | Add getResumableSessions IPC |
| `src/main/workJournal/index.ts` | Add handler for resumable sessions |

---

## Implementation Strategy

### Part 1: Session List & Resume Dialog (2 hours)

#### 1.1 Add IPC for Resumable Sessions

Add to `src/main/workJournal/index.ts`:

```typescript
// Get sessions that can be resumed (paused or crashed)
ipcMain.handle('work-journal:get-resumable-sessions', async () => {
  return workJournalManager.getResumableSessions()
})
```

Add to `WorkJournalManager`:

```typescript
getResumableSessions(): WorkSession[] {
  const stmt = this.db.prepare(`
    SELECT * FROM work_sessions 
    WHERE status IN ('paused', 'crashed')
    ORDER BY updated_at DESC
    LIMIT 20
  `)
  return stmt.all() as WorkSession[]
}
```

Add to preload:

```typescript
getResumableSessions: () => ipcRenderer.invoke('work-journal:get-resumable-sessions')
```

#### 1.2 SessionList Component

```typescript
// src/renderer/src/components/workJournal/SessionList.tsx

import { useState, useEffect } from 'react'
import { Clock, AlertTriangle, Pause, ChevronRight } from 'lucide-react'

interface SessionListProps {
  onSelectSession: (session: WorkSession) => void
  selectedSessionId?: string | null
}

export function SessionList({ onSelectSession, selectedSessionId }: SessionListProps) {
  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setIsLoading(true)
    try {
      const resumable = await window.api.workJournal.getResumableSessions()
      setSessions(resumable)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paused': return <Pause className="w-4 h-4 text-amber-500" />
      case 'crashed': return <AlertTriangle className="w-4 h-4 text-red-500" />
      default: return null
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  if (isLoading) {
    return <div className="p-4 text-zinc-500">Loading sessions...</div>
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 text-zinc-500 text-center">
        <p>No interrupted sessions to resume.</p>
        <p className="text-sm mt-1">Sessions appear here when paused or crashed.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sessions.map(session => (
        <button
          key={session.id}
          onClick={() => onSelectSession(session)}
          className={`
            w-full p-3 rounded-lg border text-left transition-colors
            ${selectedSessionId === session.id 
              ? 'border-violet-500 bg-violet-500/10' 
              : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
            }
          `}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(session.status)}
              <span className="font-medium text-zinc-200 line-clamp-1">
                {session.originalPrompt.slice(0, 60)}
                {session.originalPrompt.length > 60 ? '...' : ''}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(session.updatedAt)}
            </span>
            <span>{session.entryCount} entries</span>
            <span>~{Math.round(session.tokenEstimate / 1000)}k tokens</span>
          </div>
        </button>
      ))}
    </div>
  )
}
```

#### 1.3 SessionResumeDialog Component

```typescript
// src/renderer/src/components/workJournal/SessionResumeDialog.tsx

import { useState, useCallback } from 'react'
import { X, Play, Loader2, FileText, AlertCircle } from 'lucide-react'
import { SessionList } from './SessionList'
import { useWorkJournal } from '../../hooks/useWorkJournal'

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

  const handleSelectSession = useCallback(async (session: WorkSession) => {
    setSelectedSession(session)
    setError(null)
    setIsGenerating(true)
    setResumptionContext(null)

    try {
      const context = await generateResumptionContext(session.id)
      setResumptionContext(context)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate resumption context')
    } finally {
      setIsGenerating(false)
    }
  }, [generateResumptionContext])

  const handleResume = useCallback(() => {
    if (selectedSession && resumptionContext) {
      onResume(selectedSession, resumptionContext)
      onClose()
    }
  }, [selectedSession, resumptionContext, onResume, onClose])

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
      />
      
      {/* Dialog */}
      <div className="relative bg-zinc-900 rounded-xl border border-zinc-700 shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-100">Resume Agent Session</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Session List (left) */}
          <div className="w-1/2 border-r border-zinc-700 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Interrupted Sessions</h3>
            <SessionList 
              onSelectSession={handleSelectSession}
              selectedSessionId={selectedSession?.id}
            />
          </div>

          {/* Context Preview (right) */}
          <div className="w-1/2 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Resumption Context</h3>
            
            {!selectedSession && (
              <div className="text-zinc-500 text-center py-8">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Select a session to preview its context</p>
              </div>
            )}

            {isGenerating && (
              <div className="text-zinc-500 text-center py-8">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                <p>Generating resumption context...</p>
              </div>
            )}

            {error && (
              <div className="text-red-400 text-center py-8">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p>{error}</p>
              </div>
            )}

            {resumptionContext && (
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium text-zinc-300 mb-1">Work Summary</h4>
                  <p className="text-zinc-400">{resumptionContext.workSummary}</p>
                </div>

                {resumptionContext.keyDecisions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-zinc-300 mb-1">Key Decisions</h4>
                    <ul className="list-disc list-inside text-zinc-400 space-y-1">
                      {resumptionContext.keyDecisions.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="font-medium text-zinc-300 mb-1">Current State</h4>
                  <p className="text-zinc-400">{resumptionContext.currentState}</p>
                </div>

                {resumptionContext.filesModified.length > 0 && (
                  <div>
                    <h4 className="font-medium text-zinc-300 mb-1">Files Modified</h4>
                    <div className="flex flex-wrap gap-1">
                      {resumptionContext.filesModified.map((f, i) => (
                        <span key={i} className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
                          {f.split('/').pop()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {resumptionContext.pendingActions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-zinc-300 mb-1">Pending Actions</h4>
                    <ul className="list-disc list-inside text-zinc-400 space-y-1">
                      {resumptionContext.pendingActions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-700 text-zinc-500">
                  Context size: ~{Math.round(resumptionContext.tokenCount / 1000)}k tokens
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-700">
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
  )
}
```

---

### Part 2: Work Journal Panel (1.5 hours)

#### 2.1 EntryCard Component

```typescript
// src/renderer/src/components/workJournal/EntryCard.tsx

import { useState } from 'react'
import { 
  Brain, Wrench, CheckCircle, XCircle, FileText, 
  AlertTriangle, ChevronDown, ChevronRight, Clock
} from 'lucide-react'

interface EntryCardProps {
  entry: WorkEntry
}

export function EntryCard({ entry }: EntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const content = entry.content as Record<string, unknown>

  const getIcon = () => {
    switch (entry.entryType) {
      case 'thinking': return <Brain className="w-4 h-4 text-violet-400" />
      case 'tool_request': return <Wrench className="w-4 h-4 text-blue-400" />
      case 'tool_result': 
        return content.success 
          ? <CheckCircle className="w-4 h-4 text-green-400" />
          : <XCircle className="w-4 h-4 text-red-400" />
      case 'file_read':
      case 'file_written': return <FileText className="w-4 h-4 text-amber-400" />
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-400" />
      default: return <Clock className="w-4 h-4 text-zinc-400" />
    }
  }

  const getTitle = () => {
    switch (entry.entryType) {
      case 'thinking': return 'AI Thinking'
      case 'tool_request': return `Tool: ${content.toolName}`
      case 'tool_result': return `Result: ${content.toolName}`
      case 'file_read': return `Read: ${(content.filePath as string)?.split('/').pop()}`
      case 'file_written': return `Write: ${(content.filePath as string)?.split('/').pop()}`
      case 'error': return `Error: ${content.errorType}`
      default: return entry.entryType
    }
  }

  const getPreview = () => {
    switch (entry.entryType) {
      case 'thinking':
        const reasoning = content.reasoning as string
        return reasoning?.slice(0, 100) + (reasoning?.length > 100 ? '...' : '')
      case 'tool_request':
        return JSON.stringify(content.toolInput).slice(0, 80)
      case 'tool_result':
        const output = content.output as string
        return output?.slice(0, 100) + (output?.length > 100 ? '...' : '')
      case 'error':
        return content.message as string
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
          {isExpanded 
            ? <ChevronDown className="w-4 h-4 text-zinc-500" />
            : <ChevronRight className="w-4 h-4 text-zinc-500" />
          }
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
```

#### 2.2 WorkJournalPanel Component

```typescript
// src/renderer/src/components/workJournal/WorkJournalPanel.tsx

import { useState } from 'react'
import { 
  BookOpen, X, ChevronLeft, ChevronRight, 
  Download, Trash2, Flag, RefreshCw
} from 'lucide-react'
import { useWorkSession } from '../../hooks/useWorkSession'
import { EntryCard } from './EntryCard'
import { SessionHeader } from './SessionHeader'

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

  const filteredEntries = filter 
    ? entries.filter(e => e.entryType === filter)
    : entries

  const entryTypes = [...new Set(entries.map(e => e.entryType))]

  const handleExport = async () => {
    if (!session) return
    
    const data = {
      session,
      entries,
      exportedAt: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `session-${session.id.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="
          fixed right-0 top-1/2 -translate-y-1/2 z-40
          bg-zinc-800 border border-zinc-700 border-r-0
          rounded-l-lg p-2 hover:bg-zinc-700 transition-colors
        "
        title="Open Work Journal"
      >
        <BookOpen className="w-5 h-5 text-zinc-400" />
      </button>
    )
  }

  return (
    <div className="
      fixed right-0 top-0 h-full w-80 z-40
      bg-zinc-900 border-l border-zinc-700
      flex flex-col shadow-xl
    ">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-violet-400" />
          <span className="font-medium text-zinc-200">Work Journal</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => refreshEntries()}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Session Header */}
      {session && <SessionHeader session={session} />}

      {/* Filter */}
      {entryTypes.length > 1 && (
        <div className="px-3 py-2 border-b border-zinc-800">
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFilter(null)}
              className={`
                px-2 py-0.5 rounded text-xs transition-colors
                ${!filter ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}
              `}
            >
              All
            </button>
            {entryTypes.map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`
                  px-2 py-0.5 rounded text-xs transition-colors
                  ${filter === type ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}
                `}
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Entry List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!sessionId && (
          <div className="text-center text-zinc-500 py-8">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No active session</p>
            <p className="text-sm mt-1">Start an agent to see work entries</p>
          </div>
        )}
        
        {sessionId && filteredEntries.length === 0 && (
          <div className="text-center text-zinc-500 py-8">
            <p>No entries yet</p>
          </div>
        )}

        {filteredEntries.map(entry => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>

      {/* Actions */}
      {session && (
        <div className="p-3 border-t border-zinc-700 flex gap-2">
          <button
            onClick={() => createCheckpoint()}
            disabled={!isActive}
            className="
              flex-1 flex items-center justify-center gap-2 
              px-3 py-2 rounded-lg text-sm
              bg-zinc-800 text-zinc-300 hover:bg-zinc-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
          >
            <Flag className="w-4 h-4" />
            Checkpoint
          </button>
          <button
            onClick={handleExport}
            className="
              p-2 rounded-lg bg-zinc-800 text-zinc-300 
              hover:bg-zinc-700 transition-colors
            "
            title="Export Session"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
```

#### 2.3 SessionHeader Component

```typescript
// src/renderer/src/components/workJournal/SessionHeader.tsx

import { Activity, Pause, CheckCircle, AlertTriangle } from 'lucide-react'

interface SessionHeaderProps {
  session: WorkSession
}

export function SessionHeader({ session }: SessionHeaderProps) {
  const getStatusBadge = () => {
    const badges = {
      active: { icon: Activity, color: 'text-green-400 bg-green-400/10', label: 'Active' },
      paused: { icon: Pause, color: 'text-amber-400 bg-amber-400/10', label: 'Paused' },
      completed: { icon: CheckCircle, color: 'text-blue-400 bg-blue-400/10', label: 'Completed' },
      crashed: { icon: AlertTriangle, color: 'text-red-400 bg-red-400/10', label: 'Crashed' }
    }
    const badge = badges[session.status] || badges.active
    const Icon = badge.icon
    
    return (
      <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    )
  }

  return (
    <div className="p-3 border-b border-zinc-800 bg-zinc-800/30">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-zinc-300 line-clamp-2">
          {session.originalPrompt}
        </p>
        {getStatusBadge()}
      </div>
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span>{session.entryCount} entries</span>
        <span>~{Math.round(session.tokenEstimate / 1000)}k tokens</span>
      </div>
    </div>
  )
}
```

---

### Part 3: Integration with Agent System (1.5 hours)

#### 3.1 Add Resumption to AgentContext

Modify `src/renderer/src/contexts/AgentContext.tsx`:

```typescript
// Add to AgentContextType interface:
createAgentWithResumption: (
  conversationId: string,
  session: WorkSession,
  context: ResumptionContext
) => Agent

// Add implementation:
const createAgentWithResumption = useCallback((
  conversationId: string,
  session: WorkSession,
  context: ResumptionContext
): Agent => {
  // Build resumption system prompt addition
  const resumptionPrompt = `
## Resuming Previous Work Session

You are resuming an interrupted work session. Here is the context:

**Original Task:**
${context.originalPrompt}

**Work Summary:**
${context.workSummary}

**Current State:**
${context.currentState}

${context.keyDecisions.length > 0 ? `**Key Decisions Made:**
${context.keyDecisions.map(d => `- ${d}`).join('\n')}` : ''}

${context.filesModified.length > 0 ? `**Files Modified:**
${context.filesModified.map(f => `- ${f}`).join('\n')}` : ''}

${context.pendingActions.length > 0 ? `**Pending Actions:**
${context.pendingActions.map(a => `- ${a}`).join('\n')}` : ''}

${context.errorHistory.length > 0 ? `**Previous Errors:**
${context.errorHistory.map(e => `- ${e}`).join('\n')}` : ''}

${context.suggestedNextSteps.length > 0 ? `**Suggested Next Steps:**
${context.suggestedNextSteps.map(s => `- ${s}`).join('\n')}` : ''}

Please continue from where the previous session left off. Acknowledge the resumption briefly, then proceed with the remaining work.
`.trim()

  // Create agent with enhanced instructions
  const agent = createAgent(conversationId, {
    name: `Resumed: ${session.originalPrompt.slice(0, 30)}...`,
    instructions: resumptionPrompt,
    toolPermission: 'standard',
    modelId: 'gemini-2.5-flash' // or retrieve from session
  })

  // Mark as resumption in agent metadata
  agent.metadata = {
    ...agent.metadata,
    resumedFromSession: session.id,
    resumedAt: Date.now()
  }

  return agent
}, [createAgent])
```

#### 3.2 Add Resume Button to AgentPanel

In `src/renderer/src/components/agents/AgentPanel.tsx`, add a "Resume Session" button that opens the dialog:

```typescript
// Add state and handler
const [showResumeDialog, setShowResumeDialog] = useState(false)

const handleResume = useCallback((session: WorkSession, context: ResumptionContext) => {
  const agent = createAgentWithResumption(
    currentConversationId,
    session,
    context
  )
  // Switch to the new agent
  setActiveAgent(agent.id)
}, [currentConversationId, createAgentWithResumption, setActiveAgent])

// Add to JSX
<button
  onClick={() => setShowResumeDialog(true)}
  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700"
>
  <RotateCcw className="w-4 h-4" />
  Resume Session
</button>

<SessionResumeDialog
  isOpen={showResumeDialog}
  onClose={() => setShowResumeDialog(false)}
  onResume={handleResume}
/>
```

#### 3.3 Update Barrel Exports

Update `src/renderer/src/components/workJournal/index.ts`:

```typescript
export { WorkJournalProvider, useWorkJournalContext } from './WorkJournalProvider'
export { WorkJournalPanel } from './WorkJournalPanel'
export { SessionResumeDialog } from './SessionResumeDialog'
export { SessionList } from './SessionList'
export { EntryCard } from './EntryCard'
export { SessionHeader } from './SessionHeader'
```

---

## Verification Steps

1. **TypeScript compilation**: `npm run typecheck`
2. **Development server**: `npm run dev`
3. **Functional tests**:

### Test Scenarios

| Test | Expected Result |
|------|-----------------|
| Open Resume Dialog with no sessions | Shows "No interrupted sessions" message |
| Start agent, pause it, open Resume Dialog | Shows paused session in list |
| Select session in dialog | Generates and displays resumption context |
| Click "Resume Session" | Creates new agent with resumption context |
| Open Work Journal Panel | Shows current session entries |
| Create manual checkpoint | Checkpoint logged, success toast |
| Export session | Downloads JSON file |
| Filter entries by type | Shows only selected type |

---

## Success Criteria

- [ ] Resume Dialog lists paused/crashed sessions
- [ ] Session selection generates resumption context
- [ ] Resume creates agent with injected context
- [ ] Work Journal Panel shows live entries
- [ ] Entry cards expand to show details
- [ ] Filtering works correctly
- [ ] Manual checkpoint creation works
- [ ] Session export generates valid JSON
- [ ] TypeScript compiles without errors
- [ ] No memory leaks (subscriptions cleaned up)

---

## Key Implementation Notes

1. **Resumption Context Quality**: The context generation in WorkJournalManager should prioritize recent and high-importance entries. Consider adding AI summarization in Phase 6.

2. **Panel State Persistence**: Consider persisting the panel open/closed state in localStorage.

3. **Real-time Updates**: The WorkJournalProvider already handles real-time subscription via IPC events. The panel should update automatically.

4. **Entry Virtualization**: For sessions with many entries (100+), consider using a virtualized list component like `react-window` for performance.

5. **Error Recovery**: If resumption context generation fails, show error but don't block - user can still view session details.

---

## Future Enhancements (Out of Scope)

- AI-powered summarization for resumption context (Phase 6)
- Session comparison view
- Entry search within sessions
- Session archiving and cleanup
- Multi-session timeline view

Please begin Phase 5 implementation.
