// src/main/providers/github-copilot.ts

import OpenAI from 'openai'
import { AIProvider } from './base'
import { AIModel, StreamParams } from './types'

/**
 * GitHub Models API endpoint
 * Uses OpenAI-compatible Chat Completions format
 */
const GITHUB_MODELS_ENDPOINT = 'https://models.github.ai/inference'

/**
 * Available models through GitHub Models/Copilot
 * Model IDs use format: provider/model-name
 */
const GITHUB_COPILOT_MODELS: AIModel[] = [
  {
    id: 'github:openai/gpt-4o',
    name: 'GPT-4o (GitHub)',
    description: 'OpenAI GPT-4o via GitHub Models',
    provider: 'github',
    isLocal: false
  },
  {
    id: 'github:openai/gpt-4o-mini',
    name: 'GPT-4o Mini (GitHub)',
    description: 'Fast & cost-effective via GitHub',
    provider: 'github',
    isLocal: false
  },
  {
    id: 'github:openai/o1',
    name: 'OpenAI o1 (GitHub)',
    description: 'Advanced reasoning model',
    provider: 'github',
    isLocal: false
  },
  {
    id: 'github:openai/o1-mini',
    name: 'OpenAI o1-mini (GitHub)',
    description: 'Fast reasoning model',
    provider: 'github',
    isLocal: false
  },
  {
    id: 'github:meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B (GitHub)',
    description: 'Meta Llama 3.3 70B instruction-tuned',
    provider: 'github',
    isLocal: false
  },
  {
    id: 'github:mistral-ai/mistral-large-2411',
    name: 'Mistral Large (GitHub)',
    description: 'Mistral AI flagship model',
    provider: 'github',
    isLocal: false
  },
  {
    id: 'github:deepseek/deepseek-r1',
    name: 'DeepSeek R1 (GitHub)',
    description: 'Advanced reasoning model',
    provider: 'github',
    isLocal: false
  }
]

/**
 * Extract the actual model ID for the GitHub Models API
 * Converts 'github:openai/gpt-4o' to 'openai/gpt-4o'
 */
function extractModelId(fullModelId: string): string {
  if (fullModelId.startsWith('github:')) {
    return fullModelId.slice(7) // Remove 'github:' prefix
  }
  return fullModelId
}

/**
 * GitHub Copilot/Models Provider
 * Uses GitHub PAT for authentication against the GitHub Models API
 * API is OpenAI-compatible, so we use the OpenAI SDK with custom base URL
 */
export class GitHubCopilotProvider implements AIProvider {
  readonly name = 'github'

  /**
   * Check if this provider can handle the given model
   * GitHub models use 'github:' prefix
   */
  canHandleModel(modelId: string): boolean {
    return (
      GITHUB_COPILOT_MODELS.some((m) => m.id === modelId) ||
      modelId.startsWith('github:')
    )
  }

  /**
   * Validate connection with GitHub Models API
   * Uses the GitHub PAT for authentication
   */
  async validateConnection(apiKey?: string): Promise<boolean> {
    if (!apiKey) {
      console.error('[GitHub Copilot] No GitHub PAT provided')
      return false
    }

    console.log('[GitHub Copilot] validateConnection called')

    try {
      const client = new OpenAI({
        baseURL: GITHUB_MODELS_ENDPOINT,
        apiKey: apiKey
      })

      // Use a minimal API call to validate
      await client.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })

      console.log('[GitHub Copilot] Validation successful!')
      return true
    } catch (error: unknown) {
      console.error('[GitHub Copilot] validateConnection ERROR:', error)
      return false
    }
  }

  /**
   * Get available GitHub Models
   */
  async getAvailableModels(_apiKey?: string): Promise<AIModel[]> {
    // Return static list - could be enhanced to fetch from API
    return GITHUB_COPILOT_MODELS
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

    try {
      const client = new OpenAI({
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      window.webContents.send('ai:error', errorMessage)
      throw error
    }
  }
}
