import NodeDatabase from './NodeDatabase'

export class NodeDatabaseService {
  private readonly db: NodeDatabase

  constructor (db: NodeDatabase) {
    this.db = db
  }
}
