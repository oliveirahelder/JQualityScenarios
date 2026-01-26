'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, BarChart3 } from 'lucide-react'

type SprintSnapshot = {
  id: string
  sprintId: string
  jiraId: string
  name: string
  startDate: string
  endDate: string
  status: string
  totals: {
    totalTickets?: number
    closedTickets?: number
    storyPointsTotal?: number
    storyPointsClosed?: number
    successPercent?: number
    bounceBackTickets?: number
  }
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [snapshots, setSnapshots] = useState<SprintSnapshot[]>([])
  const [error, setError] = useState('')

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
    const loadReports = async () => {
      if (!isAdmin) return
      try {
        const token = localStorage.getItem('token')
        const response = await fetch('/api/reports/sprints', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load reports')
        }
        setSnapshots(data.snapshots || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports')
      } finally {
        setLoading(false)
      }
    }

    loadReports()
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <main className="min-h-screen pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Card className="glass-card border-slate-700/30">
            <CardContent className="py-10 text-center text-slate-400">
              Admin access required.
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Sprint Reports</h1>
          <p className="text-slate-400 text-sm">Historical metrics for closed sprints.</p>
        </div>

        {loading ? (
          <Card className="glass-card border-slate-700/30">
            <CardContent className="py-10 text-center text-slate-400">
              Loading reports...
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="glass-card border-red-500/40">
            <CardContent className="py-10 text-center text-red-300 flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </CardContent>
          </Card>
        ) : snapshots.length === 0 ? (
          <Card className="glass-card border-slate-700/30">
            <CardContent className="py-10 text-center text-slate-400">
              No closed sprint snapshots yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {snapshots.map((snapshot) => (
              <Card key={snapshot.id} className="glass-card border-slate-700/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white text-xl">{snapshot.name}</CardTitle>
                      <CardDescription className="text-slate-400 text-xs">
                        {new Date(snapshot.startDate).toLocaleDateString()} -{' '}
                        {new Date(snapshot.endDate).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <BarChart3 className="w-5 h-5 text-slate-400" />
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500 text-xs">Tickets</div>
                    <div className="text-white font-semibold">
                      {snapshot.totals.totalTickets ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">Finished</div>
                    <div className="text-white font-semibold">
                      {snapshot.totals.workedTickets ?? snapshot.totals.closedTickets ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">Success</div>
                    <div className="text-blue-300 font-semibold">
                      {(() => {
                        const total = snapshot.totals.totalTickets ?? 0
                        const finished = snapshot.totals.workedTickets ?? snapshot.totals.closedTickets ?? 0
                        return total ? `${Math.round((finished / total) * 1000) / 10}%` : '0%'
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">SP Total</div>
                    <div className="text-white font-semibold">
                      {snapshot.totals.storyPointsTotal ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">SP Closed</div>
                    <div className="text-white font-semibold">
                      {snapshot.totals.storyPointsClosed ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">Bounce</div>
                    <div className="text-white font-semibold">
                      {snapshot.totals.bounceBackTickets ?? 0}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
