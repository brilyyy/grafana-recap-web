import { router } from './init'
import { authRouter } from './routers/auth'
import { usersRouter } from './routers/users'
import { applicationsRouter } from './routers/applications'
import { dictionaryRouter } from './routers/dictionary'
import { unmappedRcRouter } from './routers/unmappedRc'
import { noRcTransactionRouter } from './routers/noRcTransaction'
import { auditLogsRouter } from './routers/auditLogs'
import { processingLogsRouter } from './routers/processingLogs'
import { systemRouter } from './routers/system'

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  applications: applicationsRouter,
  dictionary: dictionaryRouter,
  unmappedRc: unmappedRcRouter,
  noRcTransaction: noRcTransactionRouter,
  auditLogs: auditLogsRouter,
  processingLogs: processingLogsRouter,
  system: systemRouter,
})

export type AppRouter = typeof appRouter
