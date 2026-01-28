import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user

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
})

export const PUT = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user

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
})
