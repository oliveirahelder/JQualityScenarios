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

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'claude-sonnet-4.5'
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
  const systemText = request.system
  const userText = request.user

  const buildMessages = (
    format: 'string' | 'blocks',
    mergeSystemIntoUser: boolean
  ) => {
    const toContent = (value: string) =>
      format === 'blocks' ? [{ type: 'text', text: value }] : value

    if (mergeSystemIntoUser) {
      return [
        {
          role: 'user',
          content: toContent([systemText, userText].filter(Boolean).join('\n\n')),
        },
      ]
    }

    return [
      { role: 'system', content: toContent(systemText) },
      { role: 'user', content: toContent(userText) },
    ]
  }

  // Gateway payload: keep it minimal (model, temperature, messages, max_tokens).
  const payloadBase: Record<string, unknown> = {
    model: request.model || DEFAULT_MODEL,
    temperature: request.temperature ?? DEFAULT_TEMPERATURE,
    messages: buildMessages('string', false),
  }

  const payloadWithLimits: Record<string, unknown> = { ...payloadBase }
  if (
    typeof request.maxTokens === 'number' &&
    Number.isFinite(request.maxTokens) &&
    request.maxTokens > 0
  ) {
    payloadWithLimits.max_tokens = request.maxTokens
  }

  const attemptRequest = async (payload: Record<string, unknown>) => {
    // Add timeout with AbortController (50 seconds to leave buffer for gateway)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 50000)
    
    let response: Response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        throw new Error('AI gateway request timed out after 50 seconds')
      }
      throw fetchError
    }
    clearTimeout(timeoutId)

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

  const attemptWithFallbacks = async (initialPayload: Record<string, unknown>) => {
    const payloadNoLimit = { ...payloadBase } // remove max_tokens entirely
    const payloadBlocks = {
      ...payloadBase,
      messages: buildMessages('blocks', false),
    }
    const payloadBlocksNoLimit = {
      ...payloadBlocks,
    }
    const payloadMerged = {
      ...payloadBase,
      messages: buildMessages('string', true),
    }
    const payloadMergedNoLimit = {
      ...payloadMerged,
    }
    const payloadMergedBlocks = {
      ...payloadBase,
      messages: buildMessages('blocks', true),
    }
    const payloadMergedBlocksNoLimit = {
      ...payloadMergedBlocks,
    }

    try {
      return await attemptRequest(initialPayload)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const lower = message.toLowerCase()
      const shouldRetry =
        lower.includes('unknown_parameter') ||
        lower.includes('unknown parameter') ||
        lower.includes('invalid request format') ||
        lower.includes('failed to make http request') ||
        lower.includes('provider api') ||
        lower.includes('unexpected field type') ||
        lower.includes('mismatch type') ||
        lower.includes('role') ||
        lower.includes('system') ||
        lower.includes('400')

      if (!shouldRetry) {
        throw error
      }

      if (lower.includes('unexpected field type') || lower.includes('mismatch type')) {
        try {
          return await attemptRequest(payloadBlocks)
        } catch {
          try {
            return await attemptRequest(payloadBlocksNoLimit)
          } catch {
            try {
              return await attemptRequest(payloadMergedBlocks)
            } catch {
              return await attemptRequest(payloadMergedBlocksNoLimit)
            }
          }
        }
      }

      if (lower.includes('role') || lower.includes('system')) {
        try {
          return await attemptRequest(payloadMerged)
        } catch {
          return await attemptRequest(payloadMergedNoLimit)
        }
      }

      try {
        return await attemptRequest(payloadNoLimit)
      } catch {
        try {
          return await attemptRequest(payloadMerged)
        } catch {
          return await attemptRequest(payloadMergedBlocksNoLimit)
        }
      }
    }
  }

  return attemptWithFallbacks(payloadWithLimits)
}

