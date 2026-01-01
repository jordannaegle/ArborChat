# MCP Component Refinements Implementation Prompt

## Overview

This prompt implements three architectural improvements to the MCP components identified during code review. The changes maintain backward compatibility while improving memory management, reducing code duplication, and enhancing extensibility.

**Author:** Alex Chen (Distinguished Software Architect)  
**Priority:** P2 - Quality Improvement  
**Estimated Effort:** 4-6 hours  

## Prerequisites

- ArborChat development environment configured
- Familiarity with `/src/renderer/src/components/mcp/` directory structure
- Understanding of React hooks and memoization patterns

---

## Phase 1: Memory Leak Fix in VirtualizedStepList

**Effort:** Low  
**Risk:** Low  
**Files Modified:** 1

### Problem Statement

The `VirtualizedStepList` component maintains a `measuredHeights` ref that maps step IDs to their rendered heights. When steps are removed from the list, their entries in this map are never cleaned up, causing unbounded memory growth in long-running agent sessions.

### Implementation

**File:** `src/renderer/src/components/mcp/VirtualizedStepList.tsx`

#### Step 1.1: Add Cleanup Effect

Locate the `measuredHeights` ref declaration (around line 76):

```typescript
// Track measured heights for expanded items
const measuredHeights = useRef<Map<string, number>>(new Map())
```

Add the following cleanup effect immediately after the existing `useEffect` hooks (insert after the scroll-to-expanded effect, around line 147):

```typescript
// Phase 7: Clean up stale height measurements when steps are removed
useEffect(() => {
  const currentStepIds = new Set(steps.map(s => s.id))
  
  // Remove measurements for steps no longer in the list
  let cleanedCount = 0
  measuredHeights.current.forEach((_, stepId) => {
    if (!currentStepIds.has(stepId)) {
      measuredHeights.current.delete(stepId)
      cleanedCount++
    }
  })
  
  if (cleanedCount > 0) {
    console.debug(`[VirtualizedStepList] Cleaned ${cleanedCount} stale height measurements`)
  }
}, [steps])
```

#### Step 1.2: Add Unmount Cleanup

Add cleanup on component unmount to prevent memory retention:

```typescript
// Clear all measurements on unmount
useEffect(() => {
  return () => {
    measuredHeights.current.clear()
  }
}, [])
```

### Verification

1. Run TypeScript compilation: `npm run typecheck`
2. Start the application and open a chat with MCP tools enabled
3. Execute 25+ tool calls to trigger virtualization
4. Delete the chat or navigate away
5. Verify no console errors and memory usage is stable

---

## Phase 2: Consolidate InlineToolCall Components

**Effort:** Medium  
**Risk:** Medium  
**Files Modified:** 4  
**Files Created:** 1

### Problem Statement

`InlineToolCall.tsx` (437 lines) and `InlineToolCallV2.tsx` (531 lines) share approximately 60% of their logic including:
- Status configuration objects
- Risk styling configuration
- JSON editing state management
- Approval handler logic
- Copy-to-clipboard functionality

This duplication increases maintenance burden and risks divergent behavior.

### Implementation Strategy

1. Extract shared logic into a custom hook
2. Extract shared UI primitives into sub-components
3. Mark V1 as deprecated with migration path
4. Update imports in consuming components

#### Step 2.1: Create Shared Hook

**Create File:** `src/renderer/src/hooks/useToolCallState.ts`

