import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'

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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.githubApiToken) {
      return NextResponse.json({ error: 'GitHub token not configured' }, { status: 400 })
    }

    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${user.githubApiToken}`,
        Accept: 'application/vnd.github+json',
      },
    })

    if (!response.ok) {
      const message = response.status === 401 ? 'GitHub token unauthorized' : 'GitHub API error'
      return NextResponse.json({ error: message }, { status: response.status })
    }

    const data = await response.json()

    await prisma.user.update({
      where: { id: user.id },
      data: {
        githubConnectionStatus: 'connected',
        githubConnectionCheckedAt: new Date(),
      },
    })

    return NextResponse.json({
      login: data.login,
      name: data.name,
    })
  } catch (error) {
    console.error('[GitHub Integration] Error testing settings:', error)
    return NextResponse.json(
      { error: 'Failed to test GitHub connection' },
      { status: 500 }
    )
  }
}
