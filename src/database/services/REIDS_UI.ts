import {
  AdminAnchor,
  AdminConsumptions,
  AdminProductions,
  Authorization,
  OperatorProduction,
  Transaction,
  UserAnchor,
  UserConsumption,
  UserMargin,
  UserPrices,
  UserProduction,
  UserTransactions
} from "../../mockData/interfaces";
import { NodeDatabaseRepositories } from "./NodeDatabaseRepositories";
import { Cell } from "../models";
import { DAY_INTERVAL } from "../../webEndpoints/controllers/BaseController";
import { DateTime } from 'luxon';

const DEFAULT_BALANCE = -1

interface GraphicEntry {
  time: Date
  energy: number
  price: number
}

export class REIDS_UI extends NodeDatabaseRepositories {
  constructor() {
    super();
  }

  async adminTransactions(daysInterval: number = 3, timezoneName: string, timezoneOffset: number): Promise<UserTransactions> {
    const transactions_today: Transaction[] = await this.transactionRepository.query(`select time + '${timezoneOffset} hour'::interval as time,
       c2.name as "from",
       c.name   as "to",
       price,
       amount   as "transfer_energy",
       cost     as "transfer_coin"
from transaction join cell c on transaction."toId" = c.id join cell c2 on transaction."fromId" = c2.id
where date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
order by time desc;`)

    const transactions_30_days: Transaction[] = await this.transactionRepository.query(`select time + '${timezoneOffset} hour'::interval as time,
       c2.name as "from",
       c.name   as "to",
       price,
       amount   as "transfer_energy",
       cost     as "transfer_coin"
from transaction join cell c on transaction."toId" = c.id join cell c2 on transaction."fromId" = c2.id
where date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
order by time desc;`)

    return {
      transaction_today: transactions_today,
      transaction_30_days: transactions_30_days
    }
  }

  async getAdminConsumptionPeersToday(timezoneName: string): Promise<Array<{
    "total": string,
    "id": string,
    "balance": number,
    "bought": number,
    "price": number
  }>> {
    return await this.transactionRepository.query(`with t1 as (
    select c.name as "total", sum(amount) as bought, sum(cost) as "price"
    from transaction
             join cell c on transaction."fromId" = c.id
      and time at time zone '${timezoneName}' <= now() at time zone '${timezoneName}' and date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
    group by c.name, c."ethAddress"
    order by c.name)
select total, cell."ethAddress" as "id", cell.balance, t1.bought, t1.price
from t1
         join cell on t1.total = cell.name;`)
  }
  async getAdminConsumptionPeers30Day(daysInterval: number = 3, timezoneName: string): Promise<Array<{
    "total": string,
    "id": string,
    "balance": number,
    "bought": number,
    "price": number
  }>> {
    return await this.transactionRepository.query(`with t1 as (
    select c.name as "total", sum(amount) as bought, sum(cost) as "price"
    from transaction
             join cell c on transaction."fromId" = c.id
      and time at time zone '${timezoneName}' <= now() at time zone '${timezoneName}' and date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
    group by c.name, c."ethAddress"
    order by c.name)
select total, cell."ethAddress" as "id", cell.balance, t1.bought, t1.price
from t1
         join cell on t1.total = cell.name;`)
  }

  async getAdminProductionPeersToday(timezoneName: string): Promise<Array<{
    "total": string,
    "id": string,
    "balance": number,
    "sold": number,
    "price": number
  }>> {
    return await this.transactionRepository.query(`with t1 as (
    select c.name as "total", sum(amount) as bought, sum(cost) as "price"
    from transaction
             join cell c on transaction."toId" = c.id
      and time at time zone '${timezoneName}' <= now() at time zone '${timezoneName}' and date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
    group by c.name, c."ethAddress"
    order by c.name)
select total, cell."ethAddress" as "id", cell.balance, t1.bought as sold, t1.price
from t1
         join cell on t1.total = cell.name;`)
  }
  async getAdminProductionPeers30Day(daysInterval: number = 3, timezoneName: string): Promise<Array<{
    "total": string,
    "id": string,
    "balance": number,
    "sold": number,
    "price": number
  }>> {
    return await this.transactionRepository.query(`with t1 as (
    select c.name as "total", sum(amount) as bought, sum(cost) as "price"
    from transaction
             join cell c on transaction."toId" = c.id
      and time at time zone '${timezoneName}' <= now() at time zone '${timezoneName}' and date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
    group by c.name, c."ethAddress"
    order by c.name)
select total, cell."ethAddress" as "id", cell.balance, t1.bought as sold, t1.price
from t1
         join cell on t1.total = cell.name;`)
  }

