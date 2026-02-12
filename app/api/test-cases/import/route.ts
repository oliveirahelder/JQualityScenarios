import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'
import { fetchJiraTicket } from '@/lib/jira-service'

type ParsedScenario = {
  title: string
  steps: string
  expected: string
  notes?: string
}

const MAX_ISSUES = 300

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .trim()

const formatJqlField = (field: string) =>
  field.includes(' ') ? `"${field.replace(/\"/g, '\\"')}"` : field

const splitTableRow = (row: string) =>
  row
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())

const parseScenariosFromHeadings = (text: string): ParsedScenario[] => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const scenarios: ParsedScenario[] = []
  let current: ParsedScenario | null = null
  let mode: 'steps' | 'expected' | 'notes' | null = null

  const pushCurrent = () => {
    if (!current) return
    const hasContent = current.title || current.steps || current.expected || current.notes
    if (hasContent) {
      scenarios.push(current)
    }
    current = null
    mode = null
  }

  const startScenario = (title: string) => {
    pushCurrent()
    current = {
      title: title.trim() || 'Scenario',
      steps: '',
      expected: '',
    }
    mode = null
  }

  for (const line of lines) {
    const scenarioMatch = line.match(
      /^(FT-\d+|Scenario|Test Scenario|Cen[aá]rio)\s*[:\-]?\s*(.*)$/i
    )
    if (scenarioMatch) {
      const title = scenarioMatch[2] || scenarioMatch[1]
      startScenario(title)
      continue
    }

    const stepsMatch = line.match(/^(Steps?|Execution Steps?)\s*[:\-]?\s*(.*)$/i)
    if (stepsMatch) {
      if (!current) startScenario('Scenario')
      mode = 'steps'
      const value = stepsMatch[2]?.trim()
      if (value) {
        current!.steps = [current!.steps, value].filter(Boolean).join('\n')
      }
      continue
    }

    const expectedMatch = line.match(
      /^(Expected Result|Expected|Resultado esperado)\s*[:\-]?\s*(.*)$/i
    )
    if (expectedMatch) {
      if (!current) startScenario('Scenario')
      mode = 'expected'
      const value = expectedMatch[2]?.trim()
      if (value) {
        current!.expected = [current!.expected, value].filter(Boolean).join(' ')
      }
      continue
    }

    const notesMatch = line.match(/^(Notes?|Observa[cç][oõ]es?|Obs)\s*[:\-]?\s*(.*)$/i)
    if (notesMatch) {
      if (!current) startScenario('Scenario')
      mode = 'notes'
      const value = notesMatch[2]?.trim()
      if (value) {
        current!.notes = [current!.notes, value].filter(Boolean).join(' ')
      }
      continue
    }

    const bulletMatch = line.match(/^(\d+\.\s+|-+\s+)(.*)$/)
    if (bulletMatch && current) {
      const value = bulletMatch[2]?.trim()
      if (value) {
        current.steps = [current.steps, value].filter(Boolean).join('\n')
      }
      continue
    }

    if (current) {
      if (line.startsWith('(!)') || line.startsWith('(x)')) {
        current.notes = [current.notes, line.replace(/^\((!|x)\)\s*/, '')]
          .filter(Boolean)
          .join(' ')
        continue
      }
      if (mode === 'expected') {
        current.expected = [current.expected, line].filter(Boolean).join(' ')
        continue
      }
      if (mode === 'notes') {
        current.notes = [current.notes, line].filter(Boolean).join(' ')
        continue
      }
      if (mode === 'steps') {
        current.steps = [current.steps, line].filter(Boolean).join('\n')
        continue
      }
    }
  }

  pushCurrent()
  return scenarios
}

const parseScenariosFromTable = (text: string): ParsedScenario[] => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const scenarios: ParsedScenario[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.startsWith('||')) continue

    const headerCells = line
      .split('||')
      .map((cell) => cell.trim())
      .filter(Boolean)
    if (headerCells.length < 3) continue

    const headerMap = headerCells.map(normalizeHeader)
    const headerIndex: Record<string, number> = {}
    headerMap.forEach((header, idx) => {
      headerIndex[header] = idx
    })

    i += 1
    for (; i < lines.length; i += 1) {
      const row = lines[i]
      if (!row.startsWith('|') || row.startsWith('||')) {
        i -= 1
        break
      }
      const cells = splitTableRow(row)
      if (cells.length < 3) continue

      const title =
        cells[headerIndex.testscenario ?? headerIndex.scenario ?? headerIndex.testcase ?? 1] ||
        cells[1] ||
        'Scenario'
      const steps =
        cells[headerIndex.executionsteps ?? headerIndex.steps ?? headerIndex.execution ?? 2] ||
        cells[2] ||
        ''
      const expected =
        cells[headerIndex.expectedresult ?? headerIndex.expected ?? 3] ||
        cells[3] ||
        ''
      const notes =
        cells[headerIndex.notes ?? headerIndex.note ?? headerIndex.comments ?? 5] ||
        undefined

      if (!title && !steps && !expected) continue
      scenarios.push({
        title,
        steps,
        expected,
        notes,
      })
    }
  }

  if (scenarios.length > 0) return scenarios

  const fallbackRows = lines.filter((row) => row.startsWith('|') && row.endsWith('|'))
  for (const row of fallbackRows) {
    const cells = splitTableRow(row)
    if (cells.length < 3) continue
    scenarios.push({
      title: cells[1] || cells[0] || 'Scenario',
      steps: cells[2] || '',
      expected: cells[3] || '',
      notes: cells[4] || undefined,
    })
  }

  return scenarios
}

const parseScenariosFromContent = (text: string): ParsedScenario[] => {
  const tableScenarios = parseScenariosFromTable(text)
  if (tableScenarios.length > 0) return tableScenarios
  return parseScenariosFromHeadings(text)
}

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
