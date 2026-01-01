// src/main/projectAnalyzer/index.ts
/**
 * Project Analyzer Module
 * 
 * Provides project-aware context injection for agent system prompts.
 * Currently supports ArborChat-specific patterns with plans for
 * generic project analysis.
 * 
 * @author Alex Chen (Distinguished Software Architect)
 * @phase Agent Search Efficiency Enhancement
 */

import { ipcMain } from 'electron'
import { getArborChatContext, isArborChatProject, ARBORCHAT_CONTEXT } from './arborChatPatterns'

export { getArborChatContext, isArborChatProject, ARBORCHAT_CONTEXT }

/**
 * Get project intelligence context for a working directory
 * 
 * @param workingDirectory - The project root directory
 * @returns Project context string to inject into agent prompts, or null if no context available
 */
export function getProjectContext(workingDirectory: string | undefined): string | null {
  console.log('[ProjectAnalyzer] getProjectContext called with:', workingDirectory)
  
  if (!workingDirectory) {
    console.log('[ProjectAnalyzer] No working directory provided, returning null')
    return null
  }

  // For now, only ArborChat is supported
  // Future: Add generic project analysis
  const context = getArborChatContext(workingDirectory)
  console.log('[ProjectAnalyzer] getArborChatContext returned:', context ? `${context.length} chars` : 'null')
  
  return context
}

/**
 * Setup IPC handlers for project analysis
 */
export function setupProjectAnalyzerHandlers(): void {
  // Get project context for a working directory
  ipcMain.handle('projectAnalyzer:getContext', async (_event, workingDirectory: string) => {
    return getProjectContext(workingDirectory)
  })

  // Check if a directory is a known project
  ipcMain.handle('projectAnalyzer:isKnownProject', async (_event, workingDirectory: string) => {
    return isArborChatProject(workingDirectory)
  })

  console.log('[ProjectAnalyzer] IPC handlers registered')
}
