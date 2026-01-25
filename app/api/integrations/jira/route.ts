import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
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

    return NextResponse.json({
      baseUrl: user.jiraBaseUrl || process.env.JIRA_BASE_URL || '',
      user: user.jiraUser || '',
      boardIds: user.jiraBoardIds || '',
      sprintFieldId: user.jiraSprintFieldId || '',
      requestTimeout: user.jiraRequestTimeout || 30000,
      hasToken: Boolean(user.jiraApiToken),
      authType: user.jiraAuthType || 'basic',
      deployment: user.jiraDeployment || 'cloud',
      hasOAuth: Boolean(user.jiraAccessToken && user.jiraCloudId),
      siteUrl: user.jiraSiteUrl || '',
      connectionStatus: user.jiraConnectionStatus || '',
      connectionCheckedAt: user.jiraConnectionCheckedAt?.toISOString() || '',
    })
  } catch (error) {
    console.error('[Jira Integration] Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to load Jira settings' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const isAdmin = ['ADMIN', 'DEVOPS'].includes(payload.role)

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const {
      baseUrl,
      user: jiraUser,
      token: jiraToken,
      boardIds,
      sprintFieldId,
      requestTimeout,
      authType,
      deployment,
      boardUrl,
    } = await req.json()

    const normalizedBaseUrl =
      typeof baseUrl === 'string' ? baseUrl.trim().replace(/\/+$/, '') : undefined
    const normalizedUser = typeof jiraUser === 'string' ? jiraUser.trim() : ''
    const normalizedBoardIds = typeof boardIds === 'string' ? boardIds.trim() : ''
    const normalizedSprintFieldId =
      typeof sprintFieldId === 'string' ? sprintFieldId.trim() : ''
    const normalizedAuthType =
      authType === 'bearer' || authType === 'basic' ? authType : 'bearer'
    const normalizedDeployment =
      deployment === 'datacenter' || deployment === 'cloud' ? deployment : 'datacenter'

    const normalizedBoardUrl = typeof boardUrl === 'string' ? boardUrl.trim() : ''
    const boardIdFromUrl = extractBoardIdFromUrl(normalizedBoardUrl)
    const mergedBoardIds = boardIdFromUrl
      ? boardIdFromUrl
      : normalizedBoardIds

    const updateData: {
      jiraBaseUrl?: string | null
      jiraUser?: string | null
      jiraApiToken?: string | null
      jiraBoardIds?: string | null
      jiraSprintFieldId?: string | null
      jiraRequestTimeout?: number | null
      jiraAuthType?: string | null
      jiraDeployment?: string | null
      jiraConnectionStatus?: string | null
      jiraConnectionCheckedAt?: Date | null
    } = {
      jiraUser: normalizedUser || null,
      jiraBoardIds: mergedBoardIds || null,
      jiraSprintFieldId: normalizedSprintFieldId || null,
      jiraAuthType: normalizedAuthType,
      jiraDeployment: normalizedDeployment,
      jiraConnectionStatus: null,
      jiraConnectionCheckedAt: null,
    }

    if (typeof requestTimeout === 'number' && requestTimeout > 0) {
      updateData.jiraRequestTimeout = requestTimeout
    } else {
      updateData.jiraRequestTimeout = null
    }

    if (typeof normalizedBaseUrl === 'string' && isAdmin) {
      updateData.jiraBaseUrl = normalizedBaseUrl || null
    }

    if (jiraToken) {
      updateData.jiraApiToken = jiraToken
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Jira Integration] Error saving settings:', error)
    return NextResponse.json(
      { error: 'Failed to save Jira settings' },
      { status: 500 }
    )
  }
}

function extractBoardIdFromUrl(value: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    const rapidView = url.searchParams.get('rapidView')
    if (rapidView) return rapidView
    const boardMatch = url.pathname.match(/\/boards?\/(\d+)/i)
    if (boardMatch?.[1]) return boardMatch[1]
  } catch {
    const rapidMatch = value.match(/rapidView=(\d+)/i)
    if (rapidMatch?.[1]) return rapidMatch[1]
  }
  return null
}
