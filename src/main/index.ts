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
import { setupPersonaHandlers } from './personas'
import { credentialManager, ProviderId } from './credentials'

// Select the appropriate icon based on platform
function getAppIcon(): string {
  if (process.platform === 'win32') {
    return iconIco
  }
  // Linux and macOS use PNG (macOS uses .icns from electron-builder for production)
  return iconPng
}

function createWindow(): void {
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

  // Dialog Handlers
  ipcMain.handle('dialog:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Working Directory'
    })
    return result.canceled ? null : result.filePaths[0]
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
      default:
        return false
    }
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

  // Setup MCP handlers for tool execution
  setupMCPHandlers()

  // Setup Persona handlers for AI personalities
  setupPersonaHandlers()

  createWindow()

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
  console.log('[App] Cleaning up MCP connections...')
  await mcpManager.disconnectAll()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
