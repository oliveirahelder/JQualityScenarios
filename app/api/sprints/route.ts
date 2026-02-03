import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withRole } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

const DEFAULT_SPRINTS_PER_TEAM_LIMIT = 10
const MIN_SPRINTS_PER_TEAM_LIMIT = 2
const MAX_SPRINTS_PER_TEAM_LIMIT = 20

function getTeamKey(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return 'TEAM'
  const match = trimmed.match(/^[A-Za-z0-9]+/)
  return match ? match[0].toUpperCase() : trimmed.toUpperCase()
}

function clampSprintsToSync(value?: number | null) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(
      Math.max(Math.floor(value), MIN_SPRINTS_PER_TEAM_LIMIT),
      MAX_SPRINTS_PER_TEAM_LIMIT
    )
  }
  return DEFAULT_SPRINTS_PER_TEAM_LIMIT
}

function limitByTeam<T extends { name: string; endDate: Date }>(items: T[], limit: number) {
  const sorted = [...items].sort((a, b) => b.endDate.getTime() - a.endDate.getTime())
  const grouped = new Map<string, T[]>()
  for (const item of sorted) {
    const key = getTeamKey(item.name)
    const list = grouped.get(key) || []
    if (list.length < limit) {
      list.push(item)
      grouped.set(key, list)
    }
  }
  return Array.from(grouped.values()).flat()
}

// GET all sprints
export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user
    const { searchParams } = new URL(req.url)
    const rangeParam = searchParams.get('range') ?? searchParams.get('sprintsToSync')
    const rangeValue = rangeParam ? Number.parseInt(rangeParam, 10) : null

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { jiraBaseUrl: true, jiraBoardIds: true },
    })
    const adminSettings = await prisma.adminSettings.findFirst()

    const jiraBoardId = user?.jiraBoardIds
      ? user.jiraBoardIds
          .split(',')
          .map((value) => parseInt(value.trim(), 10))
          .find((value) => !Number.isNaN(value))
      : null

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
      orderBy: { endDate: 'desc' },
    })

    const sprintsToSync = clampSprintsToSync(
      Number.isFinite(rangeValue) ? rangeValue : adminSettings?.sprintsToSync
    )
    const limitedSprints = limitByTeam(sprints, sprintsToSync)

    const normalizedSprints = limitedSprints.map((sprint) => {
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
      jiraBaseUrl: adminSettings?.jiraBaseUrl || user?.jiraBaseUrl || '',
      jiraBoardId: jiraBoardId ?? null,
    })
  } catch (error) {
    console.error('Error fetching sprints:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

// POST create new sprint
export const POST = withAuth(
  withRole('DEVOPS', 'ADMIN')(async (req: NextRequest & { user?: any }) => {
    try {
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
  })
)
