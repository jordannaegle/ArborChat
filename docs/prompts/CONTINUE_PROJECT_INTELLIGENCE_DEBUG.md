# Continue: Project Intelligence Injection Debugging

## Context
We implemented project-aware search intelligence for ArborChat agents. The feature injects project-specific context (file locations, search patterns, anti-patterns) into agent system prompts when working in recognized projects.

## What Was Implemented

### Files Modified
1. **`src/main/projectAnalyzer/index.ts`** - `getProjectContext(workingDirectory)` function
2. **`src/main/projectAnalyzer/arborChatPatterns.ts`** - `ARBORCHAT_CONTEXT`, `isArborChatProject()`, `getArborChatContext()`
3. **`src/main/mcp/prompts.ts`** - `generateEnhancedSystemPrompt(tools, workingDirectory?)` 
4. **`src/main/mcp/ipc.ts`** - Updated `mcp:get-system-prompt` handler to accept `workingDirectory`
5. **`src/preload/index.ts`** - Updated `getSystemPrompt(workingDirectory?)` signature
6. **`src/renderer/src/components/mcp/MCPProvider.tsx`** - Updated `getSystemPrompt` callback
7. **`src/renderer/src/hooks/useAgentRunner.ts`** - Updated `buildContextMessages()` to:
   - Be async
   - Call `getSystemPrompt(workingDirectory)` from MCPProvider
   - Combine enhanced MCP prompt with agent system prompt

## Current Issue
When launching an agent with `workingDirectory: "/Users/cory.naegle/ArborChat"`, the console does NOT show:
```
[AgentRunner] ✅ Project intelligence injected for: /Users/cory.naegle/ArborChat
```

The agent is not finding files efficiently (e.g., can't find slash command implementation quickly).

## Diagnostic Logging Added
All these files have console.log statements to trace the flow:
- `useAgentRunner.ts` - logs mcpConnected, workingDirectory, prompt length, contains check
- `src/main/mcp/ipc.ts` - logs when handler called with workingDirectory
- `src/main/mcp/prompts.ts` - logs workingDirectory and projectContext result
- `src/main/projectAnalyzer/index.ts` - logs getProjectContext call and result
- `src/main/projectAnalyzer/arborChatPatterns.ts` - logs isArborChatProject check

## Expected Console Output Chain
```
[AgentRunner] mcpConnected: true
[AgentRunner] Calling getSystemPrompt with workingDirectory: /Users/cory.naegle/ArborChat
[MCP IPC] get-system-prompt called with workingDirectory: /Users/cory.naegle/ArborChat
[MCP Prompts] generateEnhancedSystemPrompt called with workingDirectory: /Users/cory.naegle/ArborChat
[ProjectAnalyzer] getProjectContext called with: /Users/cory.naegle/ArborChat
[ProjectAnalyzer] isArborChatProject checking: /Users/cory.naegle/ArborChat
[ProjectAnalyzer] isArborChatProject result: true
[ProjectAnalyzer] getArborChatContext returned: XXXX chars
[MCP Prompts] projectContext returned: XXXX chars
[MCP Prompts] ✅ Injecting project context for: /Users/cory.naegle/ArborChat
[AgentRunner] Enhanced MCP prompt loaded, length: XXXX
[AgentRunner] Prompt contains Project Intelligence: true
[AgentRunner] ✅ Project intelligence injected for: /Users/cory.naegle/ArborChat
```

## Likely Failure Points to Check

1. **Is the agent's workingDirectory actually set?**
   - Check `AgentLaunchModal.tsx` - is `workingDirectory` being passed to `onLaunch`?
   - Check where `onLaunch` is handled - is it passed to `createAgent`?

2. **Is `agent.config.context.workingDirectory` populated?**
   - Check `AgentContext.tsx` around line 480 where the agent object is created

3. **Is `mcpConnected` true when `buildContextMessages` runs?**
   - If false, the enhanced prompt fetch is skipped entirely

4. **IPC communication issue?**
   - Check if main process logs appear at all when agent starts

## Next Steps

1. **Restart the app** with `npm run dev`
2. **Open DevTools** (Cmd+Option+I) in BOTH renderer AND main process
3. **Launch an agent** with working directory set to `/Users/cory.naegle/ArborChat`
4. **Check console logs** to see where the chain breaks
5. **Trace from the break point** to find the root cause

## Key Files to Examine

```
src/renderer/src/components/agent/AgentLaunchModal.tsx  # Where workingDirectory is set
src/renderer/src/contexts/AgentContext.tsx              # Where agent is created
src/renderer/src/hooks/useAgentRunner.ts                # Where buildContextMessages runs
src/main/mcp/ipc.ts                                     # IPC handler
src/main/mcp/prompts.ts                                 # generateEnhancedSystemPrompt
src/main/projectAnalyzer/index.ts                       # getProjectContext
```

## TypeScript Verification
Run `npm run typecheck` - it should pass (it did when we last checked).
