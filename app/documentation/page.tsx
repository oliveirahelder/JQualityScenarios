'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, Plus, ExternalLink, Zap, Search } from 'lucide-react'
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
  sprint?: { name: string } | null
  confluencePageId?: string | null
  confluenceUrl?: string | null
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

  useEffect(() => {
    fetchDrafts()
  }, [])

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

  const filteredDrafts = drafts.filter(draft => {
    const matchSearch = draft.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       draft.ticket?.jiraId?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = !filterStatus || draft.status === filterStatus
    return matchSearch && matchStatus
  })

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

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fadeIn">
          <div>
            <h1 className="text-4xl font-bold text-white">Documentation Drafts</h1>
            <p className="text-slate-400 mt-1">Review, edit, and publish documentation</p>
          </div>
          <Button className="btn-glow bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Draft
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Drafts List */}
          <div className="lg:col-span-7 animate-slideInLeft">
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
                {filteredDrafts.map((draft, idx) => (
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
                              Ticket: <span className="font-mono text-slate-300">{draft.ticket?.jiraId || 'N/A'}</span>
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
                ))}
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
                  <CardDescription className="mt-2 font-mono">
                    {selectedDraft.ticket?.jiraId || 'Ticket N/A'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
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
    </main>
  )
}
