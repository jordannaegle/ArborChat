# Desktop Commander MCP Integration Guide for ArborChat

## Overview

This document outlines how to integrate **Model Context Protocol (MCP)** and specifically **Desktop Commander MCP** into ArborChat. MCP is Anthropic's open protocol that standardizes how AI models interact with external tools and data sources.

---

## What is MCP?

**Model Context Protocol (MCP)** is a standardized protocol for:
- Connecting AI models to external tools (file systems, databases, APIs)
- Providing structured tool calling with defined schemas
- Enabling bidirectional communication between AI and tools

**Desktop Commander MCP** is an MCP server that provides:
- File system operations (read, write, create, move, search)
- Process management (start, monitor, terminate)
- Terminal/shell execution
- Directory listing and navigation

---

## Integration Approaches

### Approach 1: Native MCP Client (Recommended)

Implement an MCP client directly in ArborChat's Electron main process.

**Pros:**
- Full control over MCP communication
- Works with any MCP-compatible AI provider
- Can add custom approval UI before tool execution
- Offline-capable (local MCP servers)

**Cons:**
- More implementation work
- Need to maintain MCP client code

### Approach 2: Claude API with MCP Tools

Use Anthropic's Claude API which has native MCP support.

**Pros:**
- Built-in MCP handling
- No custom MCP client needed
- Anthropic maintains the integration

**Cons:**
- Requires Claude API (subscription cost)
- Cloud-dependent
- Less control over tool approval flow

### Approach 3: Hybrid Approach

Use the existing CLI design (child_process.spawn) alongside MCP for structured tool discovery.

**Pros:**
- Leverages existing CLI design
- MCP provides tool schemas
- More flexibility

**Cons:**
- More complex architecture
- Potential duplication

---

## Recommended Architecture: Native MCP Client

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           RENDERER PROCESS                               │
│  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐   │
│  │   ChatWindow    │───▶│  ToolApprovalUI  │───▶│   ToolResultUI    │   │
│  │  (Shows tools)  │    │  (User approve)  │    │  (Shows output)   │   │
│  └─────────────────┘    └──────────────────┘    └───────────────────┘   │
│           │                      │                        ▲              │
│           ▼                      ▼                        │              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     window.api.mcp.*                             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ IPC (contextBridge)
┌──────────────────────────────────┼──────────────────────────────────────┐
│                            MAIN PROCESS                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        MCPManager                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐  │   │
│  │  │   Client    │  │    Tool     │  │      Approval Queue      │  │   │
│  │  │   Manager   │  │   Router    │  │   (pending tool calls)   │  │   │
│  │  └─────────────┘  └─────────────┘  └──────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                   │                                      │
│                    ┌──────────────┴──────────────┐                      │
│                    │     MCP Client (TypeScript)  │                      │
│                    └──────────────┬──────────────┘                      │
└───────────────────────────────────┼─────────────────────────────────────┘
                                    │ stdio/SSE
                     ┌──────────────┴──────────────┐
                     │  Desktop Commander MCP Server │
                     │  (Running as child process)  │
                     └─────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: MCP Client Foundation

#### 1.1 Install MCP SDK

```bash
cd /Users/cory.naegle/ArborChat
npm install @modelcontextprotocol/sdk
```

#### 1.2 Create MCP Manager

