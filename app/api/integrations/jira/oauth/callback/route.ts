import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    const stateCookie = req.cookies.get('jira_oauth_state')?.value
    const userId = req.cookies.get('jira_oauth_user')?.value

    if (!code || !state || !stateCookie || state !== stateCookie || !userId) {
      return NextResponse.redirect(new URL('/dashboard?jira=invalid', req.url))
    }

    const clientId = process.env.JIRA_OAUTH_CLIENT_ID
    const clientSecret = process.env.JIRA_OAUTH_CLIENT_SECRET
    const redirectUri = process.env.JIRA_OAUTH_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(new URL('/dashboard?jira=missing', req.url))
    }

    const tokenResponse = await axios.post('https://auth.atlassian.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    })

    const accessToken = tokenResponse.data.access_token as string
    const refreshToken = tokenResponse.data.refresh_token as string
    const expiresIn = tokenResponse.data.expires_in as number

    const resourcesResponse = await axios.get(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const resources = Array.isArray(resourcesResponse.data)
      ? resourcesResponse.data
      : []
    const resource = resources[0]

    if (!resource?.id) {
      return NextResponse.redirect(new URL('/dashboard?jira=resource', req.url))
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        jiraAccessToken: accessToken,
        jiraRefreshToken: refreshToken,
        jiraTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        jiraCloudId: resource.id,
        jiraSiteUrl: resource.url || null,
        jiraBaseUrl: resource.url || null,
      },
    })

    const response = NextResponse.redirect(new URL('/dashboard?jira=connected', req.url))
    response.cookies.set('jira_oauth_state', '', { maxAge: 0, path: '/' })
    response.cookies.set('jira_oauth_user', '', { maxAge: 0, path: '/' })
    return response
  } catch (error) {
    console.error('[Jira OAuth] Callback error:', error)
    return NextResponse.redirect(new URL('/dashboard?jira=error', req.url))
  }
}
