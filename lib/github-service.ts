import axios from 'axios'

const DEFAULT_GITHUB_API_URL = 'https://api.github.com'

export interface GitHubPR {
  number: number
  title: string
  body: string
  url: string
  author: string
  createdAt: string
  updatedAt: string
  commits: number
  additions: number
  deletions: number
  files: string[]
  diff: string
}

export interface PullRequestDiff {
  filename: string
  patch: string
  additions: number
  deletions: number
}

/**
 * Fetch pull request details from GitHub
 */
export const normalizeGithubApiUrl = (baseUrl?: string | null) => {
  if (!baseUrl) return null
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  if (/\/api\/v3$/i.test(trimmed)) return trimmed
  return `${trimmed}/api/v3`
}

export const resolveGithubApiUrl = (baseUrl?: string | null, prUrl?: string | null) => {
  const normalized = normalizeGithubApiUrl(baseUrl)
  if (normalized) return normalized
  if (prUrl) {
    try {
      const parsed = new URL(prUrl)
      if (parsed.hostname && parsed.hostname.toLowerCase() !== 'github.com') {
        return normalizeGithubApiUrl(`${parsed.protocol}//${parsed.host}`)
      }
    } catch {
      // ignore
    }
  }
  return DEFAULT_GITHUB_API_URL
}

export async function getPullRequest(
  owner: string,
  repo: string,
  prNumber: number,
  tokenOverride?: string | null,
  baseUrlOverride?: string | null
): Promise<GitHubPR | null> {
  try {
    const token = tokenOverride || process.env.GITHUB_TOKEN

    if (!token) {
      throw new Error('GitHub token not configured')
    }
    const apiBaseUrl = resolveGithubApiUrl(baseUrlOverride, null)

    // Fetch PR details
    const prResponse = await axios.get(
      `${apiBaseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    const pr = prResponse.data

    // Fetch PR files and diff
    const filesResponse = await axios.get(
      `${apiBaseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: { per_page: 100 },
      }
    )

    // Construct full diff
    const diff = filesResponse.data
      .map((file: PullRequestDiff) => file.patch || '')
      .join('\n---FILE_SEPARATOR---\n')

    return {
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      url: pr.html_url,
      author: pr.user.login,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      commits: pr.commits,
      additions: pr.additions,
      deletions: pr.deletions,
      files: filesResponse.data.map((f: PullRequestDiff) => f.filename),
      diff,
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      if (status === 401 || status === 403 || status === 404) {
        console.warn('[GitHub] PR not accessible with current token:', {
          owner,
          repo,
          prNumber,
          status,
        })
        return null
      }
    }
    console.error('[GitHub] Error fetching PR:', error)
    throw new Error('Failed to fetch pull request')
  }
}

export function extractPullRequestUrls(text?: string | null): string[] {
  if (!text) return []
  const urls: string[] = []
  const regex = /https?:\/\/[^\s)]+/gi
  const matches = text.match(regex) || []
  for (const raw of matches) {
    const cleaned = raw.replace(/[),.;]+$/, '')
    if (/\/pull\/\d+/i.test(cleaned)) {
      urls.push(cleaned)
    }
  }
  return Array.from(new Set(urls))
}

export function parsePullRequestUrl(url: string): { owner: string; repo: string; number: number } | null {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    const pullIndex = parts.findIndex((part) => part.toLowerCase() === 'pull')
    if (pullIndex === -1 || pullIndex + 1 >= parts.length) return null
    const owner = parts[0]
    const repo = parts[1]
    const number = Number.parseInt(parts[pullIndex + 1], 10)
    if (!owner || !repo || !Number.isFinite(number)) return null
    return { owner, repo, number }
  } catch {
    return null
  }
}

