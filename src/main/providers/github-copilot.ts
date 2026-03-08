// src/main/providers/github-copilot.ts

import OpenAI from 'openai'
import { AIProvider } from './base'
import { AIModel, ModelProbeResult, ProviderValidationResult, StreamParams } from './types'

/**
 * GitHub Models API endpoint
 * Uses OpenAI-compatible Chat Completions format
 */
const GITHUB_MODELS_ENDPOINT = 'https://models.github.ai/inference'
const GITHUB_CATALOG_ENDPOINT = 'https://models.github.ai/catalog/models'
const GITHUB_VALIDATION_TIMEOUT = 10000
const GITHUB_API_VERSION = '2022-11-28'

interface GitHubCatalogModel {
  id?: string
  name?: string
  summary?: string
  description?: string
}

/**
 * Extract the actual model ID for the GitHub Models API
 * Converts 'github:openai/gpt-5.1' to 'openai/gpt-5.1'
 */
function extractModelId(fullModelId: string): string {
  if (fullModelId.startsWith('github:')) {
    return fullModelId.slice(7) // Remove 'github:' prefix
  }
  return fullModelId
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
  }
  return undefined
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }

  if ('code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code
  }

  if (
    'error' in error &&
    typeof (error as { error?: unknown }).error === 'object' &&
    (error as { error?: unknown }).error !== null &&
    'code' in (error as { error: { code?: unknown } }).error &&
    typeof (error as { error: { code?: unknown } }).error.code === 'string'
  ) {
    return (error as { error: { code: string } }).error.code
  }

  return undefined
}

function toGitHubModel(modelId: string, source?: GitHubCatalogModel): AIModel {
  const providerName = source?.name?.trim() || modelId
  const description = source?.summary || source?.description || `GitHub Models: ${modelId}`
  return {
    id: `github:${modelId}`,
    name: providerName,
    description,
    provider: 'github',
    isLocal: false
  }
}

/**
 * GitHub Copilot/Models Provider
 * Uses GitHub PAT for authentication against the GitHub Models API
 * API is OpenAI-compatible, so we use the OpenAI SDK with custom base URL
 */
export class GitHubCopilotProvider implements AIProvider {
  readonly name = 'github'

