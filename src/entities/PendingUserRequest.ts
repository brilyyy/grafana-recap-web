import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm'
import type { UserRole as UserRoleType } from './User'
const { UserRole } = require('./User')

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
      const { User } = require('./User')
      return User
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
    enum: UserRole, 
    enumName: 'UserRole',
    nullable: true, 
    name: 'approved_role' 
  })
  approvedRole!: UserRoleType | null

  @ManyToOne(
    () => {
      const { User } = require('./User')
      return User
    },
    { nullable: true, onDelete: 'SET NULL' }
  )
  @JoinColumn({ name: 'approved_by' })
  approvedBy!: any

  @Column({ name: 'approved_by', nullable: true })
  approvedById!: number | null

  @ManyToOne(
    () => {
      const { User } = require('./User')
      return User
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
