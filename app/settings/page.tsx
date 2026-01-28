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

interface GithubSettings {
  user: string
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

  const [githubLoading, setGithubLoading] = useState(true)
  const [githubSaving, setGithubSaving] = useState(false)
  const [githubTesting, setGithubTesting] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [githubError, setGithubError] = useState('')
  const [githubSuccess, setGithubSuccess] = useState('')
  const [githubTestResult, setGithubTestResult] = useState<string | null>(null)
  const [githubTestOk, setGithubTestOk] = useState<boolean | null>(null)
  const [showGithubConfig, setShowGithubConfig] = useState(false)
  const [githubSettings, setGithubSettings] = useState<GithubSettings>({
    user: '',
    hasToken: false,
  })

  const [dbStatus, setDbStatus] = useState<'ok' | 'error' | 'checking'>('checking')
  const [adminJiraBaseUrl, setAdminJiraBaseUrl] = useState('')
  const [adminConfluenceBaseUrl, setAdminConfluenceBaseUrl] = useState('')
  const [adminConfluenceSpaceKey, setAdminConfluenceSpaceKey] = useState('')
  const [adminConfluenceParentPageId, setAdminConfluenceParentPageId] = useState('')
  const [adminConfluenceSearchCql, setAdminConfluenceSearchCql] = useState('')
  const [adminConfluenceSearchLimit, setAdminConfluenceSearchLimit] = useState('10')
  const [adminConfluenceAccessClientId, setAdminConfluenceAccessClientId] = useState('')
  const [adminConfluenceAccessClientSecret, setAdminConfluenceAccessClientSecret] = useState('')
  const [adminConfluenceAccessClientIdSet, setAdminConfluenceAccessClientIdSet] = useState(false)
  const [adminConfluenceAccessClientSecretSet, setAdminConfluenceAccessClientSecretSet] = useState(false)
  const [adminSprintsToSync, setAdminSprintsToSync] = useState('10')
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [adminSuccess, setAdminSuccess] = useState('')
  const [jiraSyncing, setJiraSyncing] = useState(false)
  const [jiraSyncMessage, setJiraSyncMessage] = useState('')
  const [jiraSyncError, setJiraSyncError] = useState('')
  const [jiraLastSyncAt, setJiraLastSyncAt] = useState<string | null>(null)
  const jiraBaseUrlValue = jiraSettings.baseUrl || adminJiraBaseUrl
  const confluenceBaseUrlValue = confluenceSettings.baseUrl || adminConfluenceBaseUrl

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
    const stored = localStorage.getItem('jiraLastSyncAt')
    if (stored) setJiraLastSyncAt(stored)
  }, [])

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const authToken = localStorage.getItem('token')
        const [jiraResponse, confluenceResponse, githubResponse, dbResponse, adminResponse] =
          await Promise.all([
            fetch('/api/integrations/jira', {
              headers: { Authorization: `Bearer ${authToken}` },
            }),
            fetch('/api/integrations/confluence', {
              headers: { Authorization: `Bearer ${authToken}` },
            }),
            fetch('/api/integrations/github', {
              headers: { Authorization: `Bearer ${authToken}` },
            }),
            fetch('/api/system/database-status', {
              headers: { Authorization: `Bearer ${authToken}` },
            }),
            fetch('/api/admin/settings', {
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

        if (!githubResponse.ok) {
          const data = await githubResponse.json()
          throw new Error(data.error || 'Failed to load GitHub settings')
        }

        if (!adminResponse.ok) {
          const data = await adminResponse.json()
          throw new Error(data.error || 'Failed to load admin settings')
        }
        const adminData = await adminResponse.json()
        const nextAdminJiraBaseUrl = adminData?.jiraBaseUrl || ''
        const nextAdminConfluenceBaseUrl = adminData?.confluenceBaseUrl || ''
        const nextAdminConfluenceSpaceKey = adminData?.confluenceSpaceKey || ''
        const nextAdminConfluenceParentPageId = adminData?.confluenceParentPageId || ''
        const nextAdminConfluenceSearchCql = adminData?.confluenceSearchCql || ''
        const nextAdminConfluenceSearchLimit =
          typeof adminData?.confluenceSearchLimit === 'number'
            ? adminData.confluenceSearchLimit.toString()
            : '10'
        const nextAccessClientIdSet = Boolean(adminData?.confluenceAccessClientIdSet)
        const nextAccessClientSecretSet = Boolean(adminData?.confluenceAccessClientSecretSet)
        const nextAdminSprintsToSync =
          typeof adminData?.sprintsToSync === 'number'
            ? adminData.sprintsToSync.toString()
            : '10'
        setAdminJiraBaseUrl(nextAdminJiraBaseUrl)
        setAdminConfluenceBaseUrl(nextAdminConfluenceBaseUrl)
        setAdminConfluenceSpaceKey(nextAdminConfluenceSpaceKey)
        setAdminConfluenceParentPageId(nextAdminConfluenceParentPageId)
        setAdminConfluenceSearchCql(nextAdminConfluenceSearchCql)
        setAdminConfluenceSearchLimit(nextAdminConfluenceSearchLimit)
        setAdminConfluenceAccessClientId('')
        setAdminConfluenceAccessClientSecret('')
        setAdminConfluenceAccessClientIdSet(nextAccessClientIdSet)
        setAdminConfluenceAccessClientSecretSet(nextAccessClientSecretSet)
        setAdminSprintsToSync(nextAdminSprintsToSync)
        if (!jiraData?.baseUrl && nextAdminJiraBaseUrl) {
          setJiraSettings((prev) => ({ ...prev, baseUrl: nextAdminJiraBaseUrl }))
        }
        if (!confluenceData?.baseUrl && nextAdminConfluenceBaseUrl) {
          setConfluenceSettings((prev) => ({ ...prev, baseUrl: nextAdminConfluenceBaseUrl }))
        }

        const githubData = await githubResponse.json()
        setGithubSettings(githubData)
        if (githubData?.connectionStatus === 'connected' && githubData?.connectionCheckedAt) {
          const checkedAt = new Date(githubData.connectionCheckedAt)
          const maxAgeMs = 24 * 60 * 60 * 1000
          if (!Number.isNaN(checkedAt.getTime()) && Date.now() - checkedAt.getTime() < maxAgeMs) {
            setGithubTestOk(true)
            setGithubTestResult('Connected (last check within 24h)')
          }
        }

        setDbStatus(dbResponse.ok ? 'ok' : 'error')
      } catch (err) {
        setJiraError(err instanceof Error ? err.message : 'Failed to load Jira settings')
        setDbStatus('error')
      } finally {
        setJiraLoading(false)
        setConfluenceLoading(false)
        setGithubLoading(false)
      }
    }

    loadSettings()
  }, [])

  const validateJiraInputs = () => {
    const trimmedToken = jiraToken.trim()
    const trimmedBoardIds = jiraSettings.boardIds.trim()
    const trimmedBoardUrl = jiraBoardUrl.trim()
    const trimmedUser = jiraSettings.user.trim()

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
          baseUrl: undefined,
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
    const trimmedToken = confluenceToken.trim()

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
          baseUrl: undefined,
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

  const validateGithubInputs = () => {
    const trimmedUser = githubSettings.user.trim()
    const trimmedToken = githubToken.trim()

    if (!trimmedUser) {
      return 'GitHub username is required.'
    }
    if (!trimmedToken && !githubSettings.hasToken) {
      return 'GitHub token is required.'
    }
    return ''
  }

  const saveGithubSettings = async () => {
    setGithubSaving(true)
    setGithubError('')
    setGithubSuccess('')

    try {
      const validationError = validateGithubInputs()
      if (validationError) {
        setGithubError(validationError)
        return false
      }

      const authToken = localStorage.getItem('token')
      const response = await fetch('/api/integrations/github', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: githubSettings.user,
          token: githubToken.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save GitHub settings')
      }

      setGithubToken('')
      setGithubSettings((prev) => ({ ...prev, hasToken: prev.hasToken || Boolean(githubToken) }))
      setGithubSuccess('GitHub connected.')
      setGithubTestOk(null)
      setGithubTestResult(null)
      return true
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Failed to save GitHub settings')
      return false
    } finally {
      setGithubSaving(false)
    }
  }

  const handleGithubTest = async () => {
    setGithubTesting(true)
    setGithubTestResult(null)
    setGithubTestOk(null)
    setGithubError('')

    try {
      const authToken = localStorage.getItem('token')
      const response = await fetch('/api/integrations/github/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to test GitHub connection')
      }

      setGithubTestResult(`Connected as ${data.login || data.name || 'GitHub user'}`)
      setGithubTestOk(true)
    } catch (err) {
      setGithubTestResult(null)
      setGithubTestOk(false)
      setGithubError(err instanceof Error ? err.message : 'Failed to test GitHub connection')
    } finally {
      setGithubTesting(false)
    }
  }

  const handleGithubConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    const saved = await saveGithubSettings()
    if (saved) {
      await handleGithubTest()
    }
  }

  const handleAdminSave = async () => {
    setAdminSaving(true)
    setAdminError('')
    setAdminSuccess('')

    try {
      const parsedSprintsToSync = Number.parseInt(adminSprintsToSync, 10)
      const normalizedSprintsToSync = Number.isFinite(parsedSprintsToSync)
        ? parsedSprintsToSync
        : undefined
      const parsedConfluenceSearchLimit = Number.parseInt(adminConfluenceSearchLimit, 10)
      const normalizedConfluenceSearchLimit = Number.isFinite(parsedConfluenceSearchLimit)
        ? parsedConfluenceSearchLimit
        : undefined
      const normalizedAccessClientId = adminConfluenceAccessClientId.trim()
      const normalizedAccessClientSecret = adminConfluenceAccessClientSecret.trim()
      const authToken = localStorage.getItem('token')
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jiraBaseUrl: adminJiraBaseUrl,
          confluenceBaseUrl: adminConfluenceBaseUrl,
          confluenceSpaceKey: adminConfluenceSpaceKey,
          confluenceParentPageId: adminConfluenceParentPageId,
          confluenceSearchCql: adminConfluenceSearchCql,
          confluenceSearchLimit: normalizedConfluenceSearchLimit,
          confluenceAccessClientId: normalizedAccessClientId || undefined,
          confluenceAccessClientSecret: normalizedAccessClientSecret || undefined,
          sprintsToSync: normalizedSprintsToSync,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save admin settings')
      }

      setJiraSettings((prev) => ({ ...prev, baseUrl: adminJiraBaseUrl }))
      setConfluenceSettings((prev) => ({ ...prev, baseUrl: adminConfluenceBaseUrl }))
      if (normalizedAccessClientId) {
        setAdminConfluenceAccessClientIdSet(true)
        setAdminConfluenceAccessClientId('')
      }
      if (normalizedAccessClientSecret) {
        setAdminConfluenceAccessClientSecretSet(true)
        setAdminConfluenceAccessClientSecret('')
      }
      setAdminSuccess('Admin settings updated.')
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to save admin settings')
    } finally {
      setAdminSaving(false)
    }
  }

  const handleJiraSync = async () => {
    setJiraSyncing(true)
    setJiraSyncMessage('')
    setJiraSyncError('')
    try {
      const authToken = localStorage.getItem('token')
      const response = await fetch('/api/admin/sprints/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'all' }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync Jira')
      }
      const now = new Date().toISOString()
      setJiraLastSyncAt(now)
      localStorage.setItem('jiraLastSyncAt', now)
      setJiraSyncMessage('Jira sync complete.')
    } catch (err) {
      setJiraSyncError(err instanceof Error ? err.message : 'Failed to sync Jira')
    } finally {
      setJiraSyncing(false)
    }
  }


  const integrations = [
    {
      name: 'Jira Integration',
      status: jiraTestOk === true
        ? 'ok'
        : jiraSettings.hasToken
        ? 'configured'
        : 'warning',
      icon: Plug,
    },
    {
      name: 'Confluence Integration',
      status: confluenceTestOk === true
        ? 'ok'
        : confluenceSettings.hasToken
        ? 'configured'
        : 'warning',
      icon: BookOpen,
    },
    {
      name: 'GitHub Integration',
      status: githubTestOk === true
        ? 'ok'
        : githubSettings.hasToken
        ? 'configured'
        : 'warning',
      icon: GitBranch,
    },
    {
      name: 'Database Connection',
      status: dbStatus === 'ok' ? 'ok' : 'warning',
      icon: Database,
    },
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
                        {integration.name === 'Database Connection' ? (
                          <p className="text-xs text-slate-500">database.db</p>
                        ) : null}
                        {integration.name === 'Jira Integration' ? (
                          <p className="text-xs text-slate-500">
                            Last sync:{' '}
                            {jiraLastSyncAt
                              ? new Date(jiraLastSyncAt).toLocaleString()
                              : 'Not synced yet'}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isAdmin && integration.name === 'Jira Integration' ? (
                        <Button
                          variant="outline"
                          className="border-slate-700 text-slate-300"
                          onClick={handleJiraSync}
                          disabled={jiraSyncing}
                        >
                          {jiraSyncing ? 'Syncing Jira...' : 'Sync Jira'}
                        </Button>
                      ) : null}
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
                  </div>
                ))}
              </div>
              {jiraSyncMessage ? (
                <div className="mt-4 text-xs text-green-300">{jiraSyncMessage}</div>
              ) : null}
              {jiraSyncError ? (
                <div className="mt-4 text-xs text-red-300">{jiraSyncError}</div>
              ) : null}

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
                        {!isAdmin ? (
                          <Input
                            placeholder="Jira Base URL (managed by admin)"
                            value={jiraBaseUrlValue}
                            disabled
                            className="bg-slate-800/50 border-slate-700 disabled:opacity-60"
                          />
                        ) : (
                          <div className="text-xs text-slate-400">
                            Jira Base URL is managed in Admin Settings.
                          </div>
                        )}
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
                        {!isAdmin ? (
                          <Input
                            placeholder="Confluence Base URL (managed by admin)"
                            value={confluenceBaseUrlValue}
                            disabled
                            className="bg-slate-800/50 border-slate-700 disabled:opacity-60"
                          />
                        ) : (
                          <div className="text-xs text-slate-400">
                            Confluence Base URL is managed in Admin Settings.
                          </div>
                        )}
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

              <div className="mt-6 pt-6 border-t border-slate-700/30">
                <div className="flex items-center gap-2 text-slate-300 text-sm mb-4">
                  <GitBranch className="w-4 h-4 text-blue-400" />
                  Configure GitHub (per user)
                </div>
                {githubLoading ? (
                  <div className="text-slate-400 text-sm">Loading GitHub settings...</div>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-slate-300 hover:text-white hover:bg-slate-800/50 border-slate-700"
                      onClick={() => setShowGithubConfig((prev) => !prev)}
                    >
                      {showGithubConfig ? 'Hide GitHub Settings' : 'Open GitHub Settings'}
                    </Button>
                    {showGithubConfig && (
                      <form onSubmit={handleGithubConnect} className="space-y-3 mt-4">
                        <Input
                          placeholder="GitHub username"
                          value={githubSettings.user}
                          onChange={(e) =>
                            setGithubSettings({ ...githubSettings, user: e.target.value })
                          }
                          className="bg-slate-800/50 border-slate-700"
                        />
                        <Input
                          type="password"
                          placeholder={
                            githubSettings.hasToken ? 'Token stored (optional)' : 'GitHub token'
                          }
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          className="bg-slate-800/50 border-slate-700"
                        />
                        <div className="text-xs text-slate-400">
                          Auth: GitHub personal access token
                        </div>

                        {githubError && (
                          <div className="flex items-center gap-2 text-xs text-red-300">
                            <AlertCircle className="w-4 h-4" />
                            <span>{githubError}</span>
                          </div>
                        )}
                        {githubSuccess && (
                          <div className="flex items-center gap-2 text-xs text-green-300">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{githubSuccess}</span>
                          </div>
                        )}
                        {githubTestResult && (
                          <div className="flex items-center gap-2 text-xs text-blue-300">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{githubTestResult}</span>
                          </div>
                        )}

                        <Button
                          type="submit"
                          disabled={githubSaving || githubTesting}
                          className="w-full btn-glow bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600"
                        >
                          {githubSaving || githubTesting ? 'Connecting...' : 'Connect'}
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
                Global configuration reserved for admins.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-slate-300">
              <div className="space-y-3">
                <Input
                  placeholder="Jira Base URL"
                  value={adminJiraBaseUrl}
                  onChange={(e) => setAdminJiraBaseUrl(e.target.value)}
                  className="bg-slate-800/50 border-slate-700"
                />
                <Input
                  placeholder="Confluence Base URL (e.g. https://confluence.jumia.com)"
                  value={adminConfluenceBaseUrl}
                  onChange={(e) => setAdminConfluenceBaseUrl(e.target.value)}
                  className="bg-slate-800/50 border-slate-700"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    placeholder="Confluence Space Key (e.g. NAFAMZ)"
                    value={adminConfluenceSpaceKey}
                    onChange={(e) => setAdminConfluenceSpaceKey(e.target.value)}
                    className="bg-slate-800/50 border-slate-700"
                  />
                  <Input
                    placeholder="Confluence Parent Page ID or URL"
                    value={adminConfluenceParentPageId}
                    onChange={(e) => setAdminConfluenceParentPageId(e.target.value)}
                    className="bg-slate-800/50 border-slate-700"
                  />
                </div>
                <Input
                  placeholder="Confluence Search CQL (optional)"
                  value={adminConfluenceSearchCql}
                  onChange={(e) => setAdminConfluenceSearchCql(e.target.value)}
                  className="bg-slate-800/50 border-slate-700"
                />
                <div>
                  <div className="text-xs text-slate-400 mb-2">Confluence Search Limit</div>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    placeholder="10"
                    value={adminConfluenceSearchLimit}
                    onChange={(e) => setAdminConfluenceSearchLimit(e.target.value)}
                    className="bg-slate-800/50 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">Cloudflare Access Headers (optional)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      placeholder={
                        adminConfluenceAccessClientIdSet
                          ? 'Client ID stored (leave blank to keep)'
                          : 'CF Access Client ID'
                      }
                      value={adminConfluenceAccessClientId}
                      onChange={(e) => setAdminConfluenceAccessClientId(e.target.value)}
                      className="bg-slate-800/50 border-slate-700"
                    />
                    <Input
                      placeholder={
                        adminConfluenceAccessClientSecretSet
                          ? 'Client Secret stored (leave blank to keep)'
                          : 'CF Access Client Secret'
                      }
                      value={adminConfluenceAccessClientSecret}
                      onChange={(e) => setAdminConfluenceAccessClientSecret(e.target.value)}
                      className="bg-slate-800/50 border-slate-700"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Use these if Confluence is protected by Cloudflare Access.
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  These values scope Confluence search and define the default documentation tree.
                  You can paste a full page URL for the parent page ID. Optional CQL lets you
                  pre-filter content types for faster searches.
                </p>
                <div>
                  <div className="text-xs text-slate-400 mb-2">
                    Nr Sprints to Sync (metrics will be based on this)
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    placeholder="10"
                    value={adminSprintsToSync}
                    onChange={(e) => setAdminSprintsToSync(e.target.value)}
                    className="bg-slate-800/50 border-slate-700"
                  />
                </div>
              </div>

              {adminError && (
                <div className="flex items-center gap-2 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4" />
                  <span>{adminError}</span>
                </div>
              )}
              {adminSuccess && (
                <div className="flex items-center gap-2 text-xs text-green-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{adminSuccess}</span>
                </div>
              )}

              <Button
                variant="outline"
                className="border-slate-700 text-slate-300"
                onClick={handleAdminSave}
                disabled={adminSaving}
              >
                {adminSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  )
}
