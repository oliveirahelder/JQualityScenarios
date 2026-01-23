import axios, { AxiosInstance, AxiosError } from 'axios'
import type { JiraCredentials } from '@/lib/jira-config'

let agileClient: AxiosInstance | null = null
let agileClientKey = ''
let coreClient: AxiosInstance | null = null
let coreClientKey = ''
let storyPointsFieldCache: { key: string; fieldId: string | null } | null = null

function buildAuthConfig(credentials?: JiraCredentials) {
  const baseUrl = credentials?.baseUrl || process.env.JIRA_BASE_URL
  const user = credentials?.user || process.env.JIRA_USER
  const token = credentials?.token || process.env.JIRA_API_TOKEN
  const requestTimeout =
    credentials?.requestTimeout ??
    parseInt(process.env.JIRA_REQUEST_TIMEOUT || '30000', 10)

  if (!baseUrl || !token || (credentials?.authType !== 'bearer' && credentials?.authType !== 'oauth' && !user)) {
    throw new Error('Jira credentials not configured')
  }

  const authType = credentials?.authType || 'basic'
  const nextKey = `${baseUrl}|${user}|${token}|${requestTimeout}|${authType}`
  const headers =
    authType === 'oauth' || authType === 'bearer'
      ? { Authorization: `Bearer ${token}` }
      : undefined
  const auth =
    authType === 'basic'
      ? {
          username: user as string,
          password: token,
        }
      : undefined

  return {
    baseUrl,
    requestTimeout,
    nextKey,
    headers,
    auth,
  }
}

function getAgileClient(credentials?: JiraCredentials): AxiosInstance {
  const { baseUrl, requestTimeout, nextKey, headers, auth } = buildAuthConfig(credentials)
  const nextAgileKey = `${nextKey}|agile`

  if (!agileClient || agileClientKey !== nextAgileKey) {
    agileClient = axios.create({
      baseURL: `${baseUrl}/rest/agile/1.0`,
      auth,
      headers,
      timeout: requestTimeout,
    })
    agileClientKey = nextAgileKey
  }

  return agileClient
}

function getCoreClient(credentials?: JiraCredentials): AxiosInstance {
  const { baseUrl, requestTimeout, nextKey, headers, auth } = buildAuthConfig(credentials)
  const nextCoreKey = `${nextKey}|core`

  if (!coreClient || coreClientKey !== nextCoreKey) {
    coreClient = axios.create({
      baseURL: `${baseUrl}/rest/api/2`,
      auth,
      headers,
      timeout: requestTimeout,
    })
    coreClientKey = nextCoreKey
  }

  return coreClient
}

function parseBoardIds(raw: string | undefined): number[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => !Number.isNaN(value))
}

async function getTargetBoardIds(credentials?: JiraCredentials): Promise<number[]> {
  const configured =
    credentials?.boardIds && credentials.boardIds.length > 0
      ? credentials.boardIds
      : parseBoardIds(process.env.JIRA_BOARD_IDS)

  if (configured.length > 0) return configured
  const boards = await getAllBoards(credentials)
  return boards.map((board) => board.id)
}

export interface JiraSprintEvent {
  id: number
  name: string
  state: 'FUTURE' | 'ACTIVE' | 'CLOSED'
  startDate?: string
  endDate?: string
  boardId: number
}

export interface JiraSprintWithIssues extends JiraSprintEvent {
  issues: JiraIssue[]
}

export interface JiraIssue {
  id: string
  key: string
  fields: {
    summary: string
    description?: string
    status: {
      name: string
    }
    assignee?: {
      displayName: string
      emailAddress: string
    }
    priority?: {
      name: string
    }
  }
}

function matchStatus(value: string, targets: string[]) {
  return targets.some((target) => value.includes(target))
}

function countQaBounceBacks(changelog: any): number {
  const histories = changelog?.histories || []
  const qaStatuses = [
    'in qa',
    'awaiting approval',
    'awaiting for approval',
    'waiting for approval',
  ]
  const devStatuses = ['in progress', 'in development', 'in refinement']
  let count = 0

  for (const history of histories) {
    for (const item of history.items || []) {
      if (item.field !== 'status') continue
      const from = (item.fromString || '').toLowerCase()
      const to = (item.toString || '').toLowerCase()
      if (!from || !to) continue
      if (matchStatus(from, qaStatuses) && matchStatus(to, devStatuses)) {
        count += 1
      }
    }
  }

  return count
}

