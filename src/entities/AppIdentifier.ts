import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm'

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


  @OneToMany(
    () => {
      // Lazy load to break circular dependency
      const { AppSuccessRate } = require('./AppSuccessRate')
      return AppSuccessRate
    },
    (appSuccessRate: any) => appSuccessRate.appIdentifier
  )
  appSuccessRates!: any[]

  @OneToMany(
    () => {
      const { ResponseCodeDictionary } = require('./ResponseCodeDictionary')
      return ResponseCodeDictionary
    },
    (dictionary: any) => dictionary.appIdentifier
  )
  responseCodeDictionaries!: any[]

  @OneToMany(
    () => {
      const { UnmappedRc } = require('./UnmappedRc')
      return UnmappedRc
    },
    (unmappedRc: any) => unmappedRc.appIdentifier
  )
  unmappedRcs!: any[]
}
