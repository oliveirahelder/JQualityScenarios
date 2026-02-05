'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, AlertCircle, ChevronLeft, ChevronRight, Zap, FileText } from 'lucide-react'

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
    jiraCreatedAt?: string | Date | null
    jiraClosedAt?: string | Date | null
    carryoverCount?: number | null
    issueType?: string | null
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
    completedAt?: string | Date | null
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
  const [filterBySprint, setFilterBySprint] = useState<
    Record<string, 'all' | 'dev' | 'qa' | 'closed' | 'bounce' | 'final'>
  >({})
  const [sortBySprint, setSortBySprint] = useState<
    Record<string, 'status' | 'story' | 'bounce'>
  >({})
  const [assigneeFilterBySprint, setAssigneeFilterBySprint] = useState<Record<string, string>>({})
  const [expandedSprints, setExpandedSprints] = useState<Record<string, boolean>>({})
  const [teamViewFilter, setTeamViewFilter] = useState<
    Record<string, 'all' | 'active' | 'completed'>
  >({})
  const [selectedCompletedByTeam, setSelectedCompletedByTeam] = useState<Record<string, string>>({})
  const router = useRouter()
  const searchParams = useSearchParams()
  const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const getSprintProgress = (tickets: SprintTicket[] | undefined) => {
    const total = tickets?.length || 0
    if (!total) return { closed: 0, total: 0 }
    const closed = (tickets || []).filter((ticket) => {
      return isClosedStatus(ticket?.status || undefined)
    }).length
    return { closed, total }
  }

  const getDevelopersCount = (tickets: SprintTicket[] | undefined) => {
    if (!tickets || tickets.length === 0) return 0
    const names = new Set(
      tickets
        .filter(
          (ticket) =>
            isDevStatus(ticket.status || undefined) ||
            isQaStatus(ticket.status || undefined)
        )
        .map((ticket) => (ticket.assignee || '').trim())
        .filter(Boolean)
    )
    return names.size
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

  const countWorkingHours = (startDate: Date, endDate: Date) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
    if (end <= start) return 0
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    let hours = 0
    while (cursor <= endDay) {
      const day = cursor.getDay()
      if (day !== 0 && day !== 6) {
        const dayStart = new Date(cursor)
        const dayEnd = new Date(cursor)
        dayEnd.setDate(dayEnd.getDate() + 1)
        const windowStart = start > dayStart ? start : dayStart
        const windowEnd = end < dayEnd ? end : dayEnd
        const diff = windowEnd.getTime() - windowStart.getTime()
        if (diff > 0) {
          hours += diff / (1000 * 60 * 60)
        }
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    return hours
  }

  const formatDaysHours = (hours: number) => {
    if (!Number.isFinite(hours)) return '--'
    const sign = hours < 0 ? '-' : ''
    const absHours = Math.abs(hours)
    const days = Math.floor(absHours / 24)
    const remainder = absHours - days * 24
    const hoursLabel = Number.isInteger(remainder)
      ? remainder.toString()
      : (Math.round(remainder * 10) / 10).toString()
    if (days === 0) return `${sign}${hoursLabel}h`
    if (remainder === 0) return `${sign}${days}d`
    return `${sign}${days}d ${hoursLabel}h`
  }

  const getWorkingHours = (startDate: Date, endDate: Date) =>
    countWorkingHours(startDate, endDate)

  const getSprintPlannedHours = (sprint: SprintItem) => {
    const start = new Date(sprint.startDate)
    const end = new Date(sprint.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    return getWorkingHours(start, end)
  }

  const getSprintElapsedHours = (sprint: SprintItem, referenceDate: Date) => {
    const start = new Date(sprint.startDate)
    if (Number.isNaN(start.getTime())) return null
    return getWorkingHours(start, referenceDate)
  }

  const getSprintWorkingDaysDisplay = (sprint: SprintItem) => {
    const plannedHours = getSprintPlannedHours(sprint)
    return plannedHours == null ? '--' : formatDaysHours(plannedHours)
  }

  const getSprintRemainingDaysDisplay = (sprint: SprintItem) => {
    const plannedHours = getSprintPlannedHours(sprint)
    if (plannedHours == null) return '--'
    const reference =
      sprint.status === 'COMPLETED' || sprint.status === 'CLOSED'
        ? new Date(sprint.completedAt || sprint.endDate)
        : new Date()
    const elapsedHours = getSprintElapsedHours(sprint, reference)
    if (elapsedHours == null) return '--'
    const remaining = plannedHours - elapsedHours
    return formatDaysHours(remaining)
  }

  const getSprintActualDurationDisplay = (sprint: SprintItem) => {
    if (!(sprint.status === 'COMPLETED' || sprint.status === 'CLOSED')) return null
    const end = new Date(sprint.completedAt || sprint.endDate)
    const elapsedHours = getSprintElapsedHours(sprint, end)
    return elapsedHours == null ? '--' : formatDaysHours(elapsedHours)
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

  const getTeamKey = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return 'TEAM'
    const match = trimmed.match(/^[A-Za-z0-9]+/)
    return match ? match[0].toUpperCase() : trimmed.toUpperCase()
  }

  const isCompletedSprint = useCallback(
    (sprint: SprintItem) => sprint.status === 'COMPLETED' || sprint.status === 'CLOSED',
    []
  )

  const isActiveSprint = (sprint: SprintItem) => sprint.status === 'ACTIVE'

  const getSprintDurationDays = (sprint: SprintItem) => {
    const start = new Date(sprint.startDate)
    const end = new Date(sprint.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
    const diffMs = end.getTime() - start.getTime()
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return Math.max(days, 1)
  }

  const getSprintDaysElapsed = (sprint: SprintItem) => {
    const start = new Date(sprint.startDate)
    if (Number.isNaN(start.getTime())) return 0
    const now = new Date()
    const diffMs = now.getTime() - start.getTime()
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    const duration = getSprintDurationDays(sprint)
    return Math.min(Math.max(days, 0), duration)
  }

  const getStoryPointsTotals = (sprint: SprintItem) => {
    const total =
      sprint.storyPointsTotal ??
      sprint.snapshotTotals?.storyPointsTotal ??
      (sprint.tickets || []).reduce((sum, ticket) => sum + (ticket.storyPoints || 0), 0)
    const closed =
      sprint.storyPointsCompleted ??
      sprint.snapshotTotals?.storyPointsClosed ??
      (sprint.tickets || [])
        .filter((ticket) => isClosedStatus(ticket.status || undefined))
        .reduce((sum, ticket) => sum + (ticket.storyPoints || 0), 0)
    return { total, closed }
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
    if (value.includes('canceled') || value.includes('cancelled')) return false
    return (
      value.includes('closed') ||
      value.includes('done')
    )
  }

  const isQaDoneStatus = (status: string | undefined) => {
    const value = (status || '').toLowerCase()
    return (
      value.includes('ready for release') ||
      value.includes('awaiting approval') ||
      value.includes('in release') ||
      value.includes('done') ||
      value.includes('closed')
    )
  }

  const isQaStatus = (status: string | undefined) => {
    const value = (status || '').toLowerCase()
    return value.includes('in qa')
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

  const businessHoursBetween = (start: Date, end: Date) => {
    if (end <= start) return 0
    const startDate = new Date(start)
    const endDate = new Date(end)
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(0, 0, 0, 0)
    let hours = 0
    const cursor = new Date(startDate)
    while (cursor <= endDate) {
      const day = cursor.getDay()
      if (day >= 1 && day <= 5) {
        hours += 8
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    return hours
  }

  const getTicketAgeHours = (ticket: SprintTicket) => {
    if (!ticket.jiraCreatedAt) return null
    const createdAt = new Date(ticket.jiraCreatedAt)
    if (Number.isNaN(createdAt.getTime())) return null
    const endAt = ticket.jiraClosedAt ? new Date(ticket.jiraClosedAt) : new Date()
    if (Number.isNaN(endAt.getTime())) return null
    return businessHoursBetween(createdAt, endAt)
  }

  const formatHours = (hours: number | null) => {
    if (hours == null) return '--'
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
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

        // Decode token to confirm it is valid.
        if (token) {
          const parts = token.split('.')
          if (parts.length === 3) {
            try {
              JSON.parse(atob(parts[1]))
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
      const nextFilters: Record<string, 'all' | 'active' | 'completed'> = {}
      for (const sprint of sprints) {
        nextFilters[getTeamKey(sprint.name)] = filterParam
      }
      setTeamViewFilter(nextFilters)
    }
    const sprintId = searchParams.get('sprintId')
    const devOnly = searchParams.get('devOnly') === '1'
    const qaOnly = searchParams.get('qaOnly') === '1'
    const closedOnly = searchParams.get('closedOnly') === '1'
    const bounceOnly = searchParams.get('bounceOnly') === '1'
    const finalOnly = searchParams.get('finalOnly') === '1'
    const assignee = searchParams.get('assignee')
    const nextFilter = devOnly
      ? 'dev'
      : qaOnly
      ? 'qa'
      : closedOnly
      ? 'closed'
      : bounceOnly
      ? 'bounce'
      : finalOnly
      ? 'final'
      : 'all'
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
      const nextFilters: Record<string, 'all' | 'dev' | 'qa' | 'closed' | 'bounce' | 'final'> = {}
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

  const sprintsByTeam = useMemo(() => {
    const grouped = new Map<string, SprintItem[]>()
    for (const sprint of sprints) {
      const key = getTeamKey(sprint.name)
      const list = grouped.get(key) || []
      list.push(sprint)
      grouped.set(key, list)
    }
    return grouped
  }, [sprints])

  const teamKeys = useMemo(() => Array.from(sprintsByTeam.keys()).sort(), [sprintsByTeam])
  const sprintSummary = useMemo(() => {
    const activeCount = sprints.filter(isActiveSprint).length
    const completedCount = sprints.filter(isCompletedSprint).length
    return {
      total: sprints.length,
      active: activeCount,
      completed: completedCount,
    }
  }, [sprints, isActiveSprint, isCompletedSprint])

  const toggleSprint = (sprintId: string) => {
    setExpandedSprints((prev) => ({
      ...prev,
      [sprintId]: !prev[sprintId],
    }))
  }

  useEffect(() => {
    if (sprintsByTeam.size === 0) return
    setSelectedCompletedByTeam((prev) => {
      let changed = false
      const next = { ...prev }
      for (const [teamKey, teamSprints] of sprintsByTeam.entries()) {
        const completed = teamSprints
          .filter(isCompletedSprint)
          .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
        if (completed.length === 0) {
          if (next[teamKey]) {
            delete next[teamKey]
            changed = true
          }
          continue
        }
        if (!next[teamKey] || !completed.some((sprint) => sprint.id === next[teamKey])) {
          next[teamKey] = completed[0].id
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [sprintsByTeam, isCompletedSprint])

  const handleClearSprintFilters = (sprintId: string) => {
    setFilterBySprint((prev) => {
      const next = { ...prev }
      delete next[sprintId]
      return next
    })
    setSortBySprint((prev) => {
      const next = { ...prev }
      delete next[sprintId]
      return next
    })
    setAssigneeFilterBySprint((prev) => {
      const next = { ...prev }
      delete next[sprintId]
      return next
    })
  }

  const handleClearAllFilters = () => {
    setFilterBySprint({})
    setSortBySprint({})
    setAssigneeFilterBySprint({})
    setExpandedSprints({})
    setTeamViewFilter({})
    setSelectedCompletedByTeam({})
    router.replace('/sprints')
  }

  const setCarouselRef = (teamKey: string) => (element: HTMLDivElement | null) => {
    carouselRefs.current[teamKey] = element
  }

  const scrollCarousel = (teamKey: string, direction: 'left' | 'right') => {
    const container = carouselRefs.current[teamKey]
    if (!container) return
    const scrollBy = Math.round(container.clientWidth * 0.8)
    const delta = direction === 'left' ? -scrollBy : scrollBy
    container.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <main className="h-screen overflow-hidden">
      <div className="max-w-none w-full px-4 sm:px-6 lg:px-8 py-4 overflow-hidden h-full flex flex-col min-h-0 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4 animate-fadeIn shrink-0">
          <div>
            <h1 className="text-4xl font-bold text-white">Sprints Viewer</h1>
            <p className="text-slate-400 mt-1">View and track sprints from Jira</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="rounded-full border border-slate-700/50 px-3 py-1">
                Total: <span className="text-slate-200 font-semibold">{sprintSummary.total}</span>
              </span>
              <span className="rounded-full border border-emerald-500/30 px-3 py-1 text-emerald-300">
                Active: <span className="text-emerald-200 font-semibold">{sprintSummary.active}</span>
              </span>
              <span className="rounded-full border border-blue-500/30 px-3 py-1 text-blue-300">
                Completed: <span className="text-blue-200 font-semibold">{sprintSummary.completed}</span>
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClearAllFilters}
            className="text-slate-400 hover:text-white hover:bg-slate-800/50 text-sm self-start sm:self-auto"
          >
            Clear all filters
          </Button>
        </div>

        {/* Sprints List */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 pb-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin">
              <Zap className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-slate-400 mt-4">Loading sprints...</p>
          </div>
        ) : teamKeys.length === 0 ? (
          <Card className="glass-card border-slate-700/30">
            <CardContent className="pt-12 text-center">
              <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-300 mb-4">No sprints yet. Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {teamKeys.map((teamKey, teamIndex) => {
              const teamSprints = sprintsByTeam.get(teamKey) || []
              const activeSprints = teamSprints.filter(isActiveSprint)
              const completedSprints = teamSprints
                .filter(isCompletedSprint)
                .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
              const viewFilter = teamViewFilter[teamKey] || 'all'
              const visibleSprints = teamSprints
                .filter((sprint) => {
                  if (viewFilter === 'active') return isActiveSprint(sprint)
                  if (viewFilter === 'completed') return isCompletedSprint(sprint)
                  return true
                })
                .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
              const currentActiveSprint = [...activeSprints].sort(
                (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
              )[0]
              const selectedCompletedId = selectedCompletedByTeam[teamKey]
              const selectedCompletedSprint = completedSprints.find(
                (sprint) => sprint.id === selectedCompletedId
              )
              const activeTotals = currentActiveSprint ? getStoryPointsTotals(currentActiveSprint) : null
              const completedTotals = selectedCompletedSprint
                ? getStoryPointsTotals(selectedCompletedSprint)
                : null
              const activeDuration = currentActiveSprint ? getSprintDurationDays(currentActiveSprint) : 0
              const activeElapsed = currentActiveSprint ? getSprintDaysElapsed(currentActiveSprint) : 0
              const completedDuration = selectedCompletedSprint
                ? getSprintDurationDays(selectedCompletedSprint)
                : 0
              const activeClosedTickets = currentActiveSprint
                ? getFinishedTickets(currentActiveSprint)
                : 0
              const completedClosedTickets = selectedCompletedSprint
                ? getFinishedTickets(selectedCompletedSprint)
                : 0
              const activeClosedPerDay = activeElapsed
                ? Math.round((activeClosedTickets / activeElapsed) * 10) / 10
                : 0
              const completedClosedPerDay = completedDuration
                ? Math.round((completedClosedTickets / completedDuration) * 10) / 10
                : 0
              const activeStoryPerDay =
                activeElapsed && activeTotals
                  ? Math.round((activeTotals.closed / activeElapsed) * 10) / 10
                  : 0
              const completedStoryPerDay =
                completedDuration && completedTotals
                  ? Math.round((completedTotals.closed / completedDuration) * 10) / 10
                  : 0

              return (
                <Card
                  key={teamKey}
                  className="glass-card border-slate-700/30 transition-all duration-300 animate-slideInUp h-[52vh] lg:h-[58vh] flex flex-col min-w-0 overflow-hidden"
                  style={{ animationDelay: `${teamIndex * 75}ms` }}
                >
                  <CardContent className="p-6 flex flex-col h-full min-h-0 min-w-0">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-start lg:gap-6 shrink-0 min-w-0">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Team</div>
                        <h2 className="text-2xl font-bold text-white">{teamKey}</h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {(['all', 'active', 'completed'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() =>
                              setTeamViewFilter((prev) => ({
                                ...prev,
                                [teamKey]: tab,
                              }))
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                              viewFilter === tab
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                                : 'text-slate-400 hover:text-slate-200 border border-transparent hover:border-slate-700'
                            }`}
                          >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                          </button>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTeamViewFilter((prev) => {
                              const next = { ...prev }
                              delete next[teamKey]
                              return next
                            })
                          }}
                          className="text-slate-400 hover:text-white hover:bg-slate-800/50 text-xs"
                        >
                          Clear team filters
                        </Button>
                      </div>
                    </div>

                    <div className="mt-5 flex-1 min-h-0 overflow-y-auto pr-2">
                      <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4 w-full">
                        <div className="text-xs text-slate-400">Current active sprint</div>
                        <div className="mt-2 text-white font-semibold">
                          {currentActiveSprint ? currentActiveSprint.name : 'No active sprint'}
                        </div>
                        {currentActiveSprint ? (
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                            <div>
                              <div className="text-slate-500">Tickets closed</div>
                              <div className="text-white font-semibold">
                                {activeClosedTickets} / {getPlannedTickets(currentActiveSprint)}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500">Story points</div>
                              <div className="text-white font-semibold">
                                {formatStoryPoints(activeTotals?.closed)} /{' '}
                                {formatStoryPoints(activeTotals?.total)}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500">Days elapsed</div>
                              <div className="text-white font-semibold">
                                {activeElapsed} / {activeDuration}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500">Closed per day</div>
                              <div className="text-white font-semibold">{activeClosedPerDay}</div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4 w-full">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-400">Compare with completed sprint</div>
                          <select
                            value={selectedCompletedId || ''}
                            onChange={(event) =>
                              setSelectedCompletedByTeam((prev) => ({
                                ...prev,
                                [teamKey]: event.target.value,
                              }))
                            }
                            className="bg-slate-900/60 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1"
                          >
                            {completedSprints.length === 0 ? (
                              <option value="">No completed sprints</option>
                            ) : (
                              completedSprints.map((sprint) => (
                                <option key={sprint.id} value={sprint.id}>
                                  {sprint.name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                        {selectedCompletedSprint ? (
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                            <div>
                              <div className="text-slate-500">Tickets closed</div>
                              <div className="text-white font-semibold">
                                {completedClosedTickets} / {getPlannedTickets(selectedCompletedSprint)}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500">Story points</div>
                              <div className="text-white font-semibold">
                                {formatStoryPoints(completedTotals?.closed)} /{' '}
                                {formatStoryPoints(completedTotals?.total)}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500">Sprint duration</div>
                              <div className="text-white font-semibold">{completedDuration}d</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Closed per day</div>
                              <div className="text-white font-semibold">{completedClosedPerDay}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">SP per day</div>
                              <div className="text-white font-semibold">{completedStoryPerDay}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Active SP/day</div>
                              <div className="text-white font-semibold">{activeStoryPerDay}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 text-xs text-slate-500">
                            Select a completed sprint to compare.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-3 relative">
                        <div>
                          <h3 className="text-sm font-semibold text-white">Sprints</h3>
                          <p className="text-xs text-slate-500">Scroll horizontally to browse</p>
                        </div>
                        <div className="flex items-center gap-2 z-10">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => scrollCarousel(teamKey, 'left')}
                            className="text-slate-400 hover:text-white hover:bg-slate-800/50"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => scrollCarousel(teamKey, 'right')}
                            className="text-slate-400 hover:text-white hover:bg-slate-800/50"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div
                        ref={setCarouselRef(teamKey)}
                        className="flex w-full max-w-full gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
                      >
                        {visibleSprints.length === 0 ? (
                          <div className="text-xs text-slate-500">No sprints for this filter.</div>
                        ) : (
                          visibleSprints.map((sprint, idx) => {
                            const isExpanded = expandedSprints[sprint.id] || false
                            return (
                            <div
                              key={sprint.id}
                              className="flex-none w-full max-w-full sm:w-[70vw] md:w-[520px] lg:w-[calc(50%-0.5rem)] xl:w-[calc(50%-0.75rem)] snap-start"
                            >
                                <Card 
                                  className="glass-card border-slate-700/30 hover:border-blue-500/50 transition-all duration-300 group cursor-pointer animate-slideInUp h-full"
                                  style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                  <CardContent className="p-5 h-full flex flex-col min-h-0 min-w-0 overflow-x-hidden">
                                    <div className="flex items-start justify-between gap-4 min-w-0">
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

                      <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mt-4 pt-4 border-t border-slate-700/30">
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Tickets Finished</div>
                          <div className="text-xl font-bold text-white">{getFinishedTickets(sprint)}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Tickets Planned</div>
                          <div className="text-xl font-bold text-white">{getPlannedTickets(sprint)}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Developers</div>
                          <div className="text-xl font-bold text-white">
                            {getDevelopersCount(sprint.tickets)}
                          </div>
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
                                      (status.includes('closed') || status.includes('done')) &&
                                      !status.includes('canceled') &&
                                      !status.includes('cancelled')
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
                          <div className="text-slate-500 text-xs mb-1">Sprint Days</div>
                          <div className="text-xl font-bold text-white">
                            {getSprintWorkingDaysDisplay(sprint)}
                          </div>
                          {(() => {
                            if (sprint.status === 'COMPLETED' || sprint.status === 'CLOSED') {
                              const actualDuration = getSprintActualDurationDisplay(sprint)
                              return (
                                <div className="text-xs text-slate-400 mt-1">
                                  Duration: {actualDuration ?? '--'}
                                </div>
                              )
                            }
                            const remainingDays = getSprintRemainingDaysDisplay(sprint)
                            return (
                              <div className="text-xs text-slate-400 mt-1">
                                Remaining: {remainingDays ?? '--'}
                              </div>
                            )
                          })()}
                        </div>
                      </div>

                      {isExpanded ? (
                        <>
                          <div className="mt-5 rounded-xl border border-slate-700/40 bg-slate-950/40 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  value={filterBySprint[sprint.id] || 'all'}
                                  onChange={(event) =>
                                    setFilterBySprint((prev) => ({
                                      ...prev,
                                      [sprint.id]: event.target.value as
                                        | 'all'
                                        | 'dev'
                                        | 'qa'
                                        | 'closed'
                                        | 'bounce'
                                        | 'final',
                                    }))
                                  }
                                  className="bg-slate-900/70 border border-slate-700/50 text-slate-200 text-xs rounded-md px-2 py-1"
                                >
                                <option value="all">All tickets</option>
                                <option value="dev">In Dev only</option>
                                <option value="qa">In QA only</option>
                                <option value="final">Final phase only</option>
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
                                  className="bg-slate-900/70 border border-slate-700/50 text-slate-200 text-xs rounded-md px-2 py-1"
                                >
                                <option value="status">Status (A-Z)</option>
                                <option value="story">Story Points</option>
                                <option value="bounce">Bounce Back</option>
                              </select>
                              </div>
                              {(filterBySprint[sprint.id] && filterBySprint[sprint.id] !== 'all') ||
                              sortBySprint[sprint.id] ||
                              assigneeFilterBySprint[sprint.id] ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleClearSprintFilters(sprint.id)}
                                  className="text-slate-400 hover:text-white hover:bg-slate-800/50 text-xs"
                                >
                                  Clear filters
                                </Button>
                              ) : null}
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

                          <div className="mt-4 rounded-xl border border-slate-700/30 bg-slate-900/30 p-0 max-h-[45vh] overflow-hidden">
                            {(() => {
                              const filterValue = filterBySprint[sprint.id] || 'all'
                              const filtered = (sprint.tickets || []).filter((ticket: SprintTicket) => {
                                if (filterValue === 'dev' && !isDevStatus(ticket.status || undefined)) return false
                                if (filterValue === 'qa' && !isQaStatus(ticket.status || undefined)) {
                                  return false
                                }
                                if (filterValue === 'final' && !isQaDoneStatus(ticket.status || undefined)) {
                                  return false
                                }
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
                                <div className="max-h-[300px] overflow-auto rounded-xl max-w-full">
                                  <table className="min-w-full text-left text-sm">
                                    <thead className="text-xs uppercase text-slate-400 border-b border-slate-800/60 sticky top-0 bg-slate-950/80 backdrop-blur">
                                      <tr>
                                        <th className="py-2 pr-4">Ticket</th>
                                        <th className="py-2 pr-4">Summary</th>
                                        <th className="py-2 pr-4">Status</th>
                                        <th className="py-2 pr-4">SP</th>
                                        <th className="py-2 pr-4">Type</th>
                                        <th className="py-2 pr-4">Flags</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                                      {sorted.map((ticket: SprintTicket) => (
                                        <tr key={ticket.id} className="align-top hover:bg-slate-800/40 transition-colors">
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
                                          <td className="py-2 pr-4 text-slate-100 max-w-[360px]">
                                            <span className="block line-clamp-2" title={ticket.summary ?? ''}>
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
                                            {ticket.issueType || '--'}
                                          </td>
                                          <td className="py-2 pr-4">
                                            {(() => {
                                              const carryover = ticket.carryoverCount || 0
                                              const hours = getTicketAgeHours(ticket)
                                              const isClosed = isClosedStatus(ticket.status || undefined)
                                              const label = isClosed ? 'Closed time' : 'Open time'
                                              const bounceCount = ticket.qaBounceBackCount ?? 0
                                              const tooltipParts = []
                                              if (carryover > 0) {
                                                tooltipParts.push(`Carryover: ${carryover}`)
                                              }
                                              if (bounceCount > 0) {
                                                tooltipParts.push(`Bounce: ${bounceCount}`)
                                              }
                                              if (hours != null) {
                                                tooltipParts.push(`${label}: ${formatHours(hours)}`)
                                              }
                                              const tooltip = tooltipParts.join(' | ')
                                              if (carryover === 0 && hours == null) {
                                                return <span className="text-slate-500 text-xs">--</span>
                                              }
                                              return (
                                                <span
                                                  className="inline-flex items-center gap-1 text-xs text-slate-200"
                                                  title={tooltip}
                                                >
                                                  {carryover > 0 ? (
                                                    <span className="rounded-md bg-amber-500/20 text-amber-200 px-2 py-0.5">
                                                      CO {carryover}
                                                    </span>
                                                  ) : null}
                                                  {bounceCount > 0 ? (
                                                    <span className="rounded-md bg-blue-500/20 text-blue-200 px-2 py-0.5">
                                                      B {bounceCount}
                                                    </span>
                                                  ) : null}
                                                  {hours != null ? (
                                                    <span className="rounded-md bg-slate-700/50 text-slate-200 px-2 py-0.5">
                                                      {formatHours(hours)}
                                                    </span>
                                                  ) : null}
                                                </span>
                                              )
                                            })()}
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
                              </div>
                            )
                          })
                        )}
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
      </div>
    </main>
  )
}
