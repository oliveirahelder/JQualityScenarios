import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[Database Status] Error checking status:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
