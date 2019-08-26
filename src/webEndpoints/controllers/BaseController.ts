import * as Router from 'koa-router'

export class BaseController {

  public router(): Router {
    const router = new Router()
    const namespace = `/api`

    /* configure endpoints
    */

    // example: remove after implementation
    router.get(`${namespace}/hello`, (ctx: Router.IRouterContext) => {
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
