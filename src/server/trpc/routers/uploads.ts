import { processDictionaryUpload } from '@/server/uploads/dictionary'
import { processSuccessRateUpload } from '@/server/uploads/success-rate'
import { protectedProcedure, router } from '../init'

/** tRPC v11 accepts FormData inputs; validate shape manually (zod has no FormData schema). */
function formDataInput(val: unknown): FormData {
  if (val instanceof FormData) return val
  throw new Error('Expected FormData')
}

function extractUpload(form: FormData, fileField: string) {
  const file = form.get(fileField)
  const selectedApplicationId = form.get('selectedApplicationId')
  return {
    file: file instanceof File ? file : null,
    selectedApplicationId: typeof selectedApplicationId === 'string' ? selectedApplicationId : '',
  }
}

function clientMeta(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : (headers.get('x-real-ip')?.trim() ?? null)
  return { ip, userAgent: headers.get('user-agent') }
}

export const uploadsRouter = router({
  successRate: protectedProcedure.input(formDataInput).mutation(async ({ input, ctx }) => {
    const { file, selectedApplicationId } = extractUpload(input, 'successRateFile')
    if (!file) return { success: false as const, message: 'No file uploaded' }
    const { ip, userAgent } = clientMeta(ctx.headers)
    return processSuccessRateUpload({ file, selectedApplicationId, session: ctx.session, ip, userAgent })
  }),

  dictionary: protectedProcedure.input(formDataInput).mutation(async ({ input, ctx }) => {
    const { file, selectedApplicationId } = extractUpload(input, 'dictionaryFile')
    if (!file) return { success: false as const, message: 'No file uploaded' }
    const { ip, userAgent } = clientMeta(ctx.headers)
    return processDictionaryUpload({ file, selectedApplicationId, session: ctx.session, ip, userAgent })
  }),
})
