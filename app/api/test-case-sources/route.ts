import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { withAuth, withRole } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'
import { extractAdfText } from '@/lib/jira-service'
import { parseScenariosFromContent, extractAcceptanceCriteria } from '@/lib/test-case-parser'
import pdfParse from 'pdf-parse'

const MAX_LIMIT = 500
const JIRA_PROJECT_KEY = 'JMIA'
const JIRA_PAGE_SIZE = 100
const ATTACHMENT_LIMIT = 5
const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const { searchParams } = new URL(req.url)
    const filtersOnly = searchParams.get('filters') === '1'
    const summaryOnly = searchParams.get('summary') === '1'
    const teamKey = searchParams.get('teamKey')?.trim() || undefined
    const query = searchParams.get('q')?.trim()
    const component = searchParams.get('component')?.trim()
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')
    const limit = Math.min(
      Math.max(limitParam ? Number.parseInt(limitParam, 10) : 50, 1),
      MAX_LIMIT
    )
    const offset = Math.max(offsetParam ? Number.parseInt(offsetParam, 10) : 0, 0)

    if (filtersOnly) {
      const teamWhere = teamKey ? { teamKey } : undefined
      const teamRows = await prisma.testCaseSourceTicket.findMany({
        select: { teamKey: true },
        distinct: ['teamKey'],
        orderBy: { teamKey: 'asc' },
      })
      const componentRows = await prisma.testCaseSourceTicket.findMany({
        where: teamWhere,
        select: { components: true },
      })
      const componentSet = new Set<string>()
      for (const row of componentRows) {
        if (!row.components) continue
        row.components
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
          .forEach((entry) => componentSet.add(entry))
      }
      return NextResponse.json({
        teams: teamRows.map((row) => row.teamKey),
        components: Array.from(componentSet).sort((a, b) => a.localeCompare(b)),
      })
    }

    if (summaryOnly) {
      const grouped = await prisma.testCaseSourceTicket.groupBy({
        by: ['teamKey'],
        _count: { _all: true },
      })
      const teamCounts = grouped
        .map((entry) => ({
          teamKey: entry.teamKey,
          count: entry._count._all,
        }))
        .sort((a, b) => a.teamKey.localeCompare(b.teamKey))

      const missingComponentCount = await prisma.testCaseSourceTicket.count({
        where: {
          OR: [{ components: null }, { components: '' }],
        },
      })

      const missingTeamCount = await prisma.testCaseSourceTicket.count({
        where: {
          AND: [
            { OR: [{ components: null }, { components: '' }] },
            { OR: [{ application: null }, { application: '' }] },
          ],
        },
      })

      const adminSettings = await prisma.adminSettings.findFirst()
      const baseUrl = adminSettings?.jiraBaseUrl?.trim() || ''
      const applicationField = adminSettings?.jiraApplicationField?.trim()
      const jqlParts = [`project = ${JIRA_PROJECT_KEY}`, 'component is EMPTY']
      if (applicationField) {
        jqlParts.push(`"${applicationField}" is EMPTY`)
      }
      const missingJql = jqlParts.join(' AND ')
      const missingUrl = baseUrl
        ? `${baseUrl.replace(/\/+$/, '')}/issues/?jql=${encodeURIComponent(missingJql)}`
        : null

      return NextResponse.json({
        teamCounts,
        missingComponentCount,
        missingTeamCount,
        missingJql,
        missingUrl,
      })
    }

    const where: Record<string, any> = {}
    if (teamKey) {
      where.teamKey = teamKey
    }
    if (component) {
      where.components = { contains: component }
    }
    if (query) {
      where.OR = [
        { summary: { contains: query } },
        { description: { contains: query } },
        { comments: { contains: query } },
        { acceptanceCriteria: { contains: query } },
        { components: { contains: query } },
        { application: { contains: query } },
        { attachmentsText: { contains: query } },
      ]
    }

    const total = await prisma.testCaseSourceTicket.count({ where })
    const tickets = await prisma.testCaseSourceTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    })

    const lastSyncLog = await prisma.jiraTicketSyncLog.findFirst({
      orderBy: { finishedAt: 'desc' },
    })

    return NextResponse.json({
      tickets,
      total,
      lastSync: lastSyncLog
        ? {
            status: lastSyncLog.status,
            processedCount: lastSyncLog.processedCount,
            insertedCount: lastSyncLog.insertedCount,
            updatedCount: lastSyncLog.updatedCount,
            teamCount: lastSyncLog.teamCount,
            teamKeys: lastSyncLog.teamKeys,
            finishedAt: lastSyncLog.finishedAt,
            error: lastSyncLog.error,
          }
        : null,
    })
  } catch (error) {
    console.error('Error fetching test case source tickets:', error)
    return NextResponse.json({ error: 'Failed to load QA history tickets' }, { status: 500 })
  }
})