```typescript
// src/main/mcp/manager.ts

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { spawn, ChildProcess } from 'child_process'

interface MCPServer {
  name: string
  command: string
  args: string[]
  process?: ChildProcess
  client?: Client
  tools?: ToolDefinition[]
}

interface ToolDefinition {
  name: string
  description: string
  inputSchema: object
}

class MCPManager {
  private servers: Map<string, MCPServer> = new Map()
  
  async connectServer(config: { 
    name: string
    command: string 
    args: string[] 
  }): Promise<void> {
    const serverProcess = spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    const transport = new StdioClientTransport({
      reader: serverProcess.stdout!,
      writer: serverProcess.stdin!
    })
    
    const client = new Client({
      name: 'arborchat',
      version: '1.0.0'
    }, {
      capabilities: {}
    })
    
    await client.connect(transport)
    
    // Discover available tools
    const toolsResponse = await client.listTools()
    
    this.servers.set(config.name, {
      ...config,
      process: serverProcess,
      client,
      tools: toolsResponse.tools
    })
    
    console.log(`[MCP] Connected to ${config.name}`)
    console.log(`[MCP] Available tools:`, toolsResponse.tools.map(t => t.name))
  }
  
  async callTool(
    serverName: string, 
    toolName: string, 
    args: Record<string, unknown>
  ): Promise<unknown> {
    const server = this.servers.get(serverName)
    if (!server?.client) {
      throw new Error(`Server ${serverName} not connected`)
    }
    
    const result = await server.client.callTool({
      name: toolName,
      arguments: args
    })
    
    return result
  }
  
  getAvailableTools(): ToolDefinition[] {
    const allTools: ToolDefinition[] = []
    for (const server of this.servers.values()) {
      if (server.tools) {
        allTools.push(...server.tools)
      }
    }
    return allTools
  }
  
  async disconnectAll(): Promise<void> {
    for (const server of this.servers.values()) {
      server.process?.kill()
      await server.client?.close()
    }
    this.servers.clear()
  }
}

export const mcpManager = new MCPManager()
```

#### 1.3 Desktop Commander Configuration

```typescript
// src/main/mcp/servers/desktop-commander.ts

export const DESKTOP_COMMANDER_CONFIG = {
  name: 'desktop-commander',
  // Assumes Desktop Commander is installed globally via npm
  command: 'npx',
  args: ['-y', '@anthropic/desktop-commander-mcp'],
  // Alternative if installed locally:
  // command: 'node',
  // args: ['/path/to/desktop-commander/dist/index.js']
}

// Tool categories for UI grouping
export const TOOL_CATEGORIES = {
  filesystem: [
    'read_file',
    'write_file', 
    'create_directory',
    'list_directory',
    'move_file',
    'get_file_info'
  ],
  search: [
    'start_search',
    'get_more_search_results',
    'stop_search',
    'list_searches'
  ],
  process: [
    'start_process',
    'read_process_output',
    'interact_with_process',
    'force_terminate',
    'list_sessions',
    'list_processes',
    'kill_process'
  ],
  config: [
    'get_config',
    'set_config_value'
  ]
}

// Risk levels for each tool
export const TOOL_RISK_LEVELS: Record<string, 'safe' | 'moderate' | 'dangerous'> = {
  // Safe - read-only
  read_file: 'safe',
  list_directory: 'safe',
  get_file_info: 'safe',
  list_sessions: 'safe',
  list_processes: 'safe',
  list_searches: 'safe',
  get_config: 'safe',
  read_process_output: 'safe',
  
  // Moderate - writes to project dirs
  write_file: 'moderate',
  create_directory: 'moderate',
  start_search: 'moderate',
  start_process: 'moderate',
  interact_with_process: 'moderate',
  
  // Dangerous - system-wide effects
  move_file: 'dangerous',
  edit_block: 'moderate',
  force_terminate: 'dangerous',
  kill_process: 'dangerous',
  set_config_value: 'dangerous'
}
```

### Phase 2: IPC Integration

#### 2.1 Main Process Handlers

