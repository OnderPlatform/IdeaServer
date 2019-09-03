import { EntityRepository, Repository } from 'typeorm'
import { Cell } from '../models'

@EntityRepository(Cell)
export class CellRepository extends Repository<Cell> {

}
