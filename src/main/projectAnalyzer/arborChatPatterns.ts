// src/main/projectAnalyzer/arborChatPatterns.ts
/**
 * ArborChat-Specific Pattern Map
 * 
 * Temporary hardcoded pattern map for ArborChat development.
 * This will be replaced by the full ProjectAnalyzer service.
 * 
 * @author Alex Chen (Distinguished Software Architect)
 * @phase Agent Search Efficiency - Quick Win
 */

/**
 * Quick reference patterns for ArborChat codebase
 * Injected into agent prompts when workingDirectory matches ArborChat
 */
export const ARBORCHAT_CONTEXT = `
## 🚀 ArborChat Project Intelligence

**Project:** ArborChat (Electron + React + TypeScript)
**Root:** /Users/cory.naegle/ArborChat

---

### ⚡ CRITICAL: Search Efficiency Rules

1. **NEVER** use broad \`list_directory\` operations on /src or /
2. **ALWAYS** use \`start_search\` with \`searchType: "content"\`
3. **ALWAYS** filter with \`filePattern: "*.ts|*.tsx"\`
4. **ALWAYS** narrow path to specific subdirectory when possible

**Efficient Search Pattern:**
\`\`\`tool_use
{
  "tool": "start_search",
  "args": {
    "searchType": "content",
    "pattern": "<your search term>",
    "path": "/Users/cory.naegle/ArborChat/src/renderer",
    "filePattern": "*.ts|*.tsx"
  },
  "explanation": "Searching for <feature> implementation"
}
\`\`\`

---

### 📍 Code Pattern Quick Reference

| Feature | Direct Path | Search Terms |
|---------|-------------|--------------|
| **Slash Commands** | \`src/renderer/src/hooks/useSlashCommands.ts\` | SlashCommand, baseCommands, executeCommand |
| **IPC Handlers** | \`src/main/*.ts\` | ipcMain.handle, setupHandlers |
| **Preload APIs** | \`src/preload/index.ts\` | contextBridge, ipcRenderer.invoke |
| **React Components** | \`src/renderer/src/components/\` | export function, React.FC |
| **React Hooks** | \`src/renderer/src/hooks/\` | export function use, useState |
| **Context Providers** | \`src/renderer/src/contexts/\` | createContext, Provider |
| **MCP Tool UI** | \`src/renderer/src/components/mcp/\` | Tool, ToolApproval, ToolResult |
| **Type Definitions** | \`src/renderer/src/types/\` | interface, type |
| **Agent System** | \`src/renderer/src/contexts/AgentContext.tsx\` | Agent, useAgent, createAgent |
| **Database/Storage** | \`src/main/db/\` | better-sqlite3, getDb |
| **MCP Manager** | \`src/main/mcp/\` | mcpManager, executeTool |
| **Personas** | \`src/main/personas/\` | PersonaManager, loadPersona |
| **Notifications** | \`src/main/notifications/\` | sendNotification |
| **Work Journal** | \`src/main/workJournal/\` | WorkJournalManager |

---

### 🎯 Common Task Shortcuts

**To add a new slash command:**
1. Open \`src/renderer/src/hooks/useSlashCommands.ts\`
2. Add entry to \`baseCommands\` array (around line 70)
3. Add handler in \`executeCommand\` function (around line 250)

**To add a new IPC handler:**
1. Create handler in \`src/main/\` (e.g., \`src/main/myFeature.ts\`)
2. Add \`ipcMain.handle('my:channel', async (event, args) => {...})\`
3. Expose in \`src/preload/index.ts\` under \`api\` object
4. Update \`src/preload/index.d.ts\` with types

**To add a new React component:**
1. Create in \`src/renderer/src/components/<domain>/\`
2. Export from component's \`index.ts\` barrel file
3. Use Tailwind CSS for styling
4. Use Lucide for icons

**To add a new React hook:**
1. Create in \`src/renderer/src/hooks/\`
2. Export from \`src/renderer/src/hooks/index.ts\`
3. Follow \`use<n>\` naming convention

---

### 📁 Directory Purpose Map

\`\`\`
/Users/cory.naegle/ArborChat/
├── src/
│   ├── main/              # Electron main process
│   │   ├── mcp/           # MCP server management, tool execution
│   │   ├── db/            # SQLite database operations
│   │   ├── providers/     # AI provider implementations
│   │   ├── credentials/   # Secure credential storage
│   │   ├── memory/        # ArborMemoryService
│   │   ├── workJournal/   # Agent session persistence
│   │   └── personas/      # Persona management
│   ├── renderer/src/      # React application
│   │   ├── components/    # UI components
│   │   │   ├── mcp/       # MCP tool UI (ToolApproval, ToolResult, etc.)
│   │   │   ├── agent/     # Agent panel components
│   │   │   └── chat/      # Chat UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── contexts/      # React context providers
│   │   ├── types/         # TypeScript type definitions
│   │   └── lib/           # Utility functions
│   └── preload/           # Electron preload scripts (IPC bridge)
├── docs/
│   └── designs/           # Design documents
└── resources/             # App icons, assets
\`\`\`

---

### ⚠️ Anti-Patterns to Avoid

❌ **DON'T:** \`list_directory({ path: "/Users/cory.naegle/ArborChat", depth: 5 })\`
✅ **DO:** \`start_search({ searchType: "content", pattern: "myFeature", path: "/Users/cory.naegle/ArborChat/src/renderer", filePattern: "*.ts|*.tsx" })\`

❌ **DON'T:** Multiple sequential \`list_directory\` calls to browse the tree
✅ **DO:** One targeted \`start_search\` with specific search terms

❌ **DON'T:** \`read_file\` on multiple files hoping to find the right one
✅ **DO:** \`start_search\` first, then \`read_file\` on the exact match
`

/**
 * Check if a working directory is the ArborChat project
 */
export function isArborChatProject(workingDirectory: string): boolean {
  const normalized = workingDirectory.replace(/\\/g, '/').replace(/\/$/, '')
  console.log('[ProjectAnalyzer] isArborChatProject checking:', normalized)
  const result = (
    normalized.endsWith('/ArborChat') ||
    normalized.includes('/ArborChat/') ||
    normalized === '/Users/cory.naegle/ArborChat'
  )
  console.log('[ProjectAnalyzer] isArborChatProject result:', result)
  return result
}

/**
 * Get project context for ArborChat
 * Returns the hardcoded context if working directory is ArborChat
 */
export function getArborChatContext(workingDirectory: string): string | null {
  if (isArborChatProject(workingDirectory)) {
    return ARBORCHAT_CONTEXT
  }
  return null
}
