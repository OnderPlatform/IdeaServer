import WebServer from './webEndpoints/WebServer'
import NodeDatabase from './database/NodeDatabase'

export default class Application {

  private readonly web: WebServer
  private readonly db: NodeDatabase

  constructor () {
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
    })
    this.web = new WebServer(8888, 'localhost', this.db)
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
    await this.db.service.fetchDataFromAMIGO() //todo: CALL THIS FUNCTION EVERY 15 MINUTES
  }
}
