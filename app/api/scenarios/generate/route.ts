import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import {
  fetchJiraTicket,
  parseJiraXml,
  generateScenariosWithAI,
} from '@/lib/jira-service'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const token = extractTokenFromHeader(req.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { ticketId, xmlText, confluence } = await req.json()

    let jiraDetails
    let existingTicket: {
      id: string
      sprintId: string
      summary: string | null
      devInsights: Array<{ prUrl: string | null; prTitle: string | null; prNotes: string | null }>
    } | null = null

    // Fetch Jira ticket details
    if (ticketId) {
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

      jiraDetails = await fetchJiraTicket(ticketId, jiraCredentials)
      existingTicket = await prisma.ticket.findUnique({
        where: { jiraId: ticketId },
        select: {
          id: true,
          sprintId: true,
          summary: true,
          devInsights: {
            select: {
              prUrl: true,
              prTitle: true,
              prNotes: true,
            },
          },
        },
      })
      if (existingTicket?.devInsights?.length) {
        jiraDetails.pullRequests = existingTicket.devInsights.map((insight) => ({
          url: insight.prUrl,
          title: insight.prTitle,
          notes: insight.prNotes,
        }))
      }
    } else if (xmlText) {
      const parsed = await parseJiraXml(xmlText)
      if (parsed.length === 0) {
        return NextResponse.json({ error: 'No tickets found in XML' }, { status: 400 })
      }
      jiraDetails = parsed[0]
    } else {
      return NextResponse.json(
        { error: 'Either ticketId or xmlText is required' },
        { status: 400 }
      )
    }

    // Generate scenarios using AI
    const generated = await generateScenariosWithAI(jiraDetails, confluence)

    return NextResponse.json({
      jiraDetails,
      ticketRef: existingTicket
        ? {
            id: existingTicket.id,
            sprintId: existingTicket.sprintId,
            summary: existingTicket.summary || jiraDetails.summary,
          }
        : null,
      scenarios: generated.gherkin,
      manualScenarios: generated.manual,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in scenario generation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate scenarios' },
      { status: 500 }
    )
  }
}
