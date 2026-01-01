# Phase 4 Implementation: Advanced Capabilities

**Reference Design:** `/docs/designs/CODING_CAPABILITY_IMPROVEMENT_DESIGN.md`  
**Full Phase 4 Spec:** `/docs/prompts/coding-improvement-phase-4.md`  
**Prerequisites:** Phase 1, 2 & 3 complete and tested  
**Author:** Alex Chen (Distinguished Software Architect)  
**Date:** December 30, 2025  

---

## Context

Phase 3 (verification & reliability) is complete. Phase 4 focuses on advanced capabilities that enable agents to handle complex, multi-file coding tasks with full project awareness.

### Goals

1. **Project Context Analysis** - Auto-detect project structure, framework, and configuration
2. **Smart File Selection** - Prioritize relevant files for context based on task keywords
3. **Checkpoint Restoration** - Resume from work journal checkpoints with full context
4. **Multi-File Orchestration** - Handle complex refactoring with dependency-aware execution

---

## Implementation Overview

| Component | File | Description |
|-----------|------|-------------|
| Project Context Analyzer | `src/renderer/src/lib/projectContext.ts` | Analyze project structure and build context |
| File Relevance Scorer | `src/renderer/src/lib/fileRelevance.ts` | Score and select files for AI context |
| Checkpoint Restore Hook | `src/renderer/src/hooks/useCheckpointRestore.ts` | Restore agent state from checkpoints |
| Multi-File Orchestrator | `src/renderer/src/lib/multiFileOrchestrator.ts` | Plan and execute multi-file operations |
| Agent Context Integration | `src/renderer/src/contexts/AgentContext.tsx` | Integrate project context into agent creation |
| Agent Templates Update | `src/renderer/src/data/agentTemplates.ts` | Add new capability flags to templates |

---

## Step 1: Examine Existing Infrastructure

First, understand the current agent and work journal systems:

```bash
# View existing agent context
view /Users/cory.naegle/ArborChat/src/renderer/src/contexts/AgentContext.tsx

# Check work journal hook
view /Users/cory.naegle/ArborChat/src/renderer/src/hooks/useWorkJournal.ts

# View agent types
view /Users/cory.naegle/ArborChat/src/renderer/src/types/agent.ts

# Check existing agent templates
view /Users/cory.naegle/ArborChat/src/renderer/src/data/agentTemplates.ts
```

Understand the interfaces for:
- `CreateAgentOptions` - What options are passed when creating an agent
- `Agent` - The full agent state structure
- `WorkSession` / `WorkCheckpoint` - Work journal data structures

---

## Step 2: Create Project Context Analyzer

**File:** `src/renderer/src/lib/projectContext.ts` (new file)


