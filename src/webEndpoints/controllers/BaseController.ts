import * as Router from 'koa-router'

export class BaseController {

  handler(value: string,message: string) : void {
  console.log("Receive new message %o ", value)
}

  public router(): Router {
    const router = new Router()
    const namespace = `/api`
    let mqtt_cl = require('../../mqtt/Mqtt_client')

    /* configure endpoints
    */

    // example: remove after implementation
    router.get(`${namespace}/hello`, (ctx: Router.IRouterContext) => {
    const mqtt = new mqtt_cl.ClientMQTT()
    mqtt.add_handler(this.handler)
    mqtt.start()
      this.setCorsHeaders(ctx);
      ctx.response.body = 'Hello!'
    })

    return router
  }

  setCorsHeaders (ctx: Router.IRouterContext) {
    ctx.response.set('Access-Control-Allow-Origin', '*')
    ctx.response.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    ctx.response.set('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, HEAD, OPTIONS')
    ctx.response.status = 200
  }
}
