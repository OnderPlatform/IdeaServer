import { CellRepository } from "../repositories/CellRepository";
import { getCustomRepository } from "typeorm";
import { TradeRepository } from "../repositories/TradeRepository";
import { TransactionRepository } from "../repositories/TransactionRepository";
import { UserRepository } from "../repositories/UserRepository";
import { AnchorRepository } from "../repositories/AnchorRepository";

export class NodeDatabaseRepositories {
  public readonly cellRepository: CellRepository = getCustomRepository(CellRepository)
  public readonly tradeRepository: TradeRepository = getCustomRepository(TradeRepository)
  public readonly transactionRepository: TransactionRepository = getCustomRepository(TransactionRepository)
  public readonly userRepository: UserRepository = getCustomRepository(UserRepository)
  public readonly anchorRepository: AnchorRepository = getCustomRepository(AnchorRepository)
}