```typescript
// src/renderer/src/lib/projectContext.ts
// Project structure analysis and context seeding for agents
// Phase 4: Advanced Capabilities

export interface ProjectContext {
  name: string
  type: 'node' | 'python' | 'rust' | 'go' | 'unknown'
  hasTypeScript: boolean
  hasTests: boolean
  framework?: string
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun'
  entryPoints: string[]
  configFiles: string[]
  sourceDirectories: string[]
  testDirectories: string[]
}

export interface ProjectFile {
  path: string
  type: 'config' | 'source' | 'test' | 'doc' | 'other'
  relevance: number // 0-100, higher = more relevant for context
  size: number
}

/**
 * Analyze project structure to build context
 * Uses MCP tools to read directory structure and detect project type
 */
export async function analyzeProject(workingDir: string): Promise<ProjectContext> {
  const context: ProjectContext = {
    name: workingDir.split('/').pop() || 'project',
    type: 'unknown',
    hasTypeScript: false,
    hasTests: false,
    entryPoints: [],
    configFiles: [],
    sourceDirectories: [],
    testDirectories: []
  }

  try {
    // List root directory with depth 2 for structure analysis
    const result = await window.api.mcp.requestTool(
      'desktop-commander',
      'list_directory',
      { path: workingDir, depth: 2 },
      'Analyzing project structure'
    )

    if (!result.success) return context

    const files = String(result.result).split('\n')

    // Detect project type and configuration
    for (const line of files) {
      const fileName = line.replace(/^\[(FILE|DIR)\]\s*/, '').trim()
      const isDir = line.includes('[DIR]')
      
      // Skip empty lines
      if (!fileName) continue
      
      // Package manager detection
      if (fileName === 'package.json' || fileName.endsWith('/package.json')) {
        context.type = 'node'
        context.configFiles.push(fileName)
        context.packageManager = 'npm' // Default, may be overridden
      }
      if (fileName === 'yarn.lock' || fileName.endsWith('/yarn.lock')) {
        context.packageManager = 'yarn'
      }
      if (fileName === 'pnpm-lock.yaml' || fileName.endsWith('/pnpm-lock.yaml')) {
        context.packageManager = 'pnpm'
      }
      if (fileName === 'bun.lockb' || fileName.endsWith('/bun.lockb')) {
        context.packageManager = 'bun'
      }
      
      // TypeScript detection
      if (fileName === 'tsconfig.json' || fileName.endsWith('/tsconfig.json')) {
        context.hasTypeScript = true
        context.configFiles.push(fileName)
      }
      if (fileName.includes('tsconfig.') && fileName.endsWith('.json')) {
        context.configFiles.push(fileName)
      }
      
      // Framework detection
      if (fileName.includes('vite.config')) context.framework = 'vite'
      if (fileName.includes('next.config')) context.framework = 'next'
      if (fileName.includes('electron-vite') || fileName.includes('electron.vite')) {
        context.framework = 'electron-vite'
      }
      if (fileName.includes('angular.json')) context.framework = 'angular'
      if (fileName.includes('vue.config')) context.framework = 'vue'
      if (fileName.includes('svelte.config')) context.framework = 'svelte'
      
      // Source directories
      if (isDir) {
        const dirName = fileName.split('/').pop() || fileName
        if (['src', 'lib', 'app', 'pages', 'components', 'renderer', 'main'].includes(dirName)) {
          context.sourceDirectories.push(fileName)
        }
        if (['test', 'tests', '__tests__', 'spec', 'specs'].includes(dirName)) {
          context.testDirectories.push(fileName)
          context.hasTests = true
        }
      }
      
      // Entry points
      const baseName = fileName.split('/').pop() || ''
      if (['index.ts', 'index.tsx', 'main.ts', 'main.tsx', 'App.tsx', 'app.ts', 'index.js'].includes(baseName)) {
        context.entryPoints.push(fileName)
      }
      
      // Config files
      const configPatterns = ['.eslintrc', '.prettierrc', 'jest.config', 'vitest.config', 
                             'tailwind.config', 'postcss.config', '.env.example']
      if (configPatterns.some(c => fileName.includes(c))) {
        context.configFiles.push(fileName)
      }
      
      // Python detection
      if (['pyproject.toml', 'setup.py', 'requirements.txt', 'Pipfile'].includes(baseName)) {
        context.type = 'python'
        context.configFiles.push(fileName)
      }
      
      // Rust detection
      if (baseName === 'Cargo.toml') {
        context.type = 'rust'
        context.configFiles.push(fileName)
      }
      
      // Go detection
      if (baseName === 'go.mod') {
        context.type = 'go'
        context.configFiles.push(fileName)
      }
    }

    // Deduplicate arrays
    context.configFiles = [...new Set(context.configFiles)]
    context.sourceDirectories = [...new Set(context.sourceDirectories)]
    context.testDirectories = [...new Set(context.testDirectories)]
    context.entryPoints = [...new Set(context.entryPoints)]

    return context
  } catch (error) {
    console.error('[ProjectContext] Analysis failed:', error)
    return context
  }
}

/**
 * Read essential config files for context injection
 * Limits content size to avoid context overflow
 */
export async function readProjectConfigs(
  workingDir: string,
  context: ProjectContext
): Promise<Record<string, string>> {
  const configs: Record<string, string> = {}
  
  // Prioritize essential configs
  const essentialConfigs = [
    'package.json',
    'tsconfig.json',
    ...context.configFiles.slice(0, 3) // Limit additional configs
  ]
  
  const uniqueConfigs = [...new Set(essentialConfigs)].slice(0, 5)
  
  for (const configFile of uniqueConfigs) {
    try {
      const fullPath = configFile.startsWith('/') 
        ? configFile 
        : `${workingDir}/${configFile}`
        
      const result = await window.api.mcp.requestTool(
        'desktop-commander',
        'read_file',
        { path: fullPath, length: 300 }, // Limit to ~300 lines
        `Reading ${configFile} for context`
      )
      
      if (result.success && result.result) {
        configs[configFile] = String(result.result)
      }
    } catch {
      // Ignore missing files
    }
  }
  
  return configs
}

/**
 * Build a context string for AI system prompt injection
 */
export function buildProjectContextPrompt(
  context: ProjectContext,
  configs: Record<string, string>
): string {
  const lines: string[] = [
    `## Project Context: ${context.name}`,
    '',
    `**Type:** ${context.type}${context.hasTypeScript ? ' (TypeScript)' : ''}`,
    `**Framework:** ${context.framework || 'None detected'}`,
    `**Package Manager:** ${context.packageManager || 'Unknown'}`,
    ''
  ]
  
  if (context.sourceDirectories.length > 0) {
    lines.push(`**Source Directories:** ${context.sourceDirectories.join(', ')}`)
  }
  
  if (context.entryPoints.length > 0) {
    lines.push(`**Entry Points:** ${context.entryPoints.slice(0, 5).join(', ')}`)
  }
  
  if (context.hasTests) {
    lines.push(`**Test Directories:** ${context.testDirectories.join(', ')}`)
  }
  
  lines.push('')
  
  // Add config file contents (truncated)
  for (const [file, content] of Object.entries(configs)) {
    if (content.length > 0) {
      lines.push(`### ${file}`)
      lines.push('```json')
      // Truncate large configs
      const truncated = content.length > 1500 
        ? content.substring(0, 1500) + '\n... (truncated)'
        : content
      lines.push(truncated)
      lines.push('```')
      lines.push('')
    }
  }
  
  return lines.join('\n')
}

/**
 * Quick project type detection without full analysis
 */
export async function detectProjectType(workingDir: string): Promise<ProjectContext['type']> {
  try {
    const result = await window.api.mcp.requestTool(
      'desktop-commander',
      'list_directory',
      { path: workingDir, depth: 1 },
      'Quick project type detection'
    )
    
    if (!result.success) return 'unknown'
    
    const content = String(result.result)
    
    if (content.includes('package.json')) return 'node'
    if (content.includes('Cargo.toml')) return 'rust'
    if (content.includes('go.mod')) return 'go'
    if (content.includes('pyproject.toml') || content.includes('requirements.txt')) return 'python'
    
    return 'unknown'
  } catch {
    return 'unknown'
  }
}
```

---

## Step 3: Create File Relevance Scorer

**File:** `src/renderer/src/lib/fileRelevance.ts` (new file)

```typescript
// src/renderer/src/lib/fileRelevance.ts
// Smart file selection for context building
// Phase 4: Advanced Capabilities

export interface FileScore {
  path: string
  score: number
  reasons: string[]
}

export interface ScoringContext {
  sourceDirectories: string[]
  testDirectories: string[]
  configFiles?: string[]
}

/**
 * Score files by relevance to a task description
 * Higher scores = more relevant for inclusion in AI context
 */
