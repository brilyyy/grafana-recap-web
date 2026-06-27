import { FormDescription } from '@/components/ui/form'
import { describeCron } from '@/lib/cron-description'

export function CronDescription({ value }: { value: string }) {
  const result = describeCron(value)
  return (
    <FormDescription className={result.ok ? undefined : 'italic'}>
      {result.ok ? result.text : 'Enter a valid cron expression to see a description'}
    </FormDescription>
  )
}
