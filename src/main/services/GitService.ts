// src/main/services/GitService.ts
// Git repository detection, information, and verification service
// Phase 3: Added verification methods for completion checking

import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'

const execAsync = promisify(exec)

export interface GitRepoInfo {
  isGitRepo: boolean
  repoRoot?: string
  currentBranch?: string
  branches?: string[]
  hasUncommittedChanges?: boolean
  uncommittedFileCount?: number
  remoteUrl?: string
}

export interface GitChangedFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked'
}

export interface GitDiffInfo {
  changedFiles: GitChangedFile[]
  totalAdditions: number
  totalDeletions: number
}

// Phase 3: Verification types
export interface GitVerifyResult {
  verified: boolean
  changedFiles: string[]
  missingChanges: string[]
  unexpectedChanges: string[]
  details: Record<string, { status: string; lines?: number }>
}

export interface GitDetailedStatus {
  staged: Array<{ path: string; additions: number; deletions: number }>
  modified: Array<{ path: string; additions: number; deletions: number }>
  untracked: Array<{ path: string }>
}

/**
 * Run a git command in the specified directory
 */
async function runGit(
  directory: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  const command = `git ${args.join(' ')}`
  return execAsync(command, { cwd: directory, maxBuffer: 10 * 1024 * 1024 })
}

/**
 * Check if a directory is a git repository
 */
export async function isGitRepo(directory: string): Promise<boolean> {
  try {
    const gitDir = path.join(directory, '.git')
    const stats = await fs.promises.stat(gitDir)
    return stats.isDirectory()
  } catch {
    // .git doesn't exist, check if we're in a subdirectory of a git repo
    try {
      await execAsync('git rev-parse --git-dir', { cwd: directory })
      return true
    } catch {
      return false
    }
  }
}

/**
 * Check if working directory is a git repository (alias for consistency)
 * Phase 3: Added for preload API
 */
export async function isGitRepository(workingDir: string): Promise<boolean> {
  return isGitRepo(workingDir)
}

/**
 * Get comprehensive git repository information
 */
export async function getGitRepoInfo(directory: string): Promise<GitRepoInfo> {
  const isRepo = await isGitRepo(directory)
  
  if (!isRepo) {
    return { isGitRepo: false }
  }

  try {
    // Get repo root
    const { stdout: repoRoot } = await execAsync('git rev-parse --show-toplevel', { cwd: directory })
    
    // Get current branch
    const { stdout: currentBranch } = await execAsync('git branch --show-current', { cwd: directory })
    
    // Get all local branches
    const { stdout: branchesOutput } = await execAsync('git branch --format="%(refname:short)"', { cwd: directory })
    const branches = branchesOutput.trim().split('\n').filter(b => b.length > 0)
    
    // Check for uncommitted changes
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: directory })
    const uncommittedFiles = statusOutput.trim().split('\n').filter(l => l.length > 0)
    const hasUncommittedChanges = uncommittedFiles.length > 0
    
    // Get remote URL (if any)
    let remoteUrl: string | undefined
    try {
      const { stdout: remote } = await execAsync('git remote get-url origin', { cwd: directory })
      remoteUrl = remote.trim()
    } catch {
      // No remote configured
    }

    return {
      isGitRepo: true,
      repoRoot: repoRoot.trim(),
      currentBranch: currentBranch.trim() || 'HEAD (detached)',
      branches,
      hasUncommittedChanges,
      uncommittedFileCount: uncommittedFiles.length,
      remoteUrl
    }
  } catch (error) {
    console.error('Error getting git repo info:', error)
    return { isGitRepo: true } // We know it's a repo, just couldn't get details
  }
}

/**
 * Get list of uncommitted/changed files
 */
export async function getUncommittedFiles(directory: string): Promise<GitChangedFile[]> {
  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd: directory })
    const lines = stdout.trim().split('\n').filter(l => l.length > 0)
    
    return lines.map(line => {
      const statusCode = line.substring(0, 2).trim()
      const filePath = line.substring(3)
      
      let status: GitChangedFile['status']
      switch (statusCode) {
        case 'A':
          status = 'added'
          break
        case 'M':
          status = 'modified'
          break
        case 'D':
          status = 'deleted'
          break
        case 'R':
          status = 'renamed'
          break
        case '??':
          status = 'untracked'
          break
        default:
          status = 'modified'
      }
      
      return { path: filePath, status }
    })
  } catch (error) {
    console.error('Error getting uncommitted files:', error)
    return []
  }
}

/**
 * Get files changed between current branch and another branch
 */
