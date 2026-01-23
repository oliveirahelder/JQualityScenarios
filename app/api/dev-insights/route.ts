import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST create dev insight for a ticket
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
}
