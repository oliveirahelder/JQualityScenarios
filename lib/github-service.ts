import axios from 'axios'

const GITHUB_API_URL = 'https://api.github.com'

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
export async function getPullRequest(
  owner: string,
  repo: string,
  prNumber: number
): Promise<GitHubPR> {
  try {
    const token = process.env.GITHUB_TOKEN

    if (!token) {
      throw new Error('GitHub token not configured')
    }

    // Fetch PR details
    const prResponse = await axios.get(
      `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls/${prNumber}`,
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
      `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls/${prNumber}/files`,
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
    console.error('[GitHub] Error fetching PR:', error)
    throw new Error('Failed to fetch pull request')
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

    return response.data.map((commit: any) => commit.commit.message)
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
