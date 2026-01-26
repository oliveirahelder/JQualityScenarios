import axios, { AxiosInstance, AxiosError } from 'axios'
import type { JiraCredentials } from '@/lib/jira-config'

let agileClient: AxiosInstance | null = null
let agileClientKey = ''
let coreClient: AxiosInstance | null = null
let coreClientKey = ''
let greenhopperClient: AxiosInstance | null = null
let greenhopperClientKey = ''
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

function getGreenhopperClient(credentials?: JiraCredentials): AxiosInstance {
  const { baseUrl, requestTimeout, nextKey, headers, auth } = buildAuthConfig(credentials)
  const nextGreenhopperKey = `${nextKey}|greenhopper`

  if (!greenhopperClient || greenhopperClientKey !== nextGreenhopperKey) {
    greenhopperClient = axios.create({
      baseURL: `${baseUrl}/rest/greenhopper/1.0`,
      auth,
      headers,
      timeout: requestTimeout,
    })
    greenhopperClientKey = nextGreenhopperKey
  }

  return greenhopperClient
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
  completeDate?: string
  boardId: number
}

export interface JiraSprintWithIssues extends JiraSprintEvent {
  issues: JiraIssue[]
}

export interface JiraIssue {
  id: string
  key: string
  fields: Record<string, unknown> & {
    summary: string
    description?: string
    created?: string
    status: {
      name: string
    }
    issuetype?: {
      name?: string
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

type JiraField = {
  id: string
  name?: string
  clauseNames?: string[]
}

type JiraChangelogItem = {
  field?: string | null
  fromString?: string | null
  toString?: string | null
}

type JiraChangelogHistory = {
  created: string
  items?: JiraChangelogItem[]
}

type JiraChangelog = {
  histories?: JiraChangelogHistory[]
}

type JiraSprintEventRaw = {
  id?: number | string
  name?: string
  state?: string
  status?: string
  startDate?: string
  endDate?: string
  completeDate?: string
  originBoardId?: number
  boardId?: number
}

type JiraBoard = {
  id: number
  name?: string
}

function matchStatus(value: string, targets: string[]) {
  return targets.some((target) => value.includes(target))
}

function countQaBounceBacks(changelog: JiraChangelog | undefined): number {
  const histories = changelog?.histories || []
  const qaStatuses = [
    'in qa',
    'awaiting approval',
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
    const normalized = (fields as JiraField[]).map((field) => ({
      id: field.id as string,
      name: (field.name || '').toLowerCase(),
      clauseNames: (field.clauseNames || []).map((value) => value.toLowerCase()),
    }))

    const preferred = normalized.find((field) =>
      field.name.includes('story point')
    )
    const fallback = normalized.find(
      (field) =>
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
): Promise<{ storyPoints: number | null; qaBounceBackCount: number; closedAt: Date | null }> {
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
    const histories = (response.data?.changelog?.histories || []) as JiraChangelogHistory[]
    const sorted = histories.sort(
      (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()
    )
    let closedAt: Date | null = null
    const closedStatuses = ['closed', 'done']
    for (const history of sorted) {
      for (const item of history.items || []) {
        if (item.field !== 'status') continue
        const toStatus = (item.toString || '').toLowerCase()
        if (closedStatuses.some((status) => toStatus.includes(status))) {
          closedAt = new Date(history.created)
          break
        }
      }
      if (closedAt) break
    }
    return { storyPoints, qaBounceBackCount, closedAt }
  } catch (error) {
    console.warn(`[Jira] Failed to load changelog for ${issueKey}:`, error)
    return { storyPoints: null, qaBounceBackCount: 0, closedAt: null }
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

    const values = (response.data.values || []) as JiraSprintEventRaw[]
    return values.map((sprint) => ({
      ...sprint,
      boardId: sprint.originBoardId || sprint.boardId || boardId,
    }))
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
  credentials?: JiraCredentials,
  boardId?: number
): Promise<JiraIssue[]> {
  try {
    const results: JiraIssue[] = []
    let startAt = 0
    const maxResults = 100
    while (true) {
      const response = await getAgileClient(credentials).get(`/sprint/${sprintId}/issue`, {
        params: {
          maxResults,
          startAt,
        },
      })
      const issues = response.data.issues || []
      const total = typeof response.data.total === 'number' ? response.data.total : null
      const pageSize =
        typeof response.data.maxResults === 'number' ? response.data.maxResults : issues.length
      results.push(...issues)
      if (!issues.length) break
      if (total != null && startAt + issues.length >= total) break
      startAt += pageSize || issues.length
    }

    if (boardId) {
      try {
        const report = await getSprintReport(boardId, sprintId, credentials)
        const completed =
          (report as {
            contents?: {
              completedIssues?: Array<{
                key?: string
                summary?: string
                statusName?: string
              }>
            }
          })?.contents?.completedIssues || []
        const notCompleted = (report as {
          contents?: {
            issuesNotCompletedInCurrentSprint?: Array<{
              key?: string
              summary?: string
              statusName?: string
            }>
          }
        })?.contents?.issuesNotCompletedInCurrentSprint || []
        const reportIssues = [...completed, ...notCompleted]
        const reportKeys = reportIssues
          .map((issue) => issue?.key)
          .filter((key): key is string => Boolean(key))
        const reportIssueMap = new Map(
          reportIssues
            .filter((issue) => issue?.key)
            .map((issue) => [issue.key as string, issue])
        )
        const existingKeys = new Set(results.map((issue) => issue.key))
        const missingKeys = reportKeys.filter((key) => !existingKeys.has(key))
        for (const key of missingKeys) {
          const issue = await getIssueByKey(key, credentials)
          if (issue) {
            results.push(issue)
            existingKeys.add(issue.key)
            continue
          }
          const reportIssue = reportIssueMap.get(key)
          if (reportIssue) {
            results.push({
              id: key,
              key,
              fields: {
                summary: reportIssue.summary || key,
                status: { name: reportIssue.statusName || 'Unknown' },
              },
            } as JiraIssue)
            existingKeys.add(key)
          }
        }

        if (reportKeys.length > results.length) {
          const jqlIssues = await getIssuesBySprintJql(sprintId, credentials)
          for (const issue of jqlIssues) {
            if (!existingKeys.has(issue.key)) {
              results.push(issue)
              existingKeys.add(issue.key)
            }
          }
        }
      } catch (reportError) {
        console.warn(`[Jira] Failed to enrich sprint issues for ${sprintId}:`, reportError)
      }
    }

    return results
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
export async function getAllBoards(credentials?: JiraCredentials): Promise<JiraBoard[]> {
  try {
    const response = await getAgileClient(credentials).get('/board', {
      params: {
        maxResults: 50,
        type: 'scrum',
      },
    })

    return (response.data.values || []) as JiraBoard[]
  } catch (error) {
    const axiosError = error as AxiosError
    const errorMessage = axiosError.response?.data || axiosError.message || 'Unknown error'
    console.error('Error fetching boards:', errorMessage)
    throw new Error(`Failed to fetch Jira boards: ${errorMessage}`)
  }
}

async function getIssueByKey(
  issueKey: string,
  credentials?: JiraCredentials
): Promise<JiraIssue | null> {
  try {
    const response = await getCoreClient(credentials).get(`/issue/${issueKey}`, {
      params: {
        fields: 'summary,description,status,assignee,priority,created,issuetype',
      },
    })
    return response.data as JiraIssue
  } catch (error) {
    const axiosError = error as AxiosError
    const errorMessage = axiosError.response?.data || axiosError.message || 'Unknown error'
    console.warn(`[Jira] Failed to fetch issue ${issueKey}:`, errorMessage)
    return null
  }
}

async function getIssuesBySprintJql(
  sprintId: number,
  credentials?: JiraCredentials
): Promise<JiraIssue[]> {
  try {
    const results: JiraIssue[] = []
    let startAt = 0
    const maxResults = 50
    while (true) {
      const response = await getCoreClient(credentials).get('/search', {
        params: {
          jql: `Sprint = ${sprintId}`,
          fields: 'summary,description,status,assignee,priority,created,issuetype',
          startAt,
          maxResults,
        },
      })
      const issues = response.data.issues || []
      results.push(...issues)
      if (issues.length < maxResults) break
      startAt += maxResults
    }
    return results
  } catch (error) {
    const axiosError = error as AxiosError
    const errorMessage = axiosError.response?.data || axiosError.message || 'Unknown error'
    console.warn(`[Jira] Failed to fetch issues via JQL for sprint ${sprintId}:`, errorMessage)
    return []
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
        const issues = await getSprintIssues(sprint.id, credentials, sprint.boardId)
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

export async function getClosedSprintsFromBoard(
  boardId: number,
  credentials?: JiraCredentials
): Promise<JiraSprintEvent[]> {
  try {
    const results: JiraSprintEvent[] = []
    let startAt = 0
    const maxResults = 50
    while (true) {
      const response = await getAgileClient(credentials).get(`/board/${boardId}/sprint`, {
        params: {
          maxResults,
          startAt,
          state: 'closed',
        },
      })
      const values = (response.data.values || []) as JiraSprintEventRaw[]
      const mapped = values.map((sprint) => ({
        ...sprint,
        boardId: sprint.originBoardId || sprint.boardId || boardId,
      }))
      results.push(...mapped)
      if (values.length < maxResults) break
      startAt += maxResults
    }
    return results
  } catch (error) {
    const axiosError = error as AxiosError
    const errorMessage = axiosError.response?.data || axiosError.message || 'Unknown error'
    console.error(`Error fetching closed sprints from board ${boardId}:`, errorMessage)
    throw new Error(`Failed to fetch closed Jira sprints for board ${boardId}: ${errorMessage}`)
  }
}

export async function getSprintReport(
  boardId: number,
  sprintId: number,
  credentials?: JiraCredentials
): Promise<Record<string, unknown>> {
  try {
    const response = await getGreenhopperClient(credentials).get(
      `/rapid/charts/sprintreport`,
      {
        params: {
          rapidViewId: boardId,
          sprintId,
        },
      }
    )
    return response.data as Record<string, unknown>
  } catch (error) {
    const axiosError = error as AxiosError
    const errorMessage = axiosError.response?.data || axiosError.message || 'Unknown error'
    console.error(`Error fetching sprint report ${sprintId}:`, errorMessage)
    throw new Error(`Failed to fetch Jira sprint report for ${sprintId}: ${errorMessage}`)
  }
}

export async function getAllClosedSprints(
  credentials?: JiraCredentials
): Promise<JiraSprintEvent[]> {
  try {
    const boardIds = await getTargetBoardIds(credentials)
    const allClosed: JiraSprintEvent[] = []
    for (const boardId of boardIds) {
      const closed = await getClosedSprintsFromBoard(boardId, credentials)
      if (closed.length > 0) {
        allClosed.push(...closed)
        continue
      }

      const legacyClosed = await getClosedSprintsFromGreenhopper(boardId, credentials)
      allClosed.push(...legacyClosed)
    }
    return allClosed
  } catch (error) {
    console.error('Error fetching closed sprints:', error)
    throw error
  }
}

async function getClosedSprintsFromGreenhopper(
  boardId: number,
  credentials?: JiraCredentials
): Promise<JiraSprintEvent[]> {
  try {
    const response = await getGreenhopperClient(credentials).get(
      `/rapidview/${boardId}/sprintquery`,
      {
        params: {
          includeHistoricSprints: true,
          includeFutureSprints: false,
        },
      }
    )
    const raw = response.data?.sprints || response.data?.values || []
    const sprints = Array.isArray(raw) ? raw : []
    return sprints
      .filter((sprint: JiraSprintEventRaw) => {
        const state = (sprint.state || sprint.status || '').toUpperCase()
        return state === 'CLOSED' || state === 'COMPLETE' || state === 'COMPLETED'
      })
      .map((sprint: JiraSprintEventRaw) => ({
        id: Number(sprint.id),
        name: sprint.name || `Sprint ${sprint.id}`,
        state: 'CLOSED',
        startDate: sprint.startDate || undefined,
        endDate: sprint.endDate || undefined,
        completeDate: sprint.completeDate || undefined,
        boardId,
      }))
  } catch (error) {
    const axiosError = error as AxiosError
    const errorMessage = axiosError.response?.data || axiosError.message || 'Unknown error'
    console.error(`Error fetching greenhopper sprints for board ${boardId}:`, errorMessage)
    throw new Error(`Failed to fetch Jira sprint reports for board ${boardId}: ${errorMessage}`)
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
  const statusMap: Record<string, 'PLANNED' | 'ACTIVE' | 'COMPLETED'> = {
    'FUTURE': 'PLANNED',
    'ACTIVE': 'ACTIVE',
    'CLOSED': 'COMPLETED',
  }

  return {
    jiraId: jiraSprint.id.toString(),
    name: jiraSprint.name,
    startDate: jiraSprint.startDate ? new Date(jiraSprint.startDate) : new Date(),
    endDate: jiraSprint.endDate ? new Date(jiraSprint.endDate) : new Date(),
    completedAt: jiraSprint.completeDate ? new Date(jiraSprint.completeDate) : null,
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
    createdAt: jiraIssue.fields.created ? new Date(jiraIssue.fields.created) : null,
    issueType: jiraIssue.fields.issuetype?.name || '',
  }
}