```typescript
// src/renderer/src/hooks/useToolCallState.ts
// Phase 7: Shared state management for tool call components
// Extracted from InlineToolCall and InlineToolCallV2

import { useState, useCallback } from 'react'

export interface UseToolCallStateOptions {
  /** Initial arguments to display/edit */
  initialArgs: Record<string, unknown>
  /** Tool call ID for approval callbacks */
  id: string
  /** Tool name for always-approve callback */
  toolName: string
  /** Callback when approved */
  onApprove?: (id: string, modifiedArgs?: Record<string, unknown>) => void
  /** Callback for always-approve */
  onAlwaysApprove?: (id: string, toolName: string, modifiedArgs?: Record<string, unknown>) => void
  /** Callback when rejected */
  onReject?: (id: string) => void
}

export interface UseToolCallStateReturn {
  /** Whether currently in edit mode */
  isEditing: boolean
  /** Toggle edit mode */
  toggleEditing: () => void
  /** Current edited args as JSON string */
  editedArgs: string
  /** Update edited args */
  setEditedArgs: (value: string) => void
  /** JSON parse error message */
  parseError: string | null
  /** Clear parse error */
  clearParseError: () => void
  /** Whether content was recently copied */
  copied: boolean
  /** Copy content to clipboard */
  handleCopy: (content: string) => Promise<void>
  /** Whether full result is shown */
  showFullResult: boolean
  /** Toggle full result visibility */
  toggleShowFullResult: () => void
  /** Handle approve with optional edited args */
  handleApprove: () => void
  /** Handle always-approve with optional edited args */
  handleAlwaysApprove: () => void
  /** Handle reject */
  handleReject: () => void
  /** Parse and validate current edited args */
  parseEditedArgs: () => Record<string, unknown> | null
}

/**
 * Hook for managing tool call component state
 * 
 * Consolidates shared logic from InlineToolCall and InlineToolCallV2:
 * - JSON editing with validation
 * - Clipboard operations
 * - Approval flow handling
 * 
 * @example
 * ```tsx
 * const {
 *   isEditing,
 *   toggleEditing,
 *   editedArgs,
 *   setEditedArgs,
 *   parseError,
 *   handleApprove
 * } = useToolCallState({
 *   initialArgs: args,
 *   id: toolCallId,
 *   toolName: 'read_file',
 *   onApprove: handleToolApprove
 * })
 * ```
 */
export function useToolCallState(options: UseToolCallStateOptions): UseToolCallStateReturn {
  const {
    initialArgs,
    id,
    toolName,
    onApprove,
    onAlwaysApprove,
    onReject
  } = options

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editedArgs, setEditedArgs] = useState(() => JSON.stringify(initialArgs, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)

  // Copy state
  const [copied, setCopied] = useState(false)

  // Result expansion state
  const [showFullResult, setShowFullResult] = useState(false)

  // Toggle edit mode
  const toggleEditing = useCallback(() => {
    setIsEditing(prev => !prev)
  }, [])

  // Clear parse error
  const clearParseError = useCallback(() => {
    setParseError(null)
  }, [])

  // Handle args change with error clearing
  const handleArgsChange = useCallback((value: string) => {
    setEditedArgs(value)
    setParseError(null)
  }, [])

  // Parse edited args, returning null on error
  const parseEditedArgs = useCallback((): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(editedArgs)
      setParseError(null)
      return parsed
    } catch {
      setParseError('Invalid JSON. Please fix the syntax.')
      return null
    }
  }, [editedArgs])

  // Copy to clipboard
  const handleCopy = useCallback(async (content: string) => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  // Toggle full result
  const toggleShowFullResult = useCallback(() => {
    setShowFullResult(prev => !prev)
  }, [])

  // Approval handler
  const handleApprove = useCallback(() => {
    if (!onApprove) return

    if (isEditing) {
      const parsed = parseEditedArgs()
      if (parsed === null) return
      onApprove(id, parsed)
    } else {
      onApprove(id)
    }
  }, [onApprove, id, isEditing, parseEditedArgs])

  // Always-approve handler
  const handleAlwaysApprove = useCallback(() => {
    if (!onAlwaysApprove) return

    if (isEditing) {
      const parsed = parseEditedArgs()
      if (parsed === null) return
      onAlwaysApprove(id, toolName, parsed)
    } else {
      onAlwaysApprove(id, toolName)
    }
  }, [onAlwaysApprove, id, toolName, isEditing, parseEditedArgs])

  // Reject handler
  const handleReject = useCallback(() => {
    if (onReject) {
      onReject(id)
    }
  }, [onReject, id])

  return {
    isEditing,
    toggleEditing,
    editedArgs,
    setEditedArgs: handleArgsChange,
    parseError,
    clearParseError,
    copied,
    handleCopy,
    showFullResult,
    toggleShowFullResult,
    handleApprove,
    handleAlwaysApprove,
    handleReject,
    parseEditedArgs
  }
}

export default useToolCallState
```

#### Step 2.2: Create Shared Configuration Module

**Create File:** `src/renderer/src/components/mcp/toolCallConfig.ts`

