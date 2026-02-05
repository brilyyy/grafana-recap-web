import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm'

@Entity('audit_logs')
@Index('idx_user_id', ['user'])
@Index('idx_action', ['action'])
@Index('idx_resource_type', ['resourceType'])
@Index('idx_created_at', ['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number

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
  @JoinColumn({ name: 'user_id' })
  user!: any

  @Column({ name: 'user_id', nullable: true })
  userId!: number | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  username!: string | null

  @Column({ type: 'varchar', length: 255 })
  action!: string

  @Column({ type: 'varchar', length: 255, name: 'resource_type' })
  resourceType!: string

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'resource_id' })
  resourceId!: string | null

  @Column({ type: 'text', nullable: true })
  details!: string | null

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress!: string | null

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent!: string | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
