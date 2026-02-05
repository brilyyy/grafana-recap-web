import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm'
import type { UserRole as UserRoleType } from './User'

// Define UserRole values as array to avoid circular dependency
// This matches the UserRole enum values from User.ts
const UserRoleValues = ['superadmin', 'admin', 'user'] as const

export enum RequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum RequestedRole {
  ADMIN = 'admin',
  USER = 'user',
}

@Entity('pending_user_requests')
@Index('idx_username', ['username'], { unique: true })
@Index('idx_email', ['email'], { unique: true })
@Index('idx_status', ['status'])
@Index('idx_requested_by', ['requestedBy'])
export class PendingUserRequest {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 255, unique: true })
  username!: string

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string

  @Column({ type: 'enum', enum: RequestedRole, name: 'requested_role' })
  requestedRole!: RequestedRole

  @ManyToOne(
    () => {
      try {
        return require('./User').User
      } catch (e1) {
        try {
          return require('./User.js').User
        } catch (e2) {
          try {
            return require('./User.ts').User
          } catch (e3) {
            const path = require('path')
            const userPath = path.resolve(__dirname, 'User')
            return require(userPath).User
          }
        }
      }
    },
    { nullable: true, onDelete: 'SET NULL' }
  )
  @JoinColumn({ name: 'requested_by' })
  requestedBy!: any

  @Column({ name: 'requested_by', nullable: true })
  requestedById!: number | null

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.PENDING })
  status!: RequestStatus

  @Column({ 
    type: 'enum', 
    enum: UserRoleValues, 
    enumName: 'UserRole',
    nullable: true, 
    name: 'approved_role' 
  })
  approvedRole!: UserRoleType | null

  @ManyToOne(
    () => {
      try {
        return require('./User').User
      } catch (e1) {
        try {
          return require('./User.js').User
        } catch (e2) {
          try {
            return require('./User.ts').User
          } catch (e3) {
            const path = require('path')
            const userPath = path.resolve(__dirname, 'User')
            return require(userPath).User
          }
        }
      }
    },
    { nullable: true, onDelete: 'SET NULL' }
  )
  @JoinColumn({ name: 'approved_by' })
  approvedBy!: any

  @Column({ name: 'approved_by', nullable: true })
  approvedById!: number | null

  @ManyToOne(
    () => {
      try {
        return require('./User').User
      } catch (e1) {
        try {
          return require('./User.js').User
        } catch (e2) {
          try {
            return require('./User.ts').User
          } catch (e3) {
            const path = require('path')
            const userPath = path.resolve(__dirname, 'User')
            return require(userPath).User
          }
        }
      }
    },
    { nullable: true, onDelete: 'SET NULL' }
  )
  @JoinColumn({ name: 'rejected_by' })
  rejectedBy!: any

  @Column({ name: 'rejected_by', nullable: true })
  rejectedById!: number | null

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason!: string | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
