import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { prisma } from '@/lib/prisma'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'

export async function POST(req: NextRequest) {
  let userId = ''
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    userId = user.id

    const credentials = buildJiraCredentialsFromUser(user)
    if (!credentials) {
      return NextResponse.json(
        { error: 'Jira integration not configured' },
        { status: 400 }
      )
    }

    const apiVersion = credentials.deployment === 'datacenter' ? '2' : '3'
    const response = await axios.get(`${credentials.baseUrl}/rest/api/${apiVersion}/myself`, {
      auth:
        credentials.authType === 'basic'
          ? {
              username: credentials.user as string,
              password: credentials.token,
            }
          : undefined,
      headers:
        credentials.authType === 'oauth' || credentials.authType === 'bearer'
          ? {
              Authorization: `Bearer ${credentials.token}`,
            }
          : undefined,
      timeout: credentials.requestTimeout || 30000,
    })

    await prisma.user.update({
      where: { id: userId },
      data: {
        jiraConnectionStatus: 'connected',
        jiraConnectionCheckedAt: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      displayName: response.data?.displayName,
      email: response.data?.emailAddress,
      accountId: response.data?.accountId,
    })
  } catch (error) {
    let message = 'Failed to test Jira connection'
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      if (status === 401) {
        message =
          'Unauthorized (401). Check Jira Base URL, username/email, and token. For Jira Data Center, use PAT (Bearer) or password.'
      } else if (status === 403) {
        message =
          'Forbidden (403). Token lacks access to Jira or project permissions.'
      } else if (status === 404) {
        message =
          'Not found (404). Jira Base URL is likely incorrect.'
      } else {
        message = error.response?.data?.errorMessages?.[0] || error.message
      }
    } else if (error instanceof Error) {
      message = error.message
    }

    if (userId) {
      await prisma.user
        .update({
          where: { id: userId },
          data: {
            jiraConnectionStatus: 'error',
            jiraConnectionCheckedAt: new Date(),
          },
        })
        .catch(() => undefined)
    }

    console.error('[Jira Integration] Test error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