  getTomorrowSingapore() {
    return new Date(DateTime.local().plus({day: 1}).toISODate())
  }

  async adminConsumptions(daysInterval: number = 3, timezoneName: string, timezoneOffset: number): Promise<AdminConsumptions> {
    const entitiesToday: GraphicEntry[] = await this.tradeRepository.query(`select date_trunc('minute', time) + '${timezoneOffset} hour'::interval as time, sum(energy) as energy, avg(price) as price
from trade
where type = 'consumer'
  and date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
group by date_trunc('minute', time)
order by 1;`)


    const entities30Today: GraphicEntry[] = await this.tradeRepository.query(`select date(time) + '${timezoneOffset} hour'::interval as time, sum(energy) as energy, avg(price) as price
from trade
where type = 'consumer'
  and date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
group by date(time)
order by 1;`)

    const minMaxAvg_today = await this.tradeRepository.query(`with t as (select date_trunc('minute', time) as time, sum(energy) as energy, avg(price) as price
from trade
where type = 'consumer'
  and date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
group by date_trunc('minute', time)
order by 1)
select min(t.energy) as "minEnergy", max(t.energy) as "maxEnergy", avg(t.energy) as "averageEnergy",
       min(price) as "minPrice", max(price) as "maxPrice", avg(price) as "averagePrice"
from t;`)

    const minMaxAvg_30 = await this.tradeRepository.query(`with t as (select date(time) as time, sum(energy) as energy, avg(price) as price
from trade
where type = 'consumer'
  and date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
group by date(time)
order by 1)
select min(energy) as "minEnergy",
       max(energy) as "maxEnergy",
       avg(energy) as "averageEnergy",
       min(price)    as "minPrice",
       max(price)    as "maxPrice",
       avg(price)    as "averagePrice"
from t;`)

    return {
      today: {
        ...minMaxAvg_today[0],
      },
      "30": {
        ...minMaxAvg_30[0]
      },
      energy_today: entitiesToday.map(value => {
        return {
          date: value.time,
          energy: value.energy
        }
      }).concat({date: this.getTomorrowSingapore(), energy: 0}),
      energy_30_day: entities30Today.map(value => {
        if (typeof value.energy != "number")
          throw new Error('energy is null')
        return {
          date: value.time,
          energy: value.energy
        }
      }),
      price_today: entitiesToday.map(value => {
        if (typeof value.price != "number")
          throw new Error('price is null')
        return {
          date: value.time,
          price: value.price
        }
      }).concat({date: this.getTomorrowSingapore(), price: minMaxAvg_today[0].averagePrice}),
      price_30_day: entities30Today.map(value => {
        if (typeof value.price != "number")
          throw new Error('price is null')
        return {
          date: value.time,
          price: value.price
        }
      }),
      // consumption_peers: tradeTableConsumers.map(value => {
      //   if (typeof value.energy != "number")
      //     throw new Error('null energy')
      //   return {
      //     total: value.cell.name,
      //     id: value.cell.ethAddress,
      //     balance: value.cell.balance || DEFAULT_BALANCE,
      //     bought: value.energy,
      //     price: value.price
      //   }
      // })
      peers_today: await this.getAdminConsumptionPeersToday(timezoneName),
      peers_30_days: await this.getAdminConsumptionPeers30Day(DAY_INTERVAL, timezoneName),
    }
  }

