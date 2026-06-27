import { router } from './init'
import { applicationsRouter } from './routers/applications'
import { appMappingsRouter } from './routers/appMappings'
import { appProceduresRouter } from './routers/appProcedures'
import { auditLogsRouter } from './routers/auditLogs'
import { authRouter } from './routers/auth'
import { databasesRouter } from './routers/databases'
import { dictionaryRouter } from './routers/dictionary'
import { fdwRouter } from './routers/fdw'
import { generatorRouter } from './routers/generator'
import { housekeepingRouter } from './routers/housekeeping'
import { indexAnalyzerRouter } from './routers/indexAnalyzer'
import { noRcTransactionRouter } from './routers/noRcTransaction'
import { processingLogsRouter } from './routers/processingLogs'
import { recapRouter } from './routers/recap'
import { schedulerRouter } from './routers/scheduler'
import { setupRouter } from './routers/setup'
import { systemRouter } from './routers/system'
import { unmappedRcRouter } from './routers/unmappedRc'
import { uploadsRouter } from './routers/uploads'
import { usersRouter } from './routers/users'

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  applications: applicationsRouter,
  appMappings: appMappingsRouter,
  databases: databasesRouter,
  appProcedures: appProceduresRouter,
  dictionary: dictionaryRouter,
  unmappedRc: unmappedRcRouter,
  noRcTransaction: noRcTransactionRouter,
  generator: generatorRouter,
  auditLogs: auditLogsRouter,
  processingLogs: processingLogsRouter,
  recap: recapRouter,
  system: systemRouter,
  fdw: fdwRouter,
  housekeeping: housekeepingRouter,
  uploads: uploadsRouter,
  scheduler: schedulerRouter,
  setup: setupRouter,
  indexAnalyzer: indexAnalyzerRouter,
})

export type AppRouter = typeof appRouter
