import * as Router from 'koa-router'
import * as fs from 'fs';
import * as cron from 'node-cron'
import * as koaBody from 'koa-body'
import NodeDatabase from "../../database/NodeDatabase";

export class BaseController {
  public readonly db: NodeDatabase


  constructor(db: NodeDatabase) {
    this.db = db
  }



  handler(value: string, message: string): void {
    console.log("Receive new message %o ", value)
  }

  public router(): Router {
    const router = new Router()
    const namespace = `/api`
    let mqtt_cl = require('../../mqtt/Mqtt_client')
    let excel = require('../../excel/xlsx')


    var workerpool = require('workerpool');

// create a worker pool using an the asyncWorker. This worker contains
// asynchronous functions.
    var pool = workerpool.pool('./src/workers/asyncWorker.js');


    /* configure endpoints
    */

    // example: remove after implementation
    router.get(`${namespace}/admin/transaction`, this.getAdminTransactions.bind(this))
    router.get(`${namespace}/admin/consumption`, this.getAdminConsumptions.bind(this))
    router.get(`${namespace}/admin/production`, this.getAdminProductions.bind(this))
    router.get(`${namespace}/admin/anchor`, this.getAdminAnchors.bind(this))
    router.post(`${namespace}/login`, koaBody(), this.postLogin.bind(this))
    router.get(`${namespace}/admin/excel/energy`, this.getAdminExcelEnergy.bind(this))
    router.get(`${namespace}/admin/excel/transaction`, this.getAdminExcelTransaction.bind(this))
    router.post(`${namespace}/margin`, koaBody(), this.postUserMargin.bind(this))
    router.get(`${namespace}/consumption`, this.getUserConsumptions.bind(this))
    router.get(`${namespace}/production`, this.getUserProductions.bind(this))
    router.get(`${namespace}/transaction`, this.getUserTransactions.bind(this))
    router.get(`${namespace}/anchor`, this.getUserAnchors.bind(this))
    router.post(`${namespace}/price`, koaBody(), this.postUserPrice.bind(this))
    router.get(`${namespace}/excel/energy`, this.getUserExcelEnergy.bind(this))
    router.get(`${namespace}/excel/transaction`, this.getUserExcelTransaction.bind(this))
    router.get(`${namespace}/hello`, (ctx: Router.IRouterContext) => {


      // pool.proxy()
      //     .then((worker: any) => {
      //       return worker.asyncAdd(3, 4.1);
      //     })
      //     .then((result: any) => {
      //       console.log(result);
      //     })
      //     .catch((err: any) => {
      //       console.error(err);
      //     })
      //     .then(() => {
      //       pool.terminate(); // terminate all workers when done
      //     });


//  publishProgress(enode: number,contractID: number,amount: number, seller: string, contragent: string,delta: number)
      const mqtt = new mqtt_cl.ClientMQTT()
      mqtt.add_handler(this.handler)
      mqtt.start()
      this.setCorsHeaders(ctx)
      ctx.response.body = 'Hello!'
      excel.parse()
      mqtt.publishProgress(1, 1, 200, "Enode1", "Enode2", 12.5)
      cron.schedule("* * * * *", function () {
        console.log("running a task every minute");
      });
    })

    router.get('/download', async function (ctx) {
      const fileName = `./result.xlsx`;
      try {
        if (fs.existsSync(fileName)) {
          ctx.body = fs.createReadStream(fileName);
          ctx.attachment(fileName);
        } else {
          ctx.throw(400, "Requested file not found on server");
        }
      } catch (error) {
        ctx.throw(500, error);
      }
    });

    return router
  }

  setCorsHeaders(ctx: Router.IRouterContext) {
    ctx.response.set('Access-Control-Allow-Origin', '*')
    ctx.response.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    ctx.response.set('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, HEAD, OPTIONS')
    ctx.response.status = 200
  }

  async getAdminTransactions(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    ctx.response.body = await this.db.service.adminTransactions()
    ctx.response.status = 200
  }

  async getAdminConsumptions(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    ctx.response.body = await this.db.service.adminConsumptions()
    ctx.response.status = 200
  }

  async getAdminProductions(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    ctx.response.body = await this.db.service.adminProductions()
    ctx.response.status = 200
  }

  async postLogin(ctx: Router.IRouterContext) {
    try {
      const body = JSON.parse(ctx.request.body as string)
      if (body) {
          if (await this.db.service.authorization(body)) {
            ctx.response.status = 202
          } else {
            ctx.response.status = 401
          }
      } else {
        ctx.response.status = 400
      }
    } catch (e) {
      console.log('Error while auth. Error message: ', e);
    }
  }

  getAdminExcelEnergy(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    ctx.response.status = 501
  }

  getAdminExcelTransaction(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    ctx.response.status = 501
  }

  async getAdminAnchors(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    ctx.response.body = await this.db.service.adminAnchor()
    ctx.response.status = 200
  }

  async postUserMargin(ctx: Router.IRouterContext) {
    const who = '0xc29b08e2ca18a000000000000' //todo: find out who is it
    try {
      const body = JSON.parse(ctx.request.body as string)
      await this.db.service.userMargin(body.margin, who)
      ctx.response.status = 201
    } catch (e) {
      console.log(e);
    }
  }

  async getUserConsumptions(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    const who = '0xc29b08e2ca18a000000000000' //todo: find out who is it
    ctx.response.body = await this.db.service.userConsumption(who)
    ctx.response.status = 200
  }

  async getUserProductions(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    const who = '0xc29b08e2ca18a000000000000' //todo: find out who is it
    ctx.response.body = await this.db.service.userProduction(who)
    ctx.response.status = 200
  }

  async getUserTransactions(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    const who = '0xc29b08e2ca18a000000000000' //todo: find out who is it
    ctx.response.body = await this.db.service.userTransactions(who)
    ctx.response.status = 200
  }

  async getUserAnchors(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    const who = '0xc29b08e2ca18a000000000000' //todo: find out who is it
    ctx.response.body = await this.db.service.userAnchor(who)
    ctx.response.status = 200
  }

  getUserExcelEnergy(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    const who = '0xc29b08e2ca18a000000000000' //todo: find out who is it
    ctx.response.status = 501
  }

  getUserExcelTransaction(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    const who = '0xc29b08e2ca18a000000000000' //todo: find out who is it
    ctx.response.status = 501
  }

  async postUserPrice(ctx: Router.IRouterContext) {
    const who = '0xc29b08e2ca18a000000000000' //todo: find out who is it
    try {
      const body = JSON.parse(ctx.request.body as string)
      await this.db.service.postPrices(body, who)
      ctx.response.status = 201
    } catch (e) {
      console.log(e);
    }

  }


}
