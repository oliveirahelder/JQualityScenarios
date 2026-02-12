import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'
import { buildJiraCredentialsFromUser } from '@/lib/jira-config'

const normalizeFieldName = (value: string) => value.trim().toLowerCase()

export const GET = withAuth(async (req: NextRequest & { user?: any }) => {
  try {
    const fieldParam = req.nextUrl.searchParams.get('field') || ''
    const projectKey = req.nextUrl.searchParams.get('projectKey') || 'JMIA'
    if (!fieldParam.trim()) {
      return NextResponse.json({ error: 'Field name or id is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const adminSettings = await prisma.adminSettings.findFirst()
    const credentials = buildJiraCredentialsFromUser(user, adminSettings?.jiraBaseUrl || null)
    if (!credentials) {
      return NextResponse.json({ error: 'Jira integration not configured' }, { status: 400 })
    }

    const apiVersion = credentials.deployment === 'datacenter' ? '2' : '3'
    let fieldId = fieldParam.trim()

    if (!fieldId.startsWith('customfield_')) {
      const fieldsResponse = await axios.get(
        `${credentials.baseUrl}/rest/api/${apiVersion}/field`,
        {
          auth:
            credentials.authType === 'basic'
              ? {
                  username: credentials.user as string,
                  password: credentials.token,
                }
              : undefined,
          headers:
            credentials.authType === 'oauth' || credentials.authType === 'bearer'
              ? { Authorization: `Bearer ${credentials.token}` }
              : undefined,
        }
      )
      const fields = Array.isArray(fieldsResponse.data) ? fieldsResponse.data : []
      const match = fields.find(
        (field: any) => normalizeFieldName(field?.name || '') === normalizeFieldName(fieldParam)
      )
      if (match?.id) {
        fieldId = match.id
      }
    }

    const options = new Set<string>()
    try {
      const createmetaResponse = await axios.get(
        `${credentials.baseUrl}/rest/api/${apiVersion}/issue/createmeta`,
        {
          params: {
            projectKeys: projectKey,
            expand: 'projects.issuetypes.fields',
          },
          auth:
            credentials.authType === 'basic'
              ? {
                  username: credentials.user as string,
                  password: credentials.token,
                }
              : undefined,
          headers:
            credentials.authType === 'oauth' || credentials.authType === 'bearer'
              ? { Authorization: `Bearer ${credentials.token}` }
              : undefined,
        }
      )

      const projects = createmetaResponse.data?.projects || []
      for (const project of projects) {
        const issueTypes = project?.issuetypes || []
        for (const issueType of issueTypes) {
          const fields = issueType?.fields || {}
          const field = fields[fieldId] || fields[fieldParam] || null
          if (!field?.allowedValues) continue
          for (const option of field.allowedValues) {
            const value = option?.value ?? option?.name
            if (typeof value === 'string' && value.trim()) {
              options.add(value.trim())
            }
          }
        }
      }
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      console.warn('[Jira Field Options] createmeta failed, falling back to search:', status)
    }

    if (options.size === 0) {
      const fieldForJql = fieldId.startsWith('customfield_') ? fieldId : formatJqlField(fieldParam)
      const issues: any[] = []
      let startAt = 0
      const maxResults = 100
      const maxFetch = 500
      let total = 0
      do {
        const response = await axios.get(
          `${credentials.baseUrl}/rest/api/${apiVersion}/search`,
          {
            params: {
              jql: `project = ${projectKey} AND ${fieldForJql} is not EMPTY`,
              startAt,
              maxResults,
              fields: fieldId,
            },
            auth:
              credentials.authType === 'basic'
                ? {
                    username: credentials.user as string,
                    password: credentials.token,
                  }
                : undefined,
            headers:
              credentials.authType === 'oauth' || credentials.authType === 'bearer'
                ? { Authorization: `Bearer ${credentials.token}` }
                : undefined,
          }
        )
        const fetched = response.data?.issues || []
        issues.push(...fetched)
        total = response.data?.total ?? issues.length
        startAt += fetched.length
        if (fetched.length === 0) break
      } while (issues.length < total && issues.length < maxFetch)

      for (const issue of issues) {
        const raw = issue?.fields ? issue.fields[fieldId] : null
        if (Array.isArray(raw)) {
          for (const entry of raw) {
            const value = entry?.value ?? entry?.name ?? entry
            if (typeof value === 'string' && value.trim()) {
              options.add(value.trim())
            }
          }
          continue
        }
        if (raw && typeof raw === 'object') {
          const value = raw.value ?? raw.name
          if (typeof value === 'string' && value.trim()) {
            options.add(value.trim())
          }
          continue
        }
        if (typeof raw === 'string' && raw.trim()) {
          options.add(raw.trim())
        }
      }
    }

    const values = Array.from(options).sort((a, b) => a.localeCompare(b))
    return NextResponse.json({
      field: fieldParam,
      fieldId,
      projectKey,
      total: values.length,
      values,
    })
  } catch (error) {
    console.error('[Jira Field Options] Error fetching field options:', error)
    return NextResponse.json({ error: 'Failed to fetch Jira field options' }, { status: 500 })
  }
})
