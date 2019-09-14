import { Entity, BaseEntity, PrimaryGeneratedColumn, Column, PrimaryColumn } from 'typeorm'

@Entity()
export class Cell extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({unique: true})
  ethAddress!: string

  @Column()
  type!: "producer" | "consumer" | "prosumer" | "operator"

  @Column()
  name!: string

  @Column({type: 'real'})
  balance!: number

  @Column({array: true, type: 'real', nullable: true})
  initPower?: number[]

  @Column({array: true, type: 'real', nullable: true})
  initPrice?: number[]

  @Column({type: 'real', nullable: true})
  margin?: number

  @Column({type: 'real', nullable: true})
  opCoef?: number

  @Column({unique: true})
  mrid!: string
}
