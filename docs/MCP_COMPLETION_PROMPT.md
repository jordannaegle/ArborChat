# MCP Desktop Commander Integration - Completion Prompt

## Context

You are Alex Chen, a senior full-stack engineer. You're completing the Desktop Commander MCP integration for ArborChat, an Electron-based threaded AI chat app.

**Tech Stack:**
- Electron + Vite + React + TypeScript
- Tailwind CSS
- Better-sqlite3 for local storage
- @modelcontextprotocol/sdk for MCP

**Project Location:** `/Users/cory.naegle/ArborChat`

## Current State

The MCP infrastructure is 95% complete but NOT connected to the chat UI:

### ✅ Already Built:
1. **Backend MCP System** (`src/main/mcp/`)
   - `manager.ts` - MCP client, connects to servers, executes tools
   - `ipc.ts` - IPC handlers for request/approve/reject
   - `config.ts` - Configuration persistence
   - `prompts.ts` - System prompt generation

2. **Frontend Components** (`src/renderer/src/components/mcp/`)
   - `MCPProvider.tsx` - Context with MCP state
   - `ToolApprovalCard.tsx` - UI for approving tool execution
   - `ToolResultCard.tsx` - Displays tool results

3. **Hooks & Utils**
   - `useMCPTools.ts` - Hook for executing tools
   - `toolParser.ts` - Parses `tool_use` blocks from AI responses

4. **Settings UI** - Enable/disable MCP servers

### ❌ NOT Working:

1. **Wrong package name** in `src/main/mcp/servers/desktop-commander.ts`:
   - Current: `@anthropic/desktop-commander-mcp`
   - Correct: `desktop-commander`

2. **ChatWindow.tsx** doesn't use MCP at all - needs integration

3. **No tool execution loop** - AI can't request → approve → execute → continue

## Tasks To Complete

### Task 1: Fix Desktop Commander Package (5 min)

Edit `src/main/mcp/servers/desktop-commander.ts`:

```typescript
export const DESKTOP_COMMANDER_CONFIG: MCPServerConfig = {
  name: 'desktop-commander',
  command: 'npx',
  args: ['-y', 'desktop-commander'],  // Changed from @anthropic/desktop-commander-mcp
  enabled: true,
  env: {}
}
```

### Task 2: Integrate MCP into ChatWindow (Main Task)

The ChatWindow needs to:

1. **Inject tool system prompt** - Get it from `useMCP().systemPrompt` and add to system message

2. **Parse AI responses** - Use `toolParser.ts` to detect tool requests in streaming content

3. **Show approval UI** - When tool detected, render `ToolApprovalCard` inline

4. **Execute and continue** - After approval, execute tool and feed result back to AI

Here's the integration pattern:

```typescript
// In App.tsx or a new hook

// 1. Get tool system prompt
const { systemPrompt, requestTool, connected } = useMCP()
const { executeTool, toolExecutions, processAIResponse, getToolResultsForContext } = useMCPTools()

// 2. Modify system prompt when building context
const system = {
  role: 'system',
  content: `You are ArborChat, an intelligent assistant.

${connected ? systemPrompt : ''}` // Add tool instructions when connected
}

// 3. When AI responds with tool_use, parse it
window.api.onDone(async () => {
  const finalContent = streamBufferRef.current
  
  // Check for tool calls
  const { cleanContent, toolCalls } = processAIResponse(finalContent)
  
  if (toolCalls.length > 0) {
    // Don't save message yet, show approval UI
    setPendingToolCall(toolCalls[0])
  } else {
    // Normal message, save it
    const aiMsg = await window.api.addMessage(activeId, 'assistant', finalContent, parentId)
    setAllMessages(prev => [...prev, aiMsg])
  }
})

// 4. Handle approval
const handleApprove = async (toolCall) => {
  const result = await executeTool(toolCall.tool, toolCall.args, toolCall.explanation)
  
  // Feed result back to AI
  const toolResultContext = formatToolResult(toolCall.tool, result.result, result.error)
  
  // Continue the conversation with tool result
  const continueContext = [
    ...previousContext,
    { role: 'assistant', content: originalResponse },
    { role: 'user', content: toolResultContext }  // Tool results as user message
  ]
  
  // Make follow-up request
  window.api.askAI(apiKey, continueContext, selectedModel)
}
```

### Task 3: Update MessageBubble to Show Tools

Add conditional rendering in `MessageBubble`:

```typescript
// If message contains tool results, render ToolResultCard
{message.content.includes('<tool_result') && (
  <ToolResultCard ... />
)}

// If pending approval, render ToolApprovalCard  
{pendingToolCall && (
  <ToolApprovalCard
    id={pendingToolCall.id}
    toolName={pendingToolCall.tool}
    args={pendingToolCall.args}
    explanation={pendingToolCall.explanation}
    riskLevel={getRiskLevel(pendingToolCall.tool)}
    onApprove={handleApprove}
    onReject={handleReject}
  />
)}
```

### Task 4: Test the Integration

1. Run the app: `npm run dev`
2. Open Settings → Tools → Enable Desktop Commander
3. Send: "List the files in my home directory"
4. AI should respond with a tool_use block
5. Approval card should appear
6. Approve → Tool executes → AI continues

## Key Files to Modify

1. `src/main/mcp/servers/desktop-commander.ts` - Fix package name
2. `src/renderer/src/App.tsx` - Add tool context and handling
3. `src/renderer/src/components/ChatWindow.tsx` - Show tool UI inline
4. Maybe create: `src/renderer/src/hooks/useToolChat.ts` - Encapsulate tool+chat logic

## Important Notes

- The `useMCP()` hook must be used inside `MCPProvider` (already wrapped in App.tsx)
- Tool results should be formatted with `formatToolResult()` from toolParser.ts
- Don't break existing threaded chat functionality
- Handle the case where MCP is disabled gracefully

## Start Here

1. Read `src/main/mcp/servers/desktop-commander.ts` - fix package name
2. Read `src/renderer/src/App.tsx` - understand current chat flow
3. Read `src/renderer/src/components/ChatWindow.tsx` - where to add tool UI
4. Read `src/renderer/src/components/mcp/` - understand existing components

Good luck! 🌲
