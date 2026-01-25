import { prisma } from '@/lib/prisma'
import {
  getActiveSprints,
  getAllClosedSprints,
  getRecentClosedSprints,
  getSprintReport,
  getSprintIssues,
  normalizeSprint,
  normalizeIssue,
  getIssueChangelogMetrics,
  resolveStoryPointsFieldId,
} from '@/lib/jira-sprints'
import type { JiraIssue, JiraSprintEvent } from '@/lib/jira-sprints'
import type { JiraCredentials } from '@/lib/jira-config'
import { ensureSprintSnapshot } from '@/lib/sprint-snapshot'

const CLOSED_CUTOFF_DATE = new Date(Date.UTC(2025, 0, 1))
const CLOSED_SPRINTS_PER_TEAM_LIMIT = 10

function getTeamKey(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return 'TEAM'
  const match = trimmed.match(/^[A-Za-z0-9]+/)
  return match ? match[0].toUpperCase() : trimmed.toUpperCase()
}

function limitClosedSprintsByTeam(
  sprints: JiraSprintEvent[],
  limit: number
): JiraSprintEvent[] {
  const sorted = [...sprints].sort(
    (a, b) => getSprintEndDate(b)!.getTime() - getSprintEndDate(a)!.getTime()
  )
  const grouped = new Map<string, JiraSprintEvent[]>()

  for (const sprint of sorted) {
    const key = getTeamKey(sprint.name)
    const list = grouped.get(key) || []
    if (list.length < limit) {
      list.push(sprint)
      grouped.set(key, list)
    }
  }

  return Array.from(grouped.values()).flat()
}

type JiraSprintReportIssue = {
  estimateStatistic?: { statFieldValue?: { value?: number | string | null } }
  currentEstimateStatistic?: { statFieldValue?: { value?: number | string | null } }
  statusName?: string
  status?: string
}

type JiraSprintReport = {
  contents?: {
    completedIssues?: JiraSprintReportIssue[]
    issuesNotCompletedInCurrentSprint?: JiraSprintReportIssue[]
    issuesRemovedFromSprint?: JiraSprintReportIssue[]
  }
}

/**
 * Sync active sprints from Jira to database
 * Call this periodically (e.g., every 5 minutes via cron job)
 */
