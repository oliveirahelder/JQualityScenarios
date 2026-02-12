import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

type TicketInput = {
  jiraId?: string
  summary?: string
}

export const POST = withAuth(
  async (
    req: NextRequest & { user?: any },
    { params }: { params: { testCaseId: string } }
  ) => {
    try {
      const testCaseId = params.testCaseId
      if (!testCaseId) {
        return NextResponse.json({ error: 'testCaseId is required' }, { status: 400 })
      }

      const body = await req.json()
      const ticketsInput: TicketInput[] = Array.isArray(body.tickets) ? body.tickets : []
      const uniqueTickets = Array.from(
        new Map(
          ticketsInput
            .filter((ticket) => ticket?.jiraId)
            .map((ticket) => [ticket.jiraId as string, ticket])
        ).values()
      )

      if (uniqueTickets.length === 0) {
        return NextResponse.json(
          { error: 'Provide at least one ticket to link' },
          { status: 400 }
        )
      }

      const testCase = await prisma.testCase.findUnique({
        where: { id: testCaseId },
        select: { id: true },
      })
      if (!testCase) {
        return NextResponse.json({ error: 'Test case not found' }, { status: 404 })
      }

      const jiraIds = uniqueTickets.map((ticket) => ticket.jiraId as string)
      const existingLinks = await prisma.testCaseTicket.findMany({
        where: {
          testCaseId,
          jiraId: { in: jiraIds },
        },
        select: { jiraId: true },
      })
      const existingSet = new Set(existingLinks.map((link) => link.jiraId))

      const ticketsToAdd = uniqueTickets.filter(
        (ticket) => !existingSet.has(ticket.jiraId as string)
      )

      if (ticketsToAdd.length === 0) {
        return NextResponse.json({ added: 0 })
      }

      const linkedTickets = await prisma.ticket.findMany({
        where: { jiraId: { in: ticketsToAdd.map((ticket) => ticket.jiraId as string) } },
        select: { id: true, jiraId: true },
      })
      const ticketMap = new Map(linkedTickets.map((ticket) => [ticket.jiraId, ticket.id]))

      await prisma.testCaseTicket.createMany({
        data: ticketsToAdd.map((ticket) => ({
          testCaseId,
          jiraId: ticket.jiraId as string,
          summary: ticket.summary?.trim() || null,
          ticketId: ticketMap.get(ticket.jiraId as string) || undefined,
        })),
      })

      await prisma.testCase.update({
        where: { id: testCaseId },
        data: {},
      })

      return NextResponse.json({ added: ticketsToAdd.length })
    } catch (error) {
      console.error('Error linking tickets to test case:', error)
      return NextResponse.json({ error: 'Failed to link tickets' }, { status: 500 })
    }
  }
)
