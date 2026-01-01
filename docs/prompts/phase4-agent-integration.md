# Phase 4 Prompt: Agent Integration

Copy everything below this line to start Phase 4 in a new window:

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

## Task: Agent Work Journal System - Phase 4

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

---

## Phase 4: Agent Integration

**Estimate:** 3-4 hours

### Goal

Connect the Work Journal system to the Agent Execution Engine (`useAgentRunner.ts`) so that all agent work is automatically logged. This creates the persistent record that enables:

1. **Crash Recovery** — Work survives unexpected termination
2. **Session Resumption** — Users can pick up where they left off
3. **Audit Trail** — Full visibility into what the agent did
4. **Context Compression** — Summarize work for fresh context windows

### Reference Files (Read First)

Study these files to understand the integration points:

```
src/renderer/src/hooks/useAgentRunner.ts          — Agent execution engine (MODIFY)
src/renderer/src/hooks/useWorkJournal.ts          — Work journal hook (USE)
src/renderer/src/hooks/useWorkSession.ts          — Session-specific hook (USE)
src/renderer/src/contexts/AgentContext.tsx        — Agent state management (REFERENCE)
src/renderer/src/components/mcp/MCPProvider.tsx   — Tool execution patterns (REFERENCE)
```

---

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        useAgentRunner                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   NEW: useWorkSession(sessionId)               │ │
│  │                                                                 │ │
│  │  On Agent Start:                                                │ │
│  │  └─► createSession(conversationId, instructions)               │ │
│  │                                                                 │ │
│  │  On Tool Request:                                               │ │
│  │  └─► logToolRequest(sessionId, toolName, args, riskLevel)      │ │
│  │                                                                 │ │
│  │  On Tool Result:                                                │ │
│  │  └─► logToolResult(sessionId, toolName, success, output)       │ │
│  │                                                                 │ │
│  │  On AI Response (with thinking):                                │ │
│  │  └─► logThinking(sessionId, reasoning, planSteps?)             │ │
│  │                                                                 │ │
│  │  On Error:                                                      │ │
│  │  └─► logError(sessionId, errorType, message, recoverable)      │ │
│  │                                                                 │ │
│  │  On File Operations:                                            │ │
│  │  └─► logFileOperation(sessionId, operation, path, preview?)    │ │
│  │                                                                 │ │
│  │  On Agent Complete/Stop:                                        │ │
│  │  └─► updateStatus(sessionId, 'completed' | 'crashed')          │ │
│  │  └─► createCheckpoint(sessionId)                               │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Integration Points in useAgentRunner.ts

| Location | What to Log | Hook Method |
|----------|-------------|-------------|
| `start()` | Session creation | `createSession()` |
| `executeLoop()` start | AI thinking/planning | `logThinking()` |
| `handleToolCall()` before exec | Tool request | `logToolRequest()` |
| `handleToolCall()` after exec | Tool result | `logToolResult()` |
| `handleToolCall()` on error | Error | `logError()` |
| Tool results with file paths | File operations | `logFileOperation()` |
| `stop()` | Session complete | `updateStatus('completed')` |
| `pause()` | Session paused | `updateStatus('paused')` |
| Error handler | Crash/failure | `updateStatus('crashed')`, `logError()` |
| Periodic (every N entries) | Checkpoint | `createCheckpoint()` |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/src/hooks/useAgentRunner.ts` | Add work journal integration |

### Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/src/hooks/useAgentJournal.ts` | Wrapper hook combining agent runner + journal |

---

### Implementation Strategy

**Option A: Direct Integration (Recommended)**
Modify `useAgentRunner.ts` directly to use `useWorkJournal` hooks. This keeps the agent execution and logging tightly coupled, which is appropriate since logging is integral to agent operation.

**Option B: Wrapper Hook**
Create `useAgentJournal.ts` that composes `useAgentRunner` with `useWorkJournal`. This adds indirection but keeps `useAgentRunner` unchanged.

**Recommendation:** Option A for simplicity. The work journal is not optional — all agent work should be logged.

---

### File 1: Modified `useAgentRunner.ts`

Add these imports at the top:

```typescript
import { useWorkJournal } from './useWorkJournal'
```

Add work journal initialization in the hook body:

```typescript
export function useAgentRunner(agentId: string): UseAgentRunnerResult {
  // ... existing context hooks ...
  
  // Work Journal Integration
  const {
    createSession,
    logThinking,
    logToolRequest,
    logToolResult,
    logError,
    logFileOperation,
    updateSessionStatus,
    createCheckpoint,
    activeSessionId
  } = useWorkJournal()
  
  // Track work session for this agent
  const workSessionIdRef = useRef<string | null>(null)
  const entryCountRef = useRef<number>(0)
  const CHECKPOINT_INTERVAL = 20 // Create checkpoint every N entries
  
  // ... rest of hook ...
}
```

