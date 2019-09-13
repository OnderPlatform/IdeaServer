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
    router.post(`${namespace}/auth/login`,koaBody(), this.login.bind(this));
    router.post(`${namespace}/newuser`,koaBody(), this.newUser.bind(this));
    router.get(`${namespace}/alluser`, this.listAll.bind(this))
    //router.post("/new/user",koaBody(), UserController.newUser);

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
      if(user != undefined && user.password==password) {
      //Sing JWT, valid for 1 hour
        const token = jwt.sign(
          { userId: user.id, email: user.email },
          config.jwtSecret,
          { expiresIn: "10m" }
        );


        //Try to validate the token and get data


        //Send the jwt in the response
      ctx.response.body = token
    }

  };


  async newUser(ctx: Router.IRouterContext){
    //Get parameters from the body
    let email = ctx.request.body.email
    let password = ctx.request.body.password
    if (!(email && password)) {
        ctx.response.status = 400
    }
    let user = new User();
    user.email = email;
    user.password = password;

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

  async listAll(ctx: Router.IRouterContext){

    check(ctx)

    // const { userId, username } = jwtPayload;
    // const newToken = jwt.sign({ userId, username }, config.jwtSecret, {
    //   expiresIn: "1h"
    //eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjExLCJlbWFpbCI6InJ1c2xhbndlZiIsImlhdCI6MTU2ODMzODE3MSwiZXhwIjoxNTY4MzQxNzcxfQ.RCoaFQe4VXRoMq0zO-oc9cY3jAE-o8hlKrGpe1S7rwg
    // ctx.response.setHeader("token", newToken);
    //Get users from database
    const userRepository = getRepository(User);
    const users = await userRepository.find({
      select: ["id", "email", "password"] //We dont want to send the passwords on response
    });

    //Send the users object
    ctx.response.body = users
  }


}

  function check(ctx: Router.IRouterContext) {
    const token = <string>ctx.request.headers["auth"];
    let jwtPayload;

    //Try to validate the token and get data
    try {
      jwtPayload = <any>jwt.verify(token, config.jwtSecret);
      //ctx.res.locals.jwtPayload = jwtPayload;
      console.log(token)
    } catch (error) {
      //If token is not valid, respond with 401 (unauthorized)
    ctx.response.status = 401
      return;
    }

  }
