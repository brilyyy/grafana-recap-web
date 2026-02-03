import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

@Entity('rate_limit_logs')
@Index('idx_ip_endpoint', ['ipAddress', 'endpoint'])
@Index('idx_blocked_at', ['blockedAt'])
export class RateLimitLog {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 45, name: 'ip_address' })
  ipAddress!: string

  @Column({ type: 'varchar', length: 255 })
  endpoint!: string

  @CreateDateColumn({ name: 'blocked_at' })
  blockedAt!: Date
}
