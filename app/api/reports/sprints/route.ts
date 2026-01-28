import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withRole } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

const DEFAULT_SPRINTS_PER_TEAM_LIMIT = 10
const MAX_SPRINTS_PER_TEAM_LIMIT = 50

function getTeamKey(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return 'TEAM'
  const match = trimmed.match(/^[A-Za-z0-9]+/)
  return match ? match[0].toUpperCase() : trimmed.toUpperCase()
}

function safeParse(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export const GET = withAuth(
  withRole('ADMIN')(async (req: NextRequest & { user?: any }) => {
    try {
      const settings = await prisma.adminSettings.findFirst()
      const sprintsPerTeamLimit =
        typeof settings?.sprintsToSync === 'number' && Number.isFinite(settings.sprintsToSync)
          ? Math.min(Math.max(Math.floor(settings.sprintsToSync), 1), MAX_SPRINTS_PER_TEAM_LIMIT)
          : DEFAULT_SPRINTS_PER_TEAM_LIMIT
      const cutoffDate = new Date(Date.UTC(2025, 11, 1))
      const snapshots = await prisma.sprintSnapshot.findMany({
        orderBy: { endDate: 'desc' },
        where: { endDate: { gte: cutoffDate } },
        take: 200,
      })

      const grouped = new Map<string, typeof snapshots>()
      for (const snapshot of snapshots) {
        const key = getTeamKey(snapshot.name)
        const list = grouped.get(key) || []
        if (list.length < sprintsPerTeamLimit) {
          list.push(snapshot)
          grouped.set(key, list)
        }
      }

      const result = Array.from(grouped.values())
        .flat()
        .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())
        .map((snapshot) => ({
          id: snapshot.id,
          sprintId: snapshot.sprintId,
          jiraId: snapshot.jiraId,
          name: snapshot.name,
          startDate: snapshot.startDate,
          endDate: snapshot.endDate,
          status: snapshot.status,
          totals: safeParse(snapshot.totals) || {},
          assignees: safeParse(snapshot.assignees) || [],
          deliveryTimes: safeParse(snapshot.deliveryTimes) || [],
          ticketTimes: safeParse(snapshot.ticketTimes) || [],
        }))

      return NextResponse.json({ snapshots: result })
    } catch (error) {
      console.error('Error fetching sprint reports:', error)
      return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
    }
  })
)
