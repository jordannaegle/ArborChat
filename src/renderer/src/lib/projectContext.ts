// src/renderer/src/lib/projectContext.ts
// Project structure analysis and context seeding for agents
// Phase 4: Advanced Capabilities
// Author: Alex Chen (Distinguished Software Architect)

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

/**
 * Generate a brief project summary for logging/display
 */
export function summarizeProjectContext(context: ProjectContext): string {
  const parts: string[] = []
  
  parts.push(`${context.name} (${context.type})`)
  
  if (context.framework) {
    parts.push(`Framework: ${context.framework}`)
  }
  
  if (context.hasTypeScript) {
    parts.push('TypeScript')
  }
  
  if (context.hasTests) {
    parts.push(`Tests: ${context.testDirectories.join(', ')}`)
  }
  
  return parts.join(' | ')
}
