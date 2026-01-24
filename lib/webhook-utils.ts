import crypto from 'crypto'

/**
 * Verify GitHub webhook signature
 * GitHub sends X-Hub-Signature-256 header with HMAC SHA256 of payload
 */
export function verifyGitHubSignature(
  payload: string,
  signature: string | null
): boolean {
  try {
    if (!signature) {
      console.warn('[Webhook] No signature provided - skipping verification')
      return true // Allow if signature verification is optional
    }

    const secret = process.env.GITHUB_WEBHOOK_SECRET

    if (!secret) {
      console.warn('[Webhook] GitHub webhook secret not configured')
      return true // Allow if secret not configured
    }

    // GitHub signature format: sha256=<hex>
    const [algorithm, hash] = signature.split('=')

    if (algorithm !== 'sha256') {
      console.error('[Webhook] Unknown signature algorithm:', algorithm)
      return false
    }

    // Create HMAC SHA256
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hash))
  } catch (error) {
    console.error('[Webhook] Error verifying signature:', error)
    return false
  }
}

/**
 * Verify Jira webhook signature
 * Jira uses X-Atlassian-Webhook-Signature header with HMAC SHA256 of request body
 */
export function verifyJiraSignature(
  payload: string,
  signature: string | null
): boolean {
  try {
    if (!signature) {
      console.warn('[Jira Webhook] No signature provided')
      return true
    }

    const secret = process.env.JIRA_WEBHOOK_SECRET

    if (!secret) {
      console.warn('[Jira Webhook] Jira webhook secret not configured')
      return true
    }

    // Jira signature format: sha256=<hex>
    const [algorithm, hash] = signature.split('=')

    if (algorithm !== 'sha256') {
      console.error('[Jira Webhook] Unknown algorithm:', algorithm)
      return false
    }

    const hmac = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hash))
  } catch (error) {
    console.error('[Jira Webhook] Error verifying signature:', error)
    return false
  }
}

/**
 * Verify Confluence webhook signature (similar to Jira)
 */
export function verifyConfluenceSignature(
  payload: string,
  signature: string | null
): boolean {
  return verifyJiraSignature(payload, signature) // Same algorithm as Jira
}

/**
 * Parse and validate webhook payload as JSON
 */
export function parseWebhookPayload(body: string): Record<string, unknown> | null {
  try {
    return JSON.parse(body) as Record<string, unknown>
  } catch (error) {
    console.error('[Webhook] Failed to parse JSON payload:', error)
    return null
  }
}

/**
 * Extract common metadata from webhook event
 */
export function extractWebhookMetadata(payload: Record<string, unknown>): {
  eventType: string
  source: string
  timestamp: Date
  actor?: string
} {
  // Different webhook providers have different structures
  let eventType = 'unknown'
  let source = 'unknown'
  let actor = undefined

  const data = payload as {
    webhookEvent?: string
    user?: { displayName?: string; emailAddress?: string }
    action?: string
    pull_request?: { user?: { login?: string } }
    issue?: { user?: { login?: string } }
    ref?: string
    pusher?: { name?: string }
    page?: { version?: { message?: string; by?: { displayName?: string } } }
  }

  if (data.webhookEvent) {
    // Jira format
    eventType = data.webhookEvent
    source = 'jira'
    actor = data.user?.displayName || data.user?.emailAddress
  } else if (data.action && data.pull_request) {
    // GitHub PR format
    eventType = `pull_request.${data.action}`
    source = 'github'
    actor = data.pull_request.user?.login
  } else if (data.action && data.issue) {
    // GitHub issue format
    eventType = `issue.${data.action}`
    source = 'github'
    actor = data.issue.user?.login
  } else if (data.ref) {
    // GitHub push format
    eventType = 'push'
    source = 'github'
    actor = data.pusher?.name
  } else if (data.page) {
    // Confluence page update format
    eventType = data.page.version?.message ? 'page_updated' : 'page_created'
    source = 'confluence'
    actor = data.page.version?.by?.displayName
  }

  return {
    eventType,
    source,
    timestamp: new Date(),
    actor,
  }
}
