import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import {
  extractConfluenceParentPageId,
  extractConfluenceSpaceKey,
  normalizeConfluenceBaseUrl,
} from '@/lib/confluence-config'

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
      confluenceSpaceKey: settings?.confluenceSpaceKey || '',
      confluenceParentPageId: settings?.confluenceParentPageId || '',
      confluenceSearchCql: settings?.confluenceSearchCql || '',
      confluenceSearchLimit: settings?.confluenceSearchLimit ?? 10,
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

    const {
      jiraBaseUrl,
      confluenceBaseUrl,
      sprintsToSync,
      confluenceSpaceKey,
      confluenceParentPageId,
      confluenceSearchCql,
      confluenceSearchLimit,
    } = await req.json()
    const normalizedJira =
      typeof jiraBaseUrl === 'string' ? jiraBaseUrl.trim().replace(/\/+$/, '') : undefined
    const normalizedConfluence = normalizeConfluenceBaseUrl(confluenceBaseUrl) || undefined
    const normalizedSpaceKey =
      typeof confluenceSpaceKey === 'string'
        ? confluenceSpaceKey.trim().toUpperCase()
        : undefined
    const normalizedParentPageId = extractConfluenceParentPageId(confluenceParentPageId) || undefined
    const derivedSpaceKey = normalizedSpaceKey || extractConfluenceSpaceKey(confluenceBaseUrl) || undefined
    let normalizedSearchCql: string | undefined
    if (typeof confluenceSearchCql === 'string') {
      const trimmedSearch = confluenceSearchCql.trim()
      if (trimmedSearch) {
        let extracted = trimmedSearch
        try {
          const parsedSearchUrl = new URL(trimmedSearch)
          const cqlParam = parsedSearchUrl.searchParams.get('cql')
          if (cqlParam) {
            extracted = cqlParam
          }
        } catch {
          // Leave the raw CQL as-is.
        }
        try {
          normalizedSearchCql = decodeURIComponent(extracted)
        } catch {
          normalizedSearchCql = extracted
        }
        if (normalizedSearchCql) {
          normalizedSearchCql = normalizedSearchCql
            .replace(/siteSearch\s*~\s*\"[^\"]*\"/gi, '')
            .replace(/title\s*~\s*\"[^\"]*\"/gi, '')
            .replace(/text\s*~\s*\"[^\"]*\"/gi, '')
            .replace(/\(\s*\)/g, '')
            .replace(/\s+(AND|OR)\s+(\)|$)/gi, '$2')
            .replace(/^(AND|OR)\s+/i, '')
            .replace(/\s+(AND|OR)\s+(AND|OR)\s+/gi, ' $2 ')
            .replace(/\s+(AND|OR)\s+$/i, '')
            .trim()
        }
      }
    }
    const normalizedSearchLimit =
      typeof confluenceSearchLimit === 'number' && Number.isFinite(confluenceSearchLimit)
        ? Math.min(Math.max(Math.floor(confluenceSearchLimit), 1), 50)
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
          confluenceSpaceKey: derivedSpaceKey || null,
          confluenceParentPageId: normalizedParentPageId || null,
          confluenceSearchCql: normalizedSearchCql || null,
          confluenceSearchLimit: normalizedSearchLimit ?? existing.confluenceSearchLimit,
          sprintsToSync: normalizedSprintsToSync ?? existing.sprintsToSync,
        },
      })
    } else {
      await prisma.adminSettings.create({
        data: {
          jiraBaseUrl: normalizedJira || null,
          confluenceBaseUrl: normalizedConfluence || null,
          confluenceSpaceKey: derivedSpaceKey || null,
          confluenceParentPageId: normalizedParentPageId || null,
          confluenceSearchCql: normalizedSearchCql || null,
          confluenceSearchLimit: normalizedSearchLimit ?? 10,
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
