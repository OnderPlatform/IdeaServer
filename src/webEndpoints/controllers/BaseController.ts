import * as Router from 'koa-router'
import * as fs from 'fs';
import * as koaBody from 'koa-body'
import NodeDatabase from "../../database/NodeDatabase";
import * as jwt from "jsonwebtoken";
import { getRepository } from "typeorm";
import { User } from "../../database/models";
import config from "../../config/config";
import { mapEthAddressToURL } from "../endpoints/IDEAServers";
import axios from 'axios'

export class BaseController {
  public readonly db: NodeDatabase
  private excel = require('../../excel/xlsx')


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


    var workerpool = require('workerpool');

// create a worker pool using an the asyncWorker. This worker contains
// asynchronous functions.
    var pool = workerpool.pool('./src/workers/asyncWorker.js');


    /*
    configure endpoints
    */

    router.post(`${namespace}/login`, koaBody(), this.login.bind(this))
    router.post(`${namespace}/margin`, koaBody(), this.postUserMargin.bind(this))
    router.get(`${namespace}/margin`, this.getUserMargin.bind(this))
    router.post(`${namespace}/close`, koaBody(), this.postCloseChannels.bind(this))
    router.get(`${namespace}/consumption`, this.getUserConsumptions.bind(this))
    router.get(`${namespace}/production`, this.getUserProductions.bind(this))
    router.get(`${namespace}/transaction`, this.getUserTransactions.bind(this))
    router.get(`${namespace}/excel/energy`, this.getUserExcelEnergy.bind(this))
    router.get(`${namespace}/excel/transaction`, this.getUserExcelTransaction.bind(this))
    router.get(`${namespace}/excel/transaction/result`, this.getResultXlsx.bind(this))
    router.get(`${namespace}/anchor`, this.getUserAnchors.bind(this))
    router.post(`${namespace}/price`, koaBody(), this.postUserPrice.bind(this))
    router.get(`${namespace}/price`, this.getUserPrice.bind(this))
    router.post(`${namespace}/newuser`, koaBody(), this.newUser.bind(this))
    router.get(`${namespace}/alluser`, this.listAll.bind(this))
    router.get(`${namespace}/check`, this.getLastLogin.bind(this))

