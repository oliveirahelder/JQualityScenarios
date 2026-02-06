'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    plannedTickets?: number
    finishedTickets?: number
    qaDoneTickets?: number
    workedTickets?: number
  }
  tickets?: Array<{
    jiraId?: string
    summary?: string
    status?: string
    assignee?: string | null
    priority?: string | null
    storyPoints?: number | null
    qaBounceBackCount?: number | null
    prCount?: number | null
    grossTime?: number | null
    updatedAt?: string
  }>
}

type ColumnDef = {
  key: string
  label: string
  getValue: (ticket: NonNullable<SprintSnapshot['tickets']>[number]) => string | number | null
}

const COLUMN_DEFS: ColumnDef[] = [
  {
    key: 'jiraId',
    label: 'Ticket',
    getValue: (ticket) => ticket.jiraId || '',
  },
  {
    key: 'summary',
    label: 'Summary',
    getValue: (ticket) => ticket.summary || '',
  },
  {
    key: 'status',
    label: 'Status',
    getValue: (ticket) => ticket.status || '',
  },
  {
    key: 'assignee',
    label: 'Assignee',
    getValue: (ticket) => ticket.assignee || '',
  },
  {
    key: 'priority',
    label: 'Priority',
    getValue: (ticket) => ticket.priority || '',
  },
  {
    key: 'storyPoints',
    label: 'Story Points',
    getValue: (ticket) => ticket.storyPoints ?? '',
  },
  {
    key: 'qaBounceBackCount',
    label: 'Bounce Back',
    getValue: (ticket) => ticket.qaBounceBackCount ?? '',
  },
  {
    key: 'prCount',
    label: 'PR Count',
    getValue: (ticket) => ticket.prCount ?? '',
  },
  {
    key: 'grossTime',
    label: 'Gross Time (days)',
    getValue: (ticket) => ticket.grossTime ?? '',
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    getValue: (ticket) => {
      if (!ticket.updatedAt) return ''
      const date = new Date(ticket.updatedAt)
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()
    },
  },
]

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [snapshots, setSnapshots] = useState<SprintSnapshot[]>([])
  const [error, setError] = useState('')
  const [selectedSprintId, setSelectedSprintId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [visibleColumns, setVisibleColumns] = useState(() =>
    new Set(COLUMN_DEFS.map((column) => column.key))
  )

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

  useEffect(() => {
    if (!selectedSprintId && snapshots.length > 0) {
      setSelectedSprintId(snapshots[0].id)
    }
  }, [snapshots, selectedSprintId])

  const selectedSprint = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === selectedSprintId),
    [snapshots, selectedSprintId]
  )

  const tickets = useMemo(() => selectedSprint?.tickets || [], [selectedSprint])

  const statusOptions = useMemo(() => {
    const values = new Set<string>()
    for (const ticket of tickets) {
      if (ticket.status) values.add(ticket.status)
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [tickets])

  const assigneeOptions = useMemo(() => {
    const values = new Set<string>()
    for (const ticket of tickets) {
      if (ticket.assignee) values.add(ticket.assignee)
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [tickets])

  const filteredTickets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return tickets.filter((ticket) => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false
      if (assigneeFilter !== 'all' && ticket.assignee !== assigneeFilter) return false
      if (!query) return true
      const haystack = COLUMN_DEFS.map((column) =>
        String(column.getValue(ticket) ?? '').toLowerCase()
      ).join(' ')
      return haystack.includes(query)
    })
  }, [tickets, searchTerm, statusFilter, assigneeFilter])

  const visibleColumnsList = useMemo(
    () => COLUMN_DEFS.filter((column) => visibleColumns.has(column.key)),
    [visibleColumns]
  )

  const handleToggleColumn = (key: string) => {
    setVisibleColumns((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleSelectAllColumns = () => {
    setVisibleColumns(new Set(COLUMN_DEFS.map((column) => column.key)))
  }

  const handleClearColumns = () => {
    setVisibleColumns(new Set())
  }

  const handleExportCsv = () => {
    if (!selectedSprint) return
    const headers = visibleColumnsList.map((column) => column.label)
    const rows = filteredTickets.map((ticket) =>
      visibleColumnsList.map((column) => {
        const value = column.getValue(ticket)
        if (value == null) return ''
        const text = String(value).replace(/"/g, '""')
        return `"${text}"`
      })
    )
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedSprint.name}-report.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPdf = () => {
    if (!selectedSprint) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const headerCells = visibleColumnsList.map((column) => `<th>${column.label}</th>`).join('')
    const rows = filteredTickets
      .map((ticket) => {
        const cells = visibleColumnsList
          .map((column) => `<td>${column.getValue(ticket) ?? ''}</td>`)
          .join('')
        return `<tr>${cells}</tr>`
      })
      .join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedSprint.name} Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 20px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            th { background: #f0f0f0; }
          </style>
        </head>
        <body>
          <h1>${selectedSprint.name}</h1>
          <div>Generated on ${new Date().toLocaleString()}</div>
          <table>
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

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
            <Card className="glass-card border-slate-700/30">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-white text-xl">Sprint Report Builder</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">
                      Select a sprint and fields to include in the report.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      className="h-8 px-3 text-xs"
                      onClick={handleExportCsv}
                      disabled={!selectedSprint}
                    >
                      Export CSV
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-8 px-3 text-xs"
                      onClick={handleExportPdf}
                      disabled={!selectedSprint}
                    >
                      Export PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500">Sprint</span>
                    <select
                      className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200"
                      value={selectedSprintId}
                      onChange={(event) => setSelectedSprintId(event.target.value)}
                    >
                      {snapshots.map((snapshot) => (
                        <option key={snapshot.id} value={snapshot.id}>
                          {snapshot.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500">Search</span>
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Filter tickets..."
                      className="h-8 w-52 bg-slate-900/70 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500">Status</span>
                    <select
                      className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      <option value="all">All</option>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500">Assignee</span>
                    <select
                      className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-200"
                      value={assigneeFilter}
                      onChange={(event) => setAssigneeFilter(event.target.value)}
                    >
                      <option value="all">All</option>
                      {assigneeOptions.map((assignee) => (
                        <option key={assignee} value={assignee}>
                          {assignee}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedSprint && (
                  <div className="grid gap-3 md:grid-cols-6 text-xs">
                    <div>
                      <div className="text-slate-500">Tickets</div>
                      <div className="text-white font-semibold">
                        {selectedSprint.totals.totalTickets ?? tickets.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Finished</div>
                      <div className="text-white font-semibold">
                        {selectedSprint.totals.finishedTickets ??
                          selectedSprint.totals.closedTickets ??
                          0}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Success</div>
                      <div className="text-blue-300 font-semibold">
                        {selectedSprint.totals.successPercent != null
                          ? `${selectedSprint.totals.successPercent}%`
                          : '0%'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">SP Total</div>
                      <div className="text-white font-semibold">
                        {selectedSprint.totals.storyPointsTotal ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">SP Closed</div>
                      <div className="text-white font-semibold">
                        {selectedSprint.totals.storyPointsClosed ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Bounce</div>
                      <div className="text-white font-semibold">
                        {selectedSprint.totals.bounceBackTickets ?? 0}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card border-slate-700/30">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-white text-lg">Columns</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">
                      Pick the fields to include in the report.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      className="h-7 px-2 text-xs"
                      onClick={handleSelectAllColumns}
                    >
                      Select all
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-7 px-2 text-xs"
                      onClick={handleClearColumns}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs text-slate-200">
                {COLUMN_DEFS.map((column) => (
                  <label key={column.key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(column.key)}
                      onChange={() => handleToggleColumn(column.key)}
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-card border-slate-700/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white text-lg">Report Table</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">
                      Showing {filteredTickets.length} of {tickets.length} tickets.
                    </CardDescription>
                  </div>
                  <BarChart3 className="w-5 h-5 text-slate-400" />
                </div>
              </CardHeader>
              <CardContent>
                {visibleColumnsList.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-sm">
                    Select at least one column to build the report.
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <table className="min-w-full text-xs text-slate-200">
                      <thead>
                        <tr className="border-b border-slate-700/50 text-left text-slate-400">
                          {visibleColumnsList.map((column) => (
                            <th key={column.key} className="py-2 pr-4 font-medium">
                              {column.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTickets.map((ticket, index) => (
                          <tr
                            key={`${ticket.jiraId || index}`}
                            className="border-b border-slate-800/40 last:border-none"
                          >
                            {visibleColumnsList.map((column) => (
                              <td key={column.key} className="py-2 pr-4 text-slate-200">
                                {column.getValue(ticket) || '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}
