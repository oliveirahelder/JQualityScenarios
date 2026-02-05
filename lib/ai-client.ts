import type OpenAI from 'openai'

type AiJsonRequest = {
  system: string
  user: string
  maxTokens?: number
  temperature?: number
  apiKey?: string
  model?: string
  baseUrl?: string | null
  strictJson?: boolean
}

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const DEFAULT_TEMPERATURE = 0.2
const DEFAULT_MAX_TOKENS = 1024

let cachedClient: OpenAI | null = null
let cachedClientKey: string | null = null

async function getOpenAiClient(apiKeyOverride?: string | null) {
  const apiKey = apiKeyOverride || process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }
  if (cachedClient && cachedClientKey === apiKey) return cachedClient
  const { OpenAI } = await import('openai')
  const client = new OpenAI({ apiKey })
  if (!apiKeyOverride) {
    cachedClient = client
    cachedClientKey = apiKey
  }
  return client
}

export async function generateJsonWithOpenAI(request: AiJsonRequest) {
  if (request.baseUrl) {
    return generateJsonWithGateway(request)
  }

  const client = await getOpenAiClient(request.apiKey)
  const model = request.model || DEFAULT_MODEL
  const payload: Record<string, unknown> = {
    model,
    temperature: request.temperature ?? DEFAULT_TEMPERATURE,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.user },
    ],
  }

  if (request.strictJson) {
    payload.response_format = { type: 'json_object' }
  }
  if (typeof request.maxTokens === 'number' && Number.isFinite(request.maxTokens)) {
    payload.max_completion_tokens = request.maxTokens
  }

  const response = await client.chat.completions.create(payload)

  const content = response.choices[0]?.message?.content?.trim() || ''
  if (!content) {
    throw new Error('Empty response from AI')
  }
  return content
}

const normalizeGatewayEndpoint = (baseUrl: string) => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (/\/chat\/completions$/i.test(trimmed)) {
    return trimmed
  }
  if (/\/v1$/i.test(trimmed)) {
    return `${trimmed}/chat/completions`
  }
  return `${trimmed}/v1/chat/completions`
}

const extractGatewayContent = (payload: any): string => {
  const chatMessage = payload?.choices?.[0]?.message
  const chatContent = chatMessage?.content
  if (typeof chatContent === 'string' && chatContent.trim()) {
    return chatContent.trim()
  }
  if (Array.isArray(chatContent)) {
    const chunkText = chatContent
      .map((chunk: any) => chunk?.text || chunk?.value)
      .filter((text: string | undefined) => Boolean(text))
    if (chunkText.length > 0) {
      return chunkText.join('\n').trim()
    }
  }

  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim()
  }

  if (Array.isArray(payload?.output)) {
    const texts = payload.output
      .flatMap((item: any) => item?.content || [])
      .map((content: any) => content?.text)
      .filter((text: string | undefined) => Boolean(text))
    if (texts.length > 0) {
      return texts.join('\n').trim()
    }
  }

  return ''
}

async function generateJsonWithGateway(request: AiJsonRequest) {
  const apiKey = request.apiKey || process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('AI gateway API key not configured')
  }

  const endpoint = normalizeGatewayEndpoint(request.baseUrl as string)
  const basePayload = {
    model: request.model || DEFAULT_MODEL,
    temperature: request.temperature ?? DEFAULT_TEMPERATURE,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.user },
    ],
  }
  const payloadWithLimits: Record<string, unknown> = { ...basePayload }
  if (typeof request.maxTokens === 'number' && Number.isFinite(request.maxTokens)) {
    payloadWithLimits.max_tokens = request.maxTokens
  }

  const attemptRequest = async (payload: Record<string, unknown>) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI gateway error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const gatewayError =
      data?.error?.message ||
      data?.error?.detail ||
      data?.message ||
      data?.error?.toString?.()
    if (gatewayError) {
      throw new Error(`AI gateway error: ${gatewayError}`)
    }
    const content = extractGatewayContent(data)
    if (!content) {
      const raw = JSON.stringify(data)
      const preview = raw.length > 2000 ? `${raw.slice(0, 2000)}…` : raw
      console.warn('[AI Gateway] Empty content payload:', preview)
      throw new Error('Empty response from AI gateway')
    }
    return content
  }

  const payloadWithReasoning: Record<string, unknown> = {
    ...payloadWithLimits,
    reasoning: { effort: 'none' },
  }

  try {
    return await attemptRequest(payloadWithReasoning)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.includes('unknown_parameter') ||
      message.toLowerCase().includes('unknown parameter') ||
      message.toLowerCase().includes('invalid request format') ||
      message.toLowerCase().includes('reasoning')
    ) {
      return await attemptRequest(payloadWithLimits)
    }
    throw error
  }
}

