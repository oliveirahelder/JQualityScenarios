import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'
import type { JiraCredentials } from '@/lib/jira-config'

const CLOSED_STATUSES = ['closed', 'done', 'resolved']
const QA_READY_STATUSES = [
  'ready for release',
  'waiting for approval',
  'awaiting approval',
  'in release',
]
const QA_ACTIVE_STATUSES = ['in qa']
const DEV_STATUSES = ['in progress', 'in development', 'in refinement']
const END_STATUSES = [...QA_READY_STATUSES, ...CLOSED_STATUSES]

const METRICS_CACHE_TTL_MS = 30_000
const metricsCache = new Map<string, { timestamp: number; payload: unknown }>()

type JiraTicketLite = {
  status?: string | null
  storyPoints?: number | null
  qaBounceBackCount?: number | null
  assignee?: string | null
  jiraId?: string | null
}

type JiraChangelogHistory = {
  created: string
  items?: Array<{
    field?: string | null
    toString?: string | null
    to?: string | null
  }>
}

type SprintWithTickets = {
  id: string
  name: string
  endDate: Date
  startDate: Date
  status: string
  totalTickets: number
  closedTickets: number
  storyPointsTotal: number
  tickets: JiraTicketLite[]
}

function getTeamKey(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return 'Team'
  const match = trimmed.match(/^[A-Za-z0-9]+/)
  return match ? match[0].toUpperCase() : trimmed.toUpperCase()
}

function isStrictClosed(status?: string | null) {
  return (status || '').toLowerCase().includes('closed')
}

function isBusinessDay(date: Date) {
  const day = date.getDay()
  return day >= 1 && day <= 5
}

