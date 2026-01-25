'use client'

import React, { useEffect, useState } from 'react'
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
} from 'lucide-react'

type MetricValueCell =
  | string
  | number
  | { value: string | number; href: string }

type MetricRowSimple = {
  label: string
  value: string | number
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
}

export default function Dashboard() {
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [selectedActiveSprintId, setSelectedActiveSprintId] = useState<string | null>(null)
  const [metricValues, setMetricValues] = useState({
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
      assignees: Array<{ name: string; total: number; closed: number }>
    }>,
    storyPoints: {
      currentTotal: null as number | null,
      previousTotal: null as number | null,
      delta: null as number | null,
    },
    finishedComparison: null as null | {
      activeSprintId: string
      activeSprintName: string
      activeClosedTickets: number
      activeStoryPointsClosed: number
      previousSprintId: string | null
      previousSprintName: string | null
      previousClosedTickets: number
      previousStoryPointsClosed: number
      periodDays: number
    },
    finishedComparisonByTeam: [] as Array<{
      teamKey: string
      activeSprintId: string
      activeSprintName: string
      activeClosedTickets: number
      activeStoryPointsClosed: number
      previousSprintId: string | null
      previousSprintName: string | null
      previousClosedTickets: number
      previousStoryPointsClosed: number
      periodDays: number
    }>,
    assignees: [] as Array<{
      name: string
      total: number
      closed: number
      bounce: number
      inProgress: number
    }>,
    deliveryTimes: [] as Array<{
      name: string
      ticketCount: number
      averageHours: number
      totalHours: number
      avgStoryPointsAllocated?: number
      avgStoryPointsClosed?: number
      storyPointSprintCount?: number
    }>,
    deliveryTimesBySprint: [] as Array<{
      sprintId: string
      sprintName: string
      entries: Array<{
        name: string
        ticketCount: number
        averageHours: number
        totalHours: number
        carryoverCount?: number
        carryoverRate?: number
        avgStoryPointsAllocated?: number
        avgStoryPointsClosed?: number
        storyPointSprintCount?: number
      }>
    }>,
  })
  const [deliverySprintId, setDeliverySprintId] = useState('all')
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const authToken = localStorage.getItem('token')
        const response = await fetch('/api/metrics/jira?includeDeliveryTimes=0', {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (!response.ok) {
          return
        }
        const data = await response.json()
        setMetricValues({
          activeSprintCount: data.activeSprintCount ?? null,
          activeSprints: data.activeSprints || [],
          storyPoints: {
            currentTotal: data.storyPoints?.currentTotal ?? null,
            previousTotal: data.storyPoints?.previousTotal ?? null,
            delta: data.storyPoints?.delta ?? null,
          },
          finishedComparison: data.finishedComparison ?? null,
          finishedComparisonByTeam: data.finishedComparisonByTeam || [],
          assignees: data.assignees || [],
          deliveryTimes: data.deliveryTimes || [],
          deliveryTimesBySprint: data.deliveryTimesBySprint || [],
        })
      } catch {
        // Keep defaults on error
      } finally {
        setMetricsLoading(false)
      }
    }

    const loadDeliveryTimes = async () => {
      try {
        setDeliveryLoading(true)
        const authToken = localStorage.getItem('token')
        const response = await fetch('/api/metrics/jira?includeDeliveryTimes=1', {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (!response.ok) {
          return
        }
        const data = await response.json()
        setMetricValues((prev) => ({
          ...prev,
          deliveryTimes: data.deliveryTimes || [],
          deliveryTimesBySprint: data.deliveryTimesBySprint || [],
        }))
      } catch {
        // Keep current delivery times on error
      } finally {
        setDeliveryLoading(false)
      }
    }

    loadMetrics().then(loadDeliveryTimes)
  }, [])

  useEffect(() => {
    if (metricValues.activeSprints.length === 0) return
    if (selectedSprintId) return
    const sorted = [...metricValues.activeSprints].sort(
      (a, b) => b.doneTickets - a.doneTickets || a.name.localeCompare(b.name)
    )
    setSelectedSprintId(sorted[0]?.id || null)
  }, [metricValues.activeSprints, selectedSprintId])

  useEffect(() => {
    if (metricValues.activeSprints.length === 0) return
    if (selectedActiveSprintId) return
    const sorted = [...metricValues.activeSprints].sort(
      (a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name)
    )
    setSelectedActiveSprintId(sorted[0]?.id || null)
  }, [metricValues.activeSprints, selectedActiveSprintId])

  const totalDevTickets = metricValues.activeSprints.reduce(
    (sum, sprint) => sum + sprint.devTickets,
    0
  )
  const totalQaTickets = metricValues.activeSprints.reduce(
    (sum, sprint) => sum + sprint.qaTickets,
    0
  )
  const totalTickets = metricValues.activeSprints.reduce(
    (sum, sprint) => sum + sprint.totalTickets,
    0
  )
  const totalStoryPoints = metricValues.activeSprints.reduce(
    (sum, sprint) => sum + sprint.storyPointsTotal,
    0
  )
  const totalStoryPointsCompleted = metricValues.activeSprints.reduce(
    (sum, sprint) => sum + sprint.storyPointsCompleted,
    0
  )
  const totalBounceBackTickets = metricValues.activeSprints.reduce(
    (sum, sprint) => sum + sprint.bounceBackTickets,
    0
  )
  const totalBounceBackPercent = totalTickets
    ? Math.round((totalBounceBackTickets / totalTickets) * 1000) / 10
    : 0
  const activeSprintByEnd = [...metricValues.activeSprints].sort(
    (a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name)
  )
  const currentActiveSprint =
    metricValues.activeSprints.find((sprint) => sprint.id === selectedActiveSprintId) ||
    activeSprintByEnd[0]
  const currentSprintSuccessCount = currentActiveSprint
    ? currentActiveSprint.qaReadyTickets + currentActiveSprint.doneTickets
    : 0
  const currentSprintSuccessPercent = currentActiveSprint?.totalTickets
    ? Math.round((currentSprintSuccessCount / currentActiveSprint.totalTickets) * 1000) / 10
    : 0

  const selectedSprint = metricValues.activeSprints.find(
    (sprint) => sprint.id === selectedSprintId
  )
  const selectedComparison = selectedSprint
    ? metricValues.finishedComparisonByTeam.find(
        (entry) => entry.activeSprintId === selectedSprint.id
      )
    : null
  const topContributor = selectedSprint?.assignees
    ? [...selectedSprint.assignees].sort((a, b) => b.closed - a.closed)[0]
    : null
  const currentTicketsClosed =
    selectedComparison?.activeClosedTickets ?? selectedSprint?.doneTickets ?? 0
  const currentStoryPointsClosed =
    selectedComparison?.activeStoryPointsClosed ?? selectedSprint?.storyPointsCompleted ?? 0

  const generalMetrics = [
    {
      title: 'Sprint Delivery',
      value: metricsLoading ? '--' : currentTicketsClosed,
      subtitle: selectedSprint ? `Current sprint: ${selectedSprint.name}` : 'Current sprint',
      icon: CheckCircle2,
      color: 'from-green-600 to-green-500',
      trend: metricsLoading ? '...' : '',
      filter: (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-400">Sprint</span>
          <select
            className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200"
            value={selectedSprint?.id || ''}
            onChange={(event) => setSelectedSprintId(event.target.value || null)}
          >
            {metricValues.activeSprints
              .slice()
              .sort((a, b) => b.doneTickets - a.doneTickets || a.name.localeCompare(b.name))
              .map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.teamKey} - {sprint.name}
                </option>
              ))}
          </select>
        </div>
      ),
      rows: selectedSprint
        ? [
            {
              label: 'Team size',
              value: `${selectedSprint.assignees.length} devs`,
            },
            {
              label: 'Board tickets',
              value: `${selectedSprint.totalTickets}`,
            },
            {
              label: 'Story points (total)',
              value: `${selectedSprint.storyPointsTotal}`,
            },
            {
              label: 'Tickets closed',
              value: selectedComparison
                ? `${currentTicketsClosed} (prev ${selectedComparison.previousClosedTickets})`
                : `${currentTicketsClosed}`,
              href: `/sprints?sprintId=${selectedSprint.id}&filter=active&closedOnly=1`,
            },
            {
              label: 'Story points closed',
              value: selectedComparison
                ? `${currentStoryPointsClosed} (prev ${selectedComparison.previousStoryPointsClosed})`
                : `${currentStoryPointsClosed}`,
              href: `/sprints?sprintId=${selectedSprint.id}&filter=active&closedOnly=1`,
            },
            {
              label: 'Top contributor',
              value: topContributor ? `${topContributor.name} (${topContributor.closed} SP)` : '--',
            },
            selectedComparison?.previousSprintId
              ? {
                  label: `Previous sprint (${selectedComparison.periodDays}d)`,
                  value: selectedComparison.previousSprintName || 'Previous',
                  href: `/sprints?sprintId=${selectedComparison.previousSprintId}&filter=completed&closedOnly=1`,
                }
              : null,
          ].filter(Boolean)
        : [],
    },
    {
      title: 'Active Sprints',
      value: metricValues.activeSprintCount ?? '--',
      subtitle: 'Current sprint delivery status',
      icon: BarChart3,
      color: 'from-blue-600 to-blue-500',
      trend: metricsLoading ? '...' : '',
      href: '/sprints?filter=active',
      filter: (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-400">Sprint</span>
          <select
            className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200"
            value={currentActiveSprint?.id || ''}
            onChange={(event) => setSelectedActiveSprintId(event.target.value || null)}
          >
            {activeSprintByEnd.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
              </option>
            ))}
          </select>
        </div>
      ),
      rows: currentActiveSprint
        ? [
            {
              label: `Sprint`,
              value: currentActiveSprint.name,
              href: `/sprints?sprintId=${currentActiveSprint.id}&filter=active`,
            },
            {
              label: 'Success rate',
              value: `${currentSprintSuccessPercent}%`,
              href: `/sprints?sprintId=${currentActiveSprint.id}&filter=active`,
            },
            {
              label: 'Days left',
              value: `${currentActiveSprint.daysLeft}d`,
              href: `/sprints?sprintId=${currentActiveSprint.id}&filter=active`,
            },
            {
              label: 'Planned tickets',
              value: `${currentActiveSprint.totalTickets}`,
              href: `/sprints?sprintId=${currentActiveSprint.id}&filter=active`,
            },
            {
              label: 'Final phase tickets',
              value: `${currentSprintSuccessCount}`,
              href: `/sprints?sprintId=${currentActiveSprint.id}&filter=active`,
            },
          ]
        : [],
    },
    {
      title: 'Tickets In Development',
      value: metricsLoading ? '--' : `${totalDevTickets} / ${totalQaTickets}`,
      subtitle: 'Dev / QA (active)',
      icon: Zap,
      color: 'from-purple-600 to-purple-500',
      trend: metricsLoading ? '...' : '',
      href: '/sprints?filter=active',
      rows: metricValues.activeSprints.map((sprint) => ({
        label: sprint.name,
        value: `${sprint.devTickets} / ${sprint.qaTickets}`,
        href: `/sprints?sprintId=${sprint.id}&filter=active&devOnly=1`,
      })),
    },
    {
      title: 'Bounce-back %',
      value: metricsLoading ? '--' : `${totalBounceBackPercent}%`,
      subtitle: 'Tickets with returns',
      icon: BookOpen,
      color: 'from-orange-600 to-orange-500',
      trend: metricsLoading ? '...' : '',
      rows: metricValues.activeSprints.map((sprint) => ({
        label: sprint.name,
        value: `${sprint.bounceBackPercent}%`,
      })),
    },
    {
      title: 'Story Points',
      value:
        metricValues.storyPoints.currentTotal != null
          ? metricValues.storyPoints.currentTotal
          : '--',
      subtitle: 'Per active sprint',
      icon: BookOpen,
      color: 'from-cyan-600 to-cyan-500',
      trend:
        metricValues.storyPoints.delta != null
          ? `${metricValues.storyPoints.delta >= 0 ? '+' : ''}${metricValues.storyPoints.delta}`
          : '',
      rows: metricValues.activeSprints.map((sprint) => ({
        label: sprint.name,
        value: `${sprint.storyPointsTotal}`,
      })),
    },
    {
      title: 'Closed + Story Points',
      value: metricsLoading ? '--' : `${totalStoryPointsCompleted} / ${totalStoryPoints}`,
      subtitle: 'Closed vs total (active)',
      icon: CheckCircle2,
      color: 'from-emerald-600 to-emerald-500',
      trend: metricsLoading ? '...' : '',
      rows: metricValues.activeSprints.map((sprint) => ({
        label: sprint.name,
        value: `${sprint.storyPointsCompleted} / ${sprint.storyPointsTotal} pts`,
      })),
    },
  ]

  const deliveryMetrics = metricValues.activeSprints.map((sprint, index) => ({
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

  const selectedDeliveryEntries =
    deliverySprintId === 'all'
      ? metricValues.deliveryTimes
      : metricValues.deliveryTimesBySprint.find(
          (sprint) => sprint.sprintId === deliverySprintId
        )?.entries || []

  const assigneesMetric = {
    title: 'Assignees',
    value: metricsLoading ? '--' : metricValues.assignees.length,
    subtitle: '',
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

  const deliveryTimeMetric = {
    title: 'Delivery Time',
    value: metricsLoading || deliveryLoading ? '--' : selectedDeliveryEntries.length,
    subtitle: 'Average business hours per ticket',
    icon: Zap,
    color: 'from-sky-600 to-sky-500',
    trend: metricsLoading || deliveryLoading ? '...' : '',
    loading: deliveryLoading,
    filter: (
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">Sprint</span>
        <select
          className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200"
          value={deliverySprintId}
          onChange={(event) => setDeliverySprintId(event.target.value)}
        >
          <option value="all">All active sprints</option>
          {metricValues.activeSprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name}
            </option>
          ))}
        </select>
      </div>
    ),
    columns: ['Assignee', 'Tickets', 'Avg Hours', 'Avg SP (last 5)', 'Carryover'],
    rows: selectedDeliveryEntries.map((entry) => ({
      label: entry.name,
      columns: [
        entry.name,
        `${entry.ticketCount}`,
        `${entry.averageHours}h`,
        `${entry.avgStoryPointsAllocated ?? 0} / ${entry.avgStoryPointsClosed ?? 0}`,
        entry.carryoverRate != null ? `${entry.carryoverRate}%` : '--',
      ],
    })),
  }

  const renderMetricCard = (metric: MetricCard, key: string) => {
    const showSkeleton = metric.loading ?? metricsLoading
    const card = (
      <div className="glass-card rounded-xl overflow-hidden group hover:border-blue-500/50 transition-all duration-300 animate-slideInUp">
        <div className={`h-1 bg-gradient-to-r ${metric.color}`}></div>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-slate-300 text-sm font-semibold mb-1">{metric.title}</p>
              {showSkeleton ? (
                <div className="h-8 w-24 rounded-md bg-slate-700/60 animate-pulse"></div>
              ) : (
                <h3 className="text-3xl font-bold text-white tracking-tight">{metric.value}</h3>
              )}
            </div>
            <metric.icon className="w-7 h-7 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          {metric.subtitle ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{metric.subtitle}</span>
              <span className="text-xs text-green-400 font-semibold">{metric.trend}</span>
            </div>
          ) : null}
          {metric.filter ? <div className="mt-3">{metric.filter}</div> : null}
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
                                typeof value === 'object' && value && value.href ? (
                                  <Link href={value.href} className="text-blue-300 hover:text-blue-200">
                                    {value.value}
                                  </Link>
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
                          typeof value === 'object' && value && value.href ? (
                            <Link href={value.href} className="text-blue-300 hover:text-blue-200">
                              {value.value}
                            </Link>
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
                const rowContent = (
                  <div
                    className={`flex items-center justify-between gap-3 rounded-lg bg-slate-900/40 px-2.5 py-1.5 ${
                      'href' in row && row.href ? 'hover:bg-slate-900/60 transition-colors' : ''
                    }`}
                  >
                    <span className="truncate">{row.label}</span>
                    <span className="text-slate-100 font-semibold">
                      {'value' in row ? row.value : ''}
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

    if (!metric.href) {
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
      title: 'Code Impact Analysis',
      description: 'Review PR changes and impacts',
      icon: GitBranch,
      href: '/search',
      color: 'from-green-500/20 to-green-600/20',
      borderColor: 'border-green-500/30',
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 animate-fadeIn">
          <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-slate-400">Welcome back! Here&apos;s your test intelligence overview.</p>
        </div>

        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-white">Overview</h2>
            <p className="text-slate-400 text-sm">Key sprint and delivery signals</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {generalMetrics.map((metric, idx) => renderMetricCard(metric, `general-${idx}`))}
          </div>
        </div>

        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-white">Delivery Commitment</h2>
            <p className="text-slate-400 text-sm">Story points allocated vs delivered per sprint</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {deliveryMetrics.map((metric, idx) => renderMetricCard(metric, `delivery-${idx}`))}
          </div>
        </div>

        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-white">Assignees</h2>
            <p className="text-slate-400 text-sm">Assigned workload across active sprints</p>
          </div>
          {renderMetricCard(assigneesMetric, 'assignees')}
        </div>

        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-white">Delivery Time</h2>
            <p className="text-slate-400 text-sm">
              Time from In Progress to Closed (8h business days)
            </p>
          </div>
          {renderMetricCard(deliveryTimeMetric, 'delivery-time')}
        </div>

        <div className="mb-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Quick Actions</h2>
            <p className="text-slate-400 text-sm">Get started with your workflows</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <div className="mt-12 pt-12 border-t border-slate-700/30">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Why JQuality?</h2>
            <p className="text-slate-400 text-sm">Automate, organize, and optimize your testing workflow</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart3,
                title: 'Real-time Sync',
                description: 'Auto-sync with Jira, GitHub, and Confluence',
              },
              {
                icon: Zap,
                title: 'AI-Powered',
                description: 'Generate test scenarios with intelligent automation',
              },
              {
                icon: GitBranch,
                title: 'Analytics',
                description: 'Track quality metrics and team performance',
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="glass-card rounded-lg p-6 text-center hover:border-blue-500/50 transition-all duration-300 animate-fadeIn"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <feature.icon className="w-8 h-8 text-blue-300 mx-auto mb-4" />
                <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
