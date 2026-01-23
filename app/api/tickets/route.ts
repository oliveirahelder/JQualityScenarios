import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST add ticket to sprint
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

    const { sprintId, jiraId, summary, description, status, assignee, priority } =
      await req.json()

    if (!sprintId || !jiraId || !summary) {
      return NextResponse.json(
        { error: 'sprintId, jiraId, and summary are required' },
        { status: 400 }
      )
    }

    // Verify sprint exists
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
    })

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 })
    }

    // Check if ticket already exists
    const existingTicket = await prisma.ticket.findUnique({
      where: { jiraId },
    })

    if (existingTicket) {
      return NextResponse.json(
        { error: 'Ticket already exists' },
        { status: 409 }
      )
    }

    // Calculate gross time (calendar days from sprint start to now)
    const grossTime = Math.ceil(
      (new Date().getTime() - sprint.startDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    const ticket = await prisma.ticket.create({
      data: {
        sprintId,
        jiraId,
        summary,
        description,
        status: status || 'TODO',
        assignee,
        priority,
        grossTime: Math.max(0, grossTime), // Ensure non-negative
      },
    })

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    console.error('Error creating ticket:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
