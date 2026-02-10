import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withRole } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'
import { createJiraTicket } from '@/lib/jira-service'

const PROJECT_KEY = 'JMIA'
const ALLOWED_ISSUE_TYPES = new Set([
  'Bug',
  'Task',
  'Story',
  'Epic',
  'Product Task',
  'Support',
  'Spike',
])

export const POST = withAuth(
  withRole('QA', 'ADMIN')(async (req: NextRequest & { user?: any }) => {
    try {
      const payload = req.user
      const { summary, issueType, description, labels } = await req.json()
      const resolvedIssueType = issueType || 'Task'

      if (!summary || !description) {
        return NextResponse.json(
          { error: 'summary and description are required' },
          { status: 400 }
        )
      }

      if (!ALLOWED_ISSUE_TYPES.has(resolvedIssueType)) {
        return NextResponse.json(
          { error: 'Invalid issue type' },
          { status: 400 }
        )
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const adminSettings = await prisma.adminSettings.findFirst()
      const jiraCredentials = buildJiraCredentialsFromUser(
        user,
        adminSettings?.jiraBaseUrl || null
      )

      if (!jiraCredentials) {
        return NextResponse.json(
          { error: 'Jira integration not configured' },
          { status: 400 }
        )
      }

      const normalizedLabels = Array.isArray(labels)
        ? labels.map((label) => String(label).trim()).filter(Boolean)
        : typeof labels === 'string'
        ? labels
            .split(',')
            .map((label) => label.trim())
            .filter(Boolean)
        : []

      const result = await createJiraTicket(
        {
          projectKey: PROJECT_KEY,
          summary,
          description,
          issueType: resolvedIssueType,
          labels: normalizedLabels,
        },
        jiraCredentials
      )

      await prisma.jiraTicketCreation.create({
        data: {
          userId: user.id,
          jiraKey: result.key,
          jiraUrl: result.url,
          summary,
          issueType: resolvedIssueType,
          labels: normalizedLabels.length > 0 ? normalizedLabels.join(',') : null,
        },
      })

      return NextResponse.json({ ticketKey: result.key, url: result.url })
    } catch (error) {
      console.error('Error creating Jira ticket:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to create Jira ticket' },
        { status: 500 }
      )
    }
  })
)

export const GET = withAuth(
  withRole('QA', 'ADMIN')(async (req: NextRequest & { user?: any }) => {
    try {
      const payload = req.user
      const history = await prisma.jiraTicketCreation.findMany({
        where: { userId: payload.userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      return NextResponse.json({
        history: history.map((item) => ({
          id: item.id,
          jiraKey: item.jiraKey,
          jiraUrl: item.jiraUrl,
          summary: item.summary,
          issueType: item.issueType,
          labels: item.labels ? item.labels.split(',').map((label) => label.trim()) : [],
          createdAt: item.createdAt,
        })),
      })
    } catch (error) {
      console.error('Error loading Jira ticket history:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to load history' },
        { status: 500 }
      )
    }
  })
)