export async function getPullRequestFromUrl(
  url: string,
  tokenOverride?: string | null,
  baseUrlOverride?: string | null
): Promise<GitHubPR | null> {
  const parsed = parsePullRequestUrl(url)
  if (!parsed) return null
  try {
    return await getPullRequest(
      parsed.owner,
      parsed.repo,
      parsed.number,
      tokenOverride,
      baseUrlOverride || url
    )
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      if (status === 401 || status === 403 || status === 404) {
        console.warn('[GitHub] PR not accessible with current token:', url)
        return null
      }
    }
    console.error('[GitHub] Error fetching PR from URL:', error)
    return null
  }
}

/**
 * Parse PR description for developer notes
 */
export async function extractDeveloperNotes(prBody: string): Promise<string> {
  try {
    // Extract common sections from PR body
    const sections = ['## Changes', '## Impact', '## Testing', '## Notes']
    let notes = ''

    for (const section of sections) {
      const match = prBody.match(
        new RegExp(`${section}[\\s\\S]*?(?=##|$)`, 'i')
      )
      if (match) {
        notes += match[0] + '\n\n'
      }
    }

    return notes.trim() || prBody.substring(0, 500)
  } catch (error) {
    console.error('[GitHub] Error extracting notes:', error)
    return prBody
  }
}

/**
 * Analyze PR diff for impacted areas
 */
export async function analyzeImpactAreas(diff: string): Promise<string[]> {
  try {
    const impactAreas: Set<string> = new Set()

    // Pattern matching for common areas
    const patterns: Record<string, RegExp> = {
      'Database Schema': /ALTER TABLE|CREATE TABLE|migration/i,
      'API Endpoints': /\/api\/|router\.|@app\.post|@app\.get/i,
      Authentication: /auth|JWT|token|session|login/i,
      'UI Components': /\.tsx|\.jsx|component|React\.FC/i,
      'Error Handling': /try\s*{|catch|throw|error/i,
      'Performance': /optimize|cache|index|query\s*performance/i,
      'Testing': /test|spec|jest|mock|assert/i,
      'Documentation': /README|CHANGELOG|\.md|comment|doc/i,
      'Dependencies': /package\.json|import|require/i,
      'Configuration': /\.env|config|setting|constant/i,
    }

    for (const [area, pattern] of Object.entries(patterns)) {
      if (pattern.test(diff)) {
        impactAreas.add(area)
      }
    }

    return Array.from(impactAreas)
  } catch (error) {
    console.error('[GitHub] Error analyzing impact areas:', error)
    return []
  }
}

/**
 * Get PR commit messages
 */
export async function getPRCommitMessages(
  owner: string,
  repo: string,
  prNumber: number
): Promise<string[]> {
  try {
    const token = process.env.GITHUB_TOKEN

    if (!token) {
      throw new Error('GitHub token not configured')
    }

    const response = await axios.get(
      `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls/${prNumber}/commits`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: { per_page: 50 },
      }
    )

    type GitHubCommit = { commit?: { message?: string } }
    return response.data.map((commit: GitHubCommit) => commit.commit?.message || '')
  } catch (error) {
    console.error('[GitHub] Error fetching commits:', error)
    return []
  }
}

/**
 * Get files changed by a PR grouped by directory
 */
export async function getChangedFilesByDirectory(
  owner: string,
  repo: string,
  prNumber: number
): Promise<Record<string, string[]>> {
  try {
    const token = process.env.GITHUB_TOKEN

    if (!token) {
      throw new Error('GitHub token not configured')
    }

    const response = await axios.get(
      `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: { per_page: 100 },
      }
    )

    const filesByDir: Record<string, string[]> = {}

    for (const file of response.data) {
      const path = file.filename
      const dir = path.substring(0, path.lastIndexOf('/')) || 'root'
      const filename = path.substring(path.lastIndexOf('/') + 1)

      if (!filesByDir[dir]) {
        filesByDir[dir] = []
      }
      filesByDir[dir].push(filename)
    }

    return filesByDir
  } catch (error) {
    console.error('[GitHub] Error analyzing file structure:', error)
    return {}
  }
}
