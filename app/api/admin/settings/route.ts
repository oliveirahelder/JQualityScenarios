import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, withRole } from '@/lib/middleware'
import {
  extractConfluenceParentPageId,
  extractConfluenceSpaceKey,
  normalizeConfluenceBaseUrl,
} from '@/lib/confluence-config'

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const settings = await prisma.adminSettings.findFirst()
    return NextResponse.json({
      jiraBaseUrl: settings?.jiraBaseUrl || '',
      confluenceBaseUrl: settings?.confluenceBaseUrl || '',
      confluenceSpaceKey: settings?.confluenceSpaceKey || '',
      confluenceParentPageId: settings?.confluenceParentPageId || '',
      confluenceSearchCql: settings?.confluenceSearchCql || '',
      confluenceSearchLimit: settings?.confluenceSearchLimit ?? 10,
      confluenceAccessClientIdSet: Boolean(settings?.confluenceAccessClientId),
      confluenceAccessClientSecretSet: Boolean(settings?.confluenceAccessClientSecret),
      sprintsToSync: settings?.sprintsToSync ?? 10,
    })
  } catch (error) {
    console.error('[Admin Settings] Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to load admin settings' }, { status: 500 })
  }
})

export const PUT = withAuth(
  withRole('ADMIN', 'DEVOPS')(async (req: NextRequest & { user?: any }) => {
    try {
      const {
        jiraBaseUrl,
        confluenceBaseUrl,
        sprintsToSync,
        confluenceSpaceKey,
        confluenceParentPageId,
        confluenceSearchCql,
        confluenceSearchLimit,
        confluenceAccessClientId,
        confluenceAccessClientSecret,
      } = await req.json()
    const normalizedJira =
      typeof jiraBaseUrl === 'string' ? jiraBaseUrl.trim().replace(/\/+$/, '') : undefined
    const normalizedConfluence = normalizeConfluenceBaseUrl(confluenceBaseUrl) || undefined
    const normalizedSpaceKey =
      typeof confluenceSpaceKey === 'string'
        ? confluenceSpaceKey.trim().toUpperCase()
        : undefined
    const rawParentPageId =
      typeof confluenceParentPageId === 'string' ? confluenceParentPageId.trim() : ''
    const normalizedParentPageId = extractConfluenceParentPageId(rawParentPageId)
    const parentPageIdToStore = normalizedParentPageId || (rawParentPageId || null)
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
    const normalizedAccessClientId =
      typeof confluenceAccessClientId === 'string' && confluenceAccessClientId.trim()
        ? confluenceAccessClientId.trim()
        : undefined
    const normalizedAccessClientSecret =
      typeof confluenceAccessClientSecret === 'string' &&
      confluenceAccessClientSecret.trim()
        ? confluenceAccessClientSecret.trim()
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
          confluenceParentPageId: parentPageIdToStore,
          confluenceSearchCql: normalizedSearchCql || null,
          confluenceSearchLimit: normalizedSearchLimit ?? existing.confluenceSearchLimit,
          ...(normalizedAccessClientId
            ? { confluenceAccessClientId: normalizedAccessClientId }
            : {}),
          ...(normalizedAccessClientSecret
            ? { confluenceAccessClientSecret: normalizedAccessClientSecret }
            : {}),
          sprintsToSync: normalizedSprintsToSync ?? existing.sprintsToSync,
        },
      })
    } else {
      await prisma.adminSettings.create({
        data: {
          jiraBaseUrl: normalizedJira || null,
          confluenceBaseUrl: normalizedConfluence || null,
          confluenceSpaceKey: derivedSpaceKey || null,
          confluenceParentPageId: parentPageIdToStore,
          confluenceSearchCql: normalizedSearchCql || null,
          confluenceSearchLimit: normalizedSearchLimit ?? 10,
          confluenceAccessClientId: normalizedAccessClientId || null,
          confluenceAccessClientSecret: normalizedAccessClientSecret || null,
          sprintsToSync: normalizedSprintsToSync ?? 10,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Admin Settings] Error saving settings:', error)
    return NextResponse.json({ error: 'Failed to save admin settings' }, { status: 500 })
  }
}))
