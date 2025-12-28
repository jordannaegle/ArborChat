// src/main/credentials/manager.ts

import { safeStorage, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { ProviderId, EncryptedCredentials } from './types'

const CREDENTIALS_FILE = 'provider-credentials.enc'
const SCHEMA_VERSION = 1

/**
 * Centralized credential management for all AI providers.
 * Uses Electron's safeStorage API for OS-level encryption.
 */
class CredentialManager {
  private credentialsPath: string
  private cache: EncryptedCredentials | null = null

  constructor() {
    this.credentialsPath = path.join(app.getPath('userData'), CREDENTIALS_FILE)
  }

  /**
   * Check if secure storage is available on this system
   */
  isSecureStorageAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  /**
   * Load credentials from encrypted storage
   */
  private async loadCredentials(): Promise<EncryptedCredentials> {
    if (this.cache) return this.cache

    if (!fs.existsSync(this.credentialsPath)) {
      return { version: SCHEMA_VERSION, providers: {} }
    }

    try {
      const encryptedData = fs.readFileSync(this.credentialsPath)
      const decryptedString = safeStorage.decryptString(encryptedData)
      this.cache = JSON.parse(decryptedString)
      return this.cache!
    } catch (error) {
      console.error('[Credentials] Failed to load:', error)
      return { version: SCHEMA_VERSION, providers: {} }
    }
  }

  /**
   * Save credentials to encrypted storage
   */
  private async saveCredentials(credentials: EncryptedCredentials): Promise<void> {
    const jsonString = JSON.stringify(credentials)
    const encryptedBuffer = safeStorage.encryptString(jsonString)
    fs.writeFileSync(this.credentialsPath, encryptedBuffer)
    this.cache = credentials
    console.log('[Credentials] Saved to', this.credentialsPath)
  }

  /**
   * Get API key for a specific provider
   */
  async getApiKey(providerId: ProviderId): Promise<string | null> {
    const credentials = await this.loadCredentials()
    const cred = credentials.providers[providerId]
    
    if (cred?.apiKey) {
      // Update last used timestamp
      cred.lastUsedAt = new Date().toISOString()
      await this.saveCredentials(credentials)
    }
    
    return cred?.apiKey || null
  }

  /**
   * Set API key for a specific provider
   */
  async setApiKey(providerId: ProviderId, apiKey: string): Promise<void> {
    if (!this.isSecureStorageAvailable()) {
      throw new Error('Secure storage is not available on this system')
    }

    const credentials = await this.loadCredentials()
    credentials.providers[providerId] = {
      apiKey,
      createdAt: new Date().toISOString()
    }
    await this.saveCredentials(credentials)
    console.log(`[Credentials] ${providerId} API key saved securely`)
  }

  /**
   * Delete API key for a specific provider
   */
  async deleteApiKey(providerId: ProviderId): Promise<void> {
    const credentials = await this.loadCredentials()
    delete credentials.providers[providerId]
    await this.saveCredentials(credentials)
    console.log(`[Credentials] ${providerId} API key deleted`)
  }

  /**
   * Check if a provider has an API key configured
   */
  async hasApiKey(providerId: ProviderId): Promise<boolean> {
    const key = await this.getApiKey(providerId)
    return key !== null && key.length > 0
  }

  /**
   * Get a map of which providers have keys configured
   */
  async getConfiguredProviders(): Promise<Partial<Record<ProviderId, boolean>>> {
    const credentials = await this.loadCredentials()
    const result: Partial<Record<ProviderId, boolean>> = {}
    
    for (const providerId of Object.keys(credentials.providers) as ProviderId[]) {
      const cred = credentials.providers[providerId]
      result[providerId] = !!(cred?.apiKey && cred.apiKey.length > 0)
    }
    
    return result
  }

  /**
   * Get creation date of a provider's API key
   */
  async getKeyCreatedAt(providerId: ProviderId): Promise<string | undefined> {
    const credentials = await this.loadCredentials()
    return credentials.providers[providerId]?.createdAt
  }

  /**
   * Clear the in-memory cache
   */
  clearCache(): void {
    this.cache = null
  }

  /**
   * Get the credentials file path (for debugging)
   */
  getCredentialsPath(): string {
    return this.credentialsPath
  }
}

// Singleton export
export const credentialManager = new CredentialManager()
