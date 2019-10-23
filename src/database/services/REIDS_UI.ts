import {
  AdminAnchor,
  AdminConsumptions,
  AdminProductions,
  Authorization,
  UserAnchor,
  UserConsumption,
  UserMargin,
  UserPrices,
  UserProduction,
  UserTransactions
} from "../../mockData/interfaces";
import { Raw } from "typeorm";
import { NodeDatabaseRepositories } from "./NodeDatabaseRepositories";
import { Cell, Transaction } from "../models";

const DEFAULT_BALANCE = -1

export class REIDS_UI extends NodeDatabaseRepositories {
  private readonly timeOffset: string

  constructor() {
    super();
    this.timeOffset = '8 hour'
  }




  async adminTransactions(): Promise<UserTransactions> {
    const transactions_today: Transaction[] = await this.transactionRepository.find({
      where: `now() - '1 day'::interval < time`,
      relations: ['from', 'to'],
      order: {
        time: "DESC"
      }
    })
    const transactions_30_days: Transaction[] = await this.transactionRepository.find({
      where: `now() - '30 day'::interval < time`,
      relations: ['from', 'to'],
      order: {
        time: "DESC"
      }
    })

    return {
      transaction_today: transactions_today.map(value => {
        return {
          time: value.time,
          from: value.from.name,
          to: value.to.name,
          price: value.price,
          transfer_energy: value.amount,
          transfer_coin: value.cost
        }
      }),
      transaction_30_days: transactions_30_days.map(value => {
        return {
          time: value.time,
          from: value.from.name,
          to: value.to.name,
          price: value.price,
          transfer_energy: value.amount,
          transfer_coin: value.cost
        }
      })
    }
  }

  async getAdminConsumptionPeers(): Promise<Array<{
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
      and time < now()
    group by c.name, c."ethAddress"
    order by c.name)
select total, cell."ethAddress" as "id", cell.balance, t1.bought, t1.price
from t1
         join cell on t1.total = cell.name;`)
  }
  async getAdminConsumptionPeersToday(): Promise<Array<{
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
      and time < now() and now() - '1 day'::interval < time
    group by c.name, c."ethAddress"
    order by c.name)
select total, cell."ethAddress" as "id", cell.balance, t1.bought, t1.price
from t1
         join cell on t1.total = cell.name;`)
  }
  async getAdminConsumptionPeers30Day(): Promise<Array<{
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
      and time < now() and now() - '30 day'::interval < time
    group by c.name, c."ethAddress"
    order by c.name)
select total, cell."ethAddress" as "id", cell.balance, t1.bought, t1.price
from t1
         join cell on t1.total = cell.name;`)
  }

  async getAdminProductionPeers(): Promise<Array<{
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
      and time < now()
    group by c.name, c."ethAddress"
    order by c.name)
select total, cell."ethAddress" as "id", cell.balance, t1.bought as sold, t1.price
from t1
         join cell on t1.total = cell.name;`)
  }
  async getAdminProductionPeersToday(): Promise<Array<{
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
      and time < now() and now() - '1 day'::interval < time
    group by c.name, c."ethAddress"
    order by c.name)