function businessHoursBetween(start: Date, end: Date) {
  if (end <= start) return 0
  const startDate = new Date(start)
  const endDate = new Date(end)
  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(0, 0, 0, 0)
  let hours = 0
  const cursor = new Date(startDate)
  while (cursor <= endDate) {
    if (isBusinessDay(cursor)) {
      hours += 8
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return hours
}

function buildJiraHeaders(credentials: JiraCredentials) {
  if (credentials.authType === 'bearer' || credentials.authType === 'oauth') {
    return { Authorization: `Bearer ${credentials.token}` }
  }
  const user = credentials.user || ''
  const basicToken = Buffer.from(`${user}:${credentials.token}`).toString('base64')
  return { Authorization: `Basic ${basicToken}` }
}

async function getTicketWorkHours(
  issueKey: string,
  credentials: JiraCredentials,
  devStatuses: string[],
  endStatuses: string[]
) {
  try {
    const url = `${credentials.baseUrl}/rest/api/2/issue/${issueKey}?expand=changelog&fields=status`
    const response = await fetch(url, {
      headers: {
        ...buildJiraHeaders(credentials),
        Accept: 'application/json',
      },
    })
    if (!response.ok) return null
    const data = await response.json()
    const histories = data?.changelog?.histories || []
    const sorted = (histories as JiraChangelogHistory[]).sort(
      (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()
    )

    let devStart: Date | null = null
    let endAt: Date | null = null
    let assigneeAtStart: string | null = null
    let currentAssignee: string | null = null

    for (const history of sorted) {
      for (const item of history.items || []) {
        if (item.field === 'assignee') {
          const assignee = (item.toString || item.to || '').toString().trim()
          if (assignee) {
            currentAssignee = assignee
          }
        }
        if (item.field !== 'status') continue
        const toStatus = (item.toString || '').toLowerCase()
        if (!devStart && devStatuses.some((status) => toStatus.includes(status))) {
          devStart = new Date(history.created)
          assigneeAtStart = currentAssignee
        }
        if (devStart && endStatuses.some((status) => toStatus.includes(status))) {
          endAt = new Date(history.created)
          break
        }
      }
      if (endAt) break
    }

    if (!devStart || !endAt) return null
    return {
      workHours: businessHoursBetween(devStart, endAt),
      devStart,
      endAt,
      assigneeAtStart,
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeDeliveryTimes =
      searchParams.get('includeDeliveryTimes') !== '0' &&
      searchParams.get('includeDeliveryTimes') !== 'false'
    const token = extractTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Missing authentication token' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const jiraCredentials = buildJiraCredentialsFromUser(user)
    if (!jiraCredentials) {
      return NextResponse.json({ error: 'Jira integration not configured' }, { status: 400 })
    }

    const cacheKey = `${payload.userId}|${includeDeliveryTimes ? 'delivery' : 'lite'}`
    const cached = metricsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < METRICS_CACHE_TTL_MS) {
      return NextResponse.json(cached.payload)
    }

    const activeSprints = (await prisma.sprint.findMany({
      where: { status: 'ACTIVE' },
      include: { tickets: true },
      orderBy: { endDate: 'asc' },
    })) as SprintWithTickets[]

    const now = new Date()
    const activeSprintMetrics = activeSprints.map((sprint: SprintWithTickets) => {
      const totalTickets =
        typeof sprint.totalTickets === 'number' && sprint.totalTickets > 0
          ? sprint.totalTickets
          : sprint.tickets.length
      const closedTickets =
        typeof sprint.closedTickets === 'number' && sprint.closedTickets >= 0
          ? sprint.closedTickets
          : sprint.tickets.filter((ticket: JiraTicketLite) => isStrictClosed(ticket.status)).length
      const successPercent = totalTickets
        ? Math.round((closedTickets / totalTickets) * 1000) / 10
        : 0
      const devTickets = sprint.tickets.filter((ticket: JiraTicketLite) =>
        DEV_STATUSES.some((status) =>
          (ticket.status || '').toLowerCase().includes(status)
        )
      ).length
      const qaTickets = sprint.tickets.filter((ticket: JiraTicketLite) =>
        QA_ACTIVE_STATUSES.some((status) =>
          (ticket.status || '').toLowerCase().includes(status)
        )
      ).length
      const doneTickets = closedTickets
      const qaReadyTickets = sprint.tickets.filter((ticket: JiraTicketLite) =>
        QA_READY_STATUSES.some((status) =>
          (ticket.status || '').toLowerCase().includes(status)
        )
      ).length
      const bounceBackTickets = sprint.tickets.filter(
        (ticket: JiraTicketLite) => (ticket.qaBounceBackCount || 0) > 0
      ).length
      const bounceBackPercent = totalTickets
        ? Math.round((bounceBackTickets / totalTickets) * 1000) / 10
        : 0
      const storyPointsTotal =
        sprint.storyPointsTotal > 0
          ? sprint.storyPointsTotal
          : sprint.tickets.reduce(
              (sum: number, ticket: JiraTicketLite) => sum + (ticket.storyPoints || 0),
              0
            )
      const storyPointsCompleted = sprint.tickets.reduce((sum: number, ticket: JiraTicketLite) => {
        return sum + (isStrictClosed(ticket.status) ? ticket.storyPoints || 0 : 0)
      }, 0)
      const daysLeft = Math.max(
        0,
        Math.ceil((sprint.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      )

      const assigneeTotals = new Map<string, { total: number; closed: number }>()
      for (const ticket of sprint.tickets || []) {
        const name = (ticket.assignee || '').trim()
        if (!name) continue
        const points = ticket.storyPoints || 0
        const entry = assigneeTotals.get(name) || { total: 0, closed: 0 }
        entry.total += points
        const isClosed = isStrictClosed(ticket.status)
        if (isClosed) {
          entry.closed += points
        }
        assigneeTotals.set(name, entry)
      }

      const assigneeTotalsList = Array.from(assigneeTotals.entries())
        .map(([name, values]) => ({
          name,
          total: values.total,
          closed: values.closed,
        }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

      return {
        id: sprint.id,
        name: sprint.name,
        teamKey: getTeamKey(sprint.name),
        successPercent,
        daysLeft,
        devTickets,
        qaTickets,
        doneTickets,
        qaReadyTickets,
        bounceBackPercent,
        bounceBackTickets,
        storyPointsTotal,
        storyPointsCompleted,
        totalTickets,
        closedTickets,
        assignees: assigneeTotalsList,
      }
    })

    const currentStoryPoints = activeSprintMetrics.reduce(
      (sum: number, sprint: { storyPointsTotal: number }) => sum + sprint.storyPointsTotal,
      0
    )
    const assigneeCounts = new Map<
      string,
      { total: number; closed: number; bounce: number; inProgress: number }
    >()
    for (const sprint of activeSprints) {
      for (const ticket of sprint.tickets || []) {
        const name = (ticket.assignee || '').trim() || 'Unassigned'
        const entry = assigneeCounts.get(name) || {
          total: 0,
          closed: 0,
          bounce: 0,
          inProgress: 0,
        }
        entry.total += 1
        if (isStrictClosed(ticket.status)) {
          entry.closed += 1
        }
        if (
          DEV_STATUSES.some((status) =>
            (ticket.status || '').toLowerCase().includes(status)
          )
        ) {
          entry.inProgress += 1
        }
        if ((ticket.qaBounceBackCount || 0) > 0) {
          entry.bounce += 1
        }
        assigneeCounts.set(name, entry)
      }
    }
    const assignees = Array.from(assigneeCounts.entries())
      .map(([name, entry]) => ({
        name,
        total: entry.total,
        closed: entry.closed,
        bounce: entry.bounce,
        inProgress: entry.inProgress,
      }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    const workHoursByAssignee = new Map<string, { totalHours: number; ticketCount: number }>()
    const deliveryTimesBySprint: Array<{
      sprintId: string
      sprintName: string
      entries: Array<{
        name: string
        totalHours: number
        averageHours: number
        ticketCount: number
      }>
    }> = []

    if (includeDeliveryTimes) {
      for (const sprint of activeSprints) {
        const sprintHours = new Map<
          string,
          { totalHours: number; ticketCount: number; startedCount: number; endedInSprintCount: number }
        >()
        for (const ticket of sprint.tickets || []) {
          if (!ticket.jiraId || !ticket.assignee) continue
          const timing = await getTicketWorkHours(
            ticket.jiraId,
            jiraCredentials,
            DEV_STATUSES,
            END_STATUSES
          )
          if (!timing) continue
          const assigneeName = timing.assigneeAtStart || ticket.assignee
          const sprintEntry = sprintHours.get(assigneeName) || {
            totalHours: 0,
            ticketCount: 0,
            startedCount: 0,
            endedInSprintCount: 0,
          }
          const isStartedInSprint =
            timing.devStart >= sprint.startDate && timing.devStart <= sprint.endDate
          if (isStartedInSprint) {
            sprintEntry.startedCount += 1
            if (timing.endAt <= sprint.endDate) {
              sprintEntry.endedInSprintCount += 1
            }
          }
          sprintEntry.totalHours += timing.workHours
          sprintEntry.ticketCount += 1
          sprintHours.set(assigneeName, sprintEntry)

          const overallEntry = workHoursByAssignee.get(assigneeName) || {
            totalHours: 0,
            ticketCount: 0,
          }
          overallEntry.totalHours += timing.workHours
          overallEntry.ticketCount += 1
          workHoursByAssignee.set(assigneeName, overallEntry)
        }

        const sprintEntries = Array.from(sprintHours.entries())
          .map(([name, entry]) => ({
            name,
            totalHours: Math.round(entry.totalHours * 10) / 10,
            averageHours:
              entry.ticketCount > 0
                ? Math.round((entry.totalHours / entry.ticketCount) * 10) / 10
                : 0,
            ticketCount: entry.ticketCount,
            carryoverCount: Math.max(0, entry.startedCount - entry.endedInSprintCount),
            carryoverRate:
              entry.startedCount > 0
                ? Math.round((1 - entry.endedInSprintCount / entry.startedCount) * 1000) / 10
                : 0,
          }))
          .sort((a, b) => b.ticketCount - a.ticketCount || a.name.localeCompare(b.name))

        deliveryTimesBySprint.push({
          sprintId: sprint.id,
          sprintName: sprint.name,
          entries: sprintEntries,
        })
      }
    }
    const deliveryTimes = Array.from(workHoursByAssignee.entries())
      .map(([name, entry]) => ({
        name,
        totalHours: Math.round(entry.totalHours * 10) / 10,
        averageHours:
          entry.ticketCount > 0
            ? Math.round((entry.totalHours / entry.ticketCount) * 10) / 10
            : 0,
        ticketCount: entry.ticketCount,
      }))
      .sort((a, b) => b.ticketCount - a.ticketCount || a.name.localeCompare(b.name))

    const lastSprintSnapshots = await prisma.sprintSnapshot.findMany({
      where: { status: { in: ['COMPLETED', 'CLOSED'] } },
      orderBy: { endDate: 'desc' },
      take: 5,
    })

    const storyPointAverages = new Map<string, { total: number; closed: number; sprintCount: number }>()
    for (const snapshot of lastSprintSnapshots) {
      const assignees = snapshot.assignees ? JSON.parse(snapshot.assignees) : []
      if (!Array.isArray(assignees)) continue
      for (const assignee of assignees as Array<{
        name?: string
        storyPoints?: number
        closedPoints?: number
      }>) {
        const name = (assignee.name || '').trim()
        if (!name) continue
        const entry = storyPointAverages.get(name) || {
          total: 0,
          closed: 0,
          sprintCount: 0,
        }
        entry.total += assignee.storyPoints || 0
        entry.closed += assignee.closedPoints || 0
        entry.sprintCount += 1
        storyPointAverages.set(name, entry)
      }
    }

    const storyPointAveragesList = Array.from(storyPointAverages.entries()).map(
      ([name, entry]) => ({
        name,
        avgStoryPointsAllocated:
          entry.sprintCount > 0 ? Math.round((entry.total / entry.sprintCount) * 10) / 10 : 0,
        avgStoryPointsClosed:
          entry.sprintCount > 0 ? Math.round((entry.closed / entry.sprintCount) * 10) / 10 : 0,
        sprintCount: entry.sprintCount,
      })
    )

    const storyPointAveragesMap = new Map(
      storyPointAveragesList.map((entry) => [entry.name, entry])
    )

    const deliveryTimesWithPoints = deliveryTimes.map((entry) => ({
      ...entry,
      avgStoryPointsAllocated: storyPointAveragesMap.get(entry.name)?.avgStoryPointsAllocated ?? 0,
      avgStoryPointsClosed: storyPointAveragesMap.get(entry.name)?.avgStoryPointsClosed ?? 0,
      storyPointSprintCount: storyPointAveragesMap.get(entry.name)?.sprintCount ?? 0,
    }))

    const deliveryTimesBySprintWithPoints = deliveryTimesBySprint.map((sprint) => ({
      ...sprint,
      entries: sprint.entries.map((entry) => ({
        ...entry,
        avgStoryPointsAllocated: storyPointAveragesMap.get(entry.name)?.avgStoryPointsAllocated ?? 0,
        avgStoryPointsClosed: storyPointAveragesMap.get(entry.name)?.avgStoryPointsClosed ?? 0,
        storyPointSprintCount: storyPointAveragesMap.get(entry.name)?.sprintCount ?? 0,
      })),
    }))
    const previousSprints = (await prisma.sprint.findMany({
      where: { status: { in: ['CLOSED', 'COMPLETED'] } },
      include: { tickets: true },
      orderBy: { endDate: 'desc' },
      take: 50,
    })) as SprintWithTickets[]
    const previousSprint = previousSprints[0] || null
    const primaryActiveSprint = activeSprints[0] || null
    const elapsedDays =
      primaryActiveSprint && primaryActiveSprint.startDate
        ? Math.max(
            0,
            Math.ceil(
              (now.getTime() - primaryActiveSprint.startDate.getTime()) / (1000 * 60 * 60 * 24)
            )
          )
        : 0
    const previousPeriodEnd =
      previousSprint && elapsedDays > 0
        ? new Date(previousSprint.startDate.getTime() + elapsedDays * 24 * 60 * 60 * 1000)
        : null
    const previousClosedInPeriod = previousSprint
      ? previousSprint.tickets.filter((ticket) => {
          if (!isStrictClosed(ticket.status)) return false
          if (!previousPeriodEnd) return true
          return ticket.updatedAt >= previousSprint.startDate && ticket.updatedAt <= previousPeriodEnd
        })
      : []
    const previousStoryPointsInPeriod = previousClosedInPeriod.reduce(
      (sum: number, ticket: JiraTicketLite) => sum + (ticket.storyPoints || 0),
      0
    )
    const previousStoryPoints = previousSprint
      ? previousSprint.storyPointsTotal > 0
        ? previousSprint.storyPointsTotal
        : previousSprint.tickets.reduce(
            (sum: number, ticket: JiraTicketLite) => sum + (ticket.storyPoints || 0),
            0
          )
      : 0
    const storyPointsDelta = currentStoryPoints - previousStoryPoints
    const previousSprintsByTeam = new Map<string, SprintWithTickets[]>()
    for (const sprint of previousSprints) {
      const key = getTeamKey(sprint.name)
      const entries = previousSprintsByTeam.get(key) || []
      entries.push(sprint)
      previousSprintsByTeam.set(key, entries)
    }

    const finishedComparisonByTeam = activeSprints.map((sprint) => {
      const teamKey = getTeamKey(sprint.name)
      const elapsedDays = Math.max(
        0,
        Math.ceil((now.getTime() - sprint.startDate.getTime()) / (1000 * 60 * 60 * 24))
      )
      const previousForTeam = previousSprintsByTeam.get(teamKey)?.[0] || null
      const previousPeriodEnd =
        previousForTeam && elapsedDays > 0
          ? new Date(previousForTeam.startDate.getTime() + elapsedDays * 24 * 60 * 60 * 1000)
          : null
      const previousClosedInPeriod = previousForTeam
        ? previousForTeam.tickets.filter((ticket) => {
            if (!isStrictClosed(ticket.status)) return false
            if (!previousPeriodEnd) return true
            return (
              ticket.updatedAt >= previousForTeam.startDate &&
              ticket.updatedAt <= previousPeriodEnd
            )
          })
        : []
      const previousStoryPointsInPeriod = previousClosedInPeriod.reduce(
        (sum: number, ticket: JiraTicketLite) => sum + (ticket.storyPoints || 0),
        0
      )
      const activeMetrics = activeSprintMetrics.find((entry) => entry.id === sprint.id)
      return {
        teamKey,
        activeSprintId: sprint.id,
        activeSprintName: sprint.name,
        activeClosedTickets: activeMetrics?.doneTickets ?? 0,
        activeStoryPointsClosed: activeMetrics?.storyPointsCompleted ?? 0,
        previousSprintId: previousForTeam?.id ?? null,
        previousSprintName: previousForTeam?.name ?? null,
        previousClosedTickets: previousClosedInPeriod.length,
        previousStoryPointsClosed: previousStoryPointsInPeriod,
        periodDays: elapsedDays,
      }
    })

    const responsePayload = {
      activeSprintCount: activeSprintMetrics.length,
      activeSprints: activeSprintMetrics,
      storyPoints: {
        currentTotal: currentStoryPoints,
        previousTotal: previousStoryPoints,
        delta: storyPointsDelta,
      },
      finishedComparison: primaryActiveSprint
        ? {
            activeSprintId: primaryActiveSprint.id,
            activeSprintName: primaryActiveSprint.name,
            activeClosedTickets: activeSprintMetrics[0]?.doneTickets ?? 0,
            activeStoryPointsClosed: activeSprintMetrics[0]?.storyPointsCompleted ?? 0,
            previousSprintId: previousSprint?.id ?? null,
            previousSprintName: previousSprint?.name ?? null,
            previousClosedTickets: previousClosedInPeriod.length,
            previousStoryPointsClosed: previousStoryPointsInPeriod,
            periodDays: elapsedDays,
          }
        : null,
      finishedComparisonByTeam,
      assignees,
      deliveryTimes: includeDeliveryTimes ? deliveryTimesWithPoints : [],
      deliveryTimesBySprint: includeDeliveryTimes ? deliveryTimesBySprintWithPoints : [],
      storyPointAverages: storyPointAveragesList,
    }

    metricsCache.set(cacheKey, {
      timestamp: Date.now(),
      payload: responsePayload,
    })

    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error('[Metrics] Jira metrics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Jira metrics' },
      { status: 500 }
    )
  }
}
