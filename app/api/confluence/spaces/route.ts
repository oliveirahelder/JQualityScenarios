import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'
import { buildConfluenceCredentialsFromUser } from '@/lib/confluence-config'

type ConfluenceSpace = {
  key: string
  name: string
}

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const adminSettings = await prisma.adminSettings.findFirst()
    const credentials = buildConfluenceCredentialsFromUser(
      user,
      adminSettings?.confluenceBaseUrl || null,
      {
        clientId: adminSettings?.confluenceAccessClientId || null,
        clientSecret: adminSettings?.confluenceAccessClientSecret || null,
      }
    )
    if (!credentials) {
      return NextResponse.json({ error: 'Confluence integration not configured' }, { status: 400 })
    }

    const fetchSpacesForBase = async (baseUrl: string) => {
      const spaces: ConfluenceSpace[] = []
      let start = 0
      const limit = 50
      let hasMore = true
      let pageCount = 0

      while (hasMore && pageCount < 5) {
        const response = await axios.get(`${baseUrl}/rest/api/space`, {
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
          headers: {
            ...(credentials.authType === 'bearer'
              ? {
                  Authorization: `Bearer ${credentials.token}`,
                }
              : {}),
            ...(credentials.accessClientId && credentials.accessClientSecret
              ? {
                  'CF-Access-Client-Id': credentials.accessClientId,
                  'CF-Access-Client-Secret': credentials.accessClientSecret,
                }
              : {}),
          },
          timeout: credentials.requestTimeout || 30000,
        })

        if (
          typeof response.data === 'string' &&
          response.headers?.['content-type']?.includes('text/html')
        ) {
          throw new Error(
            'Confluence is protected by Cloudflare Access. Configure CF Access headers.'
          )
        }

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

      return spaces
    }

    const baseCandidates = new Set<string>()
    const trimmedBase = credentials.baseUrl.replace(/\/+$/, '')
    baseCandidates.add(trimmedBase)
    try {
      const parsed = new URL(trimmedBase)
      const basePath = parsed.pathname.toLowerCase()
      if (!basePath || basePath === '/') {
        baseCandidates.add(`${parsed.origin}/confluence`)
        baseCandidates.add(`${parsed.origin}/wiki`)
      }
    } catch {
      // Ignore invalid base URL.
    }

    let lastError: string | null = null
    for (const baseUrl of baseCandidates) {
      try {
        const spaces = await fetchSpacesForBase(baseUrl)
        return NextResponse.json({ spaces })
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Failed to load Confluence spaces'
      }
    }

    throw new Error(lastError || 'Failed to load Confluence spaces')
  } catch (error) {
    console.error('[Confluence Spaces] Error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to load Confluence spaces'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