export async function syncActiveSprints(credentials?: JiraCredentials) {
  try {
    console.log('[Sprint Sync] Starting active sprints sync...')

    const jiraSprints = await getActiveSprints(credentials)
    const storyPointsFieldId = await resolveStoryPointsFieldId(credentials)

    for (const jiraSprint of jiraSprints) {
      const normalized = normalizeSprint(jiraSprint)

      // Create or update sprint
      const sprint = await prisma.sprint.upsert({
        where: { jiraId: normalized.jiraId },
        update: {
          name: normalized.name,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          status: 'ACTIVE',
        },
        create: {
          jiraId: normalized.jiraId,
          name: normalized.name,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          status: 'ACTIVE',
        },
      })

      console.log(`[Sprint Sync] Sprint synced: ${normalized.name}`)

      let totalTickets = 0
      let closedTickets = 0
      let storyPointsTotal = 0
      let qaBounceBackCount = 0

      // Sync issues in this sprint
      if (jiraSprint.issues) {
        for (const jiraIssue of jiraSprint.issues) {
          const issueNormalized = normalizeIssue(jiraIssue)
          const { storyPoints, qaBounceBackCount: ticketBounceBacks, closedAt } =
            await getIssueChangelogMetrics(
              jiraIssue.key,
              credentials,
              storyPointsFieldId
            )
          const sprintEnd = sprint.endDate || new Date()
          const isClosedInSprint =
            closedAt != null &&
            closedAt >= sprint.startDate &&
            closedAt <= sprintEnd &&
            isStrictClosedStatus(issueNormalized.status)
          totalTickets += 1
          if (isClosedInSprint) closedTickets += 1
          if (typeof storyPoints === 'number' && !Number.isNaN(storyPoints)) {
            storyPointsTotal += storyPoints
          }
          qaBounceBackCount += ticketBounceBacks
          const grossTime = Math.ceil(
            (new Date().getTime() - sprint.startDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
          const existingTicket = await prisma.ticket.findUnique({
            where: { jiraId: issueNormalized.jiraId },
            select: { id: true },
          })
          const prCount = existingTicket
            ? await prisma.devInsight.count({
                where: {
                  ticketId: existingTicket.id,
                  prUrl: { not: null },
                },
              })
            : 0

          await prisma.ticket.upsert({
            where: { jiraId: issueNormalized.jiraId },
            update: {
              summary: issueNormalized.summary,
              description: issueNormalized.description,
              status: issueNormalized.status,
              assignee: issueNormalized.assignee,
              priority: issueNormalized.priority,
              storyPoints: storyPoints ?? null,
              qaBounceBackCount: ticketBounceBacks,
              prCount,
              grossTime: Math.max(0, grossTime),
            },
            create: {
              sprintId: sprint.id,
              jiraId: issueNormalized.jiraId,
              summary: issueNormalized.summary,
              description: issueNormalized.description,
              status: 'TODO',
              assignee: issueNormalized.assignee,
              priority: issueNormalized.priority,
              storyPoints: storyPoints ?? null,
              qaBounceBackCount: ticketBounceBacks,
              prCount,
              grossTime: Math.max(0, grossTime),
            },
          })
        }

        const successPercent = totalTickets
          ? Math.round((closedTickets / totalTickets) * 1000) / 10
          : 0
        await prisma.sprint.update({
          where: { id: sprint.id },
          data: {
            totalTickets,
            closedTickets,
            successPercent,
            storyPointsTotal,
            qaBounceBackCount,
          },
        })

        console.log(
          `[Sprint Sync] Synced ${jiraSprint.issues.length} issues for sprint: ${normalized.name}`
        )
      }
    }

    console.log('[Sprint Sync] Active sprints sync completed')
    return { success: true, sprintCount: jiraSprints.length }
  } catch (error) {
    console.error('[Sprint Sync] Error syncing active sprints:', error)
    throw error
  }
}

function isClosedStatus(status: string) {
  const value = (status || '').toLowerCase()
  return value.includes('closed') || value.includes('done') || value.includes('resolved')
}

function isStrictClosedStatus(status: string) {
  const value = (status || '').toLowerCase()
  return value.includes('closed')
}

/**
 * Sync recently closed sprints
 * Call this once daily
 */
export async function syncRecentClosedSprints(credentials?: JiraCredentials) {
  try {
    console.log('[Sprint Sync] Starting recently closed sprints sync...')

    const closedSprints = await getRecentClosedSprints(credentials)
    const storyPointsFieldId = await resolveStoryPointsFieldId(credentials)
    const limitedClosedSprints = limitClosedSprintsByTeam(
      closedSprints
        .filter((sprint) => {
          const endDate = getSprintEndDate(sprint)
          return endDate && endDate >= CLOSED_CUTOFF_DATE
        })
        .sort(
          (a, b) => getSprintEndDate(b)!.getTime() - getSprintEndDate(a)!.getTime()
        ),
      CLOSED_SPRINTS_PER_TEAM_LIMIT
    )

    for (const jiraSprint of limitedClosedSprints) {
      const endDate = getSprintEndDate(jiraSprint)
      if (!endDate || endDate < CLOSED_CUTOFF_DATE) {
        continue
      }
      const normalized = normalizeSprint(jiraSprint)

      const sprint = await prisma.sprint.upsert({
        where: { jiraId: normalized.jiraId },
        update: { status: 'COMPLETED' },
        create: {
          jiraId: normalized.jiraId,
          name: normalized.name,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          status: 'COMPLETED',
        },
      })

      await syncSprintIssuesLite(
        jiraSprint,
        sprint.id,
        normalized.startDate,
        credentials,
        storyPointsFieldId
      )
      await ensureSprintSnapshot(sprint.id, null)
      console.log(`[Sprint Sync] Closed sprint updated: ${normalized.name}`)
    }

    console.log('[Sprint Sync] Recently closed sprints sync completed')
    return { success: true, closedSprintCount: limitedClosedSprints.length }
  } catch (error) {
    console.error('[Sprint Sync] Error syncing closed sprints:', error)
    throw error
  }
}

/**
 * Sync all closed sprints (no date window)
 * Call manually for historical backfill
 */
export async function syncAllClosedSprints(credentials?: JiraCredentials) {
  try {
    console.log('[Sprint Sync] Starting all closed sprints sync...')

    const closedSprints = await getAllClosedSprints(credentials)
    const storyPointsFieldId = await resolveStoryPointsFieldId(credentials)
    const limitedClosedSprints = limitClosedSprintsByTeam(
      closedSprints
        .filter((sprint) => {
          const endDate = getSprintEndDate(sprint)
          return endDate && endDate >= CLOSED_CUTOFF_DATE
        })
        .sort(
          (a, b) => getSprintEndDate(b)!.getTime() - getSprintEndDate(a)!.getTime()
        ),
      CLOSED_SPRINTS_PER_TEAM_LIMIT
    )
    const keepJiraIds = new Set(limitedClosedSprints.map((sprint) => sprint.id.toString()))

    await prisma.sprint.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'CLOSED'] },
        jiraId: { notIn: Array.from(keepJiraIds) },
        endDate: { gte: CLOSED_CUTOFF_DATE },
      },
    })

    const sprintIds: string[] = []
    for (const jiraSprint of limitedClosedSprints) {
      const normalized = normalizeSprint(jiraSprint)

      const sprint = await prisma.sprint.upsert({
        where: { jiraId: normalized.jiraId },
        update: { status: 'COMPLETED' },
        create: {
          jiraId: normalized.jiraId,
          name: normalized.name,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          status: 'COMPLETED',
        },
      })

      await syncSprintIssuesLite(
        jiraSprint,
        sprint.id,
        normalized.startDate,
        credentials,
        storyPointsFieldId
      )
      sprintIds.push(sprint.id)
      await ensureSprintSnapshot(sprint.id, null)
      console.log(`[Sprint Sync] Closed sprint updated: ${normalized.name}`)
    }

    queueEnrichSprintSnapshots(sprintIds, credentials)
    console.log('[Sprint Sync] All closed sprints sync completed')
    return {
      success: true,
      closedSprintCount: limitedClosedSprints.length,
      sprintIds,
      enrichment: 'queued',
    }
  } catch (error) {
    console.error('[Sprint Sync] Error syncing all closed sprints:', error)
    throw error
  }
}

