# Agent Work Journal — Design Document

## Problem Statement

AI agents operating within ArborChat face fundamental constraints:

1. **Context Window Limits**: All LLMs have finite context windows (8K-2M tokens depending on model)
2. **Work Loss Risk**: When context overflows or sessions crash, all in-progress work is lost
3. **Session Discontinuity**: Users cannot seamlessly resume complex multi-step agent tasks
4. **No Audit Trail**: There's no persistent record of what the agent attempted, succeeded at, or failed

## Design Goals

| Goal | Description |
|------|-------------|
| **Real-time Capture** | Log work as it happens, not after completion |
| **Survivability** | Work persists through crashes, context overflow, and app restarts |
| **Resumability** | Enable seamless pickup of work in new sessions |
| **Compression** | Intelligently summarize work to fit in fresh context windows |
| **Transparency** | Users can see exactly what the agent has done |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RENDERER PROCESS                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │  ChatWindow     │  │  WorkJournal    │  │  SessionResume      │  │
│  │  (integrates    │  │  Panel          │  │  Dialog             │  │
│  │   journaling)   │  │  (live view)    │  │  (pickup work)      │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
│           │                    │                      │             │
│  ┌────────┴────────────────────┴──────────────────────┴──────────┐  │
│  │                    useWorkJournal Hook                        │  │
│  │  - subscribeToEntries()  - createCheckpoint()                 │  │
│  │  - getSessionSummary()   - exportForResumption()              │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
│                              │ IPC                                  │
├──────────────────────────────┼──────────────────────────────────────┤
│                         MAIN PROCESS                                │
│                              │                                      │
│  ┌───────────────────────────┴───────────────────────────────────┐  │
│  │                   WorkJournalManager                          │  │
│  │  - logEntry()           - createSession()                     │  │
│  │  - getSession()         - summarizeSession()                  │  │
│  │  - generateResumptionContext()                                │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────┴───────────────────────────────────┐  │
│  │                   SQLite Database                             │  │
│  │  work_sessions | work_entries | checkpoints | resumption_ctx  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Database Schema

```sql
-- Work Sessions: Top-level container for agent work
CREATE TABLE work_sessions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    original_prompt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, paused, completed, crashed
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER,
    token_estimate INTEGER DEFAULT 0,
    entry_count INTEGER DEFAULT 0,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Work Entries: Individual logged actions (append-only for durability)
CREATE TABLE work_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    sequence_num INTEGER NOT NULL,
    entry_type TEXT NOT NULL, -- see EntryType enum
    timestamp INTEGER NOT NULL,
    content TEXT NOT NULL, -- JSON payload
    token_estimate INTEGER DEFAULT 0,
    importance TEXT DEFAULT 'normal', -- low, normal, high, critical
    
    FOREIGN KEY (session_id) REFERENCES work_sessions(id)
);

-- Checkpoints: Periodic snapshots for efficient resumption
CREATE TABLE work_checkpoints (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    summary TEXT NOT NULL,
    key_decisions TEXT, -- JSON array of critical decisions made
    current_state TEXT, -- JSON describing where we are in the task
    files_modified TEXT, -- JSON array of file paths
    pending_actions TEXT, -- JSON array of next steps
    
    FOREIGN KEY (session_id) REFERENCES work_sessions(id)
);

-- Indexes for efficient querying
CREATE INDEX idx_entries_session ON work_entries(session_id, sequence_num);
CREATE INDEX idx_sessions_conversation ON work_sessions(conversation_id);
CREATE INDEX idx_sessions_status ON work_sessions(status);
```

---

## TypeScript Types