select total, cell."ethAddress" as "id", cell.balance, t1.bought as sold, t1.price
from t1
         join cell on t1.total = cell.name;`)
  }
  async getAdminProductionPeers30Day(): Promise<Array<{
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
      and time < now() and now() - '30 day'::interval < time
    group by c.name, c."ethAddress"
    order by c.name)
select total, cell."ethAddress" as "id", cell.balance, t1.bought as sold, t1.price
from t1
         join cell on t1.total = cell.name;`)
  }

  async adminConsumptions(): Promise<AdminConsumptions> {
    const entitiesToday: {time: string, energy: number, price: number}[] = await this.tradeRepository.query(`select date_trunc('minute', time) as time, sum(energy) as energy, avg(price) as price
from trade
where type = 'consumer'
  and date_trunc('day', now()) < time
group by date_trunc('minute', time)
order by 1;`)

    const entities30Today: {time: string, energy: number, price: number}[] = await this.tradeRepository.query(`select date(time), sum(energy) as energy, avg(price) as price
from trade
where type = 'consumer'
  and date_trunc('day', now()) < time
group by date(time)
order by 1;`)

    const minMaxAvg = await this.tradeRepository.query(`with t as (select date_trunc('minute', time) as time, sum(energy) as energy, avg(price) as price
from trade
where type = 'consumer'
  and date_trunc('day', now()) < time
group by date_trunc('minute', time)
order by 1)
select min(t.energy) as "minEnergy", max(t.energy) as "maxEnergy", avg(t.energy) as "averageEnergy",
       min(price) as "minPrice", max(price) as "maxPrice", avg(price) as "averagePrice"
from t;`)

    return {
      ...minMaxAvg[0],
      energy_today: entitiesToday.map(value => {
        return {
          date: value.time,
          energy: value.energy
        }
      }),
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
      }),
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
      peers_today: await this.getAdminConsumptionPeersToday(),
      peers_30_days: await this.getAdminConsumptionPeers30Day(),
    }
  }

  async adminProductions(): Promise<AdminProductions> {
    const entitiesToday: {time: string, energy: number, price: number}[] = await this.tradeRepository.query(`select date_trunc('minute', time) as time, sum(energy) as energy, avg(price) as price
from trade
where type = 'producer'
  and date_trunc('day', now()) < time
group by date_trunc('minute', time)
union
select date_trunc('minute', time) as time, sum("energyIn"+"energyOut") as energy, avg(price) as price
from trade
where type = 'prosumer'
  and date_trunc('day', now()) < time
group by date_trunc('minute', time)
order by 1;`)
    const entities30Today: {time: string, energy: number, price: number}[] = await this.tradeRepository.query(`with t as (select date(time) as time, sum(energy) as energy, sum(price) as price, count(1) as len
from trade
where type = 'producer'
  and now() - '30 day'::interval < time
group by date(time)
union
select date(time) as time, sum("energyIn"+"energyOut") as energy, sum(price) as price, count(1) as len
from trade
where type = 'prosumer'
  and now() - '30 day'::interval < time
group by date(time))
select t.date, sum(energy) as energy, sum(price)/sum(len) as price from t
group by t.date
order by 1;`)

    const minMaxAvg = await this.tradeRepository.query(`with t as (select date_trunc('minute', time) as time, sum(energy) as energy, avg(price) as price
from trade
where type = 'producer'
  and date_trunc('day', now()) < time
group by date_trunc('minute', time)
union
select date_trunc('minute', time) as time, sum("energyIn"+"energyOut") as energy, avg(price) as price
from trade
where type = 'prosumer'
  and date_trunc('day', now()) < time
group by date_trunc('minute', time)
order by 1)
select min(energy) as "minEnergy", max(energy) as "maxEnergy", avg(energy) as "averageEnergy",
       min(price) as "minPrice", max(price) as "maxPrice", avg(price) as "averagePrice"
from t;`)


    return {
      ...minMaxAvg[0],
      energy_today: entitiesToday.map(value => {
        return {
          date: value.time,
          energy: value.energy
        }
      }),
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
      }),
      price_30_day: entities30Today.map(value => {
        return {
          date: value.time,
          price: value.price
        }
      }),
      peers_today: await this.getAdminProductionPeersToday(),
      peers_30_days: await this.getAdminProductionPeers30Day()
    }
  }

  async adminAnchor(): Promise<AdminAnchor> {
    const anchors = await this.anchorRepository.find({
      relations: ['user', 'user.cell']
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

  async userProsumerConsumption(cellEthAddress: string): Promise<UserConsumption | {}> {
    const userCell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: cellEthAddress
      }
    })

    const userTradeTable = await this.tradeRepository.find({
      where: {
        type: 'prosumer',
        cell: userCell
      },
      relations: ['cell']
    })

    if (!userTradeTable.length) {
      return {}
    }

    const userTradeTable1Day = await this.tradeRepository.find({
      where: {
        type: 'prosumer',
        cell: userCell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'1 day\'::interval and ${columnAlias} <= now()`)
      }
    })
    const userTradeTable30Day = await this.tradeRepository.find({
      where: {
        type: 'prosumer',
        cell: userCell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'30 day\'::interval and ${columnAlias} <= now()`)
      }
    })
    if (typeof userTradeTable[0].energyIn != "number")
      throw new Error('user trade table seems to be empty')
    const minE = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.energyIn != "number")
        throw new Error('energyIn is null')
      return currentValue.energyIn < previousValue ? currentValue.energyIn : previousValue
    }, userTradeTable[0].energyIn)
    const maxE = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.energyIn != "number")
        throw new Error('energyIn is null')
      return currentValue.energyIn > previousValue ? currentValue.energyIn : previousValue
    }, userTradeTable[0].energyIn)
    const avgE = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.energyIn != "number")
        throw new Error('energyIn is null')
      return currentValue.energyIn + previousValue
    }, 0) / userTradeTable.length

    if (typeof userTradeTable[0].price != "number")
      throw new Error('user trade table seems to be empty')
    const minPrice = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.price != "number")
        throw new Error('price is null')
      return currentValue.price < previousValue ? currentValue.price : previousValue
    }, userTradeTable[0].price)
    const maxPrice = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.price != "number")
        throw new Error('price is null')
      return currentValue.price > previousValue ? currentValue.price : previousValue
    }, userTradeTable[0].price)
    const avgPrice = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.price != "number")
        throw new Error('price is null')
      return currentValue.price + previousValue
    }, 0) / userTradeTable.length


    return {
      minEnergy: minE,
      maxEnergy: maxE,
      averageEnergy: avgE,
      minPrice: minPrice,
      maxPrice: maxPrice,
      averagePrice: avgPrice,
      energy_today: userTradeTable1Day.map(value => {
        if (typeof value.energyIn != "number")
          throw new Error('null energyIn')
        return {
          date: value.time,
          energy: value.energyIn
        }
      }),
      energy_30_day: userTradeTable30Day.map(value => {
        if (typeof value.energyIn != "number")
          throw new Error('null energyIn')
        return {
          date: value.time,
          energy: value.energyIn
        }
      }),
      price_today: userTradeTable1Day.map(value => {
        if (typeof value.price != "number")
          throw new Error('null price')
        return {
          date: value.time,
          price: value.price
        }
      }),
      price_30_day: userTradeTable30Day.map(value => {
        if (typeof value.price != "number")
          throw new Error('null price')
        return {
          date: value.time,
          price: value.price
        }
      }),
      consumption_peers: userTradeTable.map(value => {
        if (typeof value.energyIn != "number")
          throw new Error('null energyIn')
        return {
          total: value.cell.name,
          id: value.cell.ethAddress,
          balance: value.cell.balance || DEFAULT_BALANCE,
          bought: value.energyIn,
          price: value.price
        }
      })
    }
  }

  async  userProsumerProduction(cellEthAddress: string, period?: string): Promise<UserProduction | {}> {
    const userCell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: cellEthAddress
      }
    })
    const userTradeTable = await this.tradeRepository.find({
      where: {
        type: 'prosumer',
        cell: userCell
      },
      relations: ['cell']
    })
    if (!userTradeTable.length) {
      return {}
    }

    const userTradeTable1Day = await this.tradeRepository.find({
      where: {
        type: 'prosumer',
        cell: userCell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'1 day\'::interval and ${columnAlias} <= now()`)
      }
    })
    const userTradeTable30Day = await this.tradeRepository.find({
      where: {
        type: 'prosumer',
        cell: userCell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'30 day\'::interval and ${columnAlias} <= now()`)
      }
    })

    if (!userTradeTable[0].energyOut)
      throw new Error('user trade table seems to be empty')
    const minE = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.energyOut != "number")
        throw new Error('energyOut is null')
      return currentValue.energyOut < previousValue ? currentValue.energyOut : previousValue
    }, userTradeTable[0].energyOut)
    const maxE = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.energyOut != "number")
        throw new Error('energyOut is null')
      return currentValue.energyOut > previousValue ? currentValue.energyOut : previousValue
    }, userTradeTable[0].energyOut)
    const avgE = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.energyOut != "number")
        throw new Error('energyOut is null')
      return currentValue.energyOut + previousValue
    }, 0) / userTradeTable.length


    if (typeof userTradeTable[0].price != "number")
      throw new Error('user trade table seems to be empty')
    const minPrice = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.price != "number")
        throw new Error('price is null')
      return currentValue.price < previousValue ? currentValue.price : previousValue
    }, userTradeTable[0].price)
    const maxPrice = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.price != "number")
        throw new Error('price is null')
      return currentValue.price > previousValue ? currentValue.price : previousValue
    }, userTradeTable[0].price)
    const avgPrice = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.price != "number")
        throw new Error('price is null')
      return currentValue.price + previousValue
    }, 0) / userTradeTable.length


    return {
      minEnergy: minE,
      maxEnergy: maxE,
      averageEnergy: avgE,
      minPrice: minPrice,
      maxPrice: maxPrice,
      averagePrice: avgPrice,
      energy_today: userTradeTable1Day.map(value => {
        if (typeof value.energyOut != "number")
          throw new Error('null energyOut')
        return {
          date: value.time,
          energy: value.energyOut
        }
      }),
      energy_30_day: userTradeTable30Day.map(value => {
        if (typeof value.energyOut != "number")
          throw new Error('null energyOut')
        return {
          date: value.time,
          energy: value.energyOut
        }
      }),
      price_today: userTradeTable1Day.map(value => {
        if (typeof value.price != "number")
          throw new Error('null price')
        return {
          date: value.time,
          price: value.price
        }
      }),
      price_30_day: userTradeTable30Day.map(value => {
        if (typeof value.price != "number")
          throw new Error('null price')
        return {
          date: value.time,
          price: value.price
        }
      }),
      // production_peers: userTradeTable.map(value => {
      //   if (typeof value.energyOut != "number")
      //     throw new Error('null energy')
      //   return {
      //     total: value.cell.name,
      //     id: value.cell.ethAddress,
      //     balance: value.cell.balance || DEFAULT_BALANCE,
      //     sold: value.energyOut,
      //     price: value.price
      //   }
      // })
      peers_today: await this.getProductionPeersToday(userCell),
      peers_30_days: await this.getProductionPeers30Day(userCell)
    }
  }



  async getUserTransactionsToday(cell: Cell): Promise<Transaction[]> {
    const transactionsFrom = await this.transactionRepository.find({
      where: {
        from: cell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'1 day\'::interval and ${columnAlias} <= now()`)
      }
    })
    const transactionsTo = await this.transactionRepository.find({
      where: {
        to: cell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'1 day\'::interval and ${columnAlias} <= now()`)
      }
    })

    return transactionsTo.concat(transactionsFrom)
  }

  async getUserTransactions30Day(cell: Cell): Promise<Transaction[]> {
    const transactionsFrom = await this.transactionRepository.find({
      where: {
        from: cell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'30 day\'::interval and ${columnAlias} <= now()`)
      }
    })
    const transactionsTo = await this.transactionRepository.find({
      where: {
        to: cell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'30 day\'::interval and ${columnAlias} <= now()`)
      }
    })

    return transactionsTo.concat(transactionsFrom)
  }

  async getUserTransactions(cell: Cell): Promise<Transaction[]> {
    const transactionsFrom = await this.transactionRepository.find({
      where: {
        from: cell
      }
    })
    const transactionsTo = await this.transactionRepository.find({
      where: {
        to: cell
      }
    })

    return transactionsFrom.concat(transactionsTo)
  }

  async getConsumptionPeersForToday(cell: Cell): Promise<Array<{
    "total": string,
    "id": string,
    "balance": number,
    "bought": number,
    "price": number
  }>> {
    return await this.transactionRepository.query(`with t1 as (select c.name as "total", sum(amount) as bought, sum(cost) as "price" from transaction join cell c on transaction."toId" = c.id
where ("fromId" = ${cell.id} or "toId"=${cell.id}) and now() - '1 day'::interval < time
group by c.name, c."ethAddress"
order by c.name)
    select total, cell."ethAddress" as "id", cell.balance, t1.bought, t1.price from t1 join cell on t1.total = cell.name;`)
  }

  async getConsumptionPeersFor30Day(cell: Cell): Promise<Array<{
    "total": string,
    "id": string,
    "balance": number,
    "bought": number,
    "price": number
  }>> {
    return await this.transactionRepository.query(`with t1 as (select c.name as "total", sum(amount) as bought, sum(cost) as "price" from transaction join cell c on transaction."toId" = c.id
where ("fromId" = ${cell.id} or "toId"=${cell.id}) and now() - '30 day'::interval < time
group by c.name, c."ethAddress"
order by c.name)
    select total, cell."ethAddress" as "id", cell.balance, t1.bought, t1.price from t1 join cell on t1.total = cell.name;`)
  }

  async getConsumptionPeersForAllTime(cell: Cell): Promise<Array<{
    "total": string,
    "id": string,
    "balance": number,
    "bought": number,
    "price": number
  }>> {
    return await this.transactionRepository.query(`with t1 as (
    select c.name as "total", sum(amount) as bought, sum(cost) as "price"
    from transaction
             join cell c on transaction."toId" = c.id
    where ("fromId" = 2 or "toId" = 2)
      and time < now()
    group by c.name, c."ethAddress"
    order by c.name)
select total, cell."ethAddress" as "id", cell.balance, t1.bought, t1.price
from t1
         join cell on t1.total = cell.name;`)
  }

  async userConsumption(cellEthAddress: string, period?: string): Promise<UserConsumption | {}> {
    const userCell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: cellEthAddress
      }
    })
    if (userCell.type != 'consumer') {
      throw new Error('not a consumer')
    }

    const userTradeTable1Day: {time: string, energy: number, price: number}[] = await this.tradeRepository.query(`select date_trunc('minute', time) as time, energy, price from trade
where "cellId" = ${userCell.id}
and date_trunc('day', now()) < time
order by 1;`)
    const userTradeTable30Day: {time: string, energy: number, price: number}[] = await this.tradeRepository.query(`select date(time) as time, sum(energy) as energy, avg(price) as price from trade
where "cellId" = ${userCell.id}
and now() - '30 day'::interval < time
group by date(time)
order by 1;`)
    const minMaxAvg = await this.tradeRepository.query(`with t as (select date_trunc('minute', time) as time, energy, price
           from trade
           where "cellId" = ${userCell.id}
             and date_trunc('day', now()) < time
           order by 1)
select min(energy) as "minEnergy", max(energy) as "maxEnergy", avg(energy) as "averageEnergy",
       max(price) as "minPrice", max(price) as "maxPrice", avg(price) as "averagePrice"
from t;`)

    return {
      ...minMaxAvg[0],
      energy_today: userTradeTable1Day.map(value => {
        return {
          date: value.time,
          energy: value.energy
        }
      }),
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
      }),
      price_30_day: userTradeTable30Day.map(value => {
        return {
          date: value.time,
          price: value.price
        }
      }),
      peers_today: await this.getConsumptionPeersForToday(userCell),
      peers_30_days: await this.getConsumptionPeersFor30Day(userCell),
    }
  }

  async getProductionPeersToday(cell: Cell): Promise<Array<{
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
                and now() - '1 day'::interval < time
                and time <= now()
            group by c.name)
