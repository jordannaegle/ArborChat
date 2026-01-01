import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import iconPng from '../../resources/icon.png?asset'
import iconIco from '../../resources/icon.ico?asset'
import {
  initDB,
  getConversations,
  createConversation,
  deleteConversation,
  updateConversationTitle,
  getMessages,
  addMessage,
  setApiKey,
  getApiKey,
  getSelectedModel,
  setSelectedModel,
  getOllamaServerUrl,
  setOllamaServerUrl
} from './db'
import { getAllAvailableModels } from './models'
import { OllamaProvider } from './providers/ollama'
import { setupMCPHandlers, mcpManager } from './mcp'
import { setupProjectAnalyzerHandlers } from './projectAnalyzer'
import { setupPersonaHandlers } from './personas'
import { setupNotificationHandlers, registerMainWindow } from './notifications'
import { setupWorkJournalHandlers, cleanupWorkJournalSubscriptions } from './workJournal'
import { setupNotebookHandlers } from './notebooks'
import { setupMemoryHandlers, cleanupMemoryService } from './memory'
import { getMemoryScheduler, tokenizer, countTokens, countTokensSync, truncateToTokens } from './services'
import { credentialManager, ProviderId } from './credentials'
import { getGitRepoInfo, getUncommittedFiles, getChangedFilesSinceBranch, getDiffStats, verifyChanges, getDiffSummary, isGitRepository, getDetailedStatus, commitChanges, getArborChatRoot } from './services'

