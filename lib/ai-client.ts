import type OpenAI from 'openai'

type AiJsonRequest = {
  system: string
  user: string
  maxTokens?: number
  temperature?: number
}

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const DEFAULT_TEMPERATURE = 0.2
const DEFAULT_MAX_TOKENS = 1024

let cachedClient: OpenAI | null = null

async function getOpenAiClient() {
  if (cachedClient) return cachedClient
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }
  const { OpenAI } = await import('openai')
  cachedClient = new OpenAI({ apiKey })
  return cachedClient
}

export async function generateJsonWithOpenAI(request: AiJsonRequest) {
  const client = await getOpenAiClient()
  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: request.temperature ?? DEFAULT_TEMPERATURE,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.user },
    ],
  })

  const content = response.choices[0]?.message?.content?.trim() || ''
  if (!content) {
    throw new Error('Empty response from AI')
  }
  return content
}