  async adminProductions(daysInterval: number = 3, timezoneName: string, timezoneOffset: number): Promise<AdminProductions> {
    const entitiesToday: GraphicEntry[] = await this.tradeRepository.query(`select date_trunc('minute', time) + '${timezoneOffset} hour'::interval as time, sum(energy) as energy, avg(price) as price
from trade
where (type = 'prosumer' or type = 'producer')
  and date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
group by date_trunc('minute', time)
order by 1;`)
    const entities30Today: GraphicEntry[] = await this.tradeRepository.query(`select date(time) + '${timezoneOffset} hour'::interval as time, sum(energy) as energy, avg(price) as price
from trade
where (type = 'producer' or type = 'prosumer')
  and date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
group by date(time)
order by 1;`)

    const minMaxAvg_today = await this.tradeRepository.query(`with t as (select date_trunc('minute', time) as time, sum(energy) as energy, avg(price) as price
from trade
where (type = 'prosumer' or type = 'producer')
  and date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
group by date_trunc('minute', time)
order by 1)
select min(energy) as "minEnergy",
       max(energy) as "maxEnergy",
       avg(energy) as "averageEnergy",
       min(price)  as "minPrice",
       max(price)  as "maxPrice",
       avg(price)  as "averagePrice"
from t;`)
    const minMaxAvg_30 = await this.tradeRepository.query(`with t as (select date(time) as time, sum(energy) as energy, avg(price) as price
from trade
where (type = 'producer' or type = 'prosumer')
  and date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
group by date(time)
order by 1)
select min(energy) as "minEnergy",
       max(energy) as "maxEnergy",
       avg(energy) as "averageEnergy",
       min(price)  as "minPrice",
       max(price)  as "maxPrice",
       avg(price)  as "averagePrice"
from t;`)


    return {
      today: {
        ...minMaxAvg_today[0],
      },
      "30": {
        ...minMaxAvg_30[0]
      },
      energy_today: entitiesToday.map(value => {
        return {
          date: value.time,
          energy: value.energy
        }
      }).concat({date: this.getTomorrowSingapore(), energy: 0}),
      energy_30_day: entities30Today.map(value => {
        return {
          date: value.time,
          energy: value.energy
        }
      }),
      price_today: entitiesToday.map(value => {
        return {
          date: value.time,
          price: value.price
        }
      }).concat({date: this.getTomorrowSingapore(), price: minMaxAvg_today[0].averagePrice}),
      price_30_day: entities30Today.map(value => {
        return {
          date: value.time,
          price: value.price
        }
      }),
      peers_today: await this.getAdminProductionPeersToday(timezoneName),
      peers_30_days: await this.getAdminProductionPeers30Day(DAY_INTERVAL, timezoneName)
    }
  }

  async adminAnchor(): Promise<AdminAnchor> {
    const anchors = await this.anchorRepository.find({
      relations: ['user', 'user.cell'],
      order: {
        time: "DESC"
      }
    })

    return {
      anchors: anchors.map(value => {
        return {
          data: value.time,
          participant: value.user.cell.name,
          hashId: value.hashId,
          address: value.address
        }
      })
    }
  }

  async authorization(auth: Authorization) {
    return !!(auth.login === 'kanzeparov@yandex.ru' && auth.password === '1234567890'); //todo: make properly
  }

  async userMargin(data: UserMargin, cellEthAddress: string) {
    await this.cellRepository.update({
      ethAddress: cellEthAddress
    }, {
      margin: data.margin
    })
  }

  async getConsumptionPeersForToday(cell: Cell, timezoneName: string): Promise<Array<{
    "total": string,
    "id": string,
    "balance": number,
    "bought": number,
    "price": number
  }>> {
    return await this.transactionRepository.query(`with t1 as (select c.name as "total", sum(amount) as bought, sum(cost) as "price" from transaction join cell c on transaction."toId" = c.id
where ("fromId" = ${cell.id} or "toId"=${cell.id}) and date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
group by c.name, c."ethAddress"
order by c.name)
    select total, cell."ethAddress" as "id", cell.balance, t1.bought, t1.price from t1 join cell on t1.total = cell.name;`)
  }

  async getConsumptionPeersFor30Day(cell: Cell, daysInterval: number = 3, timezoneName: string): Promise<Array<{
    "total": string,
    "id": string,
    "balance": number,
    "bought": number,
    "price": number
  }>> {
    return await this.transactionRepository.query(`with t1 as (select c.name as "total", sum(amount) as bought, sum(cost) as "price" from transaction join cell c on transaction."toId" = c.id
where ("fromId" = ${cell.id} or "toId"=${cell.id}) and date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
group by c.name, c."ethAddress"
order by c.name)
    select total, cell."ethAddress" as "id", cell.balance, t1.bought, t1.price from t1 join cell on t1.total = cell.name;`)
  }

