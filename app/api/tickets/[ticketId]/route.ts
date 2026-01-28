import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest & { user?: any }, { params }: { params: { ticketId: string } }) => {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: params.ticketId },
        include: {
          devInsights: true,
          testScenarios: true,
          documentationDraft: true,
        },
      })

      if (!ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
      }

      return NextResponse.json({ ticket })
    } catch (error) {
      console.error('Error fetching ticket:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
)

export const PATCH = withAuth(
  async (req: NextRequest & { user?: any }, { params }: { params: { ticketId: string } }) => {
    try {
      const { status, assignee, priority } = await req.json()

      const ticket = await prisma.ticket.update({
        where: { id: params.ticketId },
        data: {
          ...(status && { status }),
          ...(assignee && { assignee }),
          ...(priority && { priority }),
        },
      })

      return NextResponse.json({ ticket })
    } catch (error) {
      console.error('Error updating ticket:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
)