export async function resolveStoryPointsFieldId(
  credentials?: JiraCredentials
): Promise<string | null> {
  const override = process.env.JIRA_STORY_POINTS_FIELD_ID
  const cacheKey = `${credentials?.baseUrl || ''}|${credentials?.user || ''}|${override || ''}`
  if (storyPointsFieldCache?.key === cacheKey) {
    return storyPointsFieldCache.fieldId
  }

  if (override) {
    storyPointsFieldCache = { key: cacheKey, fieldId: override }
    return override
  }

  try {
    const response = await getCoreClient(credentials).get('/field')
    const fields = response.data || []
    const normalized = fields.map((field: any) => ({
      id: field.id as string,
      name: (field.name || '').toLowerCase(),
      clauseNames: (field.clauseNames || []).map((value: string) => value.toLowerCase()),
    }))

    const preferred = normalized.find((field: any) =>
      field.name.includes('story point')
    )
    const fallback = normalized.find(
      (field: any) =>
        field.name === 'story points' ||
        field.name === 'story point estimate' ||
        field.name === 'estimate' ||
        field.clauseNames.includes('story points')
    )

    const fieldId = preferred?.id || fallback?.id || null
    storyPointsFieldCache = { key: cacheKey, fieldId }
    return fieldId
  } catch (error) {
    console.warn('[Jira] Failed to resolve story points field:', error)
    storyPointsFieldCache = { key: cacheKey, fieldId: null }
    return null
  }
}

export async function getIssueChangelogMetrics(
  issueKey: string,
  credentials?: JiraCredentials,
  storyPointsFieldId?: string | null
): Promise<{ storyPoints: number | null; qaBounceBackCount: number }> {
  try {
    const fields = ['summary', 'status']
    if (storyPointsFieldId) {
      fields.push(storyPointsFieldId)
    }

    const response = await getCoreClient(credentials).get(`/issue/${issueKey}`, {
      params: {
        expand: 'changelog',
        fields: fields.join(','),
      },
    })

    const storyValue =
      storyPointsFieldId && response.data?.fields
        ? response.data.fields[storyPointsFieldId]
        : null
    const storyPoints =
      typeof storyValue === 'number'
        ? storyValue
        : storyValue != null
        ? Number(storyValue)
        : null

    const qaBounceBackCount = countQaBounceBacks(response.data?.changelog)
    return { storyPoints, qaBounceBackCount }
  } catch (error) {
    console.warn(`[Jira] Failed to load changelog for ${issueKey}:`, error)
    return { storyPoints: null, qaBounceBackCount: 0 }
  }
}

/**
 * Fetch all sprints from a Jira board
 */
export async function getSprintsFromBoard(
  boardId: number,
  credentials?: JiraCredentials
): Promise<JiraSprintEvent[]> {
  try {
    const response = await getAgileClient(credentials).get(`/board/${boardId}/sprint`, {
      params: {
        maxResults: 50,
      },
    })

    return response.data.values || []
  } catch (error) {
    const axiosError = error as AxiosError
    const errorMessage = axiosError.response?.data || axiosError.message || 'Unknown error'
    console.error(`Error fetching sprints from board ${boardId}:`, errorMessage)
    throw new Error(`Failed to fetch Jira sprints for board ${boardId}: ${errorMessage}`)
  }
}

export async function getActiveSprintsFromBoard(
  boardId: number,
  credentials?: JiraCredentials
): Promise<JiraSprintEvent[]> {
  try {
    const response = await getAgileClient(credentials).get(`/board/${boardId}/sprint`, {
      params: {
        maxResults: 50,
        state: 'active',
      },
    })

    return response.data.values || []
  } catch (error) {
    const axiosError = error as AxiosError
    const errorMessage = axiosError.response?.data || axiosError.message || 'Unknown error'
    console.error(`Error fetching active sprints from board ${boardId}:`, errorMessage)
    throw new Error(`Failed to fetch active Jira sprints for board ${boardId}: ${errorMessage}`)
  }
}

/**
 * Fetch issues in a specific sprint
 */
