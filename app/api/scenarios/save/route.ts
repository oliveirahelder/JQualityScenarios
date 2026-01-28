import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

export const POST = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user

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
})
