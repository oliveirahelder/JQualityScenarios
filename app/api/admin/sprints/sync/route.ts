import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withRole } from '@/lib/middleware'
import {
  syncAllSprints,
  syncActiveSprints,
  syncRecentClosedSprints,
  syncAllClosedSprints,
} from '@/lib/sprint-sync'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'
import type { JiraCredentials } from '@/lib/jira-config'

/**
 * POST /api/admin/sprints/sync
 * Manually trigger sprint sync (DEVOPS/ADMIN only)
 */
export const POST = withAuth(
  withRole('DEVOPS', 'ADMIN')(async (req: NextRequest & { user?: any }) => {
    try {
      const payload = req.user

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const adminSettings = await prisma.adminSettings.findFirst()
      const jiraCredentials = buildJiraCredentialsFromUser(
        user,
        adminSettings?.jiraBaseUrl || null
      )
      if (!jiraCredentials) {
        return NextResponse.json(
          { error: 'Jira integration not configured' },
          { status: 400 }
        )
      }

      const { type = 'all', boardUrl, boardIds, force } = await req.json()

      const overrideBoardIds = parseBoardIds(boardIds, boardUrl)
      const credentials: JiraCredentials = overrideBoardIds
        ? { ...jiraCredentials, boardIds: overrideBoardIds }
        : jiraCredentials

      let result

      switch (type) {
        case 'active':
          result = await syncActiveSprints(credentials)
          break
        case 'closed':
          result = await syncRecentClosedSprints(credentials, { force })
          break
        case 'closed_all':
          result = await syncAllClosedSprints(credentials, { force })
          break
        case 'all':
        default:
          result = await syncAllSprints(credentials, { force })
      }

      return NextResponse.json({
        message: 'Sprint sync completed',
        result,
      })
    } catch (error) {
      console.error('Error triggering sprint sync:', error)
      return NextResponse.json(
        { error: 'Failed to sync sprints' },
        { status: 500 }
      )
    }
  })
)

function parseBoardIds(
  rawIds: string | undefined,
  boardUrl: string | undefined
): number[] | null {
  const extracted = boardUrl ? extractBoardIdFromUrl(boardUrl) : null
  if (extracted) return [extracted]
  if (!rawIds) return null
  const parsed = rawIds
    .split(',')
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => !Number.isNaN(value))
  return parsed.length ? parsed : null
}

function extractBoardIdFromUrl(value: string): number | null {
  if (!value) return null
  try {
    const url = new URL(value)
    const rapidView = url.searchParams.get('rapidView')
    if (rapidView) return parseInt(rapidView, 10)
    const boardMatch = url.pathname.match(/\/boards?\/(\d+)/i)
    if (boardMatch?.[1]) return parseInt(boardMatch[1], 10)
  } catch {
    const rapidMatch = value.match(/rapidView=(\d+)/i)
    if (rapidMatch?.[1]) return parseInt(rapidMatch[1], 10)
  }
  return null
}

/**
 * GET /api/admin/sprints/sync-status
 * Check last sync status
 */
export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    // Status endpoint available to all authenticated users
    return NextResponse.json({
      status: 'running',
      lastSync: new Date().toISOString(),
      message: 'Sprint sync is running via scheduled jobs',
    })
  } catch (error) {
    console.error('Error fetching sync status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    )
  }
})
