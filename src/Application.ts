import WebServer from './webEndpoints/WebServer'
import NodeDatabase from './database/NodeDatabase'

export default class Application {

  private readonly web: WebServer
  private readonly db: NodeDatabase

  constructor () {
    this.web = new WebServer(8888, 'localhost')
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
  }

  async start (): Promise<void> {
    await this.web.start()
    await this.db.initConnection()
    await this.db.service.initMockData()
    await this.db.service.fetchDataFromAMIGO()
    const t = await this.db.service.userTransactions('0xc29b08e2ca18a000000000000')
    console.log(t);
  }
}
