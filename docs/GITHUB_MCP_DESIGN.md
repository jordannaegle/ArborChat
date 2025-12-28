# GitHub MCP Server Integration Design for ArborChat

## Executive Summary

This document outlines the design for integrating the GitHub MCP Server into ArborChat, enabling AI-assisted GitHub operations like repository management, issue tracking, pull request handling, and code search directly within the chat interface.

---

## Overview

### What is the GitHub MCP Server?

GitHub provides an official MCP (Model Context Protocol) server that enables AI tools to interact with GitHub's platform. It provides:

- **Repository Management**: Browse code, search files, analyze commits, understand project structure
- **Issue & PR Automation**: Create, update, and manage issues and pull requests
- **CI/CD & Workflow Intelligence**: Monitor GitHub Actions, analyze build failures, manage releases
- **Code Analysis**: Search code, examine security findings, review Dependabot alerts

### Available Packages

There are two versions of the GitHub MCP server:

1. **Legacy Package**: `@modelcontextprotocol/server-github` (deprecated)
2. **Official GitHub Package**: `github/github-mcp-server` (current, recommended)

This design will support both packages with the official GitHub package as the default.

---

## Architecture

### Integration with Existing MCP System

The GitHub MCP server will integrate with ArborChat's existing MCP architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXISTING MCP ARCHITECTURE                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                          MCPManager                               │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │   │
│  │  │ Desktop         │  │     GitHub      │  │    Future        │  │   │
│  │  │ Commander       │  │     MCP         │  │    Servers...    │  │   │
│  │  │ Server          │  │     Server      │  │                  │  │   │
│  │  └─────────────────┘  └─────────────────┘  └──────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### File Structure

New files to be created within the existing MCP module:

```
src/main/mcp/
├── servers/
│   ├── desktop-commander.ts    # Existing
│   └── github.ts               # NEW - GitHub server configuration
├── config.ts                   # UPDATE - Add GitHub to default servers
├── credentials.ts              # NEW - Secure credential management
└── types.ts                    # UPDATE - Add GitHub-specific types
```

---

## Detailed Design

### 1. GitHub Server Configuration

**File: `src/main/mcp/servers/github.ts`**

```typescript
// src/main/mcp/servers/github.ts

import { MCPServerConfig } from '../types'

/**
 * GitHub MCP Server Configuration
 *
 * GitHub MCP Server enables AI-assisted GitHub operations including
 * repository management, issue tracking, PR handling, and code search.
 */
export const GITHUB_MCP_CONFIG: MCPServerConfig = {
  name: 'github',
  // Uses the official GitHub MCP server
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  enabled: false, // Disabled by default until credentials are configured
  env: {
    // Token will be injected from secure credential storage
    // GITHUB_PERSONAL_ACCESS_TOKEN: '' // Set dynamically
  }
}

/**
 * Alternative configuration using Docker
 * Useful for isolated environments or when npx is not available
 */
export const GITHUB_MCP_DOCKER_CONFIG: MCPServerConfig = {
  name: 'github',
  command: 'docker',
  args: [
    'run',
    '-i',
    '--rm',
    '-e',
    'GITHUB_PERSONAL_ACCESS_TOKEN',
    'ghcr.io/github/github-mcp-server'
  ],
  enabled: false,
  env: {}
}
```

### 2. GitHub Tool Categories

```typescript
/**
 * Tool categories for UI grouping and filtering
 */
export const GITHUB_TOOL_CATEGORIES: Record<string, string[]> = {
  repository: [
    'search_repositories',
    'create_repository',
    'get_file_contents',
    'list_commits',
    'fork_repository',
    'create_branch'
  ],
  files: [
    'create_or_update_file',
    'push_files',
    'get_file_contents'
  ],
  issues: [
    'create_issue',
    'list_issues',
    'update_issue',
    'add_issue_comment',
    'search_issues'
  ],
  pullRequests: [
    'create_pull_request',
    'list_pull_requests',
    'get_pull_request',
    'merge_pull_request',
    'get_pull_request_diff',
    'get_pull_request_reviews',
    'update_pull_request_branch'
  ],
  search: [
    'search_code',
    'search_issues',
    'search_repositories',
    'search_users'
  ],
  users: [
    'get_me',
    'search_users'
  ]
}
```

### 3. GitHub Tool Risk Levels

