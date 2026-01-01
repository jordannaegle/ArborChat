# Phase 3 Implementation: Verification & Reliability

**Reference Design:** `/docs/designs/CODING_CAPABILITY_IMPROVEMENT_DESIGN.md`  
**Full Phase 3 Spec:** `/docs/prompts/coding-improvement-phase-3.md`  
**Prerequisites:** Phase 1 & 2 complete and tested  
**Author:** Alex Chen (Distinguished Software Architect)  
**Date:** December 30, 2025  

---

## Context

Phase 2 (native function calling & parallel execution) is complete. Phase 3 focuses on verification and reliability improvements to prevent agents from claiming completion without actually doing work.

### Goals

1. **Git Integration** - Verify file changes match claimed work
2. **TypeScript Verification** - Auto-check compilation after `.ts`/`.tsx` writes
3. **ESLint Integration** - Optional code quality gates
4. **Enhanced Completion Verification** - Multi-layer anti-hallucination checks

---

## Implementation Overview

| Component | File | Description |
|-----------|------|-------------|
| GitService enhancements | `src/main/services/GitService.ts` | Add `verifyChanges`, `getDetailedStatus` |
| Git IPC handlers | `src/main/services/index.ts` | Expose git methods via IPC |
| Preload git API | `src/preload/index.ts` | Add `window.api.git` |
| Type definitions | `src/preload/index.d.ts` | Add GitAPI interface |
| Code verification lib | `src/renderer/src/lib/codeVerification.ts` | TypeScript/ESLint utilities |
| Agent runner integration | `src/renderer/src/hooks/useAgentRunner.ts` | Use verification in completion check |

---

## Step 1: Examine Existing GitService

First, understand the current GitService implementation:

```bash
# View existing GitService
view /Users/cory.naegle/ArborChat/src/main/services/GitService.ts

# Check existing git API in preload
grep -n "git:" /Users/cory.naegle/ArborChat/src/preload/index.ts
grep -n "GitAPI" /Users/cory.naegle/ArborChat/src/preload/index.d.ts
```

The GitService likely already has basic functionality. We need to add:
- `verifyChanges()` - Compare expected vs actual file changes
- `getDetailedStatus()` - Get staged/modified/untracked with line counts
- `getFileDiffStats()` - Get additions/deletions for a file
- `getDiffSummary()` - Get human-readable diff summary
- `isGitRepository()` - Check if path is a git repo

---

## Step 2: Enhance GitService

**File:** `src/main/services/GitService.ts`

Add these methods to the existing GitService class:

```typescript
/**
 * Verify actual file changes match expected files
 * Used to prevent hallucinated completion claims
 */
async verifyChanges(
  workingDir: string,
  expectedFiles: string[]
): Promise<{
  verified: boolean
  changedFiles: string[]
  missingChanges: string[]
  unexpectedChanges: string[]
  details: Record<string, { status: string; lines?: number }>
}> {
  try {
    const status = await this.getDetailedStatus(workingDir)
    
    const normalizeP = (p: string) => p.replace(/^\.\//, '').toLowerCase()
    const expectedNormalized = new Set(expectedFiles.map(normalizeP))
    
    const changedFiles = [
      ...status.staged.map(f => f.path),
      ...status.modified.map(f => f.path),
      ...status.untracked.map(f => f.path)
    ]
    const changedNormalized = new Set(changedFiles.map(normalizeP))
    
    const missingChanges = expectedFiles.filter(f => !changedNormalized.has(normalizeP(f)))
    const unexpectedChanges = changedFiles.filter(f => !expectedNormalized.has(normalizeP(f)))
    
    const details: Record<string, { status: string; lines?: number }> = {}
    for (const file of status.staged) {
      details[file.path] = { status: 'staged', lines: file.additions + file.deletions }
    }
    for (const file of status.modified) {
      details[file.path] = { status: 'modified', lines: file.additions + file.deletions }
    }
    for (const file of status.untracked) {
      details[file.path] = { status: 'untracked' }
    }
    
    return {
      verified: missingChanges.length === 0,
      changedFiles,
      missingChanges,
      unexpectedChanges,
      details
    }
  } catch (error) {
    console.error('[GitService] verifyChanges failed:', error)
    return {
      verified: false,
      changedFiles: [],
      missingChanges: expectedFiles,
      unexpectedChanges: [],
      details: {}
    }
  }
}

/**
 * Get detailed git status with line changes
 */
async getDetailedStatus(workingDir: string): Promise<{
  staged: Array<{ path: string; additions: number; deletions: number }>
  modified: Array<{ path: string; additions: number; deletions: number }>
  untracked: Array<{ path: string }>
}> {
  const result = await this.runGit(workingDir, ['status', '--porcelain', '-uall'])
  
  const staged: Array<{ path: string; additions: number; deletions: number }> = []
  const modified: Array<{ path: string; additions: number; deletions: number }> = []
  const untracked: Array<{ path: string }> = []
  
  const lines = result.stdout.split('\n').filter(Boolean)
  
  for (const line of lines) {
    const status = line.substring(0, 2)
    const path = line.substring(3)
    
    if (status.startsWith('A') || (status.startsWith('M') && status[1] === ' ')) {
      const diff = await this.getFileDiffStats(workingDir, path, true)
      staged.push({ path, ...diff })
    } else if (status[1] === 'M' || status === 'MM') {
      const diff = await this.getFileDiffStats(workingDir, path, false)
      modified.push({ path, ...diff })
    } else if (status === '??') {
      untracked.push({ path })
    }
  }
  
  return { staged, modified, untracked }
}

/**
 * Get diff statistics for a specific file
 */
async getFileDiffStats(
  workingDir: string,
  filePath: string,
  staged: boolean
): Promise<{ additions: number; deletions: number }> {
  try {
    const args = staged
      ? ['diff', '--cached', '--numstat', '--', filePath]
      : ['diff', '--numstat', '--', filePath]
    
    const result = await this.runGit(workingDir, args)
    const parts = result.stdout.trim().split('\t')
    
    return {
      additions: parseInt(parts[0]) || 0,
      deletions: parseInt(parts[1]) || 0
    }
  } catch {
    return { additions: 0, deletions: 0 }
  }
}

/**
 * Get a summary of recent changes
 */
async getDiffSummary(workingDir: string): Promise<string> {
  try {
    const result = await this.runGit(workingDir, ['diff', '--stat'])
    return result.stdout || 'No changes detected'
  } catch (error) {
    return `Error getting diff: ${error}`
  }
}

/**
 * Check if working directory is a git repository
 */
async isGitRepository(workingDir: string): Promise<boolean> {
  try {
    await this.runGit(workingDir, ['rev-parse', '--git-dir'])
    return true
  } catch {
    return false
  }
}
```

---

## Step 3: Add Git IPC Handlers

**File:** `src/main/services/index.ts` (or wherever IPC handlers are set up)

```typescript
import { ipcMain } from 'electron'
import { gitService } from './GitService'

// Add to existing setupServiceHandlers or similar function:

ipcMain.handle('git:verify-changes', async (_, { workingDir, expectedFiles }) => {
  return gitService.verifyChanges(workingDir, expectedFiles)
})

ipcMain.handle('git:get-diff-summary', async (_, { workingDir }) => {
  return gitService.getDiffSummary(workingDir)
})

ipcMain.handle('git:is-repository', async (_, { workingDir }) => {
  return gitService.isGitRepository(workingDir)
})

ipcMain.handle('git:get-detailed-status', async (_, { workingDir }) => {
  return gitService.getDetailedStatus(workingDir)
})
```

---

## Step 4: Update Preload with Git API

**File:** `src/preload/index.ts`

Add to the contextBridge exposure:

```typescript
git: {
  verifyChanges: (workingDir: string, expectedFiles: string[]) =>
    ipcRenderer.invoke('git:verify-changes', { workingDir, expectedFiles }),
  
  getDiffSummary: (workingDir: string) =>
    ipcRenderer.invoke('git:get-diff-summary', { workingDir }),
  
  isRepository: (workingDir: string) =>
    ipcRenderer.invoke('git:is-repository', { workingDir }),
  
  getDetailedStatus: (workingDir: string) =>
    ipcRenderer.invoke('git:get-detailed-status', { workingDir })
}
```

---

## Step 5: Add Type Definitions

**File:** `src/preload/index.d.ts`

Add the GitAPI interface:

```typescript
interface GitVerifyResult {
  verified: boolean
  changedFiles: string[]
  missingChanges: string[]
  unexpectedChanges: string[]
  details: Record<string, { status: string; lines?: number }>
}

interface GitDetailedStatus {
  staged: Array<{ path: string; additions: number; deletions: number }>
  modified: Array<{ path: string; additions: number; deletions: number }>
  untracked: Array<{ path: string }>
}

interface GitAPI {
  verifyChanges: (workingDir: string, expectedFiles: string[]) => Promise<GitVerifyResult>
  getDiffSummary: (workingDir: string) => Promise<string>
  isRepository: (workingDir: string) => Promise<boolean>
  getDetailedStatus: (workingDir: string) => Promise<GitDetailedStatus>
}

// Add to Window.api interface:
git: GitAPI
```

---

## Step 6: Create Code Verification Utility

**File:** `src/renderer/src/lib/codeVerification.ts` (new file)

```typescript
/**
 * Code verification utilities for agent completion checks
 */

/**
 * Extract file paths mentioned in agent message content
 */
export function extractMentionedFiles(content: string): string[] {
  const pathRegex = /(?:\/[\w.-]+)+\.(?:ts|tsx|js|jsx|json|md|css|html|yaml|yml|toml|py|rs|go)/gi
  const matches = content.match(pathRegex) || []
  return [...new Set(matches.map(p => p.toLowerCase()))]
}

/**
 * Verify TypeScript compilation
 */
export async function verifyTypeScriptCompilation(
  workingDir: string
): Promise<{
  success: boolean
  errors: string[]
  errorCount: number
}> {
  try {
    const result = await window.api.mcp.requestTool(
      'desktop-commander',
      'start_process',
      {
        command: `cd "${workingDir}" && npm run typecheck 2>&1`,
        timeout_ms: 60000
      },
      'Verifying TypeScript compilation'
    )

    if (!result.success) {
      return {
        success: false,
        errors: [result.error || 'TypeScript check failed'],
        errorCount: 1
      }
    }

    const output = String(result.result || '')
    const hasErrors = output.includes('error TS') || output.includes('Error:')
    
    if (hasErrors) {
      const errorLines = output
        .split('\n')
        .filter(line => line.includes('error TS') || line.includes('Error:'))
        .slice(0, 10)
      
      return {
        success: false,
        errors: errorLines,
        errorCount: errorLines.length
      }
    }

    return { success: true, errors: [], errorCount: 0 }
  } catch (error) {
    return { success: false, errors: [String(error)], errorCount: 1 }
  }
}

/**
 * Verify ESLint passes
 */
export async function verifyESLint(
  workingDir: string,
  files?: string[]
): Promise<{
  success: boolean
  errors: string[]
  warnings: string[]
  fixable: number
}> {
  try {
    const targetFiles = files?.join(' ') || '.'
    const result = await window.api.mcp.requestTool(
      'desktop-commander',
      'start_process',
      {
        command: `cd "${workingDir}" && npx eslint ${targetFiles} --format compact 2>&1`,
        timeout_ms: 60000
      },
      'Running ESLint verification'
    )

    const output = String(result.result || '')
    const lines = output.split('\n').filter(Boolean)
    const errors: string[] = []
    const warnings: string[] = []
    let fixable = 0
    
    for (const line of lines) {
      if (line.includes('Error')) errors.push(line)
      else if (line.includes('Warning')) warnings.push(line)
      
      const match = line.match(/(\d+) .* potentially fixable/)
      if (match) fixable = parseInt(match[1])
    }

    return { success: errors.length === 0, errors, warnings, fixable }
  } catch (error) {
    return { success: false, errors: [String(error)], warnings: [], fixable: 0 }
  }
}

/**
 * Run all verification checks in parallel
 */
export async function runFullVerification(
  workingDir: string,
  expectedFiles: string[]
): Promise<{
  git: { verified: boolean; changedFiles: string[]; missingChanges: string[] }
  typescript: { success: boolean; errorCount: number }
  eslint: { success: boolean; errorCount: number; warningCount: number }
  overall: boolean
}> {
  const [gitResult, tsResult, eslintResult] = await Promise.allSettled([
    window.api.git.verifyChanges(workingDir, expectedFiles),
    verifyTypeScriptCompilation(workingDir),
    verifyESLint(workingDir)
  ])

  const git = gitResult.status === 'fulfilled'
    ? gitResult.value
    : { verified: false, changedFiles: [], missingChanges: expectedFiles, unexpectedChanges: [], details: {} }

  const typescript = tsResult.status === 'fulfilled'
    ? tsResult.value
    : { success: false, errors: [], errorCount: 1 }

  const eslint = eslintResult.status === 'fulfilled'
    ? eslintResult.value
    : { success: false, errors: [], warnings: [], fixable: 0 }

  return {
    git: {
      verified: git.verified,
      changedFiles: git.changedFiles,
      missingChanges: git.missingChanges
    },
    typescript: {
      success: typescript.success,
      errorCount: typescript.errorCount
    },
    eslint: {
      success: eslint.success,
      errorCount: eslint.errors.length,
      warningCount: eslint.warnings.length
    },
    overall: git.verified && typescript.success && eslint.success
  }
}
```

