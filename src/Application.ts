import WebServer from './webEndpoints/WebServer'
import NodeDatabase from './database/NodeDatabase'
import * as mqtt_cl from './mqtt/Mqtt_client'
import * as cron from 'node-cron'
import fetchMocks from './mockData/fetchDataFromAMIGO'

export default class Application {
  private readonly web: WebServer
  private readonly db: NodeDatabase
  private readonly mqtt: mqtt_cl.ClientMQTT

  constructor () {
    this.mqtt = new mqtt_cl.ClientMQTT()
    this.db = new NodeDatabase({
      'type': 'postgres',
      'host': 'localhost',
      'port': 5432,
      'username': 'postgres',
      'password': 'postgres',
      'database': 'ideaserver',
      'synchronize': true,
      'logging': false,
      'entities': [
        'dist/database/models/**/*.js'
      ]
    }, this.mqtt)
    this.web = new WebServer(8888, 'localhost', this.db)
  }

  async start (): Promise<void> {
    await this.web.start()
    await this.db.initConnection()
    // await this.db.service.initMockData()
    const tmp = await this.db.service.cellRepository.find()
    if (!tmp.length) {
      // await this.db.service.fetchInitialDataFromAMIGO()
      // await this.db.service.initialDataForOperator()
      await this.db.service.initMockData()
    }
    this.mqtt.add_handler(this.db.service.newTransactionStateFromMQTT)
    this.mqtt.start()
    setInterval(async () => {
      // await this.db.service.fetchDataFromAMIGO() // todo: CALL THIS FUNCTION EVERY 15 MINUTES
      const data = await fetchMocks('endpoint')
      await this.db.service.handleDataFromAMIGO(data)
      await this.db.service.sendNewTransactionsToMQTT() // todo: CALL THIS FUNCTION AFTER PREVIOUS
    }, 1000*15*60)

    // cron.schedule("* * * * *", function () {
    //   console.log("running a fetchDataFromAMIGO and sendNewTransactionsToMQTT every minute");

    // });
  }
}