```typescript
/**
 * Risk levels for GitHub tools
 *
 * - safe: Read-only operations, no side effects
 * - moderate: Create/update operations within repositories
 * - dangerous: Destructive operations, repository/org-level changes
 */
export const GITHUB_TOOL_RISK_LEVELS: Record<string, 'safe' | 'moderate' | 'dangerous'> = {
  // Safe - read-only operations
  get_file_contents: 'safe',
  list_commits: 'safe',
  list_issues: 'safe',
  list_pull_requests: 'safe',
  get_pull_request: 'safe',
  get_pull_request_diff: 'safe',
  get_pull_request_reviews: 'safe',
  search_repositories: 'safe',
  search_code: 'safe',
  search_issues: 'safe',
  search_users: 'safe',
  get_me: 'safe',

  // Moderate - create/update within existing repos
  create_issue: 'moderate',
  update_issue: 'moderate',
  add_issue_comment: 'moderate',
  create_or_update_file: 'moderate',
  push_files: 'moderate',
  create_branch: 'moderate',
  create_pull_request: 'moderate',
  update_pull_request_branch: 'moderate',

  // Dangerous - repository-level operations
  create_repository: 'dangerous',
  fork_repository: 'dangerous',
  merge_pull_request: 'dangerous',
  delete_branch: 'dangerous'
}
```

### 4. Helper Functions

```typescript
/**
 * Get the category for a GitHub tool
 */
export function getGitHubToolCategory(toolName: string): string | undefined {
  for (const [category, tools] of Object.entries(GITHUB_TOOL_CATEGORIES)) {
    if (tools.includes(toolName)) {
      return category
    }
  }
  return undefined
}

/**
 * Get the risk level for a GitHub tool (defaults to 'moderate' if unknown)
 */
export function getGitHubToolRiskLevel(toolName: string): 'safe' | 'moderate' | 'dangerous' {
  return GITHUB_TOOL_RISK_LEVELS[toolName] || 'moderate'
}

/**
 * Get human-readable description for a GitHub tool category
 */
export function getGitHubCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    repository: 'Repository Management',
    files: 'File Operations',
    issues: 'Issue Tracking',
    pullRequests: 'Pull Request Management',
    search: 'Search Operations',
    users: 'User Information'
  }
  return descriptions[category] || category
}

/**
 * Required PAT scopes for full GitHub MCP functionality
 */
export const REQUIRED_GITHUB_SCOPES = [
  'repo',           // Full control of private repositories
  'public_repo',    // Access public repositories (alternative to 'repo')
  'read:org',       // Read organization data
  'read:user',      // Read user profile data
  'workflow'        // Update GitHub Actions workflows (optional)
]

/**
 * Minimum PAT scopes for read-only access
 */
export const READONLY_GITHUB_SCOPES = [
  'public_repo',
  'read:user'
]
```

---

## 5. Credential Management

### Design Principles

1. **Never store PAT in plain text** in configuration files
2. **Use system keychain** when available (macOS Keychain, Windows Credential Manager)
3. **Encrypt at rest** when keychain is unavailable
4. **Minimal scope principle** - request only needed permissions

**File: `src/main/mcp/credentials.ts`**

```typescript
// src/main/mcp/credentials.ts

import { safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

const CREDENTIALS_FILE = 'mcp-credentials.enc'

interface MCPCredentials {
  github?: {
    personalAccessToken: string
    tokenScopes?: string[]
    createdAt: string
  }
  // Future: Add other server credentials here
}

/**
 * Check if the system supports secure storage
 */
export function isSecureStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * Save GitHub PAT securely
 */
export async function saveGitHubToken(token: string, scopes?: string[]): Promise<void> {
  const credentials = await loadCredentials()

  credentials.github = {
    personalAccessToken: token,
    tokenScopes: scopes,
    createdAt: new Date().toISOString()
  }

  await saveCredentials(credentials)
}

/**
 * Retrieve GitHub PAT
 */
export async function getGitHubToken(): Promise<string | null> {
  const credentials = await loadCredentials()
  return credentials.github?.personalAccessToken || null
}

/**
 * Delete GitHub credentials
 */
export async function deleteGitHubToken(): Promise<void> {
  const credentials = await loadCredentials()
  delete credentials.github
  await saveCredentials(credentials)
}

/**
 * Check if GitHub is configured
 */
export async function isGitHubConfigured(): Promise<boolean> {
  const token = await getGitHubToken()
  return token !== null && token.length > 0
}

// Internal helpers

async function loadCredentials(): Promise<MCPCredentials> {
  const credPath = getCredentialsPath()

  if (!fs.existsSync(credPath)) {
    return {}
  }

  try {
    const encryptedData = fs.readFileSync(credPath)
    const decryptedBuffer = safeStorage.decryptString(encryptedData)
    return JSON.parse(decryptedBuffer)
  } catch (error) {
    console.error('[Credentials] Failed to load:', error)
    return {}
  }
}

async function saveCredentials(credentials: MCPCredentials): Promise<void> {
  const credPath = getCredentialsPath()
  const jsonString = JSON.stringify(credentials)
  const encryptedBuffer = safeStorage.encryptString(jsonString)
  fs.writeFileSync(credPath, encryptedBuffer)
}

function getCredentialsPath(): string {
  return path.join(app.getPath('userData'), CREDENTIALS_FILE)
}
```