  async operatorProduction(cellEthAddress: string, timezoneName: string, timezoneOffset: number): Promise<OperatorProduction| {}> {
    const cell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: cellEthAddress
      }
    })
    const peers_today = await this.getProductionPeersToday(cell, timezoneName)
    const peers_30_days = await this.getProductionPeers30Day(cell, DAY_INTERVAL, timezoneName)

    return {
      peers_today: peers_today.map(value => ({...value, bought: undefined, balance: undefined})),
      peers_30_days: peers_30_days.map(value => ({...value, bought: undefined, balance: undefined})),
    }
  }

  async userConsumption(cellEthAddress: string, balance: boolean = true, daysInterval: number = 3, timezoneName: string, timezoneOffset: number): Promise<UserConsumption | {}> {
    const userCell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: cellEthAddress
      }
    })
    if (userCell.type != 'consumer') {
      throw new Error('not a consumer')
    }

    const userTradeTable1Day: GraphicEntry[] = await this.tradeRepository.query(`select date_trunc('minute', time) as time, energy, price from trade
where "cellId" = ${userCell.id}
and date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
order by 1;`)
    const userTradeTable30Day: GraphicEntry[] = await this.tradeRepository.query(`select date(time) as time, sum(energy) as energy, avg(price) as price from trade
where "cellId" = ${userCell.id}
and date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
group by date(time)
order by 1;`)
    const minMaxAvg_today = await this.tradeRepository.query(`with t as (select date_trunc('minute', time) as time, energy, price
           from trade
           where "cellId" = ${userCell.id}
             and date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
           order by 1)
select min(energy) as "minEnergy", max(energy) as "maxEnergy", avg(energy) as "averageEnergy",
       max(price) as "minPrice", max(price) as "maxPrice", avg(price) as "averagePrice"
from t;`)

    const minMaxAvg_30 = await this.tradeRepository.query(`with t as (select date(time) as time, sum(energy) as energy, avg(price) as price
           from trade
           where "cellId" = ${userCell.id}
             and date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
           group by date(time)
           order by 1)
select min(energy) as "minEnergy",
       max(energy) as "maxEnergy",
       avg(energy) as "averageEnergy",
       max(price)  as "minPrice",
       max(price)  as "maxPrice",
       avg(price)  as "averagePrice"
from t;`)



    return {
      today: {
        ...minMaxAvg_today[0],
      },
      "30": {
        ...minMaxAvg_30[0]
      },
      energy_today: userTradeTable1Day.map(value => {
        return {
          date: value.time,
          energy: value.energy
        }
      }).concat({date: this.getTomorrowSingapore(), energy: 0}),
      energy_30_day: userTradeTable30Day.map(value => {
        return {
          date: value.time,
          energy: value.energy
        }
      }),
      price_today: userTradeTable1Day.map(value => {
        return {
          date: value.time,
          price: value.price
        }
      }).concat({date: this.getTomorrowSingapore(), price: minMaxAvg_today[0].averagePrice}),
      price_30_day: userTradeTable30Day.map(value => {
        return {
          date: value.time,
          price: value.price
        }
      }),
      peers_today: (await this.getConsumptionPeersForToday(userCell, timezoneName)).map(value => Object.assign(value, { balance: balance ? value.balance : null })),
      peers_30_days: (await this.getConsumptionPeersFor30Day(userCell, DAY_INTERVAL, timezoneName)).map(value => Object.assign(value, { balance: balance ? value.balance : null })),
    }
  }

  async getProductionPeersToday(cell: Cell, timezoneName: string): Promise<Array<{
    "total": string,
    "id": string,
    "balance": number,
    "sold": number,
    "price": number
  }>> {
    return await this.transactionRepository.query(`with t1 as (select c.name as total, sum(amount) as sold, sum(cost) as price
            from transaction
                     join cell c on transaction."fromId" = c.id
            where ("fromId" = ${cell.id}
               or "toId" = ${cell.id})
                and date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
                and time <= now()
            group by c.name)
select t1.total, cell."ethAddress" as id, cell.balance, t1.sold, t1.price
from cell join t1 on total = cell.name;`)
  }

  async getProductionPeers30Day(cell: Cell, daysInterval: number = 3, timezoneName: string): Promise<Array<{
    "total": string,
    "id": string,
    "balance": number,
    "sold": number,
    "price": number
  }>> {
    return await this.transactionRepository.query(`with t1 as (select c.name as total, sum(amount) as sold, sum(cost) as price
            from transaction
                     join cell c on transaction."fromId" = c.id
            where ("fromId" = ${cell.id}
               or "toId" = ${cell.id})
                and date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
                and time <= now()
            group by c.name)
select t1.total, cell."ethAddress" as id, cell.balance, t1.sold, t1.price
from cell join t1 on total = cell.name;`)
  }

  async userProduction(cellEthAddress: string, balance: boolean = true, daysInterval: number = 3, timezoneName: string, timezoneOffset: number): Promise<UserProduction | {}> {
    const userCell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: cellEthAddress
      }
    })

    const userTradeTable1Day: GraphicEntry[] = await this.tradeRepository.query(`select date_trunc('minute', time) as time, energy, price
from trade
where "cellId" = ${userCell.id}
  and date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
order by 1;`)
    const userTradeTable30Day: GraphicEntry[] = await this.tradeRepository.query(`select date(time) as time, sum(energy) as energy, avg(price) as price
from trade
where "cellId" = ${userCell.id}
  and date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
group by date(time)
order by 1;`)
    const minMaxAvg_today = await this.tradeRepository.query(`with t as (select date_trunc('minute', time) as time, energy, price
           from trade
           where "cellId" = ${userCell.id}
             and date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
           order by 1)
select min(energy) as "minEnergy", max(energy) as "maxEnergy", avg(energy) as "averageEnergy",
       max(price) as "minPrice", max(price) as "maxPrice", avg(price) as "averagePrice"
from t;`)

    const minMaxAvg_30 = await this.tradeRepository.query(`with t as (select date(time) as time, sum(energy) as energy, avg(price) as price
           from trade
           where "cellId" = ${userCell.id}
             and date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
           group by date(time)
           order by 1)
select min(energy) as "minEnergy",
       max(energy) as "maxEnergy",
       avg(energy) as "averageEnergy",
       max(price)  as "minPrice",
       max(price)  as "maxPrice",
       avg(price)  as "averagePrice"
from t;`)


    return {
      today: {
        ...minMaxAvg_today[0]
      },
      "30": {
        ...minMaxAvg_30[0]
      },
      energy_today: userTradeTable1Day.map(value => {
        return {
          date: value.time,
          energy: value.energy
        }
      }).concat({date: this.getTomorrowSingapore(), energy: 0}),
      energy_30_day: userTradeTable30Day.map(value => {
        return {
          date: value.time,
          energy: value.energy
        }
      }),
      price_today: userTradeTable1Day.map(value => {
        return {
          date: value.time,
          price: value.price
        }
      }).concat({date: this.getTomorrowSingapore(), price: minMaxAvg_today[0].averagePrice}),
      price_30_day: userTradeTable30Day.map(value => {
        return {
          date: value.time,
          price: value.price
        }
      }),
      peers_today: (await this.getProductionPeersToday(userCell, timezoneName)).map(value => Object.assign(value, { balance: balance ? value.balance : null })),
      peers_30_days: (await this.getProductionPeers30Day(userCell, DAY_INTERVAL, timezoneName)).map(value => Object.assign(value, { balance: balance ? value.balance : null })),
    }
  }

  async userTransactions(cellEthAddress: string, daysInterval: number = 3, timezoneName: string, timezoneOffset: number): Promise<UserTransactions | {}> {
    const myCell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: cellEthAddress
      }
    })
    const transactions_today = await this.transactionRepository.query(`select time as time,
       c2.name as "from",
       c.name   as "to",
       price,
       amount   as "transfer_energy",
       cost     as "transfer_coin"
from transaction join cell c on transaction."toId" = c.id join cell c2 on transaction."fromId" = c2.id
where date(now() at time zone '${timezoneName}') <= time at time zone '${timezoneName}'
and ("fromId"=${myCell.id} or "toId"=${myCell.id})
order by time desc;`)
    const transactions_30_days = await this.transactionRepository.query(`select time as time,
       c2.name as "from",
       c.name   as "to",
       price,
       amount   as "transfer_energy",
       cost     as "transfer_coin"
from transaction join cell c on transaction."toId" = c.id join cell c2 on transaction."fromId" = c2.id
where date(now() at time zone '${timezoneName}') - '${daysInterval} day'::interval <= time at time zone '${timezoneName}'
and ("fromId"=${myCell.id} or "toId"=${myCell.id})
order by time desc;`)

    return {
      transaction_today: transactions_today,
      transaction_30_days: transactions_30_days
    }
  }

  async userAnchor(ethAddress: string): Promise<UserAnchor | {}> {
    const cell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: ethAddress
      }
    })
    const user = await this.userRepository.findOneOrFail({
      where: {
        cell: cell
      }
    })
    const userAnchors = await this.anchorRepository.find({
      where: {
        user: user
      },
      relations: ['user', 'user.cell'],
      order: {
        time: "DESC"
      }
    })

    if (!userAnchors.length) {
      return {}
    }

    return {
      anchors: userAnchors.map(value => {
        return {
          data: value.time,
          participant: value.user.cell.name,
          hashId: value.hashId,
          address: value.address
        }
      })
    }
  }

  async postPrices(data: UserPrices, ethAddress: string) {
    const cell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: ethAddress
      }
    })
    await this.cellRepository.update({
      ethAddress: ethAddress
    }, {
      initPower: data.prices.map(value => value.amount),
      initPrice: data.prices.map(value => value.price)
    })
  }
}
