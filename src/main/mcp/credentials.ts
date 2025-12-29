// src/main/mcp/credentials.ts

import { safeStorage, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

const CREDENTIALS_FILE = 'mcp-credentials.enc'

/**
 * SSH Connection - represents a single named SSH connection
 */
export interface SSHConnection {
  id: string           // UUID
  name: string         // User-friendly name (e.g., "DEV", "PROD")
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  password?: string
  keyPath?: string
  createdAt: string
  enabled: boolean     // Whether to connect this server
}

interface MCPCredentials {
  github?: {
    personalAccessToken: string
    tokenScopes?: string[]
    createdAt: string
  }
  // Legacy single SSH connection (kept for migration)
  ssh?: {
    host: string
    port: number
    username: string
    authType: 'password' | 'key'
    password?: string
    keyPath?: string
    createdAt: string
  }
  // New: Multiple named SSH connections
  sshConnections?: SSHConnection[]
}

/**
 * Check if the system supports secure storage
 */
export function isSecureStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * Get the credentials file path
 */
function getCredentialsPath(): string {
  return path.join(app.getPath('userData'), CREDENTIALS_FILE)
}

/**
 * Load credentials from encrypted storage
 */
async function loadCredentials(): Promise<MCPCredentials> {
  const credPath = getCredentialsPath()

  if (!fs.existsSync(credPath)) {
    return {}
  }

  try {
    const encryptedData = fs.readFileSync(credPath)
    const decryptedString = safeStorage.decryptString(encryptedData)
    return JSON.parse(decryptedString)
  } catch (error) {
    console.error('[Credentials] Failed to load:', error)
    return {}
  }
}

/**
 * Save credentials to encrypted storage
 */
async function saveCredentials(credentials: MCPCredentials): Promise<void> {
  const credPath = getCredentialsPath()
  const jsonString = JSON.stringify(credentials)
  const encryptedBuffer = safeStorage.encryptString(jsonString)
  fs.writeFileSync(credPath, encryptedBuffer)
  console.log('[Credentials] Saved to', credPath)
}

/**
 * Save GitHub PAT securely
 * @param token - The GitHub Personal Access Token
 * @param scopes - Optional array of scopes the token has
 */
export async function saveGitHubToken(token: string, scopes?: string[]): Promise<void> {
  if (!isSecureStorageAvailable()) {
    throw new Error('Secure storage is not available on this system')
  }

  const credentials = await loadCredentials()

  credentials.github = {
    personalAccessToken: token,
    tokenScopes: scopes,
    createdAt: new Date().toISOString()
  }

  await saveCredentials(credentials)
  console.log('[Credentials] GitHub token saved securely')
}

/**
 * Retrieve GitHub PAT
 * @returns The stored token or null if not configured
 */
export async function getGitHubToken(): Promise<string | null> {
  const credentials = await loadCredentials()
  return credentials.github?.personalAccessToken || null
}

/**
 * Get GitHub token scopes (if stored)
 * @returns The stored scopes or undefined
 */
export async function getGitHubTokenScopes(): Promise<string[] | undefined> {
  const credentials = await loadCredentials()
  return credentials.github?.tokenScopes
}

/**
 * Delete GitHub credentials
 */
export async function deleteGitHubToken(): Promise<void> {
  const credentials = await loadCredentials()
  delete credentials.github
  await saveCredentials(credentials)
  console.log('[Credentials] GitHub token deleted')
}

/**
 * Check if GitHub is configured
 * @returns True if a GitHub token is stored
 */
export async function isGitHubConfigured(): Promise<boolean> {
  const token = await getGitHubToken()
  return token !== null && token.length > 0
}

/**
 * Get the creation date of the stored GitHub token
 * @returns ISO date string or undefined if not configured
 */
export async function getGitHubTokenCreatedAt(): Promise<string | undefined> {
  const credentials = await loadCredentials()
  return credentials.github?.createdAt
}

// =====================
// SSH Credential Functions
// =====================

export interface SSHCredentials {
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  password?: string
  keyPath?: string
}

/**
 * Save SSH credentials securely
 */
export async function saveSSHCredentials(creds: SSHCredentials): Promise<void> {
  if (!isSecureStorageAvailable()) {
    throw new Error('Secure storage is not available on this system')
  }

  const credentials = await loadCredentials()

  credentials.ssh = {
    ...creds,
    createdAt: new Date().toISOString()
  }

  await saveCredentials(credentials)
  console.log('[Credentials] SSH credentials saved securely')
}

/**
 * Retrieve SSH credentials
 * @returns The stored SSH credentials or null if not configured
 */
export async function getSSHCredentials(): Promise<SSHCredentials | null> {
  const credentials = await loadCredentials()
  if (!credentials.ssh) return null

  return {
    host: credentials.ssh.host,
    port: credentials.ssh.port,
    username: credentials.ssh.username,
    authType: credentials.ssh.authType,
    password: credentials.ssh.password,
    keyPath: credentials.ssh.keyPath
  }
}

/**
 * Delete SSH credentials
 */
export async function deleteSSHCredentials(): Promise<void> {
  const credentials = await loadCredentials()
  delete credentials.ssh
  await saveCredentials(credentials)
  console.log('[Credentials] SSH credentials deleted')
}

/**
 * Check if SSH is configured
 * @returns True if SSH credentials are stored
 */
export async function isSSHConfigured(): Promise<boolean> {
  const creds = await getSSHCredentials()
  return creds !== null
}

/**
 * Get the creation date of the stored SSH credentials
 * @returns ISO date string or undefined if not configured
 */
export async function getSSHCredentialsCreatedAt(): Promise<string | undefined> {
  const credentials = await loadCredentials()
  return credentials.ssh?.createdAt
}

// =====================
// Multiple SSH Connections
// =====================

/**
 * Get all SSH connections
 */
export async function getSSHConnections(): Promise<SSHConnection[]> {
  const credentials = await loadCredentials()
  
  // Migrate legacy single connection if present
  if (credentials.ssh && (!credentials.sshConnections || credentials.sshConnections.length === 0)) {
    const migratedConnection: SSHConnection = {
      id: randomUUID(),
      name: 'Default',
      host: credentials.ssh.host,
      port: credentials.ssh.port,
      username: credentials.ssh.username,
      authType: credentials.ssh.authType,
      password: credentials.ssh.password,
      keyPath: credentials.ssh.keyPath,
      createdAt: credentials.ssh.createdAt,
      enabled: true
    }
    credentials.sshConnections = [migratedConnection]
    delete credentials.ssh
    await saveCredentials(credentials)
    console.log('[Credentials] Migrated legacy SSH connection to new format')
  }
  
  return credentials.sshConnections || []
}

/**
 * Get a single SSH connection by ID
 */
export async function getSSHConnectionById(id: string): Promise<SSHConnection | null> {
  const connections = await getSSHConnections()
  return connections.find(c => c.id === id) || null
}

/**
 * Get a single SSH connection by name
 */
export async function getSSHConnectionByName(name: string): Promise<SSHConnection | null> {
  const connections = await getSSHConnections()
  return connections.find(c => c.name.toLowerCase() === name.toLowerCase()) || null
}

/**
 * Add a new SSH connection
 */
export async function addSSHConnection(
  connection: Omit<SSHConnection, 'id' | 'createdAt'>
): Promise<SSHConnection> {
  if (!isSecureStorageAvailable()) {
    throw new Error('Secure storage is not available on this system')
  }

  const credentials = await loadCredentials()
  const connections = credentials.sshConnections || []

  // Check for duplicate names
  if (connections.some(c => c.name.toLowerCase() === connection.name.toLowerCase())) {
    throw new Error(`SSH connection with name "${connection.name}" already exists`)
  }

  const newConnection: SSHConnection = {
    ...connection,
    id: randomUUID(),
    createdAt: new Date().toISOString()
  }

  credentials.sshConnections = [...connections, newConnection]
  await saveCredentials(credentials)
  console.log(`[Credentials] Added SSH connection: ${newConnection.name}`)
  
  return newConnection
}

/**
 * Update an existing SSH connection
 */
export async function updateSSHConnection(
  id: string,
  updates: Partial<Omit<SSHConnection, 'id' | 'createdAt'>>
): Promise<SSHConnection | null> {
  const credentials = await loadCredentials()
  const connections = credentials.sshConnections || []
  
  const index = connections.findIndex(c => c.id === id)
  if (index === -1) {
    return null
  }

  // Check for duplicate names if name is being changed
  if (updates.name && updates.name !== connections[index].name) {
    if (connections.some(c => c.id !== id && c.name.toLowerCase() === updates.name!.toLowerCase())) {
      throw new Error(`SSH connection with name "${updates.name}" already exists`)
    }
  }

  const updatedConnection: SSHConnection = {
    ...connections[index],
    ...updates
  }

  connections[index] = updatedConnection
  credentials.sshConnections = connections
  await saveCredentials(credentials)
  console.log(`[Credentials] Updated SSH connection: ${updatedConnection.name}`)
  
  return updatedConnection
}

/**
 * Delete an SSH connection
 */
export async function deleteSSHConnection(id: string): Promise<boolean> {
  const credentials = await loadCredentials()
  const connections = credentials.sshConnections || []
  
  const index = connections.findIndex(c => c.id === id)
  if (index === -1) {
    return false
  }

  const deleted = connections.splice(index, 1)[0]
  credentials.sshConnections = connections
  await saveCredentials(credentials)
  console.log(`[Credentials] Deleted SSH connection: ${deleted.name}`)
  
  return true
}

/**
 * Get enabled SSH connections
 */
export async function getEnabledSSHConnections(): Promise<SSHConnection[]> {
  const connections = await getSSHConnections()
  return connections.filter(c => c.enabled)
}

/**
 * Check if any SSH connections are configured
 */
export async function hasSSHConnections(): Promise<boolean> {
  const connections = await getSSHConnections()
  return connections.length > 0
}