export function scoreFileRelevance(
  files: string[],
  taskDescription: string,
  context: ScoringContext
): FileScore[] {
  const taskLower = taskDescription.toLowerCase()
  const keywords = extractKeywords(taskDescription)
  const scores: FileScore[] = []
  
  for (const file of files) {
    let score = 0
    const reasons: string[] = []
    
    // Extract file name and extension
    const fileName = file.split('/').pop() || file
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const fileLower = file.toLowerCase()
    
    // === Positive Signals ===
    
    // Source directory bonus
    if (context.sourceDirectories.some(d => file.startsWith(d) || file.includes(`/${d}/`))) {
      score += 20
      reasons.push('source directory')
    }
    
    // TypeScript/JavaScript source files
    if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
      score += 15
      reasons.push('source code')
    }
    
    // Entry points get high priority
    if (['index', 'main', 'app', 'App'].some(e => fileName.startsWith(e))) {
      score += 25
      reasons.push('entry point')
    }
    
    // Config files - important for context
    if (context.configFiles?.some(c => file.endsWith(c))) {
      score += 15
      reasons.push('config file')
    }
    
    // Keyword matching with task (highest signal)
    for (const keyword of keywords) {
      if (fileLower.includes(keyword.toLowerCase())) {
        score += 35
        reasons.push(`matches keyword: ${keyword}`)
        break // Only count once
      }
    }
    
    // Path segment matching
    const pathSegments = file.split('/').map(s => s.toLowerCase())
    for (const keyword of keywords) {
      if (pathSegments.some(seg => seg.includes(keyword.toLowerCase()))) {
        score += 20
        reasons.push(`path contains: ${keyword}`)
        break
      }
    }
    
    // === Negative Signals ===
    
    // Test files - lower priority unless task is about tests
    if (context.testDirectories.some(d => file.includes(d)) || 
        fileName.includes('.test.') || fileName.includes('.spec.')) {
      if (taskLower.includes('test')) {
        score += 30
        reasons.push('test file (task related)')
      } else {
        score -= 15
        reasons.push('test file (not task related)')
      }
    }
    
    // Generated/build files
    if (file.includes('/dist/') || file.includes('/build/') || file.includes('/.next/')) {
      score -= 50
      reasons.push('generated/build file')
    }
    
    // Type definition files (lower priority unless specifically needed)
    if (fileName.endsWith('.d.ts') && !taskLower.includes('type')) {
      score -= 10
      reasons.push('type definition')
    }
    
    // Depth penalty - deeper files are often less relevant
    const depth = file.split('/').filter(Boolean).length
    if (depth > 4) {
      score -= (depth - 4) * 3
      reasons.push(`deep path (depth ${depth})`)
    }
    
    // Lock files and generated configs
    if (['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.eslintcache'].includes(fileName)) {
      score -= 100
      reasons.push('lock/cache file')
    }
    
    scores.push({
      path: file,
      score: Math.max(-100, score), // Floor at -100
      reasons
    })
  }
  
  // Sort by score descending
  return scores.sort((a, b) => b.score - a.score)
}

/**
 * Extract meaningful keywords from task description
 */
export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'we', 'they',
    'please', 'help', 'me', 'my', 'need', 'want', 'create', 'make', 'add',
    'fix', 'update', 'change', 'modify', 'implement', 'write', 'code',
    'file', 'files', 'new', 'existing', 'current', 'can', 'how', 'what'
  ])
  
  // Extract words, preserving camelCase and snake_case
  const words = text
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Split camelCase
    .replace(/_/g, ' ') // Split snake_case
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
  
  // Return unique keywords, prioritizing longer ones
  const unique = [...new Set(words)]
  return unique.sort((a, b) => b.length - a.length).slice(0, 10)
}

/**
 * Select files for context based on relevance and token budget
 */
export async function selectFilesForContext(
  workingDir: string,
  taskDescription: string,
  options: {
    maxFiles?: number
    maxTokens?: number
    includeConfigs?: boolean
  } = {}
): Promise<{ files: string[]; scores: FileScore[] }> {
  const { maxFiles = 20, maxTokens = 50000, includeConfigs = true } = options
  
  // Get file list
  const result = await window.api.mcp.requestTool(
    'desktop-commander',
    'list_directory',
    { path: workingDir, depth: 4 },
    'Listing files for context selection'
  )
  
  if (!result.success) return { files: [], scores: [] }
  
  // Parse file list
  const lines = String(result.result).split('\n')
  const files = lines
    .filter(l => l.includes('[FILE]'))
    .map(l => l.replace(/^\[FILE\]\s*/, '').trim())
    .filter(f => 
      !f.includes('node_modules') && 
      !f.includes('.git/') &&
      !f.includes('dist/') &&
      !f.includes('build/')
    )
  
  // Score files
  const scored = scoreFileRelevance(files, taskDescription, {
    sourceDirectories: ['src', 'lib', 'app', 'renderer', 'main'],
    testDirectories: ['test', 'tests', '__tests__', 'spec'],
    configFiles: includeConfigs ? ['package.json', 'tsconfig.json'] : []
  })
  
  // Select files within budget
  const selected: string[] = []
  let estimatedTokens = 0
  const avgTokensPerFile = 400 // Conservative estimate
  
  for (const file of scored) {
    if (selected.length >= maxFiles) break
    if (estimatedTokens + avgTokensPerFile > maxTokens) break
    if (file.score > 0) {
      selected.push(file.path)
      estimatedTokens += avgTokensPerFile
    }
  }
  
  return { files: selected, scores: scored.slice(0, 50) }
}

/**
 * Get a summary of file selection for logging/display
 */
export function summarizeFileSelection(scores: FileScore[]): string {
  const topFiles = scores.slice(0, 10)
  const lines = ['## File Relevance Analysis', '']
  
  for (const file of topFiles) {
    const shortPath = file.path.length > 50 
      ? '...' + file.path.slice(-47)
      : file.path
    lines.push(`- **${shortPath}** (score: ${file.score})`)
    if (file.reasons.length > 0) {
      lines.push(`  - ${file.reasons.join(', ')}`)
    }
  }
  
  if (scores.length > 10) {
    lines.push(`\n... and ${scores.length - 10} more files`)
  }
  
  return lines.join('\n')
}
```

---

## Step 4: Create Checkpoint Restoration Hook

**File:** `src/renderer/src/hooks/useCheckpointRestore.ts` (new file)


```typescript
// src/renderer/src/hooks/useCheckpointRestore.ts
// Checkpoint restoration for session resumption
// Phase 4: Advanced Capabilities

import { useCallback } from 'react'
import type { AgentMessage } from '../types/agent'

export interface CheckpointSummary {
  sessionId: string
  checkpointId: string
  timestamp: number
  summary: string
  keyDecisions: string[]
  filesModified: string[]
  pendingActions: string[]
  tokenEstimate: number
}

export interface RestoredState {
  messages: AgentMessage[]
  systemPromptAddition: string
  resumptionGuidance: string
  checkpoint: CheckpointSummary
}

