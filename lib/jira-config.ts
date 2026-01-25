export interface JiraCredentials {
  baseUrl: string
  user?: string
  token: string
  authType: 'basic' | 'oauth' | 'bearer'
  deployment: 'cloud' | 'datacenter'
  boardIds?: number[]
  sprintFieldId?: string
  requestTimeout?: number
}

export function buildJiraCredentialsFromUser(
  user: {
  jiraBaseUrl?: string | null
  jiraUser?: string | null
  jiraApiToken?: string | null
  jiraAuthType?: string | null
  jiraDeployment?: string | null
  jiraBoardIds?: string | null
  jiraSprintFieldId?: string | null
  jiraRequestTimeout?: number | null
  jiraAccessToken?: string | null
  jiraCloudId?: string | null
  },
  baseUrlOverride?: string | null
): JiraCredentials | null {
  const boardIds = user.jiraBoardIds
    ? user.jiraBoardIds
        .split(',')
        .map((value) => parseInt(value.trim(), 10))
        .filter((value) => !Number.isNaN(value))
    : undefined

  if (user.jiraAccessToken && user.jiraCloudId) {
    return {
      baseUrl: `https://api.atlassian.com/ex/jira/${user.jiraCloudId}`,
      token: user.jiraAccessToken,
      authType: 'oauth',
      deployment: 'cloud',
      boardIds,
      sprintFieldId: user.jiraSprintFieldId || undefined,
      requestTimeout: user.jiraRequestTimeout ?? undefined,
    }
  }

  const authType = user.jiraAuthType === 'bearer' ? 'bearer' : 'basic'
  const deployment = user.jiraDeployment === 'cloud' ? 'cloud' : 'datacenter'

  const baseUrl = baseUrlOverride || user.jiraBaseUrl
  if (!baseUrl || !user.jiraApiToken || (authType === 'basic' && !user.jiraUser)) {
    return null
  }

  return {
    baseUrl,
    user: user.jiraUser || undefined,
    token: user.jiraApiToken || '',
    authType,
    deployment,
    boardIds,
    sprintFieldId: user.jiraSprintFieldId || undefined,
    requestTimeout: user.jiraRequestTimeout ?? undefined,
  }
}