  private async fetchCatalogResponse(apiKey: string): Promise<Response> {
    const fetchWithAuth = async (authorization: string): Promise<Response> => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), GITHUB_VALIDATION_TIMEOUT)

      try {
        return await fetch(GITHUB_CATALOG_ENDPOINT, {
          headers: {
            Authorization: authorization,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'ArborChat',
            'X-GitHub-Api-Version': GITHUB_API_VERSION
          },
          signal: controller.signal
        })
      } finally {
        clearTimeout(timeoutId)
      }
    }

    let response = await fetchWithAuth(`Bearer ${apiKey}`)
    if (response.status === 401) {
      response = await fetchWithAuth(`token ${apiKey}`)
    }
    return response
  }

  /**
   * Check if this provider can handle the given model
   * GitHub models use 'github:' prefix
   */
  canHandleModel(modelId: string): boolean {
    return modelId.startsWith('github:')
  }

  /**
   * Validate connection with GitHub Models API
   * Uses the GitHub PAT for authentication
   */
  async validateConnection(apiKey?: string): Promise<ProviderValidationResult> {
    const trimmedKey = apiKey?.trim()
    if (!trimmedKey) {
      return { status: 'invalid_key', message: 'No GitHub token provided' }
    }

    console.log('[GitHub Copilot] validateConnection called')

    try {
      const response = await this.fetchCatalogResponse(trimmedKey)

      if (!response.ok) {
        if (response.status === 401) {
          console.error('[GitHub Copilot] Token is invalid or expired')
          return { status: 'invalid_key', message: 'GitHub token is invalid or expired' }
        } else if (response.status === 403) {
          console.error(
            '[GitHub Copilot] Token is valid but missing GitHub Models access. Ensure models:read permission is granted.'
          )
          return {
            status: 'insufficient_scope',
            message: 'GitHub token lacks GitHub Models access (models:read required)'
          }
        } else if (response.status === 429) {
          console.error('[GitHub Copilot] Rate limited while validating token')
          return { status: 'rate_limited', message: 'GitHub Models validation hit rate limits' }
        } else {
          console.error('[GitHub Copilot] Validation failed with status:', response.status)
          return { status: 'network_error', message: `GitHub validation failed (${response.status})` }
        }
      }

      console.log('[GitHub Copilot] Validation successful!')
      return { status: 'ok' }
    } catch (error: unknown) {
      console.error('[GitHub Copilot] validateConnection ERROR:', error)
      return { status: 'network_error', message: 'Unable to reach GitHub Models right now' }
    }
  }

  /**
   * Backward-compatible model list hook.
   */
  async getAvailableModels(apiKey?: string): Promise<AIModel[]> {
    const trimmedKey = apiKey?.trim()
    if (!trimmedKey) {
      return []
    }
    return this.listCandidateModels(trimmedKey)
  }

  async listCandidateModels(apiKey: string): Promise<AIModel[]> {
    try {
      const response = await this.fetchCatalogResponse(apiKey)
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return []
        }
        return []
      }

      const payload = (await response.json()) as unknown
      const models: GitHubCatalogModel[] = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as { data?: unknown[] }).data)
          ? ((payload as { data: GitHubCatalogModel[] }).data || [])
          : []

      return models
        .map((model) => {
          const id = model.id?.trim()
          if (!id) return null
          return toGitHubModel(id, model)
        })
        .filter((model): model is AIModel => model !== null)
    } catch (error: unknown) {
      const status = getErrorStatus(error)
      const code = getErrorCode(error)

      if (status === 401 || (status === 403 && code === 'no_access')) {
        return []
      }
      if (status === 403) {
        return []
      }

      console.error('[GitHub Copilot] getAvailableModels ERROR:', error)
      return []
    }
  }

  async probeModelAccess(model: AIModel, apiKey: string): Promise<ModelProbeResult> {
    try {
      const client = new OpenAI({
        baseURL: GITHUB_MODELS_ENDPOINT,
        apiKey
      })

      await client.chat.completions.create({
        model: extractModelId(model.id),
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }]
      })

      return { status: 'verified' }
    } catch (error: unknown) {
      const status = getErrorStatus(error)
      const code = getErrorCode(error)
      if (status === 401) {
        return { status: 'denied', code: 'invalid_key', message: 'Invalid GitHub token' }
      }
      if (status === 403 && code === 'no_access') {
        return { status: 'denied', code: 'insufficient_scope', message: `No access to ${extractModelId(model.id)}` }
      }
      if (status === 403) {
        return { status: 'denied', code: 'insufficient_scope', message: 'Token lacks required GitHub Models permissions' }
      }
      if (status === 429) {
        return { status: 'transient_error', code: 'rate_limited', message: 'Rate limited probing model access' }
      }
      if (status && status >= 500) {
        return { status: 'transient_error', code: 'provider_error', message: 'GitHub Models service unavailable' }
      }
      if (status === 400 || status === 404) {
        return { status: 'denied', code: 'unsupported', message: `${extractModelId(model.id)} is not usable for chat` }
      }
      return { status: 'transient_error', code: 'network_error', message: 'Network error probing model access' }
    }
  }

  /**
   * Stream response from GitHub Models API
   */
  async streamResponse(params: StreamParams, apiKey?: string): Promise<void> {
    if (!apiKey) {
      throw new Error('GitHub PAT is required for GitHub Copilot provider')
    }

    const { window, messages, modelId } = params
    const actualModelId = extractModelId(modelId)

    console.log('[GitHub Copilot] streamResponse called')
    console.log('[GitHub Copilot] Full model ID:', modelId)
    console.log('[GitHub Copilot] API model ID:', actualModelId)
    console.log('[GitHub Copilot] Total messages received:', messages.length)

    let client: OpenAI | null = null

    try {
      client = new OpenAI({
        baseURL: GITHUB_MODELS_ENDPOINT,
        apiKey: apiKey
      })

      // Extract system message
      const systemMessage = messages.find((m) => m.role === 'system')
      if (systemMessage) {
        console.log('[GitHub Copilot] System instruction: Present')
        console.log('[GitHub Copilot] System instruction length:', systemMessage.content.length)
      }

      // Convert messages to OpenAI format
      const openaiMessages = messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      }))

      console.log('[GitHub Copilot] Conversation messages:', openaiMessages.length)

      // Stream the response
      const stream = await client.chat.completions.create({
        model: actualModelId,
        max_tokens: 8192,
        messages: openaiMessages,
        stream: true
      })

      console.log('[GitHub Copilot] Stream started, awaiting chunks...')
      let chunkCount = 0
      let fullResponse = ''

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content
        if (delta) {
          chunkCount++
          fullResponse += delta
          window.webContents.send('ai:token', delta)
        }
      }

      console.log('[GitHub Copilot] Stream complete. Total chunks:', chunkCount)
      console.log('[GitHub Copilot] Full response preview:', fullResponse.substring(0, 500))

      // Check for tool_use pattern
      if (fullResponse.includes('```tool_use')) {
        console.log('[GitHub Copilot] ✅ Tool use block detected in response!')
      } else {
        console.log('[GitHub Copilot] ❌ No tool_use block in response')
      }

      window.webContents.send('ai:done')
    } catch (error: unknown) {
      console.error('[GitHub Copilot] streamResponse ERROR:', error)
      const status = getErrorStatus(error)
      const errorCode = getErrorCode(error)
      let errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (status === 403 && errorCode === 'no_access' && client) {
        try {
          const modelList = await client.models.list()
          const availableIds = modelList.data.map((model) => model.id).filter(Boolean)
          if (availableIds.length > 0) {
            errorMessage = `No access to model ${actualModelId}. Available models for this token: ${availableIds.slice(0, 8).join(', ')}`
          } else {
            errorMessage = `No access to model ${actualModelId}. This token currently has no usable GitHub Models entitlements.`
          }
        } catch {
          errorMessage = `No access to model ${actualModelId}. Verify this token has GitHub Models access for that model.`
        }
      }

      window.webContents.send('ai:error', errorMessage)
      throw error
    }
  }
}
