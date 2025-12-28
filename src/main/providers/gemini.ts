import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIProvider } from './base'
import { AIModel, StreamParams } from './types'

const DEFAULT_MODEL = 'gemini-2.5-flash'

/**
 * Available Gemini models
 */
const GEMINI_MODELS: AIModel[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Fast & cost-effective',
    provider: 'gemini',
    isLocal: false
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Balanced speed & capability',
    provider: 'gemini',
    isLocal: false
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Fastest, lowest latency',
    provider: 'gemini',
    isLocal: false
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Advanced reasoning',
    provider: 'gemini',
    isLocal: false
  },
  {
    id: 'gemini-3.0-flash',
    name: 'Gemini 3.0 Flash',
    description: 'Next-gen speed & reasoning',
    provider: 'gemini',
    isLocal: false
  },
  {
    id: 'gemini-3.0-pro',
    name: 'Gemini 3.0 Pro',
    description: 'Most capable, frontier intelligence',
    provider: 'gemini',
    isLocal: false
  }
]

/**
 * Helper for exponential backoff retry logic
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await operation()
  } catch (error: any) {
    const isRateLimit =
      error.message?.includes('429') ||
      error.status === 429 ||
      error.message?.includes('Too Many Requests')

    if (isRateLimit && retries > 0) {
      console.warn(`[Gemini] Rate limit hit. Retrying in ${delay}ms... (Retries left: ${retries})`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return retryWithBackoff(operation, retries - 1, delay * 2)
    }
    throw error
  }
}

/**
 * Gemini AI Provider implementation
 */
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini'

  canHandleModel(modelId: string): boolean {
    return GEMINI_MODELS.some((m) => m.id === modelId)
  }

  async validateConnection(apiKey?: string): Promise<boolean> {
    if (!apiKey) {
      console.error('[Gemini] No API key provided')
      return false
    }

    console.log('[Gemini] validateConnection called')
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL }, { apiVersion: 'v1' })
      console.log('[Gemini] Sending test ping...')
      await model.generateContent('ping')
      console.log('[Gemini] Test ping successful!')
      return true
    } catch (e) {
      console.error('[Gemini] validateConnection ERROR:', e)
      return false
    }
  }

  async getAvailableModels(_apiKey?: string): Promise<AIModel[]> {
    // Gemini models are static
    return GEMINI_MODELS
  }

  async streamResponse(params: StreamParams, apiKey?: string): Promise<void> {
    if (!apiKey) {
      throw new Error('API key is required for Gemini provider')
    }

    const { window, messages, modelId } = params

    console.log('[Gemini] streamResponse called')
    console.log('[Gemini] Using model:', modelId)
    console.log('[Gemini] Total messages received:', messages.length)

    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const systemMessage = messages.find((m) => m.role === 'system')

      console.log('[Gemini] System instruction:', systemMessage ? 'Present' : 'None')
      if (systemMessage) {
        console.log('[Gemini] System instruction length:', systemMessage.content.length)
      }

      // Create model with system instruction if provided
      const model = genAI.getGenerativeModel(
        {
          model: modelId,
          systemInstruction: systemMessage?.content
        },
        { apiVersion: 'v1beta' }
      )

      // Convert to Gemini format (exclude system messages)
      let history = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }))

      console.log('[Gemini] History length (excluding system):', history.length)

      const lastMessage = history.pop()
      if (!lastMessage) throw new Error('No user message found')

      console.log('[Gemini] Last message role:', lastMessage.role)
      console.log(
        '[Gemini] Last message content preview:',
        lastMessage.parts[0].text.substring(0, 100)
      )
      console.log('[Gemini] Remaining history for chat:', history.length, 'messages')

      // Log each history message role
      history.forEach((h, i) => {
        console.log(
          `[Gemini] History[${i}]: role=${h.role}, content_length=${h.parts[0].text.length}`
        )
      })

      console.log('[Gemini] Starting chat with history...')

      // Try streaming chat first
      try {
        const chat = model.startChat({ history })
        console.log('[Gemini] Sending message stream...')

        const result = await retryWithBackoff(async () => {
          return await chat.sendMessageStream(lastMessage.parts[0].text)
        })

        console.log('[Gemini] Stream started, awaiting chunks...')
        let chunkCount = 0
        let fullResponse = ''
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            chunkCount++
            fullResponse += text
            window.webContents.send('ai:token', text)
          }
        }
        console.log('[Gemini] Stream complete. Total chunks:', chunkCount)
        console.log('[Gemini] Full response preview:', fullResponse.substring(0, 500))
        
        // Check for tool_use pattern
        if (fullResponse.includes('```tool_use')) {
          console.log('[Gemini] ✅ Tool use block detected in response!')
        } else {
          console.log('[Gemini] ❌ No tool_use block in response')
        }
        
        window.webContents.send('ai:done')
      } catch (streamErr) {
        // If streaming is not supported, fall back to simple generateContent
        console.warn('[Gemini] Streaming failed, falling back to generateContent:', streamErr)
        try {
          const response = await model.generateContent(lastMessage.parts[0].text)
          const text = response.response?.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            window.webContents.send('ai:token', text)
          }
          window.webContents.send('ai:done')
        } catch (fallbackErr) {
          console.error('[Gemini] Fallback generateContent error:', fallbackErr)
          throw fallbackErr
        }
      }
    } catch (e: unknown) {
      console.error('[Gemini] streamResponse ERROR:', e)
      window.webContents.send('ai:error', e instanceof Error ? e.message : 'Unknown error')
      throw e
    }
  }
}
