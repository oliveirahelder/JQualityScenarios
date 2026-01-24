import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
      take: 10,
    })

    const result = snapshots.map((snapshot) => ({
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
