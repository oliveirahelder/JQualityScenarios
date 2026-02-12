import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

const MAX_LIMIT = 500

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const { searchParams } = new URL(req.url)
    const teamKey = searchParams.get('teamKey')?.trim() || undefined
    const query = searchParams.get('q')?.trim()
    const limitParam = searchParams.get('limit')
    const limit = Math.min(
      Math.max(limitParam ? Number.parseInt(limitParam, 10) : 50, 1),
      MAX_LIMIT
    )

    const where: Record<string, any> = {}
    if (teamKey) {
      where.teamKey = teamKey
    }
    if (query) {
      where.OR = [
        { summary: { contains: query } },
        { description: { contains: query } },
        { comments: { contains: query } },
        { components: { contains: query } },
        { application: { contains: query } },
      ]
    }

    const tickets = await prisma.testCaseSourceTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ tickets })
  } catch (error) {
    console.error('Error fetching test case source tickets:', error)
    return NextResponse.json({ error: 'Failed to load QA history tickets' }, { status: 500 })
  }
})
