import { EntityRepository, Repository } from 'typeorm'
import { Transaction } from '../models'

@EntityRepository(Transaction)
export class TransactionRepository extends Repository<Transaction> {

}
