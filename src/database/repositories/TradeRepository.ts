import { EntityRepository, Repository } from 'typeorm'
import { Trade } from '../models'

@EntityRepository(Trade)
export class TradeRepository extends Repository<Trade> {

}
