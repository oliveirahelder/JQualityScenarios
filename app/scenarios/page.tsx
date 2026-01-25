'use client'

import React, { useState } from 'react'
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
          title: `${result.jiraDetails.id} - QA Scenarios`,
          content,
          requirements,
          technicalNotes: buildGherkinContent(result.scenarios),
          testResults: buildJiraCommentTable(result.manualScenarios, result.scenarios),
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

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                      placeholder="Paste any relevant documentation or context..."
                      value={confluence}
                      onChange={(e) => setConfluence(e.target.value)}
                      disabled={loading}
                      rows={5}
                      className="bg-slate-800/50 border-slate-700 resize-none"
                    />
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
                    {result.jiraDetails.description && (
                      <div className="mt-6">
                        <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Description</p>
                        <div className="text-white text-sm p-4 bg-slate-800/30 rounded-lg border border-slate-700/30">
                          {result.jiraDetails.description}
                        </div>
                      </div>
                    )}
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
                    <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed bg-slate-900/40 border border-slate-700/40 rounded-lg p-4">
                      {buildJiraCommentTable(result.manualScenarios, result.scenarios)}
                    </div>
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
