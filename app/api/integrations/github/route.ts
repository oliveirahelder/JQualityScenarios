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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: user.githubUser || '',
      hasToken: Boolean(user.githubApiToken),
      connectionStatus: user.githubConnectionStatus || '',
      connectionCheckedAt: user.githubConnectionCheckedAt?.toISOString() || '',
    })
  } catch (error) {
    console.error('[GitHub Integration] Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to load GitHub settings' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { user: githubUser, token: githubToken } = await req.json()

    const normalizedUser = typeof githubUser === 'string' ? githubUser.trim() : ''
    const updateData: {
      githubUser?: string | null
      githubApiToken?: string | null
      githubConnectionStatus?: string | null
      githubConnectionCheckedAt?: Date | null
    } = {
      githubUser: normalizedUser || null,
      githubConnectionStatus: null,
      githubConnectionCheckedAt: null,
    }

    if (githubToken) {
      updateData.githubApiToken = githubToken
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[GitHub Integration] Error saving settings:', error)
    return NextResponse.json(
      { error: 'Failed to save GitHub settings' },
      { status: 500 }
    )
  }
}
