import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { parseStringPromise } from 'xml2js'
import type { JiraCredentials } from '@/lib/jira-config'

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
  confluenceContext?: string
): Promise<GeneratedScenarios> {
  const openaiKey = process.env.OPENAI_API_KEY

  if (!openaiKey) {
    throw new Error('OpenAI API key not configured')
  }

  try {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: openaiKey })

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

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
    })

    const content = response.choices[0]?.message?.content?.trim() || ''
    if (!content) {
      throw new Error('Empty response from API')
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { gherkin: [content], manual: [] }
    }
    const parsed = JSON.parse(jsonMatch[0])
    const manual = Array.isArray(parsed.manual) ? parsed.manual : []
    const gherkin = Array.isArray(parsed.gherkin) ? parsed.gherkin : []
    return { gherkin, manual }
  } catch (error) {
    console.error('Error generating scenarios with AI:', error)
    throw new Error('Failed to generate test scenarios')
  }
}
