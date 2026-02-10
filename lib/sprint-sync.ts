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

const DEFAULT_SPRINTS_PER_TEAM_LIMIT = 10
const MAX_SPRINTS_PER_TEAM_LIMIT = 50
const ACTIVE_TEAM_CUTOFF = new Date('2026-01-01T00:00:00.000Z')

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

function parseSprintHistory(value?: string | null) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

async function getSprintsPerTeamLimit() {
  const settings = await prisma.adminSettings.findFirst()
  const value = settings?.sprintsToSync
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(Math.max(Math.floor(value), 1), MAX_SPRINTS_PER_TEAM_LIMIT)
  }
  return DEFAULT_SPRINTS_PER_TEAM_LIMIT
}

type JiraSprintReportIssue = {
  key?: string
  summary?: string
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
    issueKeysAddedDuringSprint?: string[]
    issuesAddedDuringSprint?: Array<{ key?: string }>
  }
}

function countAddedIssues(contents?: JiraSprintReport['contents']) {
  if (!contents) return 0
  const addedKeys =
    contents.issueKeysAddedDuringSprint ||
    contents.issuesAddedDuringSprint ||
    ([] as Array<{ key?: string } | string>)
  if (Array.isArray(addedKeys)) {
    return addedKeys.length
  }
  return 0
}

