import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const adminSettings = await prisma.adminSettings.findFirst()
    return NextResponse.json({
      baseUrl:
        adminSettings?.jiraBaseUrl || user.jiraBaseUrl || process.env.JIRA_BASE_URL || '',
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
})

export const PUT = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user
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
    const normalizedUser = typeof jiraUser === 'string' ? jiraUser.trim() : undefined
    const normalizedBoardIds = typeof boardIds === 'string' ? boardIds.trim() : undefined
    const normalizedSprintFieldId =
      typeof sprintFieldId === 'string' ? sprintFieldId.trim() : undefined
    const normalizedAuthType =
      authType === 'bearer' || authType === 'basic' ? authType : undefined
    const normalizedDeployment =
      deployment === 'datacenter' || deployment === 'cloud' ? deployment : undefined

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
    } = {}

    if (typeof normalizedUser === 'string') {
      updateData.jiraUser = normalizedUser || null
    }
    if (typeof mergedBoardIds === 'string') {
      updateData.jiraBoardIds = mergedBoardIds || null
    }
    if (typeof normalizedSprintFieldId === 'string') {
      updateData.jiraSprintFieldId = normalizedSprintFieldId || null
    }
    if (typeof normalizedAuthType === 'string') {
      updateData.jiraAuthType = normalizedAuthType
    }
    if (typeof normalizedDeployment === 'string') {
      updateData.jiraDeployment = normalizedDeployment
    }
    if (typeof requestTimeout === 'number' && requestTimeout > 0) {
      updateData.jiraRequestTimeout = requestTimeout
    }

    if (typeof normalizedBaseUrl === 'string' && isAdmin) {
      const existing = await prisma.adminSettings.findFirst()
      if (existing) {
        await prisma.adminSettings.update({
          where: { id: existing.id },
          data: { jiraBaseUrl: normalizedBaseUrl || null },
        })
      } else {
        await prisma.adminSettings.create({
          data: { jiraBaseUrl: normalizedBaseUrl || null },
        })
      }
    }

    if (jiraToken) {
      updateData.jiraApiToken = jiraToken
    }

    if (Object.keys(updateData).length > 0) {
      updateData.jiraConnectionStatus = null
      updateData.jiraConnectionCheckedAt = null
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
})

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
