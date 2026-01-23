'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Zap, Copy, Check, AlertCircle, Sparkles, Code2 } from 'lucide-react'

export default function GenerateScenariosPage() {
  const [ticketId, setTicketId] = useState('')
  const [confluence, setConfluence] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<number | null>(null)

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/scenarios/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId,
          confluence,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate scenarios')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, idx?: number) => {
    navigator.clipboard.writeText(text)
    setCopied(idx ?? -1)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-fadeIn">
          <h1 className="text-4xl font-bold text-white">Generate Test Scenarios</h1>
          <p className="text-slate-400 mt-1">AI-powered scenario creation from Jira tickets</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Form */}
          <div className="lg:col-span-1 animate-slideInLeft">
            <Card className="glass-card border-slate-700/30 sticky top-24">
              <CardHeader className="border-b border-slate-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                  <CardTitle>Generate Scenarios</CardTitle>
                </div>
                <CardDescription>Provide ticket details to create test scenarios</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleGenerate} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Jira Ticket ID</label>
                    <Input
                      placeholder="e.g., PROJ-123"
                      value={ticketId}
                      onChange={(e) => setTicketId(e.target.value)}
                      required
                      disabled={loading}
                      className="bg-slate-800/50 border-slate-700"
                    />
                    <p className="text-xs text-slate-500">
                      ℹ️ The system will fetch details from Jira API
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Documentation (Optional)</label>
                    <Textarea
                      placeholder="Paste any relevant documentation or context..."
                      value={confluence}
                      onChange={(e) => setConfluence(e.target.value)}
                      disabled={loading}
                      rows={5}
                      className="bg-slate-800/50 border-slate-700 resize-none"
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-300 text-sm flex items-center gap-2 animate-slideInUp">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full btn-glow bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {loading ? 'Generating...' : 'Generate Scenarios'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-6 animate-slideInRight">
            {result ? (
              <>
                {/* Ticket Details */}
                <Card className="glass-card border-slate-700/30">
                  <CardHeader className="border-b border-slate-700/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Code2 className="w-5 h-5 text-purple-400" />
                      <CardTitle>Ticket Details</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs text-slate-400 font-semibold uppercase mb-2">ID</p>
                        <p className="text-white font-mono text-lg font-semibold">{result.jiraDetails.id}</p>
                      </div>
                      {result.jiraDetails.status && (
                        <div>
                          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Status</p>
                          <div className="badge">{result.jiraDetails.status}</div>
                        </div>
                      )}
                    </div>
                    <div className="mt-6">
                      <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Summary</p>
                      <p className="text-white text-base">{result.jiraDetails.summary}</p>
                    </div>
                    {result.jiraDetails.description && (
                      <div className="mt-6">
                        <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Description</p>
                        <div className="text-white text-sm p-4 bg-slate-800/30 rounded-lg border border-slate-700/30">
                          {result.jiraDetails.description}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Scenarios */}
                {result.scenarios && result.scenarios.length > 0 && (
                  <Card className="glass-card border-slate-700/30">
                    <CardHeader className="border-b border-slate-700/30">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-blue-400" />
                          <div>
                            <CardTitle>Generated Scenarios</CardTitle>
                            <CardDescription>{result.scenarios.length} scenarios created</CardDescription>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(result.scenarios.join('\n\n---\n\n'), -1)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        >
                          {copied === -1 ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                          {copied === -1 ? 'Copied!' : 'Copy All'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {result.scenarios.map((scenario: string, idx: number) => (
                          <div 
                            key={idx} 
                            className="group p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg hover:border-blue-500/50 transition-all duration-300"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                                  {scenario}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(scenario, idx)}
                                className="flex-shrink-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                {copied === idx ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="glass-card border-slate-700/30">
                <CardContent className="py-16 text-center">
                  <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
                  <p className="text-slate-400 max-w-md mx-auto">
                    Enter a Jira ticket ID and click "Generate Scenarios" to see AI-generated test scenarios here.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