---

### Integration Point 1: Session Creation (in `start()`)

```typescript
const start = useCallback(async () => {
  const agent = getAgentSafe()
  if (!agent) return
  
  // Create work journal session
  if (!workSessionIdRef.current) {
    try {
      const session = await createSession(
        agent.config.conversationId,
        agent.config.instructions
      )
      workSessionIdRef.current = session.id
      entryCountRef.current = 0
      console.log(`[AgentRunner] Created work session: ${session.id}`)
    } catch (err) {
      console.error('[AgentRunner] Failed to create work session:', err)
      // Continue anyway - journaling failure shouldn't block agent
    }
  }
  
  if (!mcpConnected) {
    console.warn('[AgentRunner] MCP not connected, starting anyway')
  }
  
  await executeLoop()
}, [getAgentSafe, mcpConnected, executeLoop, createSession])
```

---

### Integration Point 2: Tool Request Logging (in `handleToolCall()`)

```typescript
const handleToolCall = useCallback(async (
  agent: Agent,
  toolCall: { tool: string; args: Record<string, unknown>; explanation: string },
  originalContent: string,
  cleanContent: string
) => {
  if (!isMountedRef.current) return
  
  // Log tool request to work journal
  if (workSessionIdRef.current) {
    try {
      const riskLevel = getToolRiskLevel(toolCall.tool)
      await logToolRequest(
        workSessionIdRef.current,
        toolCall.tool,
        toolCall.args,
        riskLevel
      )
      entryCountRef.current++
      await maybeCreateCheckpoint()
    } catch (err) {
      console.error('[AgentRunner] Failed to log tool request:', err)
    }
  }
  
  // ... rest of existing handleToolCall logic ...
}, [/* ... existing deps ..., logToolRequest */])
```

---

### Integration Point 3: Tool Result Logging

After tool execution succeeds or fails, add:

```typescript
// After successful tool execution
if (workSessionIdRef.current) {
  try {
    await logToolResult(
      workSessionIdRef.current,
      toolCall.tool,
      result.success,
      result.result || '',
      {
        truncated: (result.result?.length || 0) > 5000,
        errorMessage: result.error,
        duration: executionDuration
      }
    )
    entryCountRef.current++
    
    // Check for file operations in the result
    await detectAndLogFileOperations(toolCall.tool, toolCall.args, result)
    
    await maybeCreateCheckpoint()
  } catch (err) {
    console.error('[AgentRunner] Failed to log tool result:', err)
  }
}
```

---

### Integration Point 4: Error Logging

In the error handler:

```typescript
window.api.onError((err) => {
  cleanup()
  
  if (!isMountedRef.current) {
    isExecutingRef.current = false
    return
  }
  
  console.error('[AgentRunner] AI Error:', err)
  
  // Log error to work journal
  if (workSessionIdRef.current) {
    logError(
      workSessionIdRef.current,
      'ai_error',
      err,
      true // recoverable via retry
    ).catch(console.error)
  }
  
  // ... rest of error handling ...
})
```

---

### Integration Point 5: Session Status Updates

In `stop()`:

```typescript
const stop = useCallback(() => {
  // ... existing cleanup ...
  
  // Complete work session
  if (workSessionIdRef.current) {
    updateSessionStatus(workSessionIdRef.current, 'completed')
      .then(() => createCheckpoint(workSessionIdRef.current!, true))
      .catch(console.error)
  }
  
  updateAgentStatus(agentId, 'completed')
  // ...
}, [/* ... deps ... */])
```

In `pause()`:

```typescript
const pause = useCallback(() => {
  // ... existing pause logic ...
  
  // Pause work session
  if (workSessionIdRef.current) {
    updateSessionStatus(workSessionIdRef.current, 'paused')
      .catch(console.error)
  }
  
  updateAgentStatus(agentId, 'paused')
  // ...
}, [/* ... deps ... */])
```

---

### Integration Point 6: Checkpoint Creation

Add a helper function:

```typescript
const maybeCreateCheckpoint = useCallback(async () => {
  if (!workSessionIdRef.current) return
  
  if (entryCountRef.current >= CHECKPOINT_INTERVAL) {
    try {
      await createCheckpoint(workSessionIdRef.current)
      entryCountRef.current = 0
      console.log('[AgentRunner] Created automatic checkpoint')
    } catch (err) {
      console.error('[AgentRunner] Failed to create checkpoint:', err)
    }
  }
}, [createCheckpoint])
```

---

### Integration Point 7: File Operation Detection

Add helper to detect file operations from tool results:

```typescript
const detectAndLogFileOperations = useCallback(async (
  toolName: string,
  args: Record<string, unknown>,
  result: { success: boolean; result?: string }
) => {
  if (!workSessionIdRef.current || !result.success) return
  
  // Map tool names to file operations
  const fileOpTools: Record<string, 'read' | 'create' | 'modify' | 'delete'> = {
    'read_file': 'read',
    'read_multiple_files': 'read',
    'write_file': 'create', // Could be create or modify
    'edit_block': 'modify',
    'str_replace': 'modify',
    'create_directory': 'create',
    'move_file': 'modify'
  }
  
  const operation = fileOpTools[toolName]
  if (!operation) return
  
  // Extract file path from args
  const filePath = (args.path || args.file_path || args.source) as string | undefined
  if (!filePath) return
  
  try {
    await logFileOperation(
      workSessionIdRef.current,
      operation,
      filePath,
      result.result?.substring(0, 200), // Preview
      undefined // lines affected - could parse from result
    )
    entryCountRef.current++
  } catch (err) {
    console.error('[AgentRunner] Failed to log file operation:', err)
  }
}, [logFileOperation])
```

---

### Integration Point 8: Cleanup

In `performCleanup()`:

```typescript
const performCleanup = useCallback(() => {
  console.log(`[AgentRunner ${agentId}] Performing cleanup...`)
  
  // Mark work session as crashed if still active
  if (workSessionIdRef.current) {
    // Fire-and-forget - we're cleaning up
    updateSessionStatus(workSessionIdRef.current, 'crashed')
      .then(() => {
        if (workSessionIdRef.current) {
          return createCheckpoint(workSessionIdRef.current, true)
        }
      })
      .catch(console.error)
  }
  
  // ... rest of existing cleanup ...
}, [agentId, clearAgentApprovals, updateSessionStatus, createCheckpoint])
```

---

### State Extension

Add work session ID to the return value for UI access:

```typescript
return {
  state: runnerState,
  workSessionId: workSessionIdRef.current, // NEW
  start,
  pause,
  resume,
  stop,
  retry,
  sendMessage,
  approveTool,
  rejectTool,
  canRetry: canRetry(),
  forceCleanup: performCleanup
}
```

Update the interface:

```typescript
export interface UseAgentRunnerResult {
  state: AgentRunnerState
  workSessionId: string | null // NEW
  start: () => Promise<void>
  pause: () => void
  resume: () => Promise<void>
  stop: () => void
  retry: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  approveTool: (modifiedArgs?: Record<string, unknown>) => Promise<void>
  rejectTool: () => void
  canRetry: boolean
  forceCleanup: () => void
}
```

---

## Verification Steps

1. **TypeScript compilation**: `npm run typecheck`
2. **Development server**: `npm run dev`
3. **Console output**: Should see work session creation logs

### Integration Test

1. Create a new agent with a simple task
2. Watch console for `[AgentRunner] Created work session: xxx`
3. Execute a tool - should see tool request/result logs
4. Stop the agent - should see completion and checkpoint
5. Check SQLite database for entries:

```bash
sqlite3 ~/Library/Application\ Support/ArborChat/arborchat.db \
  "SELECT * FROM work_sessions ORDER BY created_at DESC LIMIT 1;"
```

```bash
sqlite3 ~/Library/Application\ Support/ArborChat/arborchat.db \
  "SELECT entry_type, timestamp FROM work_entries WHERE session_id = 'xxx' ORDER BY sequence_num;"
```

---

## Success Criteria

- [ ] Work session created when agent starts
- [ ] Tool requests logged before execution
- [ ] Tool results logged after execution
- [ ] Errors logged with recoverable flag
- [ ] File operations detected and logged
- [ ] Session status updated on pause/stop/crash
- [ ] Automatic checkpoints created every N entries
- [ ] TypeScript compiles without errors
- [ ] No memory leaks (journal refs cleaned up)
- [ ] Journaling failures don't block agent execution

---

## Key Implementation Notes

1. **Non-Blocking Journaling**: All journal operations should be fire-and-forget or use `.catch()` to prevent blocking agent execution. The journal is an audit trail, not a critical path.

2. **Session Lifecycle**: 
   - Created in `start()` 
   - Updated in `pause()`/`resume()`
   - Completed in `stop()` 
   - Crashed in `performCleanup()` or error handler

3. **Checkpoint Strategy**: Use entry count (20 entries) as trigger. Could enhance with token count or time-based triggers later.

4. **File Operation Detection**: Map tool names to operation types. Desktop Commander tools have predictable patterns.

5. **Error Recovery**: If work journal operations fail, log to console but continue agent execution.

---

## Future Enhancements (Out of Scope)

- AI thinking extraction from responses (requires prompt engineering)
- Decision point detection (requires content analysis)
- Token counting integration for checkpoint triggers
- Resumption flow (Phase 5)
- Work Journal UI Panel (Phase 5+)

Please begin Phase 4 implementation.