type JiraIssue = {
  key?: string
  fields?: {
    summary?: string
    description?: any
    status?: { name?: string }
    comment?: { comments?: Array<{ body?: any }> }
    components?: Array<{ name?: string }>
    attachment?: Array<{
      filename?: string
      mimeType?: string
      size?: number
      content?: string
    }>
    [key: string]: any
  }
}

const normalizeCustomValue = (value: any): string | string[] | null => {
  if (!value) return null
  if (Array.isArray(value)) {
    const values = value
      .map((entry) => entry?.value ?? entry?.name ?? entry?.id ?? entry)
      .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry)))
      .filter(Boolean)
    return values.length > 0 ? values : null
  }
  if (typeof value === 'object') {
    const extracted = value.value ?? value.name ?? value.id
    return extracted ? String(extracted) : null
  }
  return String(value)
}

const resolveTeamKey = (application: string | string[] | null, components: string[]) => {
  const pick = Array.isArray(application) ? application.find(Boolean) : application
  if (pick) return pick.toString().trim().toUpperCase()
  if (components.length > 0) return components[0].trim().toUpperCase()
  return 'JMIA'
}

const extractAttachmentText = async (
  attachments: Array<{
    filename?: string
    mimeType?: string
    size?: number
    content?: string
  }>,
  client: ReturnType<typeof axios.create>,
  auth: { username: string; password: string } | undefined,
  headers: Record<string, string> | undefined
) => {
  const pdfAttachments = attachments
    .filter((attachment) => attachment?.content)
    .filter((attachment) => {
      const mime = (attachment.mimeType || '').toLowerCase()
      const filename = (attachment.filename || '').toLowerCase()
      return mime === 'application/pdf' || filename.endsWith('.pdf')
    })
    .filter((attachment) => (attachment.size ?? 0) <= ATTACHMENT_MAX_BYTES)
    .slice(0, ATTACHMENT_LIMIT)

  const texts: string[] = []
  for (const attachment of pdfAttachments) {
    if (!attachment.content) continue
    try {
      const response = await client.get(attachment.content, {
        responseType: 'arraybuffer',
        auth,
        headers,
      })
      const buffer = Buffer.from(response.data)
      const parsed = await pdfParse(buffer)
      const text = parsed.text?.trim()
      if (text) {
        texts.push(`Attachment ${attachment.filename || 'PDF'}:\n${text}`)
      }
    } catch (error) {
      console.warn('[TestCase Sync] Failed to parse attachment:', attachment.filename, error)
    }
  }

  return texts.length > 0 ? texts.join('\n\n') : null
}

