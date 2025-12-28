# ArborChat GitHub MCP Server Implementation Prompt

## Project Context

**Project:** ArborChat - A threaded AI chat desktop application  
**Location:** `/Users/cory.naegle/ArborChat`  
**Repository:**
- Fork: `https://github.com/corynaegle-ai/ArborChat`
- Upstream: `https://github.com/jordannaegle/ArborChat`

**Tech Stack:**
- Electron (main + renderer processes)
- TypeScript
- React (renderer)
- Tailwind CSS
- Vite (bundler)
- SQLite (via better-sqlite3)
- MCP SDK (`@modelcontextprotocol/sdk`)

---

## Task Overview

Implement the GitHub MCP Server integration into ArborChat following the design document at `/Users/cory.naegle/ArborChat/docs/GITHUB_MCP_DESIGN.md`.

This will enable users to interact with GitHub directly through the AI chat interface, performing operations like:
- Searching repositories and code
- Creating and managing issues
- Creating and reviewing pull requests
- Browsing file contents and commits

---

## Existing MCP Architecture

ArborChat already has a working MCP implementation for Desktop Commander. The GitHub integration should follow the same patterns.

### Key Existing Files

```
src/main/mcp/
├── index.ts           # Barrel exports
├── types.ts           # Type definitions
├── config.ts          # Configuration loading/saving
├── manager.ts         # MCPManager class (singleton)
├── ipc.ts             # IPC handlers for renderer communication
└── servers/
    └── desktop-commander.ts  # Desktop Commander config & risk levels
```

### Existing Patterns to Follow

1. **Server Configuration** - See `desktop-commander.ts` for the pattern
2. **Risk Levels** - Tools are classified as `safe`, `moderate`, or `dangerous`
3. **IPC Communication** - All MCP operations go through IPC handlers
4. **Tool Categories** - Tools are grouped for UI organization

---

## Implementation Requirements

### Phase 1: Core Implementation

#### 1.1 Create GitHub Server Configuration

**File:** `src/main/mcp/servers/github.ts`

Create this file with:
- `GITHUB_MCP_CONFIG` - MCPServerConfig object
- `GITHUB_TOOL_CATEGORIES` - Tool groupings for UI
- `GITHUB_TOOL_RISK_LEVELS` - Risk classification for each tool
- `getGitHubToolCategory()` - Helper function
- `getGitHubToolRiskLevel()` - Helper function
- `REQUIRED_GITHUB_SCOPES` - PAT scope requirements

Reference the design document for the complete tool list and risk levels.

#### 1.2 Create Credential Management

**File:** `src/main/mcp/credentials.ts`

Implement secure credential storage using Electron's `safeStorage` API:

```typescript
// Required exports:
export function isSecureStorageAvailable(): boolean
export async function saveGitHubToken(token: string, scopes?: string[]): Promise<void>
export async function getGitHubToken(): Promise<string | null>
export async function deleteGitHubToken(): Promise<void>
export async function isGitHubConfigured(): Promise<boolean>
```

**Important:** Use `electron.safeStorage` for encryption. Store encrypted data in the app's userData directory.

#### 1.3 Update Configuration

**File:** `src/main/mcp/config.ts`

- Import `GITHUB_MCP_CONFIG` from `./servers/github`
- Add GitHub to the `DEFAULT_MCP_CONFIG.servers` array
- GitHub should be `enabled: false` by default (requires authentication)

#### 1.4 Add GitHub IPC Handlers

**File:** `src/main/mcp/ipc.ts`

Add these new handlers inside `setupMCPHandlers()`:

```typescript
// Check if GitHub is configured
ipcMain.handle('mcp:github:is-configured', async () => { ... })

// Configure GitHub with PAT
ipcMain.handle('mcp:github:configure', async (_, { token }) => { ... })

// Disconnect GitHub
ipcMain.handle('mcp:github:disconnect', async () => { ... })

// Get GitHub status
ipcMain.handle('mcp:github:status', async () => { ... })
```

