import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import DateTimeFormat = Intl.DateTimeFormat;
import { Cell } from "./Cell";

@Entity()
export class Transaction extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({type: 'timestamptz'})
  time!: Date

  @ManyToOne(type => Cell, cell => cell.id)
  from!: Cell

  @ManyToOne(type => Cell, cell => cell.id)
  to!: Cell

  @Column({type: 'real'})
  price!: number

  @Column({type: 'real'})
  amount!: number

  @Column({type: 'real'})
  cost!: number

  @Column({nullable: true})
  approved?: boolean

  @Column({default: false})
  sentToMqtt!: boolean
}
