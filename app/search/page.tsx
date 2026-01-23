'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Loader2, AlertCircle, ExternalLink, Zap, FileText, Bookmark } from 'lucide-react'

interface SearchResult {
  id: string
  title: string
  type: 'jira_ticket' | 'confluence_page'
  url: string
  relevanceScore: number
  summary: string
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | 'jira' | 'confluence'>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cached, setCached] = useState(false)
  const [totalResults, setTotalResults] = useState(0)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) {
      setError('Please enter a search query')
      return
    }

    setLoading(true)
    setError('')
    setResults([])

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Authentication required')
        setLoading(false)
        return
      }

      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&type=${type}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()

      setResults([
        ...(data.jiraResults || []),
        ...(data.confluenceResults || []),
      ])
      setTotalResults(data.totalResults || 0)
      setCached(data.cached || false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to perform search'
      )
    } finally {
      setLoading(false)
    }
  }

  const getTypeIcon = (type: string) => {
    return type === 'jira_ticket' ? (
      <Bookmark className="w-4 h-4" />
    ) : (
      <FileText className="w-4 h-4" />
    )
  }

  const getTypeColor = (type: string) => {
    return type === 'jira_ticket'
      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      : 'bg-green-500/20 text-green-300 border-green-500/30'
  }

  const formatScore = (score: number) => {
    return `${(score * 100).toFixed(0)}%`
  }

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-fadeIn">
          <h1 className="text-4xl font-bold text-white mb-2">
            Global Search
          </h1>
          <p className="text-slate-400">
            Search across Jira tickets and Confluence using AI-powered semantic search
          </p>
        </div>

        {/* Search Form */}
        <Card className="glass-card border-slate-700/30 mb-8 animate-slideInUp">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch}>
              <div className="space-y-4">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input
                    placeholder="Search tickets, issues, or documentation..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={loading}
                    className="pl-10 bg-slate-800/50 border-slate-700 h-11"
                  />
                </div>

                {/* Filter and Action */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-400 self-center">Filter:</span>
                    {(['all', 'jira', 'confluence'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        disabled={loading}
                        className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${
                          type === t
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'text-slate-400 hover:text-slate-300 border border-transparent hover:border-slate-700'
                        }`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="btn-glow bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white w-full sm:w-auto"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    {loading ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Card className="glass-card border-red-500/30 mb-8 animate-slideInUp">
            <CardContent className="pt-6 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results Summary */}
        {results.length > 0 && (
          <div className="mb-6 animate-fadeIn">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Results <span className="text-slate-400">({totalResults})</span>
                </h2>
                {cached && (
                  <p className="text-sm text-yellow-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    Cached results (up to 24 hours old)
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results List */}
        <div className="space-y-4">
          {results.map((result, idx) => (
            <Card
              key={`${result.type}-${result.id}`}
              className="glass-card border-slate-700/30 hover:border-blue-500/50 transition-all duration-300 group animate-slideInUp"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <div className={`badge ${getTypeColor(result.type)} border flex items-center gap-1.5`}>
                        {getTypeIcon(result.type)}
                        <span>
                          {result.type === 'jira_ticket'
                            ? 'Jira Ticket'
                            : 'Confluence Page'}
                        </span>
                      </div>
                      <div className="badge bg-slate-500/20 text-slate-300 border-slate-500/30 border">
                        Relevance: {formatScore(result.relevanceScore)}
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors break-words mb-2">
                      {result.title}
                    </h3>

                    <p className="text-slate-400 line-clamp-2 text-sm">
                      {result.summary}
                    </p>
                  </div>

                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 p-2 rounded-lg transition-all group-hover:translate-x-0.5"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}

          {!loading && results.length === 0 && query && !error && (
            <Card className="glass-card border-slate-700/30">
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
                <p className="text-slate-400">
                  No results found for "<span className="font-semibold">{query}</span>". Try a different search term.
                </p>
              </CardContent>
            </Card>
          )}

          {!loading && results.length === 0 && !query && !error && (
            <Card className="glass-card border-slate-700/30">
              <CardContent className="py-12 text-center">
                <Search className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
                <p className="text-slate-400">
                  Enter a search query to find related tickets and documentation
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="animate-spin">
              <Zap className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-slate-400">Searching...</p>
          </div>
        )}
      </div>
    </main>
  )
}
