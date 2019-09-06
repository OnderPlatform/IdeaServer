import * as Koa from 'koa'
import * as http from 'http'
import * as bodyParser from 'koa-bodyparser'
import * as session from 'koa-session'
import * as Router from 'koa-router'
import { HttpService } from './HttpService'
import * as koaLogger from 'koa-logger'
import Logger from '@machinomy/logger'

const log = new Logger('mpp:contracts:http-endpoint')

export default class HttpEndpoint {
  private readonly app: Koa
  private readonly port: number
  private readonly httpService: HttpService

  private server?: http.Server

  constructor (port: number, httpService: HttpService) {
    this.httpService = httpService

    this.app = new Koa()
    this.app.use(koaLogger((str: any, args: any) => {
      log.info(str, args)
    }))
    this.app.use(session({
      maxAge: 86400000
    }, this.app))
    this.app.use(bodyParser())

    let router = new Router()

    router.get('/balance', this.balance.bind(this))
    router.post('/timestamp/check', this.postCheckTimestamp.bind(this))
    router.post('/timestamp/add', this.postAddTimestamp.bind(this))

    this.app.use(router.routes()).use(router.allowedMethods())
    this.port = port
  }

  async postAddTimestamp (ctx: Router.IRouterContext) {
    const body = ctx.request.body as any

    try {
      const txInfo = await this.httpService.addTimestampWithCheck(body)
      ctx.response.body = {
        txHash: txInfo.txHash,
        blockNumber: txInfo.blockNumber,
        dataHash: txInfo.dataHash
      }
      ctx.status = 200
    } catch (e) {
      console.error(e)
      ctx.status = 400
    }
  }

  async postCheckTimestamp (ctx: Router.IRouterContext) {
    const body = ctx.request.body as any

    try {
      const result = await this.httpService.checkTimestampWithCheck(body)
      if (result) {
        ctx.status = 200
        ctx.response.body = result
      } else {
        ctx.status = 404
      }
    } catch (e) {
      console.error(e)
      ctx.status = 400
    }
  }

  async balance (ctx: Router.IRouterContext) {
    const response = await this.httpService.account()
    if (response) {
      ctx.status = 200
      ctx.response.body = response
    } else {
      ctx.status = 400
    }
  }

  async listen (): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let server = this.app.listen(this.port, () => {
        this.server = server
        console.log('listen on port %d', this.port)
        resolve()
      })
      server.setTimeout(600000)
      this.app.onerror = error => {
        reject(error)
      }
    })
  }

  async close (): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.server) {
        this.server.close((error: any) => {
          if (error) {
            reject(error)
          } else {
            this.server = undefined
            resolve()
          }
        })
      } else {
        reject(new Error('HttpEndpoint is not running'))
      }
    })
  }
}
