# Phase 4 Completion Prompt

**Project:** ArborChat (`/Users/cory.naegle/ArborChat`)  
**Persona:** Alex Chen - Distinguished Software Architect

---

## Context

You are completing Phase 4 (Advanced Capabilities) for ArborChat's agent system. The library modules are fully implemented but UI integration is incomplete.

## Status

### ✅ COMPLETE - Library Files:
- `src/renderer/src/lib/projectContext.ts` - Project structure analysis
- `src/renderer/src/lib/fileRelevance.ts` - Smart file selection  
- `src/renderer/src/lib/multiFileOrchestrator.ts` - Multi-file operations
- `src/renderer/src/hooks/useCheckpointRestore.ts` - Checkpoint restoration
- `src/renderer/src/contexts/AgentContext.tsx` - Has `createAgentWithAdvancedContext()` method

### ✅ PARTIAL - AgentLaunchModal.tsx:
- Has Phase 4 state: `autoAnalyzeProject`, `enableOrchestration`, `selectedCheckpoint`, `availableCheckpoints`
- Has imports: `Settings2`, `History`, `Layers`, `Files`
- Has `onLaunch` prop with Phase 4 fields

### ❌ MISSING:

1. **AgentLaunchModal.tsx** - No UI elements for Phase 4 options
2. **AgentLaunchModal.tsx** - `handleSubmit` doesn't pass Phase 4 options to `onLaunch`
3. **App.tsx** - `handleAgentCreate` doesn't accept or use Phase 4 options

---

## Task 1: Add Phase 4 UI to AgentLaunchModal.tsx

**File:** `/Users/cory.naegle/ArborChat/src/renderer/src/components/agent/AgentLaunchModal.tsx`

Find the form section after "Git Scope Options" (around line 550-600) and add this Phase 4 UI section before the action buttons:

```tsx
{/* Phase 4: Advanced Capabilities */}
{workingDirectory && (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <Settings2 size={14} className="text-violet-400" />
      <label className="text-xs font-medium text-text-muted">
        Advanced Capabilities
      </label>
    </div>
    
    <div className="space-y-2 p-3 bg-violet-500/5 rounded-lg border border-violet-500/20">
      {/* Auto-Analyze Project */}
      <label className="flex items-center justify-between cursor-pointer group">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-text-muted" />
          <span className="text-sm text-text-muted group-hover:text-text-normal transition-colors">
            Auto-analyze project structure
          </span>
        </div>
        <input
          type="checkbox"
          checked={autoAnalyzeProject}
          onChange={(e) => setAutoAnalyzeProject(e.target.checked)}
          className="w-4 h-4 rounded border-secondary bg-secondary/50 text-violet-500 focus:ring-violet-500/30"
        />
      </label>
      <p className="text-xs text-text-muted/70 ml-6">
        Detect project type, framework, and inject config context
      </p>
      
      {/* Multi-File Orchestration */}
      <label className="flex items-center justify-between cursor-pointer group mt-2">
        <div className="flex items-center gap-2">
          <Files size={14} className="text-text-muted" />
          <span className="text-sm text-text-muted group-hover:text-text-normal transition-colors">
            Enable multi-file orchestration
          </span>
        </div>
        <input
          type="checkbox"
          checked={enableOrchestration}
          onChange={(e) => setEnableOrchestration(e.target.checked)}
          className="w-4 h-4 rounded border-secondary bg-secondary/50 text-violet-500 focus:ring-violet-500/30"
        />
      </label>
      <p className="text-xs text-text-muted/70 ml-6">
        Plan complex multi-file changes with dependency awareness
      </p>
      
      {/* Resume Previous Session */}
      {availableCheckpoints.length > 0 && (
        <div className="mt-3 pt-3 border-t border-violet-500/10">
          <label className="flex items-center gap-2 text-sm text-text-muted mb-2">
            <History size={14} />
            Resume previous session
          </label>
          <select
            value={selectedCheckpoint || ''}
            onChange={(e) => setSelectedCheckpoint(e.target.value || null)}
            className="w-full bg-secondary/50 text-text-normal text-sm px-3 py-2 rounded-lg border border-secondary/50 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          >
            <option value="">Start fresh</option>
            {availableCheckpoints.map(cp => (
              <option key={cp.sessionId} value={cp.sessionId}>
                {new Date(cp.timestamp).toLocaleDateString()} - {cp.summary.slice(0, 40)}...
              </option>
            ))}
          </select>
        </div>
      )}
      {isLoadingCheckpoints && (
        <div className="flex items-center gap-2 text-xs text-text-muted mt-2">
          <Loader2 size={12} className="animate-spin" />
          Loading previous sessions...
        </div>
      )}
    </div>
  </div>
)}
```

---

