import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm'

export enum ErrorType {
  S = 'S',
  N = 'N',
  SUKSES = 'Sukses',
}

@Entity('app_success_rate')
@Index('idx_tanggal_transaksi', ['tanggalTransaksi'])
@Index('idx_id_app_identifier', ['appIdentifier'])
export class AppSuccessRate {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(
    () => {
      const { AppIdentifier } = require('./AppIdentifier')
      return AppIdentifier
    },
    { nullable: false, onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'id_app_identifier' })
  appIdentifier!: any

  @Column({ name: 'id_app_identifier' })
  idAppIdentifier!: number

  @Column({ type: 'date', name: 'tanggal_transaksi' })
  tanggalTransaksi!: Date

  @Column({ type: 'varchar', length: 20 })
  bulan!: string

  @Column({ type: 'int' })
  tahun!: number

  @Column({ type: 'varchar', length: 255, name: 'jenis_transaksi' })
  jenisTransaksi!: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  rc!: string | null

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'rc_description' })
  rcDescription!: string | null

  @Column({ type: 'int', nullable: true, name: 'total_transaksi' })
  totalTransaksi!: number | null

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: true, name: 'total_nominal' })
  totalNominal!: number | null

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: true, name: 'total_biaya_admin' })
  totalBiayaAdmin!: number | null

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'status_transaksi' })
  statusTransaksi!: string | null

  @Column({ type: 'enum', enum: ErrorType, nullable: true, name: 'error_type' })
  errorType!: ErrorType | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
