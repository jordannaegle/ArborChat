// src/main/services/GitService.ts
// Git repository detection and information service

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