export interface UseCheckpointRestoreResult {
  getResumableSessions: () => Promise<CheckpointSummary[]>
  getCheckpointsForSession: (sessionId: string) => Promise<CheckpointSummary[]>
  restoreFromCheckpoint: (checkpointId: string) => Promise<RestoredState>
  generateResumptionPrompt: (checkpoint: CheckpointSummary) => string
}

/**
 * Hook for restoring agent state from work journal checkpoints
 */
export function useCheckpointRestore(): UseCheckpointRestoreResult {
  
  /**
   * Get all sessions that can be resumed (paused or crashed)
   */
  const getResumableSessions = useCallback(async (): Promise<CheckpointSummary[]> => {
    try {
      const sessions = await window.api.workJournal.getResumableSessions(20)
      
      const summaries: CheckpointSummary[] = []
      
      for (const session of sessions) {
        const checkpoint = await window.api.workJournal.getLatestCheckpoint(session.id)
        
        if (checkpoint) {
          summaries.push({
            sessionId: session.id,
            checkpointId: checkpoint.id,
            timestamp: checkpoint.createdAt,
            summary: checkpoint.summary,
            keyDecisions: checkpoint.keyDecisions,
            filesModified: checkpoint.filesModified,
            pendingActions: checkpoint.pendingActions,
            tokenEstimate: session.tokenEstimate
          })
        }
      }
      
      return summaries.sort((a, b) => b.timestamp - a.timestamp)
    } catch (error) {
      console.error('[CheckpointRestore] Failed to get resumable sessions:', error)
      return []
    }
  }, [])

  /**
   * Get all checkpoints for a specific session
   */
  const getCheckpointsForSession = useCallback(async (
    sessionId: string
  ): Promise<CheckpointSummary[]> => {
    try {
      // Get session info
      const session = await window.api.workJournal.getSession(sessionId)
      if (!session) return []
      
      // Get entries to reconstruct checkpoint history
      const entries = await window.api.workJournal.getEntries(sessionId, {
        types: ['checkpoint'],
        limit: 50
      })
      
      const summaries: CheckpointSummary[] = entries
        .filter(e => e.entryType === 'checkpoint')
        .map(e => ({
          sessionId,
          checkpointId: e.content.checkpointId as string || `cp-${e.id}`,
          timestamp: e.timestamp,
          summary: e.content.summary as string || 'Checkpoint',
          keyDecisions: (e.content.keyDecisions as string[]) || [],
          filesModified: (e.content.filesModified as string[]) || [],
          pendingActions: (e.content.pendingActions as string[]) || [],
          tokenEstimate: e.tokenEstimate
        }))
      
      return summaries.sort((a, b) => b.timestamp - a.timestamp)
    } catch (error) {
      console.error('[CheckpointRestore] Failed to get checkpoints:', error)
      return []
    }
  }, [])

  /**
   * Restore agent state from a checkpoint
   */
  const restoreFromCheckpoint = useCallback(async (
    checkpointId: string
  ): Promise<RestoredState> => {
    try {
      // Parse session ID from checkpoint ID (format: session-xxx or cp-xxx)
      // We need to find the session this checkpoint belongs to
      const resumableSessions = await getResumableSessions()
      const checkpoint = resumableSessions.find(s => s.checkpointId === checkpointId)
      
      if (!checkpoint) {
        throw new Error(`Checkpoint ${checkpointId} not found`)
      }
      
      // Generate resumption context
      const context = await window.api.workJournal.generateResumptionContext(
        checkpoint.sessionId,
        10000 // Target tokens for context
      )
      
      // Build restored messages from context
      const messages: AgentMessage[] = []
      
      // Add a summary message of previous work
      if (context.workSummary) {
        messages.push({
          id: `restored-summary-${Date.now()}`,
          role: 'assistant',
          content: `[Previous work summary]\n${context.workSummary}`,
          timestamp: new Date(checkpoint.timestamp).toISOString()
        })
      }
      
      // Build system prompt addition for resumption
      const systemPromptAddition = `
## Session Resumption Context

You are resuming a previous work session. Here's what was accomplished:

### Original Task
${context.originalPrompt}

### Work Summary
${context.workSummary}

### Key Decisions Made
${context.keyDecisions.map(d => `- ${d}`).join('\n')}

### Files Modified
${context.filesModified.map(f => `- ${f}`).join('\n') || '- None yet'}

### Current State
${context.currentState}

### Pending Actions
${context.pendingActions.map(a => `- ${a}`).join('\n') || '- None pending'}

${context.errorHistory.length > 0 ? `### Previous Errors to Avoid\n${context.errorHistory.slice(-3).map(e => `- ${e}`).join('\n')}` : ''}

---
Resume from where you left off. Review the above context and continue the task.
`

      const resumptionGuidance = generateResumptionPrompt(checkpoint)

      return {
        messages,
        systemPromptAddition,
        resumptionGuidance,
        checkpoint
      }
    } catch (error) {
      console.error('[CheckpointRestore] Failed to restore checkpoint:', error)
      throw error
    }
  }, [getResumableSessions])

  /**
   * Generate a human-readable resumption prompt
   */
  const generateResumptionPrompt = useCallback((checkpoint: CheckpointSummary): string => {
    const lines: string[] = [
      '## Resumption Instructions',
      '',
      `Last checkpoint: ${new Date(checkpoint.timestamp).toLocaleString()}`,
      '',
      '### Summary',
      checkpoint.summary,
      ''
    ]
    
    if (checkpoint.keyDecisions.length > 0) {
      lines.push('### Key Decisions')
      checkpoint.keyDecisions.forEach(d => lines.push(`- ${d}`))
      lines.push('')
    }
    
    if (checkpoint.filesModified.length > 0) {
      lines.push('### Files Modified')
      checkpoint.filesModified.forEach(f => lines.push(`- ${f}`))
      lines.push('')
    }
    
    if (checkpoint.pendingActions.length > 0) {
      lines.push('### Pending Actions')
      checkpoint.pendingActions.forEach(a => lines.push(`- ${a}`))
      lines.push('')
    }
    
    lines.push('---')
    lines.push('Please continue from where you left off.')
    
    return lines.join('\n')
  }, [])

  return {
    getResumableSessions,
    getCheckpointsForSession,
    restoreFromCheckpoint,
    generateResumptionPrompt
  }
}

export default useCheckpointRestore
```

---

## Step 5: Create Multi-File Orchestrator

**File:** `src/renderer/src/lib/multiFileOrchestrator.ts` (new file)

```typescript
// src/renderer/src/lib/multiFileOrchestrator.ts
// Orchestrates complex multi-file operations with dependency awareness
// Phase 4: Advanced Capabilities

export type FileOperationType = 'create' | 'modify' | 'delete' | 'rename'

export interface FileOperation {
  id: string
  type: FileOperationType
  path: string
  content?: string
  newPath?: string // For rename operations
  dependencies?: string[] // File paths that must be processed first
  description?: string
}

export interface OrchestrationPlan {
  id: string
  operations: FileOperation[]
  executionOrder: string[] // Operation IDs in execution order
  estimatedDuration: number // milliseconds
  risks: string[]
  createdAt: number
}

export interface ExecutionProgress {
  completed: number
  total: number
  currentOperation: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export interface ExecutionResult {
  success: boolean
  completed: string[] // Operation IDs
  failed: Array<{ operationId: string; error: string }>
  duration: number
}

/**
 * Create an execution plan for multi-file operations
 * Performs dependency analysis and topological sorting
 */
export function createOrchestrationPlan(
  operations: Omit<FileOperation, 'id'>[]
): OrchestrationPlan {
  const risks: string[] = []
  
  // Assign IDs to operations
  const opsWithIds: FileOperation[] = operations.map((op, idx) => ({
    ...op,
    id: `op-${idx}-${op.type}-${op.path.split('/').pop()}`
  }))
  
  // Build dependency graph (operation ID -> dependent operation IDs)
  const graph = new Map<string, Set<string>>()
  const pathToOpId = new Map<string, string>()
  
  // Map paths to operation IDs
  for (const op of opsWithIds) {
    pathToOpId.set(op.path, op.id)
    graph.set(op.id, new Set())
  }
  
  // Build dependencies
  for (const op of opsWithIds) {
    if (op.dependencies) {
      for (const depPath of op.dependencies) {
        const depOpId = pathToOpId.get(depPath)
        if (depOpId) {
          graph.get(op.id)!.add(depOpId)
        }
      }
    }
  }
  
  // Topological sort using Kahn's algorithm
  const inDegree = new Map<string, number>()
  for (const op of opsWithIds) {
    inDegree.set(op.id, 0)
  }
  
  for (const [, deps] of graph) {
    for (const dep of deps) {
      inDegree.set(dep, (inDegree.get(dep) || 0) + 1)
    }
  }
  
  const queue: string[] = []
  for (const [opId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(opId)
    }
  }
  
  const executionOrder: string[] = []
  const visiting = new Set<string>()
  
  while (queue.length > 0) {
    const opId = queue.shift()!
    
    // Circular dependency check
    if (visiting.has(opId)) {
      risks.push(`Circular dependency detected involving ${opId}`)
      continue
    }
    
    executionOrder.push(opId)
    visiting.add(opId)
    
    for (const [targetId, deps] of graph) {
      if (deps.has(opId)) {
        const newDegree = (inDegree.get(targetId) || 1) - 1
        inDegree.set(targetId, newDegree)
        if (newDegree === 0) {
          queue.push(targetId)
        }
      }
    }
  }
  
  // Check for unprocessed operations (indicates cycle)
  if (executionOrder.length < opsWithIds.length) {
    risks.push('Some operations could not be ordered - possible circular dependencies')
  }
  
  // Calculate estimated duration
  const estimatedDuration = opsWithIds.reduce((sum, op) => {
    switch (op.type) {
      case 'create': return sum + 2000
      case 'modify': return sum + 1500
      case 'delete': return sum + 500
      case 'rename': return sum + 1000
      default: return sum + 1000
    }
  }, 0)
  
  // Identify risks
  const deleteOps = opsWithIds.filter(op => op.type === 'delete')
  if (deleteOps.length > 0) {
    risks.push(`Plan includes ${deleteOps.length} file deletion(s) - ensure backups exist`)
  }
  
  const modifyCount = opsWithIds.filter(op => op.type === 'modify').length
  if (modifyCount > 10) {
    risks.push(`Large refactoring: ${modifyCount} files to modify`)
  }
  
  const createCount = opsWithIds.filter(op => op.type === 'create').length
  if (createCount > 5) {
    risks.push(`Creating ${createCount} new files`)
  }
  
  return {
    id: `plan-${Date.now()}`,
    operations: opsWithIds,
    executionOrder,
    estimatedDuration,
    risks,
    createdAt: Date.now()
  }
}

/**
 * Execute an orchestration plan
 */
export async function executePlan(
  plan: OrchestrationPlan,
  callbacks: {
    onProgress?: (progress: ExecutionProgress) => void
    onOperationComplete?: (opId: string, success: boolean) => void
    onError?: (opId: string, error: string) => void
  } = {}
): Promise<ExecutionResult> {
  const { onProgress, onOperationComplete, onError } = callbacks
  const startTime = Date.now()
  const completed: string[] = []
  const failed: Array<{ operationId: string; error: string }> = []
  
  // Build operation lookup
  const opById = new Map(plan.operations.map(op => [op.id, op]))
  
  for (let i = 0; i < plan.executionOrder.length; i++) {
    const opId = plan.executionOrder[i]
    const operation = opById.get(opId)
    
    if (!operation) {
      failed.push({ operationId: opId, error: 'Operation not found' })
      continue
    }
    
    // Report progress
    onProgress?.({
      completed: i,
      total: plan.executionOrder.length,
      currentOperation: operation.path,
      status: 'running'
    })
    
    try {
      await executeOperation(operation)
      completed.push(opId)
      onOperationComplete?.(opId, true)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      failed.push({ operationId: opId, error: errorMsg })
      onError?.(opId, errorMsg)
      onOperationComplete?.(opId, false)
      
      // Continue with other operations unless it's a critical failure
      // (dependency failures are handled by the sort order)
    }
  }
  
  // Final progress update
  onProgress?.({
    completed: plan.executionOrder.length,
    total: plan.executionOrder.length,
    currentOperation: 'Done',
    status: failed.length === 0 ? 'completed' : 'failed'
  })
  
  return {
    success: failed.length === 0,
    completed,
    failed,
    duration: Date.now() - startTime
  }
}

/**
 * Execute a single file operation
 */
async function executeOperation(operation: FileOperation): Promise<void> {
  switch (operation.type) {
    case 'create':
    case 'modify': {
      if (!operation.content) {
        throw new Error(`No content provided for ${operation.type} operation on ${operation.path}`)
      }
      
      const result = await window.api.mcp.requestTool(
        'desktop-commander',
        'write_file',
        { 
          path: operation.path, 
          content: operation.content,
          mode: operation.type === 'create' ? 'rewrite' : 'rewrite'
        },
        operation.description || `${operation.type === 'create' ? 'Creating' : 'Modifying'} ${operation.path}`
      )
      
      if (!result.success) {
        throw new Error(result.error || `Failed to ${operation.type} file`)
      }
      break
    }
    
    case 'rename': {
      if (!operation.newPath) {
        throw new Error(`No new path provided for rename operation on ${operation.path}`)
      }
      
      const result = await window.api.mcp.requestTool(
        'desktop-commander',
        'move_file',
        { 
          source: operation.path, 
          destination: operation.newPath 
        },
        operation.description || `Renaming ${operation.path} to ${operation.newPath}`
      )
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to rename file')
      }
      break
    }
    
    case 'delete': {
      // Desktop Commander doesn't have a native delete tool
      // Use shell command via start_process
      const result = await window.api.mcp.requestTool(
        'desktop-commander',
        'start_process',
        {
          command: `rm "${operation.path}"`,
          timeout_ms: 5000
        },
        operation.description || `Deleting ${operation.path}`
      )
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete file')
      }
      break
    }
    
    default:
      throw new Error(`Unknown operation type: ${(operation as FileOperation).type}`)
  }
}

/**
 * Validate a plan before execution
 */
export function validatePlan(plan: OrchestrationPlan): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = [...plan.risks]
  
  // Check for missing content
  for (const op of plan.operations) {
    if ((op.type === 'create' || op.type === 'modify') && !op.content) {
      errors.push(`Operation ${op.id} (${op.type} ${op.path}) has no content`)
    }
    
    if (op.type === 'rename' && !op.newPath) {
      errors.push(`Rename operation ${op.id} has no destination path`)
    }
  }
  
  // Check for duplicate paths
  const paths = plan.operations.map(op => op.path)
  const duplicates = paths.filter((p, i) => paths.indexOf(p) !== i)
  if (duplicates.length > 0) {
    warnings.push(`Multiple operations on same file: ${[...new Set(duplicates)].join(', ')}`)
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Create a summary of the plan for display
 */
export function summarizePlan(plan: OrchestrationPlan): string {
  const lines: string[] = [
    '## Orchestration Plan Summary',
    '',
    `**Operations:** ${plan.operations.length}`,
    `**Estimated Duration:** ${Math.round(plan.estimatedDuration / 1000)}s`,
    ''
  ]
  
  // Group by operation type
  const byType = new Map<FileOperationType, FileOperation[]>()
  for (const op of plan.operations) {
    const list = byType.get(op.type) || []
    list.push(op)
    byType.set(op.type, list)
  }
  
  for (const [type, ops] of byType) {
    lines.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)} (${ops.length})`)
    for (const op of ops.slice(0, 10)) {
      lines.push(`- ${op.path}`)
    }
    if (ops.length > 10) {
      lines.push(`  ... and ${ops.length - 10} more`)
    }
    lines.push('')
  }
  
  if (plan.risks.length > 0) {
    lines.push('### ⚠️ Risks')
    plan.risks.forEach(r => lines.push(`- ${r}`))
  }
  
  return lines.join('\n')
}
```

---

## Step 6: Integrate into Agent Context

**File:** `src/renderer/src/contexts/AgentContext.tsx`

Find the `CreateAgentOptions` interface and add new fields:

```typescript
// Add to CreateAgentOptions interface:
export interface CreateAgentOptions {
  // ... existing fields ...
  
  // Phase 4: Advanced capabilities
  autoAnalyzeProject?: boolean
  contextTokenBudget?: number
  enableMultiFileOrchestration?: boolean
  checkpointToRestore?: string // Checkpoint ID to restore from
}
```

Then update the `createAgent` function to use project context:


```typescript
// In createAgent function, add project analysis after getting the agent ID:

const createAgent = useCallback(async (options: CreateAgentOptions): Promise<Agent> => {
  const agentId = `agent-${Date.now()}`
  
  // Phase 4: Auto-analyze project if requested
  let projectContextPrompt = ''
  if (options.autoAnalyzeProject && options.workingDirectory) {
    try {
      console.log('[AgentContext] Analyzing project structure...')
      
      // Import dynamically to avoid circular dependencies
      const { analyzeProject, readProjectConfigs, buildProjectContextPrompt } = 
        await import('../lib/projectContext')
      
      const projectContext = await analyzeProject(options.workingDirectory)
      const configs = await readProjectConfigs(options.workingDirectory, projectContext)
      projectContextPrompt = buildProjectContextPrompt(projectContext, configs)
      
      console.log('[AgentContext] Project context built:', {
        type: projectContext.type,
        framework: projectContext.framework,
        hasTypeScript: projectContext.hasTypeScript
      })
    } catch (error) {
      console.warn('[AgentContext] Project analysis failed:', error)
    }
  }
  
  // Phase 4: Handle checkpoint restoration
  let restoredState = null
  if (options.checkpointToRestore) {
    try {
      console.log('[AgentContext] Restoring from checkpoint:', options.checkpointToRestore)
      
      const { useCheckpointRestore } = await import('../hooks/useCheckpointRestore')
      // Note: In actual implementation, this would be a direct function call
      // since hooks can't be called conditionally. Consider refactoring to a service.
      
      // For now, fetch restoration context via work journal directly
      const checkpoint = await window.api.workJournal.getLatestCheckpoint(options.checkpointToRestore)
      if (checkpoint) {
        const resumptionContext = await window.api.workJournal.generateResumptionContext(
          options.checkpointToRestore,
          options.contextTokenBudget || 10000
        )
        
        restoredState = {
          checkpoint,
          resumptionContext
        }
      }
    } catch (error) {
      console.warn('[AgentContext] Checkpoint restoration failed:', error)
    }
  }
  
  // Build system prompt with all context additions
  let systemPrompt = options.personaContent || DEFAULT_AGENT_SYSTEM_PROMPT
  
  // Add project context
  if (projectContextPrompt) {
    systemPrompt = `${systemPrompt}\n\n${projectContextPrompt}`
  }
  
  // Add restoration context
  if (restoredState?.resumptionContext) {
    const rc = restoredState.resumptionContext
    systemPrompt = `${systemPrompt}\n\n## Session Resumption

You are resuming a previous work session.

### Original Task
${rc.originalPrompt}

### Work Summary
${rc.workSummary}

### Key Decisions
${rc.keyDecisions.map(d => `- ${d}`).join('\n')}

### Files Modified
${rc.filesModified.map(f => `- ${f}`).join('\n') || '- None yet'}

### Pending Actions
${rc.pendingActions.map(a => `- ${a}`).join('\n') || '- None'}

Please continue from where you left off.
`
  }
  
  // Add MCP tool instructions
  const mcpSystemPrompt = await window.api.mcp.getSystemPrompt()
  systemPrompt = `${systemPrompt}\n\n${mcpSystemPrompt}`
  
  // ... rest of agent creation (messages, steps, etc.)
}, [/* dependencies */])
```

---

## Step 7: Update Agent Templates

**File:** `src/renderer/src/data/agentTemplates.ts`

Update the `AgentTemplate` interface and relevant templates:

```typescript
// Add to AgentTemplate interface:
export interface AgentTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: 'development' | 'writing' | 'research' | 'general'
  instructions: string
  toolPermission: AgentToolPermission
  tags: string[]
  isBuiltIn: boolean
  requiresDirectory?: boolean
  
  // Phase 4: Advanced capabilities
  autoAnalyzeProject?: boolean
  contextTokenBudget?: number
  enableMultiFileOrchestration?: boolean
}

