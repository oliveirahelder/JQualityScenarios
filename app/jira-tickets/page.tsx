'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function JiraTicketsPage() {
  const projectKey = 'JMIA'
  const [summary, setSummary] = useState('')
  const [issueType, setIssueType] = useState('Bug')
  const [description, setDescription] = useState('')
  const [lastTemplate, setLastTemplate] = useState('')
  const [labels, setLabels] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  const [confirmCreate, setConfirmCreate] = useState(false)
  const [templateInputs, setTemplateInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ key: string; url?: string } | null>(null)
  const [history, setHistory] = useState<
    {
      id: string
      jiraKey: string
      jiraUrl?: string
      summary: string
      issueType: string
      labels: string[]
      createdAt: string
    }[]
  >([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  type TemplateField = {
    key: string
    label: string
    placeholder: string
    multiline?: boolean
  }

  const templateFields: Record<string, TemplateField[]> = {
    Story: [
      { key: 'role', label: 'As a', placeholder: 'role / persona' },
      { key: 'goal', label: 'I want', placeholder: 'goal / capability' },
      { key: 'value', label: 'So that', placeholder: 'value / benefit' },
      {
        key: 'background',
        label: 'Background information',
        placeholder: 'context, constraints, dependencies',
        multiline: true,
      },
      {
        key: 'acceptance',
        label: 'Acceptance criteria (one per line)',
        placeholder: 'criterion 1',
        multiline: true,
      },
    ],
    Bug: [
      {
        key: 'steps',
        label: 'Steps to reproduce (one per line)',
        placeholder: 'step 1',
        multiline: true,
      },
      {
        key: 'actual',
        label: 'Actual result',
        placeholder: 'what happens',
        multiline: true,
      },
      {
        key: 'expected',
        label: 'Expected result',
        placeholder: 'what should happen',
        multiline: true,
      },
      {
        key: 'environment',
        label: 'Environment',
        placeholder: 'Browser/OS, URL',
        multiline: true,
      },
      {
        key: 'acceptance',
        label: 'Acceptance criteria (one per line)',
        placeholder: 'criterion 1',
        multiline: true,
      },
    ],
    Task: [
      { key: 'goal', label: 'Goal', placeholder: 'what needs to be done' },
      {
        key: 'details',
        label: 'Details',
        placeholder: 'notes / dependencies',
        multiline: true,
      },
      {
        key: 'acceptance',
        label: 'Acceptance criteria (one per line)',
        placeholder: 'criterion 1',
        multiline: true,
      },
    ],
    Epic: [
      { key: 'epicGoal', label: 'Epic goal', placeholder: 'high-level objective' },
      {
        key: 'scopeIn',
        label: 'In scope',
        placeholder: 'in scope items',
        multiline: true,
      },
      {
        key: 'scopeOut',
        label: 'Out of scope',
        placeholder: 'out of scope items',
        multiline: true,
      },
      {
        key: 'successCriteria',
        label: 'Success criteria',
        placeholder: 'metric / outcome',
        multiline: true,
      },
      {
        key: 'acceptance',
        label: 'Acceptance criteria (one per line)',
        placeholder: 'criterion 1',
        multiline: true,
      },
    ],
    'Product Task': [
      { key: 'objective', label: 'Objective', placeholder: 'business objective' },
      {
        key: 'businessValue',
        label: 'Business value',
        placeholder: 'impact / value',
        multiline: true,
      },
      {
        key: 'acceptance',
        label: 'Acceptance criteria (one per line)',
        placeholder: 'criterion 1',
        multiline: true,
      },
    ],
    Support: [
      { key: 'request', label: 'Request', placeholder: 'who needs help and why' },
      {
        key: 'impact',
        label: 'Customer impact',
        placeholder: 'impact',
        multiline: true,
      },
      {
        key: 'evidence',
        label: 'Details / evidence',
        placeholder: 'logs / screenshots / refs',
        multiline: true,
      },
      {
        key: 'acceptance',
        label: 'Acceptance criteria (one per line)',
        placeholder: 'criterion 1',
        multiline: true,
      },
    ],
    Spike: [
      { key: 'hypothesis', label: 'Hypothesis', placeholder: 'what we want to learn' },
      {
        key: 'questions',
        label: 'Questions to answer',
        placeholder: 'question 1',
        multiline: true,
      },
      {
        key: 'outcome',
        label: 'Outcome / decision',
        placeholder: 'result or recommendation',
        multiline: true,
      },
      {
        key: 'acceptance',
        label: 'Acceptance criteria (one per line)',
        placeholder: 'criterion 1',
        multiline: true,
      },
    ],
  }

  const hasAcceptanceCriteria = () => {
    const lines = (templateInputs.acceptance || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    return lines.length > 0
  }

  const formatCriteria = (value?: string) => {
    const lines = (value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) return ['- <criterion 1>']
    return lines.map((line) => `- ${line}`)
  }

  const formatNumbered = (value?: string) => {
    const lines = (value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) return ['1. <step>', '2. <step>']
    return lines.map((line, index) => `${index + 1}. ${line}`)
  }

  const buildTemplate = (type: string) => {
    switch (type) {
      case 'Story':
        return [
          '*User Story*',
          `*As a* ${templateInputs.role || '<role>'}`,
          `*I want* ${templateInputs.goal || '<goal>'}`,
          `*So that* ${templateInputs.value || '<value>'}`,
          '',
          '*Background information*',
          `- ${templateInputs.background || '<context / constraints>'}`,
          '',
          '*Acceptance criteria*',
          ...formatCriteria(templateInputs.acceptance),
        ].join('\n')
      case 'Bug':
        return [
          '*Steps to reproduce*',
          ...formatNumbered(templateInputs.steps),
          '',
          '*Actual result*',
          templateInputs.actual || '<what happens>',
          '',
          '*Expected result*',
          templateInputs.expected || '<what should happen>',
          '',
          '*Environment*',
          `- ${templateInputs.environment || 'Browser/OS, URL'}`,
          '',
          '*Acceptance criteria*',
          ...formatCriteria(templateInputs.acceptance),
        ].join('\n')
      case 'Task':
        return [
          '*Goal*',
          templateInputs.goal || '<what needs to be done>',
          '',
          '*Details*',
          `- ${templateInputs.details || '<notes / dependencies>'}`,
          '',
          '*Acceptance criteria*',
          ...formatCriteria(templateInputs.acceptance),
        ].join('\n')
      case 'Epic':
        return [
          '*Epic goal*',
          templateInputs.epicGoal || '<high-level objective>',
          '',
          '*Scope*',
          `- In scope: ${templateInputs.scopeIn || '<items>'}`,
          `- Out of scope: ${templateInputs.scopeOut || '<items>'}`,
          '',
          '*Success criteria*',
          `- ${templateInputs.successCriteria || '<metric / outcome>'}`,
          '',
          '*Acceptance criteria*',
          ...formatCriteria(templateInputs.acceptance),
        ].join('\n')
      case 'Product Task':
        return [
          '*Objective*',
          templateInputs.objective || '<business objective>',
          '',
          '*Business value*',
          `- ${templateInputs.businessValue || '<impact / value>'}`,
          '',
          '*Acceptance criteria*',
          ...formatCriteria(templateInputs.acceptance),
        ].join('\n')
      case 'Support':
        return [
          '*Request*',
          templateInputs.request || '<who needs help and why>',
          '',
          '*Customer impact*',
          `- ${templateInputs.impact || '<impact>'}`,
          '',
          '*Details / evidence*',
          `- ${templateInputs.evidence || '<logs / screenshots / refs>'}`,
          '',
          '*Acceptance criteria*',
          ...formatCriteria(templateInputs.acceptance),
        ].join('\n')
      case 'Spike':
        return [
          '*Hypothesis*',
          templateInputs.hypothesis || '<what we want to learn>',
          '',
          '*Questions to answer*',
          ...formatCriteria(templateInputs.questions),
          '',
          '*Outcome / decision*',
          `- ${templateInputs.outcome || '<result or recommendation>'}`,
          '',
          '*Acceptance criteria*',
          ...formatCriteria(templateInputs.acceptance),
        ].join('\n')
      default:
        return ''
    }
  }

  const handleApplyTemplate = () => {
    const fields = templateFields[issueType] || []
    const nextInputs = fields.reduce<Record<string, string>>((acc, field) => {
      acc[field.key] = ''
      return acc
    }, {})
    if (issueType === 'Story' && summary.trim()) {
      nextInputs.goal = summary.trim()
    }
    if (issueType === 'Task' && summary.trim()) {
      nextInputs.goal = summary.trim()
    }
    setTemplateInputs(nextInputs)
  }

  useEffect(() => {
    handleApplyTemplate()
  }, [issueType])

  useEffect(() => {
    const template = buildTemplate(issueType)
    setDescription(template)
    setLastTemplate(template)
  }, [issueType, templateInputs])

  useEffect(() => {
    if (!summary.trim()) return
    setTemplateInputs((prev) => {
      const next = { ...prev }
      if (issueType === 'Story' && !next.goal) next.goal = summary.trim()
      if (issueType === 'Task' && !next.goal) next.goal = summary.trim()
      if (issueType === 'Epic' && !next.epicGoal) next.epicGoal = summary.trim()
      if (issueType === 'Product Task' && !next.objective) next.objective = summary.trim()
      if (issueType === 'Support' && !next.request) next.request = summary.trim()
      if (issueType === 'Spike' && !next.hypothesis) next.hypothesis = summary.trim()
      return next
    })
  }, [summary, issueType])

  const loadHistory = async () => {
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/jira-tickets', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load history')
      }
      const data = await response.json()
      setHistory(Array.isArray(data.history) ? data.history : [])
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const handleNext = () => {
    setError('')
    if (!summary.trim()) {
      setError('Summary is required before continuing.')
      return
    }
    const template = buildTemplate(issueType)
    if (!template) {
      setError('Template not available for this issue type.')
      return
    }
    if (!description.trim() || description === lastTemplate) {
      const filledTemplate = buildTemplate(issueType)
      setDescription(filledTemplate)
      setLastTemplate(filledTemplate)
    }
    setConfirmCreate(false)
    setStep(2)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(null)

    try {
      if (step === 1) {
        handleNext()
        return
      }
      if (!confirmCreate) {
        throw new Error('Please confirm the ticket details before creating.')
      }
      if (!hasAcceptanceCriteria()) {
        throw new Error('Acceptance criteria required. Add at least one bullet.')
      }
      const token = localStorage.getItem('token')
      const response = await fetch('/api/jira-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          summary,
          issueType,
          description,
          labels,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create Jira ticket')
      }

      const data = await response.json()
      setSuccess({ key: data.ticketKey, url: data.url })
      await loadHistory()
      setSummary('')
      setIssueType('Bug')
      setDescription('')
      setLabels('')
      setConfirmCreate(false)
      setStep(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Jira ticket')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Create Jira Ticket</h1>
            <p className="text-slate-400">
              Draft a new ticket. Template and automation will be added next.
            </p>
          </div>
        </div>

        <Card className="glass-card border-slate-700/30">
          <CardHeader>
            <CardTitle>Ticket Details</CardTitle>
            <CardDescription>Fill the basics. The description template comes next.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleSubmit} className="space-y-5">
              {step === 1 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Project Key</label>
                      <Input
                        value={`${projectKey} (Jumia Tech Space)`}
                        disabled
                        className="bg-slate-800/50 border-slate-700 text-slate-300"
                      />
                      <p className="text-xs text-slate-500">
                        Jira create page:
                        <a
                          href="https://jira.jumia.com/secure/CreateIssue!default.jspa"
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1 text-blue-300 underline"
                        >
                          Open in Jira
                        </a>
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Issue Type</label>
                      <select
                        value={issueType}
                        onChange={(e) => setIssueType(e.target.value)}
                        className="w-full rounded-md bg-slate-800/50 border border-slate-700 text-slate-200 px-3 py-2 text-sm"
                      >
                        <option>Bug</option>
                        <option>Task</option>
                        <option>Story</option>
                        <option>Epic</option>
                        <option>Product Task</option>
                        <option>Support</option>
                        <option>Spike</option>
                      </select>
                      <p className="text-xs text-slate-500">
                        Only issue types available in Jumia Tech Space (JMIA).
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Summary</label>
                <Input
                  placeholder="Short, clear title"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  autoComplete="off"
                  className="bg-slate-800/50 border-slate-700"
                  required
                />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Labels (optional)
                    </label>
                    <Input
                      placeholder="comma-separated labels"
                      value={labels}
                      onChange={(e) => setLabels(e.target.value)}
                      className="bg-slate-800/50 border-slate-700"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(templateFields[issueType] || []).map((field) => (
                      <div key={field.key} className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">
                          {field.label}
                        </label>
                        {field.multiline ? (
                          <Textarea
                            placeholder={field.placeholder}
                            value={templateInputs[field.key] || ''}
                            onChange={(e) =>
                              setTemplateInputs((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                            rows={4}
                            className="bg-slate-800/50 border-slate-700 resize-none"
                          />
                        ) : (
                          <Input
                            placeholder={field.placeholder}
                            value={templateInputs[field.key] || ''}
                            onChange={(e) =>
                              setTemplateInputs((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                            className="bg-slate-800/50 border-slate-700"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Generated template preview (read-only).</span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleApplyTemplate}
                        className="text-slate-300 hover:text-white hover:bg-slate-800/60"
                      >
                        Reset template fields
                      </Button>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-200 whitespace-pre-wrap">
                      {description || 'Template preview will appear here.'}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900/60"
                      checked={confirmCreate}
                      onChange={(e) => setConfirmCreate(e.target.checked)}
                    />
                    I reviewed the template and acceptance criteria.
                  </label>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                  Ticket created: <span className="font-semibold">{success.key}</span>
                  {success.url ? (
                    <a
                      href={success.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 underline text-emerald-200"
                    >
                      Open in Jira
                    </a>
                  ) : null}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Next: enforce template, acceptance criteria, and auto-fill.</span>
                <div className="flex items-center gap-2">
                  {step === 2 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(1)}
                      className="text-slate-300 hover:text-white hover:bg-slate-800/60"
                    >
                      Back
                    </Button>
                  ) : null}
                  {step === 1 ? (
                    <Button
                      type="button"
                      onClick={handleNext}
                      className="bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={saving || !confirmCreate}
                      className="bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      {saving ? 'Saving...' : 'Create Ticket'}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-card border-slate-700/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Ticket Creation History</CardTitle>
              <CardDescription>Recently created tickets (this user).</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={loadHistory}
              className="text-slate-300 hover:text-white hover:bg-slate-800/60"
            >
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {historyError ? (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                {historyError}
              </div>
            ) : null}
            {historyLoading ? (
              <div className="text-sm text-slate-400">Loading history…</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-slate-400">No tickets created yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-200">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-2 text-left">Key</th>
                      <th className="py-2 text-left">Summary</th>
                      <th className="py-2 text-left">Type</th>
                      <th className="py-2 text-left">Created</th>
                      <th className="py-2 text-left">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {history.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 font-semibold text-slate-100">{item.jiraKey}</td>
                        <td className="py-2 text-slate-300">{item.summary}</td>
                        <td className="py-2 text-slate-400">{item.issueType}</td>
                        <td className="py-2 text-slate-400">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2">
                          {item.jiraUrl ? (
                            <a
                              href={item.jiraUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-300 underline"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </main>
  )
}
