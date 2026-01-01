# Coding Capability Improvement - Phase 4: Advanced Capabilities

**Reference Design:** `/docs/designs/CODING_CAPABILITY_IMPROVEMENT_DESIGN.md`  
**Prerequisite:** Phase 1, 2 & 3 completed  
**Estimated Effort:** 2-3 weeks  
**Priority:** Medium  

---

## Objective

Implement advanced capabilities for complex coding tasks:

1. Multi-File Orchestration - Handle complex refactoring across many files
2. Project Context Seeding - Auto-detect project structure and configuration
3. Checkpoint Restoration - Resume from work journal checkpoints with full context
4. Smart File Selection - Prioritize relevant files for context

---

## Prerequisites

- Phase 1, 2 & 3 completed and verified
- Native function calling working for all providers
- Verification systems in place
- Work Journal system functional

---

## Implementation Steps

### Step 1: Create Project Context Analyzer

**File:** `src/renderer/src/lib/projectContext.ts`

```typescript
// src/renderer/src/lib/projectContext.ts
// Project structure analysis and context seeding

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
    // List root directory
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
      
      // Package manager detection
      if (fileName === 'package.json') {
        context.type = 'node'
        context.configFiles.push(fileName)
        context.packageManager = 'npm'
      }
      if (fileName === 'yarn.lock') context.packageManager = 'yarn'
      if (fileName === 'pnpm-lock.yaml') context.packageManager = 'pnpm'
      if (fileName === 'bun.lockb') context.packageManager = 'bun'
      
      // TypeScript detection
      if (fileName === 'tsconfig.json') {
        context.hasTypeScript = true
        context.configFiles.push(fileName)
      }
      
      // Framework detection
      if (fileName.includes('vite.config')) context.framework = 'vite'
      if (fileName.includes('next.config')) context.framework = 'next'
      if (fileName.includes('electron')) context.framework = 'electron'
      if (fileName.includes('angular.json')) context.framework = 'angular'
      
      // Source directories
      if (line.includes('[DIR]')) {
        if (['src', 'lib', 'app', 'pages', 'components'].some(d => fileName.endsWith(d))) {
          context.sourceDirectories.push(fileName)
        }
        if (['test', 'tests', '__tests__', 'spec'].some(d => fileName.includes(d))) {
          context.testDirectories.push(fileName)
          context.hasTests = true
        }
      }
      
      // Entry points
      if (['index.ts', 'index.tsx', 'main.ts', 'App.tsx', 'app.ts'].includes(fileName.split('/').pop() || '')) {
        context.entryPoints.push(fileName)
      }
      
      // Config files
      if (['.eslintrc', '.prettierrc', 'jest.config', 'vitest.config'].some(c => fileName.includes(c))) {
        context.configFiles.push(fileName)
      }
      
      // Python detection
      if (['pyproject.toml', 'setup.py', 'requirements.txt'].includes(fileName)) {
        context.type = 'python'
        context.configFiles.push(fileName)
      }
      
      // Rust detection
      if (fileName === 'Cargo.toml') {
        context.type = 'rust'
        context.configFiles.push(fileName)
      }
      
      // Go detection
      if (fileName === 'go.mod') {
        context.type = 'go'
        context.configFiles.push(fileName)
      }
    }

    return context
  } catch (error) {
    console.error('[ProjectContext] Analysis failed:', error)
    return context
  }
}

/**
 * Read essential config files for context
 */
export async function readProjectConfigs(
  workingDir: string,
  context: ProjectContext
): Promise<Record<string, string>> {
  const configs: Record<string, string> = {}
  
  const essentialConfigs = [
    'package.json',
    'tsconfig.json',
    ...context.configFiles.slice(0, 5) // Limit to 5 extra configs
  ]
  
  const uniqueConfigs = [...new Set(essentialConfigs)]
  
  for (const configFile of uniqueConfigs) {
    try {
      const result = await window.api.mcp.requestTool(
        'desktop-commander',
        'read_file',
        { path: `${workingDir}/${configFile}`, length: 500 }, // Limit to ~500 lines
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
 * Build a context string for the AI
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
    lines.push(`**Entry Points:** ${context.entryPoints.join(', ')}`)
  }
  
  if (context.hasTests) {
    lines.push(`**Test Directories:** ${context.testDirectories.join(', ')}`)
  }
  
  lines.push('')
  
  // Add config file contents
  for (const [file, content] of Object.entries(configs)) {
    if (content.length > 0) {
      lines.push(`### ${file}`)
      lines.push('```json')
      // Truncate large configs
      const truncated = content.length > 2000 
        ? content.substring(0, 2000) + '\n... (truncated)'
        : content
      lines.push(truncated)
      lines.push('```')
      lines.push('')
    }
  }
  
  return lines.join('\n')
}
```

### Step 2: Create File Relevance Scorer

**File:** `src/renderer/src/lib/fileRelevance.ts`

```typescript
// src/renderer/src/lib/fileRelevance.ts
// Smart file selection for context building

