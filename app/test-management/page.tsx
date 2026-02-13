'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

export default function TestManagementPage() {
  const [teamKeys, setTeamKeys] = useState<string[]>([])
  const [selectedTeamKey, setSelectedTeamKey] = useState('')
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamError, setTeamError] = useState('')
  const [componentOptions, setComponentOptions] = useState<string[]>([])
  const [selectedComponent, setSelectedComponent] = useState('')
  const [teamCounts, setTeamCounts] = useState<Record<string, number>>({})
  const [totalSynced, setTotalSynced] = useState(0)
  const [missingComponentCount, setMissingComponentCount] = useState(0)
  const [missingTeamCount, setMissingTeamCount] = useState(0)
  const [missingJiraUrl, setMissingJiraUrl] = useState<string | null>(null)

  const [casesLoading, setCasesLoading] = useState(false)
  const [casesError, setCasesError] = useState('')
  const [caseQuery, setCaseQuery] = useState('')
  const [sourceTickets, setSourceTickets] = useState<SourceTicket[]>([])
  const [casesTotal, setCasesTotal] = useState(0)
  const [casesLoaded, setCasesLoaded] = useState(0)
  const [onlyWithScenarios, setOnlyWithScenarios] = useState(false)
  const [targetTicketId, setTargetTicketId] = useState('')
  const [publishLoading, setPublishLoading] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [publishSuccess, setPublishSuccess] = useState('')
  const [saveDocsLoading, setSaveDocsLoading] = useState(false)
  const [saveDocsError, setSaveDocsError] = useState('')
  const [saveDocsSuccess, setSaveDocsSuccess] = useState('')
  const [contextCaseIds, setContextCaseIds] = useState<Record<string, boolean>>({})
  const [includeDocs, setIncludeDocs] = useState(true)
  const [generationLoading, setGenerationLoading] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [generationSuccess, setGenerationSuccess] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const availableModels = ['claude-sonnet-4.5', 'gemini-2.5-pro', 'gpt-5.2', 'claude-opus-4.5']
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSummary, setImportSummary] = useState('')
  const [lastSyncLabel, setLastSyncLabel] = useState('Not synced yet')
  const [lastSyncStatus, setLastSyncStatus] = useState<'SUCCESS' | 'FAILED' | null>(null)
  const loadRequestRef = useRef(0)

  const [theme, setTheme] = useState('')
  const [tags, setTags] = useState('')
  const [prerequisites, setPrerequisites] = useState('')
  const [objective, setObjective] = useState('')
  const [scenarios, setScenarios] = useState<ScenarioInput[]>([
    { title: '', steps: '', expectedResult: '', notes: '' },
  ])

  useEffect(() => {
    const loadTeams = async () => {
      setTeamLoading(true)
      setTeamError('')
      try {
        const token = localStorage.getItem('token')
        const response = await fetch('/api/test-case-sources?summary=1', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to load teams')
        }
        const data = await response.json()
        const counts: Record<string, number> = {}
        const teams = Array.isArray(data.teamCounts)
          ? data.teamCounts.map((entry: { teamKey: string }) => entry.teamKey)
          : []
        if (Array.isArray(data.teamCounts)) {
          for (const entry of data.teamCounts) {
            if (entry?.teamKey) {
              counts[entry.teamKey] = entry.count ?? 0
            }
          }
        }
        setTeamKeys(teams)
        setTeamCounts(counts)
        setTotalSynced(
          Object.values(counts).reduce((sum, value) => sum + value, 0)
        )
        setMissingComponentCount(data.missingComponentCount ?? 0)
        setMissingTeamCount(data.missingTeamCount ?? 0)
        setMissingJiraUrl(data.missingUrl ?? null)
      } catch (error) {
        setTeamError(error instanceof Error ? error.message : 'Failed to load teams')
      } finally {
        setTeamLoading(false)
      }
    }

    loadTeams()
  }, [])

  useEffect(() => {
    const loadLastSync = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch('/api/test-case-sources?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await response.json()
        if (!response.ok) return
        if (data.lastSync?.finishedAt) {
          const label = new Date(data.lastSync.finishedAt).toLocaleString()
          setLastSyncLabel(
            data.lastSync.status === 'FAILED'
              ? `Last sync failed: ${label}`
              : `Last sync: ${label}`
          )
          setLastSyncStatus(data.lastSync.status || null)
        } else {
          setLastSyncLabel('Not synced yet')
          setLastSyncStatus(null)
        }
      } catch {
        // leave previous label
      }
    }

    loadLastSync()
  }, [])

  useEffect(() => {
    const loadComponents = async () => {
      if (!selectedTeamKey) {
        setComponentOptions([])
        setSelectedComponent('')
        return
      }
      try {
        const token = localStorage.getItem('token')
        const params = new URLSearchParams()
        params.set('filters', '1')
        params.set('teamKey', selectedTeamKey)
        const response = await fetch(`/api/test-case-sources?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await response.json()
        if (!response.ok) {
          return
        }
        const components = Array.isArray(data.components) ? data.components : []
        setComponentOptions(components)
        setSelectedComponent((current) =>
          components.includes(current) ? current : ''
        )
      } catch {
        setComponentOptions([])
      }
    }

    loadComponents()
  }, [selectedTeamKey])

  useEffect(() => {
    if (!selectedTeamKey && teamKeys.length > 0) {
      setSelectedTeamKey(teamKeys[0])
    }
  }, [selectedTeamKey, teamKeys])

  const loadCases = useCallback(
    async (teamKeyValue: string, queryValue: string, componentValue: string) => {
      if (!teamKeyValue) return
      setCasesLoading(true)
      setCasesError('')
      setCasesTotal(0)
      setCasesLoaded(0)
      const requestId = loadRequestRef.current + 1
      loadRequestRef.current = requestId
      try {
        const token = localStorage.getItem('token')
        const pageSize = 500
        let offset = 0
        let total = 0
        let allTickets: SourceTicket[] = []

        while (true) {
          if (loadRequestRef.current !== requestId) return
          const params = new URLSearchParams()
          params.set('teamKey', teamKeyValue)
          if (queryValue.trim()) params.set('q', queryValue.trim())
          if (componentValue.trim()) params.set('component', componentValue.trim())
          params.set('limit', String(pageSize))
          params.set('offset', String(offset))
          const response = await fetch(`/api/test-case-sources?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const data = await response.json()
          if (!response.ok) {
            throw new Error(data.error || 'Failed to load QA history tickets')
          }

          const batch: SourceTicket[] = data.tickets || []
          total = typeof data.total === 'number' ? data.total : total
          allTickets = [...allTickets, ...batch]
          setSourceTickets(allTickets)
          setCasesTotal(total)
          setCasesLoaded(allTickets.length)

          if (data.lastSync?.finishedAt) {
            const label = new Date(data.lastSync.finishedAt).toLocaleString()
            setLastSyncLabel(
              data.lastSync.status === 'FAILED'
                ? `Last sync failed: ${label}`
                : `Last sync: ${label}`
            )
            setLastSyncStatus(data.lastSync.status || null)
          } else {
            setLastSyncLabel('Not synced yet')
            setLastSyncStatus(null)
          }

          if (allTickets.length >= total || batch.length === 0) {
            break
          }
          offset += batch.length
        }
      } catch (error) {
        setCasesError(error instanceof Error ? error.message : 'Failed to load QA history tickets')
      } finally {
        if (loadRequestRef.current === requestId) {
          setCasesLoading(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    if (!selectedTeamKey) return
    loadCases(selectedTeamKey, caseQuery, selectedComponent)
  }, [selectedTeamKey, caseQuery, selectedComponent, loadCases])

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
          model: selectedModel || undefined,
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
      setGenerationSuccess(
        data.meta?.usedCondensedContext
          ? 'Generated with condensed context (timeout fallback).'
          : 'Generated test case from historical context.'
      )
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

  const handleSaveToDocs = async (
    scenariosInput: Array<{
      title: string
      steps: string
      expectedResult?: string | null
      notes?: string | null
    }>
  ) => {
    if (!targetTicketId.trim()) {
      setSaveDocsError('Set the target Jira ticket ID before saving to Docs.')
      return
    }
    setSaveDocsError('')
    setSaveDocsSuccess('')
    setSaveDocsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/test-cases/save-docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetTicketId: targetTicketId.trim(),
          theme: theme.trim() || targetTicketId.trim(),
          prerequisites,
          objective,
          scenarios: scenariosInput,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save to Docs')
      }
      setSaveDocsSuccess('Saved regression pack to Docs.')
    } catch (error) {
      setSaveDocsError(error instanceof Error ? error.message : 'Failed to save to Docs')
    } finally {
      setSaveDocsLoading(false)
    }
  }

  const handleImport = async () => {
    setImportError('')
    setImportSummary('')
    setImporting(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/test-case-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync Jira tickets')
      }
      const lastSyncLabel = data.lastSyncAt
        ? new Date(data.lastSyncAt).toLocaleString()
        : 'n/a'
      setImportSummary(
        `Synced ${data.processed ?? 0} ticket(s). Inserted ${data.inserted ?? 0}. Updated ${
          data.updated ?? 0
        }. Teams: ${data.teamCount ?? 0}. Last sync: ${lastSyncLabel}.`
      )
      if (data.lastSyncAt) {
        const label = new Date(data.lastSyncAt).toLocaleString()
        setLastSyncLabel(`Last sync: ${label}`)
        setLastSyncStatus('SUCCESS')
      }
      if (selectedTeamKey) {
        await loadCases(selectedTeamKey, caseQuery, selectedComponent)
      }
      const summaryResponse = await fetch('/api/test-case-sources?summary=1', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json()
        const counts: Record<string, number> = {}
        const teams = Array.isArray(summaryData.teamCounts)
          ? summaryData.teamCounts.map((entry: { teamKey: string }) => entry.teamKey)
          : []
        if (Array.isArray(summaryData.teamCounts)) {
          for (const entry of summaryData.teamCounts) {
            if (entry?.teamKey) {
              counts[entry.teamKey] = entry.count ?? 0
            }
          }
        }
        setTeamKeys(teams)
        setTeamCounts(counts)
        setTotalSynced(
          Object.values(counts).reduce((sum, value) => sum + value, 0)
        )
        setMissingComponentCount(summaryData.missingComponentCount ?? 0)
        setMissingTeamCount(summaryData.missingTeamCount ?? 0)
        setMissingJiraUrl(summaryData.missingUrl ?? null)
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to sync Jira tickets')
    } finally {
      setImporting(false)
    }
  }

  return (
    <main className="min-h-screen h-screen overflow-hidden">
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 2xl:px-12 py-6 h-full flex flex-col gap-4">
        <div className="flex-none">
          <h1 className="text-3xl font-bold text-white">Test Management</h1>
          <p className="text-sm text-slate-400">
            Create reusable test cases by theme, then publish manual templates to Jira.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] flex-1 min-h-0">
          <div className="space-y-4 min-h-0 overflow-y-auto pr-1">

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

                  <div className="pt-2">
                    {saveDocsError ? (
                      <div className="text-xs text-red-300">{saveDocsError}</div>
                    ) : null}
                    {saveDocsSuccess ? (
                      <div className="text-xs text-emerald-300">{saveDocsSuccess}</div>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 px-3 text-xs w-full"
                      disabled={saveDocsLoading || !targetTicketId.trim()}
                      onClick={() =>
                        handleSaveToDocs(
                          scenarios.map((scenario) => ({
                            title: scenario.title,
                            steps: scenario.steps,
                            expectedResult: scenario.expectedResult,
                            notes: scenario.notes,
                          }))
                        )
                      }
                    >
                      {saveDocsLoading ? 'Saving...' : 'Save regression pack to Docs'}
                    </Button>
                  </div>
                </div>

              </CardContent>
            </Card>

            {(missingComponentCount > 0 || missingTeamCount > 0) && (
              <Card className="glass-card border-amber-500/30">
                <CardHeader>
                  <CardTitle className="text-sm text-amber-200">
                    Missing classification
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Tickets without component or team identification.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-slate-300 space-y-2">
                  <div>Missing component: {missingComponentCount}</div>
                  <div>Missing team (component + application empty): {missingTeamCount}</div>
                  {missingJiraUrl ? (
                    <a
                      href={missingJiraUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-300 hover:text-amber-200 underline"
                    >
                      See list in Jira
                    </a>
                  ) : (
                    <div className="text-[11px] text-slate-500">
                      Configure Jira base URL to open the list in Jira.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4 min-h-0 overflow-y-auto pr-1">
            <Card className="glass-card border-slate-700/30">
              <CardHeader>
                <CardTitle className="text-white text-lg">Context</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Select the team, target ticket, and theme before building or importing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3">
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
                        {team} {teamCounts[team] ? `(${teamCounts[team]})` : ''}
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
                    {totalSynced > 0 ? (
                      <span className="text-[11px] text-slate-500">
                        Total synced tickets: {totalSynced}
                      </span>
                    ) : null}
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

            <Card className="glass-card border-slate-700/30">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-300" />
                      QA history (synced Jira tickets)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      Sync all Jira tickets to build QA history for this team.
                    </CardDescription>
                    <div
                      className={`text-[11px] ${
                        lastSyncStatus === 'FAILED' ? 'text-red-300' : 'text-slate-500'
                      }`}
                    >
                      {lastSyncLabel}
                    </div>
                    {importing ? (
                      <div className="text-[11px] text-amber-300">Sync in progress...</div>
                    ) : null}
                  </div>
                  <Button
                    variant="secondary"
                    className="h-7 px-2 text-xs"
                    onClick={handleImport}
                    disabled={importing}
                  >
                    {importing ? 'Syncing...' : 'Sync tickets'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedTeamKey ? (
                  <div className="text-xs text-amber-300">
                    Select a team to view synced tickets.
                  </div>
                ) : null}
                {importError ? (
                  <div className="text-xs text-red-300">{importError}</div>
                ) : null}
                {importSummary ? (
                  <div className="text-xs text-emerald-300">{importSummary}</div>
                ) : null}
                <Input
                  value={caseQuery}
                  onChange={(event) => setCaseQuery(event.target.value)}
                  placeholder="Search by keyword (summary, comments, components)"
                  className="h-8 bg-slate-900/70 text-xs"
                />
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-slate-400">Component</Label>
                  {componentOptions.length > 0 ? (
                    <select
                      value={selectedComponent}
                      onChange={(event) => setSelectedComponent(event.target.value)}
                      className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200"
                    >
                      <option value="">All components</option>
                      {componentOptions.map((component) => (
                        <option key={component} value={component}>
                          {component}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-[11px] text-slate-500">
                      No components available for this team.
                    </div>
                  )}
                </div>
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
                  <div className="text-xs text-slate-500">
                    Loading QA history... {casesLoaded}/{casesTotal || '?'}
                  </div>
                ) : casesError ? (
                  <div className="text-xs text-red-300">{casesError}</div>
                ) : visibleSourceTickets.length === 0 ? (
                  <div className="text-xs text-slate-500">
                    No QA history found yet. Sync tickets to start.
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

            <div className="space-y-2 rounded-lg border border-slate-700/40 bg-slate-900/50 p-3">
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
                Selected tickets: {Object.values(contextCaseIds).filter(Boolean).length}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-400">Model:</label>
                <select
                  value={selectedModel}
                  onChange={(event) => setSelectedModel(event.target.value)}
                  className="rounded border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-200 flex-1"
                >
                  <option value="">Default (claude-sonnet-4.5)</option>
                  {availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
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
                className="h-8 px-3 text-xs w-full"
                disabled={generationLoading}
                onClick={handleGenerateFromHistory}
              >
                {generationLoading ? 'Generating...' : 'Generate regression pack'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
