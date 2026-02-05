import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import {
  fetchJiraTicket,
  parseJiraXml,
  generateScenariosWithAI,
} from '@/lib/jira-service'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'
import { extractPullRequestUrls, getPullRequestFromUrl } from '@/lib/github-service'

export const POST = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user

    const { ticketId, xmlText, confluence } = await req.json()

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const adminSettings = await prisma.adminSettings.findFirst()

    let jiraDetails
    let existingTicket: {
      id: string
      sprintId: string
      summary: string | null
      devInsights: Array<{ prUrl: string | null; prTitle: string | null; prNotes: string | null }>
    } | null = null
    let attachmentsContext = ''

    // Fetch Jira ticket details
    if (ticketId) {
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
      const pullRequestsFromDb = existingTicket?.devInsights?.length
        ? existingTicket.devInsights
            .map((insight) => ({
              url: insight.prUrl,
              title: insight.prTitle,
              notes: insight.prNotes,
            }))
            .filter((pr) => pr.url || pr.title || pr.notes)
        : []

      const prUrlsFromTicket = extractPullRequestUrls(
        [jiraDetails.description, jiraDetails.comments].filter(Boolean).join('\n')
      )

      // Allow user to paste PR links in the "documentation" textarea
      const prUrlsFromExtra = extractPullRequestUrls(confluence || '')

      const prUrls = Array.from(
        new Set([
          ...pullRequestsFromDb.map((pr) => pr.url).filter(Boolean),
          ...prUrlsFromTicket,
          ...prUrlsFromExtra,
        ])
      )

      const pullRequests: Array<{
        url?: string | null
        title?: string | null
        notes?: string | null
        author?: string | null
        createdAt?: string | null
        updatedAt?: string | null
        additions?: number | null
        deletions?: number | null
        commits?: number | null
        files?: string[]
      }> = [...pullRequestsFromDb]

      const orgTokens: string[] =
        adminSettings?.githubOrgTokens
          ?.split(/\r?\n+/)
          .map((t) => t.trim())
          .filter(Boolean) || []

      if (prUrls.length > 0) {
        for (const url of prUrls) {
          if (pullRequests.some((pr) => pr.url === url)) {
            continue
          }
          let prDetails = user.githubApiToken
            ? await getPullRequestFromUrl(url, user.githubApiToken, adminSettings?.githubBaseUrl || null)
            : null
          if (!prDetails && orgTokens.length > 0) {
            for (const token of orgTokens) {
              prDetails = await getPullRequestFromUrl(
                url,
                token,
                adminSettings?.githubBaseUrl || null
              )
              if (prDetails) break
            }
          }
          if (prDetails) {
            pullRequests.push({
              url: prDetails.url,
              title: prDetails.title,
              notes: prDetails.body,
              author: prDetails.author,
              createdAt: prDetails.createdAt,
              updatedAt: prDetails.updatedAt,
              additions: prDetails.additions,
              deletions: prDetails.deletions,
              commits: prDetails.commits,
              files: prDetails.files,
            })
          } else {
            pullRequests.push({ url })
          }
        }
      }

      if (pullRequests.length > 0) {
        jiraDetails.pullRequests = pullRequests
      }

      const attachments = await prisma.documentationAttachment.findMany({
        where: { jiraId: ticketId, userId: payload.userId },
        select: { filename: true, textContent: true },
        orderBy: { createdAt: 'desc' },
      })

      if (attachments.length > 0) {
        attachmentsContext = attachments
          .map((attachment, index) => {
            const header = `Attachment ${index + 1}: ${attachment.filename}`
            const body = attachment.textContent?.trim() || ''
            return [header, body].filter(Boolean).join('\n')
          })
          .join('\n\n')
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
    const aiConfig = {
      apiKey: user.openaiApiKey || undefined,
      model: user.openaiModel || undefined,
      baseUrl: adminSettings?.aiBaseUrl || null,
      maxTokens:
        typeof adminSettings?.aiMaxTokens === 'number' && Number.isFinite(adminSettings.aiMaxTokens)
          ? adminSettings.aiMaxTokens
          : undefined,
    }

    const confluenceContext = [confluence, attachmentsContext].filter(Boolean).join('\n\n')

    const generated = await generateScenariosWithAI(jiraDetails, confluenceContext, aiConfig)

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
})