select t1.total, cell."ethAddress" as id, cell.balance, t1.sold, t1.price
from cell join t1 on total = cell.name;`)
  }

  async getProductionPeers30Day(cell: Cell): Promise<Array<{
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
                and now() - '30 day'::interval < time
                and time <= now()
            group by c.name)
select t1.total, cell."ethAddress" as id, cell.balance, t1.sold, t1.price
from cell join t1 on total = cell.name;`)
  }

  async getProductionPeersAllTime(cell: Cell): Promise<Array<{
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
                and time <= now()
            group by c.name)
select t1.total, cell."ethAddress" as id, cell.balance, t1.sold, t1.price
from cell join t1 on total = cell.name;`)
  }

  async userProduction(cellEthAddress: string, period?: string): Promise<UserProduction | {}> {
    const userCell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: cellEthAddress
      }
    })
    const userTradeTable = await this.tradeRepository.find({
      where: {
        type: 'producer',
        cell: userCell
      },
      relations: ['cell']
    })


    const userTradeTable1Day = await this.tradeRepository.find({
      where: {
        type: 'producer',
        cell: userCell,
        time: Raw(columnAlias => `${columnAlias} > now() - '1 day'::interval and ${columnAlias} <= now()`)
      }
    })
    const userTradeTable30Day = await this.tradeRepository.find({
      where: {
        type: 'producer',
        cell: userCell,
        time: Raw(columnAlias => `${columnAlias} > now() - '30 day'::interval and ${columnAlias} <= now()`)
      }
    })

    if (!userTradeTable[0].energy)
      throw new Error('user trade table seems to be empty')
    const minE = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.energy != "number")
        throw new Error('energy is null')
      return currentValue.energy < previousValue ? currentValue.energy : previousValue
    }, userTradeTable[0].energy)
    const maxE = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.energy != "number")
        throw new Error('energy is null')
      return currentValue.energy > previousValue ? currentValue.energy : previousValue
    }, userTradeTable[0].energy)
    const avgE = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.energy != "number")
        throw new Error('energy is null')
      return currentValue.energy + previousValue
    }, 0) / userTradeTable.length


    if (typeof userTradeTable[0].price != "number")
      throw new Error('user trade table seems to be empty')
    const minPrice = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.price != "number")
        throw new Error('price is null')
      return currentValue.price < previousValue ? currentValue.price : previousValue
    }, userTradeTable[0].price)
    const maxPrice = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.price != "number")
        throw new Error('price is null')
      return currentValue.price > previousValue ? currentValue.price : previousValue
    }, userTradeTable[0].price)
    const avgPrice = userTradeTable.reduce((previousValue, currentValue) => {
      if (typeof currentValue.price != "number")
        throw new Error('price is null')
      return currentValue.price + previousValue
    }, 0) / userTradeTable.length


    return {
      minEnergy: minE,
      maxEnergy: maxE,
      averageEnergy: avgE,
      minPrice: minPrice,
      maxPrice: maxPrice,
      averagePrice: avgPrice,
      energy_today: userTradeTable1Day.map(value => {
        if (typeof value.energy != "number")
          throw new Error('null energy')
        return {
          date: value.time,
          energy: value.energy
        }
      }),
      energy_30_day: userTradeTable30Day.map(value => {
        if (typeof value.energy != "number")
          throw new Error('null energy')
        return {
          date: value.time,
          energy: value.energy
        }
      }),
      price_today: userTradeTable1Day.map(value => {
        if (typeof value.price != "number")
          throw new Error('null price')
        return {
          date: value.time,
          price: value.price
        }
      }),
      price_30_day: userTradeTable30Day.map(value => {
        if (typeof value.price != "number")
          throw new Error('null price')
        return {
          date: value.time,
          price: value.price
        }
      }),
      // production_peers: userTradeTable.map(value => {
      //   if (typeof value.energy != "number")
      //     throw new Error('null energy')
      //   return {
      //     total: value.cell.name,
      //     id: value.cell.ethAddress,
      //     balance: value.cell.balance || DEFAULT_BALANCE,
      //     sold: value.energy,
      //     price: value.price
      //   }
      // })
      peers_today: await this.getProductionPeersToday(userCell),
      peers_30_days: await this.getProductionPeers30Day(userCell)
    }
  }

  async userTransactions(cellEthAddress: string): Promise<UserTransactions | {}> {
    const myCell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: cellEthAddress
      }
    })
    const transactions_today = await this.transactionRepository.find({
      where: `("fromId" = ${myCell.id} or "toId" = ${myCell.id}) and now() - '1 day'::interval < time`,
      relations: ['from', 'to'],
      order: {
        time: "DESC"
      }
    })
    const transactions_30_days = await this.transactionRepository.find({
      where: `("fromId" = ${myCell.id} or "toId" = ${myCell.id}) and now() - '30 day'::interval < time`,
      relations: ['from', 'to'],
      order: {
        time: "DESC"
      }
    })

    return {
      transaction_today: transactions_today.map(value => {
        return {
          time: value.time,
          from: value.from.name,
          to: value.to.name,
          price: value.price,
          transfer_energy: value.amount,
          transfer_coin: value.cost
        }
      }),
      transaction_30_days: transactions_30_days.map(value => {
        return {
          time: value.time,
          from: value.from.name,
          to: value.to.name,
          price: value.price,
          transfer_energy: value.amount,
          transfer_coin: value.cost
        }
      })
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
      relations: ['user', 'user.cell']
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
