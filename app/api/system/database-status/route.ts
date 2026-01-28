import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[Database Status] Error checking status:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
})
