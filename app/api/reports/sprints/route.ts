import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const CLOSED_SPRINTS_PER_TEAM_LIMIT = 10

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

    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
      if (list.length < CLOSED_SPRINTS_PER_TEAM_LIMIT) {
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
}
