import { createConnection, Connection, ConnectionOptions } from 'typeorm'
import { NodeDatabaseService } from './NodeDatabaseService'
import {LoggerManager} from 'typescript-logger'
import * as mqll_cl from '../mqtt/Mqtt_client'

export default class NodeDatabase {
  private readonly options: ConnectionOptions
  private connection!: Connection
  public service!: NodeDatabaseService
  public readonly mqtt: mqll_cl.ClientMQTT

  constructor (options: ConnectionOptions, mqtt: mqll_cl.ClientMQTT) {
    this.options = options
    this.mqtt = mqtt
  }

  async initConnection (): Promise<void> {
    await this.getConnection()
    this.service = new NodeDatabaseService(this)
  }

  async getConnection (): Promise<Connection> {
    if (!this.connection) {
      this.connection = await createConnection(this.options)
    }
    return Promise.resolve(this.connection)
  }
}