// Update templates that benefit from project analysis:

export const AGENT_TEMPLATES: AgentTemplate[] = [
  // ... existing templates ...
  
  {
    id: 'template-feature-implementation',
    name: 'Feature Implementation',
    description: 'Build a new feature from requirements with full project context',
    icon: 'Sparkles',
    category: 'development',
    instructions: `You are a feature implementation specialist. Your task is to:

1. Understand the feature requirements completely
2. Analyze the existing codebase for patterns and conventions
3. Design an implementation that fits the project architecture
4. Implement the feature with proper error handling
5. Add appropriate tests if the project has a test suite
6. Verify the implementation compiles and integrates correctly

Always follow existing code patterns and naming conventions.
Use TypeScript if the project uses TypeScript.
`,
    toolPermission: 'autonomous',
    tags: ['feature', 'implement', 'build', 'development'],
    isBuiltIn: true,
    requiresDirectory: true,
    autoAnalyzeProject: true,
    contextTokenBudget: 75000,
    enableMultiFileOrchestration: true
  },
  
  {
    id: 'template-refactoring',
    name: 'Code Refactoring',
    description: 'Refactor code across multiple files with dependency awareness',
    icon: 'RefreshCw',
    category: 'development',
    instructions: `You are a refactoring specialist. Your task is to:

1. Understand what needs to be refactored and why
2. Identify all affected files and their dependencies
3. Plan the refactoring order to avoid breaking changes
4. Execute changes systematically, verifying each step
5. Update all imports and references
6. Run type checking after each major change
7. Ensure the codebase compiles successfully

IMPORTANT: For multi-file refactoring, plan the execution order carefully.
Files that are imported by others should be updated first.
`,
    toolPermission: 'standard',
    tags: ['refactor', 'cleanup', 'improve', 'rename'],
    isBuiltIn: true,
    requiresDirectory: true,
    autoAnalyzeProject: true,
    contextTokenBudget: 100000,
    enableMultiFileOrchestration: true
  },
  
  {
    id: 'template-bug-fix',
    name: 'Bug Investigation & Fix',
    description: 'Investigate and fix bugs with full project context',
    icon: 'Bug',
    category: 'development',
    instructions: `You are a bug investigation specialist. Your task is to:

1. Understand the bug report and reproduce the issue mentally
2. Identify likely locations where the bug might originate
3. Read relevant source files to understand the logic
4. Trace the data/control flow to find the root cause
5. Propose and implement a fix
6. Verify the fix doesn't break other functionality
7. Ensure type checking passes

Start with the most likely source files based on the bug description.
`,
    toolPermission: 'standard',
    tags: ['bug', 'fix', 'debug', 'issue'],
    isBuiltIn: true,
    requiresDirectory: true,
    autoAnalyzeProject: true,
    contextTokenBudget: 50000
  }
]
```

---

## Step 8: Create Agent Spawn Dialog Enhancement

**File:** `src/renderer/src/components/agents/SpawnAgentDialog.tsx`

Add UI for the new Phase 4 options in the agent spawn dialog:

```typescript
// Add state for Phase 4 options:
const [autoAnalyzeProject, setAutoAnalyzeProject] = useState(true)
const [enableOrchestration, setEnableOrchestration] = useState(false)
const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null)
const [availableCheckpoints, setAvailableCheckpoints] = useState<CheckpointSummary[]>([])

