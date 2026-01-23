import { prisma } from '@/lib/prisma'
import {
  getActiveSprints,
  getRecentClosedSprints,
  normalizeSprint,
  normalizeIssue,
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

      // Sync issues in this sprint
      if (jiraSprint.issues) {
        for (const jiraIssue of jiraSprint.issues) {
          const issueNormalized = normalizeIssue(jiraIssue)
          const grossTime = Math.ceil(
            (new Date().getTime() - sprint.startDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )

          await prisma.ticket.upsert({
            where: { jiraId: issueNormalized.jiraId },
            update: {
              summary: issueNormalized.summary,
              description: issueNormalized.description,
              status: issueNormalized.status as any,
              assignee: issueNormalized.assignee,
              priority: issueNormalized.priority,
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
              grossTime: Math.max(0, grossTime),
            },
          })
        }

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
