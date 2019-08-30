import { Entity, BaseEntity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm'
import { Cell } from "./Cell";

@Entity()
export class Trade extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(type => Cell, cell => cell.id)
  cell!: Cell

  @Column({type: 'timestamptz'})
  time!: string

  @Column({type: 'real', default: 0})
  price!: number

  @Column({type: 'real', nullable: true})
  energy?: number

  @Column({type: 'real', nullable: true})
  energyIn?: number

  @Column({type: 'real', nullable: true})
  energyOut?: number

  @Column({type: 'real', nullable: true})
  power?: number

  @Column({type: 'real', nullable: true})
  pay?: number

  @Column({nullable: true})
  pip?: boolean

  @Column({type: 'real', nullable: true})
  avPrice?: number

  @Column({type: 'real', nullable: true})
  energyInAll?: number

  @Column()
  type!: "producer" | "consumer" | "prosumer" | "operator"
}
