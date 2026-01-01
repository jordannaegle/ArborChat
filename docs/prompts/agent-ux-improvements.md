# Agent UX Improvements: Pause/Stop & Working Directory Context

## Overview

During Phase 2 testing, two critical UX issues were discovered:

1. **No visible Stop/Pause button** - The agent panel lacks a clearly visible way to stop a runaway agent
2. **Working directory not in AI context** - The selected project folder is not injected into the agent's system prompt, causing the AI to search from "/" instead of the project root

## Problem Details

### Issue 1: Missing Stop/Pause Button Visibility

**Current State:**
- `AgentPanel.tsx` has pause/resume button code (lines ~295-310)
- Button shows conditionally: `{(isWorking || isPaused) && ...}`
- Where `isWorking = agent.status === 'running' || isStreaming`

**Observed Behavior:**
- Agent shows "Working" status badge (green)
- No pause button visible in the header
- User cannot stop a long-running operation (e.g., searching "/" for files)

**Root Cause Hypothesis:**
- The button may be rendering but not visible (styling issue)
- OR the condition `isWorking` isn't evaluating to true when expected
- Need a more prominent **STOP** button (not just pause)

### Issue 2: Working Directory Not in System Prompt

**Current State:**
- `AgentLaunchModal.tsx` captures `workingDirectory` and passes to `onLaunch`
- `useAgent.ts` stores it in `agentContext.workingDirectory` (line 135)
- System prompt is built (lines 73-107) but **never mentions the working directory**

**Observed Behavior:**
- User selected `/Users/cory.naegle/ArborChat` as working directory
- Agent searched for `package.json` starting at path `"/"`
- Should have searched in the selected directory

**Root Cause:**
The system prompt builder in `useAgent.ts` doesn't inject:
```typescript
// Missing: Working directory context
const workingDirPrompt = workingDirectory 
  ? `\n\n## WORKING DIRECTORY\nYour working directory is: ${workingDirectory}\nAll file operations should be relative to this path unless an absolute path is specified.\nAlways look for files in this directory first.`
  : ''
