import { pgEnum } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['superadmin', 'admin', 'user'])
export const requestedRoleEnum = pgEnum('requested_role', ['admin', 'user'])
export const requestStatusEnum = pgEnum('request_status', ['pending', 'approved', 'rejected'])
export const errorTypeEnum = pgEnum('error_type', ['S', 'N', 'Sukses'])
