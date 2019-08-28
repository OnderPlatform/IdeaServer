import { Entity, BaseEntity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity()
export class EntityExample extends BaseEntity {
    @PrimaryGeneratedColumn()
    entityId!: string
}