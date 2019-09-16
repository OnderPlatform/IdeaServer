import * as Router from 'koa-router'
import * as fs from 'fs';
import * as cron from 'node-cron'
import * as koaBody from 'koa-body'
import NodeDatabase from "../../database/NodeDatabase";
import * as jwt from "jsonwebtoken";
import { getRepository } from "typeorm";
import { validate } from "class-validator";
import { User } from "../../database/models/User";
import config from "../../config/config";

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
    router.post(`${namespace}/login`, koaBody(), this.login.bind(this))
    router.post(`${namespace}/margin`, koaBody(), this.postUserMargin.bind(this))
    router.get(`${namespace}/consumption`, this.getUserConsumptions.bind(this))
    router.get(`${namespace}/production`, this.getUserProductions.bind(this))
    router.get(`${namespace}/transaction`, this.getUserTransactions.bind(this))
    router.get(`${namespace}/excel/energy`, this.getUserExcelEnergy.bind(this))
    router.get(`${namespace}/excel/transaction`, this.getUserExcelTransaction.bind(this))
    router.get(`${namespace}/anchor`, this.getUserAnchors.bind(this))
    router.post(`${namespace}/price`, koaBody(), this.postUserPrice.bind(this))
    router.post(`${namespace}/newuser`, koaBody(), this.newUser.bind(this))
    router.get(`${namespace}/alluser`, this.listAll.bind(this))

    router.get(`${namespace}/hello`, (ctx: Router.IRouterContext) => {
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
    //ctx.response.set('Access-Control-Allow-Origin', '*')
    ctx.response.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    ctx.response.set('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, HEAD, OPTIONS')
    ctx.response.status = 200
  }

  async findEthAddressByEmail(email: string): Promise<string> {
    const cell = await this.db.service.userRepository.findOneOrFail({
      where: {
        email: email
      },
      relations: ['cell']
    })
    return cell.cell.ethAddress
  }

  async getAdminTransactions(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    ctx.response.body = await this.db.service.adminTransactions()
    ctx.response.status = 200
  }

  async getAdminConsumptions(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    ctx.response.body = await this.db.service.adminConsumptions()
    ctx.response.status = 200
  }

  async getAdminProductions(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    ctx.response.body = await this.db.service.adminProductions()
    ctx.response.status = 200
  }

  // async postLogin(ctx: Router.IRouterContext) {
  //   try {
  //     const body = JSON.parse(ctx.request.body as string)
  //     if (body) {
  //         if (await this.db.service.authorization(body)) {
  //           ctx.response.status = 202
  //         } else {
  //           ctx.response.status = 401
  //         }
  //     } else {
  //       ctx.response.status = 400
  //     }
  //   } catch (e) {
  //     console.log('Error while auth. Error message: ', e);
  //   }
  // }

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
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    ctx.response.body = await this.db.service.adminAnchor()
    ctx.response.status = 200
  }

  async postUserMargin(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const body = JSON.parse(ctx.request.body as string)
      await this.db.service.userMargin(body.margin, who)
      ctx.response.status = 201
    } catch (e) {
      console.log(e);
    }
  }

  async getUserConsumptions(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const user = await this.db.service.userRepository.findOneOrFail({
        where: {
          email: <string>ctx.request.headers['from']
        }
      })
      const isAdmin = user.isAdmin

      if (isAdmin) {
        const params = new URLSearchParams(ctx.request.querystring)
        const discoveringuser = params.get('ethId')
        if (discoveringuser) {
          ctx.response.body = await this.db.service.userConsumption(discoveringuser)
        } else {
          ctx.response.body = await this.db.service.adminConsumptions()
        }
      }
      else {
        ctx.response.body = await this.db.service.userConsumption(who)
      }
      ctx.response.status = 200
    } catch (e) {
      console.log(e);
    }
  }

  async getUserProductions(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const user = await this.db.service.userRepository.findOneOrFail({
        where: {
          email: <string>ctx.request.headers['from']
        }
      })
      const isAdmin = user.isAdmin
      if (isAdmin) {
        const params = new URLSearchParams(ctx.request.querystring)
        const discoveringuser = params.get('ethId')
        if (discoveringuser) {
          ctx.response.body = await this.db.service.userProduction(discoveringuser)
        } else {
          ctx.response.body = await this.db.service.adminProductions()
        }
      } else {
        ctx.response.body = await this.db.service.userProduction(who)
      }


      ctx.response.status = 200
    } catch (e) {
      console.log(e);
    }
  }

  async getUserTransactions(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const user = await this.db.service.userRepository.findOneOrFail({
        where: {
          email: <string>ctx.request.headers['from']
        }
      })
      const isAdmin = user.isAdmin
      if (isAdmin) {
        const params = new URLSearchParams(ctx.request.querystring)
        const discoveringuser = params.get('ethId')
        if (discoveringuser) {
          ctx.response.body = await this.db.service.userTransactions(discoveringuser)
        } else {
          ctx.response.body = await this.db.service.adminTransactions()
        }
      } else {
        ctx.response.body = await this.db.service.userTransactions(who)
      }


      ctx.response.status = 200
    } catch (e) {
      console.log(e);
    }
  }

  async getUserAnchors(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const user = await this.db.service.userRepository.findOneOrFail({
        where: {
          email: <string>ctx.request.headers['from']
        }
      })
      const isAdmin = user.isAdmin
      if (isAdmin) {
        const params = new URLSearchParams(ctx.request.querystring)
        const discoveringuser = params.get('ethId')
        if (discoveringuser) {
          ctx.response.body = await this.db.service.userAnchor(discoveringuser)
        } else {
          ctx.response.body = await this.db.service.adminAnchor()
        }
      } else {
        ctx.response.body = await this.db.service.userAnchor(who)
      }


      ctx.response.status = 200
    } catch (e) {
      console.log(e);
    }
  }

  async getUserExcelEnergy(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      ctx.response.status = 501
    } catch (e) {
      console.log(e);
    }

  }

  async getUserExcelTransaction(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      ctx.response.status = 501
    } catch (e) {
      console.log(e);
    }

  }

  async postUserPrice(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const body = JSON.parse(ctx.request.body as string)
      await this.db.service.postPrices(body, who)
      ctx.response.status = 201
    } catch (e) {
      console.log(e);
    }

  }

  async login(ctx: Router.IRouterContext){
    try {
      // const body = JSON.parse( as string)
      console.log(ctx.request.body.email);
    } catch (e) {
      console.log(e);
    }
    //Check if email and password are set
    let email = ctx.request.body.email
    let password = ctx.request.body.password
    if (!(email && password)) {
        ctx.response.status = 400
    }

    //Get user from database
    const userRepository = getRepository(User);
    let user: User | undefined;

      try {
        user = await userRepository.findOneOrFail({ where: { email } });
      } catch (error) {
          ctx.response.status = 401
      }
        var token = ""
      if(user != undefined && user.password==password) {
        if(user.isAdmin) {
      //Sing JWT, valid for 1 hour
        token = jwt.sign(
          { userId: user.id, email: user.email },
          config.adminSecret,
          { expiresIn: "10m" }
        );

        console.log("admin")
      } else {
        token = jwt.sign(
          { userId: user.id, email: user.email },
          user.email,
          { expiresIn: "10m" }
      );
        console.log("user")}


        //Try to validate the token and get data


        //Send the jwt in the response
      ctx.response.body = token
    }

  };


  async newUser(ctx: Router.IRouterContext) {
    //Get parameters from the body
    let email = ctx.request.body.email
    let password = ctx.request.body.password
    let isAdmin = ctx.request.body.isAdmin
    if (!(email && password)) {
      ctx.response.status = 400
    }
    let user = new User();
    user.email = email;
    user.password = password;
    user.isAdmin = isAdmin;

    //Validade if the parameters are ok
    const errors = await validate(user);
    if (errors.length > 0) {
      ctx.response.status = 400
      return;
    }

    //Try to save. If fails, the email is already in use
    const userRepository = getRepository(User);
    try {
      await userRepository.save(user);
    } catch (e) {
      ctx.response.status = 409
      return;
    }

    //If all ok, send 201 response
    ctx.response.status = 201
  };

  async listAll(ctx: Router.IRouterContext) {

    // const { userId, username } = jwtPayload;
    // const newToken = jwt.sign({ userId, username }, config.jwtSecret, {
    //   expiresIn: "1h"
    //eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjExLCJlbWFpbCI6InJ1c2xhbndlZiIsImlhdCI6MTU2ODMzODE3MSwiZXhwIjoxNTY4MzQxNzcxfQ.RCoaFQe4VXRoMq0zO-oc9cY3jAE-o8hlKrGpe1S7rwg
    // ctx.response.setHeader("token", newToken);
    //Get users from database
    const userRepository = getRepository(User);
    const users = await userRepository.find({
      select: ["id", "email", "password", "isAdmin"] //We dont want to send the passwords on response
    });

    //Send the users object
    ctx.response.body = users
  }


}

async function check(ctx: Router.IRouterContext) {
  const token = <string>ctx.request.headers["auth"];
  const email = <string>ctx.request.headers["from"];
      console.log("email - " + email + " auth - " + token)
  let jwtPayload;
  const userRepository = getRepository(User);
const user = await userRepository.findOneOrFail({
  where: {
    email: email
  }
})
  //Try to validate the token and get data
  try {


    if(user.isAdmin) {      jwtPayload = <any>jwt.verify(token, config.adminSecret);
          //ctx.res.locals.jwtPayload = jwtPayload;
          console.log("admin - " + token)}
    else {
      jwtPayload = <any>jwt.verify(token, email);
      //ctx.res.locals.jwtPayload = jwtPayload;
      console.log("user - " + email)
    }

  } catch (error) {
    //If token is not valid, respond with 401 (unauthorized)
  ctx.response.status = 401
    return;
  }

}
