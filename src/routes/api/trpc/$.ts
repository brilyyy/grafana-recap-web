import { createFileRoute } from '@tanstack/react-router'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createTRPCContext } from '@/server/trpc/init'
import { appRouter } from '@/server/trpc/root'

export const Route = createFileRoute('/api/trpc/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return fetchRequestHandler({
          endpoint: '/api/trpc',
          req: request,
          router: appRouter,
          createContext: () => createTRPCContext({ headers: request.headers }),
        })
      },
      POST: async ({ request }) => {
        return fetchRequestHandler({
          endpoint: '/api/trpc',
          req: request,
          router: appRouter,
          createContext: () => createTRPCContext({ headers: request.headers }),
        })
      },
    },
  },
})