export const POST = withAuth(
  withRole('QA', 'ADMIN')(async (req: NextRequest & { user?: any }) => {
    const startedAt = new Date()
    let processed = 0
    let inserted = 0
    let updated = 0
    const teamKeys = new Set<string>()
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user?.userId },
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const adminSettings = await prisma.adminSettings.findFirst()
      const credentials = buildJiraCredentialsFromUser(user, adminSettings?.jiraBaseUrl || null)
      if (!credentials) {
        return NextResponse.json(
          { error: 'Jira integration not configured' },
          { status: 400 }
        )
      }

      const apiVersion = credentials.deployment === 'datacenter' ? '2' : '3'
      const timeout =
        credentials.requestTimeout ?? Number.parseInt(process.env.JIRA_REQUEST_TIMEOUT || '30000', 10)
      const client = axios.create({ timeout })

      const auth =
        credentials.authType === 'basic'
          ? { username: credentials.user as string, password: credentials.token }
          : undefined
      const headers =
        credentials.authType === 'oauth' || credentials.authType === 'bearer'
          ? { Authorization: `Bearer ${credentials.token}` }
          : undefined

      let applicationField =
        adminSettings?.jiraApplicationField?.trim() || 'customfield_16521'

      const existingIds = new Set(
        (
          await prisma.testCaseSourceTicket.findMany({
            select: { jiraId: true },
          })
        ).map((item) => item.jiraId)
      )

      let startAt = 0
      let total = 0

      do {
        const baseFields = ['summary', 'description', 'status', 'comment', 'components']
        const fields = applicationField ? [...baseFields, applicationField] : baseFields
        let response
        try {
          response = await client.get(
            `${credentials.baseUrl}/rest/api/${apiVersion}/search`,
            {
              params: {
                jql: `project = ${JIRA_PROJECT_KEY}`,
                startAt,
                maxResults: JIRA_PAGE_SIZE,
                fields: fields.join(','),
              },
              auth,
              headers,
            }
          )
        } catch (error: any) {
          const status = error?.response?.status
          if (status === 400 && applicationField) {
            applicationField = ''
            response = await client.get(
              `${credentials.baseUrl}/rest/api/${apiVersion}/search`,
              {
                params: {
                  jql: `project = ${JIRA_PROJECT_KEY}`,
                  startAt,
                  maxResults: JIRA_PAGE_SIZE,
                  fields: baseFields.join(','),
                },
                auth,
                headers,
              }
            )
          } else {
            throw error
          }
        }

        const issues: JiraIssue[] = response.data?.issues || []
        total = response.data?.total ?? total

        for (const issue of issues) {
          const jiraId = issue.key
          if (!jiraId) continue
          const descriptionText = extractAdfText(issue.fields?.description).trim()
          const commentsText = issue.fields?.comment?.comments
            ?.map((comment) => extractAdfText(comment.body).trim())
            .filter(Boolean)
            .join('\n')
          const components = Array.isArray(issue.fields?.components)
            ? issue.fields?.components
                .map((component) => component?.name)
                .filter((name): name is string => Boolean(name))
            : []
          const attachments = Array.isArray(issue.fields?.attachment)
            ? issue.fields?.attachment
            : []
          const attachmentNames = attachments
            .map((attachment) => attachment?.filename)
            .filter((name): name is string => Boolean(name))

          const application = applicationField
            ? normalizeCustomValue(issue.fields?.[applicationField])
            : null
          const teamKey = resolveTeamKey(application, components)
          teamKeys.add(teamKey)

          const scenarioText = [commentsText, descriptionText].filter(Boolean).join('\n')
          const scenarios = parseScenariosFromContent(scenarioText)
          const acceptanceCriteria = extractAcceptanceCriteria(scenarioText)
          const status = issue.fields?.status?.name || ''
          const isFinal = ['done', 'closed'].includes(status.toLowerCase())
          const attachmentsText = isFinal
            ? await extractAttachmentText(attachments, client, auth, headers)
            : null

          const exists = existingIds.has(jiraId)
          await prisma.testCaseSourceTicket.upsert({
            where: { jiraId },
            update: {
              teamKey,
              summary: issue.fields?.summary || jiraId,
              description: descriptionText || null,
              comments: commentsText || null,
              acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria.join('\n') : null,
              status: issue.fields?.status?.name || null,
              components: components.length > 0 ? components.join(', ') : null,
              application: Array.isArray(application)
                ? application.join(', ')
                : application || null,
              attachments: attachmentNames.length > 0 ? attachmentNames.join(', ') : null,
              attachmentsText,
              scenarioCount: scenarios.length,
            },
            create: {
              teamKey,
              jiraId,
              summary: issue.fields?.summary || jiraId,
              description: descriptionText || null,
              comments: commentsText || null,
              acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria.join('\n') : null,
              status: issue.fields?.status?.name || null,
              components: components.length > 0 ? components.join(', ') : null,
              application: Array.isArray(application)
                ? application.join(', ')
                : application || null,
              attachments: attachmentNames.length > 0 ? attachmentNames.join(', ') : null,
              attachmentsText,
              scenarioCount: scenarios.length,
            },
          })

          if (exists) {
            updated += 1
          } else {
            inserted += 1
            existingIds.add(jiraId)
          }
          processed += 1
        }

        startAt += issues.length
        if (issues.length === 0) break
      } while (startAt < total)

      const finishedAt = new Date()
      await prisma.jiraTicketSyncLog.create({
        data: {
          status: 'SUCCESS',
          processedCount: processed,
          insertedCount: inserted,
          updatedCount: updated,
          teamKeys: Array.from(teamKeys).join(', '),
          teamCount: teamKeys.size,
          startedAt,
          finishedAt,
        },
      })

      return NextResponse.json({
        processed,
        inserted,
        updated,
        teamCount: teamKeys.size,
        teamKeys: Array.from(teamKeys),
        lastSyncAt: finishedAt,
      })
    } catch (error) {
      const finishedAt = new Date()
      const message = error instanceof Error ? error.message : 'Failed to sync Jira tickets'
      await prisma.jiraTicketSyncLog.create({
        data: {
          status: 'FAILED',
          processedCount: processed,
          insertedCount: inserted,
          updatedCount: updated,
          teamKeys: teamKeys.size > 0 ? Array.from(teamKeys).join(', ') : null,
          teamCount: teamKeys.size,
          startedAt,
          finishedAt,
          error: message,
        },
      })
      console.error('Error syncing Jira tickets:', error)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  })
)