/**
 * Manual trigger to sync all sprints (admin only)
 */
export async function syncAllSprints(credentials?: JiraCredentials) {
  try {
    console.log('[Sprint Sync] Starting full sync...')

    const [activeSyncResult, closedSyncResult] = await Promise.all([
      syncActiveSprints(credentials),
      syncRecentClosedSprints(credentials),
    ])

    console.log('[Sprint Sync] Full sync completed')
    return {
      activeSprints: activeSyncResult,
      closedSprints: closedSyncResult,
    }
  } catch (error) {
    console.error('[Sprint Sync] Error during full sync:', error)
    throw error
  }
}

async function syncSprintIssuesLite(
  jiraSprint: JiraSprintEvent & { issues?: JiraIssue[] },
  sprintId: string,
  sprintStart: Date,
  credentials?: JiraCredentials,
  storyPointsFieldId?: string | null
) {
  const issues = jiraSprint.issues || (await getSprintIssues(jiraSprint.id, credentials))
  if (!issues || issues.length === 0) {
    if (jiraSprint.boardId) {
      const report = (await getSprintReport(
        jiraSprint.boardId,
        jiraSprint.id,
        credentials
      )) as JiraSprintReport
      const completedIssues = report?.contents?.completedIssues || []
      const notCompleted = report?.contents?.issuesNotCompletedInCurrentSprint || []
      if (!completedIssues.length && !notCompleted.length) return

      const totalTickets = completedIssues.length + notCompleted.length
      const closedTickets = completedIssues.length
      let storyPointsTotal = 0
      let storyPointsClosed = 0
      let qaDoneTickets = 0

      for (const issue of completedIssues) {
        const value =
          issue?.estimateStatistic?.statFieldValue?.value ??
          issue?.currentEstimateStatistic?.statFieldValue?.value
        const points =
          typeof value === 'number'
            ? value
            : value != null
            ? Number(value)
            : 0
        const safePoints = Number.isNaN(points) ? 0 : points
        storyPointsTotal += safePoints
        storyPointsClosed += safePoints
      }

      for (const issue of notCompleted) {
        const value =
          issue?.estimateStatistic?.statFieldValue?.value ??
          issue?.currentEstimateStatistic?.statFieldValue?.value
        const points =
          typeof value === 'number'
            ? value
            : value != null
            ? Number(value)
            : 0
        const safePoints = Number.isNaN(points) ? 0 : points
        storyPointsTotal += safePoints
        const status = (issue?.statusName || issue?.status || '').toLowerCase()
        if (
          status.includes('ready for release') ||
          status.includes('waiting for approval') ||
          status.includes('awaiting approval') ||
          status.includes('in release')
        ) {
          qaDoneTickets += 1
        }
      }

      const successPercent = totalTickets
        ? Math.round((closedTickets / totalTickets) * 1000) / 10
        : 0

      await prisma.sprint.update({
        where: { id: sprintId },
        data: {
          totalTickets,
          closedTickets,
          successPercent,
          storyPointsTotal,
        },
      })
      await ensureSprintSnapshot(sprintId, null, {
        plannedTickets: totalTickets,
        finishedTickets: closedTickets,
        qaDoneTickets,
        storyPointsTotal,
        storyPointsClosed,
      })
    }
    return
  }

  let totalTickets = 0
  let closedTickets = 0
  let storyPointsTotal = 0

  for (const jiraIssue of issues) {
    const issueNormalized = normalizeIssue(jiraIssue)
    const storyValue =
      storyPointsFieldId && jiraIssue.fields ? jiraIssue.fields[storyPointsFieldId] : null
    const storyPoints =
      typeof storyValue === 'number'
        ? storyValue
        : storyValue != null
        ? Number(storyValue)
        : null
    const isClosed = isClosedStatus(issueNormalized.status)
    totalTickets += 1
    if (isClosed) closedTickets += 1
    if (typeof storyPoints === 'number' && !Number.isNaN(storyPoints)) {
      storyPointsTotal += storyPoints
    }
    const grossTime = Math.ceil(
      (new Date().getTime() - sprintStart.getTime()) / (1000 * 60 * 60 * 24)
    )
    const existingTicket = await prisma.ticket.findUnique({
      where: { jiraId: issueNormalized.jiraId },
      select: { id: true, qaBounceBackCount: true },
    })
    const prCount = existingTicket
      ? await prisma.devInsight.count({
          where: {
            ticketId: existingTicket.id,
            prUrl: { not: null },
          },
        })
      : 0

    await prisma.ticket.upsert({
      where: { jiraId: issueNormalized.jiraId },
      update: {
        summary: issueNormalized.summary,
        description: issueNormalized.description,
        status: issueNormalized.status,
        assignee: issueNormalized.assignee,
        priority: issueNormalized.priority,
        storyPoints: storyPoints ?? null,
        qaBounceBackCount: existingTicket?.qaBounceBackCount ?? 0,
        prCount,
        grossTime: Math.max(0, grossTime),
      },
      create: {
        sprintId,
        jiraId: issueNormalized.jiraId,
        summary: issueNormalized.summary,
        description: issueNormalized.description,
        status: issueNormalized.status,
        assignee: issueNormalized.assignee,
        priority: issueNormalized.priority,
        storyPoints: storyPoints ?? null,
        qaBounceBackCount: 0,
        prCount,
        grossTime: Math.max(0, grossTime),
      },
    })
  }

  const successPercent = totalTickets
    ? Math.round((closedTickets / totalTickets) * 1000) / 10
    : 0
  await prisma.sprint.update({
    where: { id: sprintId },
    data: {
      totalTickets,
      closedTickets,
      successPercent,
      storyPointsTotal,
    },
  })
}

function queueEnrichSprintSnapshots(
  sprintIds: string[],
  credentials?: JiraCredentials
) {
  if (!credentials || sprintIds.length === 0) return
  setTimeout(async () => {
    for (const sprintId of sprintIds) {
      await ensureSprintSnapshot(sprintId, credentials)
    }
  }, 0)
}

function getSprintEndDate(sprint: { endDate?: string | Date }) {
  if (!sprint.endDate) return null
  const endDate = new Date(sprint.endDate)
  return Number.isNaN(endDate.getTime()) ? null : endDate
}
