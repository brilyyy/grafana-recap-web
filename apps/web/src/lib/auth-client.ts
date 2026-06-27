import { adminClient, usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : undefined,
  plugins: [usernameClient(), adminClient()],
})

export const { signIn, signOut, signUp, useSession, getSession } = authClient