```

---

## Implementation Plan

### Part 1: Stop Button Enhancement

**File: `src/renderer/src/components/agent/AgentPanel.tsx`**

1. **Add a prominent STOP button** (separate from pause/resume):
   ```tsx
   {/* Stop button - always visible when agent is active */}
   {(agent.status === 'running' || agent.status === 'waiting' || agent.status === 'paused') && (
     <button
       onClick={onStop}  // New prop needed
       className={cn(
         'p-1.5 rounded-md transition-colors',
         'text-red-400 hover:bg-red-500/20 hover:text-red-300'
       )}
       title="Stop agent"
     >
       <Square size={16} />  // Import from lucide-react
     </button>
   )}
   ```

2. **Add `onStop` prop to AgentPanelProps:**
   ```typescript
   interface AgentPanelProps {
     // ... existing props
     onStop: () => void  // New prop
   }
   ```

3. **Update button order** in header (left to right):
   - Retry (if applicable)
   - Pause/Resume (if working)
   - **Stop** (new - red, always visible when active)
   - Minimize
   - Close

**File: `src/renderer/src/components/agent/AgentPanelContainer.tsx`**

4. **Wire up stop handler:**
   ```typescript
   // Handle stop
   const handleStop = useCallback(() => {
     console.log('[AgentPanelContainer] Stopping agent:', agentId)
     stop()
   }, [agentId, stop])
   
   // Pass to AgentPanel
   <AgentPanel
     // ... existing props
     onStop={handleStop}
   />
   ```

### Part 2: Working Directory Injection

**File: `src/renderer/src/hooks/useAgent.ts`**

5. **Update system prompt builder** (around line 73):
   ```typescript
   const createAgent = useCallback((options: CreateAgentOptions): Agent => {
     const now = Date.now()
     const workingDirectory = options.workingDirectory || ''
     
     // Build working directory context
     const workingDirContext = workingDirectory 
       ? `\n\n## WORKING DIRECTORY
Your working directory is: ${workingDirectory}

IMPORTANT FILE OPERATION RULES:
- When searching for files, start in ${workingDirectory}
- When reading files without absolute paths, look in ${workingDirectory}
- When creating files, create them in ${workingDirectory} unless otherwise specified
- Always use absolute paths starting with ${workingDirectory} for clarity

For example, to read package.json:
- Use path: "${workingDirectory}/package.json"
- NOT path: "/" or path: "package.json"`
       : ''
     
     // Build system prompt for the agent
     const basePrompt = `You are an autonomous coding agent...${workingDirContext}
     
     // ... rest of prompt
   ```

**File: `src/renderer/src/hooks/useAgentRunner.ts`**

6. **Also inject into buildContextMessages** if needed:
   - The agent already has `agent.config.context.workingDirectory`
   - Could add a reminder in the initial user message

### Part 3: AgentContext Type Updates (if needed)

**File: `src/renderer/src/types/agent.ts`**

7. **Ensure workingDirectory is required or has sensible default:**
   ```typescript
   export interface AgentContext {
     // ... existing fields
     workingDirectory: string  // Already exists, ensure not optional
   }
   ```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/src/components/agent/AgentPanel.tsx` | Add Stop button, import Square icon |
| `src/renderer/src/components/agent/AgentPanelContainer.tsx` | Wire up `onStop` handler |
| `src/renderer/src/hooks/useAgent.ts` | Inject workingDirectory into system prompt |
| `src/renderer/src/hooks/useAgentRunner.ts` | Optionally add working dir reminder |

---

## Testing Checklist

### Stop Button Tests

- [ ] Start an agent with a long-running task (e.g., search "/" for files)
- [ ] Verify Stop button (red square icon) is visible in header
- [ ] Click Stop button - agent should immediately terminate
- [ ] Status should change to "Completed" or "Stopped"
- [ ] Work journal should log the stop action
- [ ] Agent can be closed after stopping

### Working Directory Tests

- [ ] Launch agent with ArborChat directory selected
- [ ] Task: "Read the package.json file and tell me the project name"
- [ ] Verify agent uses `read_file` with path like `/Users/.../ArborChat/package.json`
- [ ] Agent should NOT search "/" or use `start_search` on root
- [ ] Console logs should show working directory in system prompt

### Combined Flow Test

1. Create agent with:
   - Working directory: `/Users/cory.naegle/ArborChat`
   - Instructions: "Read the package.json file and tell me the project name"
   - Permission: Standard
   
2. Expected behavior:
   - Agent calls `read_file` with path `/Users/cory.naegle/ArborChat/package.json`
   - Tool is auto-approved (read_file is safe)
   - Agent extracts and reports: `"name": "arborchat"`
   - Agent status: Completed

3. If agent takes wrong approach:
   - Click Stop button
   - Verify agent terminates
   - Create new agent with clearer instructions

---

## Console Logging for Debugging

Add diagnostic logs to verify working directory injection:

```typescript
// In useAgent.ts createAgent()
console.log('[Agent] Creating agent with working directory:', workingDirectory)
console.log('[Agent] System prompt length:', fullSystemPrompt.length)
console.log('[Agent] System prompt includes workingDirectory:', fullSystemPrompt.includes(workingDirectory))
```

```typescript
// In useAgentRunner.ts executeLoop()
console.log('[AgentRunner] Agent working directory:', agent.config.context.workingDirectory)
```

---

## Success Criteria

1. **Stop Button**: Red stop button visible and functional during agent execution
2. **Working Directory**: AI correctly uses the selected directory for all file operations
3. **User Experience**: User can quickly stop a misbehaving agent
4. **Native Function Calls**: Continue working correctly with Anthropic provider (from Phase 2)

---

## Implementation Order

1. First: Add Stop button (quick win, immediate usability improvement)
2. Second: Inject working directory into system prompt
3. Third: Test combined flow
4. Fourth: Verify Phase 2 native function calling still works

---

## Notes

- The pause functionality (`pause()` function) already exists in `useAgentRunner.ts`
- The stop functionality (`stop()` function) also exists but isn't wired to UI
- Working directory is already captured and stored, just not used in prompts
- This is a critical UX fix - users expect the AI to work in the folder they selected
