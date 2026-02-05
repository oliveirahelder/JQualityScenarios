import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { parseStringPromise } from 'xml2js'
import type { JiraCredentials } from '@/lib/jira-config'
import { generateJsonWithOpenAI } from '@/lib/ai-client'

interface JiraDetails {
  id: string
  summary: string
  description?: string
  status?: string
  assignee?: string
  comments?: string
  attachments?: string[]
  pullRequests?: Array<{
    url?: string | null
    title?: string | null
    notes?: string | null
  }>
  relatedTickets?: string[]
}

export type ManualScenario = {
  id?: string
  testScenario: string
  executionSteps: string[]
  expectedResult: string
  actualResult?: string
  notes?: string
}

export type GeneratedScenarios = {
  gherkin: string[]
  manual: ManualScenario[]
}

type AdfNode = {
  type?: string
  text?: string
  content?: AdfNode[]
}

const extractAdfText = (node: AdfNode | string | null | undefined): string => {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (node.type === 'text') return node.text || ''
  if (!node.content || node.content.length === 0) return ''

  const parts = node.content.map(extractAdfText).filter(Boolean)
  if (node.type === 'paragraph') return `${parts.join('')}\n`
  if (node.type === 'bulletList' || node.type === 'orderedList') return `${parts.join('\n')}\n`
  if (node.type === 'listItem') return `- ${parts.join('')}`
  return parts.join('')
}

export async function fetchJiraTicket(
  ticketId: string,
  credentials?: JiraCredentials
): Promise<JiraDetails> {
  const baseUrl = credentials?.baseUrl || process.env.JIRA_BASE_URL
  const user = credentials?.user || process.env.JIRA_USER
  const token = credentials?.token || process.env.JIRA_API_TOKEN
  const authType = credentials?.authType || 'basic'
  const deployment = credentials?.deployment || 'cloud'
  const apiVersion = deployment === 'datacenter' ? '2' : '3'

  if (!baseUrl || !token || (authType === 'basic' && !user)) {
    throw new Error('Jira credentials not configured')
  }

  try {
    const response = await axios.get(
      `${baseUrl}/rest/api/${apiVersion}/issue/${ticketId}`,
      {
        auth:
          authType === 'basic'
            ? {
                username: user as string,
                password: token,
              }
            : undefined,
        headers:
          authType === 'oauth' || authType === 'bearer'
            ? {
                Authorization: `Bearer ${token}`,
              }
            : undefined,
      }
    )

    const issue = response.data

    type JiraComment = { body?: AdfNode | string }
    type JiraIssueLink = { outwardIssue?: { key?: string } }

    const description = extractAdfText(issue.fields.description).trim()
    const commentsText = issue.fields.comment?.comments
      ?.map((c: JiraComment) => extractAdfText(c.body).trim())
      .filter(Boolean)
      .join('\n')

    return {
      id: issue.key,
      summary: issue.fields.summary,
      description,
      status: issue.fields.status?.name,
      assignee: issue.fields.assignee?.displayName,
      comments: commentsText,
      attachments: Array.isArray(issue.fields.attachment)
        ? issue.fields.attachment
            .map((attachment: { filename?: string }) => attachment?.filename)
            .filter((filename: string | undefined): filename is string => Boolean(filename))
        : [],
      relatedTickets: issue.fields.issuelinks?.map((link: JiraIssueLink) => link.outwardIssue?.key),
    }
  } catch (error) {
    console.error('Error fetching Jira ticket:', error)
    throw new Error(`Failed to fetch Jira ticket: ${ticketId}`)
  }
}

export async function parseJiraXml(xmlText: string): Promise<JiraDetails[]> {
  try {
    const parsed = await parseStringPromise(xmlText)
    const items = parsed.rss?.channel?.[0]?.item || []

    type JiraXmlItem = Record<string, string[]>
    return items.map((item: JiraXmlItem) => ({
      id: item.key?.[0] || uuidv4(),
      summary: item.summary?.[0] || item.title?.[0] || '',
      description: item.description?.[0] || '',
      status: item.status?.[0],
      assignee: item.assignee?.[0],
    }))
  } catch (error) {
    console.error('Error parsing Jira XML:', error)
    throw new Error('Invalid Jira XML format')
  }
}

