/**
 * Personas Module
 * Entry point for persona management system
 * 
 * Sets up IPC handlers for renderer communication
 */

import { ipcMain } from 'electron'
import { personaService } from './service'
import { generatePersona } from './generator'
import { CreatePersonaInput, UpdatePersonaInput } from './types'

/**
 * Setup all persona-related IPC handlers
 * Call this during app initialization
 */
export function setupPersonaHandlers(): void {
  console.log('[Personas] Setting up IPC handlers...')

  // List all personas (metadata only)
  ipcMain.handle('personas:list', async () => {
    try {
      return await personaService.listPersonas()
    } catch (error) {
      console.error('[Personas] List failed:', error)
      throw error
    }
  })

  // Get single persona by ID (includes content)
  ipcMain.handle('personas:get', async (_, id: string) => {
    try {
      return await personaService.getPersona(id)
    } catch (error) {
      console.error(`[Personas] Get failed for ${id}:`, error)
      throw error
    }
  })

  // Create new persona
  ipcMain.handle('personas:create', async (_, input: CreatePersonaInput) => {
    try {
      return await personaService.createPersona(input)
    } catch (error) {
      console.error('[Personas] Create failed:', error)
      throw error
    }
  })

  // Update existing persona
  ipcMain.handle(
    'personas:update',
    async (_, { id, updates }: { id: string; updates: UpdatePersonaInput }) => {
      try {
        return await personaService.updatePersona(id, updates)
      } catch (error) {
        console.error(`[Personas] Update failed for ${id}:`, error)
        throw error
      }
    }
  )

  // Delete persona
  ipcMain.handle('personas:delete', async (_, id: string) => {
    try {
      await personaService.deletePersona(id)
      return { success: true }
    } catch (error) {
      console.error(`[Personas] Delete failed for ${id}:`, error)
      throw error
    }
  })

  // Get persona prompt content (for chat context injection)
  ipcMain.handle('personas:get-prompt', async (_, id: string) => {
    try {
      return await personaService.getPersonaPrompt(id)
    } catch (error) {
      console.error(`[Personas] Get prompt failed for ${id}:`, error)
      throw error
    }
  })

  // Generate persona using AI
  ipcMain.handle(
    'personas:generate',
    async (_, { description, name }: { description: string; name: string }) => {
      try {
        return await generatePersona(description, name)
      } catch (error) {
        console.error('[Personas] Generation failed:', error)
        throw error
      }
    }
  )

  // Get personas directory path (utility)
  ipcMain.handle('personas:get-directory', () => {
    return personaService.getPersonasDirectory()
  })

  console.log('[Personas] IPC handlers ready')
}

// Re-export for direct access if needed
export { personaService } from './service'
export { generatePersona } from './generator'
export * from './types'
