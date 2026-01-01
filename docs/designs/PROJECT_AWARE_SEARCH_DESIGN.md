# Project-Aware Search Optimization Design

**Author:** Alex Chen (Distinguished Software Architect)  
**Phase:** Agent Search Efficiency Enhancement  
**Status:** Design Draft  
**Date:** January 2026

## Problem Statement

When agents attempt to implement features by referencing existing code patterns, they fall into inefficient search loops:

1. **Broad `list_directory` operations** - Taking 42+ seconds to crawl entire project trees
2. **Iterative search anti-patterns** - Multiple sequential searches instead of targeted queries
3. **Missing project context** - Agent doesn't know the codebase structure upfront

### Observed Failure Mode (from screenshot)

```
Agent trying to find "/persona" command implementation:
- Executes list_directory (42+ seconds, still running)
- No file pattern filtering
- No understanding of where slash commands live
- Cascading tool calls with no early termination
```

### Optimal Behavior

```
Agent receives project context upfront:
- Knows "slash commands" → src/renderer/src/hooks/useSlashCommands.ts
- Uses content search with filePattern="*.ts|*.tsx"
- Finds code in <5 seconds
```

---

## Solution Architecture

### Overview

Inject **Project Intelligence Context** into agent system prompts when a `workingDirectory` is set. This context includes:

1. **Project Structure Map** - Key directories and their purposes
2. **Code Pattern Index** - Where common patterns/features live
3. **Search Strategy Hints** - Efficient tool usage guidance
4. **Git Context** - Branch, uncommitted files, scope

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Agent Creation Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CreateAgentOptions                                             │
│  ├── workingDirectory: "/Users/cory/ArborChat"                  │
│  └── autoAnalyzeProject: true                                   │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────────────────────────┐                    │
│  │     ProjectAnalyzer (Main Process)       │                    │
│  │                                         │                    │
│  │  1. Detect project type (git, npm, etc) │                    │
│  │  2. Parse structure markers             │                    │
│  │  3. Index key files                     │                    │
│  │  4. Build navigation hints              │                    │
│  └─────────────────────────────────────────┘                    │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────────────────────────┐                    │
│  │     ProjectContext (Injected to Prompt)  │                    │
│  │                                         │                    │
│  │  - Project map (key paths)              │                    │
│  │  - Search strategy hints                │                    │
│  │  - Pattern location index               │                    │
│  │  - Git context                          │                    │
│  └─────────────────────────────────────────┘                    │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────────────────────────┐                    │
│  │        Agent System Prompt               │                    │
│  │                                         │                    │
│  │  Base Prompt                            │                    │
│  │  + Memory Context                       │                    │
│  │  + Project Intelligence Context  ◄─────│────── NEW          │
│  │  + MCP Tool Instructions                │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### ProjectIntelligence Interface

```typescript
// src/main/projectAnalyzer/types.ts

/**
 * Project type detection result
 */
export type ProjectType = 
  | 'electron'      // Electron app (detected via electron in deps)
  | 'react'         // React app
  | 'node'          // Node.js project
  | 'typescript'    // TypeScript project
  | 'python'        // Python project
  | 'rust'          // Rust project
  | 'unknown'

/**
 * Structural marker - indicates purpose of a directory/file pattern
 */
export interface StructuralMarker {
  path: string           // Relative path from project root
  type: 'directory' | 'file' | 'pattern'
  purpose: string        // Human-readable purpose description
  searchHint?: string    // What kinds of code to find here
}

/**
 * Code pattern index entry - where specific patterns live
 */
export interface CodePatternEntry {
  pattern: string        // Pattern name (e.g., "slash commands", "IPC handlers")
  location: string       // File or directory path
  searchTerms: string[]  // Terms to search for this pattern
}

/**
 * Search strategy hint for agents
 */
export interface SearchStrategyHint {
  scenario: string       // When to apply this strategy
  strategy: string       // What to do
  example?: string       // Example tool call
}

/**
 * Complete project intelligence context
 */
export interface ProjectIntelligence {
  projectRoot: string
  projectName: string
  projectType: ProjectType
  
  // Git information (if applicable)
  git?: {
    isRepo: boolean
    currentBranch?: string
    hasUncommittedChanges: boolean
    uncommittedFiles?: string[]
  }
  
  // Structural understanding
  structuralMarkers: StructuralMarker[]
  
  // Pattern index
  codePatterns: CodePatternEntry[]
  
  // Search guidance
  searchStrategies: SearchStrategyHint[]
  
  // Key files for quick reference
  keyFiles: {
    path: string
    description: string
  }[]
  
  // Analysis metadata
  analyzedAt: number
  tokenEstimate: number  // Estimated tokens this context will use
}
```

