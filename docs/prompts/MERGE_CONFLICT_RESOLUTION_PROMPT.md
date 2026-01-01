# Merge Conflict Resolution: SSH MCP Integration

## Context

We are merging the `feature/ssh-mcp-integration` branch into `main`. The main branch contains:
- OpenAI and Mistral provider integrations with official brand icons
- Agent system improvements (Work Journal, notifications, cleanup utilities)
- Enhanced MCP integration with multiple servers (Brave Search, Filesystem, Memory)

The SSH branch adds:
- SSH MCP server integration (tufantunc/ssh-mcp)
- SSH credential storage and IPC handlers
- SSH configuration modal in Settings → Tools

## Current State

- **Branch:** `main` (mid-merge with `feature/ssh-mcp-integration`)
- **Status:** 12 files with merge conflicts need resolution

## Files with Conflicts

### 1. package.json (Line 37-42)
**Conflict:** Dependency versions or additional packages
**Resolution Strategy:** Keep both sets of dependencies, prefer newer versions if duplicated

### 2. src/main/credentials/types.ts (Line 12-16)
**Conflict:** Provider ID type union
**Resolution Strategy:** Combine all provider IDs from both branches:
```typescript
export type ProviderId = 'gemini' | 'anthropic' | 'ollama' | 'openai' | 'github-copilot' | 'mistral'
```

### 3. src/renderer/src/App.tsx (Lines 15-20, 135-157, 288-327)
**Conflict:** Imports and component structure
**Resolution Strategy:** 
- Merge import statements (keep all unique imports)
- Preserve NotificationProvider wrapper from main
- Keep WorkJournalProvider integration

### 4. src/renderer/src/components/agent/AgentLaunchModal.tsx (Lines 4-17, 69-78)
**Conflict:** Imports and component props/structure
**Resolution Strategy:** 
- Keep enhanced imports from main (with Git detection, templates)
- Preserve working directory requirement logic

### 5. src/renderer/src/components/agent/AgentPanel.tsx (Lines 5-21, 260-280)
**Conflict:** Imports and rendering logic
**Resolution Strategy:**
- Keep AgentStepTimeline and enhanced UI from main
- Preserve notification integrations

### 6. src/renderer/src/components/agent/AgentTemplateSelector.tsx (Lines 1-203)
**Conflict:** Entire file differs (add/add conflict)
**Resolution Strategy:**
- **Use main branch version** - it has the complete implementation with:
  - Git repo detection
  - Working directory requirements
  - Template categories
  - Enhanced UI

### 7. src/renderer/src/contexts/AgentContext.tsx (Lines 320-325, 377-382, 703-804)
**Conflict:** Context state and cleanup logic
**Resolution Strategy:**
- Keep enhanced cleanup registry from main
- Preserve memory management utilities
- Maintain notification integration

### 8. src/renderer/src/contexts/index.ts (Lines 4-8)
**Conflict:** Export statements
**Resolution Strategy:** Combine exports:
```typescript
export { AgentProvider, useAgentContext } from './AgentContext'
export { NotificationProvider, useNotification, useNotificationActions } from './NotificationContext'
```

### 9. src/renderer/src/hooks/useAgent.ts (Lines 81-94)
**Conflict:** Hook return values or state management
**Resolution Strategy:** Keep enhanced version from main with cleanup utilities

### 10. src/renderer/src/hooks/useAgentRunner.ts (Multiple conflicts: 105-156, 172-199, 337-446, 475-506)
**Conflict:** Agent execution logic, tool handling, cleanup
**Resolution Strategy:**
- Keep enhanced tool execution from main
- Preserve work journal integration
- Maintain notification triggers
- Keep memory cleanup patterns

### 11. package-lock.json
**Resolution Strategy:** Regenerate after resolving package.json:
```bash
rm package-lock.json
npm install
```

### 12. tsconfig.node.tsbuildinfo
**Resolution Strategy:** Delete and let TypeScript regenerate:
```bash
rm tsconfig.node.tsbuildinfo
```

## Resolution Commands

```bash
# For each conflicted file, open and manually resolve, then:
git add <resolved-file>

# After all files resolved:
git add .
git commit -m "Merge feature/ssh-mcp-integration into main

Resolves conflicts between SSH MCP integration and:
- OpenAI/Mistral provider integration
- Agent system enhancements
- Work Journal and notification systems
- Memory cleanup utilities"
```

## Verification Checklist

After resolving conflicts:

- [ ] `npm run typecheck` passes
- [ ] All provider icons render (OpenAI, Mistral, Claude, Gemini, Ollama, GitHub Copilot)
- [ ] SSH configuration modal accessible in Settings → Tools
- [ ] Agent system functional with templates
- [ ] Work Journal logs agent activities
- [ ] Notification system works
- [ ] MCP tools connect and execute

## Key Principles

1. **Prefer main branch** for agent-related code (more complete)
2. **Keep SSH additions** where they don't conflict (new files, additive changes)
3. **Combine imports** - never lose imports from either branch
4. **Test after each file** if possible
5. **Preserve type safety** - ensure all TypeScript types are complete

## Files Successfully Merged (No Conflicts)

These files from SSH branch merged cleanly:
- `src/main/mcp/servers/ssh-mcp.ts` (new file)
- `src/main/mcp/config.ts` (additive)
- `src/main/mcp/credentials.ts` (additive)
- `src/main/mcp/ipc.ts` (additive)
- `src/renderer/src/components/settings/modals/SSHConfigModal.tsx` (new file)
- `src/renderer/src/components/settings/modals/index.ts` (additive)
- `src/renderer/src/components/settings/sections/ToolsSection.tsx` (additive)