```typescript
// src/renderer/src/components/mcp/toolCallConfig.ts
// Phase 7: Shared configuration for tool call components

import type { ReactNode } from 'react'
import { Clock, Loader2, CheckCircle2, X } from 'lucide-react'
import type { ToolCallStatus, RiskLevel } from './types'

/**
 * Status display configuration
 */
export interface StatusConfig {
  icon: ReactNode
  borderColor: string
  bgColor: string
  label: string
}

/**
 * Risk styling configuration
 */
export interface RiskConfig {
  className: string
  label: string
}

/**
 * Status configuration for each tool call state
 */
export const STATUS_CONFIG: Record<ToolCallStatus, StatusConfig> = {
  pending: {
    icon: null, // Will be set with proper React element
    borderColor: 'border-amber-500/40',
    bgColor: 'bg-amber-500/5',
    label: 'Pending approval'
  },
  approved: {
    icon: null,
    borderColor: 'border-blue-500/40',
    bgColor: 'bg-blue-500/5',
    label: 'Approved, preparing'
  },
  executing: {
    icon: null,
    borderColor: 'border-blue-500/40',
    bgColor: 'bg-blue-500/5',
    label: 'Executing'
  },
  completed: {
    icon: null,
    borderColor: 'border-green-500/30',
    bgColor: 'bg-green-500/5',
    label: 'Completed successfully'
  },
  error: {
    icon: null,
    borderColor: 'border-red-500/30',
    bgColor: 'bg-red-500/5',
    label: 'Failed with error'
  },
  rejected: {
    icon: null,
    borderColor: 'border-gray-500/30',
    bgColor: 'bg-gray-500/5',
    label: 'Rejected by user'
  }
}

/**
 * Get status icon component (avoids JSX in config object)
 */
export function getStatusIcon(status: ToolCallStatus, size: number = 14): ReactNode {
  const iconProps = { size }
  
  switch (status) {
    case 'pending':
      return <Clock {...iconProps} className="text-amber-400" />
    case 'approved':
    case 'executing':
      return <Loader2 {...iconProps} className="text-blue-400 animate-spin" />
    case 'completed':
      return <CheckCircle2 {...iconProps} className="text-green-400" />
    case 'error':
      return <X {...iconProps} className="text-red-400" />
    case 'rejected':
      return <X {...iconProps} className="text-gray-400" />
    default:
      return null
  }
}

/**
 * Risk level styling
 */
export const RISK_STYLES: Record<RiskLevel, RiskConfig> = {
  safe: {
    className: 'bg-green-500/20 text-green-400',
    label: 'Safe operation'
  },
  moderate: {
    className: 'bg-yellow-500/20 text-yellow-400',
    label: 'Moderate risk'
  },
  dangerous: {
    className: 'bg-red-500/20 text-red-400',
    label: 'Dangerous operation'
  }
}

/**
 * Check if content is long enough to need truncation
 */
export function isLongContent(content: string | undefined, threshold: number = 500): boolean {
  return (content?.length || 0) > threshold
}

/**
 * Format result for display
 */
export function formatResult(result: unknown): string {
  if (result === undefined || result === null) return ''
  return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
}

/**
 * Get summarized args for collapsed view
 */
export function getArgsSummary(args: Record<string, unknown>, maxLength: number = 40): string {
  const entries = Object.entries(args)
  if (entries.length === 0) return 'no arguments'

  const summaryParts: string[] = []
  for (const [key, value] of entries.slice(0, 2)) {
    const valStr = typeof value === 'string'
      ? (value.length > maxLength ? value.slice(0, maxLength) + '...' : value)
      : JSON.stringify(value).slice(0, maxLength)
    summaryParts.push(`${key}: ${valStr}`)
  }
  
  if (entries.length > 2) {
    summaryParts.push(`+${entries.length - 2} more`)
  }
  
  return summaryParts.join(', ')
}
```

#### Step 2.3: Update InlineToolCallV2 to Use Shared Code

**File:** `src/renderer/src/components/mcp/InlineToolCallV2.tsx`

Replace the local state management with the shared hook. Update imports and refactor the component body.

