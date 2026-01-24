import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'

const CLOSED_STATUSES = ['closed', 'done', 'resolved']
const DEV_STATUSES = ['in progress', 'in development', 'in refinement']

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
    })
  } catch (error) {
    console.error('[Metrics] Jira metrics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Jira metrics' },
      { status: 500 }
    )
  }
}
