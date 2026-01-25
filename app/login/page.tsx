'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Zap, LogIn, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
      const body = isRegister
        ? { email, password, name }
        : { email, password }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      if (!isRegister) {
        // Save token and redirect
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setSuccess('Login successful! Redirecting...')
        setTimeout(() => router.push('/dashboard'), 1000)
      } else {
        // Switch to login after registration
        setSuccess('Account created! Switching to login...')
        setTimeout(() => {
          setIsRegister(false)
          setError('')
          setSuccess('')
          setName('')
          setEmail('')
          setPassword('')
        }, 1500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8 animate-fadeIn">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/50">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/80 border border-slate-700/80 shadow-glow-blue">
              <Image src="/logo.svg" alt="JQuality logo" width={80} height={80} />
            </div>
            <h1 className="text-4xl font-bold text-gradient mb-2">JQuality</h1>
          </div>
          <p className="text-slate-400 text-sm">Test Intelligence Platform</p>
        </div>

        {/* Main Card */}
        <Card className="glass-card animate-slideInUp border-slate-700/30">
          <CardHeader className="space-y-3">
            <div>
              <CardTitle className="text-2xl">
                {isRegister ? 'Create Account' : 'Welcome Back'}
              </CardTitle>
              <CardDescription className="text-slate-400 mt-2">
                {isRegister
                  ? 'Join JQuality to automate your test scenarios'
                  : 'Sign in to access your test scenarios and documentation'}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Field (Register) */}
              {isRegister && (
                <div className="space-y-2 animate-slideInUp">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400" />
                    Full Name
                  </label>
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={isRegister}
                    disabled={loading}
                    className="bg-slate-800/50 border-slate-700 placeholder-slate-500 h-10 rounded-lg"
                  />
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400" />
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-slate-800/50 border-slate-700 placeholder-slate-500 h-10 rounded-lg"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-400" />
                  Password
                </label>
                  <Input
                    type="password"
                    placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-slate-800/50 border-slate-700 placeholder-slate-500 h-10 rounded-lg"
                />
              </div>

              {/* Error Alert */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-300 text-sm flex items-gap gap-2 animate-slideInUp">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success Alert */}
              {success && (
                <div className="p-3 bg-green-500/10 border border-green-500/50 rounded-lg text-green-300 text-sm flex items-center gap-2 animate-slideInUp">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 mt-6 btn-glow bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-lg"
              >
                <LogIn className="w-4 h-4 mr-2" />
                {loading
                  ? 'Processing...'
                  : isRegister
                  ? 'Create Account'
                  : 'Sign In'}
              </Button>
            </form>

            {/* Toggle Auth Mode */}
            <div className="mt-6 pt-6 border-t border-slate-700/50 text-center">
              <p className="text-slate-400 text-sm">
                {isRegister
                  ? 'Already have an account? '
                  : "Don't have an account? "}
                <button
                  onClick={() => {
                    setIsRegister(!isRegister)
                    setError('')
                    setSuccess('')
                    setEmail('')
                    setPassword('')
                    setName('')
                  }}
                  disabled={loading}
                  className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                >
                  {isRegister ? 'Sign In' : 'Create Account'}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer Info */}
        <div className="mt-8 text-center text-slate-500 text-xs">
          <p>Security: Your data is secure. We never share your information.</p>
        </div>
      </div>
    </div>
  )
}
