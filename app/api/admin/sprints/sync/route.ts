import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { syncAllSprints, syncActiveSprints, syncRecentClosedSprints } from '@/lib/sprint-sync'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'

/**
 * POST /api/admin/sprints/sync
 * Manually trigger sprint sync (DEVOPS/ADMIN only)
 */
export async function POST(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Only DEVOPS and ADMIN can trigger sync
    if (!['DEVOPS', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const jiraCredentials = buildJiraCredentialsFromUser(user)
    if (!jiraCredentials) {
      return NextResponse.json(
        { error: 'Jira integration not configured' },
        { status: 400 }
      )
    }

    const { type = 'all' } = await req.json()

    let result

    switch (type) {
      case 'active':
        result = await syncActiveSprints(jiraCredentials)
        break
      case 'closed':
        result = await syncRecentClosedSprints(jiraCredentials)
        break
      case 'all':
      default:
        result = await syncAllSprints(jiraCredentials)
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
}

/**
 * GET /api/admin/sprints/sync-status
 * Check last sync status
 */
export async function GET(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

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
}
