import { NextRequest, NextResponse } from 'next/server'
import { searchJiraTickets, searchConfluencePages } from '@/lib/semantic-search'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'
import {
  buildConfluenceCredentialsFromUser,
  extractConfluenceParentPageId,
  extractConfluenceSpaceKey,
} from '@/lib/confluence-config'
import type { SearchResult } from '@/lib/semantic-search'

function parseCachedResults(value: string | null): SearchResult[] {
  if (!value) return []
  try {
    return JSON.parse(value) as SearchResult[]
  } catch (error) {
    console.warn('[Search] Invalid cached results JSON:', error)
    return []
  }
}

export const GET = withAuth(async (request: NextRequest & { user?: any }) => {
  try {
    const payload = request.user

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const type = searchParams.get('type') || 'all' // 'jira', 'confluence', 'all'
    const includeCache = searchParams.get('cache') !== 'false'
    const jiraLimitParam = searchParams.get('jiraLimit') || searchParams.get('limit')
    const confluenceLimitParam = searchParams.get('confluenceLimit') || searchParams.get('limit')
    const jiraLimit = jiraLimitParam ? Number(jiraLimitParam) : null
    const confluenceLimit = confluenceLimitParam ? Number(confluenceLimitParam) : null
    const spacesParam = searchParams.get('spaces')
    const spaceKeys = (spacesParam || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const hasSpacesParam = spaceKeys.length > 0
    const cacheKey = `${type}:${query ?? ''}:jira=${jiraLimit ?? 'default'}:conf=${
      confluenceLimit ?? 'default'
    }:spaces=${hasSpacesParam ? spaceKeys.join('|') : 'all'}`

    const adminSettings = await prisma.adminSettings.findFirst()
    const jiraCredentials = buildJiraCredentialsFromUser(
      user,
      adminSettings?.jiraBaseUrl || null
    )
    const confluenceCredentials = buildConfluenceCredentialsFromUser(
      user,
      adminSettings?.confluenceBaseUrl || null,
      {
        clientId: adminSettings?.confluenceAccessClientId || null,
        clientSecret: adminSettings?.confluenceAccessClientSecret || null,
      }
    )
    const confluenceSpaceKey =
      adminSettings?.confluenceSpaceKey ||
      extractConfluenceSpaceKey(adminSettings?.confluenceBaseUrl || null) ||
      null
    const confluencePublishParentId =
      extractConfluenceParentPageId(adminSettings?.confluenceParentPageId || null) ||
      extractConfluenceParentPageId(adminSettings?.confluenceBaseUrl || null) ||
      null
    const confluenceScope = {
      spaceKey: hasSpacesParam ? null : confluenceSpaceKey,
      spaceKeys: hasSpacesParam ? spaceKeys : [],
      parentPageId: confluencePublishParentId,
      baseCql: adminSettings?.confluenceSearchCql || null,
      limit: Number.isFinite(confluenceLimit as number)
        ? (confluenceLimit as number)
        : adminSettings?.confluenceSearchLimit ?? null,
    }

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    // Check cache first if enabled
    if (includeCache) {
      const cached = await prisma.historicalSearchCache.findUnique({
        where: {
          userId_query: {
            userId: user.id,
            query: cacheKey,
          },
        },
      })

      if (cached && new Date(cached.expiresAt) > new Date()) {
        return NextResponse.json({
          success: true,
          cached: true,
          jiraResults: parseCachedResults(cached.jiraResults),
          confluenceResults: parseCachedResults(cached.confluenceResults),
        })
      }
    }

    // Perform searches in parallel
    if ((type === 'all' || type === 'jira') && !jiraCredentials) {
      return NextResponse.json(
        { error: 'Jira integration not configured' },
        { status: 400 }
      )
    }

    const jiraPromise =
      type === 'all' || type === 'jira'
        ? searchJiraTickets(query, jiraCredentials || undefined, {
            limit: Number.isFinite(jiraLimit as number) ? (jiraLimit as number) : undefined,
          })
        : Promise.resolve([])
    if ((type === 'all' || type === 'confluence') && !confluenceCredentials) {
      return NextResponse.json(
        { error: 'Confluence integration not configured' },
        { status: 400 }
      )
    }

    let confluenceError: string | null = null
    const confluencePromise =
      type === 'all' || type === 'confluence'
        ? searchConfluencePages(query, confluenceCredentials || undefined, confluenceScope).catch(
            (error) => {
              confluenceError =
                error instanceof Error ? error.message : 'Failed to search Confluence'
              return []
            }
          )
        : Promise.resolve([])

    const [jiraResults, confluenceResults] = await Promise.all([
      jiraPromise,
      confluencePromise,
    ])

    // Cache results (24-hour expiry)
    if (includeCache) {
      try {
        await prisma.historicalSearchCache.upsert({
          where: {
            userId_query: {
              userId: user.id,
              query,
            },
          },
          create: {
            query: cacheKey,
            userId: user.id,
            jiraResults: JSON.stringify(jiraResults),
            confluenceResults: JSON.stringify(confluenceResults),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
          update: {
            jiraResults: JSON.stringify(jiraResults),
            confluenceResults: JSON.stringify(confluenceResults),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        })
      } catch (cacheError) {
        console.error('[Search] Error caching results:', cacheError)
        // Continue without cache update
      }
    }

    const confluenceDiagnostics =
      type === 'all' || type === 'confluence'
        ? {
            baseUrl: confluenceCredentials?.baseUrl || null,
            scope: confluenceScope,
            publishTarget: {
              parentPageId: confluencePublishParentId,
            },
            resultsCount: confluenceResults.length,
          }
        : undefined

    return NextResponse.json({
      success: true,
      cached: false,
      query,
      jiraResults,
      confluenceResults,
      confluenceError: confluenceError || undefined,
      confluenceDiagnostics,
      totalResults: jiraResults.length + confluenceResults.length,
    })
  } catch (error) {
    console.error('[Search] Error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to perform search',
      },
      { status: 500 }
    )
  }
})