---

## Step 7: Update Agent Runner Completion Check

**File:** `src/renderer/src/hooks/useAgentRunner.ts`

1. Add import at the top:
```typescript
import { 
  extractMentionedFiles, 
  verifyTypeScriptCompilation 
} from '../lib/codeVerification'
```

2. Update `isCompletionMessage` to be async and add verification:

```typescript
/**
 * Check if message indicates task completion
 * Now async with git and TypeScript verification
 */
const isCompletionMessage = useCallback(async (content: string): Promise<boolean> => {
  // Check 1: Explicit completion signal
  const hasExplicitCompletion = /TASK COMPLETED/i.test(content)
  if (!hasExplicitCompletion) {
    return false
  }

  // Check 2: File path evidence in message
  const mentionedFiles = extractMentionedFiles(content)
  if (mentionedFiles.length === 0) {
    console.warn('[AgentRunner] Completion claimed but no file paths mentioned')
    addAgentStep(agentId, {
      type: 'error',
      content: '⚠️ Completion claimed but no specific files were mentioned.',
      timestamp: Date.now()
    })
    return false
  }

  // Check 3: Runtime verification - did agent actually execute work tools?
  const workVerification = verifyWorkCompleted()
  if (!workVerification.hasMeaningfulWork) {
    console.warn('[AgentRunner] HALLUCINATION DETECTED: No work tools executed!')
    addAgentStep(agentId, {
      type: 'error',
      content: `⚠️ Verification failed: No work-producing tools were successfully executed.`,
      timestamp: Date.now()
    })
    return false
  }

  // Check 4: Git verification (if in a git repo)
  const agent = getAgentSafe()
  const workingDir = agent?.config.context?.workingDirectory
  
  if (workingDir) {
    try {
      const isGitRepo = await window.api.git.isRepository(workingDir)
      
      if (isGitRepo) {
        console.log('[AgentRunner] Running git verification...')
        const gitVerification = await window.api.git.verifyChanges(workingDir, mentionedFiles)
        
        if (!gitVerification.verified && gitVerification.missingChanges.length > 0) {
          console.warn('[AgentRunner] Git verification: Some expected files not changed:', gitVerification.missingChanges)
          // Don't fail - just log warning. Files might be unchanged intentionally.
        } else {
          console.log('[AgentRunner] ✅ Git verification passed:', gitVerification.changedFiles.length, 'files changed')
        }
      }

      // Check 5: TypeScript compilation
      console.log('[AgentRunner] Running TypeScript verification...')
      const tsVerification = await verifyTypeScriptCompilation(workingDir)
      
      if (!tsVerification.success) {
        console.warn('[AgentRunner] TypeScript verification failed:', tsVerification.errorCount, 'errors')
        addAgentStep(agentId, {
          type: 'error',
          content: `⚠️ TypeScript compilation failed with ${tsVerification.errorCount} errors. Please fix before completion.`,
          timestamp: Date.now()
        })
        
        // Provide errors to agent for fixing
        pendingToolResultRef.current = `