---

## 6. IPC Handler Updates

### New IPC Handlers for GitHub Authentication

Add to `src/main/mcp/ipc.ts`:

```typescript
// GitHub-specific handlers

/**
 * Check if GitHub is configured
 */
ipcMain.handle('mcp:github:is-configured', async () => {
  return await isGitHubConfigured()
})

/**
 * Configure GitHub with a new PAT
 */
ipcMain.handle('mcp:github:configure', async (_, { token }: { token: string }) => {
  try {
    // Validate token by making a test API call
    const isValid = await validateGitHubToken(token)
    if (!isValid) {
      return { success: false, error: 'Invalid token or insufficient permissions' }
    }

    // Save the token securely
    await saveGitHubToken(token)

    // Enable and connect the GitHub server
    const config = loadMCPConfig()
    const githubServer = config.servers.find(s => s.name === 'github')
    if (githubServer) {
      githubServer.enabled = true
      githubServer.env = {
        ...githubServer.env,
        GITHUB_PERSONAL_ACCESS_TOKEN: token
      }
      saveMCPConfig(config)
    }

    // Connect to the server
    await mcpManager.connectServer({
      ...GITHUB_MCP_CONFIG,
      enabled: true,
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: token }
    })

    return {
      success: true,
      tools: mcpManager.getServerTools('github')
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

/**
 * Remove GitHub configuration
 */
ipcMain.handle('mcp:github:disconnect', async () => {
  await deleteGitHubToken()
  await mcpManager.disconnectServer('github')

  const config = loadMCPConfig()
  const githubServer = config.servers.find(s => s.name === 'github')
  if (githubServer) {
    githubServer.enabled = false
  }
  saveMCPConfig(config)

  return { success: true }
})

/**
 * Get GitHub connection status
 */
ipcMain.handle('mcp:github:status', async () => {
  const isConfigured = await isGitHubConfigured()
  const isConnected = mcpManager.isServerConnected('github')
  const tools = mcpManager.getServerTools('github')

  return {
    isConfigured,
    isConnected,
    toolCount: tools.length
  }
})
```

### Token Validation Helper

```typescript
/**
 * Validate a GitHub PAT by making a test API call
 */
async function validateGitHubToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ArborChat-MCP'
      }
    })
    return response.ok
  } catch {
    return false
  }
}
```

---

## 7. Configuration Updates

### Update Default Configuration

**File: `src/main/mcp/config.ts`**

Add GitHub to the default servers list:

```typescript
import { GITHUB_MCP_CONFIG } from './servers/github'

export const DEFAULT_MCP_CONFIG: MCPConfig = {
  enabled: true,
  autoApprove: {
    safe: true,
    moderate: false
  },
  allowedDirectories: [],
  blockedTools: [],
  timeout: 300000,
  servers: [
    DESKTOP_COMMANDER_CONFIG,
    GITHUB_MCP_CONFIG  // Add GitHub server (disabled by default)
  ]
}
```

---

## 8. Preload API Additions

**File: `src/preload/index.ts`**

Add GitHub-specific API methods:

```typescript
const mcpApi = {
  // ... existing methods ...

  // GitHub-specific
  github: {
    isConfigured: () => ipcRenderer.invoke('mcp:github:is-configured'),
    configure: (token: string) => ipcRenderer.invoke('mcp:github:configure', { token }),
    disconnect: () => ipcRenderer.invoke('mcp:github:disconnect'),
    getStatus: () => ipcRenderer.invoke('mcp:github:status')
  }
}
```

