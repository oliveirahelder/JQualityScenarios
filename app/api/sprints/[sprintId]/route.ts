import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (req: NextRequest & { user?: any }, { params }: { params: { sprintId: string } }) => {
  try {
    const sprint = await prisma.sprint.findUnique({
      where: { id: params.sprintId },
      include: {
        tickets: {
          include: {
            devInsights: true,
            testScenarios: true,
          },
        },
        documentationDrafts: true,
      },
    })

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 })
    }

    return NextResponse.json({ sprint })
  } catch (error) {
    console.error('Error fetching sprint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
