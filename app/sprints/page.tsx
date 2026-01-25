'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, AlertCircle, ChevronRight, Zap, RefreshCw, Code2, CheckSquare, FileText } from 'lucide-react'

export default function SprintsPage() {
  type SprintTicket = {
    id: string
    jiraId: string
    summary?: string | null
    status?: string | null
    assignee?: string | null
    storyPoints?: number | null
    qaBounceBackCount?: number | null
    prCount?: number | null
    devInsights?: Array<{
      id: string
      prUrl?: string | null
      aiAnalysis?: string | null
      detectedImpactAreas?: string | null
    }>
    testScenarios?: Array<{
      id: string
      status: string
    }>
  }

  type SprintSnapshotTotals = {
    plannedTickets?: number | null
    finishedTickets?: number | null
    workedTickets?: number | null
    qaDoneTickets?: number | null
    storyPointsTotal?: number | null
    storyPointsClosed?: number | null
  }

  type SprintItem = {
    id: string
    jiraId: string
    name: string
    status: string
    startDate: string | Date
    endDate: string | Date
    totalTickets?: number | null
    closedTickets?: number | null
    storyPointsTotal?: number | null
    storyPointsCompleted?: number | null
    snapshotTotals?: SprintSnapshotTotals | null
    tickets?: SprintTicket[]
    documentationStats?: {
      total: number
      draft: number
      underReview: number
      approved: number
      published: number
    }
    lastSyncedAt?: Date | string
  }

  const [sprints, setSprints] = useState<SprintItem[]>([])
  const [jiraBaseUrl, setJiraBaseUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [jiraBoardId, setJiraBoardId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [selectedSprintName, setSelectedSprintName] = useState('')
  const [filterBySprint, setFilterBySprint] = useState<
    Record<string, 'all' | 'dev' | 'closed' | 'bounce'>
  >({})
  const [sortBySprint, setSortBySprint] = useState<
    Record<string, 'status' | 'story' | 'bounce'>
  >({})
  const [assigneeFilterBySprint, setAssigneeFilterBySprint] = useState<Record<string, string>>({})
  const [expandedSprints, setExpandedSprints] = useState<Record<string, boolean>>({})
  const [userRole, setUserRole] = useState<string>('')
  const [syncingSprintId, setSyncingSprintId] = useState<string | null>(null)
  const searchParams = useSearchParams()

  const getSprintProgress = (tickets: SprintTicket[] | undefined) => {
    const total = tickets?.length || 0
    if (!total) return { closed: 0, total: 0 }
    const closed = (tickets || []).filter((ticket) => {
      const status = (ticket?.status || '').toLowerCase()
      return status.includes('closed')
    }).length
    return { closed, total }
  }

  const getSprintSuccess = (sprint: SprintItem) => {
    const total = getPlannedTickets(sprint)
    const finished = getFinishedTickets(sprint)
    const percent = total ? Math.round((finished / total) * 1000) / 10 : 0
    return { total, finished, percent }
  }

  const getFinishedTickets = (sprint: SprintItem) => {
    const finished = sprint?.snapshotTotals?.finishedTickets
    if (typeof finished === 'number') return finished
    const worked = sprint?.snapshotTotals?.workedTickets
    if (typeof worked === 'number') return worked
    if (typeof sprint?.closedTickets === 'number') return sprint.closedTickets
    return getSprintProgress(sprint?.tickets).closed
  }

  const getPlannedTickets = (sprint: SprintItem) => {
    const planned = sprint?.snapshotTotals?.plannedTickets
    if (typeof planned === 'number') return planned
    return typeof sprint?.totalTickets === 'number'
      ? sprint.totalTickets
      : sprint?.tickets?.length || 0
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

  const getLastSyncTime = (lastSyncedAt: Date | string | undefined) => {
    if (!lastSyncedAt) return '--'
    const syncDate = new Date(lastSyncedAt)
    const now = new Date()
    const diffMs = now.getTime() - syncDate.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  const syncSprintFromJira = async (sprintId: string) => {
    try {
      setSyncingSprintId(sprintId)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/sprints/sync?type=active', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        // Refresh sprints data
        await fetchSprints()
      }
    } catch (error) {
      console.error('Error syncing sprint:', error)
    } finally {
      setSyncingSprintId(null)
    }
  }

  const getImpactAreas = (ticket: SprintTicket) => {
    const devInsight = ticket.devInsights?.[0]
    if (!devInsight?.detectedImpactAreas) return []
    try {
      const areas = JSON.parse(devInsight.detectedImpactAreas)
      return Array.isArray(areas) ? areas : []
    } catch {
      return []
    }
  }

  const getScenariosCount = (ticket: SprintTicket) => {
    return ticket.testScenarios?.length || 0
  }

  const getImpactColor = (area: string) => {
    const highRisk = ['DB Schema', 'Auth', 'API']
    const mediumRisk = ['Error Handling', 'Performance', 'Config']
    if (highRisk.some((r) => area.includes(r))) return 'bg-red-500/20 text-red-300'
    if (mediumRisk.some((r) => area.includes(r))) return 'bg-yellow-500/20 text-yellow-300'
    return 'bg-blue-500/20 text-blue-300'
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
    return (
      value.includes('closed') ||
      value.includes('done') ||
      value.includes('resolved')
    )
  }

  const isQaDoneStatus = (status: string | undefined) => {
    const value = (status || '').toLowerCase()
    return (
      value.includes('ready for release') ||
      value.includes('awaiting approval') ||
      value.includes('waiting for approval') ||
      value.includes('in release')
    )
  }

  const getQaDoneTickets = (sprint: SprintItem) => {
    const qaDone = sprint?.snapshotTotals?.qaDoneTickets
    if (typeof qaDone === 'number') return qaDone
    return (sprint?.tickets || []).filter((ticket) => isQaDoneStatus(ticket.status || undefined)).length
  }

  const getJiraTicketUrl = (ticketKey: string) => {
    if (!jiraBaseUrl || !ticketKey) return ''
    return `${jiraBaseUrl.replace(/\/$/, '')}/browse/${ticketKey}`
  }

  const getJiraSprintUrl = (sprintId: string) => {
    if (!jiraBaseUrl || !jiraBoardId || !sprintId) return ''
    const base = jiraBaseUrl.replace(/\/$/, '')
    return `${base}/secure/RapidBoard.jspa?rapidView=${jiraBoardId}&view=reporting&chart=sprintRetrospective&sprint=${sprintId}`
  }

  const sortTickets = (tickets: SprintTicket[], sortKey: 'status' | 'story' | 'bounce') => {
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

  const fetchSprints = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/sprints', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = (await response.json()) as {
          sprints?: SprintItem[]
          jiraBaseUrl?: string
          jiraBoardId?: number | null
        }
        setSprints(data.sprints || [])
        setJiraBaseUrl(data.jiraBaseUrl || '')
        setJiraBoardId(typeof data.jiraBoardId === 'number' ? data.jiraBoardId : null)

        // Decode token to get role
        if (token) {
          const parts = token.split('.')
          if (parts.length === 3) {
            try {
              const payload = JSON.parse(atob(parts[1]))
              setUserRole(payload.role || '')
            } catch {
              // Ignore decode errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching sprints:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSprints()
  }, [fetchSprints])

  useEffect(() => {
    if (!searchParams || sprints.length === 0) return
    const filterParam = searchParams.get('filter')
    if (filterParam === 'active' || filterParam === 'completed' || filterParam === 'all') {
      setFilter(filterParam)
    }
    const sprintId = searchParams.get('sprintId')
    const devOnly = searchParams.get('devOnly') === '1'
    const closedOnly = searchParams.get('closedOnly') === '1'
    const bounceOnly = searchParams.get('bounceOnly') === '1'
    const assignee = searchParams.get('assignee')
    const nextFilter = devOnly ? 'dev' : closedOnly ? 'closed' : bounceOnly ? 'bounce' : 'all'
    if (sprintId) {
      setFilterBySprint((prev) => ({
        ...prev,
        [sprintId]: nextFilter,
      }))
      setExpandedSprints((prev) => ({
        ...prev,
        [sprintId]: true,
      }))
      if (assignee) {
        setAssigneeFilterBySprint((prev) => ({
          ...prev,
          [sprintId]: decodeURIComponent(assignee),
        }))
      }
      return
    }
    if (assignee) {
      const decoded = decodeURIComponent(assignee)
      const nextAssigneeFilters: Record<string, string> = {}
      const nextFilters: Record<string, 'all' | 'dev' | 'closed' | 'bounce'> = {}
      const nextExpanded: Record<string, boolean> = {}
      for (const sprint of sprints) {
        nextAssigneeFilters[sprint.id] = decoded
        nextFilters[sprint.id] = nextFilter
        nextExpanded[sprint.id] = true
      }
      setAssigneeFilterBySprint(nextAssigneeFilters)
      setFilterBySprint(nextFilters)
      setExpandedSprints(nextExpanded)
    }
  }, [searchParams, sprints])


  const filteredSprints = sprints
    .filter((sprint) => {
      if (filter === 'active') return sprint.status === 'ACTIVE'
      if (filter === 'completed') return sprint.status === 'COMPLETED' || sprint.status === 'CLOSED'
      return true
    })
    .filter((sprint) => {
      if (!selectedSprintName) return true
      return sprint.name === selectedSprintName
    })

  const sprintNameOptions = Array.from(
    new Set(
      sprints
        .filter((sprint) => {
          if (filter === 'active') return sprint.status === 'ACTIVE'
          if (filter === 'completed') return sprint.status === 'COMPLETED' || sprint.status === 'CLOSED'
          return true
        })
        .map((sprint) => sprint.name)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b))

  const toggleSprint = (sprintId: string) => {
    setExpandedSprints((prev) => ({
      ...prev,
      [sprintId]: !prev[sprintId],
    }))
  }

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fadeIn">
          <div>
            <h1 className="text-4xl font-bold text-white">Sprints Viewer</h1>
            <p className="text-slate-400 mt-1">View and track sprints from Jira</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
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
          <select
            value={selectedSprintName}
            onChange={(event) => setSelectedSprintName(event.target.value)}
            className="bg-slate-800/50 border border-slate-700 text-slate-200 text-sm rounded-md px-2 py-2 max-w-[260px]"
          >
            <option value="">All sprints</option>
            {sprintNameOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
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
              (() => {
                const isExpanded = expandedSprints[sprint.id] || false
                return (
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
                            : sprint.status === 'COMPLETED' || sprint.status === 'CLOSED'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                        }`}>
                          {sprint.status}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSprint(sprint.id)}
                          className="ml-auto text-slate-300 hover:text-white hover:bg-slate-800/50"
                        >
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </Button>
                      </div>

                      {/* Sync Status & Last Sync Time */}
                      <div className="flex items-center gap-4 mb-3 text-xs">
                        <div className="flex items-center gap-2 text-slate-400">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span>Last synced: {getLastSyncTime(sprint.lastSyncedAt)}</span>
                        </div>
                        {userRole && ['DEVOPS', 'ADMIN'].includes(userRole) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => syncSprintFromJira(sprint.id)}
                            disabled={syncingSprintId === sprint.id}
                            className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 p-1 h-auto disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${syncingSprintId === sprint.id ? 'animate-spin' : ''}`} />
                          </Button>
                        )}
                      </div>

                      {/* Documentation Pipeline Status */}
                      {sprint.documentationStats && sprint.documentationStats.total > 0 && (
                        <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
                          <FileText className="w-3 h-3 text-slate-400" />
                          <div className="flex gap-2">
                            {sprint.documentationStats.draft > 0 && (
                              <span className="px-2 py-1 rounded bg-slate-700/50 text-slate-300">
                                📝 {sprint.documentationStats.draft}
                              </span>
                            )}
                            {sprint.documentationStats.underReview > 0 && (
                              <span className="px-2 py-1 rounded bg-yellow-700/50 text-yellow-300">
                                🔍 {sprint.documentationStats.underReview}
                              </span>
                            )}
                            {sprint.documentationStats.approved > 0 && (
                              <span className="px-2 py-1 rounded bg-blue-700/50 text-blue-300">
                                ✅ {sprint.documentationStats.approved}
                              </span>
                            )}
                            {sprint.documentationStats.published > 0 && (
                              <span className="px-2 py-1 rounded bg-green-700/50 text-green-300">
                                📄 {sprint.documentationStats.published}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-6 text-sm">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Calendar className="w-4 h-4 text-blue-400" />
                          <span>
                            {new Date(sprint.startDate).toLocaleDateString()} {' -> '} {new Date(sprint.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-slate-400">
                          <span className="font-mono text-slate-500">ID: {sprint.jiraId}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4 pt-4 border-t border-slate-700/30">
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Tickets Finished</div>
                          <div className="text-xl font-bold text-white">{getFinishedTickets(sprint)}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Tickets Planned</div>
                          <div className="text-xl font-bold text-white">{getPlannedTickets(sprint)}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">QA Done</div>
                          <div className="text-xl font-bold text-white">{getQaDoneTickets(sprint)}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Success</div>
                          {(() => {
                            const { finished, total, percent } = getSprintSuccess(sprint)
                            const successColor =
                              percent <= 49
                                ? 'text-red-400'
                                : percent === 50
                                ? 'text-amber-400'
                                : 'text-green-400'
                            return (
                              <>
                                <div className={`text-xl font-bold ${successColor}`}>
                                  {total ? `${percent}%` : '--'}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {total ? `Tickets finished: ${finished} / ${total}` : 'Tickets finished: --'}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {total ? `Tickets not finished: ${total - finished}` : 'Tickets not finished: --'}
                                </div>
                              </>
                            )
                          })()}
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Story Points</div>
                          {(() => {
                            const totalStoryPoints =
                              typeof sprint.storyPointsTotal === 'number'
                                ? sprint.storyPointsTotal
                                : (sprint.tickets || []).reduce(
                                    (sum: number, ticket: SprintTicket) => sum + (ticket.storyPoints || 0),
                                    0
                                  )
                            const closedStoryPoints =
                              typeof sprint.storyPointsCompleted === 'number'
                                ? sprint.storyPointsCompleted
                                : (sprint.tickets || []).reduce((sum: number, ticket: SprintTicket) => {
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
                            const storyPercent = totalStoryPoints
                              ? Math.round((closedStoryPoints / totalStoryPoints) * 1000) / 10
                              : 0
                            const storyColor =
                              storyPercent <= 49
                                ? 'text-red-400'
                                : storyPercent === 50
                                ? 'text-amber-400'
                                : 'text-green-400'
                            return (
                              <>
                                <div className={`text-xl font-bold ${storyColor}`}>
                                  {totalStoryPoints ? `${storyPercent}%` : '--'}
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

                      {isExpanded ? (
                        <>
                          <div className="mt-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={filterBySprint[sprint.id] || 'all'}
                                onChange={(event) =>
                                  setFilterBySprint((prev) => ({
                                    ...prev,
                                    [sprint.id]: event.target.value as
                                      | 'all'
                                      | 'dev'
                                      | 'closed'
                                      | 'bounce',
                                  }))
                                }
                                className="bg-slate-900/40 border border-slate-700/50 text-slate-200 text-xs rounded-md px-2 py-1"
                              >
                                <option value="all">All tickets</option>
                                <option value="dev">In Dev only</option>
                                <option value="closed">Closed only</option>
                                <option value="bounce">Bounce only</option>
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
                              {assigneeFilterBySprint[sprint.id] ? (
                                <div className="flex items-center gap-2 text-xs text-slate-300">
                                  <span className="rounded-md bg-slate-900/60 px-2 py-1">
                                    Assignee: {assigneeFilterBySprint[sprint.id]}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() =>
                                      setAssigneeFilterBySprint((prev) => {
                                        const next = { ...prev }
                                        delete next[sprint.id]
                                        return next
                                      })
                                    }
                                    className="text-slate-400 hover:text-white hover:bg-slate-800/50"
                                  >
                                    Clear
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-4 rounded-lg border border-slate-700/30 bg-slate-900/30 p-4">
                            {(() => {
                              const filterValue = filterBySprint[sprint.id] || 'all'
                              const filtered = (sprint.tickets || []).filter((ticket: SprintTicket) => {
                                if (filterValue === 'dev' && !isDevStatus(ticket.status || undefined)) return false
                                if (filterValue === 'closed' && !isClosedStatus(ticket.status || undefined)) {
                                  return false
                                }
                                if (filterValue === 'bounce' && (ticket.qaBounceBackCount || 0) === 0) {
                                  return false
                                }
                                const assigneeFilter = assigneeFilterBySprint[sprint.id]
                                if (assigneeFilter) {
                                  const ticketAssignee = (ticket.assignee || '').toLowerCase().trim()
                                  if (ticketAssignee !== assigneeFilter.toLowerCase().trim()) {
                                    return false
                                  }
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
                                        <th className="py-2 pr-4">Impact</th>
                                        <th className="py-2 pr-4">Scenarios</th>
                                        <th className="py-2 pr-4">Bounce</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                                      {sorted.map((ticket: SprintTicket) => (
                                        <tr key={ticket.id} className="align-top hover:bg-slate-800/20 transition-colors">
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
                                            <span className="block truncate" title={ticket.summary ?? ''}>
                                              {ticket.summary}
                                            </span>
                                          </td>
                                          <td className="py-2 pr-4 text-slate-300">
                                            {ticket.status}
                                          </td>
                                          <td className="py-2 pr-4 text-slate-300">
                                            {ticket.storyPoints ?? 0}
                                          </td>
                                          <td className="py-2 pr-4">
                                            {(() => {
                                              const areas = getImpactAreas(ticket)
                                              if (areas.length === 0) {
                                                return <span className="text-slate-500 text-xs">--</span>
                                              }
                                              return (
                                                <div className="flex flex-wrap gap-1">
                                                  {areas.slice(0, 2).map((area, idx) => (
                                                    <span
                                                      key={idx}
                                                      className={`text-xs px-2 py-0.5 rounded ${getImpactColor(area)}`}
                                                      title={area}
                                                    >
                                                      {area.length > 10 ? area.substring(0, 10) + '...' : area}
                                                    </span>
                                                  ))}
                                                  {areas.length > 2 && (
                                                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-300">
                                                      +{areas.length - 2}
                                                    </span>
                                                  )}
                                                </div>
                                              )
                                            })()}
                                          </td>
                                          <td className="py-2 pr-4">
                                            {(() => {
                                              const count = getScenariosCount(ticket)
                                              return (
                                                <div className="flex items-center gap-1">
                                                  <CheckSquare className="w-3 h-3 text-blue-400" />
                                                  <span className="text-sm font-semibold text-slate-300">{count}</span>
                                                </div>
                                              )
                                            })()}
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
                        </>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2">
                      {getJiraSprintUrl(sprint.jiraId) ? (
                        <a
                          href={getJiraSprintUrl(sprint.jiraId)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 group-hover:translate-x-1 transition-all"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </Button>
                        </a>
                      ) : (
                        <Link href={`/sprints/${sprint.id}`}>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 group-hover:translate-x-1 transition-all"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
                )
              })()
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
