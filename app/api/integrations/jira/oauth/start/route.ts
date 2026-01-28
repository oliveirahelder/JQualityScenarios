import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { withAuth } from '@/lib/middleware'

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user

    const clientId = process.env.JIRA_OAUTH_CLIENT_ID
    const redirectUri = process.env.JIRA_OAUTH_REDIRECT_URI
    const scopes =
      process.env.JIRA_OAUTH_SCOPES ||
      'read:jira-work read:jira-user offline_access'

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'Jira OAuth not configured' },
        { status: 500 }
      )
    }

    const state = crypto.randomBytes(16).toString('hex')
    const authUrl = new URL('https://auth.atlassian.com/authorize')
    authUrl.searchParams.set('audience', 'api.atlassian.com')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('prompt', 'consent')

    const response = NextResponse.json({ url: authUrl.toString() })
    response.cookies.set('jira_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60,
      path: '/',
    })
    response.cookies.set('jira_oauth_user', payload.userId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('[Jira OAuth] Start error:', error)
    return NextResponse.json(
      { error: 'Failed to start Jira OAuth' },
      { status: 500 }
    )
  }
})
