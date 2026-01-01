# Merge Conflict Resolution: SSH MCP Integration

## Current State

We are merging `feature/ssh-mcp-integration` into `main` to integrate SSH remote server capabilities. The merge has conflicts that need resolution.

### Branch History
- **main**: Contains OpenAI/Mistral provider icons, Work Journal, Notifications, Agent improvements
- **feature/ssh-mcp-integration**: Contains SSH MCP server integration (based on older main)

### Goal
Keep ALL features from both branches:
- ✅ OpenAI and Mistral providers with brand icons
- ✅ Work Journal system
- ✅ Notification system  
- ✅ Agent improvements (cleanup, verification)
- ✅ SSH MCP server integration (NEW)

---

## Conflicted Files Summary

| File | Conflict Type | Resolution Strategy |
|------|--------------|---------------------|
| `package-lock.json` | Auto-generated | Delete and run `npm install` |
| `package.json` | Dependencies | Keep HEAD (main), SSH has no new deps |
| `tsconfig.node.tsbuildinfo` | Auto-generated | Delete and rebuild |
| `src/main/credentials/types.ts` | Possible type differences | Keep HEAD (main has more types) |
| `src/renderer/src/contexts/index.ts` | Export statements | Merge both exports |
| `src/renderer/src/contexts/AgentContext.tsx` | Comments only | Keep HEAD (has cleanup comments) |
| `src/renderer/src/hooks/useAgent.ts` | Minor changes | Keep HEAD (more complete) |
| `src/renderer/src/hooks/useAgentRunner.ts` | Significant changes | Keep HEAD (has cleanup logic) |
| `src/renderer/src/components/agent/AgentPanel.tsx` | Minor | Keep HEAD |
| `src/renderer/src/components/agent/AgentLaunchModal.tsx` | Possible | Keep HEAD |
| `src/renderer/src/components/agent/AgentTemplateSelector.tsx` | Add/Add | Keep HEAD version |
| `src/renderer/src/App.tsx` | Possible | Keep HEAD |

---

## Resolution Instructions

### Step 1: Auto-generated files (delete and regenerate)

```bash
cd /Users/cory.naegle/ArborChat

# Remove auto-generated conflicted files
rm package-lock.json
rm tsconfig.node.tsbuildinfo

# Mark as resolved by staging the deletions
git add package-lock.json tsconfig.node.tsbuildinfo
```

### Step 2: Resolve package.json

The SSH feature doesn't add new dependencies (ssh-mcp is an npm package run via npx).
Keep the HEAD version:

```bash
git checkout --ours package.json
git add package.json
```

### Step 3: Resolve src/main/credentials/types.ts

HEAD (main) has more provider types. Keep HEAD:

```bash
git checkout --ours src/main/credentials/types.ts
git add src/main/credentials/types.ts
```

### Step 4: Resolve src/renderer/src/contexts/index.ts

This file needs BOTH exports merged. The correct content should be:

```typescript
// src/renderer/src/contexts/index.ts

export { AgentProvider, useAgentContext } from './AgentContext'
export { NotificationProvider, useNotificationContext } from './NotificationContext'
```

Apply manually and stage:

```bash
git add src/renderer/src/contexts/index.ts
```

### Step 5: Resolve Agent-related files (keep HEAD - has cleanup improvements)

These files have extensive changes in HEAD (main) for Phase 6.5 memory cleanup.
The SSH branch has older versions. Keep HEAD for all:

```bash
git checkout --ours src/renderer/src/contexts/AgentContext.tsx
git checkout --ours src/renderer/src/hooks/useAgent.ts
git checkout --ours src/renderer/src/hooks/useAgentRunner.ts
git checkout --ours src/renderer/src/components/agent/AgentPanel.tsx
git checkout --ours src/renderer/src/components/agent/AgentLaunchModal.tsx
git checkout --ours src/renderer/src/components/agent/AgentTemplateSelector.tsx
git checkout --ours src/renderer/src/App.tsx

git add src/renderer/src/contexts/AgentContext.tsx
git add src/renderer/src/hooks/useAgent.ts
git add src/renderer/src/hooks/useAgentRunner.ts
git add src/renderer/src/components/agent/AgentPanel.tsx
git add src/renderer/src/components/agent/AgentLaunchModal.tsx
git add src/renderer/src/components/agent/AgentTemplateSelector.tsx
git add src/renderer/src/App.tsx
```

### Step 6: Regenerate lock files

```bash
npm install
git add package-lock.json
```

### Step 7: Rebuild TypeScript

```bash
npm run typecheck
```

### Step 8: Commit the merge

```bash
git commit -m "Merge feature/ssh-mcp-integration into main

Integrated SSH MCP server support while preserving:
- OpenAI and Mistral provider integrations
- Work Journal system
- Notification system
- Agent cleanup improvements (Phase 6.5)

SSH Features Added:
- SSH MCP server configuration (tufantunc/ssh-mcp)
- Password and SSH key authentication
- Secure credential storage
- Configuration UI in Settings → Tools
- Risk-based tool approval"
```

### Step 9: Push to origin

```bash
git push origin main
```

---

## Verification Checklist

After merge, verify these features work:

### Provider Icons
- [ ] ModelSelector shows OpenAI icon (green hexagon)
- [ ] ModelSelector shows Mistral icon (orange M)
- [ ] ModelSelector shows Claude icon
- [ ] ModelSelector shows Gemini icon
- [ ] ModelSelector shows Ollama icon
- [ ] ModelSelector shows GitHub icon

### SSH Integration
- [ ] Settings → Tools shows "SSH Remote" option
- [ ] SSH configuration modal opens
- [ ] Can enter host, port, username
- [ ] Can toggle between Password/SSH Key auth
- [ ] Connect/Disconnect functionality works

### Existing Features
- [ ] App starts without errors
- [ ] Chat functionality works
- [ ] Agent panel works
- [ ] Work Journal accessible
- [ ] Notifications work
- [ ] MCP tools (Desktop Commander, GitHub) still function

---

## Files Successfully Merged (No Conflicts)

These SSH-related files merged cleanly:
- `src/main/mcp/servers/ssh-mcp.ts` ✅ (new file)
- `src/main/mcp/config.ts` ✅
- `src/main/mcp/credentials.ts` ✅
- `src/main/mcp/ipc.ts` ✅
- `src/renderer/src/components/settings/modals/SSHConfigModal.tsx` ✅ (new file)
- `src/renderer/src/components/settings/modals/index.ts` ✅
- `src/renderer/src/components/settings/sections/ToolsSection.tsx` ✅
- `src/preload/index.ts` ✅
- `src/preload/index.d.ts` ✅
