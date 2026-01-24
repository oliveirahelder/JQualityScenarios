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

export default function Dashboard() {
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricValues, setMetricValues] = useState({
    activeSprintCount: null as number | null,
    activeSprints: [] as Array<{
      id: string
      name: string
      successPercent: number
      daysLeft: number
      devTickets: number
      doneTickets: number
      bounceBackPercent: number
      bounceBackTickets: number
      storyPointsTotal: number
      storyPointsCompleted: number
      totalTickets: number
      closedTickets: number
    }>,
    storyPoints: {
      currentTotal: null as number | null,
      previousTotal: null as number | null,
      delta: null as number | null,
    },
    assignees: [] as Array<{
      name: string
      total: number
      closed: number
      bounce: number
      inProgress: number
    }>,
  })
  const [connectionStatus, setConnectionStatus] = useState({
    jira: 'disconnected',
    confluence: 'disconnected',
    github: 'disconnected',
    database: 'connected',
  })


  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const authToken = localStorage.getItem('token')
        const response = await fetch('/api/metrics/jira', {
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
          assignees: data.assignees || [],
        })
      } catch {
        // Keep defaults on error
      } finally {
        setMetricsLoading(false)
      }
    }

    loadMetrics()
  }, [])

  useEffect(() => {
    const loadConnections = async () => {
      try {
        const authToken = localStorage.getItem('token')
        const [jiraResponse, confluenceResponse] = await Promise.all([
          fetch('/api/integrations/jira', {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch('/api/integrations/confluence', {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
        ])

        let jiraStatus = 'disconnected'
        if (jiraResponse.ok) {
          const jiraData = await jiraResponse.json()
          jiraStatus = jiraData?.connectionStatus === 'connected' ? 'connected' : 'disconnected'
        }

        let confluenceStatus = 'disconnected'
        if (confluenceResponse.ok) {
          const confluenceData = await confluenceResponse.json()
          confluenceStatus =
            confluenceData?.connectionStatus === 'connected' ? 'connected' : 'disconnected'
        }

        setConnectionStatus((prev) => ({
          ...prev,
          jira: jiraStatus,
          confluence: confluenceStatus,
        }))
      } catch {
        // Keep defaults on error
      }
    }

    loadConnections()
  }, [])

  const totalDevTickets = metricValues.activeSprints.reduce(
    (sum, sprint) => sum + sprint.devTickets,
    0
  )
  const totalClosedTickets = metricValues.activeSprints.reduce(
    (sum, sprint) => sum + sprint.doneTickets,
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

  const metrics = [
    {
      title: 'Active Sprints',
      value: metricValues.activeSprintCount ?? '--',
      subtitle: 'Success % + days left',
      icon: BarChart3,
      color: 'from-blue-600 to-blue-500',
      trend: metricsLoading ? '...' : '',
      href: '/sprints',
      rows: metricValues.activeSprints.map((sprint) => ({
        label: sprint.name,
        value: `${sprint.successPercent}% | ${sprint.daysLeft}d`,
      })),
    },
    {
      title: 'Development Tickets',
      value: metricsLoading ? '--' : totalDevTickets,
      subtitle: 'In progress per sprint',
      icon: Zap,
      color: 'from-purple-600 to-purple-500',
      trend: metricsLoading ? '...' : '',
      rows: metricValues.activeSprints.map((sprint) => ({
        label: sprint.name,
        value: `${sprint.devTickets}`,
        href: `/sprints?sprintId=${sprint.id}&devOnly=1`,
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
      title: 'Tickets Closed',
      value: metricsLoading ? '--' : totalClosedTickets,
      subtitle: 'Closed per sprint',
      icon: CheckCircle2,
      color: 'from-green-600 to-green-500',
      trend: metricsLoading ? '...' : '',
      rows: metricValues.activeSprints.map((sprint) => ({
        label: sprint.name,
        value: `${sprint.doneTickets}`,
        href: `/sprints?sprintId=${sprint.id}&closedOnly=1`,
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
    {
      title: 'Assignees',
      value: metricsLoading ? '--' : metricValues.assignees.length,
      subtitle: '',
      icon: User,
      color: 'from-slate-600 to-slate-500',
      trend: metricsLoading ? '...' : '',
      span: 2,
      columns: ['Assignee', 'Assigned', 'In Progress', 'Closed', 'Bounce'],
      rows: metricValues.assignees.map((assignee) => ({
        label: assignee.name,
        columns: [
          assignee.name,
          `${assignee.total}`,
          `${assignee.inProgress}`,
          `${assignee.closed}`,
          `${assignee.bounce}`,
        ],
      })),
    },
  ]


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
          <p className="text-slate-400">Welcome back! Here's your test intelligence overview.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {metrics.map((metric, idx) => {
            const card = (
              <div
                className={`glass-card rounded-xl overflow-hidden group hover:border-blue-500/50 transition-all duration-300 animate-slideInUp ${
                  metric.span === 2 ? 'lg:col-span-2' : ''
                }`}
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className={`h-1 bg-gradient-to-r ${metric.color}`}></div>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-slate-300 text-sm font-semibold mb-1">{metric.title}</p>
                      <h3 className="text-4xl font-bold text-white tracking-tight">
                        {metric.value}
                      </h3>
                    </div>
                    <metric.icon className="w-7 h-7 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{metric.subtitle}</span>
                    <span className="text-xs text-green-400 font-semibold">{metric.trend}</span>
                  </div>
                  {metric.rows?.length ? (
                    <div className="mt-4 space-y-2 text-xs text-slate-300">
                    {metric.columns ? (
                      <div className="grid grid-cols-5 gap-2 text-[10px] uppercase text-slate-500 text-center">
                        {metric.columns.map((column) => (
                          <span key={column}>{column}</span>
                        ))}
                      </div>
                    ) : null}
                    {metric.rows.map((row) => {
                      if (metric.columns && row.columns) {
                        return (
                          <div
                            key={row.label}
                            className="grid grid-cols-5 gap-2 rounded-lg bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-100 text-center"
                          >
                            {row.columns.map((value, index) => (
                              <span
                                key={`${row.label}-${index}`}
                                className={index === 0 ? 'truncate' : ''}
                              >
                                {value}
                              </span>
                            ))}
                          </div>
                        )
                      }
                      const rowContent = (
                        <div
                          className={`flex items-center justify-between gap-3 rounded-lg bg-slate-900/40 px-2.5 py-1.5 ${
                            row.href ? 'hover:bg-slate-900/60 transition-colors' : ''
                          }`}
                        >
                          <span className="truncate">{row.label}</span>
                          <span
                            className={`text-slate-100 font-semibold ${
                              row.wrap ? 'whitespace-normal text-right text-[11px] leading-4' : ''
                            }`}
                          >
                            {row.value}
                          </span>
                        </div>
                      )
                      if (!row.href) {
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
              return <div key={idx} className={metric.span === 2 ? 'lg:col-span-2' : ''}>{card}</div>
            }

            return (
              <Link key={idx} href={metric.href} className={metric.span === 2 ? 'lg:col-span-2' : 'block'}>
                {card}
              </Link>
            )
          })}
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