---

## 9. Type Definitions

### Update Types

**File: `src/main/mcp/types.ts`**

Add GitHub-specific types:

```typescript
// Add to existing types

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

// Extend MCPServerConfig for environment variables
export interface MCPServerConfig {
  name: string
  command: string
  args: string[]
  enabled: boolean
  env?: Record<string, string>
  requiresAuth?: boolean  // NEW: Indicates if server needs authentication
  authType?: 'pat' | 'oauth' | 'api-key'  // NEW: Type of authentication
}
```

---

## 10. UI Components

### GitHub Settings Panel

Create a new component for GitHub configuration in settings:

**File: `src/renderer/src/components/settings/GitHubSettings.tsx`**

```tsx
interface GitHubSettingsProps {}

export function GitHubSettings({}: GitHubSettingsProps) {
  const [isConfigured, setIsConfigured] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Component implementation:
  // - Show connection status
  // - Token input with secure masking
  // - Connect/Disconnect buttons
  // - Link to GitHub PAT creation page
  // - Scope requirements display
}
```

Key UI Elements:
1. **Status Indicator**: Shows if GitHub is connected
2. **Token Input**: Secure password field for PAT entry
3. **Help Link**: Direct link to GitHub's PAT creation page
4. **Scope Info**: Display required/recommended scopes
5. **Connect/Disconnect**: Action buttons

### Tool Approval Enhancement

Update `ToolApprovalCard` to show GitHub-specific context:

```tsx
// Add GitHub-specific icon and styling
const TOOL_ICONS: Record<string, typeof Terminal> = {
  // ... existing icons ...
  
  // GitHub tools
  create_issue: AlertCircle,
  create_pull_request: GitPullRequest,
  search_repositories: Search,
  get_file_contents: FileText,
  push_files: Upload,
  merge_pull_request: GitMerge
}

// Add GitHub branding for GitHub tools
const isGitHubTool = serverName === 'github'
```

---

## 11. Server Connection Flow

### Initialization Sequence

```
1. App starts
2. MCPManager loads config
3. For each server in config.servers:
   a. If server.enabled && server.requiresAuth:
      - Check if credentials exist
      - If yes: inject credentials into env and connect
      - If no: skip server (will be configured later via settings)
   b. If server.enabled && !server.requiresAuth:
      - Connect directly
```

### GitHub-Specific Connection Flow

```typescript
async function initializeGitHubServer(): Promise<void> {
  const token = await getGitHubToken()

  if (!token) {
    console.log('[GitHub MCP] Not configured - skipping connection')
    return
  }

  const config = {
    ...GITHUB_MCP_CONFIG,
    enabled: true,
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: token
    }
  }

  await mcpManager.connectServer(config)
}
```

---

## 12. Security Considerations

### Token Security

1. **Never log tokens** - Ensure PATs are never written to logs
2. **Memory safety** - Clear token from memory when not needed
3. **Electron secure storage** - Use `safeStorage` API for encryption
4. **Scope validation** - Warn if token has excessive permissions

### Rate Limiting

GitHub API has rate limits:
- Authenticated: 5,000 requests/hour
- Unauthenticated: 60 requests/hour

Consider implementing:
- Request counting
- Rate limit headers monitoring
- User warnings when approaching limits

### Error Handling

```typescript
const GITHUB_ERROR_MESSAGES: Record<number, string> = {
  401: 'Invalid or expired token. Please reconfigure GitHub.',
  403: 'Rate limit exceeded or insufficient permissions.',
  404: 'Resource not found. Check repository/issue exists.',
  422: 'Invalid request. Check your input parameters.'
}
```

---

## 13. Testing Strategy

### Unit Tests

```typescript
describe('GitHub MCP Integration', () => {
  describe('Credential Management', () => {
    it('should securely store and retrieve tokens')
    it('should handle missing credentials gracefully')
    it('should validate token format')
  })

  describe('Server Connection', () => {
    it('should connect with valid credentials')
    it('should fail gracefully with invalid credentials')
    it('should handle network errors')
  })

  describe('Tool Execution', () => {
    it('should correctly categorize tools')
    it('should apply correct risk levels')
    it('should require approval for moderate/dangerous tools')
  })
})
```