---

## Implementation Phases

### Phase 1: Project Analyzer Service (Main Process)

**File:** `src/main/projectAnalyzer/index.ts`

```typescript
/**
 * ProjectAnalyzer Service
 * 
 * Analyzes project structure and generates intelligence context
 * for agent system prompts.
 * 
 * Security: Read-only file system access within specified directory
 */

import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import type { ProjectIntelligence, ProjectType, StructuralMarker } from './types'

export class ProjectAnalyzer {
  
  /**
   * Analyze a project directory and generate intelligence context
   */
  async analyze(projectRoot: string): Promise<ProjectIntelligence> {
    const startTime = Date.now()
    
    // Validate path is within allowed scope
    this.validatePath(projectRoot)
    
    // Detect project type
    const projectType = await this.detectProjectType(projectRoot)
    
    // Get git context
    const git = await this.analyzeGitContext(projectRoot)
    
    // Build structural markers based on project type
    const structuralMarkers = await this.buildStructuralMarkers(projectRoot, projectType)
    
    // Index code patterns
    const codePatterns = await this.indexCodePatterns(projectRoot, projectType)
    
    // Generate search strategies
    const searchStrategies = this.generateSearchStrategies(projectType)
    
    // Identify key files
    const keyFiles = await this.identifyKeyFiles(projectRoot, projectType)
    
    const intelligence: ProjectIntelligence = {
      projectRoot,
      projectName: path.basename(projectRoot),
      projectType,
      git,
      structuralMarkers,
      codePatterns,
      searchStrategies,
      keyFiles,
      analyzedAt: Date.now(),
      tokenEstimate: 0 // Calculated below
    }
    
    // Estimate tokens
    intelligence.tokenEstimate = this.estimateTokens(intelligence)
    
    console.log(`[ProjectAnalyzer] Analyzed ${projectRoot} in ${Date.now() - startTime}ms`)
    
    return intelligence
  }
  
  /**
   * Detect project type from markers
   */
  private async detectProjectType(root: string): Promise<ProjectType> {
    const markers = [
      { file: 'package.json', check: async (p: string) => {
        const pkg = JSON.parse(await fs.readFile(p, 'utf-8'))
        if (pkg.devDependencies?.electron || pkg.dependencies?.electron) return 'electron'
        if (pkg.dependencies?.react || pkg.devDependencies?.react) return 'react'
        return 'node'
      }},
      { file: 'tsconfig.json', type: 'typescript' as ProjectType },
      { file: 'Cargo.toml', type: 'rust' as ProjectType },
      { file: 'pyproject.toml', type: 'python' as ProjectType },
      { file: 'requirements.txt', type: 'python' as ProjectType },
    ]
    
    for (const marker of markers) {
      const markerPath = path.join(root, marker.file)
      try {
        await fs.access(markerPath)
        if (marker.check) {
          return await marker.check(markerPath)
        }
        return marker.type!
      } catch {
        // Continue to next marker
      }
    }
    
    return 'unknown'
  }
  
  // ... additional methods
}
```

### Phase 2: Electron Project Pattern Index

For Electron projects like ArborChat, generate specific pattern mappings:

```typescript
/**
 * Generate code pattern index for Electron projects
 */
private async indexElectronPatterns(root: string): Promise<CodePatternEntry[]> {
  const patterns: CodePatternEntry[] = [
    {
      pattern: 'slash commands',
      location: 'src/renderer/src/hooks/useSlashCommands.ts',
      searchTerms: ['SlashCommand', '/persona', '/commit', 'handleInputChange']
    },
    {
      pattern: 'IPC handlers',
      location: 'src/main/',
      searchTerms: ['ipcMain.handle', 'ipcMain.on']
    },
    {
      pattern: 'preload APIs',
      location: 'src/preload/index.ts',
      searchTerms: ['contextBridge.exposeInMainWorld', 'ipcRenderer.invoke']
    },
    {
      pattern: 'React components',
      location: 'src/renderer/src/components/',
      searchTerms: ['export function', 'export const', 'React.FC']
    },
    {
      pattern: 'React hooks',
      location: 'src/renderer/src/hooks/',
      searchTerms: ['export function use', 'useState', 'useCallback']
    },
    {
      pattern: 'Context providers',
      location: 'src/renderer/src/contexts/',
      searchTerms: ['createContext', 'useContext', 'Provider']
    },
    {
      pattern: 'MCP components',
      location: 'src/renderer/src/components/mcp/',
      searchTerms: ['Tool', 'MCP', 'ToolApproval', 'ToolResult']
    },
    {
      pattern: 'type definitions',
      location: 'src/renderer/src/types/',
      searchTerms: ['interface', 'type', 'export interface']
    },
    {
      pattern: 'agent system',
      location: 'src/renderer/src/contexts/AgentContext.tsx',
      searchTerms: ['Agent', 'AgentState', 'useAgent']
    },
    {
      pattern: 'database/storage',
      location: 'src/main/db/',
      searchTerms: ['better-sqlite3', 'getDb', 'createTable']
    }
  ]
  
  // Verify paths exist and filter
  const verified: CodePatternEntry[] = []
  for (const pattern of patterns) {
    const fullPath = path.join(root, pattern.location)
    try {
      await fs.access(fullPath)
      verified.push(pattern)
    } catch {
      // Skip patterns with missing paths
    }
  }
  
  return verified
}
```

### Phase 3: Search Strategy Generation

```typescript
/**
 * Generate search strategy hints for agents
 */
private generateSearchStrategies(projectType: ProjectType): SearchStrategyHint[] {
  const common: SearchStrategyHint[] = [
    {
      scenario: 'Finding code that implements a specific feature',
      strategy: 'Use content search with pattern matching, NOT list_directory. Filter by file extension.',
      example: 'start_search({ searchType: "content", pattern: "featureName", filePattern: "*.ts|*.tsx", path: "/project/src" })'
    },
    {
      scenario: 'Finding where a function/component is defined',
      strategy: 'Search for "export function Name" or "export const Name" in source directories.',
      example: 'start_search({ searchType: "content", pattern: "export.*ComponentName", path: "/project/src" })'
    },
    {
      scenario: 'Finding all usages of a function/type',
      strategy: 'Search for import statements or direct usage in source files.',
      example: 'start_search({ searchType: "content", pattern: "FunctionName", filePattern: "*.ts|*.tsx" })'
    },
    {
      scenario: 'Understanding project structure',
      strategy: 'Use list_directory with depth=2 on specific directories, not the entire project.',
      example: 'list_directory({ path: "/project/src/components", depth: 2 })'
    }
  ]
  
  const electronSpecific: SearchStrategyHint[] = [
    {
      scenario: 'Adding a new IPC handler',
      strategy: 'Look at existing handlers in src/main/, then add preload API in src/preload/index.ts',
      example: 'Read src/main/index.ts to see handler setup pattern'
    },
    {
      scenario: 'Adding a new slash command',
      strategy: 'Modify useSlashCommands.ts - add to baseCommands array and executeCommand switch',
      example: 'Direct path: src/renderer/src/hooks/useSlashCommands.ts'
    },
    {
      scenario: 'Creating a new React component',
      strategy: 'Create in src/renderer/src/components/, export from index.ts, use Tailwind for styling',
      example: 'Copy pattern from existing component in same directory'
    }
  ]
  
  if (projectType === 'electron') {
    return [...common, ...electronSpecific]
  }
  
  return common
}
```

### Phase 4: Prompt Injection

**File:** `src/main/mcp/prompts.ts` (enhanced)

```typescript
/**
 * Generate project intelligence context for injection into agent prompts
 */
export function generateProjectIntelligencePrompt(intelligence: ProjectIntelligence): string {
  if (!intelligence) return ''
  
  const sections: string[] = []
  
  // Header
  sections.push(`## Project Context: ${intelligence.projectName}

