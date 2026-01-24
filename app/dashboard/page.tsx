'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BarChart3,
  GitBranch,
  BookOpen,
  Zap,
  CheckCircle2,
  AlertCircle,
  Plug,
  Database,
  User,
} from 'lucide-react'

interface JiraSettings {
  baseUrl: string
  user: string
  boardIds: string
  sprintFieldId: string
  requestTimeout: number
  hasToken: boolean
  connectionStatus?: string
  connectionCheckedAt?: string
}

interface ConfluenceSettings {
  baseUrl: string
  hasToken: boolean
  connectionStatus?: string
  connectionCheckedAt?: string
}

export default function Dashboard() {
  const [jiraLoading, setJiraLoading] = useState(true)
  const [jiraSaving, setJiraSaving] = useState(false)
  const [jiraTesting, setJiraTesting] = useState(false)
  const [jiraToken, setJiraToken] = useState('')
  const [jiraBoardUrl, setJiraBoardUrl] = useState('')
  const [jiraError, setJiraError] = useState('')
  const [jiraSuccess, setJiraSuccess] = useState('')
  const [jiraTestResult, setJiraTestResult] = useState<string | null>(null)
  const [jiraTestOk, setJiraTestOk] = useState<boolean | null>(null)
  const [showJiraConfig, setShowJiraConfig] = useState(false)
  const [jiraSettings, setJiraSettings] = useState<JiraSettings>({
    baseUrl: '',
    user: '',
    boardIds: '',
    sprintFieldId: '',
    requestTimeout: 30000,
    hasToken: false,
  })
  const jiraTimeoutMs = 30000

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

  const [confluenceLoading, setConfluenceLoading] = useState(true)
  const [confluenceSaving, setConfluenceSaving] = useState(false)
  const [confluenceTesting, setConfluenceTesting] = useState(false)
  const [confluenceToken, setConfluenceToken] = useState('')
  const [confluenceError, setConfluenceError] = useState('')
  const [confluenceSuccess, setConfluenceSuccess] = useState('')
  const [confluenceTestResult, setConfluenceTestResult] = useState<string | null>(null)
  const [confluenceTestOk, setConfluenceTestOk] = useState<boolean | null>(null)
  const [showConfluenceConfig, setShowConfluenceConfig] = useState(false)
  const [confluenceSettings, setConfluenceSettings] = useState<ConfluenceSettings>({
    baseUrl: '',
    hasToken: false,
  })

  useEffect(() => {
    const loadSettings = async () => {
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

        if (!jiraResponse.ok) {
          const data = await jiraResponse.json()
          throw new Error(data.error || 'Failed to load Jira settings')
        }

        if (!confluenceResponse.ok) {
          const data = await confluenceResponse.json()
          throw new Error(data.error || 'Failed to load Confluence settings')
        }

        const jiraData = await jiraResponse.json()
        setJiraSettings(jiraData)
        if (jiraData?.connectionStatus === 'connected' && jiraData?.connectionCheckedAt) {
          const checkedAt = new Date(jiraData.connectionCheckedAt)
          const maxAgeMs = 24 * 60 * 60 * 1000
          if (!Number.isNaN(checkedAt.getTime()) && Date.now() - checkedAt.getTime() < maxAgeMs) {
            setJiraTestOk(true)
            setJiraTestResult('Connected (last check within 24h)')
          }
        }

        const confluenceData = await confluenceResponse.json()
        setConfluenceSettings(confluenceData)
        if (
          confluenceData?.connectionStatus === 'connected' &&
          confluenceData?.connectionCheckedAt
        ) {
          const checkedAt = new Date(confluenceData.connectionCheckedAt)
          const maxAgeMs = 24 * 60 * 60 * 1000
          if (!Number.isNaN(checkedAt.getTime()) && Date.now() - checkedAt.getTime() < maxAgeMs) {
            setConfluenceTestOk(true)
            setConfluenceTestResult('Connected (last check within 24h)')
          }
        }
      } catch (err) {
        setJiraError(err instanceof Error ? err.message : 'Failed to load Jira settings')
      } finally {
        setJiraLoading(false)
        setConfluenceLoading(false)
      }
    }

    loadSettings()
  }, [])

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

  const validateJiraInputs = () => {
    const trimmedBaseUrl = jiraSettings.baseUrl.trim()
    const trimmedToken = jiraToken.trim()
    const trimmedBoardIds = jiraSettings.boardIds.trim()
    const trimmedBoardUrl = jiraBoardUrl.trim()

    if (!trimmedBaseUrl) {
      return 'Jira Base URL is required.'
    }
    if (!trimmedToken && !jiraSettings.hasToken) {
      return 'Jira token is required.'
    }
    if (!trimmedBoardIds && !trimmedBoardUrl) {
      return 'Provide either a Board URL or Board IDs.'
    }
    return ''
  }

  const saveJiraSettings = async () => {
    setJiraSaving(true)
    setJiraError('')
    setJiraSuccess('')

    try {
      const validationError = validateJiraInputs()
      if (validationError) {
        setJiraError(validationError)
        return false
      }

      const authToken = localStorage.getItem('token')
      const response = await fetch('/api/integrations/jira', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseUrl: jiraSettings.baseUrl,
          user: jiraSettings.user,
          boardIds: jiraSettings.boardIds,
          boardUrl: jiraBoardUrl,
          sprintFieldId: jiraSettings.sprintFieldId,
          requestTimeout: jiraTimeoutMs,
          token: jiraToken.trim() || undefined,
          authType: 'bearer',
          deployment: 'datacenter',
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save Jira settings')
      }

      setJiraToken('')
      setJiraBoardUrl('')
      setJiraSettings((prev) => ({ ...prev, hasToken: prev.hasToken || Boolean(jiraToken) }))
      setJiraSuccess('Jira connected.')
      setJiraTestOk(null)
      setJiraTestResult(null)
      return true
    } catch (err) {
      setJiraError(err instanceof Error ? err.message : 'Failed to save Jira settings')
      return false
    } finally {
      setJiraSaving(false)
    }
  }

  const handleJiraTest = async () => {
    setJiraTesting(true)
    setJiraTestResult(null)
    setJiraTestOk(null)
    setJiraError('')

    try {
      const authToken = localStorage.getItem('token')
      const response = await fetch('/api/integrations/jira/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to test Jira connection')
      }

      setJiraTestResult(`Connected as ${data.displayName || data.email || 'Jira user'}`)
      setJiraTestOk(true)
    } catch (err) {
      setJiraTestResult(null)
      setJiraTestOk(false)
      setJiraError(err instanceof Error ? err.message : 'Failed to test Jira connection')
    } finally {
      setJiraTesting(false)
    }
  }

  const handleJiraConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    const saved = await saveJiraSettings()
    if (saved) {
      await handleJiraTest()
    }
  }

  const validateConfluenceInputs = () => {
    const trimmedBaseUrl = confluenceSettings.baseUrl.trim()
    const trimmedToken = confluenceToken.trim()

    if (!trimmedBaseUrl) {
      return 'Confluence Base URL is required.'
    }
    if (!trimmedToken && !confluenceSettings.hasToken) {
      return 'Confluence token is required.'
    }
    return ''
  }

  const saveConfluenceSettings = async () => {
    setConfluenceSaving(true)
    setConfluenceError('')
    setConfluenceSuccess('')

    try {
      const validationError = validateConfluenceInputs()
      if (validationError) {
        setConfluenceError(validationError)
        return false
      }

      const authToken = localStorage.getItem('token')
      const response = await fetch('/api/integrations/confluence', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseUrl: confluenceSettings.baseUrl,
          token: confluenceToken.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save Confluence settings')
      }

      setConfluenceToken('')
      setConfluenceSettings((prev) => ({
        ...prev,
        hasToken: prev.hasToken || Boolean(confluenceToken),
      }))
      setConfluenceSuccess('Confluence connected.')
      setConfluenceTestOk(null)
      setConfluenceTestResult(null)
      return true
    } catch (err) {
      setConfluenceError(err instanceof Error ? err.message : 'Failed to save Confluence settings')
      return false
    } finally {
      setConfluenceSaving(false)
    }
  }

  const handleConfluenceTest = async () => {
    setConfluenceTesting(true)
    setConfluenceTestResult(null)
    setConfluenceTestOk(null)
    setConfluenceError('')

    try {
      const authToken = localStorage.getItem('token')
      const response = await fetch('/api/integrations/confluence/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to test Confluence connection')
      }

      setConfluenceTestResult(
        `Connected as ${data.displayName || data.email || 'Confluence user'}`
      )
      setConfluenceTestOk(true)
    } catch (err) {
      setConfluenceTestResult(null)
      setConfluenceTestOk(false)
      setConfluenceError(
        err instanceof Error ? err.message : 'Failed to test Confluence connection'
      )
    } finally {
      setConfluenceTesting(false)
    }
  }

  const handleConfluenceConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    const saved = await saveConfluenceSettings()
    if (saved) {
      await handleConfluenceTest()
    }
  }

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

  const integrations = [
    {
      name: 'Jira Integration',
      status: jiraTestOk === true
        ? 'ok'
        : jiraSettings.hasToken && jiraSettings.baseUrl
        ? 'configured'
        : 'warning',
      icon: Plug,
    },
    {
      name: 'Confluence Integration',
      status: confluenceTestOk === true
        ? 'ok'
        : confluenceSettings.hasToken && confluenceSettings.baseUrl
        ? 'configured'
        : 'warning',
      icon: BookOpen,
    },
    { name: 'GitHub Integration', status: 'warning', icon: GitBranch },
    { name: 'Database Connection', status: 'ok', icon: Database },
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
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

          <div className="animate-slideInUp" style={{ animationDelay: '300ms' }}>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">System Status</h2>
              <p className="text-slate-400 text-sm">Service health overview</p>
            </div>

            <Card className="glass-card border-slate-700/30">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {integrations.map((integration, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between pb-4 border-b border-slate-700/30 last:pb-0 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <integration.icon className="w-5 h-5 text-slate-300" />
                        <div>
                          <p className="text-sm font-medium text-slate-200">{integration.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            integration.status === 'ok'
                              ? 'bg-green-400'
                              : integration.status === 'configured'
                              ? 'bg-blue-400'
                              : 'bg-yellow-400 animate-pulse'
                          }`}
                        ></div>
                        <span
                          className={`text-xs font-medium ${
                            integration.status === 'ok'
                              ? 'text-green-400'
                              : integration.status === 'configured'
                              ? 'text-blue-400'
                              : 'text-yellow-400'
                          }`}
                        >
                          {integration.status === 'ok'
                            ? 'Connected'
                            : integration.status === 'configured'
                            ? 'Configured'
                            : 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-700/30">
                  <div className="flex items-center gap-2 text-slate-300 text-sm mb-4">
                    <Plug className="w-4 h-4 text-blue-400" />
                    Configure Jira (per user)
                  </div>
                  {jiraLoading ? (
                    <div className="text-slate-400 text-sm">Loading Jira settings...</div>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full text-slate-300 hover:text-white hover:bg-slate-800/50 border-slate-700"
                        onClick={() => setShowJiraConfig((prev) => !prev)}
                      >
                        {showJiraConfig ? 'Hide Jira Settings' : 'Open Jira Settings'}
                      </Button>
                      {showJiraConfig && (
                        <form onSubmit={handleJiraConnect} className="space-y-3 mt-4">
                          <Input
                            placeholder="Jira Base URL"
                            value={jiraSettings.baseUrl}
                            onChange={(e) =>
                              setJiraSettings({ ...jiraSettings, baseUrl: e.target.value })
                            }
                            className="bg-slate-800/50 border-slate-700"
                          />
                          <Input
                            placeholder="Board URL (preferred)"
                            value={jiraBoardUrl}
                            onChange={(e) => setJiraBoardUrl(e.target.value)}
                            className="bg-slate-800/50 border-slate-700"
                          />
                          <Input
                            placeholder="Board IDs (optional if URL provided)"
                            value={jiraSettings.boardIds}
                            onChange={(e) =>
                              setJiraSettings({ ...jiraSettings, boardIds: e.target.value })
                            }
                            disabled={Boolean(jiraBoardUrl.trim())}
                            className="bg-slate-800/50 border-slate-700 disabled:opacity-50"
                          />
                          <Input
                            placeholder="Sprint Field ID (customfield_XXXXX)"
                            value={jiraSettings.sprintFieldId}
                            onChange={(e) =>
                              setJiraSettings({ ...jiraSettings, sprintFieldId: e.target.value })
                            }
                            className="bg-slate-800/50 border-slate-700"
                          />
                          <Input
                            type="password"
                            placeholder={
                              jiraSettings.hasToken ? 'Token stored (optional)' : 'Jira PAT token'
                            }
                            value={jiraToken}
                            onChange={(e) => setJiraToken(e.target.value)}
                            className="bg-slate-800/50 border-slate-700"
                          />
                          <div className="text-xs text-slate-400">
                            Auth: Jira Data Center PAT (Bearer)
                          </div>

                          {jiraError && (
                            <div className="flex items-center gap-2 text-xs text-red-300">
                              <AlertCircle className="w-4 h-4" />
                              <span>{jiraError}</span>
                            </div>
                          )}
                          {jiraSuccess && (
                            <div className="flex items-center gap-2 text-xs text-green-300">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{jiraSuccess}</span>
                            </div>
                          )}
                          {jiraTestResult && (
                            <div className="flex items-center gap-2 text-xs text-blue-300">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{jiraTestResult}</span>
                            </div>
                          )}

                          <Button
                            type="submit"
                            disabled={jiraSaving || jiraTesting}
                            className="w-full btn-glow bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600"
                          >
                            {jiraSaving || jiraTesting ? 'Connecting...' : 'Connect'}
                          </Button>
                        </form>
                      )}
                    </>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-700/30">
                  <div className="flex items-center gap-2 text-slate-300 text-sm mb-4">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    Configure Confluence (per user)
                  </div>
                  {confluenceLoading ? (
                    <div className="text-slate-400 text-sm">Loading Confluence settings...</div>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full text-slate-300 hover:text-white hover:bg-slate-800/50 border-slate-700"
                        onClick={() => setShowConfluenceConfig((prev) => !prev)}
                      >
                        {showConfluenceConfig ? 'Hide Confluence Settings' : 'Open Confluence Settings'}
                      </Button>
                      {showConfluenceConfig && (
                        <form onSubmit={handleConfluenceConnect} className="space-y-3 mt-4">
                          <Input
                            placeholder="Confluence Base URL"
                            value={confluenceSettings.baseUrl}
                            onChange={(e) =>
                              setConfluenceSettings({ ...confluenceSettings, baseUrl: e.target.value })
                            }
                            className="bg-slate-800/50 border-slate-700"
                          />
                          <Input
                            type="password"
                            placeholder={
                              confluenceSettings.hasToken ? 'Token stored (optional)' : 'Confluence PAT token'
                            }
                            value={confluenceToken}
                            onChange={(e) => setConfluenceToken(e.target.value)}
                            className="bg-slate-800/50 border-slate-700"
                          />
                          <div className="text-xs text-slate-400">
                            Auth: Confluence Data Center PAT (Bearer)
                          </div>

                          {confluenceError && (
                            <div className="flex items-center gap-2 text-xs text-red-300">
                              <AlertCircle className="w-4 h-4" />
                              <span>{confluenceError}</span>
                            </div>
                          )}
                          {confluenceSuccess && (
                            <div className="flex items-center gap-2 text-xs text-green-300">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{confluenceSuccess}</span>
                            </div>
                          )}
                          {confluenceTestResult && (
                            <div className="flex items-center gap-2 text-xs text-blue-300">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{confluenceTestResult}</span>
                            </div>
                          )}

                          <Button
                            type="submit"
                            disabled={confluenceSaving || confluenceTesting}
                            className="w-full btn-glow bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600"
                          >
                            {confluenceSaving || confluenceTesting ? 'Connecting...' : 'Connect'}
                          </Button>
                        </form>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
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
