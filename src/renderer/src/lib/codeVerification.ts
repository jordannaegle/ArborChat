// src/renderer/src/lib/codeVerification.ts
// Code verification utilities for agent completion checks
// Phase 3: TypeScript/ESLint verification and file extraction

/**
 * Extract file paths mentioned in agent message content
 * Used to identify what files the agent claims to have modified
 */
export function extractMentionedFiles(content: string): string[] {
  // Match file paths with common code extensions
  const pathRegex = /(?:\/[\w.-]+)+\.(?:ts|tsx|js|jsx|json|md|css|html|yaml|yml|toml|py|rs|go|vue|svelte)/gi
  const matches = content.match(pathRegex) || []
  
  // Also match relative paths like ./src/file.ts or src/file.ts
  const relativeRegex = /(?:\.\/)?(?:[\w.-]+\/)+[\w.-]+\.(?:ts|tsx|js|jsx|json|md|css|html|yaml|yml)/gi
  const relativeMatches = content.match(relativeRegex) || []
  
  // Combine and deduplicate
  const allMatches = [...matches, ...relativeMatches]
  return [...new Set(allMatches.map(p => p.toLowerCase()))]
}

/**
 * Verify TypeScript compilation
 * Runs `npm run typecheck` in the working directory
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
 * Optional code quality gate
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
 * Full verification result interface
 */
export interface FullVerificationResult {
  git: {
    verified: boolean
    changedFiles: string[]
    missingChanges: string[]
  }
  typescript: {
    success: boolean
    errorCount: number
    errors?: string[]
  }
  eslint: {
    success: boolean
    errorCount: number
    warningCount: number
  }
  overall: boolean
}

/**
 * Run all verification checks in parallel
 * Returns comprehensive verification result
 */
export async function runFullVerification(
  workingDir: string,
  expectedFiles: string[]
): Promise<FullVerificationResult> {
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
      errorCount: typescript.errorCount,
      errors: typescript.errors
    },
    eslint: {
      success: eslint.success,
      errorCount: eslint.errors.length,
      warningCount: eslint.warnings.length
    },
    // Overall passes if git verified and TypeScript passes
    // ESLint failures are warnings, not blockers
    overall: git.verified && typescript.success
  }
}

/**
 * Quick TypeScript check for a specific file
 * Used for post-write verification
 */
export async function quickTypeCheck(
  workingDir: string,
  filePath: string
): Promise<{ success: boolean; errors: string[] }> {
  try {
    const result = await window.api.mcp.requestTool(
      'desktop-commander',
      'start_process',
      {
        command: `cd "${workingDir}" && npx tsc --noEmit "${filePath}" 2>&1`,
        timeout_ms: 30000
      },
      `TypeScript check for ${filePath}`
    )

    const output = String(result.result || '')
    const hasErrors = output.includes('error TS')
    
    if (hasErrors) {
      const errorLines = output
        .split('\n')
        .filter(line => line.includes('error TS'))
        .slice(0, 5)
      
      return { success: false, errors: errorLines }
    }

    return { success: true, errors: [] }
  } catch (error) {
    return { success: false, errors: [String(error)] }
  }
}