Include a `validateGitHubToken()` helper that tests the token against GitHub's API.

#### 1.5 Update Type Definitions

**File:** `src/main/mcp/types.ts`

Add:
```typescript
export interface GitHubStatus {
  isConfigured: boolean
  isConnected: boolean
  toolCount: number
}

export interface GitHubConfigureResult {
  success: boolean
  tools?: ToolDefinition[]
  error?: string
}
```

#### 1.6 Update Barrel Exports

**File:** `src/main/mcp/index.ts`

Add exports for:
- All exports from `./servers/github`
- All exports from `./credentials`

#### 1.7 Update Preload Script

**File:** `src/preload/index.ts`

Add GitHub-specific API to the `mcpApi` object:

```typescript
github: {
  isConfigured: () => ipcRenderer.invoke('mcp:github:is-configured'),
  configure: (token: string) => ipcRenderer.invoke('mcp:github:configure', { token }),
  disconnect: () => ipcRenderer.invoke('mcp:github:disconnect'),
  getStatus: () => ipcRenderer.invoke('mcp:github:status')
}
```

#### 1.8 Update Preload Type Definitions

**File:** `src/preload/index.d.ts`

Add type definitions for the new GitHub API methods.

---

### Phase 2: UI Components (Optional - Can be separate PR)

#### 2.1 GitHub Settings Component

**File:** `src/renderer/src/components/settings/GitHubSettings.tsx`

Create a settings panel component that:
- Shows connection status (connected/disconnected)
- Provides a secure input field for the PAT
- Has Connect/Disconnect buttons
- Links to GitHub's PAT creation page
- Shows required scopes
- Displays error messages

#### 2.2 Update Tool Approval Card

**File:** `src/renderer/src/components/ToolApprovalCard.tsx` (if exists)

Add GitHub-specific icons for tools:
- Use appropriate Lucide icons for GitHub operations
- Add GitHub branding/styling for GitHub tools

---

## Code Examples

### Example: GitHub Server Config Structure

```typescript
// src/main/mcp/servers/github.ts

import { MCPServerConfig } from '../types'

export const GITHUB_MCP_CONFIG: MCPServerConfig = {
  name: 'github',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  enabled: false,
  env: {}
}

export const GITHUB_TOOL_CATEGORIES: Record<string, string[]> = {
  repository: ['search_repositories', 'create_repository', ...],
  issues: ['create_issue', 'list_issues', ...],
  // ... see design doc for complete list
}

export const GITHUB_TOOL_RISK_LEVELS: Record<string, 'safe' | 'moderate' | 'dangerous'> = {
  get_file_contents: 'safe',
  create_issue: 'moderate',
  merge_pull_request: 'dangerous',
  // ... see design doc for complete list
}
```

### Example: Credential Storage

```typescript
// src/main/mcp/credentials.ts

import { safeStorage } from 'electron'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const CREDENTIALS_FILE = 'mcp-credentials.enc'

export async function saveGitHubToken(token: string): Promise<void> {
  const credPath = path.join(app.getPath('userData'), CREDENTIALS_FILE)
  const data = JSON.stringify({ github: { token, createdAt: new Date().toISOString() } })
  const encrypted = safeStorage.encryptString(data)
  fs.writeFileSync(credPath, encrypted)
}
```

### Example: IPC Handler

```typescript
// In src/main/mcp/ipc.ts

ipcMain.handle('mcp:github:configure', async (_, { token }: { token: string }) => {
  try {
    // 1. Validate token
    const isValid = await validateGitHubToken(token)
    if (!isValid) {
      return { success: false, error: 'Invalid token' }
    }

    // 2. Save securely
    await saveGitHubToken(token)

    // 3. Update config
    const config = loadMCPConfig()
    const githubServer = config.servers.find(s => s.name === 'github')
    if (githubServer) {
      githubServer.enabled = true
    }
    saveMCPConfig(config)

    // 4. Connect server
    await mcpManager.connectServer({
      ...GITHUB_MCP_CONFIG,
      enabled: true,
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: token }
    })

    return { success: true, tools: mcpManager.getServerTools('github') }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})
```