// Load available checkpoints when dialog opens
useEffect(() => {
  if (open) {
    loadCheckpoints()
  }
}, [open])

const loadCheckpoints = async () => {
  try {
    const { useCheckpointRestore } = await import('../../hooks/useCheckpointRestore')
    // Note: Would need to refactor to use a service pattern
    const checkpoints = await window.api.workJournal.getResumableSessions(10)
    // Transform to CheckpointSummary format
    setAvailableCheckpoints(/* transformed checkpoints */)
  } catch (error) {
    console.error('Failed to load checkpoints:', error)
  }
}

// In the form JSX, add:
<div className="space-y-4">
  {/* Existing fields... */}
  
  {/* Phase 4: Project Analysis Toggle */}
  <div className="flex items-center justify-between">
    <div>
      <label className="text-sm font-medium">Auto-Analyze Project</label>
      <p className="text-xs text-muted-foreground">
        Automatically detect project type, framework, and structure
      </p>
    </div>
    <Switch
      checked={autoAnalyzeProject}
      onCheckedChange={setAutoAnalyzeProject}
    />
  </div>
  
  {/* Phase 4: Multi-File Orchestration Toggle */}
  <div className="flex items-center justify-between">
    <div>
      <label className="text-sm font-medium">Enable Multi-File Orchestration</label>
      <p className="text-xs text-muted-foreground">
        Allow agent to plan and execute complex multi-file changes
      </p>
    </div>
    <Switch
      checked={enableOrchestration}
      onCheckedChange={setEnableOrchestration}
    />
  </div>
  
  {/* Phase 4: Checkpoint Restoration */}
  {availableCheckpoints.length > 0 && (
    <div className="space-y-2">
      <label className="text-sm font-medium">Resume Previous Session</label>
      <select
        value={selectedCheckpoint || ''}
        onChange={(e) => setSelectedCheckpoint(e.target.value || null)}
        className="w-full p-2 border rounded"
      >
        <option value="">Start fresh</option>
        {availableCheckpoints.map(cp => (
          <option key={cp.checkpointId} value={cp.sessionId}>
            {new Date(cp.timestamp).toLocaleString()} - {cp.summary.slice(0, 50)}...
          </option>
        ))}
      </select>
    </div>
  )}
