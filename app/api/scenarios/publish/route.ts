import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'
import { addJiraComment } from '@/lib/jira-service'

export const POST = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user
    const { ticketId, comment } = await req.json()

    if (!ticketId || !comment) {
      return NextResponse.json(
        { error: 'ticketId and comment are required' },
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

    const published = await addJiraComment(ticketId, comment, jiraCredentials)

    return NextResponse.json({ published }, { status: 200 })
  } catch (error) {
    console.error('Error publishing Jira comment:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish comment' },
      { status: 500 }
    )
  }
})