export async function generateScenariosWithAI(
  ticketDetails: JiraDetails,
  confluenceContext?: string,
  aiConfig?: {
    apiKey?: string | null
    model?: string | null
    baseUrl?: string | null
    maxTokens?: number | null
  }
): Promise<GeneratedScenarios> {
  try {
    const systemPrompt = `You are an expert QA analyst focused on manual functional testing and BDD automation.
Generate:
1) Manual QA test cases focused on functional validation, written for human execution.
2) BDD scenarios in Gherkin format (Given/When/Then) that mirror the manual tests.
Focus on functional behavior only. Avoid layout/visual/UI styling checks unless the ticket explicitly changes UI.
Prioritize business rules, data validation, state transitions, edge cases, and integrations impacted by the change.
Use acceptance criteria if present in description or comments; if impacts/risks are mentioned, include them in Notes.
Do not invent features (no sorting/filtering/layout tests unless explicitly mentioned).
Test scenarios must align with the ticket request and any comments from dev/product.
Focus on realistic QA manual testing steps. Use clear and concise action/verification steps.
Manual scenarios must be specific to this ticket (use domain terms, thresholds, and rules from the description/comments).
Always return 4-8 manual scenarios (do not leave manual empty).
Gherkin scenarios must be 1:1 with manual scenarios.
Return ONLY valid JSON in this exact shape:
{
  "manual": [
    {
      "id": "FT-01",
      "testScenario": "Short scenario title",
      "executionSteps": ["Step 1", "Step 2"],
      "expectedResult": "Expected outcome",
      "notes": "Optional notes or known issues"
    }
  ],
  "gherkin": [
    "Scenario: ...\\nGiven ...\\nWhen ...\\nThen ..."
  ]
}
Do not include markdown fences or extra text. Generate 4-8 scenarios.`

    const userContent = `
Ticket ID: ${ticketDetails.id}
Title: ${ticketDetails.summary}
Description: ${ticketDetails.description || 'No description provided'}
Status: ${ticketDetails.status || 'Unknown'}
Comments: ${ticketDetails.comments || 'None'}
Attachments: ${
      ticketDetails.attachments && ticketDetails.attachments.length > 0
        ? ticketDetails.attachments.join(', ')
        : 'None'
    }
${confluenceContext ? `\nRelated Documentation:\n${confluenceContext}` : ''}

Please generate test scenarios for this ticket.`

    const resolvedMaxTokens =
      typeof aiConfig?.maxTokens === 'number' && Number.isFinite(aiConfig.maxTokens)
        ? aiConfig.maxTokens
        : 1024
    const content = await generateJsonWithOpenAI({
      system: systemPrompt,
      user: userContent,
      maxTokens: resolvedMaxTokens,
      temperature: 0.2,
      apiKey: aiConfig?.apiKey || undefined,
      model: aiConfig?.model || undefined,
      baseUrl: aiConfig?.baseUrl || undefined,
    })

    const normalizeString = (value: unknown) =>
      typeof value === 'string' ? value.trim() : ''

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

    const normalizeExecutionSteps = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value
          .map((step) => (typeof step === 'string' ? step.trim() : ''))
          .filter(Boolean)
      }
      if (typeof value === 'string') {
        return value
          .split(/\r?\n+/)
          .map((step) => step.replace(/^\d+\.\s*/, '').trim())
          .filter(Boolean)
      }
      return []
    }

    const normalizeManualScenario = (
      input: Record<string, unknown>,
      index: number
    ): ManualScenario | null => {
      const id = normalizeString(input.id) || `FT-${String(index + 1).padStart(2, '0')}`
      const testScenario =
        normalizeString(input.testScenario) ||
        normalizeString(input.title) ||
        normalizeString(input.scenario)
      const executionSteps = normalizeExecutionSteps(
        input.executionSteps ?? input.steps ?? input.step
      )
      const expectedResult =
        normalizeString(input.expectedResult) || normalizeString(input.expected)
      const actualResult =
        normalizeString(input.actualResult) || normalizeString(input.actual)
      const notes = normalizeString(input.notes) || normalizeString(input.note)

      if (!testScenario && executionSteps.length === 0 && !expectedResult) {
        return null
      }

      return {
        id,
        testScenario: testScenario || `Scenario ${index + 1}`,
        executionSteps,
        expectedResult,
        actualResult: actualResult || undefined,
        notes: notes || undefined,
      }
    }

    const normalizeManualScenarios = (value: unknown): ManualScenario[] => {
      if (!value) return []
      if (Array.isArray(value)) {
        return value
          .map((entry, index) =>
            entry && typeof entry === 'object'
              ? normalizeManualScenario(entry as Record<string, unknown>, index)
              : null
          )
          .filter((entry): entry is ManualScenario => Boolean(entry))
      }
      if (value && typeof value === 'object') {
        if (Array.isArray((value as Record<string, unknown>).scenarios)) {
          return normalizeManualScenarios((value as Record<string, unknown>).scenarios)
        }
        const single = normalizeManualScenario(value as Record<string, unknown>, 0)
        return single ? [single] : []
      }
      return []
    }

    const normalizeGherkinScenarios = (value: unknown): string[] => {
      if (!value) return []
      if (Array.isArray(value)) {
        return value
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter(Boolean)
      }
      if (typeof value === 'string') {
        return value.trim() ? [value.trim()] : []
      }
      if (value && typeof value === 'object') {
        const nested = (value as Record<string, unknown>).scenarios
        return normalizeGherkinScenarios(nested)
      }
      return []
    }

    const parseScenariosFromContent = (raw: string): GeneratedScenarios | null => {
      const candidate = extractJsonObject(raw) || raw.trim()
      if (!candidate) return null

      const tryParse = (value: string): GeneratedScenarios | null => {
        const parsed = JSON.parse(value) as Record<string, unknown>
        const manual = normalizeManualScenarios(
          parsed.manual ?? parsed.manualScenarios ?? parsed.testCases
        )
        const gherkin = normalizeGherkinScenarios(
          parsed.gherkin ?? parsed.gherkinScenarios ?? parsed.gherkinScenariosText
        )
        if (manual.length === 0 && gherkin.length === 0) {
          return null
        }
        return { gherkin, manual }
      }

      try {
        return tryParse(candidate)
      } catch (parseError) {
        const repaired = repairJsonString(candidate)
        if (repaired !== candidate) {
          try {
            return tryParse(repaired)
          } catch (repairError) {
            console.error('Error parsing AI JSON after repair:', repairError)
          }
        }
        console.error('Error parsing AI JSON:', parseError)
        return null
      }
    }

    const parsed = parseScenariosFromContent(content)
    if (parsed) {
      return parsed
    }

    return { gherkin: [content], manual: [] }
  } catch (error) {
    console.error('Error generating scenarios with AI:', error)
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Unknown error'
    throw new Error(`Failed to generate test scenarios: ${message}`)
  }
}
