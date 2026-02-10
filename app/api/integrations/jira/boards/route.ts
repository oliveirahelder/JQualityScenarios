import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'
import { getAllBoards } from '@/lib/jira-sprints'

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const scope = req.nextUrl.searchParams.get('scope') || 'jmia'
    const payload = req.user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const adminSettings = await prisma.adminSettings.findFirst()
    const jiraCredentials = buildJiraCredentialsFromUser(
      user,
      adminSettings?.jiraBaseUrl || process.env.JIRA_BASE_URL || null
    )

    if (!jiraCredentials) {
      return NextResponse.json(
        { error: 'Jira integration not configured' },
        { status: 400 }
      )
    }

    const boards = await getAllBoards(jiraCredentials, { type: 'all' })
    const filteredBoards =
      scope === 'all'
        ? boards
        : boards.filter((board) => board.location?.projectKey?.toUpperCase() === 'JMIA')
    return NextResponse.json({
      scope,
      total: boards.length,
      matched: filteredBoards.length,
      boards: filteredBoards.map((board) => ({
        id: board.id,
        name: board.name || board.location?.displayName || '',
        projectKey: board.location?.projectKey || '',
        projectName: board.location?.projectName || '',
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch Jira boards'
    console.error('[Jira Boards] Error fetching boards:', message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})
