import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

type ScenarioInput = {
  title?: string
  steps?: string | string[]
  expectedResult?: string
  notes?: string
}

type TicketInput = {
  jiraId?: string
  summary?: string
}

const MAX_LIMIT = 200

const parseTags = (value?: string | string[] | null) => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((tag) => tag.trim()).filter(Boolean)
  }
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

const normalizeSteps = (steps?: string | string[]) => {
  if (!steps) return ''
  if (Array.isArray(steps)) {
    return steps.map((step) => step.trim()).filter(Boolean).join('\n')
  }
  return steps.trim()
}

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const { searchParams } = new URL(req.url)
    const testCaseId = searchParams.get('id')?.trim()
    const teamKey = searchParams.get('teamKey')?.trim() || undefined
    const query = searchParams.get('q')?.trim()
    const limitParam = searchParams.get('limit')
    const includeScenarios = searchParams.get('includeScenarios') === '1'
    const limit = Math.min(
      Math.max(limitParam ? Number.parseInt(limitParam, 10) : 50, 1),
      MAX_LIMIT
    )

    const where: Record<string, any> = {}
    if (testCaseId) {
      where.id = testCaseId
    }
    if (teamKey) {
      where.teamKey = teamKey
    }
    if (query) {
      where.OR = [
        { theme: { contains: query } },
        { tags: { contains: query } },
      ]
    }

    const testCases = await prisma.testCase.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        scenarios: includeScenarios
          ? { orderBy: { sortOrder: 'asc' } }
          : { select: { id: true } },
        tickets: {
          select: { id: true, jiraId: true, summary: true, ticketId: true },
        },
      },
    })

    const normalized = testCases.map((testCase) => ({
      ...testCase,
      tagsList: parseTags(testCase.tags),
      scenarios: includeScenarios ? testCase.scenarios : undefined,
      scenariosCount: testCase.scenarios.length,
      ticketsCount: testCase.tickets.length,
    }))

    return NextResponse.json({ testCases: normalized })
  } catch (error) {
    console.error('Error fetching test cases:', error)
    return NextResponse.json({ error: 'Failed to load test cases' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user
    const body = await req.json()
    const teamKey = body.teamKey?.trim()
    const theme = body.theme?.trim()
    const prerequisites = body.prerequisites?.trim()
    const objective = body.objective?.trim()
    const tagsList = parseTags(body.tags)
    const scenariosInput: ScenarioInput[] = Array.isArray(body.scenarios) ? body.scenarios : []
    const ticketsInput: TicketInput[] = Array.isArray(body.tickets) ? body.tickets : []

    if (!teamKey || !theme || !prerequisites || !objective) {
      return NextResponse.json(
        { error: 'teamKey, theme, prerequisites, and objective are required' },
        { status: 400 }
      )
    }

    const scenarios = scenariosInput
      .map((scenario, index) => ({
        title: scenario.title?.trim() || '',
        steps: normalizeSteps(scenario.steps),
        expectedResult: scenario.expectedResult?.trim() || null,
        notes: scenario.notes?.trim() || null,
        sortOrder: index,
      }))
      .filter((scenario) => scenario.title && scenario.steps)

    if (scenarios.length === 0) {
      return NextResponse.json(
        { error: 'At least one test scenario with title and steps is required' },
        { status: 400 }
      )
    }

    const uniqueTickets = Array.from(
      new Map(
        ticketsInput
          .filter((ticket) => ticket?.jiraId)
          .map((ticket) => [ticket.jiraId as string, ticket])
      ).values()
    )

    const jiraIds = uniqueTickets.map((ticket) => ticket.jiraId as string)
    const linkedTickets = jiraIds.length
      ? await prisma.ticket.findMany({
          where: { jiraId: { in: jiraIds } },
          select: { id: true, jiraId: true },
        })
      : []
    const ticketMap = new Map(linkedTickets.map((ticket) => [ticket.jiraId, ticket.id]))

    const testCase = await prisma.testCase.create({
      data: {
        teamKey,
        theme,
        tags: tagsList.length ? tagsList.join(', ') : null,
        prerequisites,
        objective,
        userId: payload.userId,
        scenarios: {
          create: scenarios,
        },
        tickets: {
          create: uniqueTickets.map((ticket) => ({
            jiraId: ticket.jiraId as string,
            summary: ticket.summary?.trim() || null,
            ticketId: ticketMap.get(ticket.jiraId as string) || undefined,
          })),
        },
      },
      include: {
        scenarios: { orderBy: { sortOrder: 'asc' } },
        tickets: true,
      },
    })

    return NextResponse.json({ testCase }, { status: 201 })
  } catch (error) {
    console.error('Error creating test case:', error)
    return NextResponse.json({ error: 'Failed to create test case' }, { status: 500 })
  }
})