export async function getSprintIssues(
  sprintId: number,
  credentials?: JiraCredentials
): Promise<JiraIssue[]> {
  try {
    const response = await getAgileClient(credentials).get(`/sprint/${sprintId}/issue`, {
      params: {
        maxResults: 100,
      },
    })

    return response.data.issues || []
  } catch (error) {
    const axiosError = error as AxiosError
    const errorMessage = axiosError.response?.data || axiosError.message || 'Unknown error'
    console.error(`Error fetching issues for sprint ${sprintId}:`, errorMessage)
    throw new Error(`Failed to fetch sprint issues for sprint ${sprintId}: ${errorMessage}`)
  }
}

/**
 * Get all boards available
 */
export async function getAllBoards(credentials?: JiraCredentials): Promise<any[]> {
  try {
    const response = await getAgileClient(credentials).get('/board', {
      params: {
        maxResults: 50,
        type: 'scrum',
      },
    })

    return response.data.values || []
  } catch (error) {
    const axiosError = error as AxiosError
    const errorMessage = axiosError.response?.data || axiosError.message || 'Unknown error'
    console.error('Error fetching boards:', errorMessage)
    throw new Error(`Failed to fetch Jira boards: ${errorMessage}`)
  }
}

/**
 * Fetch active sprints from all boards
 */
export async function getActiveSprints(
  credentials?: JiraCredentials
): Promise<JiraSprintWithIssues[]> {
  try {
    const boardIds = await getTargetBoardIds(credentials)
    const allSprints: JiraSprintWithIssues[] = []

    for (const boardId of boardIds) {
      const activeSprints = await getActiveSprintsFromBoard(boardId, credentials)

      for (const sprint of activeSprints) {
        const issues = await getSprintIssues(sprint.id, credentials)
        allSprints.push({
          ...sprint,
          issues,
        })
      }
    }

    return allSprints
  } catch (error) {
    console.error('Error fetching active sprints:', error)
    throw error
  }
}

/**
 * Get recently closed sprints (configurable window, default: last 7 days)
 */
export async function getRecentClosedSprints(
  credentials?: JiraCredentials
): Promise<JiraSprintEvent[]> {
  const sprintHistoryDays = parseInt(process.env.SPRINT_HISTORY_DAYS || '7', 10)
  try {
    const boardIds = await getTargetBoardIds(credentials)
    const allClosedSprints: JiraSprintEvent[] = []

    for (const boardId of boardIds) {
      const sprints = await getSprintsFromBoard(boardId, credentials)
      const now = new Date()
      const historyStart = new Date(now.getTime() - sprintHistoryDays * 24 * 60 * 60 * 1000)

      const recentlyClosed = sprints.filter((s) => {
        if ((s.state || '').toUpperCase() !== 'CLOSED' || !s.endDate) return false
        const endDate = new Date(s.endDate)
        return endDate >= historyStart && endDate <= now
      })

      allClosedSprints.push(...recentlyClosed)
    }

    return allClosedSprints
  } catch (error) {
    const axiosError = error as AxiosError
    const errorMessage = axiosError.response?.data || axiosError.message || 'Unknown error'
    console.error(
      `Error fetching recently closed sprints (last ${sprintHistoryDays} days):`,
      errorMessage
    )
    throw error
  }
}

/**
 * Normalize Jira sprint data to our database format
 */
export function normalizeSprint(jiraSprint: JiraSprintEvent) {
  const statusMap: Record<string, 'PLANNED' | 'ACTIVE' | 'CLOSED'> = {
    'FUTURE': 'PLANNED',
    'ACTIVE': 'ACTIVE',
    'CLOSED': 'CLOSED',
  }

  return {
    jiraId: jiraSprint.id.toString(),
    name: jiraSprint.name,
    startDate: jiraSprint.startDate ? new Date(jiraSprint.startDate) : new Date(),
    endDate: jiraSprint.endDate ? new Date(jiraSprint.endDate) : new Date(),
    status: statusMap[jiraSprint.state] || 'PLANNED',
  }
}

/**
 * Normalize Jira issue to our database format
 */
export function normalizeIssue(jiraIssue: JiraIssue) {
  return {
    jiraId: jiraIssue.key,
    summary: jiraIssue.fields.summary,
    description: jiraIssue.fields.description || '',
    status: jiraIssue.fields.status?.name || 'Unknown',
    assignee: jiraIssue.fields.assignee?.displayName,
    priority: jiraIssue.fields.priority?.name,
  }
}