**Project Root:** \`${intelligence.projectRoot}\`
**Project Type:** ${intelligence.projectType}
${intelligence.git?.isRepo ? `**Git Branch:** ${intelligence.git.currentBranch}
**Uncommitted Changes:** ${intelligence.git.hasUncommittedChanges ? 'Yes' : 'No'}` : ''}

> ⚡ **EFFICIENCY RULE:** Use targeted content search instead of broad list_directory operations.
> Always filter by file extension (*.ts|*.tsx) and narrow the search path.`)

  // Key Locations
  if (intelligence.keyFiles.length > 0) {
    sections.push(`### Key Files

${intelligence.keyFiles.map(f => `- \`${f.path}\` - ${f.description}`).join('\n')}`)
  }
  
  // Code Pattern Index
  if (intelligence.codePatterns.length > 0) {
    sections.push(`### Code Pattern Locations

| Pattern | Location | Search Terms |
|---------|----------|--------------|
${intelligence.codePatterns.map(p => 
  `| ${p.pattern} | \`${p.location}\` | ${p.searchTerms.slice(0, 2).join(', ')} |`
).join('\n')}`)
  }
  
  // Search Strategies
  if (intelligence.searchStrategies.length > 0) {
    sections.push(`### Search Strategies

${intelligence.searchStrategies.map(s => 
  `**${s.scenario}:**
${s.strategy}${s.example ? `
\`\`\`
${s.example}
\`\`\`` : ''}`
).join('\n\n')}`)
  }
  
  // Structure Map
  if (intelligence.structuralMarkers.length > 0) {
    sections.push(`### Project Structure Map

${intelligence.structuralMarkers.map(m => 
  `- \`${m.path}/\` - ${m.purpose}${m.searchHint ? ` (search: ${m.searchHint})` : ''}`
).join('\n')}`)
  }
  
  return sections.join('\n\n')
}
```

### Phase 5: Integration with Agent Creation

**File:** `src/renderer/src/contexts/AgentContext.tsx` (enhanced createAgent)

```typescript
const createAgent = useCallback(
  async (options: CreateAgentOptions): Promise<string> => {
    // ... existing setup code ...
    
    // Phase: Project Intelligence Analysis
    let projectIntelligence: ProjectIntelligence | null = null
    
    if (options.workingDirectory && options.autoAnalyzeProject !== false) {
      try {
        projectIntelligence = await window.api.projectAnalyzer.analyze(options.workingDirectory)
        console.log(`[AgentContext] Project analysis complete: ${projectIntelligence.tokenEstimate} tokens`)
      } catch (error) {
        console.warn('[AgentContext] Project analysis failed:', error)
      }
    }
    
    // Build enhanced system prompt
    let systemPrompt = buildBaseSystemPrompt(options)
    
    if (projectIntelligence) {
      const projectContext = generateProjectIntelligencePrompt(projectIntelligence)
      systemPrompt = `${systemPrompt}\n\n${projectContext}`
    }
    
    // ... continue with agent creation ...
  },
  [/* dependencies */]
)
```

---

## Expected Prompt Output Example

For ArborChat with `workingDirectory: /Users/cory.naegle/ArborChat`:

```markdown
## Project Context: ArborChat

**Project Root:** `/Users/cory.naegle/ArborChat`
**Project Type:** electron
**Git Branch:** main
**Uncommitted Changes:** No

> ⚡ **EFFICIENCY RULE:** Use targeted content search instead of broad list_directory operations.
> Always filter by file extension (*.ts|*.tsx) and narrow the search path.

### Key Files

- `src/renderer/src/hooks/useSlashCommands.ts` - Slash command definitions and handlers
- `src/main/index.ts` - Main process entry, IPC handler setup
- `src/preload/index.ts` - Preload APIs exposed to renderer
- `src/renderer/src/contexts/AgentContext.tsx` - Agent state management

### Code Pattern Locations

| Pattern | Location | Search Terms |
|---------|----------|--------------|
| slash commands | `src/renderer/src/hooks/useSlashCommands.ts` | SlashCommand, /persona |
| IPC handlers | `src/main/` | ipcMain.handle, ipcMain.on |
| React hooks | `src/renderer/src/hooks/` | export function use, useState |
| MCP components | `src/renderer/src/components/mcp/` | Tool, ToolApproval |

### Search Strategies

**Adding a new slash command:**
Modify useSlashCommands.ts - add to baseCommands array and executeCommand switch
```
Direct path: src/renderer/src/hooks/useSlashCommands.ts
```

**Finding code that implements a specific feature:**
Use content search with pattern matching, NOT list_directory. Filter by file extension.
```
start_search({ searchType: "content", pattern: "featureName", filePattern: "*.ts|*.tsx", path: "/Users/cory.naegle/ArborChat/src" })
```

### Project Structure Map

- `src/main/` - Main process code, IPC handlers, services (search: ipcMain)
- `src/renderer/src/` - React application, components, hooks (search: React)
- `src/preload/` - Preload scripts, API bridge (search: contextBridge)
- `src/renderer/src/components/mcp/` - MCP tool UI components
```

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/main/projectAnalyzer/index.ts` | ProjectAnalyzer service class |
| `src/main/projectAnalyzer/types.ts` | TypeScript interfaces |
| `src/main/projectAnalyzer/patterns/electron.ts` | Electron-specific pattern detection |
| `src/main/projectAnalyzer/patterns/react.ts` | React-specific pattern detection |
| `src/main/projectAnalyzer/patterns/node.ts` | Node.js-specific pattern detection |

### Modified Files

| File | Changes |
|------|---------|
| `src/main/mcp/prompts.ts` | Add `generateProjectIntelligencePrompt()` |
| `src/main/index.ts` | Setup projectAnalyzer IPC handlers |
| `src/preload/index.ts` | Expose `projectAnalyzer.analyze()` API |
| `src/renderer/src/contexts/AgentContext.tsx` | Integrate analysis into agent creation |
| `src/renderer/src/hooks/useToolChat.ts` | Update `buildSystemPrompt()` to include project context |

---

## Performance Considerations

1. **Analysis Caching** - Cache project intelligence with file modification timestamps
2. **Token Budget** - Limit project context to ~2000 tokens (configurable)
3. **Lazy Analysis** - Only analyze when `autoAnalyzeProject: true`
4. **Incremental Updates** - Re-analyze only changed directories on git operations

---

## Security Considerations

1. **Path Validation** - Ensure analyzed paths are within allowed directories
2. **No Code Execution** - Analysis is read-only file system inspection
3. **Token Limits** - Prevent context injection attacks via massive project structures
4. **Git Scope** - Respect configured git scope (uncommitted only, branch diff, etc.)

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Time to find existing code pattern | 42+ seconds | <5 seconds |
| Tool calls to locate implementation | 5-10 | 1-2 |
| Agent stall rate on code search | High | Minimal |
| Context relevance for code tasks | Low | High |

---

## Implementation Order

1. **Phase 1:** Create `ProjectAnalyzer` service with basic structure detection
2. **Phase 2:** Add Electron-specific pattern indexing (covers ArborChat)
3. **Phase 3:** Implement prompt generation and injection
4. **Phase 4:** Add IPC handlers and preload API
5. **Phase 5:** Integrate with `AgentContext` and `useToolChat`
6. **Phase 6:** Add caching layer for performance
7. **Phase 7:** Extend to other project types (React, Node, Python)

---

## Appendix: ArborChat-Specific Pattern Map

For immediate use, here's a hardcoded pattern map for ArborChat that can be injected into agent prompts until the full analyzer is built:

```typescript
const ARBORCHAT_PATTERNS = `
## ArborChat Codebase Quick Reference

When working on ArborChat (/Users/cory.naegle/ArborChat):

### ALWAYS use content search, NEVER broad list_directory

**Slash Commands:** \`src/renderer/src/hooks/useSlashCommands.ts\`
**IPC Handlers:** \`src/main/\` (search for ipcMain.handle)
**Preload APIs:** \`src/preload/index.ts\`
**React Components:** \`src/renderer/src/components/\`
**React Hooks:** \`src/renderer/src/hooks/\`
**Context Providers:** \`src/renderer/src/contexts/\`
**MCP Components:** \`src/renderer/src/components/mcp/\`
**Type Definitions:** \`src/renderer/src/types/\`
**Agent System:** \`src/renderer/src/contexts/AgentContext.tsx\`
**Database:** \`src/main/db/\`

### Efficient Search Pattern
\`\`\`
start_search({
  searchType: "content",
  pattern: "<search term>",
  path: "/Users/cory.naegle/ArborChat/src",
  filePattern: "*.ts|*.tsx"
})
\`\`\`
`
```
