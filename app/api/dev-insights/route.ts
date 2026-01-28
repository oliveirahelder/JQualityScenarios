import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

// POST create dev insight for a ticket
export const POST = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const {
      ticketId,
      prUrl,
      prTitle,
      prNotes,
      prDiff,
      aiAnalysis,
      detectedImpactAreas,
    } = await req.json()

    if (!ticketId) {
      return NextResponse.json(
        { error: 'ticketId is required' },
        { status: 400 }
      )
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const devInsight = await prisma.devInsight.create({
      data: {
        ticketId,
        prUrl,
        prTitle,
        prNotes,
        prDiff,
        aiAnalysis,
        detectedImpactAreas: Array.isArray(detectedImpactAreas)
          ? JSON.stringify(detectedImpactAreas)
          : detectedImpactAreas || null,
        analyzedAt: new Date(),
      },
    })

    return NextResponse.json({ devInsight }, { status: 201 })
  } catch (error) {
    console.error('Error creating dev insight:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
