export interface ConfluenceCredentials {
  baseUrl: string
  user?: string
  token: string
  authType: 'basic' | 'bearer'
  deployment: 'cloud' | 'datacenter'
  requestTimeout?: number
  accessClientId?: string
  accessClientSecret?: string
}

export function normalizeConfluenceBaseUrl(input?: string | null): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    const rawPath = parsed.pathname.replace(/\/+$/, '')
    if (!rawPath || rawPath === '/') {
      return parsed.origin
    }
    const lowerPath = rawPath.toLowerCase()
    if (lowerPath.startsWith('/wiki')) {
      return `${parsed.origin}/wiki`
    }
    if (lowerPath.startsWith('/confluence')) {
      return `${parsed.origin}/confluence`
    }
    if (lowerPath.includes('/display/') || lowerPath.includes('/pages/')) {
      return parsed.origin
    }
    return `${parsed.origin}${rawPath}`
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

export function extractConfluenceSpaceKey(input?: string | null): string | null {
  if (!input) return null
  try {
    const parsed = new URL(input)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const displayIndex = segments.indexOf('display')
    if (displayIndex >= 0 && segments.length > displayIndex + 1) {
      return segments[displayIndex + 1].toUpperCase()
    }
  } catch {
    // Ignore invalid URLs.
  }
  return null
}

export function extractConfluenceParentPageId(input?: string | null): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) {
    return trimmed
  }
  const pageIdMatch = trimmed.match(/pageId=(\d+)/i)
  if (pageIdMatch) {
    return pageIdMatch[1]
  }
  const digitsMatch = trimmed.match(/\b\d{5,}\b/)
  if (digitsMatch) {
    return digitsMatch[0]
  }
  try {
    const parsed = new URL(trimmed)
    const pageId = parsed.searchParams.get('pageId')
    if (pageId && /^\d+$/.test(pageId)) {
      return pageId
    }
  } catch {
    // Ignore invalid URLs.
  }
  return null
}

export function buildConfluenceCredentialsFromUser(
  user: {
  confluenceBaseUrl?: string | null
  confluenceUser?: string | null
  confluenceApiToken?: string | null
  confluenceAuthType?: string | null
  confluenceDeployment?: string | null
  confluenceRequestTimeout?: number | null
  },
  baseUrlOverride?: string | null,
  accessHeaders?: {
    clientId?: string | null
    clientSecret?: string | null
  }
): ConfluenceCredentials | null {
  const authType = user.confluenceAuthType === 'basic' ? 'basic' : 'bearer'
  const deployment = user.confluenceDeployment === 'cloud' ? 'cloud' : 'datacenter'

  const baseUrl = normalizeConfluenceBaseUrl(baseUrlOverride || user.confluenceBaseUrl)
  if (!baseUrl || !user.confluenceApiToken) {
    return null
  }

  if (authType === 'basic' && !user.confluenceUser) {
    return null
  }

  return {
    baseUrl,
    user: user.confluenceUser || undefined,
    token: user.confluenceApiToken || '',
    authType,
    deployment,
    requestTimeout: user.confluenceRequestTimeout ?? undefined,
    accessClientId: accessHeaders?.clientId?.trim() || undefined,
    accessClientSecret: accessHeaders?.clientSecret?.trim() || undefined,
  }
}
