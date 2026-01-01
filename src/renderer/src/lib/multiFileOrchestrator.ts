// src/renderer/src/lib/multiFileOrchestrator.ts
// Orchestrates complex multi-file operations with dependency awareness
// Phase 4: Advanced Capabilities
// Author: Alex Chen (Distinguished Software Architect)

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
    id: `op-${idx}-${op.type}-${sanitizeForId(op.path)}`
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
 * Sanitize a path for use in an operation ID
 */
function sanitizeForId(path: string): string {
  return path.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20) || 'unknown'
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
          mode: 'rewrite'
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
  
  // Check execution order is complete
  const opIds = new Set(plan.operations.map(op => op.id))
  const orderedIds = new Set(plan.executionOrder)
  
  for (const id of opIds) {
    if (!orderedIds.has(id)) {
      errors.push(`Operation ${id} is not in execution order`)
    }
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

/**
 * Get a brief status string for the plan
 */
export function getPlanStatus(plan: OrchestrationPlan): string {
  const counts = {
    create: 0,
    modify: 0,
    delete: 0,
    rename: 0
  }
  
  for (const op of plan.operations) {
    counts[op.type]++
  }
  
  const parts: string[] = []
  if (counts.create > 0) parts.push(`${counts.create} create`)
  if (counts.modify > 0) parts.push(`${counts.modify} modify`)
  if (counts.delete > 0) parts.push(`${counts.delete} delete`)
  if (counts.rename > 0) parts.push(`${counts.rename} rename`)
  
  return parts.join(', ') || 'No operations'
}

/**
 * Create a simple plan from a list of file changes (no dependencies)
 */
export function createSimplePlan(
  changes: Array<{
    path: string
    type: FileOperationType
    content?: string
    newPath?: string
    description?: string
  }>
): OrchestrationPlan {
  return createOrchestrationPlan(changes)
}

/**
 * Merge multiple plans into one (for complex refactoring)
 */
export function mergePlans(plans: OrchestrationPlan[]): OrchestrationPlan {
  const allOperations: Omit<FileOperation, 'id'>[] = []
  
  for (const plan of plans) {
    for (const op of plan.operations) {
      allOperations.push({
        type: op.type,
        path: op.path,
        content: op.content,
        newPath: op.newPath,
        dependencies: op.dependencies,
        description: op.description
      })
    }
  }
  
  return createOrchestrationPlan(allOperations)
}

/**
 * Estimate tokens needed for a plan's content
 */
export function estimatePlanTokens(plan: OrchestrationPlan): number {
  let totalChars = 0
  
  for (const op of plan.operations) {
    if (op.content) {
      totalChars += op.content.length
    }
    totalChars += op.path.length
    if (op.newPath) totalChars += op.newPath.length
    if (op.description) totalChars += op.description.length
  }
  
  // Rough estimate: ~4 chars per token
  return Math.ceil(totalChars / 4)
}

/**
 * Filter operations by type
 */
export function filterOperationsByType(
  plan: OrchestrationPlan,
  types: FileOperationType[]
): FileOperation[] {
  const typeSet = new Set(types)
  return plan.operations.filter(op => typeSet.has(op.type))
}

/**
 * Get files affected by a plan
 */
export function getAffectedFiles(plan: OrchestrationPlan): {
  created: string[]
  modified: string[]
  deleted: string[]
  renamed: Array<{ from: string; to: string }>
} {
  const created: string[] = []
  const modified: string[] = []
  const deleted: string[] = []
  const renamed: Array<{ from: string; to: string }> = []
  
  for (const op of plan.operations) {
    switch (op.type) {
      case 'create':
        created.push(op.path)
        break
      case 'modify':
        modified.push(op.path)
        break
      case 'delete':
        deleted.push(op.path)
        break
      case 'rename':
        if (op.newPath) {
          renamed.push({ from: op.path, to: op.newPath })
        }
        break
    }
  }
  
  return { created, modified, deleted, renamed }
}
