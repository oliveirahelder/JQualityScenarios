import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'
import { buildConfluenceCredentialsFromUser } from '@/lib/confluence-config'

export const POST = withAuth(async (req: NextRequest & { user?: any }) => {
  let userId = ''
  try {
    const payload = req.user

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    userId = user.id

    const adminSettings = await prisma.adminSettings.findFirst()
    const credentials = buildConfluenceCredentialsFromUser(
      user,
      adminSettings?.confluenceBaseUrl || null,
      {
        clientId: adminSettings?.confluenceAccessClientId || null,
        clientSecret: adminSettings?.confluenceAccessClientSecret || null,
      }
    )
    if (!credentials) {
      return NextResponse.json(
        { error: 'Confluence integration not configured' },
        { status: 400 }
      )
    }

    const response = await axios.get(`${credentials.baseUrl}/rest/api/user/current`, {
      auth:
        credentials.authType === 'basic'
          ? {
              username: credentials.user as string,
              password: credentials.token,
            }
          : undefined,
      headers: {
        ...(credentials.authType === 'bearer'
          ? {
              Authorization: `Bearer ${credentials.token}`,
            }
          : {}),
        ...(credentials.accessClientId && credentials.accessClientSecret
          ? {
              'CF-Access-Client-Id': credentials.accessClientId,
              'CF-Access-Client-Secret': credentials.accessClientSecret,
            }
          : {}),
      },
      timeout: credentials.requestTimeout || 30000,
    })

    if (
      typeof response.data === 'string' &&
      response.headers?.['content-type']?.includes('text/html')
    ) {
      throw new Error('Cloudflare Access blocked Confluence API requests.')
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        confluenceConnectionStatus: 'connected',
        confluenceConnectionCheckedAt: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      displayName: response.data?.displayName,
      email: response.data?.email,
    })
  } catch (error) {
    let message = 'Failed to test Confluence connection'
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      if (status === 401) {
        message = 'Unauthorized (401). Check Confluence Base URL and PAT token.'
      } else if (status === 403) {
        message = 'Forbidden (403). Token lacks Confluence permissions.'
      } else if (status === 404) {
        message = 'Not found (404). Confluence Base URL is likely incorrect.'
      } else {
        message = error.response?.data?.message || error.message
      }
    } else if (error instanceof Error) {
      message = error.message
    }

    await prisma.user
      .update({
        where: { id: userId },
        data: {
          confluenceConnectionStatus: 'error',
          confluenceConnectionCheckedAt: new Date(),
        },
      })
      .catch(() => undefined)

    console.error('[Confluence Integration] Test error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
