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
    if (adminSettings?.aiBaseUrl) {
      return NextResponse.json(
        { error: 'Model listing is disabled for custom AI gateways.' },
        { status: 400 }
      )
    }

    const apiKey = user.openaiApiKey || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 })
    }

    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey })
    const models = await client.models.list()

    const modelIds = models.data
      .map((model) => model.id)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))

    return NextResponse.json({ models: modelIds })
  } catch (error) {
    console.error('[AI Integration] Error listing models:', error)
    return NextResponse.json({ error: 'Failed to list AI models' }, { status: 500 })
  }
})
