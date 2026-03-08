import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import { credentialManager, ProviderId } from '../credentials'
import {
  AIModel,
  EnsureUsableModelResult,
  ModelDiscoveryResult,
  ModelProbeResult,
  ProviderDiscoveryState,
  ProviderValidationStatus
} from '../providers/types'
import { AIProvider } from '../providers/base'
import { AnthropicProvider } from '../providers/anthropic'
import { OpenAIProvider } from '../providers/openai'
import { MistralProvider } from '../providers/mistral'
import { GeminiProvider } from '../providers/gemini'
import { GitHubCopilotProvider } from '../providers/github-copilot'
import { OllamaProvider } from '../providers/ollama'
import {
  deleteExpiredModelAccessCache,
  deleteModelAccessCacheForProvider,
  deleteModelAccessCacheMissingModels,
  deleteProviderDiscoveryState,
  getModelAccessCacheRows,
  getProviderDiscoveryStateRow,
  getUsableModelAccessCacheRows,
  upsertModelAccessCache,
  upsertProviderDiscoveryState
} from '../db'

export interface ModelCatalogOptions {
  triggerRefreshIfStale?: boolean
  includeOllama?: boolean
  ollamaUrl?: string
}

type CloudProviderId = Exclude<ProviderId, 'ollama'>

type ProviderRegistry = Record<CloudProviderId, AIProvider>

const CLOUD_PROVIDERS: CloudProviderId[] = ['anthropic', 'openai', 'mistral', 'github', 'gemini']

const MODEL_UPDATE_EVENT = 'models:updated'

const PROBE_TIMEOUT_MS = 8000
const PROBE_RETRY_DELAYS_MS = [500, 1500]
const PROBE_CONCURRENCY = 3

const VERIFIED_TTL_MS: Record<ProviderId, number> = {
  anthropic: 6 * 60 * 60 * 1000,
  openai: 6 * 60 * 60 * 1000,
  mistral: 6 * 60 * 60 * 1000,
  gemini: 6 * 60 * 60 * 1000,
  github: 30 * 60 * 1000,
  ollama: 30 * 1000
}

const DENIED_TTL_MS = 10 * 60 * 1000
const TRANSIENT_TTL_MS = 2 * 60 * 1000
const STALE_TTL_MS = 30 * 60 * 1000

const EMPTY_PROVIDER_STATE: Record<ProviderId, ProviderDiscoveryState> = {
  anthropic: { providerId: 'anthropic', status: 'idle', modelCount: 0 },
  openai: { providerId: 'openai', status: 'idle', modelCount: 0 },
  mistral: { providerId: 'mistral', status: 'idle', modelCount: 0 },
  github: { providerId: 'github', status: 'idle', modelCount: 0 },
  gemini: { providerId: 'gemini', status: 'idle', modelCount: 0 },
  ollama: { providerId: 'ollama', status: 'idle', modelCount: 0 }
}