```typescript
// src/shared/types/workJournal.ts

export type WorkSessionStatus = 'active' | 'paused' | 'completed' | 'crashed';

export type EntryImportance = 'low' | 'normal' | 'high' | 'critical';

export type EntryType = 
  | 'session_start'      // Initial prompt and context
  | 'thinking'           // Agent's reasoning/planning
  | 'tool_request'       // Tool call initiated
  | 'tool_approved'      // User approved tool
  | 'tool_rejected'      // User rejected tool
  | 'tool_result'        // Tool execution result
  | 'code_generated'     // Code the agent wrote
  | 'file_read'          // File content retrieved
  | 'file_written'       // File created/modified
  | 'decision'           // Key decision point
  | 'error'              // Error encountered
  | 'recovery'           // Recovery from error
  | 'checkpoint'         // Manual or auto checkpoint
  | 'user_feedback'      // User interjection/correction
  | 'summary'            // Periodic work summary
  | 'session_end';       // Work completed or stopped

export interface WorkEntry {
  id: number;
  sessionId: string;
  sequenceNum: number;
  entryType: EntryType;
  timestamp: number;
  content: EntryContent;
  tokenEstimate: number;
  importance: EntryImportance;
}

// Discriminated union for type-safe entry content
export type EntryContent = 
  | SessionStartContent
  | ThinkingContent
  | ToolRequestContent
  | ToolResultContent
  | CodeGeneratedContent
  | FileOperationContent
  | DecisionContent
  | ErrorContent
  | CheckpointContent
  | SummaryContent;

export interface SessionStartContent {
  type: 'session_start';
  originalPrompt: string;
  systemContext?: string;
  selectedModel: string;
  selectedPersona?: string;
}

export interface ThinkingContent {
  type: 'thinking';
  reasoning: string;
  planSteps?: string[];
}

export interface ToolRequestContent {
  type: 'tool_request';
  toolName: string;
  toolInput: Record<string, unknown>;
  riskLevel: 'safe' | 'moderate' | 'dangerous';
}

export interface ToolResultContent {
  type: 'tool_result';
  toolName: string;
  success: boolean;
  output: string;
  truncated: boolean;
  errorMessage?: string;
}

export interface CodeGeneratedContent {
  type: 'code_generated';
  language: string;
  code: string;
  purpose: string;
  filePath?: string;
}

export interface FileOperationContent {
  type: 'file_read' | 'file_written';
  filePath: string;
  operation: 'read' | 'create' | 'modify' | 'delete';
  contentPreview?: string;
  linesAffected?: number;
}

export interface DecisionContent {
  type: 'decision';
  question: string;
  chosenOption: string;
  alternatives?: string[];
  reasoning: string;
}

export interface ErrorContent {
  type: 'error';
  errorType: string;
  message: string;
  recoverable: boolean;
  stackTrace?: string;
}

export interface CheckpointContent {
  type: 'checkpoint';
  checkpointId: string;
  summary: string;
  completedTasks: string[];
  pendingTasks: string[];
}

export interface SummaryContent {
  type: 'summary';
  periodCovered: { start: number; end: number };
  accomplishments: string[];
  currentStatus: string;
  nextSteps: string[];
}

// Session and checkpoint types
export interface WorkSession {
  id: string;
  conversationId: string;
  originalPrompt: string;
  status: WorkSessionStatus;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  tokenEstimate: number;
  entryCount: number;
}

export interface WorkCheckpoint {
  id: string;
  sessionId: string;
  createdAt: number;
  summary: string;
  keyDecisions: string[];
  currentState: string;
  filesModified: string[];
  pendingActions: string[];
}

// Resumption context - what gets passed to new session
export interface ResumptionContext {
  originalPrompt: string;
  workSummary: string;
  keyDecisions: string[];
  currentState: string;
  filesModified: string[];
  pendingActions: string[];
  errorHistory: string[];
  suggestedNextSteps: string[];
  tokenCount: number;
}
```

---

## Implementation Phases

| Phase | Description | Estimate |
|-------|-------------|----------|
| **Phase 1** | Database schema + WorkJournalManager core | 4-6 hours |
| **Phase 2** | IPC handlers + preload API | 2-3 hours |
| **Phase 3** | useWorkJournal hook + basic integration | 3-4 hours |
| **Phase 4** | WorkJournalPanel UI component | 3-4 hours |
| **Phase 5** | SessionResumeDialog + resumption flow | 4-5 hours |
| **Phase 6** | AI summarization integration | 3-4 hours |
| **Phase 7** | ChatWindow integration + testing | 4-6 hours |
| **Phase 8** | Polish, edge cases, performance | 3-4 hours |

