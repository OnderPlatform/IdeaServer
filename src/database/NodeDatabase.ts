import { Connection, ConnectionOptions, createConnection } from 'typeorm'
import { NodeDatabaseService } from './NodeDatabaseService'
import * as mqll_cl from '../mqtt/Mqtt_client'

export default class NodeDatabase {
  public service!: NodeDatabaseService
  public readonly mqtt: mqll_cl.ClientMQTT
  private readonly options: ConnectionOptions
  private connection!: Connection

  constructor(options: ConnectionOptions, mqtt: mqll_cl.ClientMQTT) {
    this.options = options
    this.mqtt = mqtt
  }

  async initConnection(): Promise<void> {
    await this.getConnection()
    this.service = new NodeDatabaseService(this)
  }

  async getConnection(): Promise<Connection> {
    if (!this.connection) {
      this.connection = await createConnection(this.options)
    }
    return Promise.resolve(this.connection)
  }
}