export interface FileScore {
  path: string
  score: number
  reason: string
}

/**
 * Score files by relevance to a task
 */
export function scoreFileRelevance(
  files: string[],
  taskDescription: string,
  projectContext: { sourceDirectories: string[]; testDirectories: string[] }
): FileScore[] {
  const taskLower = taskDescription.toLowerCase()
  const scores: FileScore[] = []
  
  for (const file of files) {
    let score = 0
    const reasons: string[] = []
    
    // Extract file name and extension
    const fileName = file.split('/').pop() || file
    const ext = fileName.split('.').pop() || ''
    
    // Source file bonus
    if (projectContext.sourceDirectories.some(d => file.startsWith(d))) {
      score += 20
      reasons.push('source directory')
    }
    
    // Test file - lower priority unless task is about tests
    if (projectContext.testDirectories.some(d => file.includes(d))) {
      if (taskLower.includes('test')) {
        score += 30
        reasons.push('test file (task related)')
      } else {
        score -= 10
        reasons.push('test file')
      }
    }
    
    // Config files - context important
    if (['json', 'yaml', 'yml', 'toml'].includes(ext) && 
        ['config', 'tsconfig', 'package', 'eslint'].some(c => fileName.includes(c))) {
      score += 15
      reasons.push('config file')
    }
    
    // Entry points
    if (['index', 'main', 'app', 'App'].some(e => fileName.startsWith(e))) {
      score += 25
      reasons.push('entry point')
    }
    
    // TypeScript/JavaScript source
    if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
      score += 10
      reasons.push('source code')
    }
    
    // Keyword matching with task
    const keywords = extractKeywords(taskDescription)
    for (const keyword of keywords) {
      if (file.toLowerCase().includes(keyword.toLowerCase())) {
        score += 30
        reasons.push(`matches keyword: ${keyword}`)
      }
    }
    
    // Recent modification bonus would go here (if we had timestamps)
    
    // Depth penalty - deeper files are less relevant
    const depth = file.split('/').length
    score -= Math.max(0, (depth - 3) * 5)
    
    scores.push({
      path: file,
      score: Math.max(0, score),
      reason: reasons.join(', ')
    })
  }
  
  // Sort by score descending
  return scores.sort((a, b) => b.score - a.score)
}

/**
 * Extract keywords from task description
 */
function extractKeywords(text: string): string[] {
  // Remove common words and extract meaningful terms
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'we',
    'please', 'help', 'me', 'my', 'need', 'want', 'create', 'make', 'add'
  ])
  
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
  
  // Return unique keywords
  return [...new Set(words)]
}

/**
 * Select files for context based on relevance and token budget
 */
export async function selectFilesForContext(
  workingDir: string,
  taskDescription: string,
  maxTokens: number = 50000
): Promise<string[]> {
  // Get file list
  const result = await window.api.mcp.requestTool(
    'desktop-commander',
    'list_directory',
    { path: workingDir, depth: 3 },
    'Listing files for context selection'
  )
  
  if (!result.success) return []
  
  // Parse file list
  const lines = String(result.result).split('\n')
  const files = lines
    .filter(l => l.includes('[FILE]'))
    .map(l => l.replace(/^\[FILE\]\s*/, '').trim())
    .filter(f => !f.includes('node_modules') && !f.includes('.git'))
  
  // Score files
  const scored = scoreFileRelevance(files, taskDescription, {
    sourceDirectories: ['src', 'lib', 'app'],
    testDirectories: ['test', 'tests', '__tests__']
  })
  
  // Select files within token budget
  const selected: string[] = []
  let estimatedTokens = 0
  const tokensPerFile = 500 // Rough estimate per file
  
  for (const file of scored) {
    if (estimatedTokens + tokensPerFile > maxTokens) break
    if (file.score > 0) {
      selected.push(file.path)
      estimatedTokens += tokensPerFile
    }
  }
  
  return selected
}
```

### Step 3: Enhance Agent Creation with Project Context

**File:** `src/renderer/src/contexts/AgentContext.tsx`

Add project context to agent creation:

```typescript
// Add to CreateAgentOptions interface:
export interface CreateAgentOptions {
  // ... existing fields ...
  autoAnalyzeProject?: boolean
  projectContext?: ProjectContext
}

