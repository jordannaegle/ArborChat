import { ProviderId } from './credentials'
import { modelDiscoveryService } from './modelDiscovery/service'
import {
  AIModel,
  EnsureUsableModelResult,
  ModelDiscoveryResult
} from './providers/types'

/**
 * Backward-compatible helper used by existing callers.
 * Returns only verified (or stale cached) models.
 */
export async function getAllAvailableModels(
  _apiKey?: string,
  ollamaUrl?: string
): Promise<AIModel[]> {
  const catalog = await modelDiscoveryService.getCatalog({
    triggerRefreshIfStale: true,
    ollamaUrl
  })
  return catalog.models
}

export async function getModelCatalog(ollamaUrl?: string): Promise<ModelDiscoveryResult> {
  return modelDiscoveryService.getCatalog({
    triggerRefreshIfStale: true,
    ollamaUrl
  })
}

export async function refreshProviderModels(
  providerId: ProviderId,
  ollamaUrl?: string
): Promise<ModelDiscoveryResult> {
  await modelDiscoveryService.refreshProvider(providerId, { ollamaUrl })
  return modelDiscoveryService.getCatalog({ triggerRefreshIfStale: false, ollamaUrl })
}

export async function ensureUsableModel(
  modelId: string,
  ollamaUrl?: string
): Promise<EnsureUsableModelResult> {
  return modelDiscoveryService.ensureUsable(modelId, ollamaUrl)
}

export async function markModelDenied(
  modelId: string,
  message?: string,
  code?: string
): Promise<void> {
  await modelDiscoveryService.markModelDenied(modelId, message, code)
}

export async function handleProviderKeyChange(
  providerId: ProviderId,
  ollamaUrl?: string
): Promise<void> {
  await modelDiscoveryService.handleProviderKeyChange(providerId, ollamaUrl)
}

export function onModelCatalogUpdated(
  listener: (catalog: ModelDiscoveryResult) => void
): () => void {
  return modelDiscoveryService.onUpdated(listener)
}

export async function refreshAllProviders(ollamaUrl?: string): Promise<void> {
  await modelDiscoveryService.refreshAllProviders(ollamaUrl)
}