TypeScript compilation check revealed ${tsVerification.errorCount} errors:
${tsVerification.errors.slice(0, 5).join('\n')}

Please fix these errors before claiming completion.`
        
        return false
      }
      
      console.log('[AgentRunner] ✅ TypeScript verification passed')
    } catch (error) {
      console.error('[AgentRunner] Verification error:', error)
      // Don't block completion on verification errors
    }
  }

  console.log(`[AgentRunner] ✅ All verification checks passed`)
  return true
}, [verifyWorkCompleted, addAgentStep, agentId, getAgentSafe])
```

3. Update call sites to handle async:

Find where `isCompletionMessage` is called and change:
```typescript
// BEFORE:
if (isCompletionMessage(finalContent)) {

// AFTER:
if (await isCompletionMessage(finalContent)) {
```

---

## Step 8: Add Post-Write TypeScript Check (Optional Enhancement)

In `handleToolCall`, after successful tool execution, add TypeScript verification for TS files:

```typescript
// After: if (result.success) { ... }

// Auto-verify TypeScript after writing TS files
if (result.success && ['write_file', 'edit_block', 'str_replace'].includes(toolCall.tool)) {
  const filePath = String(toolCall.args.path || toolCall.args.file_path || '')
  
  if (filePath.match(/\.(ts|tsx)$/) && agent.config.context?.workingDirectory) {
    // Run typecheck asynchronously (don't block the flow)
    verifyTypeScriptCompilation(agent.config.context.workingDirectory)
      .then(tsResult => {
        if (!tsResult.success) {
          console.warn('[AgentRunner] TypeScript errors after write:', tsResult.errorCount)
          addAgentStep(agentId, {
            type: 'error',
            content: `⚠️ TypeScript errors detected:\n${tsResult.errors.slice(0, 3).join('\n')}`,
            timestamp: Date.now()
          })
        }
      })
      .catch(console.error)
  }
}
```

---

## Verification Checklist

After implementing all steps:

```bash
# 1. TypeScript compilation
npm run typecheck

# 2. Test git verification
# Create an agent that claims completion without changing files
# Verify it's caught

# 3. Test TypeScript verification
# Create an agent that writes invalid TypeScript
# Verify errors are caught and reported
```

- [ ] `npm run typecheck` passes
- [ ] GitService methods work (`verifyChanges`, `getDetailedStatus`)
- [ ] IPC handlers respond correctly
- [ ] `window.api.git` available in renderer
- [ ] `codeVerification.ts` utilities work
- [ ] `isCompletionMessage` is async and uses verification
- [ ] TypeScript errors block completion
- [ ] Errors are shown in agent steps

---

## Testing

See separate testing prompt: `/docs/prompts/coding-improvement-phase-3-testing.md`

---

## Next Steps

After Phase 3:

1. **Phase 4: UI Enhancements** (if planned)
   - Batch tool approval UI
   - Enhanced verification status display
   - Git diff viewer

2. **Documentation**
   - Update user documentation
   - Add verification settings to preferences
