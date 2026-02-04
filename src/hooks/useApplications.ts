import { useState, useEffect, useRef, useCallback } from 'react'
import type { Application } from '@/types'

// Shared state untuk applications
let applicationsCache: Application[] | null = null
let applicationsPromise: Promise<Application[]> | null = null
let lastFetchTime = 0
const CACHE_DURATION = 60000 // 1 minute cache

// Callbacks untuk semua mounted instances
const refreshCallbacks = new Set<() => void>()

/**
 * Custom hook untuk load applications dengan caching dan deduplication
 * Mencegah multiple calls ke /api/applications
 */
export function useApplications() {
  const [applications, setApplications] = useState<Application[]>(applicationsCache || [])
  const [isLoading, setIsLoading] = useState(!applicationsCache)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadData = useCallback(() => {
    const now = Date.now()
    
    // Jika cache masih valid, gunakan cache
    if (applicationsCache && (now - lastFetchTime) < CACHE_DURATION) {
      if (mountedRef.current) {
        setApplications(applicationsCache)
        setIsLoading(false)
      }
      return
    }

    // Jika sudah ada request yang sedang berjalan, tunggu request tersebut
    if (applicationsPromise) {
      applicationsPromise
        .then((data) => {
          if (mountedRef.current) {
            setApplications(data)
            setIsLoading(false)
            setError(null)
          }
        })
        .catch((err) => {
          if (mountedRef.current) {
            setError(err.message)
            setIsLoading(false)
          }
        })
      return
    }

    // Buat request baru
    setIsLoading(true)
    setError(null)

    applicationsPromise = fetch('/api/applications')
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          applicationsCache = result.data
          lastFetchTime = Date.now()
          return result.data
        } else {
          throw new Error(result.message || 'Failed to load applications')
        }
      })
      .finally(() => {
        applicationsPromise = null
      })

    applicationsPromise
      .then((data) => {
        // Update all mounted instances
        refreshCallbacks.forEach(callback => callback())
        if (mountedRef.current) {
          setApplications(data)
          setIsLoading(false)
          setError(null)
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(err.message)
          setIsLoading(false)
        }
      })
  }, [])

  useEffect(() => {
    loadData()

    // Listen for app added event to refresh cache
    const handleAppAdded = () => {
      // Invalidate cache and reload
      applicationsCache = null
      lastFetchTime = 0
      applicationsPromise = null
      // Trigger refresh for all instances
      refreshCallbacks.forEach(callback => callback())
      loadData()
    }

    window.addEventListener('appAdded', handleAppAdded)

    return () => {
      window.removeEventListener('appAdded', handleAppAdded)
    }
  }, [loadData])

  // Function untuk refresh applications (invalidate cache)
  const refreshApplications = useCallback(async () => {
    applicationsCache = null
    lastFetchTime = 0
    applicationsPromise = null

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/applications')
      const result = await response.json()

      if (result.success) {
        applicationsCache = result.data
        lastFetchTime = Date.now()
        // Update all mounted instances
        refreshCallbacks.forEach(callback => callback())
        if (mountedRef.current) {
          setApplications(result.data)
          setIsLoading(false)
        }
      } else {
        throw new Error(result.message || 'Failed to load applications')
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message)
        setIsLoading(false)
      }
    }
  }, [])

  // Register refresh callback
  useEffect(() => {
    const updateState = () => {
      if (mountedRef.current && applicationsCache) {
        setApplications(applicationsCache)
        setIsLoading(false)
      }
    }
    refreshCallbacks.add(updateState)
    return () => {
      refreshCallbacks.delete(updateState)
    }
  }, [])

  return { applications, isLoading, error, refreshApplications }
}
