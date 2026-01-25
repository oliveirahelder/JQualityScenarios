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

    const settings = await prisma.adminSettings.findFirst()
    return NextResponse.json({
      jiraBaseUrl: settings?.jiraBaseUrl || '',
      confluenceBaseUrl: settings?.confluenceBaseUrl || '',
      sprintsToSync: settings?.sprintsToSync ?? 10,
    })
  } catch (error) {
    console.error('[Admin Settings] Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to load admin settings' }, { status: 500 })
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

    if (!['ADMIN', 'DEVOPS'].includes(payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { jiraBaseUrl, confluenceBaseUrl, sprintsToSync } = await req.json()
    const normalizedJira =
      typeof jiraBaseUrl === 'string' ? jiraBaseUrl.trim().replace(/\/+$/, '') : undefined
    const normalizedConfluence =
      typeof confluenceBaseUrl === 'string'
        ? confluenceBaseUrl.trim().replace(/\/+$/, '')
        : undefined
    const normalizedSprintsToSync =
      typeof sprintsToSync === 'number' && Number.isFinite(sprintsToSync)
        ? Math.min(Math.max(Math.floor(sprintsToSync), 1), 50)
        : undefined

    const existing = await prisma.adminSettings.findFirst()
    if (existing) {
      await prisma.adminSettings.update({
        where: { id: existing.id },
        data: {
          jiraBaseUrl: normalizedJira || null,
          confluenceBaseUrl: normalizedConfluence || null,
          sprintsToSync: normalizedSprintsToSync ?? existing.sprintsToSync,
        },
      })
    } else {
      await prisma.adminSettings.create({
        data: {
          jiraBaseUrl: normalizedJira || null,
          confluenceBaseUrl: normalizedConfluence || null,
          sprintsToSync: normalizedSprintsToSync ?? 10,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Admin Settings] Error saving settings:', error)
    return NextResponse.json({ error: 'Failed to save admin settings' }, { status: 500 })
  }
}