```typescript
// src/main/mcp/ipc.ts

import { ipcMain, BrowserWindow } from 'electron'
import { mcpManager } from './manager'
import { DESKTOP_COMMANDER_CONFIG, TOOL_RISK_LEVELS } from './servers/desktop-commander'

// Pending tool calls awaiting user approval
interface PendingToolCall {
  id: string
  serverName: string
  toolName: string
  args: Record<string, unknown>
  riskLevel: 'safe' | 'moderate' | 'dangerous'
  timestamp: Date
  resolve: (result: unknown) => void
  reject: (error: Error) => void
}

const pendingCalls = new Map<string, PendingToolCall>()

export function setupMCPHandlers(): void {
  
  // Initialize MCP on app start
  ipcMain.handle('mcp:init', async () => {
    try {
      await mcpManager.connectServer(DESKTOP_COMMANDER_CONFIG)
      return { success: true, tools: mcpManager.getAvailableTools() }
    } catch (error) {
      console.error('[MCP] Init failed:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // Get available tools (for UI display)
  ipcMain.handle('mcp:get-tools', async () => {
    return mcpManager.getAvailableTools()
  })
  
  // Request tool execution (creates pending approval)
  ipcMain.handle('mcp:request-tool', async (event, { 
    serverName, 
    toolName, 
    args 
  }: {
    serverName: string
    toolName: string
    args: Record<string, unknown>
  }) => {
    const id = crypto.randomUUID()
    const riskLevel = TOOL_RISK_LEVELS[toolName] || 'moderate'
    
    const win = BrowserWindow.fromWebContents(event.sender)
    
    // For 'safe' tools, auto-approve (configurable)
    if (riskLevel === 'safe') {
      try {
        const result = await mcpManager.callTool(serverName, toolName, args)
        return { id, approved: true, result }
      } catch (error) {
        return { id, approved: true, error: String(error) }
      }
    }
    
    // For moderate/dangerous, queue for approval
    return new Promise((resolve) => {
      pendingCalls.set(id, {
        id,
        serverName,
        toolName,
        args,
        riskLevel,
        timestamp: new Date(),
        resolve: (result) => resolve({ id, approved: true, result }),
        reject: (error) => resolve({ id, approved: false, error: String(error) })
      })
      
      // Notify renderer of pending approval
      win?.webContents.send('mcp:approval-required', {
        id,
        toolName,
        args,
        riskLevel
      })
      
      resolve({ id, pending: true, riskLevel })
    })
  })
  
  // User approves tool execution
  ipcMain.handle('mcp:approve', async (_, { 
    id, 
    modifiedArgs 
  }: { 
    id: string
    modifiedArgs?: Record<string, unknown> 
  }) => {
    const pending = pendingCalls.get(id)
    if (!pending) {
      return { error: 'Pending call not found' }
    }
    
    try {
      const result = await mcpManager.callTool(
        pending.serverName,
        pending.toolName,
        modifiedArgs || pending.args
      )
      pending.resolve(result)
      pendingCalls.delete(id)
      return { success: true, result }
    } catch (error) {
      pending.reject(error as Error)
      pendingCalls.delete(id)
      return { success: false, error: String(error) }
    }
  })
  
  // User rejects tool execution
  ipcMain.handle('mcp:reject', async (_, { id }: { id: string }) => {
    const pending = pendingCalls.get(id)
    if (pending) {
      pending.reject(new Error('User rejected'))
      pendingCalls.delete(id)
    }
    return { rejected: true }
  })
  
  // Cleanup on app quit
  ipcMain.handle('mcp:shutdown', async () => {
    await mcpManager.disconnectAll()
  })
}
```

#### 2.2 Preload Additions

```typescript
// src/preload/index.ts (additions)

const mcpApi = {
  // Initialize MCP servers
  init: () => ipcRenderer.invoke('mcp:init'),
  
  // Get available tools
  getTools: () => ipcRenderer.invoke('mcp:get-tools'),
  
  // Request tool execution
  requestTool: (serverName: string, toolName: string, args: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp:request-tool', { serverName, toolName, args }),
  
  // Approve pending tool
  approve: (id: string, modifiedArgs?: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp:approve', { id, modifiedArgs }),
  
  // Reject pending tool
  reject: (id: string) =>
    ipcRenderer.invoke('mcp:reject', { id }),
  
  // Listen for approval requests
  onApprovalRequired: (callback: (data: {
    id: string
    toolName: string
    args: Record<string, unknown>
    riskLevel: 'safe' | 'moderate' | 'dangerous'
  }) => void) => 
    ipcRenderer.on('mcp:approval-required', (_, data) => callback(data)),
  
  // Cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('mcp:approval-required')
  }
}

// Add to contextBridge
contextBridge.exposeInMainWorld('api', {
  ...existingApi,
  mcp: mcpApi
})
```

