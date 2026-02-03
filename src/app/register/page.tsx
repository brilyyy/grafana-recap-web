'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminExists, setAdminExists] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(true)

  // Check if admin exists and if already authenticated
  useEffect(() => {
    let isMounted = true
    
    const checkStatus = async () => {
      try {
        // Check authentication
        const authResponse = await fetch('/api/auth/check')
        if (!isMounted) return
        
        const authData = await authResponse.json()
        if (authData.success && authData.data.authenticated) {
          router.replace('/')
          return
        }

        // Check if admin exists
        const adminResponse = await fetch('/api/auth/check-admin')
        if (!isMounted) return
        
        const adminData = await adminResponse.json()
        if (adminData.success) {
          setAdminExists(adminData.data.adminExists)
        }
      } catch (error) {
        console.error('Check error:', error)
      } finally {
        if (isMounted) {
          setChecking(false)
        }
      }
    }
    checkStatus()
    
    return () => {
      isMounted = false
    }
  }, []) // Remove router from dependencies

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    // Validation
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
      // create-admin API will handle:
      // - If no admin exists: create admin directly (first-time setup)
      // - If admin exists: create pending request (needs superadmin approval)
      const response = await fetch('/api/auth/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username, 
          email, 
          password
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Check if it's a pending request or direct creation
        if (data.data && data.data.status === 'pending') {
          setSuccess('Registration request submitted successfully! Please wait for superadmin approval before you can login.')
        } else {
          setSuccess('Admin user created successfully! Redirecting to login...')
          setTimeout(() => {
            router.push('/login')
          }, 2000)
        }
      } else {
        setError(data.message || 'Registration failed')
      }
    } catch (error: any) {
      setError('An error occurred. Please try again.')
      console.error('Registration error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-400/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Registration Card with Glassmorphism */}
        <div className="rounded-3xl shadow-2xl p-8 md:p-10 space-y-6 animate-fade-in border border-white/30 bg-black/40 backdrop-blur-xl">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-red-500/20 backdrop-blur-sm mb-2 border border-white/30">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-200 to-red-200 drop-shadow-lg">
              {adminExists ? 'Request Admin Account' : 'Create First Admin Account'}
            </h1>
            <p className="text-white/80 text-sm md:text-base font-medium">
              {adminExists 
                ? 'Submit a request for admin account. Superadmin approval required. Multiple admins can be created.'
                : 'Set up your first admin account to access the dashboard'}
            </p>
            {adminExists && (
              <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 text-white px-4 py-3 rounded-xl text-sm">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Your request will be reviewed by a superadmin before you can login.</span>
                </div>
              </div>
            )}
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="block text-sm font-semibold text-white/90 mb-2"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="w-5 h-5 text-white/50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:border-white/50 focus:ring-2 focus:ring-white/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter your username"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-white/90 mb-2"
              >
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="w-5 h-5 text-white/50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:border-white/50 focus:ring-2 focus:ring-white/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter your email"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-white/90 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="w-5 h-5 text-white/50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:border-white/50 focus:ring-2 focus:ring-white/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter your password (min 8 characters)"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-semibold text-white/90 mb-2"
              >
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="w-5 h-5 text-white/50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:border-white/50 focus:ring-2 focus:ring-white/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Confirm your password"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 backdrop-blur-sm border border-red-400/30 text-white px-4 py-3 rounded-xl text-sm animate-slide-in shadow-lg">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {success && (
              <div className="bg-green-500/20 backdrop-blur-sm border border-green-400/30 text-white px-4 py-3 rounded-xl text-sm animate-slide-in shadow-lg">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{success}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-500 hover:to-red-500 text-white font-bold py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {adminExists ? 'Submitting request...' : 'Creating account...'}
                </span>
              ) : (
                adminExists ? 'Submit Admin Request' : 'Create Admin Account'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="pt-4 border-t border-white/10">
            <p className="text-center text-white/60 text-xs mb-3">
              Already have an account?
            </p>
            <Link
              href="/login"
              className="block w-full text-center text-white/80 hover:text-white font-medium py-2 rounded-xl hover:bg-white/10 transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
