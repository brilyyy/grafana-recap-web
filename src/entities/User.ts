import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm'
import { AuditLog } from './AuditLog'
import { PendingUserRequest } from './PendingUserRequest'

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

  // Relations
  @OneToMany(() => AuditLog, (auditLog) => auditLog.user)
  auditLogs!: AuditLog[]

  @OneToMany(() => PendingUserRequest, (request) => request.requestedBy)
  requestedUserRequests!: PendingUserRequest[]

  @OneToMany(() => PendingUserRequest, (request) => request.approvedBy)
  approvedUserRequests!: PendingUserRequest[]

  @OneToMany(() => PendingUserRequest, (request) => request.rejectedBy)
  rejectedUserRequests!: PendingUserRequest[]
}
