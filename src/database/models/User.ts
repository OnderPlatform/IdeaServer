import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm'
import { Cell } from "./Cell";

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  email!: string

  @Column()
  password!: string

  @OneToOne(type => Cell)
  @JoinColumn()
  cell!: Cell

  @Column({default: false})
  isAdmin!: boolean

  @Column({type: "date", nullable: true})
  lastCheckDate?: string
}
