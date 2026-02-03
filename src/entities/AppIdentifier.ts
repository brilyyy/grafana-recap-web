import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm'
import { AppSuccessRate } from './AppSuccessRate'
import { ResponseCodeDictionary } from './ResponseCodeDictionary'
import { UnmappedRc } from './UnmappedRc'

@Entity('app_identifier')
export class AppIdentifier {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 255, unique: true })
  appName!: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  // Relations
  @OneToMany(() => AppSuccessRate, (appSuccessRate) => appSuccessRate.appIdentifier)
  appSuccessRates!: AppSuccessRate[]

  @OneToMany(() => ResponseCodeDictionary, (dictionary) => dictionary.appIdentifier)
  responseCodeDictionaries!: ResponseCodeDictionary[]

  @OneToMany(() => UnmappedRc, (unmappedRc) => unmappedRc.appIdentifier)
  unmappedRcs!: UnmappedRc[]
}
