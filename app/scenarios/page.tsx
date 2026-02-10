'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Zap, Copy, Check, AlertCircle, Sparkles, Code2, BookOpen } from 'lucide-react'

type ManualScenario = {
  id?: string
  testScenario: string
  executionSteps: string[]
  expectedResult: string
  actualResult?: string
  notes?: string
}

type Attachment = {
  id: string
  filename: string
  size: number
  mimeType: string
  createdAt: string
  hasText: boolean
}

type ScenarioResult = {
  jiraDetails: {
    id: string
    status?: string | null
    summary: string
    description?: string | null
  }
  ticketRef?: {
    id: string
    sprintId: string
    summary?: string | null
  } | null
  scenarios?: string[]
  manualScenarios?: ManualScenario[]
}

export default function GenerateScenariosPage() {
  const [ticketId, setTicketId] = useState('')
  const [confluence, setConfluence] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [attachmentsError, setAttachmentsError] = useState('')
  const [manualTemplate, setManualTemplate] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)

  const loadAttachments = async (currentTicketId: string) => {
    setAttachmentsLoading(true)
    setAttachmentsError('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `/api/scenarios/attachments?ticketId=${encodeURIComponent(currentTicketId)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load attachments')
      }
      const data = await response.json()
      setAttachments(data.attachments || [])
    } catch (err) {
      setAttachmentsError(err instanceof Error ? err.message : 'Failed to load attachments')
    } finally {
      setAttachmentsLoading(false)
    }
  }

  useEffect(() => {
    if (!ticketId) {
      setAttachments([])
      return
    }
    loadAttachments(ticketId)
  }, [ticketId])


  const handleAttachmentUpload = async (file: File) => {
    if (!ticketId) {
      setAttachmentsError('Add the Jira ticket ID before uploading files.')
      return
    }
    setAttachmentsLoading(true)
    setAttachmentsError('')
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('ticketId', ticketId)
      formData.append('file', file)
      const response = await fetch('/api/scenarios/attachments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload attachment')
      }
      await loadAttachments(ticketId)
    } catch (err) {
      setAttachmentsError(err instanceof Error ? err.message : 'Failed to upload attachment')
    } finally {
      setAttachmentsLoading(false)
    }
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/scenarios/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId,
          confluence,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate scenarios')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, idx?: number) => {
    navigator.clipboard.writeText(text)
    setCopied(idx ?? -1)
    setTimeout(() => setCopied(null), 2000)
  }

  const buildManualFromGherkin = (scenarios?: string[]) => {
    if (!scenarios || scenarios.length === 0) return []
    return scenarios.map((scenario, index) => {
      const lines = scenario
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
      const titleLine = lines.find((line) => line.toLowerCase().startsWith('scenario'))
      const testScenario = titleLine ? titleLine.replace(/^scenario:\s*/i, '') : `Scenario ${index + 1}`
      const steps = lines.filter((line) => /^(given|when|then|and|but)\b/i.test(line))
      const thenLine = lines.find((line) => line.toLowerCase().startsWith('then '))
      const expectedResult = thenLine ? thenLine.replace(/^then\s+/i, '') : ''
      return {
        id: `FT-${String(index + 1).padStart(2, '0')}`,
        testScenario,
        executionSteps: steps,
        expectedResult,
      }
    })
  }

  const buildJiraCommentTable = (
    manualScenarios?: ManualScenario[],
    gherkinScenarios?: string[]
  ) => {
    const header =
      '||ID||Test Scenario||Execution Steps||Expected Result||Actual Result||Notes||Attachments||'
    const sanitize = (value: string) =>
      value.replace(/<br\s*\/?>/gi, '\n').trim()
    const scenarios =
      manualScenarios && manualScenarios.length > 0
        ? manualScenarios
        : buildManualFromGherkin(gherkinScenarios)
    if (!scenarios || scenarios.length === 0) {
      return [header, '|FT-01|<scenario>|<steps>|<expected>|<actual>|<notes>|<attachments>|'].join('\n')
    }
    const rows = scenarios.map((scenario, index) => {
      const id = scenario.id || `FT-${String(index + 1).padStart(2, '0')}`
      const steps = (scenario.executionSteps || [])
        .map((step, stepIndex) => `${stepIndex + 1}. ${sanitize(step)}`)
        .join('\n')
      const expected = sanitize(scenario.expectedResult || '')
      const actual = sanitize(scenario.actualResult || '')
      const notes = sanitize(scenario.notes || '')
      const testScenario = sanitize(scenario.testScenario)
      return `|${id}|${testScenario}|${steps}|${expected}|${actual}|${notes}||`
    })
    return [header, ...rows].join('\n')
  }

  useEffect(() => {
    if (!result?.jiraDetails?.id) return
    const template = buildJiraCommentTable(result.manualScenarios, result.scenarios)
    setManualTemplate(template)
    setPublishError('')
    setPublishedUrl(null)
  }, [result?.jiraDetails?.id])

  const buildDocumentationContent = (data: ScenarioResult) => {
    const ticketTitle = data.ticketRef?.summary || data.jiraDetails.summary
    return [
      `# ${data.jiraDetails.id} - ${ticketTitle}`,
      '',
      'Functional QA scenarios generated from ticket details.',
    ].join('\n')
  }

  const buildGherkinContent = (scenarios?: string[]) => {
    if (!scenarios || scenarios.length === 0) return 'No Gherkin scenarios generated.'
    return scenarios.join('\n\n')
  }

  const handleSaveToDocs = async () => {
    if (!result?.ticketRef) {
      setSaveError('Ticket not found in the database. Sync Jira first.')
      return
    }
    setSaveError('')
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const content = buildDocumentationContent(result)
      const themeTitle =
        result.ticketRef?.summary?.trim() ||
        result.jiraDetails.summary?.trim() ||
        result.jiraDetails.id
      const requirements = [
        result.jiraDetails.description,
        result.jiraDetails.comments ? `Comments:\n${result.jiraDetails.comments}` : null,
      ]
        .filter(Boolean)
        .join('\n\n')
      const response = await fetch('/api/documentation-drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sprintId: result.ticketRef.sprintId,
          ticketId: result.ticketRef.id,
          title: themeTitle,
          content,
          requirements,
          technicalNotes: buildGherkinContent(result.scenarios),
          testResults:
            manualTemplate ||
            buildJiraCommentTable(result.manualScenarios, result.scenarios),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save scenarios')
      }

      setCopied(-3)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save scenarios')
    } finally {
      setSaving(false)
    }
  }

  const handlePublishToJira = async () => {
    if (!result?.jiraDetails?.id) {
      setPublishError('Generate scenarios before publishing.')
      return
    }
    if (!manualTemplate.trim()) {
      setPublishError('Manual template is empty.')
      return
    }
    setPublishError('')
    setPublishing(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/scenarios/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId: result.jiraDetails.id,
          comment: manualTemplate,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to publish comment')
      }

      const data = await response.json()
      setPublishedUrl(data.published?.url || null)
      setCopied(-4)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Failed to publish comment')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-none w-full px-6 lg:px-10 py-8">
        {/* Header */}
        <div className="mb-8 animate-fadeIn">
          <h1 className="text-4xl font-bold text-white">Generate Test Scenarios</h1>
          <p className="text-slate-400 mt-1">AI-powered scenario creation from Jira tickets</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Form */}
          <div className="lg:col-span-1 animate-slideInLeft">
            <Card className="glass-card border-slate-700/30 sticky top-24">
              <CardHeader className="border-b border-slate-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                  <CardTitle>Generate Scenarios</CardTitle>
                </div>
                <CardDescription>Provide ticket details to create test scenarios</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleGenerate} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Jira Ticket ID</label>
                    <Input
                      placeholder="e.g., PROJ-123"
                      value={ticketId}
                      onChange={(e) => setTicketId(e.target.value)}
                      required
                      disabled={loading}
                      className="bg-slate-800/50 border-slate-700"
                    />
                    <p className="text-xs text-slate-500">
                      Info: The system will fetch details from Jira API
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Documentation (Optional)</label>
                    <Textarea
                      placeholder="Paste any relevant documentation, context, or PR links..."
                      value={confluence}
                      onChange={(e) => setConfluence(e.target.value)}
                      disabled={loading}
                      rows={5}
                      className="bg-slate-800/50 border-slate-700 resize-none"
                    />
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <Input
                        type="file"
                        accept="application/pdf"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) {
                            handleAttachmentUpload(file)
                          }
                          event.currentTarget.value = ''
                        }}
                        className="bg-slate-800/50 border-slate-700 text-slate-200 file:bg-slate-700 file:text-slate-200"
                      />
                      <span>PDF only · max 20MB · up to 5 files</span>
                      {attachmentsLoading && <span className="text-slate-300">Uploading...</span>}
                    </div>
                    {attachmentsError && (
                      <div className="flex items-center gap-2 text-xs text-red-300">
                        <AlertCircle className="w-4 h-4" />
                        <span>{attachmentsError}</span>
                      </div>
                    )}
                    {attachments.length > 0 && (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-300">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Attachments ({attachments.length}/5)</span>
                          <span>
                            Context extracted: {attachments.filter((att) => att.hasText).length}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {attachments.map((attachment) => (
                            <div key={attachment.id} className="flex items-center justify-between">
                              <span className="truncate">{attachment.filename}</span>
                              <span className="text-[11px] text-slate-400">
                                {(attachment.size / (1024 * 1024)).toFixed(1)} MB
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-300 text-sm flex items-center gap-2 animate-slideInUp">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full btn-glow bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {loading ? 'Generating...' : 'Generate Scenarios'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-6 animate-slideInRight">
            {result ? (
              <>
                {/* Ticket Details */}
                <Card className="glass-card border-slate-700/30">
                  <CardHeader className="border-b border-slate-700/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Code2 className="w-5 h-5 text-purple-400" />
                      <CardTitle>Ticket Details</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs text-slate-400 font-semibold uppercase mb-2">ID</p>
                        <p className="text-white font-mono text-lg font-semibold">{result.jiraDetails.id}</p>
                      </div>
                      {result.jiraDetails.status && (
                        <div>
                          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Status</p>
                          <div className="badge">{result.jiraDetails.status}</div>
                        </div>
                      )}
                    </div>
                    <div className="mt-6">
                      <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Summary</p>
                      <p className="text-white text-base">{result.jiraDetails.summary}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Scenarios */}
                {result.scenarios && result.scenarios.length > 0 && (
                  <Card className="glass-card border-slate-700/30">
                    <CardHeader className="border-b border-slate-700/30">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-blue-400" />
                          <div>
                            <CardTitle>Generated Scenarios</CardTitle>
                            <CardDescription>{result.scenarios.length} scenarios created</CardDescription>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(result.scenarios.join('\n\n---\n\n'), -1)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        >
                          {copied === -1 ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                          {copied === -1 ? 'Copied!' : 'Copy All'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {result.scenarios.map((scenario: string, idx: number) => (
                          <div 
                            key={idx} 
                            className="group p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg hover:border-blue-500/50 transition-all duration-300"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                                  {scenario}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(scenario, idx)}
                                className="flex-shrink-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                {copied === idx ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Jira Comment Template */}
                <Card className="glass-card border-slate-700/30">
                  <CardHeader className="border-b border-slate-700/30">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <CardTitle>Jira Comment Template</CardTitle>
                        <CardDescription>Manual QA table (Jira markup)</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(
                              manualTemplate ||
                                buildJiraCommentTable(result.manualScenarios, result.scenarios),
                              -2
                            )
                          }
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        >
                          {copied === -2 ? (
                            <Check className="w-4 h-4 mr-1" />
                          ) : (
                            <Copy className="w-4 h-4 mr-1" />
                          )}
                          {copied === -2 ? 'Copied!' : 'Copy Template'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handlePublishToJira}
                          disabled={publishing}
                          className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                        >
                          {copied === -4 ? (
                            <Check className="w-4 h-4 mr-1" />
                          ) : (
                            <Sparkles className="w-4 h-4 mr-1" />
                          )}
                          {copied === -4 ? 'Published!' : publishing ? 'Publishing...' : 'Publish to Jira'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleSaveToDocs}
                          disabled={saving}
                          className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                        >
                          {copied === -3 ? (
                            <Check className="w-4 h-4 mr-1" />
                          ) : (
                            <BookOpen className="w-4 h-4 mr-1" />
                          )}
                          {copied === -3 ? 'Saved!' : saving ? 'Saving...' : 'Save to Docs'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {saveError ? (
                      <div className="mb-3 text-xs text-red-300 bg-red-500/10 border border-red-500/40 rounded-md px-3 py-2">
                        {saveError}
                      </div>
                    ) : null}
                    {publishError ? (
                      <div className="mb-3 text-xs text-red-300 bg-red-500/10 border border-red-500/40 rounded-md px-3 py-2">
                        {publishError}
                      </div>
                    ) : null}
                    {publishedUrl ? (
                      <div className="mb-3 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
                        Published to Jira. Open comment:
                        <a
                          href={publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 underline text-emerald-200"
                        >
                          View in Jira
                        </a>
                      </div>
                    ) : null}
                    <Textarea
                      value={manualTemplate}
                      onChange={(event) => setManualTemplate(event.target.value)}
                      rows={14}
                      className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed bg-slate-900/40 border border-slate-700/40 rounded-lg p-4"
                    />
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="glass-card border-slate-700/30">
                <CardContent className="py-16 text-center">
                  <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
                  <p className="text-slate-400 max-w-md mx-auto">
                    Enter a Jira ticket ID and click &quot;Generate Scenarios&quot; to see AI-generated test scenarios here.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
