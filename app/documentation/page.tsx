'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, Plus, ExternalLink, Zap, Search, Layers, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'

type DocumentationDraft = {
  id: string
  title: string
  status: string
  content?: string | null
  requirements?: string | null
  technicalNotes?: string | null
  testResults?: string | null
  createdAt: string
  ticket?: { jiraId?: string | null } | null
  linkedTickets?: Array<{ ticket?: { jiraId?: string | null } | null }> | null
  sprint?: { name: string } | null
  confluencePageId?: string | null
  confluenceUrl?: string | null
}

type SearchResult = {
  id: string
  title: string
  type: 'jira_ticket' | 'confluence_page'
  url: string
  relevanceScore: number
  summary: string
}

const statusColors = {
  DRAFT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  UNDER_REVIEW: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  APPROVED: 'bg-green-500/20 text-green-300 border-green-500/30',
  PUBLISHED: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  REJECTED: 'bg-red-500/20 text-red-300 border-red-500/30',
}

export default function DocumentationPage() {
  const [drafts, setDrafts] = useState<DocumentationDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDraft, setSelectedDraft] = useState<DocumentationDraft | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'manual' | 'automation'>('manual')
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState<{
    title: string
    content: string
    requirements: string
    technicalNotes: string
    testResults: string
  } | null>(null)
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyType, setHistoryType] = useState<'all' | 'jira' | 'confluence'>('all')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historyConfluenceError, setHistoryConfluenceError] = useState('')
  const [historyConfluenceDiagnostics, setHistoryConfluenceDiagnostics] = useState<{
    baseUrl: string | null
    scope: { spaceKey?: string | null; spaceKeys?: string[]; parentPageId?: string | null; baseCql?: string | null; limit?: number | null }
    publishTarget?: { parentPageId?: string | null }
    resultsCount: number
  } | null>(null)
  const [historyRan, setHistoryRan] = useState(false)
  const [availableSpaces, setAvailableSpaces] = useState<Array<{ key: string; name: string }>>([])
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([])
  const [spacesLoading, setSpacesLoading] = useState(false)
  const [spacesError, setSpacesError] = useState('')
  const [historyResults, setHistoryResults] = useState<{
    jira: SearchResult[]
    confluence: SearchResult[]
  }>({ jira: [], confluence: [] })

  useEffect(() => {
    fetchDrafts()
  }, [])

  useEffect(() => {
    const storedSpaces = localStorage.getItem('confluenceSearchSpaces')
    if (storedSpaces) {
      try {
        const parsed = JSON.parse(storedSpaces)
        if (Array.isArray(parsed)) {
          setSelectedSpaces(
            parsed.filter((key) => typeof key === 'string' && key.trim().length > 0)
          )
        }
      } catch {
        // Ignore invalid storage.
      }
    }
  }, [])

  useEffect(() => {
    const fetchSpaces = async () => {
      setSpacesLoading(true)
      setSpacesError('')
      try {
        const token = localStorage.getItem('token')
        const response = await fetch('/api/confluence/spaces', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to load spaces')
        }
        const data = await response.json()
        setAvailableSpaces(data.spaces || [])
      } catch (error) {
        setSpacesError(error instanceof Error ? error.message : 'Failed to load spaces')
      } finally {
        setSpacesLoading(false)
      }
    }

    fetchSpaces()
  }, [])

  useEffect(() => {
    localStorage.setItem('confluenceSearchSpaces', JSON.stringify(selectedSpaces))
  }, [selectedSpaces])

  useEffect(() => {
    if (!selectedDraft) {
      setIsEditing(false)
      setEditDraft(null)
      return
    }
    setEditDraft({
      title: selectedDraft.title || '',
      content: selectedDraft.content || '',
      requirements: selectedDraft.requirements || '',
      technicalNotes: selectedDraft.technicalNotes || '',
      testResults: selectedDraft.testResults || '',
    })
    setActionError('')
  }, [selectedDraft])

  const fetchDrafts = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/documentation-drafts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setDrafts(data.drafts)
      }
    } catch (error) {
      console.error('Error fetching drafts:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchTerm = searchQuery.trim().toLowerCase()
  const getDraftTicketIds = (draft: DocumentationDraft) => {
    const ids = [
      draft.ticket?.jiraId,
      ...(draft.linkedTickets ?? []).map((link) => link.ticket?.jiraId),
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
    return Array.from(new Set(ids))
  }
  const filteredDrafts = drafts.filter((draft) => {
    const ticketIds = getDraftTicketIds(draft)
    const matchSearch = !searchTerm ||
      draft.title.toLowerCase().includes(searchTerm) ||
      ticketIds.some((id) => id.toLowerCase().includes(searchTerm))
    const matchStatus = !filterStatus || draft.status === filterStatus
    return matchSearch && matchStatus
  })
  const selectedDraftTicketIds = selectedDraft ? getDraftTicketIds(selectedDraft) : []

  const uniqueStatuses = Array.from(new Set(drafts.map(d => d.status)))

  const handleSaveDraft = async () => {
    if (!selectedDraft || !editDraft) return
    setSaving(true)
    setActionError('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/documentation-drafts/${selectedDraft.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editDraft.title,
          content: editDraft.content,
          requirements: editDraft.requirements,
          technicalNotes: editDraft.technicalNotes,
          testResults: editDraft.testResults,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update draft')
      }

      await fetchDrafts()
      setIsEditing(false)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update draft')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDraft = async () => {
    if (!selectedDraft) return
    const confirmDelete = window.confirm('Delete this draft? This cannot be undone.')
    if (!confirmDelete) return
    setSaving(true)
    setActionError('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/documentation-drafts/${selectedDraft.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete draft')
      }

      setSelectedDraft(null)
      await fetchDrafts()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete draft')
    } finally {
      setSaving(false)
    }
  }

  const handleHistorySearch = async () => {
    if (!historyQuery.trim()) return
    setHistoryLoading(true)
    setHistoryError('')
    try {
      if (historyType !== 'jira' && selectedSpaces.length === 0 && availableSpaces.length > 0) {
        throw new Error('Select at least one Confluence space to search.')
      }
      const token = localStorage.getItem('token')
      const spacesQuery =
        selectedSpaces.length > 0
          ? `&spaces=${encodeURIComponent(selectedSpaces.join(','))}`
          : ''
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(historyQuery)}&type=${historyType}&cache=false${spacesQuery}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to search')
      }

      const data = await response.json()
      setHistoryResults({
        jira: data.jiraResults || [],
        confluence: data.confluenceResults || [],
      })
      setHistoryConfluenceError(data.confluenceError || '')
      setHistoryConfluenceDiagnostics(data.confluenceDiagnostics || null)
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Failed to search')
    } finally {
      setHistoryLoading(false)
      setHistoryRan(true)
    }
  }

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fadeIn">
          <div>
            <h1 className="text-4xl font-bold text-white">Documentation Hub</h1>
            <p className="text-slate-400 mt-1">
              Search historical content, then review AI drafts before publishing.
            </p>
          </div>
          <div className="text-right">
            <Button
              className="btn-glow bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white"
              disabled={!historyRan}
              title={historyRan ? '' : 'Run a historical search before drafting'}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Draft
            </Button>
            {!historyRan && (
              <p className="text-xs text-slate-500 mt-2">Run a search to unlock drafting.</p>
            )}
          </div>
        </div>

        <div className="space-y-8">
          {/* Historical Search */}
          <Card className="glass-card border-slate-700/30 animate-slideInLeft">
            <CardHeader className="border-b border-slate-700/30">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-600/40 rounded-full px-2 py-0.5">
                      Step 1
                    </span>
                    <Search className="w-5 h-5 text-blue-400" />
                    Historical & Content Search
                  </CardTitle>
                  <CardDescription>
                    Search Jira issues and Confluence content before drafting to avoid duplicates.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={historyType}
                    onChange={(e) => setHistoryType(e.target.value as 'all' | 'jira' | 'confluence')}
                    className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="all">All</option>
                    <option value="jira">Jira</option>
                    <option value="confluence">Confluence</option>
                  </select>
                  <Button
                    size="sm"
                    onClick={handleHistorySearch}
                    disabled={historyLoading || !historyQuery.trim()}
                  >
                    {historyLoading ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  placeholder="Search similar tickets or topics..."
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  className="pl-10 bg-slate-800/50 border-slate-700"
                />
              </div>
              {historyError ? (
                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/40 rounded-md px-3 py-2">
                  {historyError}
                </div>
              ) : null}
              <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="text-xs uppercase text-slate-400">Spaces</div>
                  <button
                    type="button"
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                    onClick={() => setSelectedSpaces([])}
                  >
                    Clear
                  </button>
                </div>
                {spacesError ? (
                  <div className="text-xs text-amber-300 mb-2">{spacesError}</div>
                ) : null}
                {spacesLoading ? (
                  <div className="text-xs text-slate-500">Loading spaces...</div>
                ) : availableSpaces.length === 0 ? (
                  <div className="text-xs text-slate-500">No spaces returned.</div>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                    {availableSpaces.map((space) => (
                      <label key={space.key} className="flex items-center gap-2 text-xs text-slate-200">
                        <input
                          type="checkbox"
                          className="accent-blue-500"
                          checked={selectedSpaces.includes(space.key)}
                          onChange={(e) => {
                            setSelectedSpaces((prev) =>
                              e.target.checked
                                ? [...prev, space.key]
                                : prev.filter((key) => key !== space.key)
                            )
                          }}
                        />
                        <span className="font-semibold">{space.key}</span>
                        <span className="text-slate-500">{space.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="text-[11px] text-slate-500 mt-2">
                  Select at least one space to run a Confluence search.
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase text-slate-400 mb-3">
                    <Layers className="w-4 h-4 text-blue-400" />
                    Jira Tickets
                  </div>
                  {historyResults.jira.length === 0 ? (
                    <p className="text-xs text-slate-500">No Jira matches yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {historyResults.jira.map((item) => (
                        <a
                          key={item.id}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-md border border-slate-700/40 bg-slate-950/40 p-3 hover:border-blue-500/40"
                        >
                          <div className="text-sm text-white font-semibold">{item.title}</div>
                          <div className="text-xs text-slate-400 mt-1 line-clamp-2">{item.summary}</div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase text-slate-400 mb-3">
                    <FileText className="w-4 h-4 text-emerald-300" />
                    Confluence Pages
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Content excerpts are pulled from matching pages.
                  </p>
                  {historyConfluenceError ? (
                    <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded-md px-3 py-2 mb-3">
                      {historyConfluenceError}
                    </div>
                  ) : null}
                  {historyResults.confluence.length === 0 && historyConfluenceDiagnostics ? (
                    <div className="text-[11px] text-slate-500 mb-3 space-y-1">
                      <div>Base URL: {historyConfluenceDiagnostics.baseUrl || 'n/a'}</div>
                      <div>
                        Search scope:{' '}
                        {historyConfluenceDiagnostics.scope?.spaceKeys?.length
                          ? historyConfluenceDiagnostics.scope.spaceKeys.join(', ')
                          : historyConfluenceDiagnostics.scope?.spaceKey || 'all'}
                        {historyConfluenceDiagnostics.scope?.parentPageId
                          ? ` | Parent: ${historyConfluenceDiagnostics.scope?.parentPageId}`
                          : null}
                      </div>
                      {historyConfluenceDiagnostics.scope?.baseCql ? (
                        <div>CQL: {historyConfluenceDiagnostics.scope?.baseCql}</div>
                      ) : null}
                      {historyConfluenceDiagnostics.scope?.limit ? (
                        <div>Limit: {historyConfluenceDiagnostics.scope?.limit}</div>
                      ) : null}
                      {historyConfluenceDiagnostics.publishTarget?.parentPageId ? (
                        <div>
                          Publish target: {historyConfluenceDiagnostics.publishTarget.parentPageId}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {historyResults.confluence.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No Confluence matches yet. Try a full page title or review the Admin scope.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {historyResults.confluence.map((item) => (
                        <a
                          key={item.id}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-md border border-slate-700/40 bg-slate-950/40 p-3 hover:border-emerald-400/40"
                        >
                          <div className="text-sm text-white font-semibold">{item.title}</div>
                          <div className="text-xs text-slate-400 mt-1 line-clamp-2">{item.summary}</div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Drafts List */}
            <div className="lg:col-span-7 animate-slideInLeft">
              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-200">
                  <BookOpen className="w-4 h-4 text-emerald-300" />
                  <span className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-600/40 rounded-full px-2 py-0.5">
                    Step 2
                  </span>
                  <span className="font-semibold">Human-in-the-Loop Drafting</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  AI drafts are reviewed, edited, and validated before publishing to Confluence.
                </p>
              </div>
              {/* Search and Filter */}
              <div className="mb-6 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setViewMode('manual')}
                  className={`px-3 py-1.5 rounded-lg font-medium text-xs uppercase tracking-wide transition-all ${
                    viewMode === 'manual'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-300 border border-transparent hover:border-slate-700'
                  }`}
                >
                  Manual
                </button>
                <button
                  onClick={() => setViewMode('automation')}
                  className={`px-3 py-1.5 rounded-lg font-medium text-xs uppercase tracking-wide transition-all ${
                    viewMode === 'automation'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-300 border border-transparent hover:border-slate-700'
                  }`}
                >
                  Automation
                </button>
                <span className="text-xs text-slate-500 ml-2">
                  Theme: {selectedDraft?.title || 'Select a draft'}
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  placeholder="Search by title or ticket ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-800/50 border-slate-700"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setFilterStatus(null)}
                  className={`px-3 py-1.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                    !filterStatus
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-300 border border-transparent hover:border-slate-700'
                  }`}
                >
                  All
                </button>
                {uniqueStatuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                      filterStatus === status
                        ? `${statusColors[status as keyof typeof statusColors]} border`
                        : 'text-slate-400 hover:text-slate-300 border border-transparent hover:border-slate-700'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Drafts */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin">
                  <Zap className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-slate-400 mt-4">Loading drafts...</p>
              </div>
            ) : filteredDrafts.length === 0 ? (
              <Card className="glass-card border-slate-700/30">
                <CardContent className="pt-12 text-center pb-12">
                  <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
                  <p className="text-slate-300">
                    {searchQuery ? 'No matching drafts found.' : 'No documentation drafts yet.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredDrafts.map((draft, idx) => {
                  const linkedTicketIds = getDraftTicketIds(draft)
                  return (
                    <Card
                      key={draft.id}
                      className={`glass-card border-slate-700/30 hover:border-blue-500/50 transition-all duration-300 cursor-pointer group animate-slideInUp ${
                        selectedDraft?.id === draft.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : ''
                      }`}
                      onClick={() => setSelectedDraft(draft)}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-start gap-3 mb-3">
                              <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors flex-1">
                                {draft.title}
                              </h3>
                              <div className={`badge ${statusColors[draft.status as keyof typeof statusColors]} border`}>
                                {draft.status}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm mb-3">
                              <div className="text-slate-400">
                                Linked tickets:{' '}
                                <span className="font-mono text-slate-300">
                                  {linkedTicketIds.length > 0 ? linkedTicketIds.join(', ') : 'N/A'}
                                </span>
                              </div>
                              {draft.sprint && (
                                <div className="text-slate-400">
                                  Sprint: <span className="text-slate-300">{draft.sprint.name}</span>
                                </div>
                              )}
                            </div>

                            <p className="text-sm text-slate-400 line-clamp-2">
                              {viewMode === 'automation'
                                ? draft.technicalNotes || draft.content || 'No automation scenarios yet.'
                                : draft.testResults || draft.content || 'No manual scenarios yet.'}
                            </p>

                            <div className="mt-3 text-xs text-slate-500">
                              Created {new Date(draft.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {/* Draft Details */}
          <div className="lg:col-span-5 animate-slideInRight">
            {selectedDraft ? (
              <Card className="glass-card border-slate-700/30 sticky top-24">
                <CardHeader className="border-b border-slate-700/30">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <BookOpen className="w-5 h-5 text-orange-400 mt-0.5" />
                    <div className={`badge ${statusColors[selectedDraft.status as keyof typeof statusColors]} border`}>
                      {selectedDraft.status}
                    </div>
                  </div>
                  <CardTitle className="text-lg">{selectedDraft.title}</CardTitle>
                  <CardDescription className="mt-2">
                    <span className="text-slate-400">Linked tickets:</span>{' '}
                    <span className="font-mono text-slate-200">
                      {selectedDraftTicketIds.length > 0 ? selectedDraftTicketIds.join(', ') : 'N/A'}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase mb-2">
                        Theme
                      </p>
                      {isEditing ? (
                        <Input
                          value={editDraft?.title || ''}
                          onChange={(e) =>
                            setEditDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                          }
                          className="bg-slate-900/40 border-slate-700/40 text-slate-200"
                        />
                      ) : (
                        <div className="text-sm text-slate-200 bg-slate-900/40 border border-slate-700/40 rounded-lg p-3">
                          {selectedDraft.title}
                        </div>
                      )}
                    </div>
                    {actionError ? (
                      <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/40 rounded-md px-3 py-2">
                        {actionError}
                      </div>
                    ) : null}

                    {viewMode === 'automation' ? (
                      <div>
                        <p className="text-xs text-slate-400 font-semibold uppercase mb-2">
                          Gherkin Scenarios
                        </p>
                        {isEditing ? (
                          <textarea
                            value={editDraft?.technicalNotes || ''}
                            onChange={(e) =>
                              setEditDraft((prev) => (prev ? { ...prev, technicalNotes: e.target.value } : prev))
                            }
                            rows={8}
                            className="w-full text-sm text-slate-200 bg-slate-900/40 border border-slate-700/40 rounded-lg p-3 font-mono"
                          />
                        ) : (
                          <div className="text-sm text-slate-200 whitespace-pre-wrap bg-slate-900/40 border border-slate-700/40 rounded-lg p-3 font-mono">
                            {selectedDraft.technicalNotes || 'No gherkin scenarios saved yet.'}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {viewMode === 'manual' ? (
                      <div>
                        <p className="text-xs text-slate-400 font-semibold uppercase mb-2">
                          Manual QA (Jira Table)
                        </p>
                        {isEditing ? (
                          <textarea
                            value={editDraft?.testResults || ''}
                            onChange={(e) =>
                              setEditDraft((prev) => (prev ? { ...prev, testResults: e.target.value } : prev))
                            }
                            rows={8}
                            className="w-full text-sm text-slate-200 bg-slate-900/40 border border-slate-700/40 rounded-lg p-3 font-mono"
                          />
                        ) : (
                          <div className="text-sm text-slate-200 whitespace-pre-wrap bg-slate-900/40 border border-slate-700/40 rounded-lg p-3 font-mono">
                            {selectedDraft.testResults || 'No manual scenarios saved yet.'}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {selectedDraft.confluencePageId && (
                      <div>
                        <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Confluence</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 group"
                          onClick={() => {
                            if (selectedDraft.confluenceUrl) {
                              window.open(selectedDraft.confluenceUrl, '_blank')
                            }
                          }}
                        >
                          <ExternalLink className="w-4 h-4 mr-2 group-hover:translate-x-0.5 transition-transform" />
                          View on Confluence
                        </Button>
                      </div>
                    )}

                    <div className="pt-6 border-t border-slate-700/30 space-y-2">
                      <Button
                        variant="outline"
                        className="w-full border-slate-700 hover:border-slate-600"
                        onClick={() => setIsEditing((prev) => !prev)}
                      >
                        {isEditing ? 'Cancel Edit' : 'Edit Draft'}
                      </Button>
                      {isEditing ? (
                        <Button
                          className="w-full btn-glow bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600"
                          onClick={handleSaveDraft}
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        className="w-full border-red-500/40 text-red-300 hover:border-red-400 hover:text-red-200"
                        onClick={handleDeleteDraft}
                        disabled={saving}
                      >
                        Delete Draft
                      </Button>
                      {selectedDraft.status === 'DRAFT' && (
                        <Button className="w-full btn-glow bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600">
                          Submit for Review
                        </Button>
                      )}
                      {selectedDraft.status === 'APPROVED' && (
                        <Button className="w-full btn-glow bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600">
                          Publish to Confluence
                        </Button>
                      )}
                      {selectedDraft.status === 'UNDER_REVIEW' && (
                        <Button variant="outline" className="w-full border-slate-700 text-slate-300">
                          Awaiting Review...
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass-card border-slate-700/30">
                <CardContent className="pt-12 text-center pb-12">
                  <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-3 opacity-50" />
                  <p className="text-slate-400 text-sm">
                    Select a draft to view details and take actions
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        </div>
      </div>
    </main>
  )
}