## Task 2: Update handleSubmit in AgentLaunchModal.tsx

Find `handleSubmit` (around line 206) and update the `onLaunch` call to include Phase 4 options:

**Current (incomplete):**
```tsx
onLaunch({
  instructions,
  name: agentName || undefined,
  toolPermission,
  contextOptions,
  workingDirectory,
  gitContext
})
```

**Updated (with Phase 4):**
```tsx
onLaunch({
  instructions,
  name: agentName || undefined,
  toolPermission,
  contextOptions,
  workingDirectory,
  gitContext,
  // Phase 4: Advanced capabilities
  autoAnalyzeProject: workingDirectory ? autoAnalyzeProject : false,
  enableMultiFileOrchestration: enableOrchestration,
  checkpointToRestore: selectedCheckpoint || undefined,
  contextTokenBudget: selectedTemplate?.contextTokenBudget
})
```

---

## Task 3: Update App.tsx handleAgentCreate

**File:** `/Users/cory.naegle/ArborChat/src/renderer/src/App.tsx`

Find `handleAgentCreate` (around line 236) and update it to:

1. Accept Phase 4 options in the config type
2. Use `createAgentWithAdvancedContext` when Phase 4 features are enabled

**Replace the entire handleAgentCreate function with:**

```tsx
// Handle agent creation from modal
const handleAgentCreate = useCallback(async (config: {
  instructions: string
  name?: string
  toolPermission: AgentToolPermission
  contextOptions: {
    includeCurrentMessage: boolean
    includeParentContext: boolean
    parentContextDepth: number
    includeFullConversation: boolean
    includePersona: boolean
  }
  workingDirectory: string
  gitContext?: GitContext
  // Phase 4: Advanced capabilities
  autoAnalyzeProject?: boolean
  enableMultiFileOrchestration?: boolean
  checkpointToRestore?: string
  contextTokenBudget?: number
}) => {
  if (!activeId) return

  // Convert messages to agent format
  const conversationMessages: AgentMessage[] = allMessages.map(m => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    timestamp: m.created_at
  }))

  const agentOptions = {
    name: config.name,
    instructions: config.instructions,
    conversationId: activeId,
    sourceMessageContent: agentLaunchContext,
    model: selectedModel,
    toolPermission: config.toolPermission,
    workingDirectory: config.workingDirectory,
    personaId: config.contextOptions.includePersona ? activePersonaId || undefined : undefined,
    personaContent: config.contextOptions.includePersona ? activePersonaContent || undefined : undefined,
    includeCurrentMessage: config.contextOptions.includeCurrentMessage,
    includeParentContext: config.contextOptions.includeParentContext,
    parentContextDepth: config.contextOptions.parentContextDepth,
    includeFullConversation: config.contextOptions.includeFullConversation,
    includePersona: config.contextOptions.includePersona,
    conversationMessages,
    // Phase 4
    autoAnalyzeProject: config.autoAnalyzeProject,
    enableMultiFileOrchestration: config.enableMultiFileOrchestration,
    checkpointToRestore: config.checkpointToRestore,
    contextTokenBudget: config.contextTokenBudget
  }

  // Use async version if Phase 4 features are enabled
  if (config.autoAnalyzeProject || config.checkpointToRestore) {
    await agentContext.createAgentWithAdvancedContext(agentOptions)
  } else {
    agentContext.createAgent(agentOptions)
  }

  setShowAgentLaunchModal(false)
  setAgentLaunchContext(undefined)
}, [activeId, allMessages, agentLaunchContext, selectedModel, activePersonaId, activePersonaContent, agentContext])
```

**Also add GitContext import if missing:**
```tsx
import type { AgentToolPermission, AgentMessage, GitContext } from './types/agent'
```

---

## Task 4: Verify and Test

```bash
cd /Users/cory.naegle/ArborChat && npm run typecheck
```

Fix any type errors that arise.

---

## Implementation Order

1. Read current state of AgentLaunchModal.tsx (around lines 550-650 for form UI)
2. Add Phase 4 UI section 
3. Update handleSubmit to pass Phase 4 options
4. Read App.tsx handleAgentCreate
5. Update handleAgentCreate with async/await and Phase 4 support
6. Run typecheck
7. Fix any errors

---

## Key Files

- `/Users/cory.naegle/ArborChat/src/renderer/src/components/agent/AgentLaunchModal.tsx`
- `/Users/cory.naegle/ArborChat/src/renderer/src/App.tsx`
- `/Users/cory.naegle/ArborChat/src/renderer/src/contexts/AgentContext.tsx` (reference only)
- `/Users/cory.naegle/ArborChat/src/renderer/src/types/agent.ts` (reference only)

---

Enter **Alex Chen mode** and complete the integration.
