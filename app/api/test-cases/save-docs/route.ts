import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withRole } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

type ScenarioInput = {
  title?: string
  steps?: string
  expectedResult?: string | null
  notes?: string | null
}

const QA_HISTORY_JIRA_ID = 'QA_HISTORY'
const QA_HISTORY_NAME = 'QA History'
const QA_HISTORY_DATE = new Date('2000-01-01T00:00:00.000Z')

const buildManualTemplate = (scenarios: ScenarioInput[]) => {
  const header =
    '||ID||Test Scenario||Execution Steps||Expected Result||Actual Result||Notes||Attachments||'
  const rows = scenarios.map((scenario, index) => {
    const id = `FT-${String(index + 1).padStart(2, '0')}`
    const steps = (scenario.steps || '')
      .split(/\r?\n+/)
      .map((step) => step.trim())
      .filter(Boolean)
      .join('\n')
    const expected = (scenario.expectedResult || '').trim()
    const notes = (scenario.notes || '').trim()
    const title = (scenario.title || '').trim() || `Scenario ${index + 1}`
    return `|${id}|${title}|${steps}|${expected}||${notes}||`
  })
  return [header, ...rows].join('\n')
}

const buildContent = (params: {
  theme: string
  targetTicketId: string
  prerequisites?: string
  objective?: string
  scenarios: ScenarioInput[]
}) => {
  const lines = [
    `# Regression pack - ${params.theme}`,
    '',
    `Target ticket: ${params.targetTicketId}`,
  ]
  if (params.prerequisites?.trim()) {
    lines.push('', '## Prerequisites', params.prerequisites.trim())
  }
  if (params.objective?.trim()) {
    lines.push('', '## Test case objective', params.objective.trim())
  }
  if (params.scenarios.length > 0) {
    lines.push('', '## Scenarios')
    params.scenarios.forEach((scenario, index) => {
      const title = scenario.title?.trim() || `Scenario ${index + 1}`
      lines.push(`- ${title}`)
    })
  }
  return lines.join('\n')
}

export const POST = withAuth(
  withRole('QA', 'ADMIN')(async (req: NextRequest & { user?: any }) => {
    try {
      const payload = req.user
      const body = await req.json()
      const targetTicketId = String(body.targetTicketId || '').trim()
      const theme = String(body.theme || '').trim()
      const prerequisites = String(body.prerequisites || '').trim()
      const objective = String(body.objective || '').trim()
      const scenarios = Array.isArray(body.scenarios) ? body.scenarios : []

      if (!targetTicketId || !theme) {
        return NextResponse.json(
          { error: 'targetTicketId and theme are required' },
          { status: 400 }
        )
      }

      const preparedScenarios = scenarios
        .map((scenario: ScenarioInput) => ({
          title: scenario?.title || '',
          steps: scenario?.steps || '',
          expectedResult: scenario?.expectedResult || '',
          notes: scenario?.notes || '',
        }))
        .filter((scenario: ScenarioInput) => scenario.title || scenario.steps)

      if (preparedScenarios.length === 0) {
        return NextResponse.json(
          { error: 'Provide at least one scenario before saving.' },
          { status: 400 }
        )
      }

      const qaSprint = await prisma.sprint.upsert({
        where: { jiraId: QA_HISTORY_JIRA_ID },
        update: { name: QA_HISTORY_NAME },
        create: {
          jiraId: QA_HISTORY_JIRA_ID,
          name: QA_HISTORY_NAME,
          startDate: QA_HISTORY_DATE,
          endDate: QA_HISTORY_DATE,
          completedAt: QA_HISTORY_DATE,
          status: 'COMPLETED',
        },
      })

      let ticket = await prisma.ticket.findUnique({
        where: { jiraId: targetTicketId },
      })

      if (!ticket) {
        const sourceTicket = await prisma.testCaseSourceTicket.findUnique({
          where: { jiraId: targetTicketId },
        })
        ticket = await prisma.ticket.create({
          data: {
            jiraId: targetTicketId,
            sprintId: qaSprint.id,
            summary: sourceTicket?.summary || theme || targetTicketId,
            description: sourceTicket?.description || null,
            status: sourceTicket?.status || 'UNKNOWN',
          },
        })
      }

      const content = buildContent({
        theme,
        targetTicketId,
        prerequisites,
        objective,
        scenarios: preparedScenarios,
      })
      const testResults = buildManualTemplate(preparedScenarios)

      const draft = await prisma.documentationDraft.upsert({
        where: { ticketId: ticket.id },
        update: {
          title: theme,
          content,
          requirements: prerequisites || null,
          technicalNotes: objective || null,
          testResults,
        },
        create: {
          sprintId: ticket.sprintId,
          ticketId: ticket.id,
          userId: payload.userId,
          title: theme,
          content,
          requirements: prerequisites || null,
          technicalNotes: objective || null,
          testResults,
          status: 'DRAFT',
        },
        include: {
          ticket: true,
          sprint: true,
          linkedTickets: { include: { ticket: true } },
        },
      })

      return NextResponse.json({ draft }, { status: 201 })
    } catch (error) {
      console.error('Error saving regression pack to docs:', error)
      return NextResponse.json(
        { error: 'Failed to save regression pack to docs' },
        { status: 500 }
      )
    }
  })
)
