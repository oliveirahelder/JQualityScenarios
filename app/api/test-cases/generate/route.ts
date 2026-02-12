import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'
import { fetchJiraTicket } from '@/lib/jira-service'
import { generateJsonWithOpenAI } from '@/lib/ai-client'

type AiScenario = {
  title?: string
  steps?: string[] | string
  expectedResult?: string
  notes?: string
}

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const normalizeSteps = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((step) => String(step).trim()).filter(Boolean).join('\n')
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n+/)
      .map((step) => step.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

const extractJsonObject = (raw: string) => {
  const start = raw.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (char === '\\') {
        escape = true
        continue
      }
      if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') {
      depth += 1
      continue
    }
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return raw.slice(start, i + 1)
      }
    }
  }
  return null
}

const repairJsonString = (raw: string) => {
  let output = ''
  let inString = false
  let escape = false
  for (const char of raw) {
    if (inString) {
      if (escape) {
        output += char
        escape = false
        continue
      }
      if (char === '\\') {
        output += char
        escape = true
        continue
      }
      if (char === '"') {
        inString = false
        output += char
        continue
      }
      if (char === '\n' || char === '\r') {
        output += '\\n'
        continue
      }
      output += char
      continue
    }
    if (char === '"') {
      inString = true
      output += char
      continue
    }
    output += char
  }
  return output.replace(/,\\s*([}\\]])/g, '$1')
}

export const POST = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const payload = req.user
    const { teamKey, theme, targetTicketId, includeDocs, caseIds, sourceJiraIds } = await req.json()

    if (!teamKey || !theme || !targetTicketId) {
      return NextResponse.json(
        { error: 'teamKey, theme, and targetTicketId are required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const adminSettings = await prisma.adminSettings.findFirst()
    const jiraCredentials = buildJiraCredentialsFromUser(
      user,
      adminSettings?.jiraBaseUrl || null
    )
    if (!jiraCredentials) {
      return NextResponse.json(
        { error: 'Jira integration not configured' },
        { status: 400 }
      )
    }

    const jiraDetails = await fetchJiraTicket(targetTicketId, jiraCredentials)

    const selectedCaseIds: string[] = Array.isArray(caseIds)
      ? caseIds.filter((id) => typeof id === 'string' && id)
      : []
    const selectedSourceJiraIds: string[] = Array.isArray(sourceJiraIds)
      ? sourceJiraIds.filter((id) => typeof id === 'string' && id)
      : []

    const historicalCases = selectedCaseIds.length
      ? await prisma.testCase.findMany({
          where: { id: { in: selectedCaseIds }, teamKey },
          include: { scenarios: { orderBy: { sortOrder: 'asc' } } },
        })
      : []

    const docs = includeDocs
      ? await prisma.documentationDraft.findMany({
          where: {
            OR: [
              { title: { contains: theme } },
              { content: { contains: theme } },
            ],
          },
          take: 3,
          select: { title: true, content: true },
        })
      : []

    const historyContext = historicalCases.length
      ? historicalCases
          .map((testCase) => {
            const scenarios = testCase.scenarios
              .map((scenario, index) => {
                const steps = scenario.steps.split('\n').slice(0, 3).join(' | ')
                return `${index + 1}. ${scenario.title} - Steps: ${steps}${
                  scenario.expectedResult ? ` - Expected: ${scenario.expectedResult}` : ''
                }`
              })
              .join('\n')
            return `Theme: ${testCase.theme}\nPrerequisites: ${testCase.prerequisites}\nObjective: ${testCase.objective}\nScenarios:\n${scenarios}`
          })
          .join('\n\n')
      : ''

    const sourceTickets = selectedSourceJiraIds.length
      ? await prisma.testCaseSourceTicket.findMany({
          where: {
            teamKey,
            jiraId: { in: selectedSourceJiraIds },
          },
        })
      : []

    const sourceContext = sourceTickets.length
      ? sourceTickets
          .map((ticket) => {
            const description = ticket.description?.trim()
            const comments = ticket.comments?.trim()
            return `Ticket ${ticket.jiraId}: ${ticket.summary}
Status: ${ticket.status || 'Unknown'}
Components: ${ticket.components || 'None'}
Application: ${ticket.application || 'None'}
Description: ${description || 'None'}
Comments: ${comments || 'None'}`
          })
          .join('\n\n')
      : ''

    const docsContext = docs.length
      ? docs
          .map((draft) => {
            const content = draft.content.length > 800 ? `${draft.content.slice(0, 800)}...` : draft.content
            return `Doc: ${draft.title}\n${content}`
          })
          .join('\n\n')
      : ''

    const systemPrompt = `You are a senior QA analyst.
Build a reusable test case based on the target ticket plus historical test cases and documentation.
Return ONLY valid JSON with this shape:
{
  "prerequisites": "text",
  "objective": "text",
  "scenarios": [
    {
      "title": "Scenario title",
      "steps": ["Step 1", "Step 2"],
      "expectedResult": "Expected outcome",
      "notes": "Optional notes"
    }
  ]
}
Focus on functional behavior. Use acceptance criteria and comments if available.
Scenarios must be realistic for manual QA execution.`

    const userPrompt = `Team: ${teamKey}
Theme: ${theme}
Target ticket:
- ID: ${jiraDetails.id}
- Title: ${jiraDetails.summary}
- Description: ${jiraDetails.description || 'No description provided'}
- Comments: ${jiraDetails.comments || 'None'}

Historical test cases:
${historyContext || 'None'}

Historical tickets:
${sourceContext || 'None'}

Documentation context:
${docsContext || 'None'}
`

    const aiConfig = {
      apiKey: user.openaiApiKey || undefined,
      model: user.openaiModel || undefined,
      baseUrl: adminSettings?.aiBaseUrl || null,
      maxTokens:
        typeof adminSettings?.aiMaxTokens === 'number' && Number.isFinite(adminSettings.aiMaxTokens)
          ? adminSettings.aiMaxTokens
          : undefined,
    }

    const raw = await generateJsonWithOpenAI({
      system: systemPrompt,
      user: userPrompt,
      strictJson: true,
      temperature: 0.2,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      baseUrl: aiConfig.baseUrl,
      maxTokens: aiConfig.maxTokens,
    })

    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      const extracted = extractJsonObject(raw)
      if (!extracted) {
        throw error
      }
      parsed = JSON.parse(repairJsonString(extracted))
    }

    const scenarios = Array.isArray(parsed?.scenarios)
      ? parsed.scenarios.map((scenario: AiScenario) => ({
          title: normalizeString(scenario.title) || 'Scenario',
          steps: normalizeSteps(scenario.steps),
          expectedResult: normalizeString(scenario.expectedResult),
          notes: normalizeString(scenario.notes),
        }))
      : []

    if (scenarios.length === 0) {
      return NextResponse.json(
        { error: 'AI response did not include scenarios' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      testCase: {
        prerequisites: normalizeString(parsed?.prerequisites) || 'Define prerequisites.',
        objective: normalizeString(parsed?.objective) || `Validate ${theme}`,
        scenarios,
      },
    })
  } catch (error) {
    console.error('Error generating test case:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate test case' },
      { status: 500 }
    )
  }
})
