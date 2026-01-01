# Coding Capability Improvement - Phase 3: Verification & Reliability

**Reference Design:** `/docs/designs/CODING_CAPABILITY_IMPROVEMENT_DESIGN.md`  
**Prerequisite:** Phase 1 & 2 completed  
**Estimated Effort:** 1-2 weeks  
**Priority:** High  

---

## Objective

Implement verification and reliability improvements:

1. Git Integration for Change Verification
2. TypeScript Compilation Checks after file writes
3. ESLint Integration for code quality gates
4. Enhanced Completion Verification

---

## Prerequisites

- Phase 1 & 2 completed and verified
- Native function calling working for all providers
- GitService exists at `/src/main/services/GitService.ts`

---

## Implementation Steps

### Step 1: Enhance GitService with Verification Methods

**File:** `src/main/services/GitService.ts`

Add new methods for change verification:

```typescript
// Add to existing GitService class

/**
 * Verify actual file changes were made
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
    // Get current git status
    const status = await this.getDetailedStatus(workingDir)
    
    // Normalize file paths for comparison
    const normalizeP = (p: string) => p.replace(/^\.\//, '').toLowerCase()
    const expectedNormalized = new Set(expectedFiles.map(normalizeP))
    
    const changedFiles = [
      ...status.staged.map(f => f.path),
      ...status.modified.map(f => f.path),
      ...status.untracked.map(f => f.path)
    ]
    const changedNormalized = new Set(changedFiles.map(normalizeP))
    
    // Find missing and unexpected changes
    const missingChanges = expectedFiles.filter(f => !changedNormalized.has(normalizeP(f)))
    const unexpectedChanges = changedFiles.filter(f => !expectedNormalized.has(normalizeP(f)))
    
    // Build details map
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
    
    if (status.startsWith('A') || status.startsWith('M') && status[1] === ' ') {
      // Staged
      const diff = await this.getFileDiffStats(workingDir, path, true)
      staged.push({ path, ...diff })
    } else if (status[1] === 'M' || status === 'MM') {
      // Modified (unstaged)
      const diff = await this.getFileDiffStats(workingDir, path, false)
      modified.push({ path, ...diff })
    } else if (status === '??') {
      // Untracked
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

### Step 2: Add Git IPC Handlers

**File:** `src/main/services/index.ts`

Export the GitService methods via IPC:

```typescript
import { ipcMain } from 'electron'
import { gitService } from './GitService'

export function setupServiceHandlers(): void {
  // Git verification handlers
  ipcMain.handle('git:verify-changes', async (_, { workingDir, expectedFiles }) => {
    return gitService.verifyChanges(workingDir, expectedFiles)
  })

  ipcMain.handle('git:get-diff-summary', async (_, { workingDir }) => {
    return gitService.getDiffSummary(workingDir)
  })

  ipcMain.handle('git:is-repository', async (_, { workingDir }) => {
    return gitService.isGitRepository(workingDir)
  })

  ipcMain.handle('git:get-status', async (_, { workingDir }) => {
    return gitService.getDetailedStatus(workingDir)
  })
}
```

### Step 3: Update Preload with Git API

**File:** `src/preload/index.ts`

Add git API:

```typescript
git: {
  verifyChanges: (workingDir: string, expectedFiles: string[]) =>
    ipcRenderer.invoke('git:verify-changes', { workingDir, expectedFiles }),
  
  getDiffSummary: (workingDir: string) =>
    ipcRenderer.invoke('git:get-diff-summary', { workingDir }),
  
  isRepository: (workingDir: string) =>
    ipcRenderer.invoke('git:is-repository', { workingDir }),
  
  getStatus: (workingDir: string) =>
    ipcRenderer.invoke('git:get-status', { workingDir })
}
```

### Step 4: Create Code Verification Utility

**File:** `src/renderer/src/lib/codeVerification.ts`

```typescript
// src/renderer/src/lib/codeVerification.ts
// Code verification utilities for agent completion checks

/**
 * Extract file paths mentioned in agent message content
 */
export function extractMentionedFiles(content: string): string[] {
  // Match file paths with common extensions
  const pathRegex = /(?:\/[\w.-]+)+\.(?:ts|tsx|js|jsx|json|md|css|html|yaml|yml|toml|py|rs|go)/gi
  const matches = content.match(pathRegex) || []
  
  // Deduplicate and normalize
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
        command: 'npm run typecheck 2>&1',
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
    
    // Check for TypeScript errors
    const hasErrors = output.includes('error TS') || output.includes('Error:')
    
    if (hasErrors) {
      // Extract error messages
      const errorLines = output
        .split('\n')
        .filter(line => line.includes('error TS') || line.includes('Error:'))
        .slice(0, 10) // Limit to first 10 errors
      
      return {
        success: false,
        errors: errorLines,
        errorCount: errorLines.length
      }
    }

    return {
      success: true,
      errors: [],
      errorCount: 0
    }
  } catch (error) {
    return {
      success: false,
      errors: [String(error)],
      errorCount: 1
    }
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
        command: `npx eslint ${targetFiles} --format compact 2>&1`,
        timeout_ms: 60000
      },
      'Running ESLint verification'
    )

    const output = String(result.result || '')
    
    // Parse ESLint compact output
    const lines = output.split('\n').filter(Boolean)
    const errors: string[] = []
    const warnings: string[] = []
    let fixable = 0
    
    for (const line of lines) {
      if (line.includes('Error')) {
        errors.push(line)
      } else if (line.includes('Warning')) {
        warnings.push(line)
      }
      if (line.includes('potentially fixable')) {
        const match = line.match(/(\d+) .* potentially fixable/)
        if (match) fixable = parseInt(match[1])
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      fixable
    }
  } catch (error) {
    return {
      success: false,
      errors: [String(error)],
      warnings: [],
      fixable: 0
    }
  }
}

