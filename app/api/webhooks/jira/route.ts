import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeSprint, normalizeIssue } from '@/lib/jira-sprints'
import { ensureSprintSnapshot } from '@/lib/sprint-snapshot'
import { verifyJiraSignature, parseWebhookPayload } from '@/lib/webhook-utils'

type JiraChangelogItem = {
  field?: string | null
  fieldtype?: string | null
  toString?: string | null
  to?: string | null
}

type JiraIssuePayload = {
  key?: string
  fields?: Record<string, unknown>
}

type JiraSprintPayload = {
  id?: number | string
  name?: string
  startDate?: string | Date
  endDate?: string | Date
}

type JiraWebhookBody = {
  webhookEvent?: string
  event_type?: string
  issue?: JiraIssuePayload
  sprint?: JiraSprintPayload
  changelog?: { items?: JiraChangelogItem[] }
}

function getSprintFieldValue(issue: JiraIssuePayload | undefined) {
  const sprintFieldKey = process.env.JIRA_SPRINT_FIELD_ID || 'sprint'
  if (!issue?.fields) return undefined
  return issue.fields[sprintFieldKey] ?? issue.fields.sprint
}

function getSprintIdFromField(sprintField: unknown): string | null {
  if (!sprintField) return null

  if (Array.isArray(sprintField)) {
    const last = sprintField[sprintField.length - 1] as { id?: number | string }
    return last?.id?.toString() || null
  }

  if (typeof sprintField === 'object') {
    const field = sprintField as { id?: number | string }
    return field.id?.toString() || null
  }

  return null
}

/**
 * Webhook endpoint to receive Jira events
 * Configured in Jira: Settings → Webhooks → Add webhook
 * URL: https://your-domain/api/webhooks/jira
 * Events: Sprint created, Sprint started, Sprint closed, Issue created, Issue updated
 */