```typescript
// At top of file, add imports:
import { useToolCallState } from '../../hooks/useToolCallState'
import {
  STATUS_CONFIG,
  getStatusIcon,
  RISK_STYLES,
  isLongContent,
  formatResult
} from './toolCallConfig'

// In component body, replace local state with hook:
const {
  isEditing,
  toggleEditing,
  editedArgs,
  setEditedArgs,
  parseError,
  copied,
  handleCopy,
  showFullResult,
  toggleShowFullResult,
  handleApprove,
  handleAlwaysApprove,
  handleReject
} = useToolCallState({
  initialArgs: args,
  id,
  toolName,
  onApprove,
  onAlwaysApprove,
  onReject
})

// Update status icon usage:
const statusIcon = getStatusIcon(status, 14)

// Update result formatting:
const displayResult = formatResult(result)
const isLongResult = isLongContent(displayResult) || isLongContent(error)
```

#### Step 2.4: Deprecate InlineToolCall V1

**File:** `src/renderer/src/components/mcp/InlineToolCall.tsx`

Add deprecation notice at the top of the file:

```typescript
// src/renderer/src/components/mcp/InlineToolCall.tsx
/**
 * @deprecated Use InlineToolCallV2 instead. This component is maintained
 * for backward compatibility only and will be removed in a future version.
 * 
 * Migration guide:
 * 1. Replace `<InlineToolCall />` with `<InlineToolCallV2 />`
 * 2. Add required props: `isExpanded`, `onToggleExpand`
 * 3. Optionally add a11y props: `isFocused`, `tabIndex`
 * 
 * @see InlineToolCallV2
 */
```

#### Step 2.5: Update Index Exports

**File:** `src/renderer/src/components/mcp/index.ts`

Update exports to include new shared modules:

```typescript
// Add after existing exports:

// === Phase 7: Shared Configuration ===
export {
  STATUS_CONFIG,
  getStatusIcon,
  RISK_STYLES,
  isLongContent,
  formatResult,
  getArgsSummary
} from './toolCallConfig'
export type { StatusConfig, RiskConfig } from './toolCallConfig'
```

### Verification

1. Run TypeScript compilation: `npm run typecheck`
2. Test InlineToolCallV2 renders correctly in tool step groups
3. Verify approval flow works (approve, always approve, reject)
4. Test JSON editing with invalid input shows error
5. Confirm copy-to-clipboard works
6. Check that V1 component still works for any legacy usage

---

## Phase 3: Extensible Server Icon Pattern

**Effort:** Low-Medium  
**Risk:** Low  
**Files Modified:** 1  
**Files Created:** 1

### Problem Statement

The `serverIcons.ts` file requires manual updates for each new MCP tool. The 30+ entry `TOOL_SERVER_MAP` is error-prone and doesn't scale as more MCP servers are integrated.

### Implementation Strategy

1. Add prefix-based inference as primary lookup
2. Keep explicit mapping as fallback for exceptions
3. Allow runtime registration of new servers
4. Leverage MCP tool metadata when available

#### Step 3.1: Create Enhanced Server Icon Module

**Create File:** `src/renderer/src/lib/serverIconRegistry.ts`

