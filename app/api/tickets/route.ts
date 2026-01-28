import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

// POST add ticket to sprint
export const POST = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user

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
})
