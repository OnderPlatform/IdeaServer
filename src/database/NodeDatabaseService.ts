import NodeDatabase from './NodeDatabase'
import {LoggerManager} from 'typescript-logger'

export class NodeDatabaseService {
  private readonly db: NodeDatabase

  constructor (db: NodeDatabase) {
    this.db = db
  }

}
