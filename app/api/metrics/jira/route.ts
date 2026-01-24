import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'
import type { JiraCredentials } from '@/lib/jira-config'

const CLOSED_STATUSES = ['closed', 'done', 'resolved']
const DEV_STATUSES = ['in progress', 'in development', 'in refinement']

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
  closedStatuses: string[]
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
    const sorted = histories.sort(
      (a: any, b: any) => new Date(a.created).getTime() - new Date(b.created).getTime()
    )

    let devStart: Date | null = null
    let closedAt: Date | null = null

    for (const history of sorted) {
      for (const item of history.items || []) {
        if (item.field !== 'status') continue
        const toStatus = (item.toString || '').toLowerCase()
        if (!devStart && devStatuses.some((status) => toStatus.includes(status))) {
          devStart = new Date(history.created)
        }
        if (devStart && closedStatuses.some((status) => toStatus.includes(status))) {
          closedAt = new Date(history.created)
          break
        }
      }
      if (closedAt) break
    }

    if (!devStart || !closedAt) return null
    return { workHours: businessHoursBetween(devStart, closedAt) }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
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

    const activeSprints = await prisma.sprint.findMany({
      where: { status: 'ACTIVE' },
      include: { tickets: true },
      orderBy: { endDate: 'asc' },
    })

    const now = new Date()
    const activeSprintMetrics = activeSprints.map((sprint) => {
      const totalTickets =
        typeof sprint.totalTickets === 'number' && sprint.totalTickets > 0
          ? sprint.totalTickets
          : sprint.tickets.length
      const closedTickets =
        typeof sprint.closedTickets === 'number' && sprint.closedTickets >= 0
          ? sprint.closedTickets
          : sprint.tickets.filter((ticket) =>
              CLOSED_STATUSES.some((status) =>
                (ticket.status || '').toLowerCase().includes(status)
              )
            ).length
      const successPercent = totalTickets
        ? Math.round((closedTickets / totalTickets) * 1000) / 10
        : 0
      const devTickets = sprint.tickets.filter((ticket) =>
        DEV_STATUSES.some((status) =>
          (ticket.status || '').toLowerCase().includes(status)
        )
      ).length
      const doneTickets = sprint.tickets.filter((ticket) =>
        CLOSED_STATUSES.some((status) =>
          (ticket.status || '').toLowerCase().includes(status)
        )
      ).length
      const bounceBackTickets = sprint.tickets.filter(
        (ticket) => (ticket.qaBounceBackCount || 0) > 0
      ).length
      const bounceBackPercent = totalTickets
        ? Math.round((bounceBackTickets / totalTickets) * 1000) / 10
        : 0
      const storyPointsTotal =
        sprint.storyPointsTotal > 0
          ? sprint.storyPointsTotal
          : sprint.tickets.reduce((sum, ticket) => sum + (ticket.storyPoints || 0), 0)
      const storyPointsCompleted = sprint.tickets.reduce((sum, ticket) => {
        const isClosed = CLOSED_STATUSES.some((status) =>
          (ticket.status || '').toLowerCase().includes(status)
        )
        return sum + (isClosed ? ticket.storyPoints || 0 : 0)
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
        const isClosed = CLOSED_STATUSES.some((status) =>
          (ticket.status || '').toLowerCase().includes(status)
        )
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
        successPercent,
        daysLeft,
        devTickets,
        doneTickets,
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
      (sum, sprint) => sum + sprint.storyPointsTotal,
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
        if (
          CLOSED_STATUSES.some((status) =>
            (ticket.status || '').toLowerCase().includes(status)
          )
        ) {
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

    for (const sprint of activeSprints) {
      const sprintHours = new Map<string, { totalHours: number; ticketCount: number }>()
      for (const ticket of sprint.tickets || []) {
        if (!ticket.jiraId || !ticket.assignee) continue
        const timing = await getTicketWorkHours(
          ticket.jiraId,
          jiraCredentials,
          DEV_STATUSES,
          CLOSED_STATUSES
        )
        if (!timing) continue
        const sprintEntry = sprintHours.get(ticket.assignee) || {
          totalHours: 0,
          ticketCount: 0,
        }
        sprintEntry.totalHours += timing.workHours
        sprintEntry.ticketCount += 1
        sprintHours.set(ticket.assignee, sprintEntry)

        const overallEntry = workHoursByAssignee.get(ticket.assignee) || {
          totalHours: 0,
          ticketCount: 0,
        }
        overallEntry.totalHours += timing.workHours
        overallEntry.ticketCount += 1
        workHoursByAssignee.set(ticket.assignee, overallEntry)
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
        }))
        .sort((a, b) => b.ticketCount - a.ticketCount || a.name.localeCompare(b.name))

      deliveryTimesBySprint.push({
        sprintId: sprint.id,
        sprintName: sprint.name,
        entries: sprintEntries,
      })
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
    const previousSprint = await prisma.sprint.findFirst({
      where: { status: { in: ['CLOSED', 'COMPLETED'] } },
      include: { tickets: true },
      orderBy: { endDate: 'desc' },
    })
    const previousStoryPoints = previousSprint
      ? previousSprint.storyPointsTotal > 0
        ? previousSprint.storyPointsTotal
        : previousSprint.tickets.reduce((sum, ticket) => sum + (ticket.storyPoints || 0), 0)
      : 0
    const storyPointsDelta = currentStoryPoints - previousStoryPoints

    return NextResponse.json({
      activeSprintCount: activeSprintMetrics.length,
      activeSprints: activeSprintMetrics,
      storyPoints: {
        currentTotal: currentStoryPoints,
        previousTotal: previousStoryPoints,
        delta: storyPointsDelta,
      },
      assignees,
      deliveryTimes,
      deliveryTimesBySprint,
    })
  } catch (error) {
    console.error('[Metrics] Jira metrics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Jira metrics' },
      { status: 500 }
    )
  }
}
