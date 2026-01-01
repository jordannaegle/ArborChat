/**
 * Arbor Memory IPC Handlers
 * 
 * Registers IPC handlers for the Arbor Memory Service,
 * exposing memory operations to the renderer process.
 * 
 * @module main/memory/handlers
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ArborMemoryService } from '../services/ArborMemoryService';
import type {
  MemoryQuery,
  StoreMemoryRequest,
  UpdateMemoryRequest
} from '../../shared/types/memory';

/**
 * Register all memory-related IPC handlers.
 * Should be called during app initialization.
 */
export function setupMemoryHandlers(): void {
  const memoryService = ArborMemoryService.getInstance();

  // ─────────────────────────────────────────────────────────────────────────
  // Context Retrieval (Primary method for conversation start)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get context memories for conversation injection.
   * Called at conversation start for automatic memory loading.
   */
  ipcMain.handle('memory:getContext', async (
    _event: IpcMainInvokeEvent,
    options: {
      conversationId?: string;
      projectPath?: string;
      searchText?: string;
      maxTokens?: number;
    }
  ) => {
    return memoryService.getContextMemories(options);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Storage
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Store a new memory.
   */
  ipcMain.handle('memory:store', async (
    _event: IpcMainInvokeEvent,
    request: StoreMemoryRequest
  ) => {
    return memoryService.storeMemory(request);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Querying
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Query memories with filters.
   */
  ipcMain.handle('memory:query', async (
    _event: IpcMainInvokeEvent,
    query: MemoryQuery
  ) => {
    return memoryService.queryMemories(query);
  });

  /**
   * Full-text search memories.
   */
  ipcMain.handle('memory:search', async (
    _event: IpcMainInvokeEvent,
    searchText: string,
    limit?: number
  ) => {
    return memoryService.searchMemories(searchText, limit);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get a single memory by ID.
   */
  ipcMain.handle('memory:get', async (
    _event: IpcMainInvokeEvent,
    id: string
  ) => {
    return memoryService.getMemory(id);
  });

  /**
   * Update an existing memory.
   */
  ipcMain.handle('memory:update', async (
    _event: IpcMainInvokeEvent,
    request: UpdateMemoryRequest
  ) => {
    return memoryService.updateMemory(request);
  });

  /**
   * Delete a memory.
   */
  ipcMain.handle('memory:delete', async (
    _event: IpcMainInvokeEvent,
    id: string
  ) => {
    return memoryService.deleteMemory(id);
  });

  /**
   * Clear all memories.
   */
  ipcMain.handle('memory:clearAll', async () => {
    return memoryService.clearAll();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get memory statistics.
   */
  ipcMain.handle('memory:getStats', async () => {
    return memoryService.getStats();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Decay & Compaction
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get compaction candidates for AI summarization.
   */
  ipcMain.handle('memory:getCompactionCandidates', async (
    _event: IpcMainInvokeEvent,
    limit?: number
  ) => {
    return memoryService.getCompactionCandidates(limit);
  });

  /**
   * Apply compaction summary to a memory.
   */
  ipcMain.handle('memory:applyCompaction', async (
    _event: IpcMainInvokeEvent,
    memoryId: string,
    summary: string
  ) => {
    return memoryService.applyCompaction(memoryId, summary);
  });

  /**
   * Run decay process (typically called by scheduler).
   */
  ipcMain.handle('memory:runDecay', async () => {
    return memoryService.runDecay();
  });

  console.log('[ArborMemory] IPC handlers registered');
}

/**
 * Cleanup memory service resources.
 * Should be called before app quit.
 */
export function cleanupMemoryService(): void {
  try {
    ArborMemoryService.getInstance().close();
    console.log('[ArborMemory] Service cleaned up');
  } catch (error) {
    console.error('[ArborMemory] Cleanup error:', error);
  }
}