interface ProbedModelResult {
  model: AIModel
  probe: ModelProbeResult
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((result) => {
        clearTimeout(timeout)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeout)
        reject(error)
      })
  })
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function dedupeModels(models: AIModel[]): AIModel[] {
  const seen = new Set<string>()
  const deduped: AIModel[] = []
  for (const model of models) {
    const key = `${model.provider}:${model.id}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(model)
  }
  return deduped
}

function isTransientValidationStatus(status: ProviderValidationStatus): boolean {
  return status === 'network_error' || status === 'rate_limited'
}

function mapModelIdToProvider(modelId: string): ProviderId | null {
  if (modelId.startsWith('github:')) return 'github'
  if (modelId.startsWith('claude-')) return 'anthropic'
  if (modelId.startsWith('gemini-')) return 'gemini'
  if (
    modelId.startsWith('mistral-') ||
    modelId.startsWith('codestral-') ||
    modelId.startsWith('ministral-') ||
    modelId.startsWith('pixtral-')
  ) {
    return 'mistral'
  }
  if (
    modelId.startsWith('gpt-') ||
    modelId.startsWith('o1') ||
    modelId.startsWith('o3') ||
    modelId.startsWith('o4') ||
    modelId.startsWith('o5')
  ) {
    return 'openai'
  }
  if (modelId.includes(':')) return 'ollama'
  return null
}

function scoreFallback(model: AIModel): number {
  const id = model.id.toLowerCase()
  if (id.includes('opus')) return 100
  if (id.includes('gpt-5')) return 98
  if (id.includes('pro')) return 95
  if (id.includes('sonnet')) return 90
  if (id.includes('large')) return 88
  if (id.includes('o3')) return 85
  if (id.includes('flash')) return 75
  if (id.includes('medium')) return 70
  if (id.includes('mini')) return 65
  if (id.includes('haiku')) return 60
  if (id.includes('small')) return 55
  if (id.includes('nano')) return 45
  return 50
}

function selectBestFallback(models: AIModel[]): AIModel | null {
  if (models.length === 0) return null
  const sorted = [...models].sort((a, b) => {
    const scoreDiff = scoreFallback(b) - scoreFallback(a)
    if (scoreDiff !== 0) return scoreDiff
    return a.name.localeCompare(b.name)
  })
  return sorted[0] || null
}

export class ModelDiscoveryService {
  private readonly emitter = new EventEmitter()
  private readonly providers: ProviderRegistry = {
    anthropic: new AnthropicProvider(),
    openai: new OpenAIProvider(),
    mistral: new MistralProvider(),
    github: new GitHubCopilotProvider(),
    gemini: new GeminiProvider()
  }

  private readonly refreshingProviders = new Map<string, Promise<void>>()
  private cachedOllamaModels: AIModel[] = []
  private lastOllamaFetch = 0

  onUpdated(listener: (catalog: ModelDiscoveryResult) => void): () => void {
    this.emitter.on(MODEL_UPDATE_EVENT, listener)
    return () => this.emitter.off(MODEL_UPDATE_EVENT, listener)
  }

  private async emitCatalogUpdate(): Promise<void> {
    const catalog = await this.getCatalog({ triggerRefreshIfStale: false })
    this.emitter.emit(MODEL_UPDATE_EVENT, catalog)
  }

  private refreshKey(providerId: CloudProviderId, fingerprint: string): string {
    return `${providerId}:${fingerprint}`
  }

  private isProviderStale(
    providerId: CloudProviderId,
    stateLastRefreshAt: number | undefined,
    now: number,
    hasUsableModels: boolean
  ): boolean {
    if (!stateLastRefreshAt) {
      return true
    }
    const age = now - stateLastRefreshAt
    if (age > VERIFIED_TTL_MS[providerId]) {
      return true
    }
    return !hasUsableModels
  }

  private mapCacheRowToModel(providerId: CloudProviderId, row: { model_id: string; display_name: string; description: string }): AIModel {
    return {
      id: row.model_id,
      name: row.display_name,
      description: row.description,
      provider: providerId,
      isLocal: false
    }
  }

  private readCloudProviderState(
    providerId: CloudProviderId,
    fingerprint: string,
    modelCount: number,
    fallbackStatus: ProviderDiscoveryState['status']
  ): ProviderDiscoveryState {
    const refreshState = getProviderDiscoveryStateRow(providerId, fingerprint)
    const key = this.refreshKey(providerId, fingerprint)
    const isRefreshing = this.refreshingProviders.has(key)

    if (isRefreshing) {
      return {
        providerId,
        status: 'refreshing',
        modelCount,
        lastRefreshAt: refreshState?.last_refresh_at,
        message: refreshState?.error_message || undefined
      }
    }

    if (!refreshState) {
      return {
        providerId,
        status: fallbackStatus,
        modelCount
      }
    }

    const status = refreshState.refresh_status as ProviderDiscoveryState['status']
    return {
      providerId,
      status,
      modelCount,
      lastRefreshAt: refreshState.last_refresh_at,
      message: refreshState.error_message || undefined
    }
  }

  private async getOllamaModels(ollamaUrl?: string): Promise<AIModel[]> {
    const now = Date.now()
    if (this.cachedOllamaModels.length > 0 && now - this.lastOllamaFetch < VERIFIED_TTL_MS.ollama) {
      return this.cachedOllamaModels
    }

    try {
      const provider = new OllamaProvider(ollamaUrl)
      const models = await provider.getAvailableModels()
      this.cachedOllamaModels = models
      this.lastOllamaFetch = now
      return models
    } catch (error) {
      console.error('[ModelDiscovery] Failed to fetch Ollama models:', error)
      return this.cachedOllamaModels
    }
  }

  async getCatalog(options: ModelCatalogOptions = {}): Promise<ModelDiscoveryResult> {
    const triggerRefreshIfStale = options.triggerRefreshIfStale !== false
    const includeOllama = options.includeOllama !== false

    const now = Date.now()
    deleteExpiredModelAccessCache(now)

    const providerStates: Record<ProviderId, ProviderDiscoveryState> = {
      anthropic: { ...EMPTY_PROVIDER_STATE.anthropic },
      openai: { ...EMPTY_PROVIDER_STATE.openai },
      mistral: { ...EMPTY_PROVIDER_STATE.mistral },
      github: { ...EMPTY_PROVIDER_STATE.github },
      gemini: { ...EMPTY_PROVIDER_STATE.gemini },
      ollama: { ...EMPTY_PROVIDER_STATE.ollama }
    }

    const models: AIModel[] = []

    for (const providerId of CLOUD_PROVIDERS) {
      const apiKey = await credentialManager.peekApiKey(providerId)
      if (!apiKey) {
        providerStates[providerId] = {
          providerId,
          status: 'no_key',
          modelCount: 0
        }
        continue
      }

      const fingerprint = hashToken(apiKey)
      const usableRows = getUsableModelAccessCacheRows(providerId, fingerprint, now)
      const cloudModels = usableRows.map((row) => this.mapCacheRowToModel(providerId, row))
      models.push(...cloudModels)

      providerStates[providerId] = this.readCloudProviderState(
        providerId,
        fingerprint,
        cloudModels.length,
        cloudModels.length > 0 ? 'ready' : 'idle'
      )

      const stale = this.isProviderStale(
        providerId,
        providerStates[providerId].lastRefreshAt,
        now,
        cloudModels.length > 0
      )

      if (triggerRefreshIfStale && stale && providerStates[providerId].status !== 'refreshing') {
        void this.refreshProvider(providerId, { ollamaUrl: options.ollamaUrl })
      }
    }

    if (includeOllama) {
      const ollamaModels = await this.getOllamaModels(options.ollamaUrl)
      models.push(...ollamaModels)
      providerStates.ollama = {
        providerId: 'ollama',
        status: ollamaModels.length > 0 ? 'ready' : 'error',
        modelCount: ollamaModels.length,
        lastRefreshAt: this.lastOllamaFetch,
        message: ollamaModels.length > 0 ? undefined : 'Ollama not reachable'
      }
    }

    return {
      models: dedupeModels(models),
      providerStates,
      refreshedAt: Date.now()
    }
  }

  async refreshAllProviders(ollamaUrl?: string): Promise<void> {
    await Promise.all(CLOUD_PROVIDERS.map((providerId) => this.refreshProvider(providerId, { ollamaUrl })))
    this.cachedOllamaModels = []
    this.lastOllamaFetch = 0
    await this.getOllamaModels(ollamaUrl)
    await this.emitCatalogUpdate()
  }

  async refreshProvider(providerId: ProviderId, options: { ollamaUrl?: string } = {}): Promise<void> {
    if (providerId === 'ollama') {
      this.cachedOllamaModels = []
      this.lastOllamaFetch = 0
      await this.getOllamaModels(options.ollamaUrl)
      await this.emitCatalogUpdate()
      return
    }

    const provider = this.providers[providerId]
    const apiKey = await credentialManager.peekApiKey(providerId)

    if (!apiKey) {
      deleteModelAccessCacheForProvider(providerId)
      deleteProviderDiscoveryState(providerId)
      await this.emitCatalogUpdate()
      return
    }

    const fingerprint = hashToken(apiKey)
    const refreshKey = this.refreshKey(providerId, fingerprint)
    const activeRefresh = this.refreshingProviders.get(refreshKey)
    if (activeRefresh) {
      await activeRefresh
      return
    }

    const refreshPromise = this.runCloudRefresh(providerId, provider, apiKey, fingerprint)
      .catch((error) => {
        console.error(`[ModelDiscovery] Failed to refresh ${providerId}:`, error)
      })
      .finally(() => {
        this.refreshingProviders.delete(refreshKey)
      })

    this.refreshingProviders.set(refreshKey, refreshPromise)
    await refreshPromise
    await this.emitCatalogUpdate()
  }

  private async runCloudRefresh(
    providerId: CloudProviderId,
    provider: AIProvider,
    apiKey: string,
    fingerprint: string
  ): Promise<void> {
    const now = Date.now()

    upsertProviderDiscoveryState({
      provider_id: providerId,
      token_fingerprint: fingerprint,
      last_refresh_at: now,
      refresh_status: 'refreshing',
      error_code: null,
      error_message: null
    })

    const validation = await provider.validateConnection(apiKey)
    if (validation.status !== 'ok') {
      if (isTransientValidationStatus(validation.status)) {
        this.promoteExistingToStale(providerId, fingerprint, now)
      } else {
        deleteModelAccessCacheForProvider(providerId, fingerprint)
      }

      upsertProviderDiscoveryState({
        provider_id: providerId,
        token_fingerprint: fingerprint,
        last_refresh_at: now,
        refresh_status: 'error',
        error_code: validation.status,
        error_message: validation.message || null
      })
      return
    }

    let candidates: AIModel[] = []
    try {
      candidates = await provider.listCandidateModels(apiKey)
    } catch (error) {
      this.promoteExistingToStale(providerId, fingerprint, now)
      upsertProviderDiscoveryState({
        provider_id: providerId,
        token_fingerprint: fingerprint,
        last_refresh_at: now,
        refresh_status: 'error',
        error_code: 'network_error',
        error_message: error instanceof Error ? error.message : 'Failed to load provider model catalog'
      })
      return
    }

    if (candidates.length === 0) {
      deleteModelAccessCacheMissingModels(providerId, fingerprint, [])
      upsertProviderDiscoveryState({
        provider_id: providerId,
        token_fingerprint: fingerprint,
        last_refresh_at: now,
        refresh_status: 'ready',
        error_code: null,
        error_message: null
      })
      return
    }

    const existingRows = getModelAccessCacheRows(providerId, fingerprint)
    const existingById = new Map(existingRows.map((row) => [row.model_id, row]))

    const probedModels = await this.probeCandidates(provider, apiKey, candidates)

    for (const { model, probe } of probedModels) {
      const existing = existingById.get(model.id)

      if (probe.status === 'verified') {
        upsertModelAccessCache({
          provider_id: providerId,
          token_fingerprint: fingerprint,
          model_id: model.id,
          display_name: model.name,
          description: model.description,
          status: 'verified',
          last_checked_at: now,
          expires_at: now + VERIFIED_TTL_MS[providerId],
          deny_code: null,
          deny_message: null
        })
        continue
      }

      if (probe.status === 'denied') {
        upsertModelAccessCache({
          provider_id: providerId,
          token_fingerprint: fingerprint,
          model_id: model.id,
          display_name: model.name,
          description: model.description,
          status: 'denied',
          last_checked_at: now,
          expires_at: now + DENIED_TTL_MS,
          deny_code: probe.code || null,
          deny_message: probe.message || null
        })
        continue
      }

      if (existing && (existing.status === 'verified' || existing.status === 'stale')) {
        upsertModelAccessCache({
          provider_id: providerId,
          token_fingerprint: fingerprint,
          model_id: model.id,
          display_name: existing.display_name,
          description: existing.description,
          status: 'stale',
          last_checked_at: now,
          expires_at: now + STALE_TTL_MS,
          deny_code: probe.code || null,
          deny_message: probe.message || null
        })
      } else {
        upsertModelAccessCache({
          provider_id: providerId,
          token_fingerprint: fingerprint,
          model_id: model.id,
          display_name: model.name,
          description: model.description,
          status: 'transient_error',
          last_checked_at: now,
          expires_at: now + TRANSIENT_TTL_MS,
          deny_code: probe.code || null,
          deny_message: probe.message || null
        })
      }
    }

    deleteModelAccessCacheMissingModels(
      providerId,
      fingerprint,
      candidates.map((model) => model.id)
    )

    const usableRows = getUsableModelAccessCacheRows(providerId, fingerprint, now)
    upsertProviderDiscoveryState({
      provider_id: providerId,
      token_fingerprint: fingerprint,
      last_refresh_at: now,
      refresh_status: 'ready',
      error_code: null,
      error_message: null
    })

    if (usableRows.length === 0 && probedModels.some((entry) => entry.probe.status === 'transient_error')) {
      upsertProviderDiscoveryState({
        provider_id: providerId,
        token_fingerprint: fingerprint,
        last_refresh_at: now,
        refresh_status: 'error',
        error_code: 'network_error',
        error_message: 'Provider probe requests failed. Retrying with stale cache.'
      })
      this.promoteExistingToStale(providerId, fingerprint, now)
    }
  }

  private async probeCandidates(
    provider: AIProvider,
    apiKey: string,
    models: AIModel[]
  ): Promise<ProbedModelResult[]> {
    const results: ProbedModelResult[] = []
    let index = 0

    const worker = async (): Promise<void> => {
      while (index < models.length) {
        const current = index
        index += 1
        const model = models[current]
        if (!model) continue

        const probe = await this.probeWithRetry(provider, model, apiKey)
        results.push({ model, probe })
      }
    }

    const workerCount = Math.min(PROBE_CONCURRENCY, models.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
    return results
  }

  private async probeWithRetry(
    provider: AIProvider,
    model: AIModel,
    apiKey: string
  ): Promise<ModelProbeResult> {
    for (let attempt = 0; attempt <= PROBE_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const result = await withTimeout(provider.probeModelAccess(model, apiKey), PROBE_TIMEOUT_MS)

        const shouldRetry =
          result.status === 'transient_error' && attempt < PROBE_RETRY_DELAYS_MS.length

        if (!shouldRetry) {
          return result
        }
      } catch (error) {
        if (attempt === PROBE_RETRY_DELAYS_MS.length) {
          return {
            status: 'transient_error',
            code: 'timeout_or_network',
            message: error instanceof Error ? error.message : 'Unknown probe error'
          }
        }
      }

      const delayMs = PROBE_RETRY_DELAYS_MS[attempt]
      if (delayMs) {
        await delay(delayMs)
      }
    }

    return {
      status: 'transient_error',
      code: 'probe_failed',
      message: `Could not verify ${model.id}`
    }
  }

  private promoteExistingToStale(providerId: CloudProviderId, fingerprint: string, now: number): void {
    const rows = getModelAccessCacheRows(providerId, fingerprint)
    for (const row of rows) {
      if (row.status !== 'verified' && row.status !== 'stale') {
        continue
      }

      upsertModelAccessCache({
        provider_id: providerId,
        token_fingerprint: fingerprint,
        model_id: row.model_id,
        display_name: row.display_name,
        description: row.description,
        status: 'stale',
        last_checked_at: now,
        expires_at: now + STALE_TTL_MS,
        deny_code: row.deny_code,
        deny_message: row.deny_message
      })
    }
  }

  async handleProviderKeyChange(providerId: ProviderId, ollamaUrl?: string): Promise<void> {
    if (providerId === 'ollama') {
      await this.refreshProvider('ollama', { ollamaUrl })
      return
    }

    const currentKey = await credentialManager.peekApiKey(providerId)
    if (!currentKey) {
      deleteModelAccessCacheForProvider(providerId)
      deleteProviderDiscoveryState(providerId)
      await this.emitCatalogUpdate()
      return
    }

    await this.refreshProvider(providerId, { ollamaUrl })
  }

  async ensureUsable(modelId: string, ollamaUrl?: string): Promise<EnsureUsableModelResult> {
    const providerId = mapModelIdToProvider(modelId)

    if (!providerId) {
      return {
        usable: false,
        requestedModelId: modelId,
        resolvedModelId: null,
        providerId: null,
        switched: false,
        reason: 'Unknown model provider'
      }
    }

    if (providerId === 'ollama') {
      const ollamaModels = await this.getOllamaModels(ollamaUrl)
      const match = ollamaModels.find((model) => model.id === modelId)
      if (match) {
        return {
          usable: true,
          requestedModelId: modelId,
          resolvedModelId: modelId,
          providerId,
          switched: false
        }
      }

      const fallback = selectBestFallback(ollamaModels)
      return {
        usable: false,
        requestedModelId: modelId,
        resolvedModelId: fallback?.id || null,
        providerId,
        switched: !!fallback,
        reason: fallback
          ? `Selected model is unavailable. Switching to ${fallback.name}`
          : 'No Ollama models are currently available.'
      }
    }

    const catalog = await this.getCatalog({ triggerRefreshIfStale: true, ollamaUrl })
    const allProviderModels = catalog.models.filter((model) => model.provider === providerId)

    const exactMatch = allProviderModels.find((model) => model.id === modelId)
    if (exactMatch) {
      return {
        usable: true,
        requestedModelId: modelId,
        resolvedModelId: modelId,
        providerId,
        switched: false
      }
    }

    const fallback = selectBestFallback(allProviderModels)
    return {
      usable: false,
      requestedModelId: modelId,
      resolvedModelId: fallback?.id || null,
      providerId,
      switched: !!fallback,
      reason: fallback
        ? `Selected model is unavailable for this token. Switching to ${fallback.name}`
        : `No verified ${providerId} models are available for this token.`
    }
  }

  async markModelDenied(modelId: string, message?: string, code?: string): Promise<void> {
    const providerId = mapModelIdToProvider(modelId)
    if (!providerId || providerId === 'ollama') {
      return
    }

    const apiKey = await credentialManager.peekApiKey(providerId)
    if (!apiKey) {
      return
    }

    const fingerprint = hashToken(apiKey)
    const now = Date.now()
    const existingRows = getModelAccessCacheRows(providerId, fingerprint)
    const existing = existingRows.find((row) => row.model_id === modelId)

    upsertModelAccessCache({
      provider_id: providerId,
      token_fingerprint: fingerprint,
      model_id: modelId,
      display_name: existing?.display_name || modelId,
      description: existing?.description || `${providerId} model`,
      status: 'denied',
      last_checked_at: now,
      expires_at: now + DENIED_TTL_MS,
      deny_code: code || 'insufficient_scope',
      deny_message: message || `No access to model ${modelId}`
    })

    upsertProviderDiscoveryState({
      provider_id: providerId,
      token_fingerprint: fingerprint,
      last_refresh_at: now,
      refresh_status: 'ready',
      error_code: null,
      error_message: null
    })

    await this.emitCatalogUpdate()
    void this.refreshProvider(providerId)
  }
}

export const modelDiscoveryService = new ModelDiscoveryService()