export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text()
    const signature = req.headers.get('X-Atlassian-Webhook-Signature')
    if (!verifyJiraSignature(bodyText, signature)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }

    const body = parseWebhookPayload(bodyText) as JiraWebhookBody | null
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      )
    }
    const eventType = body.webhookEvent || body.event_type

    console.log(`[JIRA Webhook] Event: ${eventType}`)

    switch (eventType) {
      case 'jira:issue_created':
        return await handleIssueCreated(body)

      case 'jira:issue_updated':
        return await handleIssueUpdated(body)

      case 'sprint_created':
        return await handleSprintCreated(body)

      case 'sprint_started':
        return await handleSprintStarted(body)

      case 'sprint_closed':
        return await handleSprintClosed(body)

      default:
        console.log(`[JIRA Webhook] Unhandled event: ${eventType}`)
        return NextResponse.json({ ok: true })
    }
  } catch (error) {
    console.error('[JIRA Webhook] Error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * Handle new issue creation
 */
async function handleIssueCreated(body: JiraWebhookBody) {
  try {
    const issue = body.issue
    if (!issue?.key) {
      return NextResponse.json({ ok: true })
    }

    // Find sprint from issue if available
    const sprintField = getSprintFieldValue(issue)
    const sprintId = getSprintIdFromField(sprintField)
    if (!sprintId) {
      return NextResponse.json({ ok: true })
    }

    // Find the sprint in database
    const sprint = await prisma.sprint.findUnique({
      where: { jiraId: sprintId },
    })

    if (!sprint) {
      console.log(`[JIRA Webhook] Sprint not found: ${sprintId}`)
      return NextResponse.json({ ok: true })
    }

    // Check if ticket already exists
    const existingTicket = await prisma.ticket.findUnique({
      where: { jiraId: issue.key },
    })

    if (existingTicket) {
      return NextResponse.json({ ok: true })
    }

    // Create ticket
    const normalized = normalizeIssue(issue)
    const grossTime = Math.ceil(
      (new Date().getTime() - sprint.startDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    await prisma.ticket.create({
      data: {
        sprintId: sprint.id,
        jiraId: normalized.jiraId,
        summary: normalized.summary,
        description: normalized.description,
        status: 'TODO',
        assignee: normalized.assignee,
        priority: normalized.priority,
        grossTime: Math.max(0, grossTime),
      },
    })

    console.log(`[JIRA Webhook] Ticket created: ${issue.key}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[JIRA Webhook] Error handling issue created:', error)
    throw error
  }
}

/**
 * Handle issue updates (status changes, assignment changes)
 */
async function handleIssueUpdated(body: JiraWebhookBody) {
  try {
    const issue = body.issue
    if (!issue?.key) {
      return NextResponse.json({ ok: true })
    }
    const changelog = body.changelog?.items || []

    // Find ticket in database
    const ticket = await prisma.ticket.findUnique({
      where: { jiraId: issue.key },
    })

    if (!ticket) {
      console.log(`[JIRA Webhook] Ticket not found: ${issue.key}`)
      return NextResponse.json({ ok: true })
    }

    // Check for status changes
    const statusChange = changelog.find(
      (item: JiraChangelogItem) => item.field === 'status' || item.fieldtype === 'status'
    )

    if (statusChange) {
      const newStatus = statusChange.toString || statusChange.to || 'IN_PROGRESS'
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: newStatus as string },
      })
    }

    // Check for assignee changes
    const assigneeChange = changelog.find(
      (item: JiraChangelogItem) => item.field === 'assignee' || item.fieldtype === 'assignee'
    )

    if (assigneeChange) {
      const newAssignee = assigneeChange.toString || assigneeChange.to || null
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { assignee: newAssignee },
      })
    }

    console.log(`[JIRA Webhook] Ticket updated: ${issue.key}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[JIRA Webhook] Error handling issue updated:', error)
    throw error
  }
}

/**
 * Handle sprint creation
 */
async function handleSprintCreated(body: JiraWebhookBody) {
  try {
    const sprint = body.sprint
    if (!sprint) {
      return NextResponse.json({ ok: true })
    }
    const normalized = normalizeSprint(sprint)

    // Check if sprint already exists
    const existingSprint = await prisma.sprint.findUnique({
      where: { jiraId: normalized.jiraId },
    })

    if (existingSprint) {
      return NextResponse.json({ ok: true })
    }

    // Create sprint
    await prisma.sprint.create({
      data: {
        jiraId: normalized.jiraId,
        name: normalized.name,
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        status: 'PLANNED',
      },
    })

    console.log(`[JIRA Webhook] Sprint created: ${sprint.name}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[JIRA Webhook] Error handling sprint created:', error)
    throw error
  }
}

/**
 * Handle sprint start
 */
async function handleSprintStarted(body: JiraWebhookBody) {
  try {
    const sprint = body.sprint
    if (!sprint) {
      return NextResponse.json({ ok: true })
    }
    const normalized = normalizeSprint(sprint)

    await prisma.sprint.update({
      where: { jiraId: normalized.jiraId },
      data: { status: 'ACTIVE' },
    })

    console.log(`[JIRA Webhook] Sprint started: ${sprint.name}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[JIRA Webhook] Error handling sprint started:', error)
    throw error
  }
}

/**
 * Handle sprint closure
 */
async function handleSprintClosed(body: JiraWebhookBody) {
  try {
    const sprint = body.sprint
    if (!sprint) {
      return NextResponse.json({ ok: true })
    }
    const normalized = normalizeSprint(sprint)

    const updatedSprint = await prisma.sprint.update({
      where: { jiraId: normalized.jiraId },
      data: { status: 'COMPLETED' },
    })

    await ensureSprintSnapshot(updatedSprint.id)
    console.log(`[JIRA Webhook] Sprint closed: ${sprint.name}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[JIRA Webhook] Error handling sprint closed:', error)
    throw error
  }
}
