import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'
import { backupUserSettings } from '@/lib/settings-backup'

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      model: user.openaiModel || process.env.OPENAI_MODEL || '',
      hasApiKey: Boolean(user.openaiApiKey),
      connectionStatus: user.openaiConnectionStatus || '',
      connectionCheckedAt: user.openaiConnectionCheckedAt?.toISOString() || '',
    })
  } catch (error) {
    console.error('[AI Integration] Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to load AI settings' }, { status: 500 })
  }
})

export const PUT = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { apiKey, model } = await req.json()
    const updateData: {
      openaiApiKey?: string | null
      openaiModel?: string | null
      openaiConnectionStatus?: string | null
      openaiConnectionCheckedAt?: Date | null
    } = {}

    if (typeof apiKey === 'string' && apiKey.trim()) {
      updateData.openaiApiKey = apiKey.trim()
    }
    if (typeof model === 'string' && model.trim()) {
      updateData.openaiModel = model.trim()
    }

    if (Object.keys(updateData).length > 0) {
      updateData.openaiConnectionStatus = null
      updateData.openaiConnectionCheckedAt = null
    }

    if (Object.keys(updateData).length > 0) {
      await backupUserSettings(user.id, {
        openaiModel: user.openaiModel,
        openaiHasApiKey: Boolean(user.openaiApiKey),
        openaiConnectionStatus: user.openaiConnectionStatus,
      })
      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[AI Integration] Error saving settings:', error)
    return NextResponse.json({ error: 'Failed to save AI settings' }, { status: 500 })
  }
})