/**
 * Run all verification checks
 */
export async function runFullVerification(
  workingDir: string,
  expectedFiles: string[]
): Promise<{
  git: {
    verified: boolean
    changedFiles: string[]
    missingChanges: string[]
  }
  typescript: {
    success: boolean
    errorCount: number
  }
  eslint: {
    success: boolean
    errorCount: number
    warningCount: number
  }
  overall: boolean
}> {
  // Run checks in parallel
  const [gitResult, tsResult, eslintResult] = await Promise.allSettled([
    window.api.git.verifyChanges(workingDir, expectedFiles),
    verifyTypeScriptCompilation(workingDir),
    verifyESLint(workingDir)
  ])

  const git = gitResult.status === 'fulfilled'
    ? gitResult.value
    : { verified: false, changedFiles: [], missingChanges: expectedFiles }

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

### Step 5: Integrate Verification into Agent Runner

**File:** `src/renderer/src/hooks/useAgentRunner.ts`

Update the completion verification:

```typescript
import { 
  extractMentionedFiles, 
  runFullVerification,
  verifyTypeScriptCompilation 
} from '../lib/codeVerification'

// Update isCompletionMessage to be async and use verification
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
  const workingDir = agent?.config.context.workingDirectory
  
  if (workingDir) {
    const isGitRepo = await window.api.git.isRepository(workingDir)
    
    if (isGitRepo) {
      console.log('[AgentRunner] Running git verification...')
      const gitVerification = await window.api.git.verifyChanges(workingDir, mentionedFiles)
      
      if (!gitVerification.verified) {
        console.warn('[AgentRunner] Git verification failed:', gitVerification.missingChanges)
        addAgentStep(agentId, {
          type: 'error',
          content: `⚠️ Git verification failed. Expected changes to: ${gitVerification.missingChanges.join(', ')}`,
          timestamp: Date.now()
        })
        return false
      }
      
      console.log('[AgentRunner] ✅ Git verification passed:', gitVerification.changedFiles.length, 'files changed')
    }

    // Check 5: TypeScript compilation (if project has tsconfig)
    console.log('[AgentRunner] Running TypeScript verification...')
    const tsVerification = await verifyTypeScriptCompilation(workingDir)
    
    if (!tsVerification.success) {
      console.warn('[AgentRunner] TypeScript verification failed:', tsVerification.errorCount, 'errors')
      addAgentStep(agentId, {
        type: 'error',
        content: `⚠️ TypeScript compilation failed with ${tsVerification.errorCount} errors. Agent should fix these before completion.`,
        timestamp: Date.now()
      })
      
      // Don't fail completion, but notify the agent
      pendingToolResultRef.current = `
TypeScript compilation check revealed ${tsVerification.errorCount} errors:
${tsVerification.errors.slice(0, 5).join('\n')}

Please fix these errors before claiming completion.`
      
      return false
    }
    
    console.log('[AgentRunner] ✅ TypeScript verification passed')
  }

  console.log(`[AgentRunner] ✅ All verification checks passed`)
  return true
}, [verifyWorkCompleted, addAgentStep, agentId, getAgentSafe])
```

### Step 6: Add Automatic TypeScript Check After File Writes

Add a post-write hook for TypeScript files:

```typescript
// In handleToolCall, after successful tool execution:

// Check if we should run TypeScript verification
if (result.success && ['write_file', 'edit_block', 'str_replace'].includes(toolCall.tool)) {
  const filePath = String(toolCall.args.path || toolCall.args.file_path || '')
  
  if (filePath.match(/\.(ts|tsx)$/)) {
    console.log('[AgentRunner] TypeScript file modified, queueing compilation check')
    
    // Run typecheck asynchronously (don't block)
    verifyTypeScriptCompilation(agent.config.context.workingDirectory || '.').then(tsResult => {
      if (!tsResult.success) {
        console.warn('[AgentRunner] TypeScript errors detected after write')
        
        // Add a step to notify about the errors
        addAgentStep(agentId, {
          type: 'error',
          content: `⚠️ TypeScript errors detected:\n${tsResult.errors.slice(0, 3).join('\n')}`,
          timestamp: Date.now()
        })
        
        // Append to pending result so agent knows to fix
        pendingToolResultRef.current = (pendingToolResultRef.current || '') + 
          `\n\n⚠️ TypeScript compilation check: ${tsResult.errorCount} errors found. Please review and fix.`
      }
    }).catch(console.error)
  }
}
```

---

## Verification Checklist

After implementing all steps, verify:

- [ ] Run `npm run typecheck` - No TypeScript errors
- [ ] Git verification detects actual file changes
- [ ] Git verification catches missing expected files
- [ ] TypeScript check runs after `.ts`/`.tsx` file writes
- [ ] ESLint check runs when called
- [ ] Agent completion is blocked when verification fails
- [ ] Agent receives feedback about verification failures
- [ ] Hallucinated completions are caught and rejected

---

## Testing Commands

```bash
# Test git verification
# 1. Start agent to create a new file
# 2. Verify git status shows the new file
# 3. Agent completes - verification should pass

# Test TypeScript verification
# 1. Start agent to write TypeScript with an error
# 2. Verify compilation check catches the error
# 3. Agent should not complete until fixed

# Test hallucination detection
# 1. Create agent that tries to complete without using tools
# 2. Verify "No work tools executed" error appears
```

---

## Next Phase

After completing Phase 3, proceed to:
- **Phase 4:** Advanced Capabilities (Multi-file orchestration, Project context, Checkpoint restoration)

Reference: `/docs/prompts/coding-improvement-phase-4.md`
