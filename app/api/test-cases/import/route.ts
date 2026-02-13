import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'
import { fetchJiraTicket } from '@/lib/jira-service'
import { parseScenariosFromContent } from '@/lib/test-case-parser'

const MAX_ISSUES = 300

const formatJqlField = (field: string) =>
  field.includes(' ') ? `"${field.replace(/\"/g, '\\"')}"` : field

const normalizeSteps = (raw: string) =>
  raw
    .split(/\r?\n+/)
    .map((step) => step.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
    .join('\n')

const searchIssuesByJql = async (
  baseUrl: string,
  apiVersion: string,
  authType: 'basic' | 'oauth' | 'bearer',
  token: string,
  user: string | undefined,
  jql: string
) => {
  const issues: Array<{ key: string; fields?: { summary?: string } }> = []
  let startAt = 0
  let total = 0

  do {
    const pageSize = Math.min(100, MAX_ISSUES - issues.length)
    if (pageSize <= 0) break
    const response = await axios.get(`${baseUrl}/rest/api/${apiVersion}/search`, {
      params: {
        jql,
        startAt,
        maxResults: pageSize,
        fields: 'summary',
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
          ? { Authorization: `Bearer ${token}` }
          : undefined,
    })
    const fetched = response.data?.issues || []
    issues.push(...fetched)
    total = response.data?.total ?? issues.length
    startAt += fetched.length
    if (fetched.length === 0) break
  } while (issues.length < total && issues.length < MAX_ISSUES)

  return issues
}

export const POST = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const body = await req.json()
    const teamKey = body.teamKey?.trim()
    const projectKey = body.projectKey?.trim() || 'JMIA'
    if (!teamKey) {
      return NextResponse.json({ error: 'teamKey is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const adminSettings = await prisma.adminSettings.findFirst()
    const credentials = buildJiraCredentialsFromUser(user, adminSettings?.jiraBaseUrl || null)
    if (!credentials) {
      return NextResponse.json({ error: 'Jira integration not configured' }, { status: 400 })
    }

    const apiVersion = credentials.deployment === 'datacenter' ? '2' : '3'
    const issueKeySet = new Set<string>()

    const rawApplicationValues = Array.isArray(body.applicationValues)
      ? body.applicationValues
      : typeof body.applicationValues === 'string'
        ? body.applicationValues.split(',')
        : []
    const rawComponents = Array.isArray(body.components)
      ? body.components
      : typeof body.components === 'string'
        ? body.components.split(',')
        : []
    const applicationValues = rawApplicationValues.map((value: string) => value.trim()).filter(Boolean)
    const components = rawComponents.map((value: string) => value.trim()).filter(Boolean)

    if (components.length === 0) {
      return NextResponse.json(
        { error: 'Component is required for this import.' },
        { status: 400 }
      )
    }

    const fieldName =
      typeof body.applicationField === 'string' && body.applicationField.trim()
        ? body.applicationField.trim()
        : adminSettings?.jiraApplicationField?.trim() || 'Application'

    const clauses: string[] = []
    if (applicationValues.length > 0) {
      const field = formatJqlField(fieldName)
      const list = applicationValues.map((value: string) => `"${value.replace(/\"/g, '\\"')}"`).join(', ')
      clauses.push(`${field} in (${list})`)
    }
    if (components.length > 0) {
      const list = components.map((value: string) => `"${value.replace(/\"/g, '\\"')}"`).join(', ')
      clauses.push(`component in (${list})`)
    }

    const mode = body.mode === 'OR' ? 'OR' : 'AND'
    const filterClause =
      clauses.length > 1 ? `(${clauses.join(` ${mode} `)})` : clauses[0]
    const extraClauses: string[] = ['component is not EMPTY']
    if (typeof body.keyword === 'string' && body.keyword.trim()) {
      const keyword = body.keyword.trim().replace(/\"/g, '\\"')
      extraClauses.push(`text ~ "${keyword}"`)
    }
    extraClauses.push('status in ("Done","Closed")')
    const fullClause = [filterClause, ...extraClauses].join(' AND ')
    const jql = `project = ${projectKey} AND ${fullClause}`

    const issues = await searchIssuesByJql(
      credentials.baseUrl,
      apiVersion,
      credentials.authType,
      credentials.token,
      credentials.user,
      jql
    )
    issues.forEach((issue) => issue?.key && issueKeySet.add(issue.key))

    const issueKeys = Array.from(issueKeySet)

    let imported = 0
    let updated = 0
    let skipped = 0
    let skippedNoContent = 0
    let scenariosFound = 0
    let scenariosMissing = 0

    for (const issueKey of issueKeys) {
      const details = await fetchJiraTicket(issueKey, credentials, {
        applicationField: fieldName,
      })

      const commentsText = details.comments?.trim() || ''
      const descriptionText = details.description?.trim() || ''
      if (!commentsText && !descriptionText) {
        skippedNoContent += 1
        skipped += 1
        continue
      }

      let scenarios = parseScenariosFromContent(commentsText)
      if (scenarios.length === 0 && descriptionText) {
        scenarios = parseScenariosFromContent(descriptionText)
      }
      if (scenarios.length > 0) {
        scenariosFound += 1
      } else {
        scenariosMissing += 1
      }

      const existingSource = await prisma.testCaseSourceTicket.findUnique({
        where: { jiraId: issueKey },
        select: { id: true },
      })

      await prisma.testCaseSourceTicket.upsert({
        where: { jiraId: issueKey },
        update: {
          teamKey,
          summary: details.summary || issueKey,
          description: descriptionText || null,
          comments: commentsText || null,
          status: details.status || null,
          components: details.components?.join(', ') || null,
          application: Array.isArray(details.application)
            ? details.application.join(', ')
            : details.application || null,
          scenarioCount: scenarios.length,
        },
        create: {
          teamKey,
          jiraId: issueKey,
          summary: details.summary || issueKey,
          description: descriptionText || null,
          comments: commentsText || null,
          status: details.status || null,
          components: details.components?.join(', ') || null,
          application: Array.isArray(details.application)
            ? details.application.join(', ')
            : details.application || null,
          scenarioCount: scenarios.length,
        },
      })

      if (existingSource) {
        updated += 1
      } else {
        imported += 1
      }
    }

    return NextResponse.json({
      imported,
      updated,
      skipped,
      totalTickets: issueKeys.length,
      scenarioSummary: {
        withScenarios: scenariosFound,
        withoutScenarios: scenariosMissing,
      },
      skippedReasons: {
        noContent: skippedNoContent,
      },
      message: 'Import completed.',
    })
  } catch (error) {
    console.error('Error importing test cases:', error)
    return NextResponse.json({ error: 'Failed to import test cases' }, { status: 500 })
  }
})
