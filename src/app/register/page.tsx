'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, User, Mail, Lock, CheckCircle, AlertCircle, UserPlus, Info } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: authCheck } = trpc.auth.check.useQuery(undefined, { retry: false })
  const { data: adminCheck, isLoading: checking } = trpc.auth.checkAdmin.useQuery()
  const createAdmin = trpc.auth.createAdmin.useMutation()

  const adminExists = adminCheck?.data?.adminExists ?? null

  useEffect(() => {
    if (authCheck?.data?.authenticated) {
      router.replace('/')
    }
  }, [authCheck, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      setLoading(false)
      return
    }

    try {
      const data = await createAdmin.mutateAsync({ username, email, password })

      if (data.success) {
        if (data.data && (data.data as any).status === 'pending') {
          setSuccess('Registration request submitted successfully! Please wait for superadmin approval before you can login.')
        } else {
          setSuccess('Admin user created successfully! Redirecting to login...')
          setTimeout(() => router.push('/login'), 2000)
        }
      } else {
        setError((data as any).message || 'Registration failed')
      }
    } catch (error: any) {
      setError(error?.message || 'An error occurred. Please try again.')
      console.error('Registration error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    )
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
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-200 to-red-200 drop-shadow-lg">
              {adminExists ? 'Request Admin Account' : 'Create First Admin Account'}
            </h1>
            <p className="text-white/70 text-sm md:text-base">
              {adminExists
                ? 'Submit a request for admin account. Superadmin approval required.'
                : 'Set up your first admin account to access the dashboard'}
            </p>
            {adminExists && (
              <div className="bg-blue-500/20 border border-blue-400/30 text-white px-4 py-3 rounded-xl text-sm">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>Your request will be reviewed by a superadmin before you can login.</span>
                </div>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-white/90 font-semibold">Username</Label>
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
              <Label htmlFor="email" className="text-white/90 font-semibold">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Enter your email"
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:border-white/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/90 font-semibold">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Enter your password (min 8 characters)"
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:border-white/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white/90 font-semibold">Confirm Password</Label>
              <div className="relative">
                <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Confirm your password"
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

            {success && (
              <Alert className="bg-green-500/20 border-green-400/30 text-white animate-slide-in">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-200">{success}</AlertDescription>
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
                  {adminExists ? 'Submitting request...' : 'Creating account...'}
                </>
              ) : (
                adminExists ? 'Submit Admin Request' : 'Create Admin Account'
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="pt-4 border-t border-white/10">
            <p className="text-center text-white/50 text-xs mb-3">
              Already have an account?
            </p>
            <Link
              href="/login"
              className="block w-full text-center text-white/70 hover:text-white font-medium py-2 rounded-xl hover:bg-white/10 transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
