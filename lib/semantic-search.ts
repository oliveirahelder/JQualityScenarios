import axios from 'axios'
import type { JiraCredentials } from '@/lib/jira-config'
import type { ConfluenceCredentials } from '@/lib/confluence-config'
import { normalizeConfluenceBaseUrl } from '@/lib/confluence-config'

export interface SearchResult {
  id: string
  title: string
  type: 'jira_ticket' | 'confluence_page'
  url: string
  relevanceScore: number
  summary: string
}

export interface ConfluenceSearchDiagnostics {
  baseCandidates: string[]
  scope: {
    spaceKey?: string | null
    spaceKeys?: string[]
    parentPageId?: string | null
    baseCql?: string | null
    limit?: number | null
  }
  keywords: string[]
  hadSuccessfulResponse: boolean
  usedFallback: boolean
  lastError?: string | null
}

type ConfluenceSearchScope = {
  spaceKey?: string | null
  spaceKeys?: string[]
  parentPageId?: string | null
  baseCql?: string | null
  limit?: number | null
}

type ConfluenceSearchResponse = {
  data: {
    results?: Array<{
      id: string
      title: string
      body?: { view?: { value?: string } }
      _links?: { webui?: string; tinyui?: string; self?: string }
    }>
  }
}

/**
 * Generate search terms from query using simple keyword extraction
 */
function generateSearchTerms(query: string): string[] {
  // Remove common words and split into terms
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  ])

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2 && !commonWords.has(word))
    .slice(0, 5)

  return terms.length > 0 ? terms : [query.toLowerCase()]
}

/**
 * Search historical Jira tickets using keyword search
 */
