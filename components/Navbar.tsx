'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Menu, X, LogOut, Settings, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState({
    jira: 'disconnected',
    confluence: 'disconnected',
    github: 'disconnected',
    database: 'connected',
  })

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

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: 'D' },
    { href: '/sprints', label: 'Sprints', icon: 'S' },
    { href: '/scenarios', label: 'Scenarios', icon: 'C' },
    { href: '/documentation', label: 'Docs', icon: 'Docs' },
    { href: '/search', label: 'Search', icon: 'Q' },
  ]
  const adminLinks = [
    { href: '/reports', label: 'Reports', icon: 'R' },
  ]


  const isActive = (href: string) => pathname === href
  const roleLabel = getRoleLabel(role)
  const hasConnectionError = Object.values(connectionStatus).some(
    (status) => status !== 'connected'
  )

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 animate-slideInDown">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="p-3 bg-gradient-to-br from-slate-900/90 to-slate-800/80 rounded-2xl group-hover:shadow-glow-blue transition-all duration-300 border border-slate-700/80">
                <Image src="/logo.svg" alt="JQuality logo" width={56} height={56} />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-lg font-bold text-white">JQuality</span>
                <span className="text-xs text-slate-400">Test Intelligence</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button 
                    variant="ghost" 
                    className={`transition-all duration-200 ${
                      isActive(link.href)
                        ? 'text-blue-400 bg-blue-500/10 border-l-2 border-blue-500'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    {link.icon ? <span className="mr-1.5">{link.icon}</span> : null}
                    {link.label}
                  </Button>
                </Link>
              ))}
              {role === 'ADMIN' && adminLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button 
                    variant="ghost" 
                    className={`transition-all duration-200 ${
                      isActive(link.href)
                        ? 'text-blue-400 bg-blue-500/10 border-l-2 border-blue-500'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    {link.icon ? <span className="mr-1.5">{link.icon}</span> : null}
                    {link.label}
                  </Button>
                </Link>
              ))}
            </div>

            {/* User Actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/settings"
                className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md border border-slate-800 bg-slate-900/50 hover:bg-slate-800/60 transition-colors"
                title="Connection status"
              >
                {hasConnectionError ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                )}
                <span className={`text-xs font-semibold ${hasConnectionError ? 'text-amber-300' : 'text-green-300'}`}>
                  System Status
                </span>
              </Link>
              {roleLabel && (
                <div className="hidden sm:flex flex-col items-end text-xs text-slate-300 mr-2">
                  <span className="font-semibold text-slate-200">
                    {roleLabel}{userName ? ` - ${userName}` : ''}
                  </span>
                </div>
              )}
              {role && ['ADMIN', 'DEVOPS'].includes(role) && (
                <Link href="/settings" className="hidden sm:flex">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-slate-300 hover:text-white hover:bg-slate-800/50"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                </Link>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-slate-300 hover:text-red-400 hover:bg-red-500/10" 
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5" />
              </Button>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isOpen && (
            <div className="md:hidden pb-4 space-y-2 animate-slideInUp border-t border-slate-700/50 pt-4">
              {navLinks.map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href} 
                  onClick={() => setIsOpen(false)}
                >
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start transition-all duration-200 ${
                      isActive(link.href)
                        ? 'text-blue-400 bg-blue-500/10'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    {link.icon ? <span className="mr-2">{link.icon}</span> : null}
                    {link.label}
                  </Button>
                </Link>
              ))}
              {role === 'ADMIN' && adminLinks.map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href} 
                  onClick={() => setIsOpen(false)}
                >
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start transition-all duration-200 ${
                      isActive(link.href)
                        ? 'text-blue-400 bg-blue-500/10'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    {link.icon ? <span className="mr-2">{link.icon}</span> : null}
                    {link.label}
                  </Button>
                </Link>
              ))}
              {role && ['ADMIN', 'DEVOPS'].includes(role) && (
                <Link href="/settings" onClick={() => setIsOpen(false)}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start transition-all duration-200 text-slate-300 hover:text-white hover:bg-slate-800/50"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </nav>
      
      {/* Spacer */}
      <div className="h-16" />
    </>
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

