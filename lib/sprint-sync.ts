import { prisma } from '@/lib/prisma'
import {
  getActiveSprints,
  getRecentClosedSprints,
  normalizeSprint,
  normalizeIssue,
  getIssueChangelogMetrics,
  resolveStoryPointsFieldId,
} from '@/lib/jira-sprints'
import type { JiraCredentials } from '@/lib/jira-config'

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
          const { storyPoints, qaBounceBackCount: ticketBounceBacks } =
            await getIssueChangelogMetrics(
              jiraIssue.key,
              credentials,
              storyPointsFieldId
            )
          const isClosed = isClosedStatus(issueNormalized.status)
          totalTickets += 1
          if (isClosed) closedTickets += 1
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
              status: issueNormalized.status as any,
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

/**
 * Sync recently closed sprints
 * Call this once daily
 */
export async function syncRecentClosedSprints(credentials?: JiraCredentials) {
  try {
    console.log('[Sprint Sync] Starting recently closed sprints sync...')

    const closedSprints = await getRecentClosedSprints(credentials)

    for (const jiraSprint of closedSprints) {
      const normalized = normalizeSprint(jiraSprint)

      await prisma.sprint.upsert({
        where: { jiraId: normalized.jiraId },
        update: { status: 'CLOSED' },
        create: {
          jiraId: normalized.jiraId,
          name: normalized.name,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          status: 'CLOSED',
        },
      })

      console.log(`[Sprint Sync] Closed sprint updated: ${normalized.name}`)
    }

    console.log('[Sprint Sync] Recently closed sprints sync completed')
    return { success: true, closedSprintCount: closedSprints.length }
  } catch (error) {
    console.error('[Sprint Sync] Error syncing closed sprints:', error)
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
