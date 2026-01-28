import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withRole } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (req: NextRequest & { user?: any }, { params }: { params: { draftId: string } }) => {
  try {
    const draft = await prisma.documentationDraft.findUnique({
      where: { id: params.draftId },
      include: {
        ticket: true,
        sprint: true,
        linkedTickets: { include: { ticket: true } },
      },
    })

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('Error fetching draft:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const PATCH = withAuth(async (req: NextRequest & { user?: any }, { params }: { params: { draftId: string } }) => {
  try {
    const {
      title,
      content,
      requirements,
      technicalNotes,
      testResults,
      status,
    } = await req.json()

    const draft = await prisma.documentationDraft.update({
      where: { id: params.draftId },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(requirements && { requirements }),
        ...(technicalNotes && { technicalNotes }),
        ...(testResults && { testResults }),
        ...(status && { status }),
      },
      include: {
        ticket: true,
        sprint: true,
        linkedTickets: { include: { ticket: true } },
      },
    })

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('Error updating draft:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (req: NextRequest & { user?: any }, { params }: { params: { draftId: string } }) => {
  try {
    const payload = req.user

    const draft = await prisma.documentationDraft.findUnique({
      where: { id: params.draftId },
      select: { id: true, userId: true },
    })

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    if (draft.userId !== payload.userId && payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.documentationDraft.delete({
      where: { id: params.draftId },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting draft:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
