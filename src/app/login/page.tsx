'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Lock, User, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: authCheck } = trpc.auth.check.useQuery(undefined, { retry: false })

  useEffect(() => {
    if (authCheck?.data?.authenticated) {
      router.replace('/')
    }
  }, [authCheck, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await response.json()

      if (data.success) {
        router.push('/')
        router.refresh()
      } else {
        setError(data.message || 'Login failed')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="rounded-2xl shadow-2xl p-8 md:p-10 space-y-6 border border-white/10 bg-black/40 backdrop-blur-xl">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-red-500/20 backdrop-blur-sm mb-2 border border-white/20">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-200 to-red-200 drop-shadow-lg">
              Welcome Back
            </h1>
            <p className="text-white/70 text-sm md:text-base">
              Sign in to access the dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-white/90 font-semibold">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Enter your username"
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:border-white/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/90 font-semibold">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Enter your password"
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:border-white/40"
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-500/20 border-red-400/30 text-white animate-slide-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-500 hover:to-red-500 text-white font-bold py-6 border-0"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <p className="text-center text-white/50 text-xs">
              Secure access to your dashboard
            </p>
            <Link
              href="/register"
              className="block w-full text-center bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-all border border-white/20 hover:border-white/30"
            >
              Create Admin Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
