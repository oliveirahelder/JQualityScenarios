'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  GitBranch,
  BookOpen,
  Zap,
  CheckCircle2,
  User,
  Bug,
} from 'lucide-react'

type MetricValueCell =
  | string
  | number
  | { value: string | number; href?: string; className?: string }

type MetricRowSimple = {
  label: string
  labelTitle?: string
  value: string | number | { value: string | number; className?: string }
  href?: string
}

type MetricRowColumns = {
  label: string
  columns: MetricValueCell[]
}

type MetricRowGroup = {
  label: string
  columns: string[]
  rows: MetricValueCell[][]
}

type MetricRow = MetricRowSimple | MetricRowColumns | MetricRowGroup

type MetricCard = {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  trend?: string
  href?: string
  filter?: React.ReactNode
  columns?: string[]
  rows?: MetricRow[]
  loading?: boolean
  size?: 'hero' | 'standard' | 'compact'
}

export default function Dashboard() {
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncError, setSyncError] = useState('')
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [selectedTeamKey, setSelectedTeamKey] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<'management' | 'qa' | 'product'>('management')
  const [docsLoading, setDocsLoading] = useState(true)
  const [documentationBySprint, setDocumentationBySprint] = useState<
    Record<
      string,
      {
        total: number
        draft: number
        underReview: number
        approved: number
        published: number
      }
    >
  >({})
  const [metricValues, setMetricValues] = useState({
    lastSyncAt: null as string | null,
    activeSprintCount: null as number | null,
    activeSprints: [] as Array<{
      id: string
      name: string
      teamKey: string
      successPercent: number
      daysLeft: number
      devTickets: number
      qaTickets: number
      doneTickets: number
      bounceBackPercent: number
      bounceBackTickets: number
      storyPointsTotal: number
      storyPointsCompleted: number
      totalTickets: number
      closedTickets: number
      finalPhaseTickets: number
      assignees: Array<{ name: string; total: number; closed: number }>
    }>,
    syncedSprints: [] as Array<{
      id: string
      name: string
      teamKey: string
      successPercent: number
      daysLeft: number
      devTickets: number
      qaTickets: number
      doneTickets: number
      bounceBackPercent: number
      bounceBackTickets: number
      storyPointsTotal: number
      storyPointsCompleted: number
      totalTickets: number
      closedTickets: number
      finalPhaseTickets: number
      assignees: Array<{ name: string; total: number; closed: number }>
    }>,
    riskSignals: [] as Array<{
      sprintId: string
      sprintName: string
      teamKey: string
      jiraId: string
      summary: string
      status: string
      ageDays: number
      bounceBackCount: number
      riskScore: number
      reasons: string[]
    }>,
    openBugs: {
      totalOpen: 0,
      totalCreated: 0,
      totalClosed: 0,
      averageOpenAgeDays: 0,
      oldestOpenAgeDays: 0,
      bySprint: [] as Array<{
        sprintId: string
        sprintName: string
        teamKey: string
        created: number
        closed: number
        open: number
        averageOpenAgeDays: number
        oldestOpenAgeDays: number
      }>,
    },
    assignees: [] as Array<{
      name: string
      total: number
      closed: number
      bounce: number
      inProgress: number
    }>,
    deliveryTimes: [] as Array<unknown>,
    deliveryTimesBySprint: [] as Array<unknown>,
  })
  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const authToken = localStorage.getItem('token')
      const response = await fetch(
        '/api/metrics/jira?includeDeliveryTimes=0',
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      )
      if (!response.ok) {
        return
      }
      const data = await response.json()
      setMetricValues({
        lastSyncAt: data.lastSyncAt ?? null,
        activeSprintCount: data.activeSprintCount ?? null,
        activeSprints: data.activeSprints || [],
        syncedSprints: data.syncedSprints || [],
        riskSignals: data.riskSignals || [],
        openBugs: data.openBugs || {
          totalOpen: 0,
          totalCreated: 0,
          totalClosed: 0,
          averageOpenAgeDays: 0,
          oldestOpenAgeDays: 0,
          bySprint: [],
        },
        assignees: data.assignees || [],
        deliveryTimes: data.deliveryTimes || [],
        deliveryTimesBySprint: data.deliveryTimesBySprint || [],
      })
    } catch {
      // Keep defaults on error
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  const loadDocs = useCallback(async () => {
    setDocsLoading(true)
    try {
      const authToken = localStorage.getItem('token')
      const response = await fetch('/api/sprints', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!response.ok) {
        return
      }
      const data = await response.json()
      const documentationMap: Record<
        string,
        {
          total: number
          draft: number
          underReview: number
          approved: number
          published: number
        }
      > = {}
      for (const sprint of data?.sprints || []) {
        if (!sprint?.id || !sprint?.documentationStats) continue
        documentationMap[sprint.id] = sprint.documentationStats
      }
      setDocumentationBySprint(documentationMap)
    } catch {
      // Keep defaults on error
    } finally {
      setDocsLoading(false)
    }
  }, [])

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (!storedUser) {
      setIsAdmin(false)
      return
    }
    try {
      const parsed = JSON.parse(storedUser)
      setIsAdmin(parsed?.role === 'ADMIN')
    } catch {
      setIsAdmin(false)
    }
  }, [])

  useEffect(() => {
    loadMetrics()
  }, [loadMetrics])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  const syncedSprints =
    metricValues.syncedSprints.length > 0
      ? metricValues.syncedSprints
      : metricValues.activeSprints

  const handleJiraSync = async () => {
    setSyncing(true)
    setSyncMessage('')
    setSyncError('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/sprints/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'all' }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync Jira data')
      }
      setSyncMessage('Jira sync completed.')
      await loadMetrics()
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync Jira data')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    const syncedSprintList = selectedTeamKey
      ? syncedSprints.filter((sprint) => sprint.teamKey === selectedTeamKey)
      : syncedSprints
    if (syncedSprintList.length === 0) {
      if (selectedSprintId !== null) {
        setSelectedSprintId(null)
      }
      return
    }
    if (selectedSprintId && syncedSprintList.some((sprint) => sprint.id === selectedSprintId)) {
      return
    }
    const activeSprintList = selectedTeamKey
      ? metricValues.activeSprints.filter((sprint) => sprint.teamKey === selectedTeamKey)
      : metricValues.activeSprints
    const defaultSprint =
      activeSprintList.length > 0
        ? [...activeSprintList].sort(
            (a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name)
          )[0]
        : [...syncedSprintList].sort(
            (a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name)
          )[0]
    setSelectedSprintId(defaultSprint?.id || null)
  }, [syncedSprints, selectedSprintId, selectedTeamKey])



  const teamKeys = Array.from(new Set(syncedSprints.map((sprint) => sprint.teamKey))).sort(
    (a, b) => a.localeCompare(b)
  )

  useEffect(() => {
    if (teamKeys.length === 0) return
    if (!selectedTeamKey || !teamKeys.includes(selectedTeamKey)) {
      setSelectedTeamKey(teamKeys[0])
    }
  }, [teamKeys, selectedTeamKey])

  const filteredSyncedSprints = selectedTeamKey
    ? syncedSprints.filter((sprint) => sprint.teamKey === selectedTeamKey)
    : syncedSprints

  const filteredActiveSprints = selectedTeamKey
    ? metricValues.activeSprints.filter((sprint) => sprint.teamKey === selectedTeamKey)
    : metricValues.activeSprints

  const selectedSprint =
    filteredSyncedSprints.find((sprint) => sprint.id === selectedSprintId) ||
    filteredSyncedSprints[0] ||
    null

  const totalTickets = filteredActiveSprints.reduce(
    (sum, sprint) => sum + sprint.totalTickets,
    0
  )
  const totalBounceBackTickets = filteredActiveSprints.reduce(
    (sum, sprint) => sum + sprint.bounceBackTickets,
    0
  )
  const totalBounceBackPercent = totalTickets
    ? Math.round((totalBounceBackTickets / totalTickets) * 1000) / 10
    : 0

  const releaseReadinessPercent = selectedSprint?.totalTickets
    ? Math.round((selectedSprint.finalPhaseTickets / selectedSprint.totalTickets) * 1000) / 10
    : 0
  const sprintProgressPercent = selectedSprint?.storyPointsTotal
    ? Math.round((selectedSprint.storyPointsCompleted / selectedSprint.storyPointsTotal) * 1000) / 10
    : 0

  const riskSignalsFiltered = metricValues.riskSignals.filter(
    (signal) => !selectedTeamKey || signal.teamKey === selectedTeamKey
  )
  const riskSignalsScoped = selectedSprint
    ? riskSignalsFiltered.filter((signal) => signal.sprintId === selectedSprint.id)
    : riskSignalsFiltered
  const riskCount = riskSignalsScoped.length
  const riskLevelLabel = riskCount >= 8 ? 'High' : riskCount >= 4 ? 'Medium' : 'Low'

  const openBugsScoped = metricValues.openBugs.bySprint.filter((entry) => {
    if (selectedTeamKey && entry.teamKey !== selectedTeamKey) return false
    if (selectedSprint?.id && entry.sprintId !== selectedSprint.id) return false
    return true
  })
  const openBugCreated = openBugsScoped.reduce((sum, entry) => sum + entry.created, 0)
  const openBugClosed = openBugsScoped.reduce((sum, entry) => sum + entry.closed, 0)
  const openBugTotal = openBugsScoped.reduce((sum, entry) => sum + entry.open, 0)
  const openBugAverageAge = openBugTotal
    ? Math.round(
        (openBugsScoped.reduce(
          (sum, entry) => sum + entry.averageOpenAgeDays * entry.open,
          0
        ) /
          openBugTotal) *
          10
      ) / 10
    : 0
  const openBugOldest = openBugsScoped.reduce(
    (max, entry) => Math.max(max, entry.oldestOpenAgeDays),
    0
  )

  const selectedDocStats = selectedSprint?.id ? documentationBySprint[selectedSprint.id] : null
  const docsPending = selectedDocStats
    ? selectedDocStats.draft + selectedDocStats.underReview
    : 0

  const heroMetrics: MetricCard[] = [
    {
      title: 'Release Readiness',
      value: metricsLoading ? '--' : `${releaseReadinessPercent}%`,
      subtitle: selectedSprint
        ? `${selectedSprint.finalPhaseTickets}/${selectedSprint.totalTickets} in final phase`
        : 'No active sprint',
      icon: CheckCircle2,
      color: 'from-green-600 to-green-500',
      trend: selectedSprint ? `${selectedSprint.daysLeft}d left` : '',
      size: 'hero',
    },
    {
      title: 'Sprint Progress',
      value: metricsLoading ? '--' : `${sprintProgressPercent}%`,
      subtitle: selectedSprint
        ? `${selectedSprint.storyPointsCompleted}/${selectedSprint.storyPointsTotal} SP closed`
        : 'No active sprint',
      icon: BarChart3,
      color: 'from-blue-600 to-blue-500',
      trend: selectedSprint
        ? `${selectedSprint.doneTickets}/${selectedSprint.totalTickets} tickets`
        : '',
      size: 'hero',
    },
    {
      title: 'Risk Level',
      value: metricsLoading ? '--' : riskLevelLabel,
      subtitle: metricsLoading
        ? 'Loading risk signals'
        : `${riskCount} signals · carryover, final phase, bounce, past due`,
      icon: Zap,
      color: 'from-rose-600 to-rose-500',
      size: 'hero',
    },
    {
      title: 'Open Bugs',
      value: metricsLoading ? '--' : openBugTotal,
      subtitle: metricsLoading
        ? 'Loading bug aging'
        : `Created ${openBugCreated} / Closed ${openBugClosed} / ${openBugAverageAge}d avg`,
      icon: Bug,
      color: 'from-red-600 to-red-500',
      size: 'hero',
    },
  ]

  const roleMetrics: Record<'management' | 'qa' | 'product', MetricCard[]> = {
    management: [
      {
        title: 'Top Blockers',
        value: metricsLoading ? '--' : riskCount,
        subtitle: 'Active risk signals',
        icon: Zap,
        color: 'from-rose-600 to-rose-500',
        size: 'compact',
      },
      {
        title: 'Delivery Confidence',
        value: metricsLoading ? '--' : `${releaseReadinessPercent}%`,
        subtitle: selectedSprint
          ? `${selectedSprint.finalPhaseTickets}/${selectedSprint.totalTickets} final phase`
          : 'No active sprint',
        icon: CheckCircle2,
        color: 'from-emerald-600 to-emerald-500',
        size: 'compact',
      },
      {
        title: 'Quality Trend',
        value: metricsLoading
          ? '--'
          : `${selectedSprint?.bounceBackPercent ?? totalBounceBackPercent}%`,
        subtitle: selectedSprint
          ? `${selectedSprint.bounceBackTickets} returns`
          : 'Carryover, final phase, bounce back, past due',
        icon: BookOpen,
        color: 'from-amber-600 to-amber-500',
        size: 'compact',
      },
    ],
    qa: [
      {
        title: 'In QA',
        value: metricsLoading ? '--' : selectedSprint?.qaTickets ?? 0,
        subtitle: selectedSprint ? `Sprint ${selectedSprint.name}` : 'No active sprint',
        icon: Bug,
        color: 'from-purple-600 to-purple-500',
        size: 'compact',
      },
      {
        title: 'Open Bugs',
        value: metricsLoading ? '--' : openBugTotal,
        subtitle: metricsLoading
          ? 'Loading bug aging'
          : `Created ${openBugCreated} / Closed ${openBugClosed} / ${openBugAverageAge}d avg`,
        icon: Bug,
        color: 'from-red-600 to-red-500',
        size: 'compact',
      },
      {
        title: 'Docs Pending',
        value: docsLoading ? '--' : docsPending,
        subtitle: docsLoading
          ? 'Loading docs'
          : selectedDocStats
          ? `${selectedDocStats.draft} draft · ${selectedDocStats.underReview} review`
          : 'No doc data',
        icon: BookOpen,
        color: 'from-orange-600 to-orange-500',
        loading: docsLoading,
        size: 'compact',
      },
    ],
    product: [
      {
        title: 'Acceptance Completion',
        value: metricsLoading ? '--' : `${releaseReadinessPercent}%`,
        subtitle: selectedSprint
          ? `${selectedSprint.finalPhaseTickets}/${selectedSprint.totalTickets} final phase`
          : 'No active sprint',
        icon: CheckCircle2,
        color: 'from-emerald-600 to-emerald-500',
        size: 'compact',
      },
      {
        title: 'Sprint Scope',
        value: metricsLoading ? '--' : selectedSprint?.totalTickets ?? 0,
        subtitle: selectedSprint
          ? `Planned tickets in ${selectedSprint.name}`
          : 'No active sprint',
        icon: GitBranch,
        color: 'from-purple-600 to-purple-500',
        trend: selectedSprint ? `${selectedSprint.doneTickets} finished` : '',
        size: 'compact',
      },
      {
        title: 'Release Notes Draft',
        value: docsLoading ? '--' : selectedDocStats?.draft ?? 0,
        subtitle: docsLoading
          ? 'Loading docs'
          : selectedDocStats
          ? `${selectedDocStats.underReview} in review`
          : 'No doc data',
        icon: BookOpen,
        color: 'from-slate-600 to-slate-500',
        loading: docsLoading,
        size: 'compact',
      },
    ],
  }

  const riskMetric: MetricCard = {
    title: 'Risk Signals',
    value: metricsLoading ? '--' : riskCount,
    subtitle:
      selectedSprint
        ? `${selectedSprint.name} · ${riskLevelLabel} risk`
        : 'Carryover, final phase, bounce back, past due',
    icon: Zap,
    color: 'from-rose-600 to-rose-500',
    columns: ['Ticket', 'Status', 'Signals'],
    rows: riskSignalsScoped.map((signal) => ({
      label: signal.jiraId || signal.summary,
      columns: [
        {
          value: `${signal.jiraId}`,
          href: `/sprints?sprintId=${signal.sprintId}&filter=active`,
        },
        signal.status,
        `${signal.reasons.join(' · ')}`,
      ],
    })),
  }

  const deliveryMetrics = filteredActiveSprints.map((sprint, index) => ({
    title: `Delivery Commitment - ${sprint.name}`,
    value: metricsLoading ? '--' : `${sprint.storyPointsCompleted} / ${sprint.storyPointsTotal}`,
    subtitle: 'Allocated vs delivered',
    icon: Zap,
    color: index % 2 === 0 ? 'from-amber-600 to-amber-500' : 'from-amber-500 to-orange-500',
    trend: metricsLoading ? '...' : '',
    rows: [
      {
        label: 'Assignees',
        columns: ['Assignee', 'Allocated', 'Delivered'],
        rows: sprint.assignees.map((assignee) => [
          {
            value: assignee.name,
            href: `/sprints?sprintId=${sprint.id}&assignee=${encodeURIComponent(assignee.name)}`,
          },
          `${assignee.total}`,
          `${assignee.closed}`,
        ]),
      },
    ],
  }))

  const assigneesMetric: MetricCard = {
    title: 'Assignees Workload',
    value: metricsLoading ? '--' : metricValues.assignees.length,
    subtitle: 'All active sprints',
    icon: User,
    color: 'from-slate-600 to-slate-500',
    trend: metricsLoading ? '...' : '',
    columns: ['Assignee', 'Assigned', 'In Progress', 'Closed', 'Bounce'],
    rows: metricValues.assignees.map((assignee) => ({
      label: assignee.name,
      columns: [
        assignee.name,
        {
          value: `${assignee.total}`,
          href: `/sprints?assignee=${encodeURIComponent(assignee.name)}`,
        },
        {
          value: `${assignee.inProgress}`,
          href: `/sprints?assignee=${encodeURIComponent(assignee.name)}&devOnly=1`,
        },
        {
          value: `${assignee.closed}`,
          href: `/sprints?assignee=${encodeURIComponent(assignee.name)}&closedOnly=1`,
        },
        {
          value: `${assignee.bounce}`,
          href: `/sprints?assignee=${encodeURIComponent(assignee.name)}&bounceOnly=1`,
        },
      ],
    })),
  }

  const bounceBackMetric: MetricCard = {
    title: 'Bounce-back',
    value: metricsLoading
      ? '--'
      : `${selectedSprint?.bounceBackPercent ?? totalBounceBackPercent}%`,
    subtitle: selectedSprint
      ? `${selectedSprint.bounceBackTickets} returned tickets`
      : 'No active sprint',
    icon: BookOpen,
    color: 'from-orange-600 to-orange-500',
    trend: metricsLoading ? '...' : '',
    rows: filteredActiveSprints.map((sprint) => ({
      label: sprint.name,
      value: `${sprint.bounceBackPercent}%`,
    })),
  }

  const insightRows: MetricRow[] = [
    {
      label: 'Days left in sprint',
      value: selectedSprint
        ? {
            value: `${selectedSprint.daysLeft}d`,
            className: selectedSprint.daysLeft < 0 ? 'text-red-300' : 'text-slate-100',
          }
        : '--',
    },
    {
      label: 'Risk signals open',
      value: `${riskCount}`,
    },
    {
      label: 'Oldest open bug',
      value: `${openBugOldest}d`,
    },
    {
      label: 'Bounce-back rate',
      value: `${selectedSprint?.bounceBackPercent ?? totalBounceBackPercent}%`,
    },
  ]


  const renderMetricCard = (metric: MetricCard, key: string) => {
    const showSkeleton = metric.loading ?? metricsLoading
    const size = metric.size ?? 'standard'
    const titleClassName = size === 'compact' ? 'text-xs' : 'text-sm'
    const valueClassName =
      size === 'hero' ? 'text-4xl' : size === 'compact' ? 'text-2xl' : 'text-3xl'
    const cardPadding = size === 'compact' ? 'p-4' : size === 'hero' ? 'p-7' : 'p-6'
    const iconClassName = size === 'compact' ? 'w-5 h-5' : size === 'hero' ? 'w-8 h-8' : 'w-7 h-7'
    const card = (
      <div className="glass-card rounded-xl overflow-hidden group hover:border-blue-500/50 transition-all duration-300 animate-slideInUp h-full">
        <div className={`h-1 bg-gradient-to-r ${metric.color}`}></div>
        <CardContent className={cardPadding}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className={`text-slate-300 ${titleClassName} font-semibold mb-1`}>
                {metric.title}
              </p>
              {showSkeleton ? (
                <div className="h-8 w-24 rounded-md bg-slate-700/60 animate-pulse"></div>
              ) : (
                <h3 className={`${valueClassName} font-bold text-white tracking-tight`}>
                  {metric.value}
                </h3>
              )}
            </div>
            <metric.icon
              className={`${iconClassName} text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity`}
            />
          </div>
          {metric.subtitle ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{metric.subtitle}</span>
              <span className="text-xs text-green-400 font-semibold">{metric.trend}</span>
            </div>
          ) : null}
          {metric.filter ? (
            <div
              className="mt-3"
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              {metric.filter}
            </div>
          ) : null}
          {!showSkeleton && metric.rows?.length ? (
            <div className="mt-4 space-y-2 text-xs text-slate-300">
              {metric.columns ? (
                <div
                  className="grid gap-2 text-[10px] uppercase text-slate-500 text-center"
                  style={{ gridTemplateColumns: `repeat(${metric.columns.length}, minmax(0, 1fr))` }}
                >
                  {metric.columns.map((column: string) => (
                    <span key={column}>{column}</span>
                  ))}
                </div>
              ) : null}
              {metric.rows.map((row, index: number) => {
                if ('rows' in row && row.rows) {
                  return (
                    <div
                      key={`${row.label}-${index}`}
                      className="rounded-lg bg-slate-900/40 px-2.5 py-2"
                    >
                      <div className="text-[11px] uppercase text-slate-500 mb-1">
                        {row.label}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] uppercase text-slate-500 text-center mb-2">
                        {row.columns.map((column: string) => (
                          <span key={`${row.label}-${column}`}>{column}</span>
                        ))}
                      </div>
                      <div className="space-y-1">
                        {row.rows.map((values, rowIndex: number) => (
                          <div
                            key={`${row.label}-row-${rowIndex}`}
                            className="grid grid-cols-3 gap-2 rounded-md bg-slate-900/50 px-2 py-1 text-xs text-slate-100 text-center"
                          >
                            {values.map((value, valueIndex) => {
                              const content =
                                typeof value === 'object' && value && 'value' in value ? (
                                  value.href ? (
                                    <Link href={value.href} className="text-blue-300 hover:text-blue-200">
                                      {value.value}
                                    </Link>
                                  ) : (
                                    value.value
                                  )
                                ) : (
                                  value
                                )
                              return (
                                <span
                                  key={`${row.label}-${rowIndex}-${valueIndex}`}
                                  className={valueIndex === 0 ? 'truncate' : ''}
                                >
                                  {content}
                                </span>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
                if (metric.columns && 'columns' in row) {
                  return (
                    <div
                      key={row.label}
                      className="grid gap-2 rounded-lg bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-100 text-center"
                      style={{ gridTemplateColumns: `repeat(${row.columns.length}, minmax(0, 1fr))` }}
                    >
                      {row.columns.map((value, valueIndex: number) => {
                        const content =
                          typeof value === 'object' && value && 'value' in value ? (
                            value.href ? (
                              <Link href={value.href} className="text-blue-300 hover:text-blue-200">
                                {value.value}
                              </Link>
                            ) : (
                              value.value
                            )
                          ) : (
                            value
                          )
                        return (
                          <span key={`${row.label}-${valueIndex}`} className={valueIndex === 0 ? 'truncate' : ''}>
                            {content}
                          </span>
                        )
                      })}
                    </div>
                  )
                }
                const rawValue = 'value' in row ? row.value : ''
                const valueContent =
                  typeof rawValue === 'object' && rawValue !== null && 'value' in rawValue
                    ? rawValue.value
                    : rawValue
                const valueClassName =
                  typeof rawValue === 'object' && rawValue !== null && rawValue.className
                    ? rawValue.className
                    : 'text-slate-100'
                const rowContent = (
                  <div
                    className={`flex items-center justify-between gap-3 rounded-lg bg-slate-900/40 px-2.5 py-1.5 ${
                      'href' in row && row.href ? 'hover:bg-slate-900/60 transition-colors' : ''
                    }`}
                  >
                    <span
                      className="truncate"
                      title={'labelTitle' in row && row.labelTitle ? row.labelTitle : row.label}
                    >
                      {row.label}
                    </span>
                    <span className={`${valueClassName} font-semibold`}>
                      {valueContent as string | number}
                    </span>
                  </div>
                )
                if (!('href' in row) || !row.href) {
                  return <div key={row.label}>{rowContent}</div>
                }
                return (
                  <Link key={row.label} href={row.href} className="block">
                    {rowContent}
                  </Link>
                )
              })}
            </div>
          ) : null}
        </CardContent>
      </div>
    )

    if (!metric.href || metric.filter) {
      return <div key={key}>{card}</div>
    }
    return (
      <Link key={key} href={metric.href} className="block">
        {card}
      </Link>
    )
  }


  const quickActions = [
    {
      title: 'Sprint Monitoring',
      description: 'Track active sprints from Jira',
      icon: BarChart3,
      href: '/sprints',
      color: 'from-blue-500/20 to-blue-600/20',
      borderColor: 'border-blue-500/30',
    },
    {
      title: 'Generate Scenarios',
      description: 'Create test scenarios from tickets',
      icon: Zap,
      href: '/scenarios',
      color: 'from-purple-500/20 to-purple-600/20',
      borderColor: 'border-purple-500/30',
    },
    {
      title: 'Documentation Review',
      description: 'Review and publish docs',
      icon: BookOpen,
      href: '/documentation',
      color: 'from-orange-500/20 to-orange-600/20',
      borderColor: 'border-orange-500/30',
    },
  ]

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-none w-full px-6 lg:px-10 py-8 space-y-10">
        <div className="animate-fadeIn space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
              <p className="text-slate-400">
                Executive summary and operational signals in one place.
              </p>
            </div>
            {isAdmin ? (
              <div className="flex flex-col items-end gap-1.5">
                <Button
                  size="sm"
                  onClick={handleJiraSync}
                  disabled={syncing}
                  className="bg-blue-600/80 hover:bg-blue-600 text-white"
                >
                  {syncing ? 'Syncing...' : 'Jira Sync'}
                </Button>
                {metricValues.lastSyncAt ? (
                  <div className="text-xs text-slate-400">
                    Last sync: {new Date(metricValues.lastSyncAt).toLocaleString()}
                  </div>
                ) : null}
                {syncMessage ? <div className="text-xs text-green-300">{syncMessage}</div> : null}
                {syncError ? <div className="text-xs text-red-300">{syncError}</div> : null}
              </div>
            ) : null}
          </div>

          <div className="glass-card rounded-xl p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Team</span>
                <select
                  className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200"
                  value={selectedTeamKey}
                  onChange={(event) => setSelectedTeamKey(event.target.value)}
                >
                  {teamKeys.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </div>
              <span className="h-4 w-px bg-slate-700/60 hidden sm:block" />
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Sprint</span>
                <select
                  className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200"
                  value={selectedSprint?.id || ''}
                  onChange={(event) => setSelectedSprintId(event.target.value || null)}
                >
                  {filteredSyncedSprints.length ? (
                    filteredSyncedSprints.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.teamKey} - {sprint.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No synced sprints</option>
                  )}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="badge">{selectedSprint?.teamKey || selectedTeamKey}</span>
              <span className="badge badge-success">
                {selectedSprint ? selectedSprint.name : 'No sprint'}
              </span>
            </div>
          </div>
        </div>

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Executive Summary</h2>
              <p className="text-slate-400 text-sm">Most important signals in 3 seconds.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {heroMetrics.map((metric, idx) => renderMetricCard(metric, `hero-${idx}`))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Role Slices</h2>
              <p className="text-slate-400 text-sm">
                Fast context for management, QA, and product.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[
                { id: 'management', label: 'Management' },
                { id: 'qa', label: 'QA' },
                { id: 'product', label: 'Product' },
              ].map((role) => (
                <button
                  key={role.id}
                  className={`rounded-full px-4 py-1 text-xs font-semibold transition-all ${
                    selectedRole === role.id
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-slate-800/60 text-slate-400 border border-slate-700/40 hover:text-slate-200'
                  }`}
                  onClick={() =>
                    setSelectedRole(role.id as 'management' | 'qa' | 'product')
                  }
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roleMetrics[selectedRole].map((metric, idx) =>
              renderMetricCard(metric, `role-${selectedRole}-${idx}`)
            )}
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-white">Operational Detail</h2>
            <p className="text-slate-400 text-sm">Risk, delivery, and workload signals.</p>
          </div>
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 xl:col-span-7">
              {renderMetricCard(riskMetric, 'risk')}
            </div>
            <div className="col-span-12 xl:col-span-5 space-y-4">
              {deliveryMetrics.length ? (
                deliveryMetrics.map((metric, idx) =>
                  renderMetricCard(metric, `delivery-${idx}`)
                )
              ) : (
                <div className="glass-card rounded-xl p-6 text-slate-400">
                  No active sprint data available.
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 xl:col-span-7">
              {renderMetricCard(assigneesMetric, 'assignees')}
            </div>
            <div className="col-span-12 xl:col-span-5">
              {renderMetricCard(bounceBackMetric, 'bounce')}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-white">Actions and Insights</h2>
            <p className="text-slate-400 text-sm">Keep the next steps visible.</p>
          </div>
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 xl:col-span-5">
              <div className="grid grid-cols-1 gap-4">
                {quickActions.map((action, idx) => {
                  const Icon = action.icon
                  return (
                    <Link key={idx} href={action.href}>
                      <Card
                        className={`glass-card ${action.borderColor} h-full hover:border-blue-400/50 transition-all duration-300 cursor-pointer group animate-slideInUp`}
                        style={{ animationDelay: `${idx * 150}ms` }}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg group-hover:text-blue-400 transition-colors">
                                {action.title}
                              </CardTitle>
                              <CardDescription className="text-slate-500 text-xs mt-1">
                                {action.description}
                              </CardDescription>
                            </div>
                            <Icon className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          >
                            Explore -&gt;
                          </Button>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </div>
            <div className="col-span-12 xl:col-span-7">
              <div className="glass-card rounded-xl overflow-hidden group h-full">
                <div className="h-1 bg-gradient-to-r from-blue-600 to-blue-500"></div>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-slate-300 text-sm font-semibold mb-1">Key Insights</p>
                      <h3 className="text-2xl font-bold text-white tracking-tight">
                        Focus areas
                      </h3>
                      <p className="text-xs text-slate-400">
                        Highlights for the selected sprint.
                      </p>
                    </div>
                    <BarChart3 className="w-7 h-7 text-slate-400 opacity-60" />
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-slate-300">
                    {insightRows.map((row) => {
                      if (!('value' in row)) return null
                      const rawValue = row.value
                      const valueContent =
                        typeof rawValue === 'object' && rawValue !== null && 'value' in rawValue
                          ? rawValue.value
                          : rawValue
                      const valueClassName =
                        typeof rawValue === 'object' && rawValue !== null && rawValue.className
                          ? rawValue.className
                          : 'text-slate-100'
                      return (
                        <div
                          key={row.label}
                          className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/40 px-2.5 py-1.5"
                        >
                          <span className="truncate">{row.label}</span>
                          <span className={`${valueClassName} font-semibold`}>{valueContent}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
