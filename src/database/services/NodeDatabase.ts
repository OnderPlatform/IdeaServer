import { Connection, ConnectionOptions, createConnection } from 'typeorm'
import { NodeDatabaseServiceRoot } from './NodeDatabaseServiceRoot'
import * as mqll_cl from '../../mqtt/Mqtt_client'

export default class NodeDatabase {
  public service!: NodeDatabaseServiceRoot
  private readonly options: ConnectionOptions
  private connection!: Connection

  constructor(options: ConnectionOptions) {
    this.options = options
  }

  async initConnection(): Promise<void> {
    await this.getConnection()
    this.service = new NodeDatabaseServiceRoot()
  }

  async getConnection(): Promise<Connection> {
    if (!this.connection) {
      this.connection = await createConnection(this.options)
    }
    return Promise.resolve(this.connection)
  }
}
