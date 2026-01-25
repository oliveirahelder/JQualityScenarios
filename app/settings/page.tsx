'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, CheckCircle2, Plug, BookOpen, GitBranch, Database } from 'lucide-react'

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

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

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
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setIsAdmin(['ADMIN', 'DEVOPS'].includes(parsed?.role))
      } catch {
        setIsAdmin(false)
      }
    }
    setLoading(false)
  }, [])

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

  const validateJiraInputs = () => {
    const trimmedBaseUrl = jiraSettings.baseUrl.trim()
    const trimmedToken = jiraToken.trim()
    const trimmedBoardIds = jiraSettings.boardIds.trim()
    const trimmedBoardUrl = jiraBoardUrl.trim()
    const trimmedUser = jiraSettings.user.trim()

    if (isAdmin && !trimmedBaseUrl) {
      return 'Jira Base URL is required (admin only).'
    }
    if (!trimmedUser) {
      return 'Jira email is required.'
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
          baseUrl: isAdmin ? jiraSettings.baseUrl : undefined,
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

    if (isAdmin && !trimmedBaseUrl) {
      return 'Confluence Base URL is required (admin only).'
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
          baseUrl: isAdmin ? confluenceSettings.baseUrl : undefined,
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

  if (loading) {
    return (
      <main className="min-h-screen pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Card className="glass-card border-slate-700/30">
            <CardContent className="py-10 text-center text-slate-400">
              Loading settings...
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 text-sm">
            Manage integrations and system configuration.
          </p>
        </div>

        <div className="mb-10">
          <div className="mb-4">
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
                          placeholder="Jira Base URL (admin only)"
                          value={jiraSettings.baseUrl}
                          onChange={(e) =>
                            setJiraSettings({ ...jiraSettings, baseUrl: e.target.value })
                          }
                          disabled={!isAdmin}
                          className="bg-slate-800/50 border-slate-700 disabled:opacity-60"
                        />
                        {!isAdmin ? (
                          <div className="text-xs text-slate-400">
                            Jira Base URL is shared for all users.
                          </div>
                        ) : null}
                        <Input
                          placeholder="Jira email"
                          value={jiraSettings.user}
                          onChange={(e) =>
                            setJiraSettings({ ...jiraSettings, user: e.target.value })
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
                          placeholder="Confluence Base URL (admin only)"
                          value={confluenceSettings.baseUrl}
                          onChange={(e) =>
                            setConfluenceSettings({ ...confluenceSettings, baseUrl: e.target.value })
                          }
                          disabled={!isAdmin}
                          className="bg-slate-800/50 border-slate-700 disabled:opacity-60"
                        />
                        {!isAdmin ? (
                          <div className="text-xs text-slate-400">
                            Confluence Base URL is shared for all users.
                          </div>
                        ) : null}
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

        {isAdmin ? (
          <Card className="glass-card border-slate-700/30">
            <CardHeader>
              <CardTitle className="text-2xl text-white">Admin Settings</CardTitle>
              <CardDescription className="text-slate-400">
                Backend configuration reserved for admins.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-slate-300">
              <p>Use this area for global configuration (coming soon).</p>
              <Button variant="outline" className="border-slate-700 text-slate-300">
                Save Settings
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  )
}
