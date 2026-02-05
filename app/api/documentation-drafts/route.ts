import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withRole } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

// GET all drafts for a user (with optional sprint/ticket filter)
export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user

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
      include: {
        ticket: true,
        sprint: true,
        linkedTickets: { include: { ticket: true } },
      },
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
})

// POST create new draft
export const POST = withAuth(
  withRole('QA', 'ADMIN')(async (req: NextRequest & { user?: any }) => {
    try {
      const payload = req.user

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

      // Upsert draft by ticketId so scenarios can be re-saved
      const existingDraft = await prisma.documentationDraft.findUnique({
        where: { ticketId },
      })

      if (existingDraft) {
        const draft = await prisma.documentationDraft.update({
          where: { ticketId },
          data: {
            title,
            content,
            requirements,
            technicalNotes,
            testResults,
          },
          include: {
            ticket: true,
            sprint: true,
            linkedTickets: { include: { ticket: true } },
          },
        })

        await prisma.documentationAttachment.updateMany({
          where: { ticketId: ticket.id, userId: payload.userId },
          data: { draftId: draft.id },
        })

        return NextResponse.json({ draft, updated: true }, { status: 200 })
      }

      const existingDraftByTheme = await prisma.documentationDraft.findFirst({
        where: {
          title,
          userId: payload.userId,
        },
        orderBy: { updatedAt: 'desc' },
      })

      if (existingDraftByTheme) {
        const draft = await prisma.documentationDraft.update({
          where: { id: existingDraftByTheme.id },
          data: {
            content,
            requirements,
            technicalNotes,
            testResults,
          },
          include: {
            ticket: true,
            sprint: true,
            linkedTickets: { include: { ticket: true } },
          },
        })

        if (existingDraftByTheme.ticketId !== ticketId) {
          await prisma.documentationDraftTicket.upsert({
            where: {
              documentationDraftId_ticketId: {
                documentationDraftId: existingDraftByTheme.id,
                ticketId,
              },
            },
            update: {},
            create: {
              documentationDraftId: existingDraftByTheme.id,
              ticketId,
            },
          })
        }

        await prisma.documentationAttachment.updateMany({
          where: { ticketId: ticket.id, userId: payload.userId },
          data: { draftId: draft.id },
        })

        return NextResponse.json({ draft, updated: true }, { status: 200 })
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
        include: {
          ticket: true,
          sprint: true,
          linkedTickets: { include: { ticket: true } },
        },
      })

      await prisma.documentationAttachment.updateMany({
        where: { ticketId: ticket.id, userId: payload.userId },
        data: { draftId: draft.id },
      })

      return NextResponse.json({ draft, updated: false }, { status: 201 })
    } catch (error) {
      console.error('Error creating draft:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
)