export async function searchJiraTickets(
  query: string,
  credentials?: JiraCredentials
): Promise<SearchResult[]> {
  try {
    const searchTerms = generateSearchTerms(query)

    // Search Jira using API
    const baseUrl = credentials?.baseUrl || process.env.JIRA_BASE_URL
    const user = credentials?.user || process.env.JIRA_USER
    const token = credentials?.token || process.env.JIRA_API_TOKEN
    const authType = credentials?.authType || 'basic'
    const deployment = credentials?.deployment || 'cloud'
    const apiVersion = deployment === 'datacenter' ? '2' : '3'

    if (!baseUrl || !token || (authType === 'basic' && !user)) {
      throw new Error('Jira credentials not configured')
    }

    const results: SearchResult[] = []

    for (const term of searchTerms.slice(0, 3)) {
      try {
        const jiraResponse = await axios.get(
          `${baseUrl}/rest/api/${apiVersion}/search`,
          {
            params: {
              jql: `text ~ "${term}" AND type = "Bug,Story,Task"`,
              maxResults: 5,
              fields: 'key,summary,description,status',
            },
            auth:
              authType === 'basic'
                ? {
                    username: user as string,
                    password: token,
                  }
                : undefined,
            headers:
              authType === 'oauth' || authType === 'bearer'
                ? {
                    Authorization: `Bearer ${token}`,
                  }
                : undefined,
          }
        )

        for (const issue of jiraResponse.data.issues || []) {
          results.push({
            id: issue.key,
            title: issue.fields.summary,
            type: 'jira_ticket',
            url: `${baseUrl}/browse/${issue.key}`,
            relevanceScore: calculateRelevance(issue.fields.summary, query),
            summary: issue.fields.description || issue.fields.summary,
          })
        }
      } catch (error) {
        console.error(`Error searching Jira for term "${term}":`, error)
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = Array.from(
      new Map(results.map((r) => [r.id, r])).values()
    )
    return uniqueResults.sort((a, b) => b.relevanceScore - a.relevanceScore)
  } catch (error) {
    console.error('Error in semantic Jira search:', error)
    throw new Error('Failed to search Jira tickets')
  }
}

function escapeCql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Search Confluence pages using keyword search
 */
export async function searchConfluencePages(
  query: string,
  credentials?: ConfluenceCredentials,
  scope?: ConfluenceSearchScope
): Promise<SearchResult[]> {
  try {
    const rawQuery = query.trim()
    const extractedTerms = generateSearchTerms(rawQuery)
    const searchTerms = [rawQuery, ...extractedTerms].filter((term, index, array) =>
      term && array.indexOf(term) === index
    )

    // Search Confluence using API
    const confluenceUrl = normalizeConfluenceBaseUrl(
      credentials?.baseUrl || process.env.CONFLUENCE_BASE_URL
    )
    const user = credentials?.user || process.env.CONFLUENCE_USER
    const token = credentials?.token || process.env.CONFLUENCE_API_TOKEN
    const authType = credentials?.authType || 'basic'

    if (!confluenceUrl || !token || (authType === 'basic' && !user)) {
      throw new Error('Confluence credentials not configured')
    }

    const results: SearchResult[] = []
    const baseCandidates = new Set<string>()
    const trimmedBase = confluenceUrl.replace(/\/+$/, '')
    baseCandidates.add(trimmedBase)
    try {
      const parsedBase = new URL(trimmedBase)
      const basePath = parsedBase.pathname.toLowerCase()
      if (!basePath || basePath === '/') {
        baseCandidates.add(`${parsedBase.origin}/confluence`)
        baseCandidates.add(`${parsedBase.origin}/wiki`)
      }
    } catch {
      // Keep only the trimmed base for invalid URLs.
    }

    const normalizedSpaceKey = scope?.spaceKey?.trim()
    const normalizedSpaceKeys =
      scope?.spaceKeys?.map((key) => key.trim()).filter(Boolean) ?? []
    const normalizedParentId = scope?.parentPageId?.trim()
    const hasNumericParentId = normalizedParentId && /^\d+$/.test(normalizedParentId)
    const scopeClauses: string[] = []
    if (normalizedSpaceKeys.length > 0) {
      scopeClauses.push(
        `space in (${normalizedSpaceKeys.map((key) => `"${escapeCql(key)}"`).join(',')})`
      )
    } else if (normalizedSpaceKey) {
      scopeClauses.push(`space = "${escapeCql(normalizedSpaceKey)}"`)
    }
    if (hasNumericParentId) {
      scopeClauses.push(`ancestor = ${normalizedParentId}`)
    }

    const runSearch = async (scopeFilter: string) => {
      let hadSuccessfulResponse = false
      let lastError: string | null = null
      const resultLimit = Math.min(Math.max(scope?.limit ?? 10, 1), 25)
      const baseFilter = scope?.baseCql?.trim()
      const filterParts = []
      if (baseFilter) {
        filterParts.push(`(${baseFilter})`)
      } else {
        filterParts.push('type = page')
      }
      if (scopeFilter) {
        filterParts.push(scopeFilter)
      }
      const filterCql = filterParts.join(' AND ')
      const buildCql = (keyword: string) => {
        const safe = escapeCql(keyword)
        const useWildcard = safe.length < 3
        const term = useWildcard ? `${safe}*` : safe
        return `${filterCql} AND (siteSearch ~ "${term}" OR text ~ "${term}" OR title ~ "${term}")`
      }

      for (const keyword of searchTerms) {
        try {
          let confluenceResponse: ConfluenceSearchResponse | null = null

          for (const baseUrl of baseCandidates) {
            try {
              confluenceResponse = await axios.get(
                `${baseUrl}/rest/api/content/search`,
                {
                  params: {
                    cql: buildCql(keyword),
                    expand: 'body.view',
                    limit: resultLimit,
                  },
                  auth:
                    authType === 'basic'
                      ? {
                          username: user as string,
                          password: token,
                        }
                      : undefined,
                  headers:
                    authType === 'bearer'
                      ? {
                          Authorization: `Bearer ${token}`,
                        }
                      : undefined,
                  timeout: credentials?.requestTimeout || 30000,
                }
              )
              hadSuccessfulResponse = true
              if ((confluenceResponse?.data?.results || []).length > 0) {
                break
              }
            } catch (error) {
              if (axios.isAxiosError(error)) {
                const status = error.response?.status
                lastError =
                  status && status >= 400
                    ? `Confluence search failed (${status}). Check base URL or permissions.`
                    : error.message
              } else if (error instanceof Error) {
                lastError = error.message
              }
              confluenceResponse = null
              continue
            }
          }

          if (!confluenceResponse) {
            continue
          }

          for (const page of confluenceResponse.data.results || []) {
            const baseUrl = (confluenceUrl || '').replace(/\/+$/, '')
            const webUrl = page._links?.webui
              ? `${baseUrl}${page._links.webui}`
              : page._links?.tinyui
              ? `${baseUrl}${page._links.tinyui}`
              : page._links?.self || ''

            results.push({
              id: page.id,
              title: page.title,
              type: 'confluence_page',
              url: webUrl,
              relevanceScore: calculateRelevance(page.title, query),
              summary: extractPageSummary(page.body?.view?.value || ''),
            })
          }
        } catch (error) {
          console.error(`Error searching Confluence for keyword "${keyword}":`, error)
        }
      }
      return { hadSuccessfulResponse, lastError }
    }

    const scopeFilter = scopeClauses.length > 0 ? scopeClauses.join(' AND ') : ''
    const scopedStatus = await runSearch(scopeFilter)
    let status = scopedStatus

    if (results.length === 0 && scopeFilter) {
      const fallbackStatus = await runSearch('')
      status = {
        hadSuccessfulResponse:
          scopedStatus.hadSuccessfulResponse || fallbackStatus.hadSuccessfulResponse,
        lastError: fallbackStatus.lastError || scopedStatus.lastError,
      }
    }

    const uniqueResults = Array.from(new Map(results.map((r) => [r.id, r])).values())
    if (!status.hadSuccessfulResponse && status.lastError) {
      throw new Error(status.lastError)
    }

    if (uniqueResults.length === 0 && status.hadSuccessfulResponse) {
      console.warn('[Confluence Search] No results', {
        query,
        spaceKey: normalizedSpaceKey || null,
        spaceKeys: normalizedSpaceKeys,
        parentPageId: hasNumericParentId ? normalizedParentId : null,
        baseCandidates: Array.from(baseCandidates),
      })
    }

    return uniqueResults.sort((a, b) => b.relevanceScore - a.relevanceScore)
  } catch (error) {
    console.error('Error in semantic Confluence search:', error)
    throw new Error('Failed to search Confluence pages')
  }
}

/**
 * Extract key concepts from title and content for related content analysis
 */
export async function analyzeContentForRelated(
  title: string,
  content: string
): Promise<string[]> {
  try {
    // Extract key concepts using simple keyword extraction
    const allText = `${title} ${content}`.toLowerCase()
    const words = allText.split(/\s+/)
    
    // Count word frequencies and return top concepts
    const wordFreq = new Map<string, number>()
    
    for (const word of words) {
      if (word.length > 4) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
      }
    }
    
    const concepts = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word)

    return concepts.length > 0 ? concepts : ['general', 'feature', 'bug']
  } catch (error) {
    console.error('Error analyzing content:', error)
    return []
  }
}

/**
 * Calculate semantic relevance score (0-1)
 * Simple implementation - can be enhanced with ML
 */
function calculateRelevance(title: string, query: string): number {
  const titleLower = title.toLowerCase()
  const queryLower = query.toLowerCase()

  // Exact match
  if (titleLower.includes(queryLower)) return 1.0

  // Check word overlap
  const queryWords = queryLower.split(/\s+/)
  const matchedWords = queryWords.filter((word) => titleLower.includes(word))
  const score = matchedWords.length / queryWords.length

  return Math.min(score, 0.95)
}

/**
 * Extract summary from Confluence page body
 */
function extractPageSummary(html: string): string {
  // Remove HTML tags and get first 200 chars
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')

  return text.substring(0, 200) + (text.length > 200 ? '...' : '')
}
