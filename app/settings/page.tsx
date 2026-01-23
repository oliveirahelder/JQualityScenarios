'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

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

  if (loading) {
    return (
      <main className="min-h-screen pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Card className="glass-card border-slate-700/30">
            <CardContent className="py-10 text-center text-slate-400">
              Loading settings...
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Card className="glass-card border-slate-700/30">
            <CardContent className="py-10 text-center text-slate-300">
              <div className="flex items-center justify-center gap-2 text-red-300">
                <AlertCircle className="w-5 h-5" />
                <span>Access denied. Admin only.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
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
      </div>
    </main>
  )
}