```typescript
// src/renderer/src/lib/serverIconRegistry.ts
// Phase 7: Extensible server icon registry with multiple inference strategies

import type { ServerIconConfig } from '../components/mcp/types'

/**
 * Registry for MCP server icon configurations
 * Supports multiple lookup strategies:
 * 1. Direct server name match
 * 2. Tool name prefix matching
 * 3. Explicit tool->server mapping (fallback)
 * 4. Runtime registration
 */
class ServerIconRegistry {
  private servers: Map<string, ServerIconConfig> = new Map()
  private toolPrefixes: Map<string, string> = new Map()
  private explicitToolMap: Map<string, string> = new Map()
  
  private defaultIcon: ServerIconConfig = {
    abbrev: '⚡',
    color: '#6B7280',
    name: 'Unknown Server'
  }

  constructor() {
    this.initializeDefaults()
  }

  /**
   * Initialize with known MCP servers
   */
  private initializeDefaults(): void {
    // Register known servers
    this.registerServer('desktop-commander', {
      abbrev: 'DC',
      color: '#10B981',
      name: 'Desktop Commander'
    })
    
    this.registerServer('github', {
      abbrev: 'GH',
      color: '#6366F1',
      name: 'GitHub'
    })
    
    this.registerServer('ssh-mcp', {
      abbrev: 'SSH',
      color: '#F59E0B',
      name: 'SSH'
    })
    
    this.registerServer('memory', {
      abbrev: 'MEM',
      color: '#8B5CF6',
      name: 'Memory'
    })

    // Register common prefixes for tool inference
    this.registerToolPrefix('gh_', 'github')
    this.registerToolPrefix('github_', 'github')
    this.registerToolPrefix('ssh_', 'ssh-mcp')
    this.registerToolPrefix('memory_', 'memory')
    this.registerToolPrefix('mem_', 'memory')
    
    // Register explicit mappings for tools that don't follow prefix convention
    // Desktop Commander tools (most common, no prefix)
    const dcTools = [
      'read_file', 'read_multiple_files', 'write_file', 'create_directory',
      'list_directory', 'move_file', 'get_file_info', 'edit_block',
      'start_search', 'get_more_search_results', 'stop_search', 'list_searches',
      'start_process', 'read_process_output', 'interact_with_process',
      'force_terminate', 'list_sessions', 'list_processes', 'kill_process',
      'get_config', 'set_config_value', 'write_pdf'
    ]
    dcTools.forEach(tool => this.registerTool(tool, 'desktop-commander'))
    
    // GitHub tools without prefix
    const ghTools = [
      'create_or_update_file', 'search_repositories', 'create_repository',
      'get_file_contents', 'push_files', 'create_issue', 'create_pull_request',
      'fork_repository', 'create_branch', 'list_commits', 'list_branches'
    ]
    ghTools.forEach(tool => this.registerTool(tool, 'github'))
    
    // Memory tools without prefix
    const memTools = [
      'create_memory', 'search_memory', 'delete_memory',
      'list_memories', 'get_memory', 'update_memory'
    ]
    memTools.forEach(tool => this.registerTool(tool, 'memory'))
  }

  /**
   * Register a new MCP server
   */
  registerServer(name: string, config: ServerIconConfig): void {
    const normalized = this.normalizeServerName(name)
    this.servers.set(normalized, config)
  }

  /**
   * Register a tool name prefix for server inference
   * @example registerToolPrefix('gh_', 'github') // gh_create_issue -> github
   */
  registerToolPrefix(prefix: string, serverName: string): void {
    this.toolPrefixes.set(prefix.toLowerCase(), this.normalizeServerName(serverName))
  }

  /**
   * Register explicit tool->server mapping
   */
  registerTool(toolName: string, serverName: string): void {
    this.explicitToolMap.set(toolName.toLowerCase(), this.normalizeServerName(serverName))
  }

  /**
   * Get icon configuration for a server
   */
  getServerIcon(serverName: string): ServerIconConfig {
    const normalized = this.normalizeServerName(serverName)
    return this.servers.get(normalized) ?? this.defaultIcon
  }

  /**
   * Infer server name from tool name using multiple strategies
   * 
   * Strategy order:
   * 1. Check if tool metadata provides server name (passed as hint)
   * 2. Check prefix patterns
   * 3. Check explicit tool mapping
   * 4. Return undefined if unknown
   */
  inferServerFromTool(toolName: string, serverHint?: string): string | undefined {
    // Strategy 1: Use provided server hint
    if (serverHint) {
      const normalized = this.normalizeServerName(serverHint)
      if (this.servers.has(normalized)) {
        return normalized
      }
    }

    const lowerTool = toolName.toLowerCase()

    // Strategy 2: Check prefixes
    for (const [prefix, server] of this.toolPrefixes) {
      if (lowerTool.startsWith(prefix)) {
        return server
      }
    }

    // Strategy 3: Check explicit mapping
    const explicit = this.explicitToolMap.get(lowerTool)
    if (explicit) {
      return explicit
    }

    return undefined
  }

  /**
   * Get icon directly from tool name
   */
  getIconFromTool(toolName: string, serverHint?: string): ServerIconConfig {
    const serverName = this.inferServerFromTool(toolName, serverHint)
    return serverName ? this.getServerIcon(serverName) : this.defaultIcon
  }

  /**
   * Set custom default icon
   */
  setDefaultIcon(config: ServerIconConfig): void {
    this.defaultIcon = config
  }

  /**
   * Get all registered servers
   */
  getAllServers(): Map<string, ServerIconConfig> {
    return new Map(this.servers)
  }

  /**
   * Normalize server name for consistent lookup
   */
  private normalizeServerName(name: string): string {
    return name.toLowerCase().replace(/[_\s]/g, '-')
  }
}

// Singleton instance
export const serverIconRegistry = new ServerIconRegistry()

// Convenience exports for backward compatibility
export function getServerIcon(serverName: string): ServerIconConfig {
  return serverIconRegistry.getServerIcon(serverName)
}

export function getServerFromToolName(toolName: string): string | undefined {
  return serverIconRegistry.inferServerFromTool(toolName)
}

export function getServerIconFromToolName(toolName: string): ServerIconConfig {
  return serverIconRegistry.getIconFromTool(toolName)
}

// Re-export type
export type { ServerIconConfig }
```

