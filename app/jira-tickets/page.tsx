'use client'

import React, { useState } from 'react'
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ key: string; url?: string } | null>(null)

  const buildTemplate = (type: string) => {
    switch (type) {
      case 'Story':
        return [
          '*User Story*',
          '*As a* <role>',
          '*I want* <goal>',
          '*So that* <value>',
          '',
          '*Background information*',
          '- <context / constraints>',
          '',
          '*Acceptance criteria*',
          '- <criterion 1>',
          '- <criterion 2>',
        ].join('\n')
      case 'Bug':
        return [
          '*Summary*',
          '<short problem summary>',
          '',
          '*Steps to reproduce*',
          '1. <step>',
          '2. <step>',
          '',
          '*Actual result*',
          '<what happens>',
          '',
          '*Expected result*',
          '<what should happen>',
          '',
          '*Environment*',
          '- Browser/OS:',
          '- URL:',
        ].join('\n')
      case 'Task':
        return [
          '*Goal*',
          '<what needs to be done>',
          '',
          '*Details*',
          '- <notes / dependencies>',
          '',
          '*Acceptance criteria*',
          '- <criterion 1>',
        ].join('\n')
      case 'Epic':
        return [
          '*Epic goal*',
          '<high-level objective>',
          '',
          '*Scope*',
          '- In scope:',
          '- Out of scope:',
          '',
          '*Success criteria*',
          '- <metric / outcome>',
        ].join('\n')
      case 'Product Task':
        return [
          '*Objective*',
          '<business objective>',
          '',
          '*Business value*',
          '- <impact / value>',
          '',
          '*Acceptance criteria*',
          '- <criterion 1>',
        ].join('\n')
      case 'Support':
        return [
          '*Request*',
          '<who needs help and why>',
          '',
          '*Customer impact*',
          '- <impact>',
          '',
          '*Details / evidence*',
          '- <logs / screenshots / refs>',
        ].join('\n')
      case 'Spike':
        return [
          '*Hypothesis*',
          '<what we want to learn>',
          '',
          '*Questions to answer*',
          '- <question 1>',
          '- <question 2>',
          '',
          '*Outcome / decision*',
          '- <result or recommendation>',
        ].join('\n')
      default:
        return ''
    }
  }

  const handleApplyTemplate = () => {
    const template = buildTemplate(issueType)
    if (template) {
      setDescription(template)
      setLastTemplate(template)
    }
  }

  React.useEffect(() => {
    const template = buildTemplate(issueType)
    if (!template) return
    if (!description.trim() || description === lastTemplate) {
      setDescription(template)
      setLastTemplate(template)
    }
  }, [issueType])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(null)

    try {
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
      setSummary('')
      setIssueType('Bug')
      setDescription('')
      setLabels('')
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
                  className="bg-slate-800/50 border-slate-700"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Labels (optional)</label>
                <Input
                  placeholder="comma-separated labels"
                  value={labels}
                  onChange={(e) => setLabels(e.target.value)}
                  className="bg-slate-800/50 border-slate-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Description</label>
                <Textarea
                  placeholder="Template will be added. For now, add the key context."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="bg-slate-800/50 border-slate-700 resize-none"
                  required
                />
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Use the template for this issue type.</span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleApplyTemplate}
                    className="text-slate-300 hover:text-white hover:bg-slate-800/60"
                  >
                    Apply template
                  </Button>
                </div>
              </div>

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
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {saving ? 'Saving...' : 'Create Ticket'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-card border-slate-700/30">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Review the description before publishing.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-200 whitespace-pre-wrap">
              {description || 'Description preview will appear here.'}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
