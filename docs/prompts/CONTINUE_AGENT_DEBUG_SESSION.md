# Continue Agent Debugging Session

**Author:** Alex Chen (Distinguished Software Architect)  
**Phase:** Agent System Debugging  
**Last Updated:** 2025-01-01

## Overview

You are debugging two issues in the ArborChat agent system. This document provides comprehensive chain analysis, diagnostic logging locations, and actionable debugging steps.

## Issue 1: Project Intelligence Not Injecting

### Problem Statement

When an agent is launched with `workingDirectory: /Users/cory.naegle/ArborChat`, the ArborChat-specific context should be injected into the system prompt, but verification shows it may not be occurring correctly.

### Complete Data Flow Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ RENDERER PROCESS                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  useAgentRunner.buildContextMessages(agent)                                 │
│      │                                                                       │
│      ├─→ Extract: agent.config.context.workingDirectory                     │
│      │   LOG: "[AgentRunner] Agent working directory: ..."                  │
│      │                                                                       │
│      ├─→ Check: mcpConnected (from useMCP hook)                            │
│      │   LOG: "[AgentRunner] mcpConnected: ..."                            │
│      │                                                                       │
│      └─→ Call: getSystemPrompt(workingDirectory)                           │
│          LOG: "[AgentRunner] Calling getSystemPrompt with workingDirectory" │
│                                                                              │
│  MCPProvider (src/renderer/src/components/mcp/MCPProvider.tsx)              │
│      │                                                                       │
│      └─→ getSystemPrompt = async (workingDirectory?) =>                    │
│              window.api.mcp.getSystemPrompt(workingDirectory)              │
│                                                                              │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ IPC via contextBridge
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PRELOAD SCRIPT (src/preload/index.ts:486-488)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  getSystemPrompt: (workingDirectory?: string) =>                            │
│      ipcRenderer.invoke('mcp:get-system-prompt', workingDirectory)          │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ IPC channel
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ipc.ts handler (src/main/mcp/ipc.ts:500-512)                               │
│      │                                                                       │
│      │  ipcMain.handle('mcp:get-system-prompt', async (_event, wd?) => {   │
│      │  LOG: "[MCP IPC] get-system-prompt called with workingDirectory: wd" │
│      │                                                                       │
│      └─→ generateEnhancedSystemPrompt(tools, workingDirectory)              │
│                                                                              │
│  prompts.ts (src/main/mcp/prompts.ts:163-181)                               │
│      │                                                                       │
│      │  LOG: "[MCP Prompts] generateEnhancedSystemPrompt called with wd"   │
│      ├─→ const projectContext = getProjectContext(workingDirectory)         │
│      │  LOG: "[MCP Prompts] projectContext returned: N chars | null"        │
│      │                                                                       │
│      └─→ If projectContext: prepend to toolPrompt                           │
│          LOG: "[MCP Prompts] ✅ Injecting project context for: wd"          │
│                                                                              │
│  projectAnalyzer/index.ts (src/main/projectAnalyzer/index.ts:22-34)         │
│      │                                                                       │
│      │  LOG: "[ProjectAnalyzer] getProjectContext called with: wd"          │
│      │                                                                       │
│      └─→ getArborChatContext(workingDirectory)                              │
│          LOG: "[ProjectAnalyzer] getArborChatContext returned: N chars"     │
│                                                                              │
│  arborChatPatterns.ts (src/main/projectAnalyzer/arborChatPatterns.ts)       │
│      │                                                                       │
│      │  isArborChatProject(workingDirectory):                               │
│      │  LOG: "[ProjectAnalyzer] isArborChatProject checking: normalized"    │
│      │                                                                       │
│      │  Pattern matching:                                                    │
│      │    - normalized.endsWith('/ArborChat')                               │
│      │    - normalized.includes('/ArborChat/')                              │
│      │    - normalized === '/Users/cory.naegle/ArborChat'                   │
│      │                                                                       │
│      └─→ LOG: "[ProjectAnalyzer] isArborChatProject result: true/false"    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `src/renderer/src/hooks/useAgentRunner.ts` | 573-620 | `buildContextMessages` - extracts workingDirectory |
| `src/renderer/src/components/mcp/MCPProvider.tsx` | 120-124 | `getSystemPrompt` wrapper function |
| `src/preload/index.ts` | 486-488 | IPC bridge for getSystemPrompt |
| `src/main/mcp/ipc.ts` | 500-512 | IPC handler receives workingDirectory |
| `src/main/mcp/prompts.ts` | 163-181 | `generateEnhancedSystemPrompt` |
| `src/main/projectAnalyzer/index.ts` | 22-34 | `getProjectContext` dispatcher |
| `src/main/projectAnalyzer/arborChatPatterns.ts` | 140-149 | `isArborChatProject` matcher |

### Diagnostic Verification Steps

**Step 1: Launch Agent with ArborChat Working Directory**
```
1. Start dev server: npm run dev
2. Open DevTools in app: Cmd+Option+I
3. Launch a new agent
4. Set working directory to: /Users/cory.naegle/ArborChat
5. Start the agent
```

**Step 2: Check Renderer Console (DevTools)**

Look for these logs in sequence:
```
✓ [AgentRunner] Agent working directory: /Users/cory.naegle/ArborChat
✓ [AgentRunner] mcpConnected: true
✓ [AgentRunner] Calling getSystemPrompt with workingDirectory: /Users/cory.naegle/ArborChat
✓ [AgentRunner] Enhanced MCP prompt loaded, length: XXXX
✓ [AgentRunner] Prompt contains Project Intelligence: true
✓ [AgentRunner] ✅ Project intelligence injected for: /Users/cory.naegle/ArborChat
```

**If you see:**
```
⚠️ [AgentRunner] ⚠️ Working directory set but no project intelligence found
```
→ The issue is in the main process chain.

**Step 3: Check Main Process Console (Terminal)**

Look for these logs:
```
✓ [MCP IPC] get-system-prompt called with workingDirectory: /Users/cory.naegle/ArborChat
✓ [MCP Prompts] generateEnhancedSystemPrompt called with workingDirectory: /Users/cory.naegle/ArborChat
✓ [ProjectAnalyzer] getProjectContext called with: /Users/cory.naegle/ArborChat
✓ [ProjectAnalyzer] isArborChatProject checking: /Users/cory.naegle/ArborChat
✓ [ProjectAnalyzer] isArborChatProject result: true
✓ [MCP Prompts] projectContext returned: XXXX chars
✓ [MCP Prompts] ✅ Injecting project context for: /Users/cory.naegle/ArborChat
```

### Failure Point Analysis

| Failure Point | Missing Logs | Likely Cause | Fix |
|--------------|--------------|--------------|-----|
| No renderer logs at all | All `[AgentRunner]` logs | `buildContextMessages` not being called | Check agent launch flow |
| workingDirectory is undefined | Shows `undefined` in logs | Agent config not passing workingDirectory | Check AgentLaunchModal config creation |
| mcpConnected: false | `mcpConnected: false` | MCP initialization failed | Check MCPProvider initialization |
| Renderer OK, no main logs | No `[MCP IPC]` logs | IPC channel broken | Check preload/ipc registration |
| Main receives undefined | `workingDirectory: undefined` | Value lost in IPC serialization | Check preload parameter passing |
| Pattern check returns false | `isArborChatProject result: false` | Path normalization issue | Check path format/slashes |
| Context null despite match | `projectContext returned: null` | `getArborChatContext` returning null | Check ARBORCHAT_CONTEXT constant |

### Quick Verification Script

Add this temporary code to `arborChatPatterns.ts` for detailed debugging:

```typescript
export function isArborChatProject(workingDirectory: string): boolean {
  const normalized = workingDirectory.replace(/\\/g, '/').replace(/\/$/, '')
  
  console.log('[ProjectAnalyzer] isArborChatProject:')
  console.log('  - Input:', JSON.stringify(workingDirectory))
  console.log('  - Normalized:', JSON.stringify(normalized))
  console.log('  - endsWith /ArborChat:', normalized.endsWith('/ArborChat'))
  console.log('  - includes /ArborChat/:', normalized.includes('/ArborChat/'))
  console.log('  - exact match:', normalized === '/Users/cory.naegle/ArborChat')
  
  const result = (
    normalized.endsWith('/ArborChat') ||
    normalized.includes('/ArborChat/') ||
    normalized === '/Users/cory.naegle/ArborChat'
  )
  console.log('[ProjectAnalyzer] isArborChatProject result:', result)
  return result
}
```

---

## Issue 2: Duplicate Search Tool Display

### Problem Statement

When the agent uses search tools, two separate tool boxes appear in the UI instead of one.

### Architecture Analysis

The tool display system has two potential paths that could cause duplication:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ AI RESPONSE PROCESSING (useAgentRunner.ts)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  window.api.onDone handler (lines 759-840)                                  │
│      │                                                                       │
│      ├─→ PATH A: Native Function Calls                                      │
│      │   Check: pendingNativeFunctionCallsRef.current.length > 0           │
│      │   Source: window.api.onFunctionCall events (lines 745-757)           │
│      │   Action: Process native calls → handleToolCall/handleParallelToolCalls │
│      │   RETURNS after processing (line 810)                                │
│      │                                                                       │
│      └─→ PATH B: Text-Based Parsing (Fallback)                             │
│          Triggered: Only if PATH A had no calls                            │
│          Action: parseToolCalls(finalContent)                               │
│          Processes: Tool blocks in ```tool_use code fences                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ UI RENDERING (AgentPanel.tsx)                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Timeline Builder (lines 210-290)                                           │
│      │                                                                       │
│      └─→ Builds unified timeline from:                                      │
│          - agent.messages (user/assistant messages)                         │
│          - agent.steps (filtered for type === 'tool_call')                  │
│                                                                              │
│  Display Mode (controlled by useEnhancedToolDisplay)                        │
│      │                                                                       │
│      ├─→ Enhanced: ToolStepGroup components                                │
│      └─→ Legacy: Individual InlineToolCall components                       │
│                                                                              │
│  ⚠️ POTENTIAL DUPLICATION: AgentStepTimeline also exists                   │
│      - Separate component (AgentStepTimeline.tsx)                           │
│      - Has its own groupedDisplay logic                                     │
│      - Could render same steps if both components visible                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Potential Causes

**Cause A: Native + Text Parsing Collision (Most Likely)**

The onDone handler logic should be mutually exclusive:
```typescript
// Line 789-810
if (pendingCalls.length > 0) {
  // Process native calls
  await handleToolCall(...)
  return  // ← Should prevent text parsing
}

// Line 812-815 - Only reached if no native calls
const toolCalls = parseToolCalls(finalContent)
```

BUT if the stream contains BOTH native function call events AND text-formatted tool blocks, both could fire.

**Cause B: Dual Step Addition**

Check if `addAgentStep` is being called from multiple places:
1. `handleToolCall` function
2. `handleParallelToolCalls` function
3. Somewhere in the native function call handler

**Cause C: Timeline Component Duplication**

Two timeline components could be rendering simultaneously:
- `AgentPanel.tsx` builds its own `timeline` array
- `AgentStepTimeline.tsx` is exported but check where it's used

### Diagnostic Steps

**Step 1: Add Native Call Detection Logging**

In `useAgentRunner.ts`, add logging around line 745:

```typescript
// Native function call handler
if (!cleanupFunctionCallRef.current) {
  const cleanupFn = window.api.onFunctionCall((data) => {
    console.log('[AgentRunner] 🔧 NATIVE function call received:', {
      name: data.name,
      hasArgs: !!data.args,
      toolCallId: data.toolCallId || data.toolUseId
    })
    pendingNativeFunctionCallsRef.current.push({
      tool: data.name,
      args: data.args,
      explanation: 'Native function call',
      toolCallId: data.toolCallId || data.toolUseId
    })
  })
  cleanupFunctionCallRef.current = cleanupFn
}
```

**Step 2: Add Text Parsing Detection Logging**

In `useAgentRunner.ts`, around line 812:

```typescript
// Fall back to text-based parsing
console.log('[AgentRunner] 📝 Checking text-based tool parsing...')
const toolCalls = parseToolCalls(finalContent)
console.log('[AgentRunner] 📝 Text parsing found:', toolCalls.length, 'tool calls')
if (toolCalls.length > 0) {
  console.log('[AgentRunner] 📝 Tool calls from text:', toolCalls.map(t => t.tool))
}
```

**Step 3: Add Step Addition Logging**

In `AgentContext.tsx` (wherever `addAgentStep` is defined):

```typescript
const addAgentStep = useCallback((agentId: string, step: AgentStep) => {
  console.log('[AgentContext] ➕ Adding step:', {
    agentId,
    stepId: step.id,
    type: step.type,
    toolName: step.toolCall?.name
  })
  // ... existing implementation
}, [...])
```

**Step 4: Verify Single Timeline Rendering**

In `AgentPanel.tsx`, add a render log:

```typescript
// At the start of the component or in useEffect
console.log('[AgentPanel] Rendering timeline with', timeline.length, 'items')
timeline.forEach((item, i) => {
  if (item.type === 'tool_step' || item.type === 'tool_step_group') {
    console.log(`[AgentPanel] Timeline[${i}]:`, item.type, item.data)
  }
})
```

### Expected Debug Output

**Working correctly (no duplication):**
```
[AgentRunner] 🔧 NATIVE function call received: { name: 'start_search', ... }
[AgentContext] ➕ Adding step: { type: 'tool_call', toolName: 'start_search' }
[AgentPanel] Rendering timeline with 3 items
[AgentPanel] Timeline[2]: tool_step_group { groupId: '...', steps: [1 tool] }
```

**Duplication occurring:**
```
[AgentRunner] 🔧 NATIVE function call received: { name: 'start_search', ... }
[AgentContext] ➕ Adding step: { type: 'tool_call', toolName: 'start_search' }
[AgentRunner] 📝 Text parsing found: 1 tool calls
[AgentRunner] 📝 Tool calls from text: ['start_search']
[AgentContext] ➕ Adding step: { type: 'tool_call', toolName: 'start_search' }  ← DUPLICATE
```

### Fix Strategy

If both paths are firing:

```typescript
// In onDone handler, add explicit guard
const pendingCalls = [...pendingNativeFunctionCallsRef.current]
pendingNativeFunctionCallsRef.current = []

if (pendingCalls.length > 0) {
  console.log('[AgentRunner] Processing native calls, skipping text parsing')
  // Process native calls...
  return  // Ensure this return is actually hit
}

// Only parse text if NO native calls were received
console.log('[AgentRunner] No native calls, attempting text parsing')
const toolCalls = parseToolCalls(finalContent)
```

---

## Quick Start Commands

```bash
# Navigate to project
cd /Users/cory.naegle/ArborChat

# Start development server (watch terminal for main process logs)
npm run dev

# In app, open DevTools
# Cmd+Option+I → Console tab

# TypeScript check after any changes
npm run typecheck
```

## Verification Checklist

### Project Intelligence
- [ ] Renderer logs show workingDirectory extracted correctly
- [ ] Renderer logs show mcpConnected is true
- [ ] Main process receives workingDirectory via IPC
- [ ] isArborChatProject returns true
- [ ] getProjectContext returns non-null content
- [ ] Final prompt includes "ArborChat Project Intelligence"

### Tool Display
- [ ] Only ONE path (native OR text) processes tool calls
- [ ] addAgentStep called exactly once per tool
- [ ] Timeline renders correct number of items
- [ ] No duplicate tool boxes in UI

## Notes

- All diagnostic logging has been added throughout both chains
- TypeScript compilation must pass before testing
- Pattern matching uses normalized paths (forward slashes, no trailing slash)
- The `return` statement after native call processing is critical for preventing duplication
