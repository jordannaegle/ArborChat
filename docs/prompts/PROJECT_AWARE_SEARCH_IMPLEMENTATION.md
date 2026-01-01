# Project-Aware Search Implementation Prompt

**Phase:** Quick Win Integration  
**Estimated Time:** 30-45 minutes  
**Dependencies:** None (self-contained)

---

## Overview

This prompt guides the integration of project intelligence context into ArborChat's agent system prompts. The goal is to help agents search efficiently by providing upfront knowledge about the codebase structure.

---

## Files Created (Already Done)

- ✅ `src/main/projectAnalyzer/index.ts` - Module entry point
- ✅ `src/main/projectAnalyzer/arborChatPatterns.ts` - ArborChat-specific patterns
- ✅ `docs/designs/PROJECT_AWARE_SEARCH_DESIGN.md` - Full design document

---

## Integration Steps

### Step 1: Register IPC Handlers in Main Process

**File:** `src/main/index.ts`

Add import and setup call:

```typescript
// Add near other imports
import { setupProjectAnalyzerHandlers } from './projectAnalyzer'

// Add in the app.whenReady() initialization section, after other handler setups
setupProjectAnalyzerHandlers()
```

**Location hint:** Search for `setupMCPHandlers()` call and add nearby.

---

### Step 2: Expose API in Preload Script

**File:** `src/preload/index.ts`

Add to the API object:

```typescript
// Add to the api object exposed via contextBridge
projectAnalyzer: {
  getContext: (workingDirectory: string) =>
    ipcRenderer.invoke('projectAnalyzer:getContext', workingDirectory) as Promise<string | null>,
  isKnownProject: (workingDirectory: string) =>
    ipcRenderer.invoke('projectAnalyzer:isKnownProject', workingDirectory) as Promise<boolean>
}
```

**Location hint:** Search for `contextBridge.exposeInMainWorld` and add within the `api` object.

---

### Step 3: Add Type Definitions

**File:** `src/preload/index.d.ts`

Add interface:

```typescript
interface ProjectAnalyzerAPI {
  getContext: (workingDirectory: string) => Promise<string | null>
  isKnownProject: (workingDirectory: string) => Promise<boolean>
}

// Add to ElectronAPI interface
projectAnalyzer: ProjectAnalyzerAPI
```

---

### Step 4: Update MCP Prompts to Include Project Context

**File:** `src/main/mcp/prompts.ts`

Add a new export function:

```typescript
import { getProjectContext } from '../projectAnalyzer'

/**
 * Generate complete system prompt with project intelligence
 */
export function generateEnhancedSystemPrompt(
  tools: ToolDefinition[],
  workingDirectory?: string
): string {
  const toolPrompt = generateToolSystemPrompt(tools)
  const projectContext = getProjectContext(workingDirectory)
  
  if (projectContext) {
    return `${projectContext}\n\n${toolPrompt}`
  }
  
  return toolPrompt
}
```

---

### Step 5: Update IPC Handler to Use Enhanced Prompt

**File:** `src/main/mcp/ipc.ts`

Modify the `mcp:get-system-prompt` handler to accept a working directory parameter:

```typescript
// Find the existing handler (around line 500)
ipcMain.handle('mcp:get-system-prompt', async (_event, workingDirectory?: string) => {
  const mcpTools = mcpManager.getAvailableTools()
  
  const internalTools = getArborInternalTools().map(tool => ({
    ...tool,
    server: 'arbor'
  }))
  
  // Use enhanced prompt generator
  return generateEnhancedSystemPrompt([...mcpTools, ...internalTools], workingDirectory)
})
```

---

### Step 6: Update Preload API Signature

**File:** `src/preload/index.ts`

Update the `getSystemPrompt` call to accept working directory:

```typescript
getSystemPrompt: (workingDirectory?: string) =>
  ipcRenderer.invoke('mcp:get-system-prompt', workingDirectory) as Promise<string>
```

---

### Step 7: Pass Working Directory When Building Agent Prompts

**File:** `src/renderer/src/hooks/useToolChat.ts` (or wherever agents are created)

When calling `getSystemPrompt`, pass the working directory:

```typescript
// In agent creation flow
const toolSystemPrompt = await window.api.mcp.getSystemPrompt(options.workingDirectory)
```

---

## Verification Steps

1. **TypeScript Compilation:**
   ```bash
   cd /Users/cory.naegle/ArborChat
   npm run typecheck
   ```

2. **Start Application:**
   ```bash
   npm run dev
   ```

3. **Test Agent Creation:**
   - Create an agent with workingDirectory set to `/Users/cory.naegle/ArborChat`
   - Check console logs for `[ProjectAnalyzer]` messages
   - Verify agent system prompt includes the "ArborChat Project Intelligence" section

4. **Test Search Efficiency:**
   - Ask agent to "find the slash command implementation"
   - Agent should immediately reference `useSlashCommands.ts` from the injected context
   - Agent should use `start_search` with content type, not `list_directory`

---

## Expected Behavior After Integration

**Before:**
```
Agent: Let me search for the slash command implementation...
[list_directory /Users/cory.naegle/ArborChat depth=3] (42+ seconds)
[list_directory /Users/cory.naegle/ArborChat/src depth=2] (15+ seconds)
[start_search ...] (finally finds it)
```

**After:**
```
Agent: Based on the project context, slash commands are in useSlashCommands.ts.
Let me read that file directly...
[read_file /Users/cory.naegle/ArborChat/src/renderer/src/hooks/useSlashCommands.ts]
(Done in <5 seconds)
```

---

## Rollback Plan

If issues occur:

1. Remove the `setupProjectAnalyzerHandlers()` call from `src/main/index.ts`
2. Revert `mcp:get-system-prompt` handler to not use `generateEnhancedSystemPrompt`
3. The project analyzer module can remain in place (unused) until fixed

---

## Future Enhancements

After verifying this works for ArborChat:

1. **Generic Project Analysis:** Build the full `ProjectAnalyzer` class from the design doc
2. **Caching:** Cache project intelligence with file modification timestamps
3. **Dynamic Updates:** Re-analyze on git operations
4. **User Configuration:** Allow users to add custom patterns for their projects
