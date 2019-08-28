import WebServer from "./webEndpoints/WebServer";
import NodeDatabase from "./database/NodeDatabase";
import {NodeDatabaseService} from "./database/NodeDatabaseService";

export default class Application {

  private readonly web: WebServer
  private readonly db: NodeDatabase
  private readonly dbService: NodeDatabaseService

  constructor() {
      this.web = new WebServer(8888, 'localhost')
      this.db = new NodeDatabase({
          "type": "postgres",
          "host": "localhost",
          "port": 5432,
          "username": "postgres",
          "password": "postgres",
          "database": "ideaServer",
          "synchronize": true,
          "logging": false,
          "entities": [
              "dist/database/models/**/*.js"
          ]
      })
      this.dbService = new NodeDatabaseService(this.db)
  }

  async start (): Promise<void> {
      await this.web.start()
      await this.db.initConnection()
  }
}
