'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Zap } from 'lucide-react'

type DeliveryEntry = {
  name: string
  ticketCount: number
  averageHours: number
  totalHours: number
  avgStoryPointsAllocated?: number
  avgStoryPointsClosed?: number
  storyPointSprintCount?: number
  carryoverRate?: number
}

type SprintDelivery = {
  sprintId: string
  sprintName: string
  entries: DeliveryEntry[]
}

export default function DeliveryTimingsPage() {
  const [loading, setLoading] = useState(true)
  const [activeSprints, setActiveSprints] = useState<Array<{ id: string; name: string }>>([])
  const [deliveryTimes, setDeliveryTimes] = useState<DeliveryEntry[]>([])
  const [deliveryTimesBySprint, setDeliveryTimesBySprint] = useState<SprintDelivery[]>([])
  const [selectedSprintId, setSelectedSprintId] = useState('all')

  useEffect(() => {
    const loadDeliveryTimes = async () => {
      try {
        const authToken = localStorage.getItem('token')
        const response = await fetch('/api/metrics/jira?includeDeliveryTimes=1', {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (!response.ok) return
        const data = await response.json()
        setActiveSprints(data.activeSprints || [])
        setDeliveryTimes(data.deliveryTimes || [])
        setDeliveryTimesBySprint(data.deliveryTimesBySprint || [])
      } catch {
        // Keep defaults on error
      } finally {
        setLoading(false)
      }
    }

    loadDeliveryTimes()
  }, [])

  const selectedEntries =
    selectedSprintId === 'all'
      ? deliveryTimes
      : deliveryTimesBySprint.find((sprint) => sprint.sprintId === selectedSprintId)?.entries || []

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Delivery individual timings</h1>
          <p className="text-slate-400 text-sm">
            Time from In Progress to final phase, using 8h business days.
          </p>
        </div>

        <Card className="glass-card rounded-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-sky-600 to-sky-500"></div>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-slate-300 text-sm font-semibold mb-1">Delivery Time</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">
                  {loading ? '--' : selectedEntries.length}
                </h3>
              </div>
              <Zap className="w-7 h-7 text-slate-400 opacity-60" />
            </div>

            <div className="flex items-center justify-between gap-3 text-xs mb-4">
              <span className="text-slate-400">Sprint</span>
              <select
                className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200"
                value={selectedSprintId}
                onChange={(event) => setSelectedSprintId(event.target.value)}
              >
                <option value="all">All active sprints</option>
                {activeSprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2 text-[10px] uppercase text-slate-500 text-center">
              <div className="grid grid-cols-5 gap-2">
                <span>Assignee</span>
                <span>Tickets</span>
                <span>Avg Hours</span>
                <span>Avg SP (last 5)</span>
                <span>Carryover</span>
              </div>
            </div>
            <div className="mt-2 space-y-2 text-xs text-slate-300">
              {selectedEntries.map((entry) => (
                <div
                  key={entry.name}
                  className="grid grid-cols-5 gap-2 rounded-lg bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-100 text-center"
                >
                  <span className="truncate">{entry.name}</span>
                  <span>{entry.ticketCount}</span>
                  <span>{entry.averageHours}h</span>
                  <span>{entry.avgStoryPointsAllocated ?? 0} / {entry.avgStoryPointsClosed ?? 0}</span>
                  <span>{entry.carryoverRate != null ? `${entry.carryoverRate}%` : '--'}</span>
                </div>
              ))}
              {!loading && selectedEntries.length === 0 ? (
                <div className="text-slate-400 text-sm">No delivery data for this sprint.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
