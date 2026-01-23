import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getPullRequest,
  extractDeveloperNotes,
  analyzeImpactAreas,
  getPRCommitMessages,
} from '@/lib/github-service'
import { verifyGitHubSignature } from '@/lib/webhook-utils'

/**
 * POST /api/webhooks/github
 * Handles GitHub webhook events: pull_request, push
 */
export async function POST(request: NextRequest) {
  try {
    // Verify GitHub webhook signature
    const signature = request.headers.get('x-hub-signature-256')
    const body = await request.text()

    if (!verifyGitHubSignature(body, signature)) {
      console.log('[GitHub Webhook] Invalid signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const event = request.headers.get('x-github-event')
    const payload = JSON.parse(body)

    console.log(`[GitHub Webhook] Received ${event} event`)

    if (event === 'pull_request') {
      await handlePullRequest(payload)
    } else if (event === 'push') {
      await handlePush(payload)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[GitHub Webhook] Error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * Handle pull_request events (opened, synchronize, closed)
 */
async function handlePullRequest(payload: any) {
  try {
    const action = payload.action // 'opened', 'synchronize', 'closed', etc.
    const pr = payload.pull_request
    const repo = payload.repository

    if (!pr || !repo) {
      console.log('[GitHub Webhook] Missing PR or repo data')
      return
    }

    // Only process PR opened, updated (synchronize), or closed
    if (!['opened', 'synchronize', 'closed'].includes(action)) {
      console.log(`[GitHub Webhook] Skipping action: ${action}`)
      return
    }

    const owner = repo.owner.login
    const repoName = repo.name
    const prNumber = pr.number

    console.log(
      `[GitHub Webhook] Processing PR #${prNumber} in ${owner}/${repoName}`
    )

    // Fetch full PR details
    const prDetails = await getPullRequest(owner, repoName, prNumber)

    // Extract developer notes and impact areas
    const developerNotes = await extractDeveloperNotes(prDetails.body)
    const impactAreas = await analyzeImpactAreas(prDetails.diff)
    const commits = await getPRCommitMessages(owner, repoName, prNumber)

    // Find related ticket by looking for Jira key in PR body/title
    const jiraKeyMatch = prDetails.body.match(/([A-Z]+-\d+)/i) ||
      prDetails.title.match(/([A-Z]+-\d+)/i) || [null, null]
    const jiraKey = jiraKeyMatch[1]

    let ticketId: string | null = null
    if (jiraKey) {
      const ticket = await prisma.ticket.findUnique({
        where: { jiraId: jiraKey },
      })
      if (ticket) {
        ticketId = ticket.id
      }
    }

    // Create or update DevInsight
    if (ticketId) {
      const insightPayload = {
        ticketId,
        prUrl: prDetails.url,
        prTitle: prDetails.title,
        prNotes: developerNotes,
        prDiff: prDetails.diff.substring(0, 5000), // Limit diff size
        aiAnalysis: JSON.stringify({
          impactAreas,
          commitCount: commits.length,
          filesChanged: prDetails.files.length,
          additions: prDetails.additions,
          deletions: prDetails.deletions,
          firstCommitMessage: commits[0] || '',
        }),
        analyzedAt: new Date(),
      }

      const existingInsight = await prisma.devInsight.findFirst({
        where: { ticketId },
      })

      if (existingInsight) {
        await prisma.devInsight.update({
          where: { id: existingInsight.id },
          data: insightPayload,
        })
      } else {
        await prisma.devInsight.create({
          data: insightPayload,
        })
      }

      console.log(
        `[GitHub Webhook] DevInsight created/updated for ticket ${jiraKey}`
      )
    } else {
      console.log(
        `[GitHub Webhook] No Jira ticket found in PR description/title`
      )
    }

    // Store PR analysis in a separate event log (optional, for audit trail)
    console.log('[GitHub Webhook] PR analysis complete:', {
      pr: prNumber,
      repo: repoName,
      impactAreas,
      filesChanged: prDetails.files.length,
    })
  } catch (error) {
    console.error('[GitHub Webhook] Error handling PR:', error)
  }
}

/**
 * Handle push events (commits to main branches)
 */
async function handlePush(payload: any) {
  try {
    const ref = payload.ref // 'refs/heads/main', etc.
    const commits = payload.commits || []
    const repo = payload.repository

    if (!repo) {
      console.log('[GitHub Webhook] Missing repo data in push event')
      return
    }

    const branch = ref.replace('refs/heads/', '')
    console.log(
      `[GitHub Webhook] Received push to ${repo.name}:${branch} with ${commits.length} commits`
    )

    // Only process pushes to main/master
    if (!['main', 'master', 'staging', 'production'].includes(branch)) {
      console.log(`[GitHub Webhook] Skipping branch: ${branch}`)
      return
    }

    // TODO: Trigger deployment tracking or CI/CD status update
    // This would link to Phase 2 Task 9 advanced features
    console.log(`[GitHub Webhook] Push event logged for future processing`)
  } catch (error) {
    console.error('[GitHub Webhook] Error handling push:', error)
  }
}
