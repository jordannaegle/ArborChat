# ArborChat Native MCP Client Implementation

## Project Context

**Project:** ArborChat - A threaded AI chat desktop application  
**Location:** `/Users/cory.naegle/ArborChat`  
**Repository:**
- Fork: `https://github.com/corynaegle-ai/ArborChat`
- Upstream: `https://github.com/jordannaegle/ArborChat`

**Tech Stack:**
- Electron 33+
- React 19
- TypeScript
- Tailwind CSS v4
- Vite (electron-vite)
- better-sqlite3 for local storage
- Google Gemini & Ollama as AI providers

---

## Goal

Implement a **Native MCP (Model Context Protocol) Client** in ArborChat to enable AI-assisted file system operations, process management, and terminal commands via Desktop Commander MCP.

---

## Design Document

Read the full design at: `/Users/cory.naegle/ArborChat/docs/MCP_INTEGRATION_DESIGN.md`

Key architecture:
```
Renderer Process (React UI)
    ↓ IPC via contextBridge
Preload Script (exposes window.api.mcp.*)
    ↓ ipcRenderer ↔ ipcMain
Main Process (MCPManager)
    ↓ stdio transport
Desktop Commander MCP Server (child process)
```

---

## Implementation Tasks

### Phase 1: MCP Client Foundation

#### 1.1 Install Dependencies
```bash
cd /Users/cory.naegle/ArborChat
npm install @modelcontextprotocol/sdk
```

#### 1.2 Create MCP Module Structure
```bash
mkdir -p src/main/mcp/servers
```

Create these files:
- `src/main/mcp/manager.ts` - MCPManager class that connects to MCP servers
- `src/main/mcp/ipc.ts` - IPC handlers for renderer ↔ main communication
- `src/main/mcp/config.ts` - Configuration types and defaults
- `src/main/mcp/servers/desktop-commander.ts` - Desktop Commander server config

#### 1.3 MCPManager Implementation

The MCPManager should:
- Connect to MCP servers via stdio transport
- Discover available tools from connected servers
- Route tool calls to the appropriate server
- Handle tool results and errors
- Gracefully disconnect on app shutdown

Key classes from `@modelcontextprotocol/sdk`:
- `Client` from `@modelcontextprotocol/sdk/client/index.js`
- `StdioClientTransport` from `@modelcontextprotocol/sdk/client/stdio.js`

### Phase 2: IPC Integration

#### 2.1 IPC Handlers to Create

| Handler | Purpose |
|---------|---------|
| `mcp:init` | Initialize and connect to MCP servers |
| `mcp:get-tools` | Return list of available tools |
| `mcp:request-tool` | Request tool execution (queues for approval if needed) |
| `mcp:approve` | User approves pending tool call |
| `mcp:reject` | User rejects pending tool call |
| `mcp:shutdown` | Disconnect all MCP servers |

#### 2.2 Update Preload Script

Add `mcp` namespace to `window.api` in `src/preload/index.ts`:
```typescript
const mcpApi = {
  init: () => ipcRenderer.invoke('mcp:init'),
  getTools: () => ipcRenderer.invoke('mcp:get-tools'),
  requestTool: (serverName, toolName, args) => 
    ipcRenderer.invoke('mcp:request-tool', { serverName, toolName, args }),
  approve: (id, modifiedArgs?) => 
    ipcRenderer.invoke('mcp:approve', { id, modifiedArgs }),
  reject: (id) => ipcRenderer.invoke('mcp:reject', { id }),
  onApprovalRequired: (callback) => 
    ipcRenderer.on('mcp:approval-required', (_, data) => callback(data)),
  removeAllListeners: () => 
    ipcRenderer.removeAllListeners('mcp:approval-required')
}
```

#### 2.3 Update Type Definitions

Update `src/preload/index.d.ts` to include MCP API types.

### Phase 3: Tool Approval System

Implement a pending tool call queue with:
- Auto-approval for "safe" tools (read_file, list_directory, etc.)
- UI approval required for "moderate" tools (write_file, start_process)
- Type-to-confirm for "dangerous" tools (move_file, kill_process)

Risk levels defined in `/Users/cory.naegle/ArborChat/docs/MCP_INTEGRATION_DESIGN.md`

### Phase 4: UI Components

Create React components in `src/renderer/src/components/`:

#### 4.1 ToolApprovalCard.tsx
- Shows pending tool call with name, args, risk level
- Approve/Edit/Reject buttons
- JSON editor for modifying args
- Visual risk indicators (green/yellow/red)

#### 4.2 ToolResultCard.tsx
- Displays tool execution results
- Collapsible for long outputs
- Success/error styling
- Execution duration

### Phase 5: AI Integration

#### 5.1 Tool System Prompt
Generate a system prompt that describes available tools to the AI.
Include tool names, descriptions, and input schemas.

#### 5.2 Tool Call Parser
Create `src/renderer/src/lib/toolParser.ts` to:
- Parse AI responses for tool request blocks
- Extract tool name, args, and explanation
- Strip tool blocks from displayed content

#### 5.3 Message Flow Integration
Update ChatWindow.tsx to:
- Detect tool calls in AI responses
- Show ToolApprovalCard for pending approvals
- Execute approved tools via `window.api.mcp`
- Display results with ToolResultCard
- Feed results back to AI context

---

## Key Files to Reference

| File | Purpose |
|------|---------|
| `src/main/index.ts` | Main process entry, add MCP handler setup |
| `src/main/ai.ts` | AI provider routing, add tool system prompts |
| `src/preload/index.ts` | IPC bridge, add MCP API |
| `src/preload/index.d.ts` | Type definitions |
| `src/renderer/src/components/ChatWindow.tsx` | Main chat UI |
| `src/renderer/src/components/MessageBubble.tsx` | Message rendering |
| `docs/MCP_INTEGRATION_DESIGN.md` | Full design document |
| `docs/CLI_EXECUTION_DESIGN.md` | Earlier CLI design (reference) |

---

## Desktop Commander Tools Available

**File System (read-only):**
- `read_file` - Read file contents
- `list_directory` - List directory contents
- `get_file_info` - Get file metadata

**File System (write):**
- `write_file` - Write/append to files
- `create_directory` - Create directories
- `move_file` - Move/rename files
- `edit_block` - Surgical text replacements

**Search:**
- `start_search` - Start file/content search
- `get_more_search_results` - Paginate search results
- `stop_search` - Cancel active search

**Processes:**
- `start_process` - Start terminal command
- `read_process_output` - Read process output
- `interact_with_process` - Send input to process
- `force_terminate` - Kill a process
- `list_sessions` - List active terminal sessions

---

## Development Commands

```bash
# Navigate to project
cd /Users/cory.naegle/ArborChat

# Install dependencies (after adding MCP SDK)
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

---

## Implementation Order

1. **Install SDK & create file structure**
2. **Implement MCPManager** (connect, list tools, call tool)
3. **Add IPC handlers** (mcp:init, mcp:request-tool, etc.)
4. **Update preload** with MCP API
5. **Update type definitions**
6. **Create ToolApprovalCard component**
7. **Create ToolResultCard component**
8. **Integrate with ChatWindow** (detect tool calls, show UI)
9. **Add tool system prompt** to AI providers
10. **Create tool call parser**
11. **Test end-to-end flow**
12. **Add settings UI** for MCP configuration
13. **Commit and push to fork**

---

## Testing Checklist

- [ ] MCP server connects successfully on app start
- [ ] Available tools are discovered and logged
- [ ] Safe tools (read_file, list_directory) auto-execute
- [ ] Moderate tools show approval UI
- [ ] Tool args can be edited before approval
- [ ] Tool results display correctly
- [ ] Rejected tools don't execute
- [ ] MCP disconnects cleanly on app quit
- [ ] AI receives tool results in context
- [ ] Long-running processes can be cancelled

---

## Notes

- Desktop Commander runs via `npx -y @anthropic/desktop-commander-mcp` (no global install needed)
- Use absolute paths for all file operations
- The MCP SDK uses ES modules - use `.js` extensions in imports
- Handle the case where MCP server fails to start gracefully
- Log all tool requests and results for debugging

---

## Start Here

Begin by reading the existing codebase:
1. `src/main/index.ts` - Understand main process setup
2. `src/preload/index.ts` - See existing IPC patterns
3. `src/main/ai.ts` - Understand AI integration
4. `docs/MCP_INTEGRATION_DESIGN.md` - Full architecture details

Then proceed with Phase 1: Install the MCP SDK and create the module structure.

Good luck! 🚀
