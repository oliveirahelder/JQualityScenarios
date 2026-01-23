import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'
import { getActiveSprints } from '@/lib/jira-sprints'

type TicketStatusBucket = 'todo' | 'in_progress' | 'done' | 'other'

function bucketStatus(statusName: string | undefined): TicketStatusBucket {
  const value = (statusName || '').toLowerCase().trim()
  if (!value) return 'other'
  if (value.includes('done') || value.includes('closed') || value.includes('resolved')) {
    return 'done'
  }
  if (value.includes('in progress') || value.includes('progress') || value.includes('doing')) {
    return 'in_progress'
  }
  if (
    value.includes('to do') ||
    value.includes('todo') ||
    value.includes('backlog') ||
    value.includes('new') ||
    value.includes('open')
  ) {
    return 'todo'
  }
  return 'other'
}

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Missing authentication token' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const jiraCredentials = buildJiraCredentialsFromUser(user)
    if (!jiraCredentials) {
      return NextResponse.json({ error: 'Jira integration not configured' }, { status: 400 })
    }

    const activeSprints = await getActiveSprints(jiraCredentials)
    const ticketStatusCounts = {
      todo: 0,
      in_progress: 0,
      done: 0,
      other: 0,
    }

    const seenKeys = new Set<string>()
    for (const sprint of activeSprints) {
      for (const issue of sprint.issues || []) {
        if (!issue.key || seenKeys.has(issue.key)) continue
        seenKeys.add(issue.key)
        const bucket = bucketStatus(issue.fields?.status?.name)
        ticketStatusCounts[bucket] += 1
      }
    }

    return NextResponse.json({
      activeSprintCount: activeSprints.length,
      totalTickets: seenKeys.size,
      ticketStatusCounts,
    })
  } catch (error) {
    console.error('[Metrics] Jira metrics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Jira metrics' },
      { status: 500 }
    )
  }
}
