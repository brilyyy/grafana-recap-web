import { useState } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Loader2, LogOut } from 'lucide-react'

export default function LogoutButton() {
  const navigate = useNavigate()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    if (loading) return
    setLoading(true)
    try {
      await authClient.signOut()
      navigate({ to: '/login' })
      router.invalidate()
    } catch (error) {
      console.error('Logout error:', error)
      navigate({ to: '/login' })
      router.invalidate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleLogout}
      disabled={loading}
      title="Logout"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Logging out...</span>
        </>
      ) : (
        <>
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </>
      )}
    </Button>
  )
}
