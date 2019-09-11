import NodeDatabase from './NodeDatabase'
import { CellRepository } from "./repositories/CellRepository";
import { getCustomRepository, Raw } from "typeorm";
import { TradeRepository } from "./repositories/TradeRepository";
import { TransactionRepository } from "./repositories/TransactionRepository";
import { UserRepository } from "./repositories/UserRepository";
import { initialMockData } from "../mockData/config";
import fetchDataFromAMIGO from "../mockData/fetchDataFromAMIGO";
import { DataFromAMIGO, HashingInfo } from "../mockData/interfaces";
import { onNewTransaction } from "../workers/onNewTransaction";

export class NodeDatabaseService {
  private readonly db: NodeDatabase
  public readonly cellRepository: CellRepository = getCustomRepository(CellRepository)
  public readonly tradeRepository: TradeRepository = getCustomRepository(TradeRepository)
  public readonly transactionRepository: TransactionRepository = getCustomRepository(TransactionRepository)
  public readonly userRepository: UserRepository = getCustomRepository(UserRepository)

  constructor (db: NodeDatabase) {
    this.db = db
  }

  async initMockData() {
    console.log('Initializing mock data...');
    if (!(await this.cellRepository.find({})).length) {
      await Promise.all(initialMockData.consumers.map(value => {
        return this.cellRepository.insert({
          balance: value.balance,
          ethAddress: value.consumerId,
          name: value.name,
          type: 'consumer'
        })
      }))
      await this.cellRepository.insert({
        name: initialMockData.operator.name,
        ethAddress: initialMockData.operator.operatorId,
        opCoef: initialMockData.operator.opCoef,
        balance: initialMockData.operator.balance,
        type: 'operator'
      })

      await Promise.all(initialMockData.producers.map(value => {
        return this.cellRepository.insert({
          ethAddress: value.producerId,
          name: value.name,
          initPower: value.initPower,
          initPrice: value.initPrice,
          balance: value.balance,
          type: 'producer'
        })
      }))
      initialMockData.prosumers.map(value => {
        return this.cellRepository.insert({
          ethAddress: value.prosumerId,
          name: value.name,
          margin: value.margin,
          balance: value.balance,
          type: 'prosumer'
        })
      })

      console.log('Mock data for cells was added');
    }

    if (!(await this.userRepository.find({})).length) {
      await Promise.all(initialMockData.users.map(async value => {
        const cell = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: value.cellId
          }
        })
        return this.userRepository.insert({
          email: value.email,
          password: value.password,
          cell: cell
        })
      }))
      console.log('Mock data for users was added.');
    }
    console.log('Mock data initialization ended.');
  }

  fetchDataFromAMIGO() {
    // setInterval(async() => {
    //   await fetchDataFromAMIGO('http:/127.0.0.1')
    //     .then(value => {
    //       this.handleDataFromAMIGO(value)
    //     })
    //   this.sendNewTransactionsToMQTT()
    // }, 2000)
  }

  async handleDataFromAMIGO(data: DataFromAMIGO) {
    // console.log('Got data: ', data);

    // 1. Inserting new entries
    await Promise.all(data.producers.map(async value => {
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.producerId
        }
      })
      await this.tradeRepository.insert({
        time: value.time.toISOString(),
        energy: value.energy,
        power: value.power,
        cell: cell,
        type: 'producer'
      })
    }))
    await Promise.all(data.consumers.map(async value => {
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.consumerId
        }
      })

      await this.tradeRepository.insert({
        cell: cell,
        time: value.time.toISOString(),
        energy: value.energy,
        type: 'consumer'
      })
    }))
    await Promise.all(data.prosumers.map(async value => {
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.prosumerId
        }
      })

      const tmp = await this.tradeRepository.findOne({
        where: {
          cell: cell
        },
        order: {
          energyInAll: "DESC"
        }
      })


      await this.tradeRepository.insert({
        cell: cell,
        time: value.time.toISOString(),
        energyIn: value.energyIn,
        energyOut: value.energyOut,
        type: 'prosumer',
        energyInAll: (tmp ? (tmp.energyInAll ? tmp.energyInAll : 0) : 0) + value.energyIn
      })
    }))
    // 2. Pip, avPrice
    await Promise.all(data.prosumers.map(async value => {
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.prosumerId
        }
      })
      const lastProsumerCell = await this.tradeRepository.findOneOrFail({
        where: {
          cell: cell
        },
        order: {
          time: "DESC"
        }
      })
      const pip: boolean = value.energyOut > value.energyIn

      const prosumersWithNoPip = await this.tradeRepository.find({
        where: {
          cell: cell,
          pip: false
        }
      })

      let avPrice: number
      if (prosumersWithNoPip.length)
        avPrice = prosumersWithNoPip.reduce((previousValue, currentValue) => previousValue + currentValue.price, 0)/prosumersWithNoPip.length
      else
        avPrice = 0


      await this.tradeRepository.update({
        id: lastProsumerCell.id
      }, {
        pip: pip,
        avPrice: avPrice
      })
    }))

    // 3. Price: Working with producers
    await Promise.all(data.producers.map(async value => {
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.producerId
        }
      })
      const lastProducerEntry = await this.tradeRepository.findOneOrFail({
        where: {
          cell: cell
        },
        order: {
          time: "DESC"
        }
      })
      if (!cell.initPrice)
        throw new Error('initPrice is null')
      if (!cell.initPower)
        throw new Error('initPower is null')

      let index
      if (value.power > cell.initPower[-1])
        index = -1
      else
        index = cell.initPower.reduce((previousValue, currentValue) => {
        return previousValue + (value.power < currentValue ? 1 : 0)
      }, 0)
      const price = cell.initPrice[index]

      await this.tradeRepository.update({
        id: lastProducerEntry.id
      }, {
        price: price
      })
    }))

    // 3. Price: Working with prosumers
    let priceForConsumerAndProsumer: number
    await Promise.all(data.prosumers.map(async value => {
      // Finding prosumer cell in database
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.prosumerId
        }
      })
      // Finding last entry in trade table
      const lastProsumerTrade = await this.tradeRepository.findOneOrFail({
        where: {
          cell: cell
        },
        order: {
          time: "DESC"
        }
      })

      // Calculating price for prosumer
      const Trade_producer_table = await this.tradeRepository.find({
        where: {
          type: 'producer'
        }
      })
      const Trade_prosumer_table = await this.tradeRepository.find({
        where: {
          type: 'prosumer'
        }
      })
      const Trade_consumer_table = await this.tradeRepository.find({
        where: {
          type: 'consumer'
        }
      })

      const S1 = Trade_producer_table.reduce((previousValue, currentValue) => {
        if (!currentValue.energy)
          throw new Error('producer table consists null \"energy\" field.')
        return previousValue + currentValue.energy * currentValue.price
      }, 0)

      const S2 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
        if (!cell.margin)
          throw new Error('margin is null')
        if (typeof currentValue.pip !== 'boolean')
          throw new Error('prosumer table contains null \"pip\" field.')
        if (!currentValue.energyOut)
          throw new Error('energyOut is null')
        if (!currentValue.energyIn)
          throw new Error('energyIn in null')
        if (typeof currentValue.avPrice !== "number")
          throw new Error('avPrice is null')
        return previousValue + (currentValue.pip ? 1 : 0) * Math.abs(currentValue.energyOut - currentValue.energyIn) * currentValue.avPrice * (1 + cell.margin / 100)
      }, 0)

      const S3 = Trade_producer_table.reduce((previousValue, currentValue) => {
        if (!currentValue.energy)
          throw new Error('energy is null')
        return previousValue + currentValue.energy
      }, 0)

      const S4 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
        if (typeof currentValue.pip !== "boolean")
          throw new Error('pip is null')
        if (!currentValue.energyOut)
          throw new Error('energuOut is null')
        if (!currentValue.energyIn)
          throw new Error('energyIn is null')

        return previousValue + (currentValue.pip ? 1 : 0) * Math.abs(currentValue.energyIn - currentValue.energyOut)
      }, 0)

      priceForConsumerAndProsumer = (S1 + S2) / (S3 + S4)

      // calculating pay
      let pay: number
      if (typeof lastProsumerTrade.pip !== 'boolean')
        throw new Error('pip has type different from boolean')
      if (lastProsumerTrade.pip) {
        pay = 0
      }
      else {
        if (!lastProsumerTrade.energyIn)
          throw new Error('energyIn is null')
        if (!lastProsumerTrade.energyOut)
          throw new Error('energyOut is null')

        const S5 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
          if (!currentValue.energyOut)
            throw new Error('energuOut is null')
          return previousValue + currentValue.energyOut
        }, 0)
        const S6 = Trade_consumer_table.reduce((previousValue, currentValue) => {
          if (!currentValue.energy)
            throw new Error('energy is null')
          return previousValue + currentValue.energy
        }, 0)
        const S7 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
          if (!currentValue.energyIn)
            throw new Error('energyIn is null')
          return previousValue + currentValue.energyIn
        }, 0)
        pay = priceForConsumerAndProsumer*((lastProsumerTrade.energyIn - lastProsumerTrade.energyOut) + lastProsumerTrade.energyIn*(S3 + S5 - S6 - S7)  / (S6 + S7))
      }

      await this.tradeRepository.update({
        id: lastProsumerTrade.id
      }, {
        price: priceForConsumerAndProsumer,
        pay: pay
      })
    }))

    // 3, 4. Price, pay: working with consumers
    await Promise.all(data.consumers.map(async value => {
      // Finding consumer cell
      const cell = await this.cellRepository.findOneOrFail({
        ethAddress: value.consumerId
      })

      // Finding last entry in trade table
      const lastConsumerInTradeTable = await this.tradeRepository.findOneOrFail({
        where: {
          cell: cell
        },
        order: {
          time: "DESC"
        }
      })
      const Trade_consumer_table = await this.tradeRepository.find({
        type: 'consumer'
      })
      const Trade_producer_table = await this.tradeRepository.find({
        type: 'producer'
      })
      const Trade_prosumer_table = await this.tradeRepository.find({
        type: 'prosumer'
      })

      if (!lastConsumerInTradeTable.energy)
        throw new Error('energy is null')

      const S1 = Trade_producer_table.reduce((previousValue, currentValue) => {
        if (!currentValue.energy)
          throw new Error('energy is null')
        return previousValue + currentValue.energy
      }, 0)
      const S2 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
        if (!currentValue.energyOut)
          throw new Error('energyOut is null')
        return previousValue + currentValue.energyOut
      }, 0)
      const S3 = Trade_consumer_table.reduce((previousValue, currentValue) => {
        if (!currentValue.energy)
          throw new Error('energy is null')
        return previousValue + currentValue.energy
      }, 0)
      const S4 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
        if (!currentValue.energyIn)
          throw new Error('energyIn is null')
        return previousValue + currentValue.energyIn
      }, 0)

      const pay = priceForConsumerAndProsumer * (lastConsumerInTradeTable.energy + lastConsumerInTradeTable.energy*(S1 + S2 - S3 - S4) / (S3 + S4))
      await this.tradeRepository.update({
        id: lastConsumerInTradeTable.id
        },
        {
          price: priceForConsumerAndProsumer,
          pay: pay
        })
    }))

    // 5. Creating transactions
    const operator = await this.cellRepository.findOneOrFail({
      where: {
        type: 'operator'
      }
    })
    if (!operator.opCoef)
      throw new Error('opCoef is null')
    // From every consumer to every producer
    for(let i = 0; i < data.consumers.length; i++) {
      for (let j = 0; j < data.producers.length; j++) {
        const consumer = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: data.consumers[i].consumerId
          }
        })
        const consumerTrade = await this.tradeRepository.findOneOrFail({
          where: {
            cell: consumer
          },
          order: {
            time: "DESC"
          }
        })
        const producer = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: data.producers[j].producerId
          }
        })
        const producerTrade = await this.tradeRepository.findOneOrFail({
          where: {
            cell: producer
          },
          order: {
            time: "DESC"
          }
        })
        const producers = await this.tradeRepository.find({
          where: {
            type: 'producer'
          }
        })
        const S1 = producers.reduce((previousValue, currentValue) => {
          if (!currentValue.energy)
            throw new Error('energy is null')
          return previousValue + currentValue.energy
        }, 0)

        const prosumers = await this.tradeRepository.find({
          where: {
            type: 'prosumer'
          }
        })
        const S2 = prosumers.reduce((previousValue, currentValue) => {
          if (typeof currentValue.pip !== "boolean")
            throw new Error('pip is not boolean')
          if (!currentValue.energyIn)
            throw new Error('energyIn is null')
          if (!currentValue.energyOut)
            throw new Error('energyOut is null')

          return previousValue + (currentValue.pip ? 1 : 0) * Math.abs(currentValue.energyOut - currentValue.energyIn)
        }, 0)

        if (typeof consumerTrade.pay !== 'number')
          throw new Error("pay is null")
        if (!producerTrade.energy)
          throw new Error('energy is null')

        const cost = consumerTrade.pay * (1-operator.opCoef/100)*producerTrade.energy / (S1 + S2)
        const price = consumerTrade.price

        await this.transactionRepository.insert({
          cost: cost,
          from: consumer,
          to: producer,
          time: new Date(Date.now()).toISOString(),
          price: price, //todo: is it correct?
          amount: cost/consumerTrade.price,
          approved: false
        })
      }
    }

    // From every prosumer (pip=0) to every producer
    for (let i = 0; i < data.producers.length; i++) {
      for (let j = 0; j < data.prosumers.length; j++) {
        const prosumer = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: data.prosumers[j].prosumerId
          }
        })

        const prosumerTrade = await this.tradeRepository.findOneOrFail({
          where: {
            cell: prosumer
          },
          order: {
            time: "DESC"
          }
        })
        const producer = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: data.producers[i].producerId
          }
        })
        const producerTrade = await this.tradeRepository.findOneOrFail({
          where: {
            cell: producer
          },
          order: {
            time: "DESC"
          }
        })

        const producers = await this.tradeRepository.find({
          where: {
            type: 'producer'
          }
        })
        const S1 = producers.reduce((previousValue, currentValue) => {
          if (!currentValue.energy)
            throw new Error('energy is null')
          return previousValue + currentValue.energy
        }, 0)
        const prosumers = await this.tradeRepository.find({
          where: {
            type: 'prosumer'
          }
        })
        const S2 = prosumers.reduce((previousValue, currentValue) => {
          if (typeof currentValue.pip !== 'boolean')
            throw new Error('pip is noi boolean')
          if (!currentValue.energyOut)
            throw new Error('energyOut is null')
          if (!currentValue.energyIn)
            throw new Error('energyIn is null')

          return previousValue + (currentValue.pip ? 1 : 0) * Math.abs(currentValue.energyOut - currentValue.energyIn)
        }, 0)

        if (typeof prosumerTrade.pip !== 'boolean')
          throw new Error('pip is not boolean')

        if (!prosumerTrade.pip) {
          if (typeof prosumerTrade.pay !== 'number')
            throw new Error('pay is null')
          if (!producerTrade.energy)
            throw new Error('energy is null')

          const cost = prosumerTrade.pay*(1-operator.opCoef/100)*producerTrade.energy / (S1 + S2)
          const price = prosumerTrade.price

          await this.transactionRepository.insert({
            cost: cost,
            from: prosumer,
            to: producer,
            time: new Date(Date.now()).toISOString(),
            price: price, //todo: is it correct
            amount: cost/price,
            approved: false
          })
        }
      }
    }


    // From every consumer to every prosumer (pip = 1)
    for (let i = 0; i < data.consumers.length; i++) {
      for (let j = 0; j < data.prosumers.length; j++) {
        const consumer = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: data.consumers[i].consumerId
          }
        })
        const consumerTrade = await this.tradeRepository.findOneOrFail({
          where: {
            cell: consumer
          },
          order: {
            time: "DESC"
          }
        })
        const prosumer = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: data.prosumers[j].prosumerId
          }
        })
        const prosumerTrade = await this.tradeRepository.findOneOrFail({
          where: {
            cell: prosumer
          },
          order: {
            time: "DESC"
          }
        })

        const producers = await this.tradeRepository.find({
          where: {
            type: 'producer'
          }
        })
        const S1 = producers.reduce((previousValue, currentValue) => {
          if (!currentValue.energy)
            throw new Error('energy is null')
          return previousValue + currentValue.energy
        }, 0)
        const prosumers = await this.tradeRepository.find({
          where: {
            type: 'prosumer'
          }
        })
        const S2 = prosumers.reduce((previousValue, currentValue) => {
          if (typeof currentValue.pip !== 'boolean')
            throw new Error('pip is noi boolean')
          if (!currentValue.energyOut)
            throw new Error('energyOut is null')
          if (!currentValue.energyIn)
            throw new Error('energyIn is null')

          return previousValue + (currentValue.pip ? 1 : 0) * Math.abs(currentValue.energyOut - currentValue.energyIn)
        }, 0)

        if (typeof prosumerTrade.pip !== 'boolean')
          throw new Error('pip is not boolean')
        if (prosumerTrade.pip) {
          if (typeof consumerTrade.pay !== 'number')
            throw new Error('pay is null')
          if (!prosumerTrade.energyIn)
            throw new Error('energyIn is null')
          if (!prosumerTrade.energyOut)
            throw new Error('energyOut is null')

          const cost = consumerTrade.pay * (1-operator.opCoef/100)*(prosumerTrade.energyOut-prosumerTrade.energyIn) / (S1 + S2)
          const price = consumerTrade.price
          await this.transactionRepository.insert({
            cost: cost,
            time: new Date(Date.now()).toISOString(),
            from: consumer,
            to: prosumer,
            price: price, //todo: is it correct?
            amount: cost/price,
            approved: false
          })
        }
      }
    }

    // From every prosumer (pip = 0) to every prosumer (pip = 1)
    for (let i = 0; i < data.prosumers.length; i++) {
      for (let j = i+1; j < data.prosumers.length; j++) {
        const prosumer1 = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: data.prosumers[i].prosumerId
          }
        })
        const prosumer2 = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: data.prosumers[j].prosumerId
          }
        })
        const prosumer1Trade = await this.tradeRepository.findOneOrFail({
          where: {
            cell: prosumer1
          },
          order: {
            time: "DESC"
          }
        })
        const prosumer2Trade = await this.tradeRepository.findOneOrFail({
          where: {
            cell: prosumer2
          },
          order: {
            time: "DESC"
          }
        })
        const producers = await this.tradeRepository.find({
          where: {
            type: 'producer'
          }
        })
        const S1 = producers.reduce((previousValue, currentValue) => {
          if (!currentValue.energy)
            throw new Error('energy is null')
          return previousValue + currentValue.energy
        }, 0)
        const prosumers = await this.tradeRepository.find({
          where: {
            type: 'prosumer'
          }
        })
        const S2 = prosumers.reduce((previousValue, currentValue) => {
          if (typeof currentValue.pip !== 'boolean')
            throw new Error('pip is noi boolean')
          if (!currentValue.energyOut)
            throw new Error('energyOut is null')
          if (!currentValue.energyIn)
            throw new Error('energyIn is null')

          return previousValue + (currentValue.pip ? 1 : 0) * Math.abs(currentValue.energyOut - currentValue.energyIn)
        }, 0)

        if (typeof prosumer1Trade.pip !== 'boolean')
          throw new Error('pip of first prosumer is not boolean')
        if (typeof prosumer2Trade.pip !== 'boolean')
          throw new Error('pip of second prosumer is not boolean')

        if (!prosumer1Trade.pip && prosumer2Trade.pip) {
          if (typeof prosumer1Trade.pay !== 'number')
            throw new Error('prosumer1 pas null pay')
          if (!prosumer2Trade.energyOut)
            throw new Error('prosumer2 has null energyOut')
          if (!prosumer2Trade.energyIn)
            throw new Error('prosumer2 has null enenrgyIn')

          const cost = prosumer1Trade.pay*(1-operator.opCoef/100)*(prosumer2Trade.energyOut - prosumer2Trade.energyIn) / (S1 + S2)
          const price = prosumer1Trade.price
          const time = new Date(Date.now()).toISOString()
          const approved = false
          const amount = cost / price

          await this.transactionRepository.insert({
            cost: cost,
            time: time,
            from: prosumer1,
            to: prosumer2,
            price: price,
            amount: amount,
            approved: approved
          })
        }
      }
    }

    // 6. Creating transactions for operator
    await Promise.all(data.consumers.map(async value => {
      const consumer = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.consumerId
        }
      })
      const consumerTrade = await this.tradeRepository.findOneOrFail({
        where: {
          cell: consumer
        },
        order: {
          time: "DESC"
        }
      })
      if (typeof consumerTrade.pay !== "number")
        throw new Error('pay is null')
      if (!operator.opCoef)
        throw new Error('opCoef is null')

      const cost = consumerTrade.pay*(operator.opCoef/100)
      const price = consumerTrade.price

      await this.transactionRepository.insert({
        cost: cost,
        time: new Date(Date.now()).toISOString(),
        from: consumer,
        to: operator,
        price: price,
        amount: cost/price,
        approved: false
      })
    }))


    await Promise.all(data.prosumers.map(async value => {
      const prosumer = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.prosumerId
        }
      })
      const prosumerTrade = await this.tradeRepository.findOneOrFail({
        where: {
          cell: prosumer
        },
        order: {
          time: "DESC"
        }
      })
      if (typeof prosumerTrade.pip !== 'boolean')
        throw new Error('pip is not boolean')
      if (!prosumerTrade.pip) {
        if (!operator.opCoef)
          throw new Error('opCoef is null')
        if (!prosumerTrade.pay)
          throw new Error('pay is null')

        const cost = prosumerTrade.pay*operator.opCoef/100
        const price = prosumerTrade.price
        const time = new Date(Date.now()).toISOString()
        const approved = false

        await this.transactionRepository.insert({
          cost: cost,
          time: time,
          price: price,
          amount: cost/price,
          from: prosumer,
          to: operator,
          approved: approved
        })
      }
    }))
  }

  async tradeInfoForHashing (): Promise<HashingInfo> {
    const tradeConsumerTableForLastDay = await this.tradeRepository.find({
      where: {
        time: Raw(columnAlias => `${columnAlias} > now() - '1 day'::interval`),
        type: 'consumer'
      }
    })
    const tradeProducerTableForLastDay = await this.tradeRepository.find({
      where: {
        time: Raw(columnAlias => `${columnAlias} > now() - '1 day'::interval`),
        type: 'producer'
      }
    })
    const tradeProsumerTableForLastDay = await this.tradeRepository.find({
      where: {
        time: Raw(columnAlias => `${columnAlias} > now() - '1 day'::interval`),
        type: 'prosumer'
      }
    })

    return {
      consumer: {
        date: Date.now(),
        consumer: tradeConsumerTableForLastDay.map(value => {
          if (!value.energy)
            throw new Error('null energy')
          return {
            energy: value.energy
          }
        })
      },
      producer: {
        date: Date.now(),
        producer: tradeProducerTableForLastDay.map(value => {
          if (!value.energy || !value.power)
            throw new Error('null energy or null power')
          return {
            energy: value.energy,
            power: value.power
          }
        })
      },
      prosumer: {
        date: Date.now(),
        prosumer: tradeProsumerTableForLastDay.map(value => {
          if (!value.energyIn || !value.energyOut)
            throw new Error('null energyIn or energyOut')
          return {
            energyIn: value.energyIn,
            energyOut: value.energyOut
          }
        })
      }
    }
  }

  async sendNewTransactionsToMQTT() {
    const newTransactions = await this.transactionRepository.find({
      where: {
        sentToMqtt: false
      },
      relations: ['from', 'to']
    })
    for (const value of newTransactions) {
      await onNewTransaction({
        amount: value.amount,
        approved: value.approved,
        cost: value.cost,
        from: value.from.ethAddress,
        to: value.to.ethAddress,
        price: value.price,
        time: value.time
      })
    }
    for (const value of newTransactions) {
      await this.transactionRepository.update({
        id: value.id
      }, {
        sentToMqtt: true
      })
    }
  }
}
