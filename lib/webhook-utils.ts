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
export function parseWebhookPayload(body: string): Record<string, any> | null {
  try {
    return JSON.parse(body)
  } catch (error) {
    console.error('[Webhook] Failed to parse JSON payload:', error)
    return null
  }
}

/**
 * Extract common metadata from webhook event
 */
export function extractWebhookMetadata(payload: Record<string, any>): {
  eventType: string
  source: string
  timestamp: Date
  actor?: string
} {
  // Different webhook providers have different structures
  let eventType = 'unknown'
  let source = 'unknown'
  let actor = undefined

  if (payload.webhookEvent) {
    // Jira format
    eventType = payload.webhookEvent
    source = 'jira'
    actor = payload.user?.displayName || payload.user?.emailAddress
  } else if (payload.action && payload.pull_request) {
    // GitHub PR format
    eventType = `pull_request.${payload.action}`
    source = 'github'
    actor = payload.pull_request.user?.login
  } else if (payload.action && payload.issue) {
    // GitHub issue format
    eventType = `issue.${payload.action}`
    source = 'github'
    actor = payload.issue.user?.login
  } else if (payload.ref) {
    // GitHub push format
    eventType = 'push'
    source = 'github'
    actor = payload.pusher?.name
  } else if (payload.page) {
    // Confluence page update format
    eventType = payload.page.version.message ? 'page_updated' : 'page_created'
    source = 'confluence'
    actor = payload.page.version.by?.displayName
  }

  return {
    eventType,
    source,
    timestamp: new Date(),
    actor,
  }
}
