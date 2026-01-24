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
      select: { jiraBaseUrl: true },
    })

    const sprints = await prisma.sprint.findMany({
      include: {
        tickets: true,
        documentationDrafts: true,
      },
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json({ sprints, jiraBaseUrl: user?.jiraBaseUrl || '' })
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
