import { EntityRepository, Repository } from 'typeorm'
import { Anchor } from '../models'

@EntityRepository(Anchor)
export class AnchorRepository extends Repository<Anchor> {

}