function deriveScopeCounts(report?: JiraSprintReport | null) {
  const contents = report?.contents
  const completed = contents?.completedIssues || []
  const notCompleted = contents?.issuesNotCompletedInCurrentSprint || []
  const removed = contents?.issuesRemovedFromSprint || []
  const addedCount = countAddedIssues(contents)
  const planned = Math.max(0, completed.length + notCompleted.length + removed.length - addedCount)
  return {
    plannedTickets: planned,
    addedTickets: addedCount,
    removedTickets: removed.length,
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
    const activeTeamKeys = new Set<string>()
    const filteredActiveSprints = jiraSprints.filter((jiraSprint) => {
      const normalized = normalizeSprint(jiraSprint)
      if (!normalized.startDate || Number.isNaN(normalized.startDate.getTime())) {
        activeTeamKeys.add(getTeamKey(normalized.name))
        return true
      }
      const isActiveFromCutoff = normalized.startDate >= ACTIVE_TEAM_CUTOFF
      if (isActiveFromCutoff) {
        activeTeamKeys.add(getTeamKey(normalized.name))
      }
      return isActiveFromCutoff
    })

    for (const jiraSprint of filteredActiveSprints) {
      const normalized = normalizeSprint(jiraSprint)

      // Create or update sprint
      const sprint = await prisma.sprint.upsert({
        where: { jiraId: normalized.jiraId },
        update: {
          name: normalized.name,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          completedAt: normalized.completedAt,
          status: 'ACTIVE',
        },
        create: {
          jiraId: normalized.jiraId,
          name: normalized.name,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          completedAt: normalized.completedAt,
          status: 'ACTIVE',
        },
      })

      console.log(`[Sprint Sync] Sprint synced: ${normalized.name}`)

      let totalTickets = 0
      let closedTickets = 0
      let storyPointsTotal = 0
      let qaBounceBackCount = 0
      let scopeCounts = { plannedTickets: 0, addedTickets: 0, removedTickets: 0 }

      if (jiraSprint.boardId) {
        try {
          const report = (await getSprintReport(
            jiraSprint.boardId,
            jiraSprint.id,
            credentials
          )) as JiraSprintReport
          scopeCounts = deriveScopeCounts(report)
        } catch (error) {
          console.warn('[Sprint Sync] Failed to read sprint scope report:', error)
        }
      }

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
            select: { id: true, sprintHistory: true, jiraClosedAt: true, jiraCreatedAt: true },
          })
          const prCount = existingTicket
            ? await prisma.devInsight.count({
                where: {
                  ticketId: existingTicket.id,
                  prUrl: { not: null },
                },
              })
            : 0

          const history = parseSprintHistory(existingTicket?.sprintHistory)
          if (!history.includes(sprint.id)) {
            history.push(sprint.id)
          }
          const carryoverCount = Math.max(0, history.length - 1)
          const jiraCreatedAt = issueNormalized.createdAt ?? existingTicket?.jiraCreatedAt ?? null
          const jiraClosedAt = closedAt ?? existingTicket?.jiraClosedAt ?? null

          await prisma.ticket.upsert({
            where: { jiraId: issueNormalized.jiraId },
            update: {
              sprintId: sprint.id,
              summary: issueNormalized.summary,
              description: issueNormalized.description,
              status: issueNormalized.status,
              assignee: issueNormalized.assignee,
              priority: issueNormalized.priority,
              issueType: issueNormalized.issueType || null,
              storyPoints: storyPoints ?? null,
              qaBounceBackCount: ticketBounceBacks,
              prCount,
              grossTime: Math.max(0, grossTime),
              jiraCreatedAt,
              jiraClosedAt,
              sprintHistory: JSON.stringify(history),
              carryoverCount,
            },
            create: {
              sprintId: sprint.id,
              jiraId: issueNormalized.jiraId,
              summary: issueNormalized.summary,
              description: issueNormalized.description,
              status: issueNormalized.status,
              assignee: issueNormalized.assignee,
              priority: issueNormalized.priority,
              issueType: issueNormalized.issueType || null,
              storyPoints: storyPoints ?? null,
              qaBounceBackCount: ticketBounceBacks,
              prCount,
              grossTime: Math.max(0, grossTime),
              jiraCreatedAt,
              jiraClosedAt,
              sprintHistory: JSON.stringify(history),
              carryoverCount,
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
            plannedTickets: scopeCounts.plannedTickets || totalTickets,
            addedTickets: scopeCounts.addedTickets,
            removedTickets: scopeCounts.removedTickets,
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
    return {
      success: true,
      sprintCount: filteredActiveSprints.length,
      activeTeamKeys: Array.from(activeTeamKeys),
    }
  } catch (error) {
    console.error('[Sprint Sync] Error syncing active sprints:', error)
    throw error
  }
}

function isClosedStatus(status: string) {
  const value = (status || '').toLowerCase()
  if (value.includes('canceled') || value.includes('cancelled')) return false
  return value.includes('closed') || value.includes('done')
}

function isStrictClosedStatus(status: string) {
  const value = (status || '').toLowerCase()
  if (value.includes('canceled') || value.includes('cancelled')) return false
  return value.includes('closed') || value.includes('done')
}

/**
 * Sync recently closed sprints
 * Call this once daily
 */
export async function syncRecentClosedSprints(
  credentials?: JiraCredentials,
  options?: { force?: boolean; activeTeamKeys?: Set<string> }
) {
  try {
    console.log('[Sprint Sync] Starting recently closed sprints sync...')

    const closedSprints = await getRecentClosedSprints(credentials)
    const sprintsPerTeamLimit = await getSprintsPerTeamLimit()
    const storyPointsFieldId = await resolveStoryPointsFieldId(credentials)
    const filteredClosedSprints = options?.activeTeamKeys
      ? closedSprints.filter((sprint) => options.activeTeamKeys?.has(getTeamKey(sprint.name)))
      : closedSprints
    const limitedClosedSprints = limitClosedSprintsByTeam(
      filteredClosedSprints.sort(
        (a, b) => getSprintEndDate(b)!.getTime() - getSprintEndDate(a)!.getTime()
      ),
      sprintsPerTeamLimit
    )
    const keepJiraIds = new Set(limitedClosedSprints.map((sprint) => sprint.id.toString()))
    const existingSprints = await prisma.sprint.findMany({
      where: { jiraId: { in: Array.from(keepJiraIds) } },
      select: { id: true, jiraId: true },
    })
    const sprintByJiraId = new Map(existingSprints.map((sprint) => [sprint.jiraId, sprint.id]))
    const existingSnapshots = await prisma.sprintSnapshot.findMany({
      where: { jiraId: { in: Array.from(keepJiraIds) } },
      select: { jiraId: true },
    })
    const snapshotJiraIds = new Set(existingSnapshots.map((snapshot) => snapshot.jiraId))

    for (const jiraSprint of limitedClosedSprints) {
      const normalized = normalizeSprint(jiraSprint)
      const existingSprintId = sprintByJiraId.get(normalized.jiraId)
      const hasSnapshot = snapshotJiraIds.has(normalized.jiraId)

      if (!options?.force && existingSprintId && hasSnapshot) {
        await prisma.sprint.update({
          where: { id: existingSprintId },
          data: {
            name: normalized.name,
            startDate: normalized.startDate,
            endDate: normalized.endDate,
            completedAt: normalized.completedAt,
            status: 'COMPLETED',
          },
        })
        continue
      }

      const sprint = await prisma.sprint.upsert({
        where: { jiraId: normalized.jiraId },
        update: {
          status: 'COMPLETED',
          completedAt: normalized.completedAt,
        },
        create: {
          jiraId: normalized.jiraId,
          name: normalized.name,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          completedAt: normalized.completedAt,
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
export async function syncAllClosedSprints(
  credentials?: JiraCredentials,
  options?: { force?: boolean; activeTeamKeys?: Set<string> }
) {
  try {
    console.log('[Sprint Sync] Starting all closed sprints sync...')

    const closedSprints = await getAllClosedSprints(credentials)
    const sprintsPerTeamLimit = await getSprintsPerTeamLimit()
    const storyPointsFieldId = await resolveStoryPointsFieldId(credentials)
    const filteredClosedSprints = options?.activeTeamKeys
      ? closedSprints.filter((sprint) => options.activeTeamKeys?.has(getTeamKey(sprint.name)))
      : closedSprints
    const limitedClosedSprints = limitClosedSprintsByTeam(
      filteredClosedSprints.sort(
        (a, b) => getSprintEndDate(b)!.getTime() - getSprintEndDate(a)!.getTime()
      ),
      sprintsPerTeamLimit
    )
    const keepJiraIds = new Set(limitedClosedSprints.map((sprint) => sprint.id.toString()))
    const existingSprints = await prisma.sprint.findMany({
      where: {
        jiraId: { in: Array.from(keepJiraIds) },
      },
      select: {
        id: true,
        jiraId: true,
      },
    })
    const sprintByJiraId = new Map(existingSprints.map((sprint) => [sprint.jiraId, sprint.id]))
    const existingSnapshots = await prisma.sprintSnapshot.findMany({
      where: {
        jiraId: { in: Array.from(keepJiraIds) },
      },
      select: {
        jiraId: true,
      },
    })
    const snapshotJiraIds = new Set(existingSnapshots.map((snapshot) => snapshot.jiraId))

    await prisma.sprint.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'CLOSED'] },
        jiraId: { notIn: Array.from(keepJiraIds) },
      },
    })

    const sprintIds: string[] = []
    for (const jiraSprint of limitedClosedSprints) {
      const normalized = normalizeSprint(jiraSprint)
      const existingSprintId = sprintByJiraId.get(normalized.jiraId)
      const hasSnapshot = snapshotJiraIds.has(normalized.jiraId)

      if (!options?.force && existingSprintId && hasSnapshot) {
        await prisma.sprint.update({
          where: { id: existingSprintId },
          data: {
            name: normalized.name,
            startDate: normalized.startDate,
            endDate: normalized.endDate,
            completedAt: normalized.completedAt,
            status: 'COMPLETED',
          },
        })
        sprintIds.push(existingSprintId)
        continue
      }

      const sprint = await prisma.sprint.upsert({
        where: { jiraId: normalized.jiraId },
        update: {
          status: 'COMPLETED',
          completedAt: normalized.completedAt,
        },
        create: {
          jiraId: normalized.jiraId,
          name: normalized.name,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          completedAt: normalized.completedAt,
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
export async function syncAllSprints(
  credentials?: JiraCredentials,
  options?: { force?: boolean }
) {
  try {
    console.log('[Sprint Sync] Starting full sync...')

    const activeSyncResult = await syncActiveSprints(credentials)
    const activeTeamKeys = new Set<string>(
      Array.isArray(activeSyncResult.activeTeamKeys) ? activeSyncResult.activeTeamKeys : []
    )
    const closedSyncResult = await syncAllClosedSprints(
      credentials,
      activeTeamKeys.size > 0 ? { ...options, activeTeamKeys } : options
    )
    const cleanupResult =
      activeTeamKeys.size > 0 ? await purgeInactiveTeams(activeTeamKeys) : { prunedSprints: 0 }

    console.log('[Sprint Sync] Full sync completed')
    return {
      activeSprints: activeSyncResult,
      closedSprints: closedSyncResult,
      cleanup: cleanupResult,
    }
  } catch (error) {
    console.error('[Sprint Sync] Error during full sync:', error)
    throw error
  }
}

async function purgeInactiveTeams(activeTeamKeys: Set<string>) {
  if (!activeTeamKeys || activeTeamKeys.size === 0) {
    return { prunedSprints: 0 }
  }

  const allSprints = await prisma.sprint.findMany({
    select: { id: true, name: true },
  })
  const toDelete = allSprints.filter(
    (sprint) => !activeTeamKeys.has(getTeamKey(sprint.name))
  )

  if (toDelete.length === 0) {
    return { prunedSprints: 0 }
  }

  await prisma.sprint.deleteMany({
    where: {
      id: { in: toDelete.map((sprint) => sprint.id) },
    },
  })

  return { prunedSprints: toDelete.length }
}

async function syncSprintIssuesLite(
  jiraSprint: JiraSprintEvent & { issues?: JiraIssue[] },
  sprintId: string,
  sprintStart: Date,
  credentials?: JiraCredentials,
  storyPointsFieldId?: string | null
) {
  let scopeCounts = { plannedTickets: 0, addedTickets: 0, removedTickets: 0 }
  let sprintReport: JiraSprintReport | null = null
  if (jiraSprint.boardId) {
    try {
      sprintReport = (await getSprintReport(
        jiraSprint.boardId,
        jiraSprint.id,
        credentials
      )) as JiraSprintReport
      scopeCounts = deriveScopeCounts(sprintReport)
    } catch (error) {
      console.warn('[Sprint Sync] Failed to read sprint report for scope counts:', error)
    }
  }
  const issues =
    jiraSprint.issues ||
    (await getSprintIssues(jiraSprint.id, credentials, jiraSprint.boardId))
  if (!issues || issues.length === 0) {
    if (jiraSprint.boardId) {
      const report = sprintReport
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
          status.includes('awaiting approval') ||
          status.includes('in release') ||
          status.includes('done') ||
          status.includes('closed')
        ) {
          qaDoneTickets += 1
        }
      }

      const reportIssues = [...completedIssues, ...notCompleted]
      for (const issue of reportIssues) {
        const jiraId = issue?.key
        if (!jiraId) continue
        const value =
          issue?.estimateStatistic?.statFieldValue?.value ??
          issue?.currentEstimateStatistic?.statFieldValue?.value
        const points =
          typeof value === 'number'
            ? value
            : value != null
            ? Number(value)
            : null
        const storyPoints = Number.isNaN(points as number) ? null : points
        await prisma.ticket.upsert({
          where: { jiraId },
          update: {
            sprintId,
            summary: issue.summary || jiraId,
            status: issue.statusName || issue.status || 'Unknown',
            storyPoints,
          },
          create: {
            sprintId,
            jiraId,
            summary: issue.summary || jiraId,
            status: issue.statusName || issue.status || 'Unknown',
            storyPoints,
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
          plannedTickets: scopeCounts.plannedTickets || totalTickets,
          addedTickets: scopeCounts.addedTickets,
          removedTickets: scopeCounts.removedTickets,
          successPercent,
          storyPointsTotal,
        },
      })
      await ensureSprintSnapshot(sprintId, null, {
        plannedTickets: totalTickets,
        finishedTickets: closedTickets,
        qaDoneTickets,
        plannedScopeTickets: scopeCounts.plannedTickets || totalTickets,
        addedTickets: scopeCounts.addedTickets,
        removedTickets: scopeCounts.removedTickets,
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
      select: {
        id: true,
        qaBounceBackCount: true,
        sprintHistory: true,
        jiraClosedAt: true,
        jiraCreatedAt: true,
        sprintId: true,
        sprint: {
          select: { status: true },
        },
      },
    })
    const prCount = existingTicket
      ? await prisma.devInsight.count({
          where: {
            ticketId: existingTicket.id,
            prUrl: { not: null },
          },
        })
      : 0

    const history = parseSprintHistory(existingTicket?.sprintHistory)
    if (!history.includes(sprintId)) {
      history.push(sprintId)
    }
    const carryoverCount = Math.max(0, history.length - 1)
    const jiraCreatedAt = issueNormalized.createdAt ?? existingTicket?.jiraCreatedAt ?? null
    const jiraClosedAt = existingTicket?.jiraClosedAt ?? null

    const shouldOverrideSprint =
      !existingTicket?.sprint ||
      ['COMPLETED', 'CLOSED'].includes(existingTicket.sprint.status || '')
    const targetSprintId =
      shouldOverrideSprint || !existingTicket?.sprintId ? sprintId : existingTicket.sprintId

    await prisma.ticket.upsert({
      where: { jiraId: issueNormalized.jiraId },
      update: {
        sprintId: targetSprintId,
        summary: issueNormalized.summary,
        description: issueNormalized.description,
        status: issueNormalized.status,
        assignee: issueNormalized.assignee,
        priority: issueNormalized.priority,
        issueType: issueNormalized.issueType || null,
        storyPoints: storyPoints ?? null,
        qaBounceBackCount: existingTicket?.qaBounceBackCount ?? 0,
        prCount,
        grossTime: Math.max(0, grossTime),
        jiraCreatedAt,
        jiraClosedAt,
        sprintHistory: JSON.stringify(history),
        carryoverCount,
      },
      create: {
        sprintId,
        jiraId: issueNormalized.jiraId,
        summary: issueNormalized.summary,
        description: issueNormalized.description,
        status: issueNormalized.status,
        assignee: issueNormalized.assignee,
        priority: issueNormalized.priority,
        issueType: issueNormalized.issueType || null,
        storyPoints: storyPoints ?? null,
        qaBounceBackCount: 0,
        prCount,
        grossTime: Math.max(0, grossTime),
        jiraCreatedAt,
        jiraClosedAt,
        sprintHistory: JSON.stringify(history),
        carryoverCount,
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
      plannedTickets: scopeCounts.plannedTickets || totalTickets,
      addedTickets: scopeCounts.addedTickets,
      removedTickets: scopeCounts.removedTickets,
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
