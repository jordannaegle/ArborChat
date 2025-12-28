/**
 * Persona Generator
 * AI-powered persona creation using Gemini
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getApiKey } from '../db'
import { PersonaGenerationResult } from './types'

const PERSONA_GENERATION_PROMPT = `You are a persona designer for an AI assistant application called ArborChat.

Your task is to create a detailed persona definition based on the user's description. The persona should include:

1. **Core Identity**: Who is this persona? What is their expertise, background, and perspective?

2. **Communication Style**: How should the AI communicate when using this persona? (formal/casual, verbose/concise, technical/simple)

3. **Key Traits**: 3-5 defining characteristics that shape responses

4. **Behavior Guidelines**: Specific instructions for how to handle common scenarios

5. **Example Responses**: Optional examples showing the persona's voice

Format your response as a detailed Markdown document that can be used as a system prompt.

Important guidelines:
- Be specific and actionable
- Include both what TO do and what NOT to do
- Keep the persona consistent and believable
- Focus on practical, useful behaviors
- Write in second person ("You are...", "You should...")

User's description of the persona they want:`

const EMOJI_PROMPT = `Based on this persona description, respond with ONLY a single emoji that best represents it. No other text, explanation, or formatting - just the emoji.

Persona: "{name}"
Description: "{description}"

Reply with just the emoji:`

const DESCRIPTION_PROMPT = `Summarize this persona description in one concise sentence (max 80 characters). No quotes, just the summary text.

"{description}"

Reply with just the summary:`

/**
 * Generate a complete persona using AI
 */
export async function generatePersona(
  description: string,
  name: string
): Promise<PersonaGenerationResult> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('API key not configured. Please add your Gemini API key in Settings.')
  }

  console.log(`[PersonaGenerator] Generating persona: ${name}`)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  try {
    // Generate the main persona content
    const contentPrompt = `${PERSONA_GENERATION_PROMPT}

"${description}"

Persona name: ${name}

Create a comprehensive persona definition in Markdown format. Start with a heading using the persona name.`

    const contentResult = await model.generateContent(contentPrompt)
    const content = contentResult.response.text()

    // Generate emoji
    const emoji = await generateEmoji(model, description, name)

    // Generate short description
    const shortDescription = await generateDescription(model, description)

    // Extract relevant tags
    const tags = extractTags(description, content)

    console.log(`[PersonaGenerator] Successfully generated persona: ${name}`)

    return {
      name,
      emoji,
      description: shortDescription,
      content,
      tags
    }
  } catch (error) {
    console.error('[PersonaGenerator] Failed to generate:', error)
    throw new Error('Failed to generate persona. Please try again.')
  }
}

/**
 * Generate an appropriate emoji for the persona
 */
async function generateEmoji(
  model: any,
  description: string,
  name: string
): Promise<string> {
  try {
    const prompt = EMOJI_PROMPT
      .replace('{name}', name)
      .replace('{description}', description)

    const result = await model.generateContent(prompt)
    const emoji = result.response.text().trim()

    // Validate it looks like an emoji (basic check - emojis are typically 1-4 chars)
    if (emoji.length >= 1 && emoji.length <= 8) {
      return emoji
    }
    return '🤖'
  } catch (error) {
    console.warn('[PersonaGenerator] Failed to generate emoji:', error)
    return '🤖'
  }
}

/**
 * Generate a short description for the persona
 */
async function generateDescription(
  model: any,
  description: string
): Promise<string> {
  try {
    const prompt = DESCRIPTION_PROMPT.replace('{description}', description)

    const result = await model.generateContent(prompt)
    const summary = result.response.text().trim()

    // Clean up and truncate if needed
    return summary
      .replace(/^["']|["']$/g, '') // Remove quotes
      .substring(0, 100)
  } catch (error) {
    console.warn('[PersonaGenerator] Failed to generate description:', error)
    // Fallback: truncate the original description
    return description.length > 80 
      ? description.substring(0, 77) + '...' 
      : description
  }
}

/**
 * Extract relevant tags from the description and content
 */
function extractTags(description: string, content: string): string[] {
  const text = `${description} ${content}`.toLowerCase()

  const tagKeywords: Record<string, string[]> = {
    coding: ['code', 'programming', 'developer', 'software', 'engineer', 'debug', 'algorithm'],
    writing: ['write', 'writing', 'author', 'editor', 'content', 'copywriting', 'blog'],
    creative: ['creative', 'art', 'design', 'brainstorm', 'idea', 'imagination'],
    technical: ['technical', 'system', 'architecture', 'infrastructure', 'devops'],
    business: ['business', 'strategy', 'startup', 'entrepreneur', 'consulting', 'management'],
    education: ['teach', 'tutor', 'learn', 'education', 'explain', 'mentor'],
    research: ['research', 'analysis', 'data', 'scientist', 'academic'],
    casual: ['casual', 'friendly', 'conversational', 'relaxed', 'informal'],
    formal: ['formal', 'professional', 'corporate', 'executive'],
    expert: ['expert', 'senior', 'specialist', 'master', 'advanced'],
    helper: ['help', 'assist', 'support', 'guide'],
    analyst: ['analyst', 'analyze', 'insight', 'metrics', 'report'],
    coach: ['coach', 'motivat', 'encourage', 'goal', 'productivity']
  }

  const matchedTags: string[] = []

  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      matchedTags.push(tag)
    }
  }

  // Limit to 5 most relevant tags
  return matchedTags.slice(0, 5)
}
