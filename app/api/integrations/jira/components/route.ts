import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const projectKey = req.nextUrl.searchParams.get('projectKey') || 'JMIA'

    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const adminSettings = await prisma.adminSettings.findFirst()
    const credentials = buildJiraCredentialsFromUser(user, adminSettings?.jiraBaseUrl || null)
    if (!credentials) {
      return NextResponse.json({ error: 'Jira integration not configured' }, { status: 400 })
    }

    const apiVersion = credentials.deployment === 'datacenter' ? '2' : '3'
    const response = await axios.get(
      `${credentials.baseUrl}/rest/api/${apiVersion}/project/${projectKey}/components`,
      {
        auth:
          credentials.authType === 'basic'
            ? {
                username: credentials.user as string,
                password: credentials.token,
              }
            : undefined,
        headers:
          credentials.authType === 'oauth' || credentials.authType === 'bearer'
            ? { Authorization: `Bearer ${credentials.token}` }
            : undefined,
      }
    )

    const components = Array.isArray(response.data)
      ? response.data
          .map((component: any) => ({
            id: component?.id,
            name: component?.name,
            description: component?.description,
          }))
          .filter((component) => typeof component.name === 'string')
          .sort((a, b) => a.name.localeCompare(b.name))
      : []

    return NextResponse.json({
      projectKey,
      total: components.length,
      components,
    })
  } catch (error) {
    console.error('[Jira Components] Error fetching components:', error)
    return NextResponse.json({ error: 'Failed to fetch Jira components' }, { status: 500 })
  }
})
