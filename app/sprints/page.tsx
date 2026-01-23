'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar, Plus, AlertCircle, ChevronRight, Zap, RefreshCw, ChevronDown } from 'lucide-react'

export default function SprintsPage() {
  const [sprints, setSprints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewSprintForm, setShowNewSprintForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [syncSuccess, setSyncSuccess] = useState('')
  const [expandedSprintId, setExpandedSprintId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    jiraId: '',
    name: '',
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    fetchSprints()
  }, [])

  const fetchSprints = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/sprints', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSprints(data.sprints)
      }
    } catch (error) {
      console.error('Error fetching sprints:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/sprints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        setSprints([data.sprint, ...sprints])
        setShowNewSprintForm(false)
        setFormData({ jiraId: '', name: '', startDate: '', endDate: '' })
      }
    } catch (error) {
      console.error('Error creating sprint:', error)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncError('')
    setSyncSuccess('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/sprints/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'active' }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync sprints')
      }

      await fetchSprints()
      setSyncSuccess('Sprints synced from Jira.')
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to sync sprints')
    } finally {
      setSyncing(false)
    }
  }

  const toggleSprintTickets = (sprintId: string) => {
    setExpandedSprintId((prev) => (prev === sprintId ? null : sprintId))
  }

  const filteredSprints = sprints.filter(sprint => {
    if (filter === 'active') return sprint.status === 'ACTIVE'
    if (filter === 'completed') return sprint.status === 'COMPLETED'
    return true
  })

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fadeIn">
          <div>
            <h1 className="text-4xl font-bold text-white">Sprint Management</h1>
            <p className="text-slate-400 mt-1">Create and track sprints from Jira</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800/50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Jira'}
            </Button>
            <Button 
              onClick={() => setShowNewSprintForm(!showNewSprintForm)}
              className="btn-glow bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Sprint
            </Button>
          </div>
        </div>

        {(syncError || syncSuccess) && (
          <div className="mb-6">
            {syncError && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-300 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{syncError}</span>
              </div>
            )}
            {syncSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/50 rounded-lg text-green-300 text-sm flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>{syncSuccess}</span>
              </div>
            )}
          </div>
        )}

        {/* New Sprint Form */}
        {showNewSprintForm && (
          <Card className="glass-card border-slate-700/30 mb-8 animate-slideInUp">
            <CardHeader className="border-b border-slate-700/30">
              <CardTitle>Create New Sprint</CardTitle>
              <CardDescription>Link a Jira sprint to QABOT for tracking</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCreateSprint} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Jira Sprint ID</label>
                    <Input
                      placeholder="e.g., SPRINT-123"
                      value={formData.jiraId}
                      onChange={(e) => setFormData({ ...formData, jiraId: e.target.value })}
                      required
                      className="bg-slate-800/50 border-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Sprint Name</label>
                    <Input
                      placeholder="e.g., Sprint 45 - Q1 Features"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="bg-slate-800/50 border-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Start Date</label>
                    <Input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                      className="bg-slate-800/50 border-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">End Date</label>
                    <Input
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                      className="bg-slate-800/50 border-slate-700"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewSprintForm(false)}
                    className="border-slate-700"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="btn-glow bg-gradient-to-r from-blue-600 to-blue-700">
                    Create Sprint
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-8">
          {(['all', 'active', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                filter === tab
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                  : 'text-slate-400 hover:text-slate-300 border border-transparent hover:border-slate-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Sprints List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin">
              <Zap className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-slate-400 mt-4">Loading sprints...</p>
          </div>
        ) : filteredSprints.length === 0 ? (
          <Card className="glass-card border-slate-700/30">
            <CardContent className="pt-12 text-center">
              <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-300 mb-4">
                {filter === 'all' 
                  ? 'No sprints yet. Create one to get started.' 
                  : `No ${filter} sprints found.`}
              </p>
              {filter === 'all' && (
                <Button 
                  onClick={() => setShowNewSprintForm(true)}
                  className="btn-glow bg-gradient-to-r from-blue-600 to-blue-700"
                >
                  Create First Sprint
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredSprints.map((sprint, idx) => (
              <Card 
                key={sprint.id} 
                className="glass-card border-slate-700/30 hover:border-blue-500/50 transition-all duration-300 group cursor-pointer animate-slideInUp"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {sprint.name}
                        </h3>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          sprint.status === 'ACTIVE'
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : sprint.status === 'COMPLETED'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                        }`}>
                          {sprint.status}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-6 text-sm">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Calendar className="w-4 h-4 text-blue-400" />
                          <span>
                            {new Date(sprint.startDate).toLocaleDateString()} → {new Date(sprint.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-slate-400">
                          <span className="font-mono text-slate-500">ID: {sprint.jiraId}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700/30">
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Tickets</div>
                          <div className="text-xl font-bold text-white">{sprint.tickets?.length || 0}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Draft Docs</div>
                          <div className="text-xl font-bold text-white">{sprint.documentationDrafts?.length || 0}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Progress</div>
                          <div className="text-xl font-bold text-blue-400">--</div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => toggleSprintTickets(sprint.id)}
                          className="text-slate-300 hover:text-white hover:bg-slate-800/50"
                        >
                          <ChevronDown className={`w-4 h-4 mr-2 transition-transform ${expandedSprintId === sprint.id ? 'rotate-180' : ''}`} />
                          {expandedSprintId === sprint.id ? 'Hide tickets' : 'View tickets'}
                        </Button>
                      </div>

                      {expandedSprintId === sprint.id && (
                        <div className="mt-4 rounded-lg border border-slate-700/30 bg-slate-900/30 p-4">
                          {sprint.tickets?.length ? (
                            <div className="space-y-2">
                              {sprint.tickets.map((ticket: any) => (
                                <div key={ticket.id} className="flex items-center justify-between text-sm">
                                  <div className="text-slate-200">
                                    <span className="font-mono text-slate-400 mr-2">{ticket.jiraId}</span>
                                    {ticket.summary}
                                  </div>
                                  <span className="text-xs text-slate-400">{ticket.status}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400 text-sm">No tickets for this sprint.</div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Link href={`/sprints/${sprint.id}`}>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 group-hover:translate-x-1 transition-all"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