    router.get(`${namespace}/hello`, (ctx: Router.IRouterContext) => {
      this.setCorsHeaders(ctx)
      ctx.response.body = 'Hello!'
      this.excel.parse()
      this.db.mqtt.publishProgress(1, 1, 200, "Enode1", "Enode2", 12.5, 7)
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

  async closeUserChannels(userEmail: string): Promise<any> {
    const who: string = await this.findEthAddressByEmail(userEmail)
    const getNeighboursIdResponse = await axios.get(`${mapEthAddressToURL(who)}/neighbours`)
    const neighbourIds: { neighbours: Array<{ neighbourId: number }> } = getNeighboursIdResponse.data
    return Promise.all(neighbourIds.neighbours.map(async value => {
      try {
        const response = await axios.post(`${mapEthAddressToURL(who)}/closechannel/${value.neighbourId}`)
        return {
          status: response.status,
          message: `Closing channel between you and neighbour ${value.neighbourId} result: ${response.data}`,
        }
      } catch (e) {
        return {
          status: 500,
          message: `Could not close channel between you and neighbour ${value.neighbourId}: ${e.message}`,
        }
      }
    }))
  }

  async closeAllUsersChannels(): Promise<any> {
    const users = await this.db.service.userRepository.find({})
    return Promise.all(users.map(async value => {
      try {
        const result = await this.closeUserChannels(value.email)
        return {
          [value.email]: result,
          // @ts-ignore
          status: result.every(value => value.status >= 400) ? 500 : 200
        }
      } catch (e) {
        return {
          [value.email]: {
            message: e.message,
            status: 500
          }
        }
      }
    }))
  }

  async postCloseChannels(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who: string = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const user = await this.db.service.userRepository.findOneOrFail({
        where: {
          email: <string>ctx.request.headers['from']
        }
      })
      const status: boolean = ctx.request.body.status
      if (!status) {
        if (user.isAdmin) {
          ctx.response.body = await this.closeAllUsersChannels()
          // @ts-ignore
          if (ctx.response.body.every(value => value.status >= 400))
            ctx.response.status = 500
          else
            ctx.response.status = 200
        } else {
          ctx.response.body = await this.closeUserChannels(<string>ctx.request.headers['from'])
          // @ts-ignore
          if (ctx.response.body.every(value => value.status >= 400))
            ctx.response.status = 500
          else
            ctx.response.status = 200
        }
      }
    } catch (e) {
      console.log(e);
      ctx.response.status = 500
      ctx.response.body = 'Error while closing channels. Error message: ' + e.message
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
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    ctx.response.body = await this.db.service.adminAnchor()
    ctx.response.status = 200
  }

  async getUserMargin(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const cell = await this.db.service.cellRepository.findOneOrFail({
        where: {
          ethAddress: who
        }
      })
      if (cell.type !== 'prosumer') {
        ctx.response.body = `Margin as enabled only for prosumer. You are ${cell.type}`
        ctx.response.status = 400
        return;
      } else {
        if (typeof cell.margin !== "number") {
          ctx.response.body = 'Margin is null on the server'
          ctx.status = 500
          return;
        } else {
          ctx.response.body = {
            margin: cell.margin
          }
          ctx.response.status = 200
        }
      }
    } catch (e) {
      console.log(e);
      ctx.throw(500, e.message)
      return
    }
  }

  async postUserMargin(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
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
      } else {
        const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
        const cell = await this.db.service.cellRepository.findOneOrFail({
          where: {
            ethAddress: who
          }
        })
        switch (cell.type) {
          case "consumer": {
            ctx.response.body = await this.db.service.userConsumption(who)
            break;
          }
          case "prosumer": {
            ctx.response.body = await this.db.service.userProsumerConsumption(who)
            break;
          }
          default: {
            ctx.response.body = "user\'s cell type and requested type of data doesn\'t match"
          }
        }
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
      const user = await this.db.service.userRepository.findOneOrFail({
        where: {
          email: <string>ctx.request.headers['from']
        }
      })
      const isAdmin = user.isAdmin
      if (isAdmin) {
        const params = new URLSearchParams(ctx.request.querystring)
        const discoveringuser = params.get('ethId')
        console.log("discoveringuser: ", discoveringuser)
        if (discoveringuser) {
          ctx.response.body = await this.db.service.userProduction(discoveringuser)
        } else {
          ctx.response.body = await this.db.service.adminProductions()
        }
      } else {
        const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
        const cell = await this.db.service.cellRepository.findOneOrFail({
          where: {
            ethAddress: who
          }
        })
        switch (cell.type) {
          case "producer": {
            ctx.response.body = await this.db.service.userProduction(who)
            break
          }
          case "prosumer": {
            ctx.response.body = await this.db.service.userProsumerProduction(who)
            break
          }
          default: {
            ctx.response.body = "user\'s cell type and requested type of data doesn\'t match"
            break
          }
        }
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

  async getResultXlsx(ctx: Router.IRouterContext) {
    const fileName = `./result.xlsx`;
    if (fs.existsSync(fileName)) {
      ctx.body = fs.createReadStream(fileName);
      ctx.attachment(fileName);
    } else {
      ctx.throw(400, "file result.xlsx is not found");
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
          this.excel.parseTransactionsToExcel(await this.db.service.userTransactions(discoveringuser))
        } else {
          this.excel.parseTransactionsToExcel(await this.db.service.adminTransactions())
        }
      } else {
        this.excel.parseTransactionsToExcel(await this.db.service.userTransactions(who))
      }
      ctx.response.status = 200
      ctx.response.body = `File result.xlsx created, it may be downloaded in endpoint /excel/transaction/result`
    } catch (e) {
      console.log(e);
      ctx.response.body = e.message
      ctx.response.status = 500
    }

  }

  async getUserPrice(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const cell = await this.db.service.cellRepository.findOneOrFail({
        where: {
          ethAddress: who
        }
      })
      if (cell.type === 'producer') {
        if (cell.initPower && cell.initPrice) {
          let prices = []
          for (let i = 0; i < cell.initPower.length; i++) {
            prices.push({
              amount: cell.initPower[i],
              price: cell.initPrice[i]
            })
          }
          ctx.response.body = {
            prices
          }
          ctx.response.status = 200
        } else {
          console.log('null!');
          const errorMessage = 'initPower or initPrice is null on server'
          ctx.throw(500, errorMessage)
        }
      } else {
        ctx.response.body = 'this request allowed only for producer, you are '+cell.type
        ctx.response.status = 400
      }
    } catch (e) {
      ctx.throw(500, e.message)
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

  async login(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
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
      user = await userRepository.findOneOrFail({where: {email}});
    } catch (error) {
      ctx.response.status = 401
    }
    var token = ""
    if (user != undefined && user.password == password) {
      if (user.isAdmin) {
        //Sing JWT, valid for 1 hour
        token = jwt.sign(
          {userId: user.id, email: user.email},
          config.adminSecret,
          {expiresIn: "10m"}
        );

        console.log("admin")
      } else {
        token = jwt.sign(
          {userId: user.id, email: user.email},
          user.email,
          {expiresIn: "10m"}
        );
        console.log("user")
      }


      //Try to validate the token and get data

      //Send the jwt in the response
      ctx.response.body = {token}
    }

  };


  async newUser(ctx: Router.IRouterContext) {
    //Get parameters from the body
    const email = ctx.request.body.email
    const password = ctx.request.body.password
    const isAdmin = ctx.request.body.isAdmin
    const ethAddress = ctx.request.body.ethAdrress

    if (!(email && password)) {
      ctx.response.status = 400
    }

    const cell = await this.db.service.cellRepository.findOneOrFail({
      where: {
        ethAddress: ethAddress
      }
    })


    //Validade if the parameters are ok
    // const errors = await validate(user);
    // if (errors.length > 0) {
    //   ctx.response.status = 400
    //   return;
    // }

    //Try to save. If fails, the email is already in use
    try {
      await this.db.service.userRepository.save({
        isAdmin: isAdmin,
        email: email,
        cell: cell,
        password: password
      })
    } catch (e) {
      ctx.response.status = 409
      console.log(e);
      return;
    }

    //If all ok, send 201 response
    ctx.response.status = 201
  };


  async getCheckUserNotarization(ctx: Router.IRouterContext) {
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
        const users = await this.db.service.userRepository.find({})
        const checkingResult = Promise.all(users.map(async value => {
          const infoToCheck = this.db.service.getAnchoringInfoToCheck(value)
          // todo: handle infoToCheck
        }))
      } else {
        const infoToCheck = this.db.service.getAnchoringInfoToCheck(user)
        // todo: handle infoToCheck
      }
    } catch (e) {
      console.log(e);
    }
  }

  async getLastLogin(ctx: Router.IRouterContext) {
    this.setCorsHeaders(ctx)
    let status
    check(ctx)
    status = ctx.status !== 401;
    try {
      const lastCheckData = await this.db.service.userRepository.findOneOrFail({
        where: {
          email: <string>ctx.request.headers['from']
        }
      })
      ctx.response.body = {
        lastCheckDate: lastCheckData.lastCheckDate || 'unauthorized',
        isVerified: status
      }
      ctx.response.status = 200
    } catch (e) {
      ctx.throw(500, e.message)
    }

  }

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

  //Try to validate the token and get data
  try {
    const userRepository = getRepository(User);
    const user = await userRepository.findOneOrFail({
      where: {
        email: email
      }
    })
    await userRepository.update({
      email: user.email
    }, {
      lastCheckDate: (new Date(Date.now())).toISOString()
    })

    if (user.isAdmin) {
      jwtPayload = <any>jwt.verify(token, config.adminSecret);
      //ctx.res.locals.jwtPayload = jwtPayload;
      console.log("admin - " + token)
    } else {
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