### Integration Tests

```typescript
describe('GitHub MCP E2E', () => {
  it('should list repositories')
  it('should create and close an issue')
  it('should search code')
  it('should handle rate limiting')
})
```

---

## 14. Implementation Phases

### Phase 1: Foundation (MVP)
- [ ] Create `src/main/mcp/servers/github.ts` with config and risk levels
- [ ] Create `src/main/mcp/credentials.ts` for secure token storage
- [ ] Update `config.ts` to include GitHub server
- [ ] Add GitHub IPC handlers
- [ ] Basic connection/disconnection flow

### Phase 2: UI Integration
- [ ] Create GitHub settings panel
- [ ] Add GitHub status indicator to MCP status
- [ ] Update tool approval cards with GitHub icons
- [ ] Add GitHub connection wizard

### Phase 3: Enhanced Features
- [ ] Token scope detection and warnings
- [ ] Rate limit monitoring
- [ ] GitHub Actions workflow integration
- [ ] Pull request review tools

### Phase 4: Polish
- [ ] Error handling improvements
- [ ] Logging and debugging tools
- [ ] Documentation and help text
- [ ] User onboarding flow

---

## 15. Dependencies

### Required

Already in project:
- `@modelcontextprotocol/sdk` - MCP client

### New (Optional)

For enhanced features:
- `@octokit/rest` - Type-safe GitHub API client (optional, for token validation)

---

## 16. Configuration Reference

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub PAT with required scopes | Yes |

### MCP Config Entry

```json
{
  "name": "github",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "enabled": false,
  "requiresAuth": true,
  "authType": "pat",
  "env": {}
}
```

---

## 17. Open Questions

1. **Remote vs Local Server**: Should we support GitHub's remote MCP server (`https://api.githubcopilot.com/mcp/`) as an alternative?

2. **OAuth Flow**: Should we implement OAuth instead of PAT for better UX?

3. **Multiple Accounts**: Should we support multiple GitHub accounts?

4. **Enterprise GitHub**: Should we support GitHub Enterprise with custom URLs?

---

## 18. References

- [GitHub MCP Server Repository](https://github.com/github/github-mcp-server)
- [MCP Protocol Documentation](https://modelcontextprotocol.io)
- [GitHub Personal Access Tokens](https://github.com/settings/tokens)
- [GitHub API Rate Limits](https://docs.github.com/en/rest/rate-limit)
- [Electron Safe Storage](https://www.electronjs.org/docs/latest/api/safe-storage)

---

## Appendix A: Complete Tool Reference

### Repository Tools

| Tool | Description | Risk |
|------|-------------|------|
| `search_repositories` | Search for GitHub repositories | Safe |
| `create_repository` | Create a new repository | Dangerous |
| `get_file_contents` | Get file/directory contents | Safe |
| `fork_repository` | Fork a repository | Dangerous |

### File Tools

| Tool | Description | Risk |
|------|-------------|------|
| `create_or_update_file` | Create or update a file | Moderate |
| `push_files` | Push multiple files | Moderate |

### Issue Tools

| Tool | Description | Risk |
|------|-------------|------|
| `create_issue` | Create a new issue | Moderate |
| `list_issues` | List issues with filters | Safe |
| `update_issue` | Update an existing issue | Moderate |
| `add_issue_comment` | Add comment to issue | Moderate |
| `search_issues` | Search issues/PRs | Safe |

### Pull Request Tools

| Tool | Description | Risk |
|------|-------------|------|
| `create_pull_request` | Create a new PR | Moderate |
| `get_pull_request` | Get PR details | Safe |
| `get_pull_request_diff` | Get PR diff | Safe |
| `merge_pull_request` | Merge a PR | Dangerous |
| `update_pull_request_branch` | Update PR branch | Moderate |

### Branch Tools

| Tool | Description | Risk |
|------|-------------|------|
| `create_branch` | Create a new branch | Moderate |
| `list_commits` | List branch commits | Safe |

### Search Tools

| Tool | Description | Risk |
|------|-------------|------|
| `search_code` | Search code across repos | Safe |
| `search_users` | Search GitHub users | Safe |

### User Tools

| Tool | Description | Risk |
|------|-------------|------|
| `get_me` | Get authenticated user | Safe |

---

*Document Version: 1.0*
*Created: December 2024*
*Author: AI Design Assistant*
