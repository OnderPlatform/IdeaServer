import { Entity, BaseEntity, PrimaryGeneratedColumn, Column, PrimaryColumn, ManyToOne } from 'typeorm'
import { User } from "./User";

@Entity()
export class Anchor extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(type => User, user => user.id)
  user!: User

  @Column({type: 'bigint'})
  time!: number

  @Column()
  hashId!: string

  @Column()
  address!: string

  @Column({type: 'timestamptz', default: 'now()'})
  lastCheckingDate!: string
}
