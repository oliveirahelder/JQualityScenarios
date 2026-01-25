export interface ConfluenceCredentials {
  baseUrl: string
  user?: string
  token: string
  authType: 'basic' | 'bearer'
  deployment: 'cloud' | 'datacenter'
  requestTimeout?: number
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
  baseUrlOverride?: string | null
): ConfluenceCredentials | null {
  const authType = user.confluenceAuthType === 'basic' ? 'basic' : 'bearer'
  const deployment = user.confluenceDeployment === 'cloud' ? 'cloud' : 'datacenter'

  const baseUrl = baseUrlOverride || user.confluenceBaseUrl
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
  }
}
