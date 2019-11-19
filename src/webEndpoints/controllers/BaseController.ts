import * as Router from 'koa-router'
import * as fs from 'fs';
import * as koaBody from 'koa-body'
import NodeDatabase from "../../database/services/NodeDatabase";
import * as jwt from "jsonwebtoken";
import { getRepository } from "typeorm";
import { Anchor, User } from "../../database/models";
import config from "../../config/config";
import { mapEthAddressToURL } from "../endpoints/IDEAServers";
import axios from 'axios'
import { UserMargin } from "../../mockData/interfaces";

type UserInfo = {
  userId: number,
  email: string,
  isAdmin: boolean,
}

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
    router.get(`${namespace}/excel/transaction/result.xlsx`, this.getXLSX.bind(this))
    router.get(`${namespace}/anchor`, this.getUserAnchors.bind(this))
    router.post(`${namespace}/price`, koaBody(), this.postUserPrice.bind(this))
    router.get(`${namespace}/price`, this.getUserPrice.bind(this))
    router.post(`${namespace}/newuser`, koaBody(), this.newUser.bind(this))
    router.get(`${namespace}/alluser`, this.listAll.bind(this))
    router.get(`${namespace}/getCurrentUser`, this.getCurrentUser.bind(this))
    router.get(`${namespace}/getCellInfo`, this.getCellInfo.bind(this))
    router.get(`${namespace}/check`, this.getCheckUserNotarization.bind(this))

    router.get(`${namespace}/hello`, (ctx: Router.IRouterContext) => {
      ctx.response.body = 'Hello!'
      this.excel.parse()
      this.db.service.mqtt.mqtt_cl.publishProgress(1, 1, 200, "Enode1", "Enode2", 12.5, 7)
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

  async getCurrentUser(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const ethId: string = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const user = await this.db.service.repositories.userRepository.findOneOrFail({
        where: {
          email: <string>ctx.request.headers['from']
        },
      })
      ctx.response.body = {
        isAdmin: user.isAdmin,
        ethAddress: ethId,
        email: user.email
      }
      ctx.response.status = 200
    } catch (e) {
      console.log(e);
      this.helpThrowError(ctx, e.message)
    }
  }

  async getCellInfo(ctx: Router.IRouterContext) {
    check(ctx);
    if (ctx.response.status == 401) {
      return
    }
    try {
      const params = new URLSearchParams(ctx.request.querystring)
      const ethId = params.get('ethId')
      const cell = await this.db.service.repositories.cellRepository.findOneOrFail({
        where: {
          ethAddress: ethId
        }
      })
      ctx.body = {
        cellType: cell.type,
        cellBalance: cell.balance,
        cellName: cell.name,
      }
      ctx.status = 200
    } catch (e) {
      this.helpThrowError(ctx, e.message)
    }
  }

  async findEthAddressByEmail(email: string): Promise<string> {
    if (email === 'admin@email.com')
      return 'ADMIN'
    try {
      const cell = await this.db.service.repositories.userRepository.findOneOrFail({
        where: {
          email: email
        },
        relations: ['cell']
      })
      return cell.cell.ethAddress
    } catch (e) {
      throw e
    }

  }

  async getAdminTransactions(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    ctx.response.body = await this.db.service.reidsUI.adminTransactions()
    ctx.response.status = 200
  }

  async getAdminConsumptions(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    ctx.response.body = await this.db.service.reidsUI.adminConsumptions()
    ctx.response.status = 200
  }

  async getAdminProductions(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    ctx.response.body = await this.db.service.reidsUI.adminProductions()
    ctx.response.status = 200
  }

  async closeUserChannels(userEmail: string): Promise<any> {
    const who: string = await this.findEthAddressByEmail(userEmail)
    const getNeighboursIdResponse = await axios.get(`${mapEthAddressToURL(who)}/neighbours`)
    const neighbourIds: { neighbours: Array<{ neighbourId: number }> } = getNeighboursIdResponse.data
    return await Promise.all(neighbourIds.neighbours.map(async value => {
      try {
        const response = await axios.post(`${mapEthAddressToURL(who)}/closechannel/${value.neighbourId}`)
        return {
          status: response.status,
          message: `Closing channel between you and neighbour ${value.neighbourId} result: ${JSON.stringify(response.data)}`,
        }
      } catch (e) {
        console.log(e);
        return {
          status: 500,
          message: `Could not close channel between you and neighbour ${value.neighbourId}: ${e.message}`,
        }
      }
    }))
  }

  async closeAllUsersChannels(): Promise<any> {
    const users = await this.db.service.repositories.userRepository.find({})
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
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who: string = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const user = await this.db.service.repositories.userRepository.findOneOrFail({
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
    ctx.response.status = 501
  }

  getAdminExcelTransaction(ctx: Router.IRouterContext) {
    ctx.response.status = 501
  }

  async getAdminAnchors(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    ctx.response.body = await this.db.service.reidsUI.adminAnchor()
    ctx.response.status = 200
  }

  async getUserMargin(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const cell = await this.db.service.repositories.cellRepository.findOneOrFail({
        where: {
          ethAddress: who
        }
      })
      if (cell.type !== 'prosumer') {
        ctx.response.body = `Margin is enabled only for prosumer. You are ${cell.type}`
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
      this.helpThrowError(ctx, e.message)
      return
    }
  }

  async isAdmin(ethAddress: string) {
    const cell = await this.db.service.repositories.cellRepository.findOneOrFail({
      where: {
        ethAddress
      }
    })
    const user = await this.db.service.repositories.userRepository.findOneOrFail({
      where: {
        cell
      }
    })
    return user.isAdmin
  }

  async helpNotForAdmin(ctx: Router.IRouterContext) {
    ctx.response.status = 400
    ctx.response.body = 'This endpoint not allowed for admin'
  }

  async helpThrowError(ctx: Router.IRouterContext, message: string) {
    ctx.response.status = 500
    ctx.response.body = message
  }

  async postUserMargin(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const cell = await this.db.service.repositories.cellRepository.findOneOrFail({
        where: {
          ethAddress: who
        }
      })
      if (cell.type != 'prosumer') {
        this.helpThrowCodeAndMessage(ctx, 400, 'Method allowed only for prosumers')
        return
      }
      const isAdmin = await this.isAdmin(who)
      if (isAdmin) {
        this.helpNotForAdmin(ctx)
        return
      }

      const body: UserMargin = ctx.request.body
      await this.db.service.reidsUI.userMargin(body, who)
      await this.db.service.amigo.postPricesToAMIGOForCell(who, 'TMMM')
      ctx.response.status = 201
    } catch (e) {
      console.log(e);
      this.helpThrowError(ctx, e.message)
    }
  }

  async getUserConsumptions(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const user = await this.db.service.repositories.userRepository.findOneOrFail({
        where: {
          email: <string>ctx.request.headers['from']
        }
      })
      const isAdmin = user.isAdmin

      if (isAdmin) {
        const params = new URLSearchParams(ctx.request.querystring)
        const discoveringuser = params.get('ethId')
        if (discoveringuser) {
          const cell = await this.db.service.repositories.cellRepository.findOneOrFail({
            where: {
              ethAddress: discoveringuser
            }
          })
          switch (cell.type) {
            case "consumer": {
              ctx.response.body = await this.db.service.reidsUI.userConsumption(discoveringuser)
              ctx.response.status = 200
              break;
            }
            case "operator":
            case "prosumer":
            default: {
              this.helpThrowCodeAndMessage(ctx, 400, "user\'s cell type and requested type of data doesn\'t match")
              break;
            }
          }
        } else {
          ctx.response.body = await this.db.service.reidsUI.adminConsumptions()
        }
      } else {
        const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
        const cell = await this.db.service.repositories.cellRepository.findOneOrFail({
          where: {
            ethAddress: who
          }
        })
        switch (cell.type) {
          case "consumer": {
            ctx.response.body = await this.db.service.reidsUI.userConsumption(who, false)
            ctx.response.status = 200
            break;
          }
          default: {
            this.helpThrowCodeAndMessage(ctx, 400, "user\'s cell type and requested type of data doesn\'t match")
            break;
          }
        }
      }
    } catch (e) {
      console.log(e);
      this.helpThrowError(ctx, e.message)
    }
  }

  async getUserProductions(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const user = await this.db.service.repositories.userRepository.findOneOrFail({
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
          const cell = await this.db.service.repositories.cellRepository.findOneOrFail({
            where: {
              ethAddress: discoveringuser
            }
          })
          switch (cell.type) {
            case "producer":
            case "prosumer": {
              ctx.response.body = await this.db.service.reidsUI.userProduction(discoveringuser)
              ctx.response.status = 200
              break
            }
            case "operator": {
              ctx.response.body = await this.db.service.reidsUI.operatorProduction(discoveringuser)
              ctx.response.status = 200
              break
            }
            default: {
              this.helpThrowCodeAndMessage(ctx, 400, "user\'s cell type and requested type of data doesn\'t match")
              break
            }
          }
        } else {
          ctx.response.body = await this.db.service.reidsUI.adminProductions()
        }
      } else {
        const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
        const cell = await this.db.service.repositories.cellRepository.findOneOrFail({
          where: {
            ethAddress: who
          }
        })
        switch (cell.type) {
          case "producer":
          case "prosumer": {
            ctx.response.body = await this.db.service.reidsUI.userProduction(who, false)
            ctx.response.status = 200
            break
          }
          default: {
            this.helpThrowCodeAndMessage(ctx, 400, "user\'s cell type and requested type of data doesn\'t match")
            break
          }
        }
      }
    } catch (e) {
      console.log(e);
      this.helpThrowError(ctx, e.message)
    }
  }

  async getUserTransactions(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const user = await this.db.service.repositories.userRepository.findOneOrFail({
        where: {
          email: <string>ctx.request.headers['from']
        }
      })
      const isAdmin = user.isAdmin
      if (isAdmin) {
        const params = new URLSearchParams(ctx.request.querystring)
        const discoveringuser = params.get('ethId')
        if (discoveringuser) {
          ctx.response.body = await this.db.service.reidsUI.userTransactions(discoveringuser)
        } else {
          ctx.response.body = await this.db.service.reidsUI.adminTransactions()
        }
      } else {
        ctx.response.body = await this.db.service.reidsUI.userTransactions(who)
      }


      ctx.response.status = 200
    } catch (e) {
      console.log(e);
      this.helpThrowError(ctx, e.message)
    }
  }

  async getUserAnchors(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const user = await this.db.service.repositories.userRepository.findOneOrFail({
        where: {
          email: <string>ctx.request.headers['from']
        }
      })
      const isAdmin = user.isAdmin
      if (isAdmin) {
        const params = new URLSearchParams(ctx.request.querystring)
        const discoveringuser = params.get('ethId')
        if (discoveringuser) {
          ctx.response.body = await this.db.service.reidsUI.userAnchor(discoveringuser)
        } else {
          ctx.response.body = await this.db.service.reidsUI.adminAnchor()
        }
      } else {
        ctx.response.body = await this.db.service.reidsUI.userAnchor(who)
      }

      ctx.response.status = 200
    } catch (e) {
      console.log(e);
      this.helpThrowError(ctx, e.message)
    }
  }

  async getUserExcelEnergy(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      ctx.response.status = 501
    } catch (e) {
      console.log(e);
      this.helpThrowError(ctx, e.message)
    }

  }

  async getResultXlsx(ctx: Router.IRouterContext) {
    const fileName = `./result.xlsx`;
    if (fs.existsSync(fileName)) {
      ctx.body = fs.createReadStream(fileName);
      ctx.attachment(fileName);
    } else {
      this.helpThrowCodeAndMessage(ctx, 400, "file result.xlsx is not found")
    }
  }

  async getUserExcelTransaction(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const user = await this.db.service.repositories.userRepository.findOneOrFail({
        where: {
          email: <string>ctx.request.headers['from']
        }
      })
      const isAdmin = user.isAdmin
      if (isAdmin) {
        const params = new URLSearchParams(ctx.request.querystring)
        const discoveringuser = params.get('ethId')
        if (discoveringuser) {
          this.excel.parseTransactionsToExcel(await this.db.service.reidsUI.userTransactions(discoveringuser))
        } else {
          this.excel.parseTransactionsToExcel(await this.db.service.reidsUI.adminTransactions())
        }
      } else {
        this.excel.parseTransactionsToExcel(await this.db.service.reidsUI.userTransactions(who))
      }
      ctx.response.status = 200
      ctx.response.body = {
        report: `http://server.idea.onder.tech/api/excel/transaction/result.xlsx`
      }
    } catch (e) {
      console.log(e);
      this.helpThrowError(ctx, e.message)
    }
  }

  async getXLSX(ctx: Router.IRouterContext) {
    this.getResultXlsx(ctx)
  }

  async getUserPrice(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const cell = await this.db.service.repositories.cellRepository.findOneOrFail({
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
          this.helpThrowCodeAndMessage(ctx, 500, errorMessage)
        }
      } else {
        ctx.response.body = 'this request allowed only for producer, you are ' + cell.type
        ctx.response.status = 400
      }
    } catch (e) {
      this.helpThrowError(ctx, e.message)
    }
  }

  async postUserPrice(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const body = ctx.request.body
      await this.db.service.reidsUI.postPrices(body, who)
      await this.db.service.amigo.postPricesToAMIGOForCell(who, 'TMMM')
      ctx.response.status = 201
    } catch (e) {
      console.log(e);
      this.helpThrowError(ctx, e.message)
    }

  }

  async helpThrowCodeAndMessage(ctx: Router.IRouterContext, code: number, message: string) {
    ctx.throw(code, message)
  }

  async login(ctx: Router.IRouterContext) {
    //Check if email and password are set
    let email = ctx.request.body.email
    let password = ctx.request.body.password
    if (!(email && password)) {
      this.helpThrowCodeAndMessage(ctx, 400, `You have to provide email and password together in body`)
    }

    //Get user from database
    const userRepository = getRepository(User);
    let user: User | undefined;

    try {
      user = await userRepository.findOneOrFail({where: {email}});
    } catch (error) {
      this.helpThrowCodeAndMessage(ctx, 400, 'There is no such user')
      return
    }
    var token = ""
    if (user != undefined && user.password == password) {
      let userInfo: UserInfo = {userId: user.id, email: user.email, isAdmin: false};
      if (user.isAdmin) {
        //Sing JWT, valid for 1 hour
        token = jwt.sign(
          {...userInfo, isAdmin: true},
          config.adminSecret,
          {expiresIn: "24h"}
        );

        console.log("admin")
      } else {
        token = jwt.sign(
          userInfo,
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

    const cell = await this.db.service.repositories.cellRepository.findOneOrFail({
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
      await this.db.service.repositories.userRepository.save({
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

  async setDateFromAnchoringTable(data: string, user: User): Promise<string> {
    const parsed = JSON.parse(data)
    const anchoringEntry = await this.db.service.repositories.anchorRepository.findOne({
      where: {
        user: user
      },
      order: {
        time: "DESC"
      }
    })
    if (!anchoringEntry) {
      throw new Error('it is no anchoring entry for user')
    }
    return JSON.stringify(Object.assign(parsed, {date: anchoringEntry.time}))
  }

  // async checkNotarization(ctx: Router.IRouterContext) {
  //   check(ctx)
  //   if (ctx.response.status == 401) {
  //     return
  //   }
  //   try {
  //     const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
  //     const user = await this.db.service.repositories.userRepository.findOneOrFail({
  //       where: {
  //         email: <string>ctx.request.headers['from']
  //       }
  //     })
  //     const isAdmin = user.isAdmin
  //     if (isAdmin) {
  //
  //     } else {
  //
  //     }
  //   }
  // }

  async getCheckUserNotarization(ctx: Router.IRouterContext) {
    check(ctx)
    if (ctx.response.status == 401) {
      return
    }
    try {
      const who = await this.findEthAddressByEmail(<string>ctx.request.headers['from'])
      const user = await this.db.service.repositories.userRepository.findOneOrFail({
        where: {
          email: <string>ctx.request.headers['from']
        }
      })
      const isAdmin = user.isAdmin
      if (isAdmin) {
        const users = await this.db.service.repositories.userRepository.find({relations: ['cell']})
        ctx.response.body = await Promise.all(users.filter(value => !value.isAdmin && value.cell.type != 'operator').map(async currentUser => {
          const infoToCheck: string = await this.db.service.notarization.getAnchoringDataForUser(currentUser)
          const anchorEntry: Anchor | undefined = await this.db.service.repositories.anchorRepository.findOne({
            where: {
              user: currentUser
            },
            order: {
              time: "DESC"
            }
          })
          const oldDate = anchorEntry && anchorEntry.lastCheckingDate
          if (!oldDate)
            return {
              who: currentUser.email,
              success: null,
              lastChecked: null
            }
          // console.log('Checking this one:', JSON.parse(await this.setDateFromAnchoringTable(infoToCheck, currentUser)));
          return await axios.post('http://localhost:9505/timestamp/check', JSON.parse(await this.setDateFromAnchoringTable(infoToCheck, currentUser)), {
            headers: {
              'Content-Type': 'application/json',
            }
          }).then(async notarizationServerResponse => {
            if (notarizationServerResponse.status === 200) {
              const lastEntry = await this.db.service.repositories.anchorRepository.findOneOrFail({
                where: {
                  user: currentUser
                },
                order: {
                  time: "DESC"
                }
              })
              await this.db.service.repositories.anchorRepository.update({
                id: lastEntry.id
              }, {
                lastCheckingDate: (new Date()).toISOString()
              })
            }
            return {
              who: currentUser.email,
              success: notarizationServerResponse.status === 200,
              lastChecked: oldDate
            }
          })
            .catch(reason => {
              return {
                who: currentUser.email,
                success: reason.response && reason.response.status !== 404,
                lastChecked: oldDate
              }
            })
        }))
        ctx.response.status = 200
      } else {
        const infoToCheck = await this.db.service.notarization.getAnchoringDataForUser(user)
        const oldDate = (await this.db.service.repositories.anchorRepository.findOneOrFail({
          where: {
            user: user
          },
          order: {
            time: "DESC"
          }
        })).lastCheckingDate
        const response = await axios.post('http://localhost:9505/timestamp/check', JSON.parse(await this.setDateFromAnchoringTable(infoToCheck, user)), {
          headers: {
            'Content-Type': 'application/json',
          }
        }).then(async notarizationServerResponse => {
          if (notarizationServerResponse.status === 200) {
            const lastEntry = await this.db.service.repositories.anchorRepository.findOneOrFail({
              where: {
                user: user
              },
              order: {
                time: "DESC"
              }
            })
            await this.db.service.repositories.anchorRepository.update({
              id: lastEntry.id
            }, {
              lastCheckingDate: (new Date()).toISOString()
            })
          }
          ctx.response.body = {
            success: notarizationServerResponse.status === 200,
            lastChecked: oldDate
          }
        })
          .catch(reason => {
            ctx.response.body = {
              success: reason.response.status !== 404,
              lastChecked: oldDate
            }
          })
        ctx.response.status = 200
      }
    } catch (e) {
      console.log(e);
      this.helpThrowError(ctx, e.message)
    }
  }

  async getLastLogin(ctx: Router.IRouterContext) {
    let status
    check(ctx)
    status = ctx.status !== 401;
    try {
      const lastCheckData = await this.db.service.repositories.userRepository.findOneOrFail({
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
      this.helpThrowError(ctx, e.message)
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