### Phase 3: AI Integration

#### 3.1 Tool-Augmented System Prompt

```typescript
// src/main/mcp/prompts.ts

export function generateToolSystemPrompt(tools: ToolDefinition[]): string {
  const toolDescriptions = tools.map(tool => `
### ${tool.name}
${tool.description}

**Input Schema:**
\`\`\`json
${JSON.stringify(tool.inputSchema, null, 2)}
\`\`\`
`).join('\n')

  return `
You have access to the following tools for interacting with the local file system and processes:

${toolDescriptions}

## How to Request Tool Use

When you want to use a tool, respond with a JSON block in this format:

\`\`\`tool_use
{
  "tool": "tool_name",
  "args": {
    "param1": "value1",
    "param2": "value2"
  },
  "explanation": "Brief explanation of why you're using this tool"
}
\`\`\`

## Guidelines

1. **Explain before acting** - Always explain what you're about to do
2. **Read before write** - Check file contents/existence before modifying
3. **Use absolute paths** - Always use full paths like /Users/cory.naegle/project
4. **Handle errors gracefully** - If a tool fails, explain what happened and suggest fixes
5. **Wait for results** - After requesting a tool, wait for the result before continuing
6. **Prefer safe operations** - Use read-only tools when possible

## Tool Categories

**File System (read-only):** read_file, list_directory, get_file_info
**File System (write):** write_file, create_directory, move_file, edit_block
**Search:** start_search, get_more_search_results
**Processes:** start_process, interact_with_process, list_sessions
`
}
```

#### 3.2 Tool Call Parser

```typescript
// src/renderer/src/lib/toolParser.ts

interface ToolCall {
  tool: string
  args: Record<string, unknown>
  explanation: string
}

export function parseToolCalls(content: string): ToolCall[] {
  const regex = /```tool_use\n([\s\S]*?)\n```/g
  const calls: ToolCall[] = []
  
  let match
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      calls.push({
        tool: parsed.tool,
        args: parsed.args || {},
        explanation: parsed.explanation || ''
      })
    } catch (e) {
      console.error('Failed to parse tool call:', e)
    }
  }
  
  return calls
}

export function stripToolCalls(content: string): string {
  return content.replace(/```tool_use\n[\s\S]*?\n```/g, '')
}
```

### Phase 4: UI Components

#### 4.1 ToolApprovalCard

```tsx
// src/renderer/src/components/ToolApprovalCard.tsx

import { useState } from 'react'
import { cn } from '../lib/utils'
import { Terminal, FileText, Search, Cpu, AlertTriangle } from 'lucide-react'

interface ToolApprovalCardProps {
  id: string
  toolName: string
  args: Record<string, unknown>
  explanation: string
  riskLevel: 'safe' | 'moderate' | 'dangerous'
  onApprove: (id: string, modifiedArgs?: Record<string, unknown>) => void
  onReject: (id: string) => void
}

const TOOL_ICONS: Record<string, typeof Terminal> = {
  read_file: FileText,
  write_file: FileText,
  list_directory: FileText,
  start_search: Search,
  start_process: Terminal,
  // ... more mappings
}

