import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

export default defineConfig({
  root: '.',
  compressHTML: true,
  integrations: [
    starlight({
      title: 'Grafana Recap',
      sidebar: [
        {
          label: 'Overview',
          items: [{ label: 'Documentation', slug: 'index' }],
        },
        {
          label: 'Features',
          items: [
            { label: 'App Management', slug: 'features/app-management' },
            { label: 'Audit Logging', slug: 'features/audit-logging' },
            { label: 'Auth', slug: 'features/auth' },
            { label: 'Dictionary Management', slug: 'features/dictionary-management' },
            { label: 'Index Analyzer', slug: 'features/index-analyzer' },
            { label: 'No-RC Transaction', slug: 'features/no-rc-transaction' },
            { label: 'Processing Scheduler', slug: 'features/processing-scheduler' },
            { label: 'Success Rate Upload', slug: 'features/success-rate-upload' },
            { label: 'Unmapped RC', slug: 'features/unmapped-rc' },
            { label: 'User Management', slug: 'features/user-management' },
            { label: 'Dashboard', slug: 'features/dashboard' },
            { label: 'Generator', slug: 'features/generator' },
            { label: 'Settings', slug: 'features/settings' },
            { label: 'Uploads', slug: 'features/uploads' },
          ],
        },
        {
          label: 'Technical',
          items: [
            { label: 'App Management', slug: 'technical/app-management' },
            { label: 'Audit Logging', slug: 'technical/audit-logging' },
            { label: 'Auth', slug: 'technical/auth' },
            { label: 'Dictionary Management', slug: 'technical/dictionary-management' },
            { label: 'I18n', slug: 'technical/i18n' },
            { label: 'Index Analyzer', slug: 'technical/index-analyzer' },
            { label: 'No-RC Transaction', slug: 'technical/no-rc-transaction' },
            { label: 'Processing Scheduler', slug: 'technical/processing-scheduler' },
            { label: 'Server Config', slug: 'technical/server-config' },
            { label: 'Success Rate Upload', slug: 'technical/success-rate-upload' },
            { label: 'Unmapped RC', slug: 'technical/unmapped-rc' },
            { label: 'User Management', slug: 'technical/user-management' },
            { label: 'App Mappings', slug: 'technical/app-mappings' },
            { label: 'App Procedures', slug: 'technical/app-procedures' },
            { label: 'Databases & FDW', slug: 'technical/databases-fdw' },
            { label: 'Housekeeping', slug: 'technical/housekeeping' },
            { label: 'Processing Logs', slug: 'technical/processing-logs' },
            { label: 'Recap', slug: 'technical/recap' },
            { label: 'Uploads', slug: 'technical/uploads' },
          ],
        },
        {
          label: 'PPTX Generator',
          items: [
            { label: 'Overview', slug: 'sr-generator/overview' },
            { label: 'Data Pipeline', slug: 'sr-generator/pipeline' },
            { label: 'API & Setup', slug: 'sr-generator/api' },
          ],
        },
        {
          label: 'Operations',
          items: [
            { label: 'Add New App', slug: 'operations/add-new-app' },
            { label: 'Add New Recap Model', slug: 'operations/add-new-recap-model' },
            { label: 'Server Installation', slug: 'operations/server-installation' },
            { label: 'Success Rate SQL', slug: 'operations/success-rate-sql' },
          ],
        },
        {
          label: 'Testing',
          items: [
            { label: 'Regression Checklist', slug: 'testing/regression-checklist' },
          ],
        },
      ],
    }),
  ],
})
