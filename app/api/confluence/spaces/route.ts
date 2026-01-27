import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { prisma } from '@/lib/prisma'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { buildConfluenceCredentialsFromUser } from '@/lib/confluence-config'

type ConfluenceSpace = {
  key: string
  name: string
}

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

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const adminSettings = await prisma.adminSettings.findFirst()
    const credentials = buildConfluenceCredentialsFromUser(
      user,
      adminSettings?.confluenceBaseUrl || null
    )
    if (!credentials) {
      return NextResponse.json({ error: 'Confluence integration not configured' }, { status: 400 })
    }

    const spaces: ConfluenceSpace[] = []
    let start = 0
    const limit = 50
    let hasMore = true
    let pageCount = 0

    while (hasMore && pageCount < 5) {
      const response = await axios.get(`${credentials.baseUrl}/rest/api/space`, {
        params: {
          limit,
          start,
          type: 'global',
        },
        auth:
          credentials.authType === 'basic'
            ? {
                username: credentials.user as string,
                password: credentials.token,
              }
            : undefined,
        headers:
          credentials.authType === 'bearer'
            ? {
                Authorization: `Bearer ${credentials.token}`,
              }
            : undefined,
        timeout: credentials.requestTimeout || 30000,
      })

      const results = response.data?.results || []
      for (const space of results) {
        if (space?.key) {
          spaces.push({ key: space.key, name: space.name || space.key })
        }
      }

      start += results.length
      pageCount += 1
      hasMore = results.length === limit
    }

    return NextResponse.json({ spaces })
  } catch (error) {
    console.error('[Confluence Spaces] Error:', error)
    return NextResponse.json({ error: 'Failed to load Confluence spaces' }, { status: 500 })
  }
}
