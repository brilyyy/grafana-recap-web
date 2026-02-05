import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, Index } from 'typeorm'
import { ErrorType } from './AppSuccessRate'

@Entity('response_code_dictionary')
@Unique('unique_dictionary_entry', ['appIdentifier', 'jenisTransaksi', 'rc'])
export class ResponseCodeDictionary {
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

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'jenis_transaksi' })
  jenisTransaksi!: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  rc!: string | null

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'rc_description' })
  rcDescription!: string | null

  @Column({ type: 'enum', enum: ErrorType, name: 'error_type' })
  errorType!: ErrorType
}