#### Step 3.2: Update Original serverIcons.ts

**File:** `src/renderer/src/lib/serverIcons.ts`

Replace the entire contents with a re-export facade for backward compatibility:

```typescript
// src/renderer/src/lib/serverIcons.ts
// Phase 7: Facade for backward compatibility
// All logic moved to serverIconRegistry.ts

/**
 * @deprecated Import from './serverIconRegistry' for full API access.
 * This module is maintained for backward compatibility.
 */

export {
  serverIconRegistry,
  getServerIcon,
  getServerFromToolName,
  getServerIconFromToolName,
  type ServerIconConfig
} from './serverIconRegistry'

// Re-export SERVER_ICONS for any direct consumers
import { serverIconRegistry } from './serverIconRegistry'

/**
 * @deprecated Access via serverIconRegistry.getAllServers() instead
 */
export const SERVER_ICONS = Object.fromEntries(serverIconRegistry.getAllServers())
```

#### Step 3.3: Document Registration API

Add usage documentation to the registry:

```typescript
/**
 * Runtime registration example (for dynamic MCP server discovery):
 * 
 * ```typescript
 * import { serverIconRegistry } from './serverIconRegistry'
 * 
 * // When a new MCP server connects:
 * serverIconRegistry.registerServer('my-custom-mcp', {
 *   abbrev: 'MC',
 *   color: '#FF6B6B',
 *   name: 'My Custom MCP'
 * })
 * 
 * // Register tool prefix pattern:
 * serverIconRegistry.registerToolPrefix('mc_', 'my-custom-mcp')
 * ```
 */
```

### Verification

1. Run TypeScript compilation: `npm run typecheck`
2. Verify existing tool icons display correctly
3. Test prefix-based inference with mock tool names
4. Confirm backward compatibility with direct `SERVER_ICONS` access
5. Test runtime registration in development console

---

## Testing Checklist

### Phase 1: Memory Leak Fix
- [ ] Virtualization triggers at 20+ steps
- [ ] Height map cleans up when steps removed
- [ ] No memory growth in long sessions
- [ ] Console shows cleanup debug messages

### Phase 2: Component Consolidation
- [ ] `useToolCallState` hook exports correctly
- [ ] InlineToolCallV2 uses shared hook
- [ ] Approval flow unchanged
- [ ] JSON editing works with validation
- [ ] Copy-to-clipboard works
- [ ] V1 component still functional
- [ ] No breaking changes to existing imports

### Phase 3: Server Icon Registry
- [ ] Direct server lookup works
- [ ] Prefix inference works (e.g., `gh_create_issue`)
- [ ] Explicit tool mapping works
- [ ] Unknown tools get default icon
- [ ] Runtime registration works
- [ ] Backward compatible exports

---

## Rollback Plan

If issues are discovered:

1. **Phase 1:** Revert `VirtualizedStepList.tsx` changes (single file)
2. **Phase 2:** Shared hook can be removed; V2 can revert to local state
3. **Phase 3:** Original `serverIcons.ts` content can be restored

All phases are independent and can be reverted individually without affecting others.

---

## Future Considerations

After these refinements:

1. **Phase 2 Extension:** Fully migrate V1 consumers to V2, then remove V1
2. **Phase 3 Extension:** Integrate with MCP server discovery to auto-register icons
3. **Animation Constants:** Extract to shared config (noted in review, deferred)
4. **Error Boundaries:** Add to step groups (noted in review, deferred)

---

*Implementation Prompt Version: 1.0*  
*Created: Phase 7 - MCP Component Refinements*  
*Architect: Alex Chen*
