// src/renderer/src/lib/fileRelevance.ts
// Smart file selection for context building
// Phase 4: Advanced Capabilities
// Author: Alex Chen (Distinguished Software Architect)

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

/**
 * Filter files by extension(s)
 */
export function filterFilesByExtension(
  files: string[],
  extensions: string[]
): string[] {
  const extSet = new Set(extensions.map(e => e.toLowerCase().replace(/^\./, '')))
  return files.filter(f => {
    const ext = f.split('.').pop()?.toLowerCase() || ''
    return extSet.has(ext)
  })
}

/**
 * Get files related to a specific component/module name
 */
export function findRelatedFiles(
  files: string[],
  componentName: string
): string[] {
  const nameLower = componentName.toLowerCase()
  
  return files.filter(f => {
    const fileLower = f.toLowerCase()
    const fileName = fileLower.split('/').pop() || ''
    
    // Direct name match
    if (fileName.includes(nameLower)) return true
    
    // Path segment match
    if (fileLower.includes(`/${nameLower}/`)) return true
    
    return false
  })
}
