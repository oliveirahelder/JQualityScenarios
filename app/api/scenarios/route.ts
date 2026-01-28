import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user

    const scenarios = await prisma.testScenario.findMany({
      where: { userId: payload.userId },
      include: { ticket: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ scenarios })
  } catch (error) {
    console.error('Error fetching scenarios:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
