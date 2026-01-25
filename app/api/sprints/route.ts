import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET all sprints
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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { jiraBaseUrl: true, jiraBoardIds: true },
    })

    const jiraBoardId = user?.jiraBoardIds
      ? user.jiraBoardIds
          .split(',')
          .map((value) => parseInt(value.trim(), 10))
          .find((value) => !Number.isNaN(value))
      : null

    const cutoffDate = new Date(Date.UTC(2025, 11, 1))
    const sprints = await prisma.sprint.findMany({
      include: {
        tickets: {
          include: {
            devInsights: true,
            testScenarios: true,
          },
        },
        documentationDrafts: true,
        snapshot: true,
      },
      where: {
        OR: [
          { status: { notIn: ['COMPLETED', 'CLOSED'] } },
          { endDate: { gte: cutoffDate } },
        ],
      },
      orderBy: { startDate: 'desc' },
    })

    const normalizedSprints = sprints.map((sprint) => {
      let snapshotTotals = null
      if (sprint.snapshot?.totals) {
        try {
          snapshotTotals = JSON.parse(sprint.snapshot.totals)
        } catch {
          snapshotTotals = null
        }
      }

      // Calculate documentation pipeline status
      const docDrafts = sprint.documentationDrafts || []
      const docStats = {
        total: docDrafts.length,
        draft: docDrafts.filter((d) => d.status === 'draft').length,
        underReview: docDrafts.filter((d) => d.status === 'under_review').length,
        approved: docDrafts.filter((d) => d.status === 'approved').length,
        published: docDrafts.filter((d) => d.status === 'published').length,
      }

      return {
        ...sprint,
        snapshotTotals,
        documentationStats: docStats,
        lastSyncedAt: sprint.updatedAt,
      }
    })

    return NextResponse.json({
      sprints: normalizedSprints,
      jiraBaseUrl: user?.jiraBaseUrl || '',
      jiraBoardId: jiraBoardId ?? null,
    })
  } catch (error) {
    console.error('Error fetching sprints:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST create new sprint
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

    // Only DEVOPS and ADMIN can create sprints
    if (!['DEVOPS', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { jiraId, name, startDate, endDate } = await req.json()

    if (!jiraId || !name || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'jiraId, name, startDate, and endDate are required' },
        { status: 400 }
      )
    }

    const existingSprint = await prisma.sprint.findUnique({
      where: { jiraId },
    })

    if (existingSprint) {
      return NextResponse.json(
        { error: 'Sprint already exists' },
        { status: 409 }
      )
    }

    const sprint = await prisma.sprint.create({
      data: {
        jiraId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'ACTIVE',
      },
    })

    return NextResponse.json({ sprint }, { status: 201 })
  } catch (error) {
    console.error('Error creating sprint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
