import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm'

export enum UserRole {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  USER = 'user',
}

@Entity('users')
@Index('idx_username', ['username'], { unique: true })
@Index('idx_email', ['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 255, unique: true })
  username!: string

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @OneToMany(
    () => {
      const { AuditLog } = require('./AuditLog')
      return AuditLog
    },
    (auditLog: any) => auditLog.user
  )
  auditLogs!: any[]

  @OneToMany(
    () => {
      const { PendingUserRequest } = require('./PendingUserRequest')
      return PendingUserRequest
    },
    (request: any) => request.requestedBy
  )
  requestedUserRequests!: any[]

  @OneToMany(
    () => {
      const { PendingUserRequest } = require('./PendingUserRequest')
      return PendingUserRequest
    },
    (request: any) => request.approvedBy
  )
  approvedUserRequests!: any[]

  @OneToMany(
    () => {
      const { PendingUserRequest } = require('./PendingUserRequest')
      return PendingUserRequest
    },
    (request: any) => request.rejectedBy
  )
  rejectedUserRequests!: any[]
}
