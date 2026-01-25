import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET all drafts for a user (with optional sprint/ticket filter)
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

    const { searchParams } = new URL(req.url)
    const sprintId = searchParams.get('sprintId')
    const status = searchParams.get('status')

    const where: { userId: string; sprintId?: string; status?: string } = {
      userId: payload.userId,
    }
    if (sprintId) where.sprintId = sprintId
    if (status) where.status = status

    const drafts = await prisma.documentationDraft.findMany({
      where,
      include: { ticket: true, sprint: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ drafts })
  } catch (error) {
    console.error('Error fetching drafts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST create new draft
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

    // Only QA and ADMIN can create drafts
    if (!['QA', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const {
      sprintId,
      ticketId,
      title,
      content,
      requirements,
      technicalNotes,
      testResults,
    } = await req.json()

    if (!sprintId || !ticketId || !title || !content) {
      return NextResponse.json(
        { error: 'sprintId, ticketId, title, and content are required' },
        { status: 400 }
      )
    }

    // Verify sprint and ticket exist
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
    })

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 })
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Check if draft already exists for this ticket
    const existingDraft = await prisma.documentationDraft.findUnique({
      where: { ticketId },
    })

    if (existingDraft) {
      return NextResponse.json(
        { error: 'Draft already exists for this ticket' },
        { status: 409 }
      )
    }

    const draft = await prisma.documentationDraft.create({
      data: {
        sprintId,
        ticketId,
        userId: payload.userId,
        title,
        content,
        requirements,
        technicalNotes,
        testResults,
        status: 'DRAFT',
      },
    })

    return NextResponse.json({ draft }, { status: 201 })
  } catch (error) {
    console.error('Error creating draft:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