export function ToolApprovalCard({
  id,
  toolName,
  args,
  explanation,
  riskLevel,
  onApprove,
  onReject
}: ToolApprovalCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedArgs, setEditedArgs] = useState(JSON.stringify(args, null, 2))
  
  const Icon = TOOL_ICONS[toolName] || Cpu
  
  const riskStyles = {
    safe: 'border-green-500/50 bg-green-500/10',
    moderate: 'border-yellow-500/50 bg-yellow-500/10', 
    dangerous: 'border-red-500/50 bg-red-500/10'
  }
  
  const riskLabels = {
    safe: 'Safe',
    moderate: 'Moderate Risk',
    dangerous: 'Dangerous'
  }
  
  const handleApprove = () => {
    if (isEditing) {
      try {
        const parsed = JSON.parse(editedArgs)
        onApprove(id, parsed)
      } catch {
        alert('Invalid JSON')
        return
      }
    } else {
      onApprove(id)
    }
  }
  
  return (
    <div className={cn(
      'rounded-lg border-2 p-4 my-3 transition-all',
      riskStyles[riskLevel]
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className="text-primary" />
        <span className="font-semibold">{toolName}</span>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          riskLevel === 'safe' && 'bg-green-500/20 text-green-400',
          riskLevel === 'moderate' && 'bg-yellow-500/20 text-yellow-400',
          riskLevel === 'dangerous' && 'bg-red-500/20 text-red-400'
        )}>
          {riskLabels[riskLevel]}
        </span>
      </div>
      
      {/* Explanation */}
      {explanation && (
        <p className="text-sm text-text-muted mb-3">{explanation}</p>
      )}
      
      {/* Arguments */}
      <div className="bg-tertiary rounded-md p-3 font-mono text-xs mb-3 overflow-x-auto">
        {isEditing ? (
          <textarea
            value={editedArgs}
            onChange={(e) => setEditedArgs(e.target.value)}
            className="w-full bg-transparent focus:outline-none resize-none min-h-[100px]"
            spellCheck={false}
          />
        ) : (
          <pre>{JSON.stringify(args, null, 2)}</pre>
        )}
      </div>
      
      {/* Dangerous warning */}
      {riskLevel === 'dangerous' && (
        <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
          <AlertTriangle size={16} />
          <span>This action may have irreversible effects</span>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          className={cn(
            'px-4 py-2 rounded-md font-medium transition-colors',
            riskLevel === 'dangerous' 
              ? 'bg-red-600 hover:bg-red-500' 
              : 'bg-green-600 hover:bg-green-500',
            'text-white'
          )}
        >
          {riskLevel === 'dangerous' ? '⚠ Execute Anyway' : '✓ Approve'}
        </button>
        
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 rounded-md bg-secondary hover:bg-secondary/80"
        >
          {isEditing ? 'Preview' : '✎ Edit'}
        </button>
        
        <button
          onClick={() => onReject(id)}
          className="px-4 py-2 rounded-md bg-tertiary hover:bg-tertiary/80 text-text-muted"
        >
          ✕ Reject
        </button>
      </div>
    </div>
  )
}
```

#### 4.2 ToolResultCard

```tsx
// src/renderer/src/components/ToolResultCard.tsx

interface ToolResultCardProps {
  toolName: string
  result: unknown
  error?: string
  duration?: number
}

export function ToolResultCard({ 
  toolName, 
  result, 
  error,
  duration 
}: ToolResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  
  const isSuccess = !error
  const displayResult = typeof result === 'string' 
    ? result 
    : JSON.stringify(result, null, 2)
  
  return (
    <div className={cn(
      'rounded-lg border p-3 my-2',
      isSuccess ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <span className="text-green-400">✓</span>
          ) : (
            <span className="text-red-400">✕</span>
          )}
          <span className="font-medium text-sm">{toolName}</span>
        </div>
        {duration && (
          <span className="text-xs text-text-muted">{duration}ms</span>
        )}
      </div>
      
      <div className={cn(
        'font-mono text-xs bg-tertiary rounded p-2 overflow-hidden',
        !expanded && 'max-h-32'
      )}>
        <pre className="whitespace-pre-wrap">
          {error || displayResult}
        </pre>
      </div>
      
      {(displayResult?.length > 500 || error) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline mt-2"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}
```

---

## Configuration

### Settings Schema

```typescript
// src/main/mcp/config.ts

interface MCPConfig {
  enabled: boolean
  autoApprove: {
    safe: boolean      // Auto-approve safe tools
    moderate: boolean  // Auto-approve moderate tools (not recommended)
  }
  allowedDirectories: string[]  // Restrict file operations
  blockedTools: string[]        // Tools that are never allowed
  servers: Array<{
    name: string
    command: string
    args: string[]
    enabled: boolean
  }>
}

const DEFAULT_CONFIG: MCPConfig = {
  enabled: true,
  autoApprove: {
    safe: true,
    moderate: false
  },
  allowedDirectories: [
    process.env.HOME || '',
    '/tmp'
  ],
  blockedTools: [],
  servers: [
    {
      name: 'desktop-commander',
      command: 'npx',
      args: ['-y', '@anthropic/desktop-commander-mcp'],
      enabled: true
    }
  ]
}
```

---

## Alternative: Using Claude API with Built-in MCP

If ArborChat adds Claude as a provider, you can leverage Claude's native MCP support:

```typescript
// src/main/providers/claude.ts

import Anthropic from '@anthropic-ai/sdk'

export class ClaudeProvider implements AIProvider {
  name = 'Claude'
  
  async streamResponse(params: StreamParams, apiKey: string): Promise<void> {
    const client = new Anthropic({ apiKey })
    
    // Claude API with MCP servers
    const response = await client.messages.create({
      model: params.modelId,
      max_tokens: 4096,
      messages: params.messages,
      // Native MCP support in Claude API
      mcp_servers: [
        {
          type: 'url',
          url: 'http://localhost:3000/mcp',  // Local MCP server
          name: 'desktop-commander'
        }
      ]
    })
    
    // Handle response with tool use...
  }
}
```

---

## Installation & Setup

### 1. Install Dependencies

```bash
cd /Users/cory.naegle/ArborChat
npm install @modelcontextprotocol/sdk
```

### 2. Install Desktop Commander (Global)

```bash
# Option A: Global install
npm install -g @anthropic/desktop-commander-mcp

# Option B: Use npx (no install needed)
# The config already uses npx -y
```

### 3. Create MCP Module Structure

```bash
mkdir -p src/main/mcp/servers
touch src/main/mcp/manager.ts
touch src/main/mcp/ipc.ts
touch src/main/mcp/prompts.ts
touch src/main/mcp/config.ts
touch src/main/mcp/servers/desktop-commander.ts
```

### 4. Update Main Process Entry

```typescript
// src/main/index.ts

import { setupMCPHandlers } from './mcp/ipc'

// In app.whenReady():
setupMCPHandlers()
```

---

## Security Considerations

1. **Human-in-the-Loop** - All moderate/dangerous tools require explicit approval
2. **Directory Sandboxing** - Restrict file operations to allowed paths
3. **Tool Blocklist** - Disable specific dangerous tools entirely
4. **Audit Logging** - Log all tool requests and executions
5. **Rate Limiting** - Prevent runaway tool execution
6. **Timeout Enforcement** - Kill long-running processes

---

## Testing

```typescript
// Manual test sequence
const testMCP = async () => {
  // 1. Initialize
  await window.api.mcp.init()
  
  // 2. List available tools
  const tools = await window.api.mcp.getTools()
  console.log('Available tools:', tools.map(t => t.name))
  
  // 3. Test safe tool (should auto-execute)
  const listResult = await window.api.mcp.requestTool(
    'desktop-commander',
    'list_directory',
    { path: '/Users/cory.naegle/ArborChat', depth: 1 }
  )
  console.log('List result:', listResult)
  
  // 4. Test moderate tool (should require approval)
  const writeResult = await window.api.mcp.requestTool(
    'desktop-commander',
    'write_file',
    { path: '/tmp/test.txt', content: 'Hello from ArborChat!' }
  )
  console.log('Write result:', writeResult)
}
```

---

## Next Steps

1. [ ] Install MCP SDK dependency
2. [ ] Create `src/main/mcp/` module structure
3. [ ] Implement MCPManager class
4. [ ] Add IPC handlers
5. [ ] Update preload with MCP API
6. [ ] Create UI components (ToolApprovalCard, ToolResultCard)
7. [ ] Integrate with AI providers
8. [ ] Add settings UI for MCP configuration
9. [ ] Write tests
10. [ ] Document usage
