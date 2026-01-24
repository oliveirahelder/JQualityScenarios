'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar, Plus, AlertCircle, ChevronRight, Zap, RefreshCw, ChevronDown } from 'lucide-react'

export default function SprintsPage() {
  const [sprints, setSprints] = useState<any[]>([])
  const [jiraBaseUrl, setJiraBaseUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [syncSuccess, setSyncSuccess] = useState('')
  const [expandedSprintId, setExpandedSprintId] = useState<string | null>(null)
  const [filterBySprint, setFilterBySprint] = useState<Record<string, 'all' | 'dev' | 'closed'>>({})
  const [sortBySprint, setSortBySprint] = useState<
    Record<string, 'status' | 'story' | 'bounce'>
  >({})
  const [syncBoardUrl, setSyncBoardUrl] = useState('')
  const [syncBoardIds, setSyncBoardIds] = useState('')
  const searchParams = useSearchParams()

  const getSprintProgress = (tickets: any[] | undefined) => {
    const total = tickets?.length || 0
    if (!total) return { closed: 0, total: 0 }
    const closed = tickets.filter((ticket) => {
      const status = (ticket?.status || '').toLowerCase()
      return status.includes('done') || status.includes('closed') || status.includes('resolved')
    }).length
    return { closed, total }
  }

  const getSprintSuccess = (sprint: any) => {
    const total =
      typeof sprint?.totalTickets === 'number'
        ? sprint.totalTickets
        : sprint?.tickets?.length || 0
    const closed =
      typeof sprint?.closedTickets === 'number'
        ? sprint.closedTickets
        : getSprintProgress(sprint?.tickets).closed
    const percent = total ? Math.round((closed / total) * 1000) / 10 : 0
    return { total, closed, percent }
  }

  const formatStoryPoints = (value: number | null | undefined) => {
    if (value == null) return '--'
    return Number.isInteger(value) ? value.toString() : value.toFixed(1)
  }

  const getDaysRemaining = (endDate: string | Date) => {
    const end = new Date(endDate)
    if (Number.isNaN(end.getTime())) return '--'
    const now = new Date()
    const diffMs = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return diffDays < 0 ? '0' : diffDays.toString()
  }

  const isDevStatus = (status: string | undefined) => {
    const value = (status || '').toLowerCase()
    return (
      value.includes('in progress') ||
      value.includes('in development') ||
      value.includes('in refinement')
    )
  }

  const isClosedStatus = (status: string | undefined) => {
    const value = (status || '').toLowerCase()
    return value.includes('closed') || value.includes('done') || value.includes('resolved')
  }

  const getJiraTicketUrl = (ticketKey: string) => {
    if (!jiraBaseUrl || !ticketKey) return ''
    return `${jiraBaseUrl.replace(/\/$/, '')}/browse/${ticketKey}`
  }

  const sortTickets = (tickets: any[], sortKey: 'status' | 'story' | 'bounce') => {
    const copy = [...tickets]
    switch (sortKey) {
      case 'story':
        return copy.sort((a, b) => (b.storyPoints || 0) - (a.storyPoints || 0))
      case 'bounce':
        return copy.sort((a, b) => (b.qaBounceBackCount || 0) - (a.qaBounceBackCount || 0))
      case 'status':
      default:
        return copy.sort((a, b) => (a.status || '').localeCompare(b.status || ''))
    }
  }

  useEffect(() => {
    fetchSprints()
  }, [])

  useEffect(() => {
    if (!searchParams || sprints.length === 0) return
    const sprintId = searchParams.get('sprintId')
    const devOnly = searchParams.get('devOnly') === '1'
    const closedOnly = searchParams.get('closedOnly') === '1'
    if (!sprintId) return
    setExpandedSprintId(sprintId)
    const nextFilter = devOnly ? 'dev' : closedOnly ? 'closed' : 'all'
    setFilterBySprint((prev) => ({
      ...prev,
      [sprintId]: nextFilter,
    }))
  }, [searchParams, sprints])

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
        setJiraBaseUrl(data.jiraBaseUrl || '')
      }
    } catch (error) {
      console.error('Error fetching sprints:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncError('')
    setSyncSuccess('')

    try {
      if (!syncBoardUrl.trim() && !syncBoardIds.trim()) {
        throw new Error('Provide a Board URL or Board IDs to sync.')
      }

      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/sprints/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'active',
          boardUrl: syncBoardUrl.trim() || undefined,
          boardIds: syncBoardIds.trim() || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync sprints')
      }

      await fetchSprints()
      const count = data?.result?.sprintCount ?? data?.result?.activeSprints?.sprintCount
      setSyncSuccess(
        typeof count === 'number'
          ? `Sprints synced from Jira. Active sprints: ${count}.`
          : 'Sprints synced from Jira.'
      )
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
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            placeholder="Board URL (RapidBoard.jspa?rapidView=123)"
            value={syncBoardUrl}
            onChange={(e) => setSyncBoardUrl(e.target.value)}
            className="bg-slate-800/50 border-slate-700"
          />
          <Input
            placeholder="Board IDs (optional if URL provided)"
            value={syncBoardIds}
            onChange={(e) => setSyncBoardIds(e.target.value)}
            disabled={Boolean(syncBoardUrl.trim())}
            className="bg-slate-800/50 border-slate-700 disabled:opacity-50"
          />
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

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-700/30">
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Tickets</div>
                          <div className="text-xl font-bold text-white">{sprint.tickets?.length || 0}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Draft Docs</div>
                          <div className="text-xl font-bold text-white">{sprint.documentationDrafts?.length || 0}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Success</div>
                          {(() => {
                            const { closed, total, percent } = getSprintSuccess(sprint)
                            return (
                              <>
                                <div className="text-xl font-bold text-blue-400">
                                  {total ? `${percent}%` : '--'}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {total ? `Tickets closed: ${closed} / ${total}` : 'Tickets closed: --'}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {total ? `Tickets remaining: ${total - closed}` : 'Tickets remaining: --'}
                                </div>
                              </>
                            )
                          })()}
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Story Points</div>
                          {(() => {
                            const totalTickets = sprint.tickets?.length || 0
                            const closedTickets =
                              typeof sprint.closedTickets === 'number'
                                ? sprint.closedTickets
                                : getSprintProgress(sprint.tickets).closed
                            const remainingTickets = Math.max(0, totalTickets - closedTickets)
                            const totalStoryPoints =
                              typeof sprint.storyPointsTotal === 'number'
                                ? sprint.storyPointsTotal
                                : (sprint.tickets || []).reduce(
                                    (sum: number, ticket: any) => sum + (ticket.storyPoints || 0),
                                    0
                                  )
                            const closedStoryPoints =
                              typeof sprint.storyPointsCompleted === 'number'
                                ? sprint.storyPointsCompleted
                                : (sprint.tickets || []).reduce((sum: number, ticket: any) => {
                                    const status = (ticket.status || '').toLowerCase()
                                    const isClosed =
                                      status.includes('closed') ||
                                      status.includes('done') ||
                                      status.includes('resolved')
                                    return sum + (isClosed ? ticket.storyPoints || 0 : 0)
                                  }, 0)
                            const remainingStoryPoints = Math.max(
                              0,
                              totalStoryPoints - closedStoryPoints
                            )
                            return (
                              <>
                                <div className="text-xl font-bold text-white">
                                  {totalStoryPoints
                                    ? `${Math.round((closedStoryPoints / totalStoryPoints) * 1000) / 10}%`
                                    : '--'}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                  SP closed: {formatStoryPoints(closedStoryPoints)} / {formatStoryPoints(totalStoryPoints)}
                                </div>
                                <div className="text-xs text-slate-400">
                                  SP remaining: {formatStoryPoints(remainingStoryPoints)}
                                </div>
                              </>
                            )
                          })()}
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Days Left</div>
                          <div className="text-xl font-bold text-white">
                            {getDaysRemaining(sprint.endDate)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => toggleSprintTickets(sprint.id)}
                            className="text-slate-300 hover:text-white hover:bg-slate-800/50"
                          >
                            <ChevronDown className={`w-4 h-4 mr-2 transition-transform ${expandedSprintId === sprint.id ? 'rotate-180' : ''}`} />
                            {expandedSprintId === sprint.id ? 'Hide tickets' : 'View tickets'}
                          </Button>
                          <select
                            value={filterBySprint[sprint.id] || 'all'}
                            onChange={(event) =>
                              setFilterBySprint((prev) => ({
                                ...prev,
                                [sprint.id]: event.target.value as 'all' | 'dev' | 'closed',
                              }))
                            }
                            className="bg-slate-900/40 border border-slate-700/50 text-slate-200 text-xs rounded-md px-2 py-1"
                          >
                            <option value="all">All tickets</option>
                            <option value="dev">In Dev only</option>
                            <option value="closed">Closed only</option>
                          </select>
                          <select
                            value={sortBySprint[sprint.id] || 'status'}
                            onChange={(event) =>
                              setSortBySprint((prev) => ({
                                ...prev,
                                [sprint.id]: event.target.value as
                                  | 'status'
                                  | 'story'
                                  | 'bounce',
                              }))
                            }
                            className="bg-slate-900/40 border border-slate-700/50 text-slate-200 text-xs rounded-md px-2 py-1"
                          >
                            <option value="status">Status (A-Z)</option>
                            <option value="story">Story Points</option>
                            <option value="bounce">Bounce Back</option>
                          </select>
                        </div>
                      </div>

                      {expandedSprintId === sprint.id && (
                        <div className="mt-4 rounded-lg border border-slate-700/30 bg-slate-900/30 p-4">
                          {(() => {
                            const filterValue = filterBySprint[sprint.id] || 'all'
                            const filtered = (sprint.tickets || []).filter((ticket: any) => {
                              if (filterValue === 'dev' && !isDevStatus(ticket.status)) return false
                              if (filterValue === 'closed' && !isClosedStatus(ticket.status)) {
                                return false
                              }
                              return true
                            })
                            const sorted = sortTickets(
                              filtered,
                              sortBySprint[sprint.id] || 'status'
                            )
                            return sorted.length ? (
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-sm">
                                  <thead className="text-xs uppercase text-slate-400 border-b border-slate-800/60">
                                    <tr>
                                      <th className="py-2 pr-4">Ticket</th>
                                      <th className="py-2 pr-4">Summary</th>
                                      <th className="py-2 pr-4">Status</th>
                                      <th className="py-2 pr-4">SP</th>
                                      <th className="py-2 pr-4">PRs</th>
                                      <th className="py-2">Bounce</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                                    {sorted.map((ticket: any) => (
                                      <tr key={ticket.id} className="align-top">
                                        <td className="py-2 pr-4 font-mono text-slate-300">
                                          {jiraBaseUrl ? (
                                            <a
                                              href={getJiraTicketUrl(ticket.jiraId)}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-blue-300 hover:text-blue-200"
                                            >
                                              {ticket.jiraId}
                                            </a>
                                          ) : (
                                            ticket.jiraId
                                          )}
                                        </td>
                                        <td className="py-2 pr-4 text-slate-100 max-w-[320px]">
                                          <span className="block truncate" title={ticket.summary}>
                                            {ticket.summary}
                                          </span>
                                        </td>
                                        <td className="py-2 pr-4 text-slate-300">
                                          {ticket.status}
                                        </td>
                                        <td className="py-2 pr-4 text-slate-300">
                                          {ticket.storyPoints ?? 0}
                                        </td>
                                        <td className="py-2 pr-4 text-slate-300">
                                          {ticket.prCount ?? 0}
                                        </td>
                                        <td className="py-2 text-slate-300">
                                          {ticket.qaBounceBackCount ?? 0}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-slate-400 text-sm">No tickets for this sprint.</div>
                            )
                          })()}
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
