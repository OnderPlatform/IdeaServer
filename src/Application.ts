import WebServer from './webEndpoints/WebServer'
import NodeDatabase from './database/NodeDatabase'
import * as mqtt_cl from './mqtt/Mqtt_client'
import * as cron from 'node-cron'
import config from "./config/config";


export default class Application {
  private readonly web: WebServer
  private readonly db: NodeDatabase
  private readonly mqtt: mqtt_cl.ClientMQTT

  fetchingData = async () => {
   await this.db.service.fetchDataFromAMIGO() //todo: CALL THIS FUNCTION EVERY 15 MINUTES
   await this.db.service.sendNewTransactionsToMQTT() //todo: CALL THIS FUNCTION AFTER PREVIOUS
 }

 postData = async () => {
    await this.db.service.makePostRequest()
}
  constructor () {
    this.mqtt = new mqtt_cl.ClientMQTT()
    this.db = new NodeDatabase({
      'type': 'postgres',
      'host':  config.hostDB,
      'port': config.portDB,
      'username': config.usernameDB,
      'password': config.passwordDB,
      'database': config.databaseName,
      'synchronize': true,
      'logging': false,
      'entities': [
        'dist/database/models/**/*.js'
      ]
    }, this.mqtt)
    this.web = new WebServer(config.serverPort, config.serverUrl, this.db)
  }

  async start (): Promise<void> {
    await this.web.start()
    await this.db.initConnection()
    // await this.db.service.initMockData()
    const tmp = await this.db.service.cellRepository.find()
    if (!tmp.length) {
      await this.db.service.fetchInitialDataFromAMIGO()
      await this.db.service.initialDataForOperator()
    }

    this.mqtt.add_handler(this.db.service.newTransactionStateFromMQTT)
    this.mqtt.start()
    console.log("post data cron")
          this.postData()
    // await this.db.service.fetchDataFromAMIGO() //todo: CALL THIS FUNCTION EVERY 15 MINUTES
    // await this.db.service.sendNewTransactionsToMQTT() //todo: CALL THIS FUNCTION AFTER PREVIOUS


//TODO call specific function
cron.schedule('0 */15 * * * *', () => {
console.log("fetch data cron")
this.fetchingData()
});
    cron.schedule("0 0 0 * * *'", () => {
console.log("post data cron")
      this.postData()
    });

//v
  }
}
