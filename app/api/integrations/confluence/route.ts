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
      baseUrl: user.confluenceBaseUrl || process.env.CONFLUENCE_BASE_URL || '',
      hasToken: Boolean(user.confluenceApiToken),
      connectionStatus: user.confluenceConnectionStatus || '',
      connectionCheckedAt: user.confluenceConnectionCheckedAt?.toISOString() || '',
    })
  } catch (error) {
    console.error('[Confluence Integration] Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to load Confluence settings' },
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
    const isAdmin = ['ADMIN', 'DEVOPS'].includes(payload.role)

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { baseUrl, token: confluenceToken } = await req.json()

    const normalizedBaseUrl =
      typeof baseUrl === 'string' ? baseUrl.trim().replace(/\/+$/, '') : undefined

    const updateData: {
      confluenceBaseUrl?: string | null
      confluenceApiToken?: string | null
      confluenceAuthType?: string | null
      confluenceDeployment?: string | null
      confluenceConnectionStatus?: string | null
      confluenceConnectionCheckedAt?: Date | null
    } = {
      confluenceAuthType: 'bearer',
      confluenceDeployment: 'datacenter',
      confluenceConnectionStatus: null,
      confluenceConnectionCheckedAt: null,
    }

    if (typeof normalizedBaseUrl === 'string' && isAdmin) {
      updateData.confluenceBaseUrl = normalizedBaseUrl || null
    }

    if (confluenceToken) {
      updateData.confluenceApiToken = confluenceToken
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Confluence Integration] Error saving settings:', error)
    return NextResponse.json(
      { error: 'Failed to save Confluence settings' },
      { status: 500 }
    )
  }
}
