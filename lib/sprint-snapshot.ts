import { prisma } from '@/lib/prisma'
import type { JiraCredentials } from '@/lib/jira-config'

const CLOSED_STATUSES = ['closed', 'done', 'resolved']
const DEV_STATUSES = ['in progress', 'in development', 'in refinement']

function isClosed(status: string | null | undefined) {
  return CLOSED_STATUSES.some((value) => (status || '').toLowerCase().includes(value))
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

export async function ensureSprintSnapshot(
  sprintId: string,
  credentials?: JiraCredentials | null
) {
  const existing = await prisma.sprintSnapshot.findUnique({
    where: { sprintId },
  })
  const shouldUpdateTimes =
    !!credentials && (!existing?.deliveryTimes || !existing?.ticketTimes)
  if (existing && !shouldUpdateTimes) return existing

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { tickets: true },
  })
  if (!sprint) return null

  const totalTickets =
    typeof sprint.totalTickets === 'number' && sprint.totalTickets > 0
      ? sprint.totalTickets
      : sprint.tickets.length
  const closedTickets =
    typeof sprint.closedTickets === 'number' && sprint.closedTickets >= 0
      ? sprint.closedTickets
      : sprint.tickets.filter((ticket) => isClosed(ticket.status)).length
  const storyPointsTotal =
    sprint.storyPointsTotal > 0
      ? sprint.storyPointsTotal
      : sprint.tickets.reduce((sum, ticket) => sum + (ticket.storyPoints || 0), 0)
  const storyPointsClosed = sprint.tickets.reduce((sum, ticket) => {
    return sum + (isClosed(ticket.status) ? ticket.storyPoints || 0 : 0)
  }, 0)
  const bounceBackTickets = sprint.tickets.filter(
    (ticket) => (ticket.qaBounceBackCount || 0) > 0
  ).length
  const successPercent = totalTickets
    ? Math.round((closedTickets / totalTickets) * 1000) / 10
    : 0

  const assigneeTotals = new Map<
    string,
    { tickets: number; closed: number; storyPoints: number; closedPoints: number }
  >()
  for (const ticket of sprint.tickets) {
    const name = (ticket.assignee || '').trim() || 'Unassigned'
    const entry = assigneeTotals.get(name) || {
      tickets: 0,
      closed: 0,
      storyPoints: 0,
      closedPoints: 0,
    }
    entry.tickets += 1
    entry.storyPoints += ticket.storyPoints || 0
    if (isClosed(ticket.status)) {
      entry.closed += 1
      entry.closedPoints += ticket.storyPoints || 0
    }
    assigneeTotals.set(name, entry)
  }

  const tickets = sprint.tickets.map((ticket) => ({
    jiraId: ticket.jiraId,
    summary: ticket.summary,
    status: ticket.status,
    assignee: ticket.assignee,
    priority: ticket.priority,
    storyPoints: ticket.storyPoints,
    qaBounceBackCount: ticket.qaBounceBackCount,
    prCount: ticket.prCount,
    grossTime: ticket.grossTime,
    updatedAt: ticket.updatedAt,
  }))

  const assignees = Array.from(assigneeTotals.entries())
    .map(([name, entry]) => ({
      name,
      tickets: entry.tickets,
      closed: entry.closed,
      storyPoints: entry.storyPoints,
      closedPoints: entry.closedPoints,
    }))
    .sort((a, b) => b.storyPoints - a.storyPoints || a.name.localeCompare(b.name))

  let ticketTimes: Array<{
    jiraId: string
    assignee: string | null
    workHours: number
  }> | null = null
  let deliveryTimes: Array<{
    name: string
    totalHours: number
    averageHours: number
    ticketCount: number
  }> | null = null

  if (credentials) {
    const workHoursByAssignee = new Map<
      string,
      { totalHours: number; ticketCount: number }
    >()
    ticketTimes = []
    for (const ticket of sprint.tickets) {
      if (!ticket.jiraId) continue
      const timing = await getTicketWorkHours(
        ticket.jiraId,
        credentials,
        DEV_STATUSES,
        CLOSED_STATUSES
      )
      if (!timing) continue
      const assignee = (ticket.assignee || '').trim()
      ticketTimes.push({
        jiraId: ticket.jiraId,
        assignee: assignee || null,
        workHours: Math.round(timing.workHours * 10) / 10,
      })

      if (assignee) {
        const entry = workHoursByAssignee.get(assignee) || {
          totalHours: 0,
          ticketCount: 0,
        }
        entry.totalHours += timing.workHours
        entry.ticketCount += 1
        workHoursByAssignee.set(assignee, entry)
      }
    }

    deliveryTimes = Array.from(workHoursByAssignee.entries())
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
  }

  const totalsPayload = {
    totalTickets,
    closedTickets,
    storyPointsTotal,
    storyPointsClosed,
    bounceBackTickets,
    successPercent,
  }

  const ticketsPayload = tickets
  const assigneesPayload = assignees
  const deliveryTimesPayload = deliveryTimes
  const ticketTimesPayload = ticketTimes

  if (existing) {
    return prisma.sprintSnapshot.update({
      where: { id: existing.id },
      data: {
        deliveryTimes:
          deliveryTimesPayload != null
            ? JSON.stringify(deliveryTimesPayload)
            : existing.deliveryTimes,
        ticketTimes:
          ticketTimesPayload != null
            ? JSON.stringify(ticketTimesPayload)
            : existing.ticketTimes,
      },
    })
  }

  return prisma.sprintSnapshot.create({
    data: {
      sprintId: sprint.id,
      jiraId: sprint.jiraId,
      name: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: sprint.status,
      totals: JSON.stringify(totalsPayload),
      tickets: JSON.stringify(ticketsPayload),
      assignees: JSON.stringify(assigneesPayload),
      deliveryTimes:
        deliveryTimesPayload != null ? JSON.stringify(deliveryTimesPayload) : null,
      ticketTimes: ticketTimesPayload != null ? JSON.stringify(ticketTimesPayload) : null,
    },
  })
}