export async function getChangedFilesSinceBranch(
  directory: string,
  baseBranch: string
): Promise<GitChangedFile[]> {
  try {
    const { stdout } = await execAsync(
      `git diff --name-status ${baseBranch}...HEAD`,
      { cwd: directory }
    )
    const lines = stdout.trim().split('\n').filter(l => l.length > 0)
    
    return lines.map(line => {
      const [statusCode, ...pathParts] = line.split('\t')
      const filePath = pathParts.join('\t') // Handle paths with tabs (rare but possible)
      
      let status: GitChangedFile['status']
      switch (statusCode) {
        case 'A':
          status = 'added'
          break
        case 'M':
          status = 'modified'
          break
        case 'D':
          status = 'deleted'
          break
        case 'R':
        case 'R100':
          status = 'renamed'
          break
        default:
          status = 'modified'
      }
      
      return { path: filePath, status }
    })
  } catch (error) {
    console.error('Error getting changed files since branch:', error)
    return []
  }
}

/**
 * Get diff statistics
 */
export async function getDiffStats(
  directory: string,
  baseBranch?: string
): Promise<GitDiffInfo> {
  try {
    const diffCommand = baseBranch
      ? `git diff --stat ${baseBranch}...HEAD`
      : 'git diff --stat HEAD'
    
    const { stdout } = await execAsync(diffCommand, { cwd: directory })
    
    // Parse the summary line (e.g., "5 files changed, 100 insertions(+), 20 deletions(-)")
    const summaryMatch = stdout.match(/(\d+) insertions?\(\+\)/)
    const deletionsMatch = stdout.match(/(\d+) deletions?\(-\)/)
    
    const changedFiles = baseBranch
      ? await getChangedFilesSinceBranch(directory, baseBranch)
      : await getUncommittedFiles(directory)
    
    return {
      changedFiles,
      totalAdditions: summaryMatch ? parseInt(summaryMatch[1], 10) : 0,
      totalDeletions: deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0
    }
  } catch (error) {
    console.error('Error getting diff stats:', error)
    return { changedFiles: [], totalAdditions: 0, totalDeletions: 0 }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 3: Verification Methods for Completion Checking
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get diff statistics for a specific file
 */
export async function getFileDiffStats(
  workingDir: string,
  filePath: string,
  staged: boolean
): Promise<{ additions: number; deletions: number }> {
  try {
    const args = staged
      ? ['diff', '--cached', '--numstat', '--', filePath]
      : ['diff', '--numstat', '--', filePath]
    
    const result = await runGit(workingDir, args)
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
 * Get detailed git status with line changes
 * Phase 3: Returns staged, modified, and untracked files with diff stats
 */
export async function getDetailedStatus(workingDir: string): Promise<GitDetailedStatus> {
  try {
    const result = await runGit(workingDir, ['status', '--porcelain', '-uall'])
    
    const staged: Array<{ path: string; additions: number; deletions: number }> = []
    const modified: Array<{ path: string; additions: number; deletions: number }> = []
    const untracked: Array<{ path: string }> = []
    
    const lines = result.stdout.split('\n').filter(Boolean)
    
    for (const line of lines) {
      const indexStatus = line[0]   // Status in index (staged)
      const workTreeStatus = line[1] // Status in work tree
      const filePath = line.substring(3)
      
      // Staged files (index has A, M, D, R, C)
      if (indexStatus === 'A' || indexStatus === 'M' || indexStatus === 'D' || indexStatus === 'R' || indexStatus === 'C') {
        const diff = await getFileDiffStats(workingDir, filePath, true)
        staged.push({ path: filePath, ...diff })
      }
      
      // Modified in work tree (not staged or both staged and modified)
      if (workTreeStatus === 'M') {
        const diff = await getFileDiffStats(workingDir, filePath, false)
        modified.push({ path: filePath, ...diff })
      }
      
      // Untracked files
      if (indexStatus === '?' && workTreeStatus === '?') {
        untracked.push({ path: filePath })
      }
    }
    
    return { staged, modified, untracked }
  } catch (error) {
    console.error('[GitService] getDetailedStatus failed:', error)
    return { staged: [], modified: [], untracked: [] }
  }
}

/**
 * Verify actual file changes match expected files
 * Phase 3: Used to prevent hallucinated completion claims
 * 
 * @param workingDir - Git repository directory
 * @param expectedFiles - Files the agent claimed to have modified
 * @returns Verification result with details
 */
export async function verifyChanges(
  workingDir: string,
  expectedFiles: string[]
): Promise<GitVerifyResult> {
  try {
    const status = await getDetailedStatus(workingDir)
    
    // Normalize paths for comparison (remove leading ./, lowercase)
    const normalizeP = (p: string) => p.replace(/^\.\//, '').toLowerCase()
    const expectedNormalized = new Set(expectedFiles.map(normalizeP))
    
    // Collect all changed files
    const changedFiles = [
      ...status.staged.map(f => f.path),
      ...status.modified.map(f => f.path),
      ...status.untracked.map(f => f.path)
    ]
    const changedNormalized = new Set(changedFiles.map(normalizeP))
    
    // Find mismatches
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
 * Get a summary of recent changes
 * Phase 3: Human-readable diff summary
 */
export async function getDiffSummary(workingDir: string): Promise<string> {
  try {
    const result = await runGit(workingDir, ['diff', '--stat'])
    return result.stdout || 'No changes detected'
  } catch (error) {
    return `Error getting diff: ${error}`
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Git Commit Operations - Slash Command Support
// ═══════════════════════════════════════════════════════════════════════════

export interface GitCommitResult {
  success: boolean
  commitHash?: string
  message?: string
  filesCommitted?: number
  error?: string
}

/**
 * Stage all changes and create a commit
 * Used by the /commit slash command
 * 
 * @param workingDir - Git repository directory
 * @param message - Commit message (optional, will be auto-generated if not provided)
 * @returns Commit result with hash and details
 */
export async function commitChanges(
  workingDir: string,
  message?: string
): Promise<GitCommitResult> {
  try {
    // First check if this is a git repository
    const isRepo = await isGitRepo(workingDir)
    if (!isRepo) {
      return {
        success: false,
        error: 'Not a git repository'
      }
    }

    // Check for uncommitted changes
    const uncommittedFiles = await getUncommittedFiles(workingDir)
    if (uncommittedFiles.length === 0) {
      return {
        success: false,
        error: 'No changes to commit'
      }
    }

    // Stage all changes (including untracked files)
    await runGit(workingDir, ['add', '-A'])

    // Generate commit message if not provided
    const commitMessage = message || await generateCommitMessage(workingDir, uncommittedFiles)

    // Create the commit
    const { stdout } = await runGit(workingDir, ['commit', '-m', commitMessage])

    // Extract commit hash from output
    const hashMatch = stdout.match(/\[[\w-]+\s+([a-f0-9]+)\]/)
    const commitHash = hashMatch ? hashMatch[1] : undefined

    return {
      success: true,
      commitHash,
      message: commitMessage,
      filesCommitted: uncommittedFiles.length
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[GitService] commitChanges failed:', error)
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Generate an automatic commit message based on changed files
 */
async function generateCommitMessage(
  _workingDir: string,
  changedFiles: GitChangedFile[]
): Promise<string> {
  const timestamp = new Date().toISOString().split('T')[0]
  
  // Group files by status
  const added = changedFiles.filter(f => f.status === 'added' || f.status === 'untracked')
  const modified = changedFiles.filter(f => f.status === 'modified')
  const deleted = changedFiles.filter(f => f.status === 'deleted')

  // Build summary parts
  const parts: string[] = []
  
  if (added.length > 0) {
    parts.push(`Add ${added.length} file${added.length > 1 ? 's' : ''}`)
  }
  if (modified.length > 0) {
    parts.push(`Update ${modified.length} file${modified.length > 1 ? 's' : ''}`)
  }
  if (deleted.length > 0) {
    parts.push(`Remove ${deleted.length} file${deleted.length > 1 ? 's' : ''}`)
  }

  // Create message
  const summary = parts.join(', ') || 'Session changes'
  
  // Add file details for small commits
  let details = ''
  if (changedFiles.length <= 5) {
    details = '\n\nFiles:\n' + changedFiles
      .map(f => `- ${f.path} (${f.status})`)
      .join('\n')
  }

  return `${summary} [${timestamp}]${details}`
}

/**
 * Get the ArborChat project root directory
 * Useful for the /commit command to know where to commit
 */
export async function getArborChatRoot(): Promise<string> {
  // In production, use app.getAppPath() but for development,
  // we'll return the known project location
  // This could be enhanced to detect from process.cwd() or config
  const possiblePaths = [
    process.env.ARBORCHAT_ROOT,
    '/Users/cory.naegle/ArborChat',
    process.cwd()
  ].filter(Boolean) as string[]

  for (const dir of possiblePaths) {
    if (await isGitRepo(dir)) {
      return dir
    }
  }

  throw new Error('Could not locate ArborChat repository')
}
