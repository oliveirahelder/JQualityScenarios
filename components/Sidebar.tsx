'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type NavLink = { href: string; label: string }

const navLinks: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/sprints', label: 'Sprints' },
  { href: '/scenarios', label: 'Scenarios' },
  { href: '/documentation', label: 'Docs' },
  { href: '/delivery-timings', label: 'Delivery individual timings' },
]

const adminLinks: NavLink[] = [{ href: '/reports', label: 'Reports' }]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState({
    jira: 'disconnected',
    confluence: 'disconnected',
    github: 'disconnected',
    database: 'connected',
  })

  const isActive = (href: string) => pathname === href
  const roleLabel = getRoleLabel(role)
  const hasConnectionError = Object.values(connectionStatus).some(
    (status) => status !== 'connected'
  )

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (!storedUser) {
      setRole(null)
      return
    }
    try {
      const parsed = JSON.parse(storedUser)
      setRole(parsed?.role || null)
      setUserName(parsed?.name || null)
    } catch {
      setRole(null)
      setUserName(null)
    }
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

  return (
    <aside
      className={`sticky top-0 h-screen bg-slate-900/90 border-r border-slate-800/80 backdrop-blur-md flex flex-col transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800/70">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-slate-900/90 to-slate-800/80 border border-slate-700/80">
            <Image src="/logo.svg" alt="JQuality logo" width={collapsed ? 36 : 44} height={collapsed ? 36 : 44} />
          </div>
          {!collapsed ? (
            <div className="flex flex-col">
              <span className="text-white font-bold">JQuality</span>
              <span className="text-xs text-slate-400">Test Intelligence</span>
            </div>
          ) : null}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((prev) => !prev)}
          className="text-slate-400 hover:text-white hover:bg-slate-800/60"
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <div
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive(link.href)
                  ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <span className="text-xs font-semibold uppercase">{link.label[0]}</span>
              {!collapsed ? <span>{link.label}</span> : null}
            </div>
          </Link>
        ))}
        {role === 'ADMIN'
          ? adminLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <div
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive(link.href)
                      ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span className="text-xs font-semibold uppercase">{link.label[0]}</span>
                  {!collapsed ? <span>{link.label}</span> : null}
                </div>
              </Link>
            ))
          : null}
      </nav>

      <div className="px-3 pb-4 space-y-3">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs border border-slate-800 bg-slate-900/60 hover:bg-slate-800/70 transition-colors"
          title="Connection status"
        >
          {hasConnectionError ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          )}
          {!collapsed ? (
            <span className={`font-semibold ${hasConnectionError ? 'text-amber-300' : 'text-green-300'}`}>
              System Status
            </span>
          ) : null}
        </Link>
        {!collapsed && roleLabel ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
            <div className="font-semibold text-slate-200">
              {roleLabel}{userName ? ` - ${userName}` : ''}
            </div>
          </div>
        ) : null}
        {role && ['ADMIN', 'DEVOPS'].includes(role) ? (
          <Link href="/settings">
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/60"
            >
              <Settings className="w-4 h-4 mr-2" />
              {!collapsed ? 'Settings' : null}
            </Button>
          </Link>
        ) : null}
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-300 hover:text-red-400 hover:bg-red-500/10"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {!collapsed ? 'Log out' : null}
        </Button>
      </div>
    </aside>
  )
}

function getRoleLabel(role: string | null) {
  switch (role) {
    case 'ADMIN':
      return 'Admin'
    case 'QA':
      return 'Tester'
    case 'DEVELOPER':
      return 'Developer'
    case 'DEVOPS':
      return "PO's"
    default:
      return role || ''
  }
}