**Total Estimate: 26-36 hours**

---

## Phase 1 Details: Database Schema + WorkJournalManager Core

### Files to Create

1. `src/shared/types/workJournal.ts` - TypeScript types (see above)
2. `src/main/services/WorkJournalManager.ts` - Core service class
3. Database migration for work journal tables

### WorkJournalManager Core Methods

```typescript
class WorkJournalManager {
  // Session Management
  createSession(conversationId: string, originalPrompt: string): WorkSession
  getSession(sessionId: string): WorkSession | null
  getActiveSession(conversationId: string): WorkSession | null
  updateSessionStatus(sessionId: string, status: WorkSessionStatus): void
  
  // Entry Logging (Real-time, append-only)
  logEntry(sessionId: string, entryType: EntryType, content: EntryContent, importance?: EntryImportance): WorkEntry
  getEntries(sessionId: string, options?: { since?: number; limit?: number; importance?: EntryImportance[] }): WorkEntry[]
  
  // Checkpointing
  createCheckpoint(sessionId: string, options?: { manual?: boolean }): Promise<WorkCheckpoint>
  getLatestCheckpoint(sessionId: string): WorkCheckpoint | null
  
  // Resumption
  generateResumptionContext(sessionId: string, targetTokens?: number): Promise<ResumptionContext>
  
  // Real-time Subscription
  subscribe(sessionId: string, callback: (entry: WorkEntry) => void): () => void
}
```

---

## Phase 2 Details: IPC Handlers + Preload API

### IPC Channels

- `work-journal:create-session`
- `work-journal:get-session`
- `work-journal:get-active-session`
- `work-journal:update-session-status`
- `work-journal:log-entry`
- `work-journal:get-entries`
- `work-journal:create-checkpoint`
- `work-journal:get-latest-checkpoint`
- `work-journal:generate-resumption-context`
- `work-journal:subscribe` (uses webContents for real-time)
- `work-journal:unsubscribe`

### Preload API Shape

```typescript
window.workJournalApi = {
  createSession,
  getSession,
  getActiveSession,
  updateSessionStatus,
  logEntry,
  getEntries,
  createCheckpoint,
  getLatestCheckpoint,
  generateResumptionContext,
  subscribeToEntries
}
```

---

## Phase 3 Details: useWorkJournal Hook

### Hook Interface

```typescript
function useWorkJournal({ conversationId, autoSubscribe }): {
  // State
  session: WorkSession | null;
  entries: WorkEntry[];
  latestCheckpoint: WorkCheckpoint | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  startSession: (originalPrompt: string) => Promise<WorkSession>;
  logEntry: (entryType, content, importance?) => Promise<WorkEntry | null>;
  createCheckpoint: () => Promise<WorkCheckpoint | null>;
  generateResumptionContext: (targetTokens?) => Promise<ResumptionContext | null>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  completeSession: () => Promise<void>;
  
  // Utilities
  getTokenEstimate: () => number;
  isApproachingLimit: (threshold?) => boolean;
}
```

---

## Security Considerations

1. **Data at Rest**: Journal entries may contain sensitive information. Consider encryption.
2. **Truncation**: Always truncate large outputs to prevent database bloat.
3. **User Control**: Users should be able to delete entries, clear sessions, export journals.
4. **Memory Management**: Implement periodic cleanup of old sessions.

---

## Open Questions

1. **Checkpoint Frequency**: Entry count (50), token count, or time elapsed?
2. **Summarization Model**: Same as user selected, or always use Gemini Flash?
3. **UI Placement**: Collapsible sidebar, modal, or separate tab?
4. **Cross-Conversation Resumption**: Resume work from one conversation in another?
