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

      if (!summary || !description) {
        return NextResponse.json(
          { error: 'summary and description are required' },
          { status: 400 }
        )
      }

      if (issueType && !ALLOWED_ISSUE_TYPES.has(issueType)) {
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
          issueType,
          labels: normalizedLabels,
        },
        jiraCredentials
      )

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
