'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Zap, Menu, X, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [role, setRole] = useState<string | null>(null)

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
    } catch {
      setRole(null)
    }
  }, [])

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/sprints', label: 'Sprints', icon: '🏃' },
    { href: '/scenarios', label: 'Scenarios', icon: '🎯' },
    { href: '/documentation', label: 'Docs', icon: '📚' },
    { href: '/search', label: 'Search', icon: '🔍' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 animate-slideInDown">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg group-hover:shadow-glow-blue transition-all duration-300">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-lg font-bold text-white">QABOT</span>
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
                    <span className="mr-1.5">{link.icon}</span>
                    {link.label}
                  </Button>
                </Link>
              ))}
            </div>

            {/* User Actions */}
            <div className="flex items-center gap-2">
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
                    <span className="mr-2">{link.icon}</span>
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
                    <span className="mr-2">⚙️</span>
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