// Select the appropriate icon based on platform
function getAppIcon(): string {
  if (process.platform === 'win32') {
    return iconIco
  }
  // Linux and macOS use PNG (macOS uses .icns from electron-builder for production)
  return iconPng
}

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon: getAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.arborchat')

  // Set dock icon on macOS (app.dock is undefined on Windows/Linux)
  // This ensures the correct icon shows in the macOS dock during development
  // Production builds use the .icns file specified in electron-builder.yml
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconPng)
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC Handlers
  ipcMain.handle('db:get-conversations', () => getConversations())
  ipcMain.handle('db:create-conversation', (_, title) => createConversation(title))
  ipcMain.handle('db:delete-conversation', (_, id) => deleteConversation(id))
  ipcMain.handle('db:update-conversation-title', (_, { id, title }) =>
    updateConversationTitle(id, title)
  )
  ipcMain.handle('db:get-messages', (_, conversationId) => getMessages(conversationId))
  ipcMain.handle('db:add-message', (_, { conversationId, role, content, parentId }) =>
    addMessage(conversationId, role, content, parentId)
  )
  ipcMain.handle('settings:save-key', (_, key) => setApiKey(key))
  ipcMain.handle('settings:get-key', () => getApiKey())
  ipcMain.handle('settings:get-model', () => getSelectedModel())
  ipcMain.handle('settings:set-model', (_, model) => setSelectedModel(model))
  ipcMain.handle('settings:get-ollama-url', () => getOllamaServerUrl())
  ipcMain.handle('settings:set-ollama-url', (_, url) => setOllamaServerUrl(url))

  // Tokenizer Handlers - accurate token counting for context management
  ipcMain.handle('tokenizer:count', async (_event, text: string, modelId?: string): Promise<number> => {
    return countTokens(text, modelId)
  })

  ipcMain.handle('tokenizer:countSync', (_event, text: string, modelId?: string): number => {
    return countTokensSync(text, modelId)
  })

  ipcMain.handle(
    'tokenizer:truncate',
    async (_event, text: string, maxTokens: number, modelId?: string): Promise<string> => {
      return truncateToTokens(text, maxTokens, modelId)
    }
  )

  ipcMain.handle('tokenizer:stats', (): { loadedEncodings: string[]; initialized: boolean } => {
    return tokenizer.getStats()
  })

  // Dialog Handlers
  ipcMain.handle('dialog:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Working Directory'
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Git Handlers
  ipcMain.handle('git:get-repo-info', async (_, directory: string) => {
    return getGitRepoInfo(directory)
  })

  ipcMain.handle('git:get-uncommitted-files', async (_, directory: string) => {
    return getUncommittedFiles(directory)
  })

  ipcMain.handle('git:get-changed-files-since-branch', async (_, { directory, baseBranch }) => {
    return getChangedFilesSinceBranch(directory, baseBranch)
  })

  ipcMain.handle('git:get-diff-stats', async (_, { directory, baseBranch }) => {
    return getDiffStats(directory, baseBranch)
  })

  // Phase 3: Git Verification Handlers
  ipcMain.handle('git:verify-changes', async (_, { workingDir, expectedFiles }) => {
    return verifyChanges(workingDir, expectedFiles)
  })

  ipcMain.handle('git:get-diff-summary', async (_, { workingDir }) => {
    return getDiffSummary(workingDir)
  })

  ipcMain.handle('git:is-repository', async (_, { workingDir }) => {
    return isGitRepository(workingDir)
  })

  ipcMain.handle('git:get-detailed-status', async (_, { workingDir }) => {
    return getDetailedStatus(workingDir)
  })

  // Git Commit Handler - for /commit slash command
  ipcMain.handle('git:commit', async (_, { workingDir, message }) => {
    return commitChanges(workingDir, message)
  })

  ipcMain.handle('git:get-arborchat-root', async () => {
    return getArborChatRoot()
  })

  // Model Discovery Handlers
  ipcMain.handle('models:get-available', async (_, { apiKey }) => {
    const ollamaUrl = getOllamaServerUrl()
    return getAllAvailableModels(apiKey, ollamaUrl)
  })

  ipcMain.handle('ollama:check-connection', async () => {
    const ollamaUrl = getOllamaServerUrl()
    const ollamaProvider = new OllamaProvider(ollamaUrl)
    return ollamaProvider.validateConnection()
  })

  // Credential Management Handlers
  ipcMain.handle('credentials:get-configured', async () => {
    return credentialManager.getConfiguredProviders()
  })

  ipcMain.handle('credentials:has-key', async (_, providerId: string) => {
    return credentialManager.hasApiKey(providerId as ProviderId)
  })

  ipcMain.handle('credentials:get-key', async (_, providerId: string) => {
    return credentialManager.getApiKey(providerId as ProviderId)
  })

  ipcMain.handle('credentials:set-key', async (_, { providerId, apiKey }) => {
    await credentialManager.setApiKey(providerId as ProviderId, apiKey)
    return { success: true }
  })

  ipcMain.handle('credentials:delete-key', async (_, providerId: string) => {
    await credentialManager.deleteApiKey(providerId as ProviderId)
    return { success: true }
  })

  ipcMain.handle('credentials:validate-key', async (_, { providerId, apiKey }) => {
    // Import providers dynamically to avoid circular dependencies
    switch (providerId) {
      case 'gemini': {
        const { GeminiProvider } = await import('./providers/gemini')
        return new GeminiProvider().validateConnection(apiKey)
      }
      case 'anthropic': {
        const { AnthropicProvider } = await import('./providers/anthropic')
        return new AnthropicProvider().validateConnection(apiKey)
      }
      case 'openai': {
        const { OpenAIProvider } = await import('./providers/openai')
        return new OpenAIProvider().validateConnection(apiKey)
      }
      case 'github': {
        const { GitHubCopilotProvider } = await import('./providers/github-copilot')
        return new GitHubCopilotProvider().validateConnection(apiKey)
      }
      case 'mistral': {
        const { MistralProvider } = await import('./providers/mistral')
        return new MistralProvider().validateConnection(apiKey)
      }
      default:
        return false
    }
  })

  // MCP Filesystem Handlers
  ipcMain.handle('mcp:filesystem:select-directory', async () => {
    console.log('[MCP Filesystem] Opening directory picker...')
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Filesystem Access Directory'
    })

    if (result.canceled || !result.filePaths[0]) {
      console.log('[MCP Filesystem] Directory selection canceled')
      return null
    }

    const selectedPath = result.filePaths[0]
    console.log('[MCP Filesystem] Directory selected:', selectedPath)

    // Update the filesystem server config
    const { updateFilesystemAllowedDirectory } = await import('./mcp')
    const { updateMCPConfig, loadMCPConfig } = await import('./mcp/config')

    const config = loadMCPConfig()
    console.log(
      '[MCP Filesystem] Current config servers:',
      config.servers.map((s) => s.name)
    )

    const updatedFilesystemConfig = updateFilesystemAllowedDirectory(selectedPath)
    console.log('[MCP Filesystem] Updated filesystem config:', updatedFilesystemConfig)

    // Find and update the filesystem server in the config
    const serverIndex = config.servers.findIndex((s) => s.name === 'filesystem')
    console.log('[MCP Filesystem] Server index in config:', serverIndex)

    if (serverIndex !== -1) {
      // Enable the server when directory is configured
      updatedFilesystemConfig.enabled = true
      config.servers[serverIndex] = updatedFilesystemConfig
      console.log('[MCP Filesystem] Updating config with enabled server')
      updateMCPConfig(config)
      console.log('[MCP Filesystem] Config saved successfully')
    } else {
      console.error('[MCP Filesystem] ERROR: Filesystem server not found in config!')
    }

    return selectedPath
  })

  ipcMain.handle('mcp:filesystem:get-allowed-directory', async () => {
    const { loadMCPConfig } = await import('./mcp/config')
    const config = loadMCPConfig()
    const filesystemServer = config.servers.find((s) => s.name === 'filesystem')

    console.log('[MCP Filesystem] Getting allowed directory')
    console.log('[MCP Filesystem] Filesystem server config:', filesystemServer)

    if (filesystemServer && filesystemServer.args.length > 2) {
      // The directory is the third argument after '-y' and the package name
      const directory = filesystemServer.args[2]
      console.log('[MCP Filesystem] Found directory:', directory)
      return directory
    }

    console.log('[MCP Filesystem] No directory configured')
    return null
  })

  ipcMain.handle('mcp:filesystem:set-allowed-directory', async (_, directory: string) => {
    const { updateFilesystemAllowedDirectory } = await import('./mcp')
    const { updateMCPConfig, loadMCPConfig } = await import('./mcp/config')

    const config = loadMCPConfig()
    const updatedFilesystemConfig = updateFilesystemAllowedDirectory(directory)

    const serverIndex = config.servers.findIndex((s) => s.name === 'filesystem')
    if (serverIndex !== -1) {
      config.servers[serverIndex] = updatedFilesystemConfig
      updateMCPConfig(config)

      // Reconnect the server if it's already connected
      const { mcpManager } = await import('./mcp')
      if (mcpManager.isServerConnected('filesystem')) {
        await mcpManager.reconnectServer('filesystem')
      }
    }
  })

  // MCP Brave Search Handlers
  ipcMain.handle('mcp:brave-search:validate-key', async (_, apiKey: string) => {
    // Simple validation - just check if the key looks valid
    // A real validation would make a test API call
    if (!apiKey || apiKey.length < 10) {
      return { valid: false, error: 'API key is too short' }
    }

    // TODO: Make actual test API call to Brave Search
    // For now, just accept any non-empty key
    return { valid: true }
  })

  // MCP Memory Handlers
  ipcMain.handle('mcp:memory:clear-all', async () => {
    // Memory server doesn't have a built-in clear method
    // We would need to call delete operations for all entities
    // For now, return success - this can be implemented later
    console.log('[MCP] Memory clear-all requested')
    return { success: true, message: 'Memory clear not yet implemented' }
  })

  ipcMain.handle('mcp:memory:get-stats', async () => {
    // Memory server doesn't expose stats directly
    // This would need to be implemented by querying the memory server
    console.log('[MCP] Memory stats requested')
    return { count: 0, size: 0, message: 'Stats not yet implemented' }
  })

  // AI Handlers
  ipcMain.on('ai:ask', (event, { apiKey, messages, model }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      import('./ai').then(({ streamResponse }) => {
        streamResponse(win, apiKey, messages, model)
      })
    }
  })

  initDB()

  // Initialize tokenizer service for accurate token counting
  tokenizer.init().catch(err => console.error('[Tokenizer] Init error:', err))

  // Setup MCP handlers for tool execution
  setupMCPHandlers()

  // Setup Project Analyzer handlers for intelligent context injection
  setupProjectAnalyzerHandlers()

  // Setup Persona handlers for AI personalities
  setupPersonaHandlers()

  // Setup Notification handlers for desktop notifications
  setupNotificationHandlers()

  // Setup Work Journal handlers for agent work persistence
  setupWorkJournalHandlers()

  // Setup Notebook handlers for saving chat content
  setupNotebookHandlers()

  // Setup Arbor Memory handlers for native memory service
  setupMemoryHandlers()

  // Start memory decay scheduler (runs daily to maintain memory relevance)
  const memoryScheduler = getMemoryScheduler()
  memoryScheduler.start()

  const mainWindow = createWindow()
  
  // Register main window with notification manager
  registerMainWindow(mainWindow)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup MCP connections before quitting
app.on('before-quit', async () => {
  console.log('[App] Cleaning up...')
  
  // Stop memory scheduler
  const memoryScheduler = getMemoryScheduler()
  memoryScheduler.stop()
  
  cleanupWorkJournalSubscriptions()
  cleanupMemoryService()
  await mcpManager.disconnectAll()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
