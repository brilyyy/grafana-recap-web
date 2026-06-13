import { router } from './init'
import { appProceduresRouter } from './routers/appProcedures'
import { applicationsRouter } from './routers/applications'
import { auditLogsRouter } from './routers/auditLogs'
import { authRouter } from './routers/auth'
import { databasesRouter } from './routers/databases'
import { dictionaryRouter } from './routers/dictionary'
import { fdwRouter } from './routers/fdw'
import { housekeepingRouter } from './routers/housekeeping'
import { noRcTransactionRouter } from './routers/noRcTransaction'
import { processingLogsRouter } from './routers/processingLogs'
import { recapRouter } from './routers/recap'
import { schedulerRouter } from './routers/scheduler'
import { systemRouter } from './routers/system'
import { unmappedRcRouter } from './routers/unmappedRc'
import { uploadsRouter } from './routers/uploads'
import { usersRouter } from './routers/users'

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  applications: applicationsRouter,
  databases: databasesRouter,
  appProcedures: appProceduresRouter,
  dictionary: dictionaryRouter,
  unmappedRc: unmappedRcRouter,
  noRcTransaction: noRcTransactionRouter,
  auditLogs: auditLogsRouter,
  processingLogs: processingLogsRouter,
  recap: recapRouter,
  system: systemRouter,
  fdw: fdwRouter,
  housekeeping: housekeepingRouter,
  uploads: uploadsRouter,
  scheduler: schedulerRouter,
})

export type AppRouter = typeof appRouter
