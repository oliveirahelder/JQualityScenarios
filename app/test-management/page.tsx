'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ClipboardList, Plus, CheckCircle2 } from 'lucide-react'

type SourceTicket = {
  id: string
  teamKey: string
  jiraId: string
  summary: string
  description?: string | null
  comments?: string | null
  status?: string | null
  components?: string | null
  application?: string | null
  scenarioCount?: number | null
  updatedAt: string
}

type ScenarioInput = {
  title: string
  steps: string
  expectedResult: string
  notes: string
}

const getTeamKey = (name: string) => {
  const trimmed = name.trim()
  if (!trimmed) return 'TEAM'
  const match = trimmed.match(/^[A-Za-z0-9]+/)
  return match ? match[0].toUpperCase() : trimmed.toUpperCase()
}

export default function TestManagementPage() {
  const [teamKeys, setTeamKeys] = useState<string[]>([])
  const [selectedTeamKey, setSelectedTeamKey] = useState('')
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamError, setTeamError] = useState('')

  const [casesLoading, setCasesLoading] = useState(false)
  const [casesError, setCasesError] = useState('')
  const [caseQuery, setCaseQuery] = useState('')
  const [sourceTickets, setSourceTickets] = useState<SourceTicket[]>([])
  const [onlyWithScenarios, setOnlyWithScenarios] = useState(false)
  const [targetTicketId, setTargetTicketId] = useState('')
  const [publishLoading, setPublishLoading] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [publishSuccess, setPublishSuccess] = useState('')
  const [contextCaseIds, setContextCaseIds] = useState<Record<string, boolean>>({})
  const [includeDocs, setIncludeDocs] = useState(true)
  const [generationLoading, setGenerationLoading] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [generationSuccess, setGenerationSuccess] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSummary, setImportSummary] = useState('')
  const [importComponents, setImportComponents] = useState('')
  const [importKeyword, setImportKeyword] = useState('')
  const [componentsLoading, setComponentsLoading] = useState(false)
  const [componentsError, setComponentsError] = useState('')
  const [componentsList, setComponentsList] = useState<
    { id?: string; name: string; description?: string | null }[]
  >([])
  const [componentSearch, setComponentSearch] = useState('')

  const [theme, setTheme] = useState('')
  const [tags, setTags] = useState('')
  const [prerequisites, setPrerequisites] = useState('')
  const [objective, setObjective] = useState('')
  const [scenarios, setScenarios] = useState<ScenarioInput[]>([
    { title: '', steps: '', expectedResult: '', notes: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  useEffect(() => {
    const loadTeams = async () => {
      setTeamLoading(true)
      setTeamError('')
      try {
        const token = localStorage.getItem('token')
        const response = await fetch('/api/sprints', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to load teams')
        }
        const data = await response.json()
        const keys = new Set<string>()
        for (const sprint of data.sprints || []) {
          if (typeof sprint?.name === 'string') {
            keys.add(getTeamKey(sprint.name))
          }
        }
        const sorted = Array.from(keys).sort((a, b) => a.localeCompare(b))
        setTeamKeys(sorted)
      } catch (error) {
        setTeamError(error instanceof Error ? error.message : 'Failed to load teams')
      } finally {
        setTeamLoading(false)
      }
    }

    loadTeams()
  }, [])

  useEffect(() => {
    if (!selectedTeamKey && teamKeys.length > 0) {
      setSelectedTeamKey(teamKeys[0])
    }
  }, [selectedTeamKey, teamKeys])

  const loadCases = useCallback(async (teamKeyValue: string, queryValue: string) => {
    if (!teamKeyValue) return
    setCasesLoading(true)
    setCasesError('')
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      params.set('teamKey', teamKeyValue)
      if (queryValue.trim()) params.set('q', queryValue.trim())
      params.set('limit', '50')
      const response = await fetch(`/api/test-case-sources?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load QA history tickets')
      }
      setSourceTickets(data.tickets || [])
    } catch (error) {
      setCasesError(error instanceof Error ? error.message : 'Failed to load QA history tickets')
    } finally {
      setCasesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedTeamKey) return
    loadCases(selectedTeamKey, caseQuery)
  }, [selectedTeamKey, caseQuery, loadCases])

  const visibleSourceTickets = useMemo(() => {
    if (!onlyWithScenarios) return sourceTickets
    return sourceTickets.filter((ticket) => (ticket.scenarioCount ?? 0) > 0)
  }, [onlyWithScenarios, sourceTickets])

  const updateScenario = (index: number, field: keyof ScenarioInput, value: string) => {
    setScenarios((current) =>
      current.map((scenario, idx) =>
        idx === index ? { ...scenario, [field]: value } : scenario
      )
    )
  }

  const addScenario = () => {
    setScenarios((current) => [
      ...current,
      { title: '', steps: '', expectedResult: '', notes: '' },
    ])
  }

  const removeScenario = (index: number) => {
    setScenarios((current) => {
      if (current.length === 1) return current
      return current.filter((_, idx) => idx !== index)
    })
  }

  const handleCreateTestCase = async () => {
    setSaveError('')
    setSaveSuccess('')
    if (!selectedTeamKey) {
      setSaveError('Select a team before creating a test case.')
      return
    }
    if (!theme.trim() || !prerequisites.trim() || !objective.trim()) {
      setSaveError('Theme, prerequisites, and objective are mandatory.')
      return
    }
    const preparedScenarios = scenarios
      .map((scenario) => ({
        title: scenario.title.trim(),
        steps: scenario.steps.trim(),
        expectedResult: scenario.expectedResult.trim(),
        notes: scenario.notes.trim(),
      }))
      .filter((scenario) => scenario.title && scenario.steps)

    if (preparedScenarios.length === 0) {
      setSaveError('Add at least one scenario with title and steps.')
      return
    }

    try {
      setSaving(true)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/test-cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamKey: selectedTeamKey,
          theme,
          tags,
          prerequisites,
          objective,
          scenarios: preparedScenarios,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create test case')
      }
      setSaveSuccess('Test case created and saved.')
      setTheme('')
      setTags('')
      setPrerequisites('')
      setObjective('')
      setScenarios([{ title: '', steps: '', expectedResult: '', notes: '' }])
      setExpandedCaseId(data.testCase?.id || null)
      await loadCases(selectedTeamKey, caseQuery)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to create test case')
    } finally {
      setSaving(false)
    }
  }

  const toggleContextCase = (testCaseId: string) => {
    setContextCaseIds((current) => ({
      ...current,
      [testCaseId]: !current[testCaseId],
    }))
  }

  const handleGenerateFromHistory = async () => {
    setGenerationError('')
    setGenerationSuccess('')
    if (!selectedTeamKey) {
      setGenerationError('Select a team before generating.')
      return
    }
    if (!theme.trim()) {
      setGenerationError('Theme is required to generate a test case.')
      return
    }
    if (!targetTicketId.trim()) {
      setGenerationError('Provide the target Jira ticket ID.')
      return
    }

    try {
      setGenerationLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/test-cases/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamKey: selectedTeamKey,
          theme: theme.trim(),
          targetTicketId: targetTicketId.trim(),
          includeDocs,
          sourceJiraIds: Object.keys(contextCaseIds).filter((id) => contextCaseIds[id]),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate test case')
      }
      setPrerequisites(data.testCase?.prerequisites || '')
      setObjective(data.testCase?.objective || '')
      if (Array.isArray(data.testCase?.scenarios) && data.testCase.scenarios.length > 0) {
        setScenarios(
          data.testCase.scenarios.map((scenario: ScenarioInput) => ({
            title: scenario.title || '',
            steps: scenario.steps || '',
            expectedResult: scenario.expectedResult || '',
            notes: scenario.notes || '',
          }))
        )
      }
      setGenerationSuccess('Generated test case from historical context.')
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate test case')
    } finally {
      setGenerationLoading(false)
    }
  }

  const buildManualTemplate = (
    scenariosInput: Array<{
      title: string
      steps: string
      expectedResult?: string | null
      notes?: string | null
    }>
  ) => {
    const header =
      '||ID||Test Scenario||Execution Steps||Expected Result||Actual Result||Notes||Attachments||'
    const rows = scenariosInput.map((scenario, index) => {
      const id = `FT-${String(index + 1).padStart(2, '0')}`
      const steps = scenario.steps
        .split(/\r?\n+/)
        .map((step) => step.trim())
        .filter(Boolean)
        .join('\n')
      const expected = scenario.expectedResult?.trim() || ''
      const notes = scenario.notes?.trim() || ''
      return `|${id}|${scenario.title}|${steps}|${expected}||${notes}||`
    })
    return [header, ...rows].join('\n')
  }

  const handlePublishTemplate = async (
    scenariosInput: Array<{
      title: string
      steps: string
      expectedResult?: string | null
      notes?: string | null
    }>
  ) => {
    if (!targetTicketId.trim()) {
      setPublishError('Set the target Jira ticket ID before publishing.')
      return
    }
    setPublishError('')
    setPublishSuccess('')
    setPublishLoading(true)
    try {
      const token = localStorage.getItem('token')
      const comment = buildManualTemplate(scenariosInput)
      const response = await fetch('/api/scenarios/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId: targetTicketId.trim(),
          comment,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to publish comment')
      }
      setPublishSuccess('Published manual template to Jira.')
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Failed to publish comment')
    } finally {
      setPublishLoading(false)
    }
  }

  const handleImport = async () => {
    if (!selectedTeamKey) {
      setImportError('Select a team before importing.')
      return
    }
    const componentValues = importComponents
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    if (componentValues.length === 0) {
      setImportError('Component is required for import.')
      return
    }
    setImportError('')
    setImportSummary('')
    setImporting(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/test-cases/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamKey: selectedTeamKey,
          components: componentValues,
          keyword: importKeyword.trim() || undefined,
          requireComponent: true,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to import test cases')
      }
      const skippedReasons = data.skippedReasons || {}
      const scenarioSummary = data.scenarioSummary || {}
      const reasonsSummary =
        data.skipped
          ? ` (no content: ${skippedReasons.noContent ?? 0})`
          : ''
      const scenarioNote =
        typeof scenarioSummary.withScenarios === 'number' ||
        typeof scenarioSummary.withoutScenarios === 'number'
          ? ` Scenarios found: ${scenarioSummary.withScenarios ?? 0}, missing: ${
              scenarioSummary.withoutScenarios ?? 0
            }.`
          : ''
      setImportSummary(
        `Imported ${data.imported ?? 0} ticket(s). Updated ${data.updated ?? 0}. Skipped ${data.skipped ?? 0}.${reasonsSummary}${scenarioNote}`
      )
      await loadCases(selectedTeamKey, caseQuery)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import test cases')
    } finally {
      setImporting(false)
    }
  }

  const addComponentTag = (name: string) => {
    const existing = importComponents
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    if (!existing.includes(name)) {
      const next = [...existing, name].join(', ')
      setImportComponents(next)
    }
  }

  const handleLoadComponents = async () => {
    setComponentsError('')
    setComponentsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/integrations/jira/components?projectKey=JMIA', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load components')
      }
      setComponentsList(Array.isArray(data.components) ? data.components : [])
    } catch (error) {
      setComponentsError(error instanceof Error ? error.message : 'Failed to load components')
    } finally {
      setComponentsLoading(false)
    }
  }

  const filteredComponents = useMemo(() => {
    const query = componentSearch.trim().toLowerCase()
    if (!query) return componentsList
    return componentsList.filter((component) => component.name.toLowerCase().includes(query))
  }, [componentSearch, componentsList])

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Test Management</h1>
          <p className="text-sm text-slate-400">
            Create reusable test cases by theme, then publish manual templates to Jira.
          </p>
        </div>

        <Card className="glass-card border-slate-700/30">
          <CardHeader>
            <CardTitle className="text-white text-lg">Context</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Select the team, target ticket, and theme before building or importing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-slate-400">Team</Label>
                {teamLoading ? (
                  <div className="text-xs text-slate-500">Loading teams...</div>
                ) : teamKeys.length > 0 ? (
                  <select
                    value={selectedTeamKey}
                    onChange={(event) => setSelectedTeamKey(event.target.value)}
                    className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200"
                  >
                    {teamKeys.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={selectedTeamKey}
                    onChange={(event) => setSelectedTeamKey(event.target.value)}
                    placeholder="Team key"
                    className="h-8 bg-slate-900/70 text-xs"
                  />
                )}
                {teamError ? <span className="text-xs text-red-300">{teamError}</span> : null}
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-slate-400">Target Jira ticket</Label>
                <Input
                  value={targetTicketId}
                  onChange={(event) => setTargetTicketId(event.target.value)}
                  placeholder="JMIA-1234"
                  className="h-8 bg-slate-900/70 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-slate-400">Theme</Label>
                <Input
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                  placeholder="e.g. Mandalorian bonus"
                  className="h-8 bg-slate-900/70 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-slate-400">Tags (comma separated)</Label>
              <Input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="bonus, payout, validation"
                className="h-8 bg-slate-900/70 text-xs"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">

            <Card className="glass-card border-slate-700/30">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-300" />
                  Regression test case builder
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Review, edit, and save the regression test case before publishing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-slate-400">Prerequisites</Label>
                    <Textarea
                      value={prerequisites}
                      onChange={(event) => setPrerequisites(event.target.value)}
                      placeholder="Required setup before running the test case."
                      className="min-h-[120px] bg-slate-900/70 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-slate-400">Test case objective</Label>
                    <Textarea
                      value={objective}
                      onChange={(event) => setObjective(event.target.value)}
                      placeholder="What should this test case prove?"
                      className="min-h-[120px] bg-slate-900/70 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-400">Test scenarios</Label>
                    <Button variant="secondary" size="sm" onClick={addScenario} className="h-7 px-2 text-xs">
                      <Plus className="w-3 h-3 mr-1" />
                      Add scenario
                    </Button>
                  </div>
                  {scenarios.map((scenario, index) => (
                    <div key={`scenario-${index}`} className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-400 font-semibold">
                          Scenario {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeScenario(index)}
                          className="text-xs text-slate-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-2 grid gap-2">
                        <Input
                          value={scenario.title}
                          onChange={(event) => updateScenario(index, 'title', event.target.value)}
                          placeholder="Scenario title"
                          className="h-8 bg-slate-950/60 text-xs"
                        />
                        <Textarea
                          value={scenario.steps}
                          onChange={(event) => updateScenario(index, 'steps', event.target.value)}
                          placeholder="Steps (one per line)"
                          className="min-h-[80px] bg-slate-950/60 text-xs"
                        />
                        <Textarea
                          value={scenario.expectedResult}
                          onChange={(event) =>
                            updateScenario(index, 'expectedResult', event.target.value)
                          }
                          placeholder="Expected result"
                          className="min-h-[60px] bg-slate-950/60 text-xs"
                        />
                        <Textarea
                          value={scenario.notes}
                          onChange={(event) => updateScenario(index, 'notes', event.target.value)}
                          placeholder="Notes (optional)"
                          className="min-h-[60px] bg-slate-950/60 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {saveError ? <div className="text-xs text-red-300">{saveError}</div> : null}
                {saveSuccess ? <div className="text-xs text-emerald-300">{saveSuccess}</div> : null}

                <Button
                  onClick={handleCreateTestCase}
                  disabled={saving}
                  className="w-full justify-center"
                >
                  {saving ? 'Saving...' : 'Save test case'}
                </Button>


                <div className="mt-4 space-y-2">
                  <div className="text-xs text-slate-400">Publish regression comment</div>
                  <div className="text-[11px] text-slate-500">
                    Target ticket: {targetTicketId.trim() ? targetTicketId.trim() : 'Set above'}
                  </div>
                  {publishError ? <div className="text-xs text-red-300">{publishError}</div> : null}
                  {publishSuccess ? (
                    <div className="text-xs text-emerald-300">{publishSuccess}</div>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    disabled={publishLoading || !targetTicketId.trim()}
                    onClick={() =>
                      handlePublishTemplate(
                        scenarios.map((scenario) => ({
                          title: scenario.title,
                          steps: scenario.steps,
                          expectedResult: scenario.expectedResult,
                          notes: scenario.notes,
                        }))
                      )
                    }
                  >
                    {publishLoading ? 'Publishing...' : 'Publish manual template'}
                  </Button>
                </div>

                <div className="mt-4 space-y-2 rounded-lg border border-slate-800/60 bg-slate-900/50 p-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Regression pack generator</span>
                    <label className="flex items-center gap-2 text-[11px] text-slate-400">
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-slate-600"
                        checked={includeDocs}
                        onChange={(event) => setIncludeDocs(event.target.checked)}
                      />
                      Include docs
                    </label>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Selected source tickets: {Object.values(contextCaseIds).filter(Boolean).length}
                  </div>
                  {generationError ? (
                    <div className="text-xs text-red-300">{generationError}</div>
                  ) : null}
                  {generationSuccess ? (
                    <div className="text-xs text-emerald-300">{generationSuccess}</div>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    disabled={generationLoading}
                    onClick={handleGenerateFromHistory}
                  >
                    {generationLoading ? 'Generating...' : 'Generate regression pack'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">

            <Card className="glass-card border-slate-700/30">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-300" />
                      QA history (completed tickets)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      Import completed tickets to build QA history for this team.
                    </CardDescription>
                  </div>
                  <Button
                    variant="secondary"
                    className="h-7 px-2 text-xs"
                    onClick={handleImport}
                    disabled={importing || !selectedTeamKey}
                  >
                    {importing ? 'Importing...' : 'Import from Jira'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedTeamKey ? (
                  <div className="text-xs text-amber-300">
                    Select a team to enable the import.
                  </div>
                ) : null}
                {importError ? (
                  <div className="text-xs text-red-300">{importError}</div>
                ) : null}
                {importSummary ? (
                  <div className="text-xs text-emerald-300">{importSummary}</div>
                ) : null}
                <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 p-3 space-y-2">
                  <div className="text-[11px] text-slate-400 font-semibold">
                    Jira import filters (per QA run)
                  </div>
                  <Input
                    value={importComponents}
                    onChange={(event) => setImportComponents(event.target.value)}
                    placeholder="Components (comma separated)"
                    className="h-8 bg-slate-900/70 text-xs"
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      value={importKeyword}
                      onChange={(event) => setImportKeyword(event.target.value)}
                      placeholder='Keyword (optional, e.g. "mandalorian")'
                      className="h-8 bg-slate-900/70 text-xs"
                    />
                    <div className="flex items-center rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200">
                      Final status only (Done / Closed)
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Component is required (component is not EMPTY).
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 px-2 text-xs border-slate-700 text-slate-300"
                      onClick={handleLoadComponents}
                      disabled={componentsLoading}
                    >
                      {componentsLoading ? 'Loading...' : 'Load components'}
                    </Button>
                    <Input
                      value={componentSearch}
                      onChange={(event) => setComponentSearch(event.target.value)}
                      placeholder="Filter components"
                      className="h-7 w-40 bg-slate-900/70 text-xs"
                    />
                    {componentsError ? (
                      <span className="text-[11px] text-red-300">{componentsError}</span>
                    ) : null}
                  </div>
                  {componentsList.length > 0 ? (
                    <div className="max-h-[140px] overflow-y-auto rounded-md border border-slate-800/60 bg-slate-950/40 p-2">
                      <div className="flex flex-wrap gap-2">
                        {filteredComponents.map((component) => (
                          <button
                            key={component.id || component.name}
                            type="button"
                            onClick={() => addComponentTag(component.name)}
                            className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-blue-400 hover:text-white transition"
                            title={component.description || component.name}
                          >
                            {component.name}
                          </button>
                        ))}
                        {filteredComponents.length === 0 ? (
                          <span className="text-[11px] text-slate-500">
                            No components match the filter.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
                <Input
                  value={caseQuery}
                  onChange={(event) => setCaseQuery(event.target.value)}
                  placeholder="Search by keyword (summary, comments, components)"
                  className="h-8 bg-slate-900/70 text-xs"
                />
                <label className="flex items-center gap-2 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-slate-600"
                    checked={onlyWithScenarios}
                    onChange={(event) => setOnlyWithScenarios(event.target.checked)}
                  />
                  Only tickets with scenario hints
                </label>

                {casesLoading ? (
                  <div className="text-xs text-slate-500">Loading QA history...</div>
                ) : casesError ? (
                  <div className="text-xs text-red-300">{casesError}</div>
                ) : visibleSourceTickets.length === 0 ? (
                  <div className="text-xs text-slate-500">
                    No QA history found yet. Import from Jira to start.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {visibleSourceTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold text-slate-100">
                              {ticket.summary}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {ticket.jiraId} - {ticket.status || 'Unknown status'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Components: {ticket.components || '-'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Scenario hints: {ticket.scenarioCount ?? 0}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <label className="flex items-center gap-2 text-[10px] text-slate-400">
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded border-slate-600"
                                checked={Boolean(contextCaseIds[ticket.jiraId])}
                                onChange={() => toggleContextCase(ticket.jiraId)}
                              />
                              Use for regression
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