---

## Testing Instructions

### Manual Testing

1. **Token Configuration:**
   - Create a GitHub PAT at https://github.com/settings/tokens
   - Required scopes: `repo`, `read:user`
   - Configure in ArborChat settings
   - Verify connection status shows "Connected"

2. **Tool Discovery:**
   - After connecting, verify tools are listed
   - Check that tools have correct categories
   - Verify risk levels are applied

3. **Tool Execution:**
   - Test a safe tool: `search_repositories`
   - Test a moderate tool: `create_issue`
   - Verify approval flow works for moderate/dangerous tools

4. **Disconnection:**
   - Disconnect GitHub
   - Verify token is removed
   - Verify server is disconnected

### Automated Tests (Optional)

Create tests in `src/main/mcp/__tests__/`:
- `github.test.ts` - Test configuration and risk levels
- `credentials.test.ts` - Test secure storage (mock safeStorage)

---

## Important Notes

### Security Requirements

1. **NEVER** log the GitHub token
2. **NEVER** store the token in plain text
3. **ALWAYS** use `safeStorage` for encryption
4. **ALWAYS** validate tokens before saving
5. Clear sensitive data from memory when possible

### Error Handling

Handle these GitHub-specific errors:
- 401: Invalid/expired token
- 403: Rate limit exceeded or insufficient permissions
- 404: Resource not found
- 422: Invalid request parameters

### Compatibility

- The GitHub MCP server requires Node.js 18+
- npx must be available in PATH
- For offline/air-gapped environments, consider Docker option

---

## Acceptance Criteria

### Phase 1 Complete When:

- [ ] `src/main/mcp/servers/github.ts` exists with all exports
- [ ] `src/main/mcp/credentials.ts` exists with secure storage
- [ ] `src/main/mcp/config.ts` includes GitHub server
- [ ] `src/main/mcp/ipc.ts` has all GitHub handlers
- [ ] `src/main/mcp/types.ts` has GitHub types
- [ ] `src/main/mcp/index.ts` exports GitHub modules
- [ ] `src/preload/index.ts` has GitHub API
- [ ] `src/preload/index.d.ts` has GitHub types
- [ ] App compiles without errors
- [ ] Can configure GitHub via IPC
- [ ] Can connect to GitHub MCP server
- [ ] Can execute GitHub tools
- [ ] Token is stored securely

### Phase 2 Complete When:

- [ ] GitHub settings UI component exists
- [ ] Can configure GitHub from settings
- [ ] Connection status is visible
- [ ] Tool approval shows GitHub icons
- [ ] Error messages are user-friendly

---

## Reference Documents

- **Design Document:** `/Users/cory.naegle/ArborChat/docs/GITHUB_MCP_DESIGN.md`
- **Existing MCP Design:** `/Users/cory.naegle/ArborChat/docs/MCP_INTEGRATION_DESIGN.md`
- **Desktop Commander Reference:** `/Users/cory.naegle/ArborChat/src/main/mcp/servers/desktop-commander.ts`

---

## Commands to Run

```bash
# Navigate to project
cd /Users/cory.naegle/ArborChat

# Install dependencies (if needed)
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck
```

---

## Getting Started

1. Read the design document thoroughly
2. Review existing MCP implementation files
3. Start with `src/main/mcp/servers/github.ts`
4. Then implement `src/main/mcp/credentials.ts`
5. Update existing files (`config.ts`, `ipc.ts`, `types.ts`, `index.ts`)
6. Update preload scripts
7. Test manually with a real GitHub PAT
8. Create PR with changes

---

*Prompt Version: 1.0*
*Created: December 2024*
