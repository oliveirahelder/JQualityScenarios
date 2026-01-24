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
  relatedTickets?: string[]
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

    type JiraComment = {
      body?: { content?: Array<{ content?: Array<{ text?: string }> }> }
    }
    type JiraIssueLink = { outwardIssue?: { key?: string } }

    return {
      id: issue.key,
      summary: issue.fields.summary,
      description: issue.fields.description?.content?.[0]?.content?.[0]?.text || '',
      status: issue.fields.status?.name,
      assignee: issue.fields.assignee?.displayName,
      comments: issue.fields.comment?.comments
        ?.map((c: JiraComment) => c.body?.content?.[0]?.content?.[0]?.text || '')
        .join('\n'),
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
): Promise<string[]> {
  const openaiKey = process.env.OPENAI_API_KEY

  if (!openaiKey) {
    throw new Error('OpenAI API key not configured')
  }

  try {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: openaiKey })

    const systemPrompt = `You are an expert QA engineer specializing in test scenario creation. 
Generate comprehensive BDD (Behavior-Driven Development) test scenarios in Gherkin format based on the ticket information provided.
Each scenario should be clear, testable, and follow the "Given-When-Then" structure.
Generate between 3-5 realistic test scenarios that cover the main functionality and edge cases.
Return scenarios as a JSON array of strings.`

    const userContent = `
Ticket ID: ${ticketDetails.id}
Title: ${ticketDetails.summary}
Description: ${ticketDetails.description || 'No description provided'}
Status: ${ticketDetails.status || 'Unknown'}
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

    // Parse JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return [content]
    }

    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error('Error generating scenarios with AI:', error)
    throw new Error('Failed to generate test scenarios')
  }
}