// Update createAgent function:
const createAgent = useCallback(async (options: CreateAgentOptions): Promise<Agent> => {
  const agentId = `agent-${Date.now()}`
  
  // Auto-analyze project if requested
  let projectContextPrompt = ''
  if (options.autoAnalyzeProject && options.workingDirectory) {
    try {
      console.log('[AgentContext] Analyzing project structure...')
      const projectContext = await analyzeProject(options.workingDirectory)
      const configs = await readProjectConfigs(options.workingDirectory, projectContext)
      projectContextPrompt = buildProjectContextPrompt(projectContext, configs)
      console.log('[AgentContext] Project context built:', projectContext.type)
    } catch (error) {
      console.warn('[AgentContext] Project analysis failed:', error)
    }
  }
  
  // Build system prompt with project context
  let systemPrompt = options.personaContent || DEFAULT_AGENT_SYSTEM_PROMPT
  
  if (projectContextPrompt) {
    systemPrompt = `${systemPrompt}

${projectContextPrompt}`
  }
  
  // Add tool instructions
  const mcpSystemPrompt = await window.api.mcp.getSystemPrompt()
  systemPrompt = `${systemPrompt}

${mcpSystemPrompt}`
  
  // ... rest of agent creation
}, [])
```

### Step 4: Implement Checkpoint Restoration

**File:** `src/renderer/src/hooks/useCheckpointRestore.ts`

```typescript
// src/renderer/src/hooks/useCheckpointRestore.ts
// Checkpoint restoration for session resumption

import { useCallback } from 'react'
import { useWorkJournal } from './useWorkJournal'
import type { Agent, AgentMessage } from '../types/agent'

export interface CheckpointData {
  sessionId: string
  checkpointId: string
  timestamp: number
  agentState: {
    messagesCount: number
    stepsCount: number
    lastToolCalls: string[]
    pendingWork: string[]
  }
  resumptionContext: string
}

export interface UseCheckpointRestoreResult {
  getAvailableCheckpoints: (conversationId: string) => Promise<CheckpointData[]>
  restoreFromCheckpoint: (checkpointId: string) => Promise<{
    messages: AgentMessage[]
    systemPromptAddition: string
    resumptionGuidance: string
  }>
  generateResumptionContext: (agent: Agent) => Promise<string>
}

