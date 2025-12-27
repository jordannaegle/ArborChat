import { GoogleGenerativeAI } from '@google/generative-ai'
import { BrowserWindow } from 'electron'

const DEFAULT_MODEL = 'gemini-2.5-flash'

// Helper for exponential backoff
async function retryWithBackoff<T>(
    operation: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        // Check for 429 Too Many Requests
        // Google GenAI often returns 429 or 503 for rate limits/overload
        const isRateLimit = error.message?.includes('429') || error.status === 429 || error.message?.includes('Too Many Requests');
        
        if (isRateLimit && retries > 0) {
            console.warn(`[AI] Rate limit hit. Retrying in ${delay}ms... (Retries left: ${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryWithBackoff(operation, retries - 1, delay * 2);
        }
        throw error;
    }
}

export async function validateParams(apiKey: string, modelName: string = DEFAULT_MODEL): Promise<boolean> {
  console.log('[AI] validateParams called')
  console.log('[AI] Using model:', modelName)
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1' });
    console.log('[AI] Sending test ping...')
    await model.generateContent('ping')
    console.log('[AI] Test ping successful!')
    return true
  } catch (e) {
    console.error('[AI] validateParams ERROR:', e)
    return false
  }
}

export async function streamResponse(
  window: BrowserWindow,
  apiKey: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  modelName: string = DEFAULT_MODEL
): Promise<void> {
  console.log('[AI] streamResponse called')
  console.log('[AI] Using model:', modelName)
  console.log('[AI] Total messages received:', messages.length)
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const systemMessage = messages.find((m) => m.role === 'system')
    
    console.log('[AI] System instruction:', systemMessage ? 'Present' : 'None')
    
    // Note: gemini-pro doesn't support systemInstruction, so we skip it
    const model = genAI.getGenerativeModel({
      model: modelName
    }, { apiVersion: 'v1' })

    // Gemini History Format
    // For gemini-pro, we'll prepend system message as a user message
    let history = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }))

    console.log('[AI] History length (excluding system):', history.length)
    
    const lastMessage = history.pop()
    if (!lastMessage) throw new Error('No user message found')

    console.log('[AI] Last message role:', lastMessage.role)
    console.log('[AI] Last message content preview:', lastMessage.parts[0].text.substring(0, 100))
    console.log('[AI] Remaining history for chat:', history.length, 'messages')
    
    // Log each history message role
    history.forEach((h, i) => {
      console.log(`[AI] History[${i}]: role=${h.role}, content_length=${h.parts[0].text.length}`)
    })

    console.log('[AI] Starting chat with history...')
    // Try streaming chat first
    try {
      const chat = model.startChat({ history })
      console.log('[AI] Sending message stream...')
      console.log('[AI] Sending message stream...')
      
      const result = await retryWithBackoff(async () => {
          return await chat.sendMessageStream(lastMessage.parts[0].text)
      });
      
      console.log('[AI] Stream started, awaiting chunks...')
      let chunkCount = 0
      for await (const chunk of result.stream) {
        const text = chunk.text()
        if (text) {
          chunkCount++
          window.webContents.send('ai:token', text)
        }
      }
      console.log('[AI] Stream complete. Total chunks:', chunkCount)
      window.webContents.send('ai:done')
    } catch (streamErr) {
      // If streaming is not supported (e.g., 404), fall back to simple generateContent
      console.warn('[AI] Streaming failed, falling back to generateContent:', streamErr)
      try {
        const response = await model.generateContent(lastMessage.parts[0].text)
        const text = response.response?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          window.webContents.send('ai:token', text)
        }
        window.webContents.send('ai:done')
      } catch (fallbackErr) {
        console.error('[AI] Fallback generateContent error:', fallbackErr)
        throw fallbackErr
      }
    }
  } catch (e: unknown) {
    console.error('[AI] streamResponse ERROR:')
    console.error('[AI] Error type:', typeof e)
    console.error('[AI] Error name:', e instanceof Error ? e.name : 'N/A')
    console.error('[AI] Error message:', e instanceof Error ? e.message : String(e))
    
    // Log the full error object for more details
    if (e && typeof e === 'object') {
      console.error('[AI] Full error object:', JSON.stringify(e, null, 2))
      
      // Check for specific properties
      if ('status' in e) console.error('[AI] Status:', (e as { status: number }).status)
      if ('statusText' in e) console.error('[AI] StatusText:', (e as { statusText: string }).statusText)
      if ('errorDetails' in e) console.error('[AI] ErrorDetails:', JSON.stringify((e as { errorDetails: unknown }).errorDetails, null, 2))
    }
    
    if (e instanceof Error && e.stack) {
      console.error('[AI] Stack trace:', e.stack)
    }
    
    window.webContents.send('ai:error', e instanceof Error ? e.message : 'Unknown error')
  }
}

