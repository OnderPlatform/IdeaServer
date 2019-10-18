import * as Koa from 'koa'
import * as http from 'http'
import { BaseController } from './controllers/BaseController'
import NodeDatabase from "../database/services/NodeDatabase";
import bodyParser = require('koa-bodyparser');
import koaLogger = require('koa-logger');
const cors = require('@koa/cors');

export default class WebServer {
  public readonly db: NodeDatabase
  private readonly port: number
  private readonly host: string
  private readonly app: Koa
  private readonly server: http.Server

  constructor(port: number, host: string, db: NodeDatabase) {
    this.app = new Koa()
    this.port = port
    this.host = host
    this.db = db

    this.configureRouters()
    this.app.use(koaLogger((str, args) => {
    }))
    this.app.use(bodyParser())

    this.server = http.createServer(this.app.callback())
  }

  async start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server.listen(this.port, this.host, () => {
        resolve()
      })
    })
  }

  private configureRouters(): void {
    const controller = new BaseController(this.db)
    const router = controller.router()
    this.app.use(cors())
    this.app.use(router.routes()).use(router.allowedMethods())
  }
}