export function useCheckpointRestore(): UseCheckpointRestoreResult {
  const { getSessionCheckpoints, getCheckpointEntries, generateResumptionPrompt } = useWorkJournal()

  /**
   * Get available checkpoints for a conversation
   */
  const getAvailableCheckpoints = useCallback(async (
    conversationId: string
  ): Promise<CheckpointData[]> => {
    try {
      const checkpoints = await getSessionCheckpoints(conversationId)
      return checkpoints.map(cp => ({
        sessionId: cp.sessionId,
        checkpointId: cp.id,
        timestamp: cp.timestamp,
        agentState: {
          messagesCount: cp.messageCount || 0,
          stepsCount: cp.stepCount || 0,
          lastToolCalls: cp.recentTools || [],
          pendingWork: cp.pendingWork || []
        },
        resumptionContext: cp.context || ''
      }))
    } catch (error) {
      console.error('[CheckpointRestore] Failed to get checkpoints:', error)
      return []
    }
  }, [getSessionCheckpoints])

  /**
   * Restore agent state from a checkpoint
   */
  const restoreFromCheckpoint = useCallback(async (
    checkpointId: string
  ): Promise<{
    messages: AgentMessage[]
    systemPromptAddition: string
    resumptionGuidance: string
  }> => {
    try {
      // Get checkpoint entries
      const entries = await getCheckpointEntries(checkpointId)
      
      // Reconstruct messages from entries
      const messages: AgentMessage[] = []
      let lastAssistantContent = ''
      
      for (const entry of entries) {
        if (entry.type === 'thinking' || entry.type === 'response') {
          // Accumulate assistant content
          lastAssistantContent += entry.content + '\n'
        } else if (entry.type === 'tool_request' || entry.type === 'tool_result') {
          // Tool calls are part of assistant messages
          if (entry.type === 'tool_result' && lastAssistantContent) {
            messages.push({
              id: `restored-${entry.id}`,
              role: 'assistant',
              content: lastAssistantContent.trim(),
              timestamp: new Date(entry.timestamp).toISOString()
            })
            lastAssistantContent = ''
          }
          
          // Add tool result as user message
          if (entry.type === 'tool_result') {
            messages.push({
              id: `tool-${entry.id}`,
              role: 'user',
              content: `Tool result for ${entry.toolName}:\n${entry.content}`,
              timestamp: new Date(entry.timestamp).toISOString()
            })
          }
        }
      }
      
      // Generate resumption prompt
      const resumptionPrompt = await generateResumptionPrompt(checkpointId)
      
      return {
        messages,
        systemPromptAddition: `
## Session Resumption

You are resuming a previous work session. The checkpoint was created at ${new Date().toISOString()}.
Review the conversation history to understand what was accomplished and what remains to be done.
`,
        resumptionGuidance: resumptionPrompt
      }
    } catch (error) {
      console.error('[CheckpointRestore] Failed to restore checkpoint:', error)
      throw error
    }
  }, [getCheckpointEntries, generateResumptionPrompt])

  /**
   * Generate resumption context for current agent state
   */
  const generateResumptionContext = useCallback(async (agent: Agent): Promise<string> => {
    const recentSteps = agent.steps.slice(-10)
    const recentTools = recentSteps
      .filter(s => s.type === 'tool_call' && s.toolCall)
      .map(s => s.toolCall!.name)
    
    const pendingWork: string[] = []
    
    // Check for incomplete operations
    const lastStep = agent.steps[agent.steps.length - 1]
    if (lastStep?.type === 'tool_call' && lastStep.toolCall?.status === 'pending') {
      pendingWork.push(`Pending tool call: ${lastStep.toolCall.name}`)
    }
    
    // Check for error recovery
    const errorSteps = recentSteps.filter(s => s.type === 'error')
    if (errorSteps.length > 0) {
      pendingWork.push(`Recent errors to address: ${errorSteps.length}`)
    }
    
    return `
## Resumption Context

### Recent Activity
- Tools used: ${recentTools.join(', ') || 'None'}
- Steps completed: ${agent.stepsCompleted}
- Status: ${agent.status}

### Pending Work
${pendingWork.length > 0 ? pendingWork.map(w => `- ${w}`).join('\n') : '- No pending work'}

### Instructions
Please review the conversation history and continue from where you left off.
If there were errors, try to resolve them before proceeding.
`
  }, [])

  return {
    getAvailableCheckpoints,
    restoreFromCheckpoint,
    generateResumptionContext
  }
}
```

### Step 5: Add Multi-File Orchestration

**File:** `src/renderer/src/lib/multiFileOrchestrator.ts`

```typescript
// src/renderer/src/lib/multiFileOrchestrator.ts
// Orchestrates complex multi-file operations

export interface FileOperation {
  type: 'create' | 'modify' | 'delete' | 'rename'
  path: string
  content?: string
  newPath?: string // For rename
  dependencies?: string[] // Files that must be processed first
}

export interface OrchestrationPlan {
  operations: FileOperation[]
  order: string[] // Execution order (paths)
  estimatedDuration: number
  risks: string[]
}

/**
 * Create an execution plan for multi-file operations
 */
export function createOrchestrationPlan(
  operations: FileOperation[]
): OrchestrationPlan {
  const risks: string[] = []
  
  // Build dependency graph
  const graph = new Map<string, Set<string>>()
  for (const op of operations) {
    graph.set(op.path, new Set(op.dependencies || []))
  }
  
  // Topological sort for execution order
  const order: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  
  function visit(path: string): void {
    if (visited.has(path)) return
    if (visiting.has(path)) {
      risks.push(`Circular dependency detected involving ${path}`)
      return
    }
    
    visiting.add(path)
    const deps = graph.get(path) || new Set()
    for (const dep of deps) {
      visit(dep)
    }
    visiting.delete(path)
    visited.add(path)
    order.push(path)
  }
  
  for (const op of operations) {
    visit(op.path)
  }
  
  // Calculate estimated duration
  const estimatedDuration = operations.reduce((sum, op) => {
    switch (op.type) {
      case 'create': return sum + 2000
      case 'modify': return sum + 1500
      case 'delete': return sum + 500
      case 'rename': return sum + 1000
      default: return sum + 1000
    }
  }, 0)
  
  // Identify risks
  if (operations.some(op => op.type === 'delete')) {
    risks.push('Plan includes file deletions - ensure backups exist')
  }
  
  const modifyCount = operations.filter(op => op.type === 'modify').length
  if (modifyCount > 10) {
    risks.push(`Large refactoring: ${modifyCount} files to modify`)
  }
  
  return {
    operations,
    order,
    estimatedDuration,
    risks
  }
}