</div>

// Update handleSpawn to include new options:
const handleSpawn = async () => {
  await createAgent({
    // ... existing options ...
    autoAnalyzeProject,
    enableMultiFileOrchestration: enableOrchestration,
    checkpointToRestore: selectedCheckpoint || undefined
  })
}
```

---

## Verification Checklist

After implementing all steps, verify:

### TypeScript Compilation
```bash
cd /Users/cory.naegle/ArborChat && npm run typecheck
```

### Unit Functionality Tests

- [ ] **Project Analysis**
  - [ ] `analyzeProject()` correctly detects Node.js projects
  - [ ] `analyzeProject()` detects TypeScript configuration
  - [ ] `analyzeProject()` identifies framework (electron-vite, vite, etc.)
  - [ ] `readProjectConfigs()` reads package.json and tsconfig.json
  - [ ] `buildProjectContextPrompt()` generates valid markdown

- [ ] **File Relevance**
  - [ ] `extractKeywords()` extracts meaningful keywords
  - [ ] `scoreFileRelevance()` ranks source files higher than tests
  - [ ] `scoreFileRelevance()` boosts files matching task keywords
  - [ ] `selectFilesForContext()` respects token budget

- [ ] **Checkpoint Restoration**
  - [ ] `getResumableSessions()` returns paused/crashed sessions
  - [ ] `restoreFromCheckpoint()` builds valid resumption context
  - [ ] Restored agent has previous work summary in system prompt

- [ ] **Multi-File Orchestration**
  - [ ] `createOrchestrationPlan()` performs topological sort
  - [ ] `createOrchestrationPlan()` detects circular dependencies
  - [ ] `executePlan()` executes operations in correct order
  - [ ] `validatePlan()` catches missing content errors

---

## Testing Scenarios

### Scenario 1: Project Analysis on ArborChat

```
1. Open ArborChat
2. Create a new agent with "Feature Implementation" template
3. Set working directory to /Users/cory.naegle/ArborChat
4. Enable "Auto-Analyze Project"
5. Spawn agent

