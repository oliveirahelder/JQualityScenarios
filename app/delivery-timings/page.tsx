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

type TicketTiming = {
  jiraId: string
  summary: string
  assignee: string
  workHours: number
  storyPoints: number
  hoursPerStoryPoint: number | null
}

type TicketTimingsBySprint = {
  sprintId: string
  sprintName: string
  sprintStart: string
  sprintEnd: string
  tickets: TicketTiming[]
}

export default function DeliveryTimingsPage() {
  const [loading, setLoading] = useState(true)
  const [activeSprints, setActiveSprints] = useState<Array<{ id: string; name: string }>>([])
  const [deliveryTimes, setDeliveryTimes] = useState<DeliveryEntry[]>([])
  const [deliveryTimesBySprint, setDeliveryTimesBySprint] = useState<SprintDelivery[]>([])
  const [ticketTimingsBySprint, setTicketTimingsBySprint] = useState<TicketTimingsBySprint[]>([])
  const [capacityAverages, setCapacityAverages] = useState<
    Array<{ name: string; avgSpPerDay: number; sprintCount: number }>
  >([])
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
        setTicketTimingsBySprint(data.deliveryTicketTimesBySprint || [])
        setCapacityAverages(data.capacityAverages || [])
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
  const selectedTicketTimings =
    selectedSprintId === 'all'
      ? []
      : ticketTimingsBySprint.find((sprint) => sprint.sprintId === selectedSprintId)?.tickets || []
  const selectedSprintMeta =
    selectedSprintId === 'all'
      ? null
      : ticketTimingsBySprint.find((sprint) => sprint.sprintId === selectedSprintId) || null
  const ticketsByAssignee = selectedTicketTimings.reduce((acc, ticket) => {
    const key = ticket.assignee || 'Unassigned'
    const list = acc.get(key) || []
    list.push(ticket)
    acc.set(key, list)
    return acc
  }, new Map<string, TicketTiming[]>())

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Delivery individual timings</h1>
          <p className="text-slate-400 text-sm">
            Time from In Progress to final phase, using 8h business days.
          </p>
          <div className="mt-3 text-xs text-slate-500 space-y-1">
            <div>Legend:</div>
            <div>Avg hours = total work hours / tickets handled.</div>
            <div>H / SP = total work hours / story points closed.</div>
            <div>
              SP/day = story points closed in sprint / sprint days (8h per business day).
            </div>
            <div>Avg SP/day = developer average over the last 10 closed sprints.</div>
          </div>
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

        <div className="mt-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Developers</h2>
          {selectedSprintId === 'all' ? (
            <p className="text-slate-400 text-sm">
              Select a sprint to view ticket-level timing per developer.
            </p>
          ) : ticketsByAssignee.size === 0 ? (
            <p className="text-slate-400 text-sm">No ticket timing data for this sprint.</p>
          ) : (
            Array.from(ticketsByAssignee.entries()).map(([assignee, tickets]) => {
              const totalHours = tickets.reduce((sum, ticket) => sum + ticket.workHours, 0)
              const totalPoints = tickets.reduce((sum, ticket) => sum + ticket.storyPoints, 0)
              const avgHoursPerTicket = tickets.length
                ? Math.round((totalHours / tickets.length) * 10) / 10
                : 0
              const avgHoursPerPoint =
                totalPoints > 0 ? Math.round((totalHours / totalPoints) * 10) / 10 : 0
              const sprintDays = selectedSprintMeta
                ? Math.max(
                    1,
                    Math.round(
                      (new Date(selectedSprintMeta.sprintEnd).getTime() -
                        new Date(selectedSprintMeta.sprintStart).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  )
                : 0
              const spPerDay =
                sprintDays > 0 ? Math.round((totalPoints / sprintDays) * 10) / 10 : 0
              const avgSpPerDay =
                capacityAverages.find((entry) => entry.name === assignee)?.avgSpPerDay ?? 0

              return (
                <Card key={assignee} className="glass-card rounded-xl overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-slate-700 to-slate-600"></div>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-slate-300 text-sm font-semibold mb-1">{assignee}</p>
                        <h3 className="text-2xl font-bold text-white tracking-tight">
                          <span title="Average work hours per ticket for this sprint.">
                            {avgHoursPerTicket}h avg
                          </span>
                        </h3>
                      </div>
                      <div className="text-xs text-slate-400 text-right">
                        <div title="Total tickets handled by this developer in the selected sprint.">
                          {tickets.length} tickets
                        </div>
                        <div title="Average hours per story point (hours worked / story points closed).">
                          {avgHoursPerPoint}h / SP
                        </div>
                        <div title="Story points closed per day (8h business day). Avg shows the last 10 closed sprints.">
                          {spPerDay} SP/day (avg {avgSpPerDay})
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2 text-[10px] uppercase text-slate-500 text-center">
                      <div className="grid grid-cols-5 gap-2">
                        <span title="Ticket key in Jira.">Ticket</span>
                        <span title="Ticket summary from Jira.">Summary</span>
                        <span title="Total work hours from In Dev to final phase for this ticket.">Hours</span>
                        <span title="Story points assigned to the ticket.">SP</span>
                        <span title="Hours per story point for this ticket.">H / SP</span>
                      </div>
                    </div>
                    <div className="mt-2 space-y-2 text-xs text-slate-300">
                      {tickets.map((ticket) => (
                        <div
                          key={ticket.jiraId}
                          className="grid grid-cols-5 gap-2 rounded-lg bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-100 text-center"
                        >
                          <span className="truncate">{ticket.jiraId}</span>
                          <span className="truncate">{ticket.summary}</span>
                          <span>{ticket.workHours}h</span>
                          <span>{ticket.storyPoints}</span>
                          <span>{ticket.hoursPerStoryPoint ?? '--'}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}
