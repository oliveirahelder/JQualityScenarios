import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import pdfParse from 'pdf-parse'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const MAX_FILES = 5

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user
    const { searchParams } = new URL(req.url)
    const ticketId = searchParams.get('ticketId')

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 })
    }

    const attachments = await prisma.documentationAttachment.findMany({
      where: { jiraId: ticketId, userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        size: true,
        mimeType: true,
        createdAt: true,
        textContent: true,
      },
    })

    return NextResponse.json({
      attachments: attachments.map((attachment) => ({
        ...attachment,
        hasText: Boolean(attachment.textContent),
        textContent: undefined,
      })),
    })
  } catch (error) {
    console.error('[Attachments] Error fetching attachments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user
    const formData = await req.formData()
    const ticketId = formData.get('ticketId')
    const file = formData.get('file')

    if (!ticketId || typeof ticketId !== 'string') {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 })
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'PDF exceeds 20MB limit' },
        { status: 400 }
      )
    }

    const existingCount = await prisma.documentationAttachment.count({
      where: { jiraId: ticketId, userId: payload.userId },
    })
    if (existingCount >= MAX_FILES) {
      return NextResponse.json(
        { error: 'Maximum of 5 attachments reached' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let textContent: string | null = null

    try {
      const parsed = await pdfParse(buffer)
      textContent = parsed.text?.trim() || null
    } catch (error) {
      console.warn('[Attachments] Failed to extract PDF text:', error)
    }

    const ticket = await prisma.ticket.findUnique({
      where: { jiraId: ticketId },
      select: { id: true },
    })

    const attachment = await prisma.documentationAttachment.create({
      data: {
        jiraId: ticketId,
        ticketId: ticket?.id || null,
        userId: payload.userId,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        content: buffer,
        textContent,
      },
      select: {
        id: true,
        filename: true,
        size: true,
        mimeType: true,
        createdAt: true,
        textContent: true,
      },
    })

    return NextResponse.json({
      attachment: {
        ...attachment,
        hasText: Boolean(attachment.textContent),
        textContent: undefined,
      },
    })
  } catch (error) {
    console.error('[Attachments] Error saving attachment:', error)
    return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 })
  }
})