Expected:
- Agent system prompt includes project context
- Detected as Node.js + TypeScript + electron-vite
- package.json and tsconfig.json content included
```

### Scenario 2: File Relevance for MCP Fix

```
1. Create agent with task: "Fix the MCP provider connection issue"
2. Set working directory to ArborChat
3. Check file selection logs

Expected:
- Files in src/main/mcp/ score highest
- MCPManager.ts, MCPClient.ts prioritized
- node_modules and dist excluded
- Test files score lower unless task mentions "test"
```

### Scenario 3: Checkpoint Restoration

```
1. Start an agent on a coding task
2. Let it work for several iterations
3. Pause or crash the agent
4. Create a new agent, select "Resume Previous Session"
5. Select the checkpoint

Expected:
- New agent has resumption context in system prompt
- Work summary, files modified, pending actions listed
- Agent continues from where it left off
```

### Scenario 4: Multi-File Refactoring

```
1. Create an orchestration plan for renaming a component:
   - Rename ComponentA.tsx to NewComponent.tsx
   - Update imports in files that use ComponentA
   
2. Validate the plan
3. Execute the plan

Expected:
- Import updates scheduled after rename
- Execution order respects dependencies
- All operations complete successfully
- TypeScript compilation passes after
```

---

## Post-Implementation Cleanup

After all tests pass:

1. **Remove any debug logging** that's overly verbose
2. **Update jsdoc comments** for all new public functions
3. **Add barrel exports** in `src/renderer/src/lib/index.ts`:
   ```typescript
   export * from './projectContext'
   export * from './fileRelevance'
   export * from './multiFileOrchestrator'
   ```
4. **Update agent templates** to use sensible defaults

---

## Summary

Phase 4 implementation adds four major capabilities:

| Component | Purpose | Key Functions |
|-----------|---------|---------------|
| **Project Context** | Auto-detect project structure | `analyzeProject()`, `buildProjectContextPrompt()` |
| **File Relevance** | Smart file selection | `scoreFileRelevance()`, `selectFilesForContext()` |
| **Checkpoint Restore** | Resume interrupted work | `restoreFromCheckpoint()`, `generateResumptionPrompt()` |
| **Multi-File Orchestrator** | Complex refactoring | `createOrchestrationPlan()`, `executePlan()` |

These capabilities enable ArborChat agents to:
- Understand project context from the start
- Focus on relevant files for the task
- Resume interrupted work seamlessly  
- Handle complex multi-file operations safely