/**
 * Execute an orchestration plan
 */
export async function executePlan(
  plan: OrchestrationPlan,
  onProgress: (completed: number, total: number, current: string) => void,
  onError: (path: string, error: string) => void
): Promise<{
  success: boolean
  completed: string[]
  failed: string[]
}> {
  const completed: string[] = []
  const failed: string[] = []
  
  for (let i = 0; i < plan.order.length; i++) {
    const path = plan.order[i]
    const operation = plan.operations.find(op => op.path === path)
    
    if (!operation) continue
    
    onProgress(i, plan.order.length, path)
    
    try {
      switch (operation.type) {
        case 'create':
        case 'modify':
          await window.api.mcp.requestTool(
            'desktop-commander',
            'write_file',
            { path: operation.path, content: operation.content || '' },
            `${operation.type === 'create' ? 'Creating' : 'Modifying'} ${path}`
          )
          break
          
        case 'delete':
          // Note: Desktop Commander doesn't have a delete tool by default
          // This would need to be implemented or use a shell command
          console.warn('[Orchestrator] Delete not implemented:', path)
          break
          
        case 'rename':
          await window.api.mcp.requestTool(
            'desktop-commander',
            'move_file',
            { source: operation.path, destination: operation.newPath },
            `Renaming ${path} to ${operation.newPath}`
          )
          break
      }
      
      completed.push(path)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      onError(path, errorMsg)
      failed.push(path)
    }
  }
  
  return {
    success: failed.length === 0,
    completed,
    failed
  }
}
```

---

## Integration with Agent Templates

Update the agent templates to use new capabilities:

**File:** `src/renderer/src/data/agentTemplates.ts`

Add new options to templates:

```typescript
// Add to AgentTemplate interface:
export interface AgentTemplate {
  // ... existing fields ...
  autoAnalyzeProject?: boolean
  contextTokenBudget?: number
  enableMultiFileOrchestration?: boolean
}

// Update Feature Implementation template:
{
  id: 'template-feature-implementation',
  name: 'Feature Implementation',
  description: 'Build a new feature from requirements',
  icon: 'Sparkles',
  category: 'development',
  instructions: `...`, // existing
  toolPermission: 'autonomous',
  tags: ['feature', 'implement', 'build'],
  isBuiltIn: true,
  requiresDirectory: true,
  autoAnalyzeProject: true,        // NEW
  contextTokenBudget: 75000,       // NEW
  enableMultiFileOrchestration: true  // NEW
}
```

---

## Verification Checklist

After implementing all steps, verify:

- [ ] Run `npm run typecheck` - No TypeScript errors
- [ ] Project analysis correctly detects Node/TypeScript projects
- [ ] Config files are read and included in context
- [ ] File relevance scoring prioritizes task-related files
- [ ] Checkpoint restoration loads previous state correctly
- [ ] Multi-file orchestration respects dependencies
- [ ] Agent templates use new capabilities when enabled

---

## Testing Scenarios

1. **Project Analysis Test**
   - Launch agent on ArborChat project
   - Verify package.json, tsconfig.json detected
   - Verify framework detected as 'electron'

2. **File Relevance Test**
   - Create task "fix the MCP provider connection"
   - Verify files in `/src/main/mcp/` score highest
   - Verify node_modules excluded

3. **Checkpoint Test**
   - Start agent, let it work partway
   - Stop/crash agent
   - Resume from checkpoint
   - Verify context is preserved

4. **Multi-File Refactoring Test**
   - Create agent to rename a component
   - Verify import updates planned
   - Verify execution order correct

---

## Future Enhancements

After Phase 4, consider:

1. **AST-Based Refactoring** - Use TypeScript AST for safer code modifications
2. **Git Branch Workflow** - Auto-create branches for agent work
3. **Diff Preview** - Show proposed changes before applying
4. **Rollback Support** - Undo agent changes via git reset
5. **Collaborative Agents** - Multiple agents working on different parts

---

## Summary

Phase 4 adds the advanced capabilities needed for complex coding tasks:

| Capability | Benefit |
|-----------|---------|
| Project Context | Agent understands project structure from the start |
| Smart File Selection | Relevant files prioritized in context |
| Checkpoint Restoration | Resume interrupted work seamlessly |
| Multi-File Orchestration | Handle complex refactoring safely |

These features together enable ArborChat to handle enterprise-scale coding tasks with proper context awareness and reliability.
