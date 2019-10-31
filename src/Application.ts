import WebServer from './webEndpoints/WebServer'
import NodeDatabase from './database/services/NodeDatabase'
import * as cron from 'node-cron'
import config from "./config/config"

export default class Application {
  private readonly web: WebServer
  private readonly db: NodeDatabase


  constructor() {
    this.db = new NodeDatabase({
      'type': 'postgres',
      'host': config.hostDB,
      'port': config.portDB,
      'username': config.usernameDB,
      'password': config.passwordDB,
      'database': config.databaseName,
      'synchronize': true,
      'logging': false,
      'entities': [
        'dist/database/models/**/*.js'
      ]
    })
    this.web = new WebServer(config.serverPort, config.serverUrl, this.db)
  }

  fetchingData = async () => {
    await this.db.service.amigo.fetchAndHandleDataFromAMIGO()
    await this.db.service.amigo.sendPricesToAmigo()
  }

  sendProgress = async () => {
    await this.db.service.mqtt.sendNewTransactionToMQTT()
  }

  postData = async () => {
    await this.db.service.notarization.makePostRequest()
  }

  async start(): Promise<void> {
    await this.web.start()
    await this.db.initConnection()
    await this.db.service.amigo.start()
    this.db.service.mqtt.mqtt_cl.add_handler((value: string, message: string) => this.db.service.mqtt.newTransactionStateFromMQTT(value, message))
    this.db.service.mqtt.mqtt_cl.start()

    // console.log("post data cron")
    // this.postData()
    // this.fetchingData()

    // await this.db.service.amigo.fetchAndHandleDataFromAMIGO()

    cron.schedule('0 */15 * * * *', () => {
      console.log("fetch data cron")
      this.fetchingData()
    });
    cron.schedule("01 00 * * *", () => {
      console.log("post data cron")
      this.postData()
    })
    cron.schedule('*/5 * * * * *', () => {
      console.log('Sending progress to mqtt')
      this.sendProgress()
    })
  }
}
