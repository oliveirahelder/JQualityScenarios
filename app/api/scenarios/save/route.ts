import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
      title,
      description,
      given,
      when,
      then,
      testEnvironment,
    } = await req.json()

    if (!ticketId || !title) {
      return NextResponse.json(
        { error: 'ticketId and title are required' },
        { status: 400 }
      )
    }

    const scenario = await prisma.testScenario.create({
      data: {
        ticketId,
        userId: payload.userId,
        title,
        description,
        given,
        when,
        then,
        testEnvironment,
      },
    })

    return NextResponse.json({ scenario }, { status: 201 })
  } catch (error) {
    console.error('Error creating scenario:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
