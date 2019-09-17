import NodeDatabase from './NodeDatabase'
import { CellRepository } from "./repositories/CellRepository";
import { getCustomRepository, Raw } from "typeorm";
import { TradeRepository } from "./repositories/TradeRepository";
import { TransactionRepository } from "./repositories/TransactionRepository";
import { UserRepository } from "./repositories/UserRepository";
import {
  EthAddressesConsumers,
  EthAddressesProducers,
  EthAddressesProsumers,
  EthAddressOperator,
  initialMockData
} from "../mockData/config";

import {
  AdminAnchor,
  AdminConsumptions,
  AdminProductions,
  AdminTransactions,
  AMIGOCell,
  Authorization,
  CellRealData,
  ConsumerData,
  DataFromAMIGO,
  HashingInfo,
  InitDataFromAMIGO,
  ProducerData,
  ProsumerData,
  UserAnchor,
  UserConsumption,
  UserMargin,
  UserPrices,
  UserProduction,
  UserTransactions
} from "../mockData/interfaces";
import { AnchorRepository } from "./repositories/AnchorRepository";
import { AMIGO_SERVER, LOGIN, PASSWORD } from "../webEndpoints/endpoints/amigoConfig";
import axios from 'axios'

const DEFAULT_BALANCE = 999
const DEFAULT_MARGIN = 5
const DEFAULT_OPCOEF = 4
const DEFAULT_INITPRICE = [0., 50., 100]
const DEFAULT_INITPOWER = [0., 50., 100]

export class NodeDatabaseService {
  private readonly db: NodeDatabase
  public readonly cellRepository: CellRepository = getCustomRepository(CellRepository)
  public readonly tradeRepository: TradeRepository = getCustomRepository(TradeRepository)
  public readonly transactionRepository: TransactionRepository = getCustomRepository(TransactionRepository)
  public readonly userRepository: UserRepository = getCustomRepository(UserRepository)
  public readonly anchorRepository: AnchorRepository = getCustomRepository(AnchorRepository)

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

  async fetchDataFromAMIGO() {
    // getting all cells
    const prosumers = await this.cellRepository.find({
      where: {
        type: 'prosumer'
      }
    })
    const consumers = await this.cellRepository.find({
      where: {
        type: 'consumer'
      }
    })
    const producers = await this.cellRepository.find({
      where: {
        type: 'producer'
      }
    })

    const prosumerPreparedDatas = await Promise.all(prosumers.map(value => value.mrid).map(async value => {
      //getting data from amigo
      const response = await axios.get(`${AMIGO_SERVER}/api/energyStoragingUnit/${value}/p/row?purposeKey=TM1M&start=PT-15M&end=now`, {
        auth: {
          username: LOGIN,
          password: PASSWORD
        }
      })
      const prosumerData: CellRealData[] = response.data
      let energyIn = 0
      let energyOut = 0
      prosumerData.forEach(value1 => {
        if (value1.value < 0) {
          energyIn -= value1.value
        } else {
          energyOut += value1.value
        }
      })
      // console.log("energyIn", energyIn)
      // console.log("energyOut", energyOut)
      // const energyIn = prosumerData.reduce((previousValue, currentValue) => previousValue - currentValue.value * (currentValue.value < 0 ? 1 : 0), 0)
      // const energyOut = prosumerData.reduce((previousValue, currentValue) => previousValue + currentValue.value + (currentValue.value > 0 ? 1 : 0), 0)
      const prosumerEntry = await this.cellRepository.findOneOrFail({
        where: {
          mrid: value
        }
      })

      const prosumerPreparedData: ProsumerData = {
        time: new Date(Date.now()),
        prosumerEthAddress: prosumerEntry.ethAddress,
        energyIn: energyIn/60,  // kV*h
        energyOut: energyOut/60
      }

      return prosumerPreparedData
    }))

    const consumerPreparedDatas = await Promise.all(consumers.map(value => value.mrid).map(async value => {
      const response = await axios.get(`${AMIGO_SERVER}/api/energyConsumer/${value}/p/row?purposeKey=TM1M&start=PT-15M&end=now`, {
        auth: {
          username: LOGIN,
          password: PASSWORD
        }
      })
      const consumerData: CellRealData[] = response.data
      const energy = consumerData.reduce((previousValue, currentValue) => previousValue + currentValue.value, 0)
      const consumerEntry = await this.cellRepository.findOneOrFail({
        where: {
          mrid: value
        }
      })

      const consumerPreparedData: ConsumerData = {
        time: new Date(Date.now()),
        energy: energy/60,
        consumerEthAddress: consumerEntry.ethAddress
      }

      return consumerPreparedData
    }))

    const producerPreparedDatas = await Promise.all(producers.map(value => value.mrid).map(async value => {
      const response = await axios.get(`${AMIGO_SERVER}/api/generatingUnit/${value}/p/row?purposeKey=TM1M&start=PT-15M&end=now`, {
        auth: {
          username: LOGIN,
          password: PASSWORD
        }
      })
      const producerData: CellRealData[] = response.data
      const energy = producerData.reduce((previousValue, currentValue) => previousValue + currentValue.value, 0)
      const producerEntry = await this.cellRepository.findOneOrFail({
        where: {
          mrid: value
        }
      })

      const power = energy //todo: where should we take the power?
      const producerPreparedData: ProducerData = {
        power: power,
        energy: energy/60,
        time: new Date(Date.now()),
        producerEthAddress: producerEntry.ethAddress
      }

      return producerPreparedData
    }))


    // console.log("prosumerPreparedDatas: ", prosumerPreparedDatas);
    // console.log("consumerPreparedDatas: ", consumerPreparedDatas);
    // console.log("producerPreparedDatas: ", producerPreparedDatas);

    this.handleDataFromAMIGO({
      prosumers: prosumerPreparedDatas,
      producers: producerPreparedDatas,
      consumers: consumerPreparedDatas
    })
  }

  async initialDataForOperator() {
    await this.cellRepository.insert({
      ethAddress: EthAddressOperator,
      mrid: '_operator',
      name: 'Operator',
      balance: DEFAULT_BALANCE,
      opCoef: DEFAULT_OPCOEF,
      type: 'operator'
    })
  }

  async fetchInitialDataFromAMIGO() {
    // setInterval(async () => {
    //   await fetchInitialDataFromAMIGO('http:/127.0.0.1')
    //     .then(value => {
    //       this.handleDataFromAMIGO(value)
    //     })
    //   this.sendNewTransactionsToMQTT()
    // }, 2000)
    const prosumersResponse = await axios.get(`${AMIGO_SERVER}/api/energyStoragingUnit`, {
      auth: {
        username: LOGIN,
        password: PASSWORD
      }
    })
    const consumersResponse = await axios.get(`${AMIGO_SERVER}/api/energyConsumer`, {
      auth: {
        username: LOGIN,
        password: PASSWORD
      }
    })
    const producersResponse = await axios.get(`${AMIGO_SERVER}/api/generatingUnit`, {
      auth: {
        username: LOGIN,
        password: PASSWORD
      }
    })
    // console.log('prosumersResponse: ', prosumersResponse.data);
    // console.log('consumersResponse: ', consumersResponse.data);
    // console.log('producersResponse: ', producersResponse.data);

    const prosumers: AMIGOCell[] = prosumersResponse.data
    const consumers: AMIGOCell[] = consumersResponse.data
    const producers: AMIGOCell[] = producersResponse.data

    this.handleInitDataFromAMIGO({
      prosumers: prosumers.map((value, index) => {
        return {
          name: value.name,
          ethAddress: EthAddressesProsumers[index],
          mrid: value.mrid
        }
      }),
      producers: producers.map((value, index) => {
        return {
          name: value.name,
          ethAddress: EthAddressesProducers[index],
          mrid: value.mrid
        }
      }),
      consumers: consumers.map((value, index) => {
        return {
          name: value.name,
          ethAddress: EthAddressesConsumers[index],
          mrid: value.mrid
        }
      })
    })
  }


  async handleInitDataFromAMIGO(data: InitDataFromAMIGO) {
    await Promise.all(data.consumers.map(async value => {
      await this.cellRepository.insert({
        ethAddress: value.ethAddress,
        type: 'consumer',
        name: value.name,
        balance: DEFAULT_BALANCE,
        mrid: value.mrid
      })
    }))

    await Promise.all(data.producers.map(async value => {
      await this.cellRepository.insert({
        name: value.name,
        ethAddress: value.ethAddress,
        type: 'producer',
        initPower: DEFAULT_INITPOWER,
        initPrice: DEFAULT_INITPRICE,
        balance: DEFAULT_BALANCE,
        mrid: value.mrid
      })
    }))

    await Promise.all(data.prosumers.map(async value => {
      await this.cellRepository.insert({
        name: value.name,
        type: 'prosumer',
        ethAddress: value.ethAddress,
        margin: DEFAULT_MARGIN,
        balance: DEFAULT_BALANCE,
        mrid: value.mrid
      })
    }))

  }

  async handleDataFromAMIGO(data: DataFromAMIGO) {
    // console.log('Got data: ', data);

    // 1. Inserting new entries
    await Promise.all(data.producers.map(async value => {
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.producerEthAddress
        }
      })

      await this.tradeRepository.insert({
        time: value.time.toISOString(),
        energy: value.energy,
        power: value.power,
        cell: cell,
        type: 'producer',
        price: 0
      })
    }))
    await Promise.all(data.consumers.map(async value => {
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.consumerEthAddress
        }
      })

      await this.tradeRepository.insert({
        cell: cell,
        time: value.time.toISOString(),
        energy: value.energy,
        type: 'consumer',
        price: 0
      })
    }))
    await Promise.all(data.prosumers.map(async value => {
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.prosumerEthAddress
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
        energyInAll: (tmp ? (tmp.energyInAll ? tmp.energyInAll : 0) : 0) + value.energyIn,
        price: 0
      })
    }))
    // 2. Pip, avPrice
    await Promise.all(data.prosumers.map(async value => {
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.prosumerEthAddress
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

      let avPrice: number = 0
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
          ethAddress: value.producerEthAddress
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
    let priceForConsumerAndProsumer: number = 0
    await Promise.all(data.prosumers.map(async value => {
      // Finding prosumer cell in database
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.prosumerEthAddress
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
        if (typeof currentValue.energy != 'number')
          throw new Error('producer table consists null \"energy\" field.')
        return previousValue + currentValue.energy * currentValue.price
      }, 0)

      const S2 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
        if (typeof cell.margin != "number")
          throw new Error('margin is null')
        if (typeof currentValue.pip !== 'boolean')
          throw new Error('prosumer table contains null \"pip\" field.')
        if (typeof currentValue.energyOut != "number")
          throw new Error('energyOut is null')
        if (typeof currentValue.energyIn != "number")
          throw new Error('energyIn in null')
        if (typeof currentValue.avPrice !== "number")
          throw new Error('avPrice is null')
        return previousValue + (currentValue.pip ? 1 : 0) * Math.abs(currentValue.energyOut - currentValue.energyIn) * currentValue.avPrice * (1 + cell.margin / 100)
      }, 0)

      const S3 = Trade_producer_table.reduce((previousValue, currentValue) => {
        if (typeof currentValue.energy != "number")
          throw new Error('energy is null')
        return previousValue + currentValue.energy
      }, 0)

      const S4 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
        if (typeof currentValue.pip !== "boolean")
          throw new Error('pip is null')
        if (typeof currentValue.energyOut != "number")
          throw new Error('energuOut is null')
        if (typeof currentValue.energyIn != "number")
          throw new Error('energyIn is null')

        return previousValue + (currentValue.pip ? 1 : 0) * Math.abs(currentValue.energyIn - currentValue.energyOut)
      }, 0)

      priceForConsumerAndProsumer = (S1 + S2) / (S3 + S4)
      // console.log("priceForConsumerAndProsumer: ", priceForConsumerAndProsumer);

      // calculating pay
      let pay: number
      if (typeof lastProsumerTrade.pip !== 'boolean')
        throw new Error('pip has type different from boolean')
      if (lastProsumerTrade.pip) {
        pay = 0
      }
      else {
        if (typeof lastProsumerTrade.energyIn != "number")
          throw new Error('energyIn is null')
        if (typeof lastProsumerTrade.energyOut != "number")
          throw new Error('energyOut is null')

        const S5 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
          if (typeof currentValue.energyOut != "number")
            throw new Error('energuOut is null')
          return previousValue + currentValue.energyOut
        }, 0)
        const S6 = Trade_consumer_table.reduce((previousValue, currentValue) => {
          if (typeof currentValue.energy != "number")
            throw new Error('energy is null')
          return previousValue + currentValue.energy
        }, 0)
        const S7 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
          if (typeof currentValue.energyIn != "number")
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
        ethAddress: value.consumerEthAddress
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

      if (typeof lastConsumerInTradeTable.energy != "number")
        throw new Error('energy is null')

      const S1 = Trade_producer_table.reduce((previousValue, currentValue) => {
        if (typeof currentValue.energy != "number")
          throw new Error('energy is null')
        return previousValue + currentValue.energy
      }, 0)
      const S2 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
        if (typeof currentValue.energyOut != "number")
          throw new Error('energyOut is null')
        return previousValue + currentValue.energyOut
      }, 0)
      const S3 = Trade_consumer_table.reduce((previousValue, currentValue) => {
        if (typeof currentValue.energy != "number")
          throw new Error('energy is null')
        return previousValue + currentValue.energy
      }, 0)
      const S4 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
        if (typeof currentValue.energyIn != "number")
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
    if (typeof operator.opCoef != "number")
      throw new Error('opCoef is null')
    // From every consumer to every producer
    for(let i = 0; i < data.consumers.length; i++) {
      for (let j = 0; j < data.producers.length; j++) {
        const consumer = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: data.consumers[i].consumerEthAddress
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
            ethAddress: data.producers[j].producerEthAddress
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
          if (typeof currentValue.energy != "number")
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
          if (typeof currentValue.energyIn != "number")
            throw new Error('energyIn is null')
          if (typeof currentValue.energyOut != "number")
            throw new Error('energyOut is null')

          return previousValue + (currentValue.pip ? 1 : 0) * Math.abs(currentValue.energyOut - currentValue.energyIn)
        }, 0)

        if (typeof consumerTrade.pay !== 'number')
          throw new Error("pay is null")
        if (typeof producerTrade.energy != "number")
          throw new Error('energy is null')

        const cost = consumerTrade.pay * (1-operator.opCoef/100)*producerTrade.energy / (S1 + S2)
        const price = consumerTrade.price

        if (price) {
          await this.transactionRepository.insert({
            cost: cost,
            from: consumer,
            to: producer,
            time: new Date(Date.now()).toISOString(),
            price: price, //todo: is it correct?
            amount: cost / consumerTrade.price,
          })
        }
      }
    }

    // From every prosumer (pip=0) to every producer
    for (let i = 0; i < data.producers.length; i++) {
      for (let j = 0; j < data.prosumers.length; j++) {
        const prosumer = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: data.prosumers[j].prosumerEthAddress
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
            ethAddress: data.producers[i].producerEthAddress
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
          if (typeof currentValue.energy != "number")
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
          if (typeof currentValue.energyOut != "number")
            throw new Error('energyOut is null')
          if (typeof currentValue.energyIn != "number")
            throw new Error('energyIn is null')

          return previousValue + (currentValue.pip ? 1 : 0) * Math.abs(currentValue.energyOut - currentValue.energyIn)
        }, 0)

        if (typeof prosumerTrade.pip !== 'boolean')
          throw new Error('pip is not boolean')

        if (!prosumerTrade.pip) {
          if (typeof prosumerTrade.pay !== 'number')
            throw new Error('pay is null')
          if (typeof producerTrade.energy != "number")
            throw new Error('energy is null')

          const cost = prosumerTrade.pay*(1-operator.opCoef/100)*producerTrade.energy / (S1 + S2)
          const price = prosumerTrade.price

          if (price) {
            await this.transactionRepository.insert({
              cost: cost,
              from: prosumer,
              to: producer,
              time: new Date(Date.now()).toISOString(),
              price: price, //todo: is it correct
              amount: cost / price,
            })
          }
        }
      }
    }


    // From every consumer to every prosumer (pip = 1)
    for (let i = 0; i < data.consumers.length; i++) {
      for (let j = 0; j < data.prosumers.length; j++) {
        const consumer = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: data.consumers[i].consumerEthAddress
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
            ethAddress: data.prosumers[j].prosumerEthAddress
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
          if (typeof currentValue.energy != "number")
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
          if (typeof currentValue.energyOut != "number")
            throw new Error('energyOut is null')
          if (typeof currentValue.energyIn != "number")
            throw new Error('energyIn is null')

          return previousValue + (currentValue.pip ? 1 : 0) * Math.abs(currentValue.energyOut - currentValue.energyIn)
        }, 0)

        if (typeof prosumerTrade.pip !== 'boolean')
          throw new Error('pip is not boolean')
        if (prosumerTrade.pip) {
          if (typeof consumerTrade.pay !== 'number')
            throw new Error('pay is null')
          if (typeof prosumerTrade.energyIn != "number")
            throw new Error('energyIn is null')
          if (typeof prosumerTrade.energyOut != "number")
            throw new Error('energyOut is null')

          const cost = consumerTrade.pay * (1-operator.opCoef/100)*(prosumerTrade.energyOut-prosumerTrade.energyIn) / (S1 + S2)
          const price = consumerTrade.price

          if (price) {
            await this.transactionRepository.insert({
              cost: cost,
              time: new Date(Date.now()).toISOString(),
              from: consumer,
              to: prosumer,
              price: price, //todo: is it correct?
              amount: cost / price,
            })
          }
        }
      }
    }

    // From every prosumer (pip = 0) to every prosumer (pip = 1)
    for (let i = 0; i < data.prosumers.length; i++) {
      for (let j = i+1; j < data.prosumers.length; j++) {
        const prosumer1 = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: data.prosumers[i].prosumerEthAddress
          }
        })
        const prosumer2 = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: data.prosumers[j].prosumerEthAddress
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
          if (typeof currentValue.energy != "number")
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
          if (typeof currentValue.energyOut != "number")
            throw new Error('energyOut is null')
          if (typeof currentValue.energyIn != "number")
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
          if (typeof prosumer2Trade.energyOut != "number")
            throw new Error('prosumer2 has null energyOut')
          if (typeof prosumer2Trade.energyIn != "number")
            throw new Error('prosumer2 has null enenrgyIn')

          const cost = prosumer1Trade.pay*(1-operator.opCoef/100)*(prosumer2Trade.energyOut - prosumer2Trade.energyIn) / (S1 + S2)
          const price = prosumer1Trade.price
          const time = new Date(Date.now()).toISOString()
          const amount = cost / price

          if (price) {
            await this.transactionRepository.insert({
              cost: cost,
              time: time,
              from: prosumer1,
              to: prosumer2,
              price: price,
              amount: amount,
            })
          }
        }
      }
    }

    // 6. Creating transactions for operator
    await Promise.all(data.consumers.map(async value => {
      const consumer = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.consumerEthAddress
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
      if (typeof operator.opCoef != "number")
        throw new Error('opCoef is null')

      const cost = consumerTrade.pay*(operator.opCoef/100)
      const price = consumerTrade.price

      if (price) {
        await this.transactionRepository.insert({
          cost: cost,
          time: new Date(Date.now()).toISOString(),
          from: consumer,
          to: operator,
          price: price,
          amount: cost / price,
        })
      }
    }))


    await Promise.all(data.prosumers.map(async value => {
      const prosumer = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.prosumerEthAddress
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
        if (typeof operator.opCoef != "number")
          throw new Error('opCoef is null')
        if (typeof prosumerTrade.pay != 'number')
          throw new Error('pay is null')

        const cost = prosumerTrade.pay*operator.opCoef/100
        const price = prosumerTrade.price
        const time = new Date(Date.now()).toISOString()

        if (price) {
          await this.transactionRepository.insert({
            cost: cost,
            time: time,
            price: price,
            amount: cost / price,
            from: prosumer,
            to: operator,
          })
        }
      }
    }))
  }

  async tradeInfoForHashing (): Promise<HashingInfo> {
    const tradeConsumerTableForLastDay = await this.tradeRepository.find({
      where: {
        time: Raw(columnAlias => `${columnAlias}::date = current_date - interval '1 day'`),
        type: 'consumer'
      },
      relations: ['cell']
    })
    const tradeProducerTableForLastDay = await this.tradeRepository.find({
      where: {
        time: Raw(columnAlias => `${columnAlias}::date = current_date - interval '1 day'`),
        type: 'producer'
      },
      relations: ['cell']
    })
    const tradeProsumerTableForLastDay = await this.tradeRepository.find({
      where: {
        time: Raw(columnAlias => `${columnAlias}::date = current_date - interval '1 day'`),
        type: 'prosumer'
      },
      relations: ['cell']
    })

    return {
      consumer: {
        date: Date.now(),
        consumer: await Promise.all(tradeConsumerTableForLastDay.map(async value => {
          if (typeof value.energy != "number")
            throw new Error('null energy')
          const user = await this.userRepository.findOneOrFail({
            where: {
              cell: value.cell
            }
          })
          return {
            email: user.email,
            energy: value.energy
          }
        }))
      },
      producer: {
        date: Date.now(),
        producer: await Promise.all(tradeProducerTableForLastDay.map(async value => {
          if (typeof value.energy != "number" || typeof value.power != "number")
            throw new Error('null energy or null power')
          const user = await this.userRepository.findOneOrFail({
            where: {
              cell: value.cell
            }
          })
          return {
            email: user.email,
            energy: value.energy,
            power: value.power,
          }
        }))
      },
      prosumer: {
        date: Date.now(),
        prosumer: await Promise.all(tradeProsumerTableForLastDay.map(async value => {
          if (typeof value.energyIn != "number" || typeof value.energyOut != "number")
            throw new Error('null energyIn or energyOut')
          const user = await this.userRepository.findOneOrFail({
            where: {
              cell: value.cell
            }
          })
          return {
            email: user.email,
            energyIn: value.energyIn,
            energyOut: value.energyOut,
          }
        }))
      }
    }
  }

  async adminTransactions(): Promise<AdminTransactions> {
    const transactions = await this.transactionRepository.find({
      relations: ['from', 'to']
    })

    return {
      transaction: transactions.map(value => {
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

  async adminConsumptions(): Promise<AdminConsumptions> {
    const tradeTableConsumers = await this.tradeRepository.find({
      where: {
        type: "consumer"
      },
      relations: ['cell']
    })
    const minE = await this.tradeRepository.query('select min(energy) from trade where type = \'consumer\';')
    const maxE = await this.tradeRepository.query('select max(energy) from trade where type = \'consumer\';')
    const avgE = await this.tradeRepository.query('select avg(energy) from trade where type = \'consumer\';')
    const minPrice = await this.tradeRepository.query('select min(price) from trade where type = \'consumer\';')
    const maxPrice = await this.tradeRepository.query('select max(price) from trade where type = \'consumer\';')
    const avgPrice = await this.tradeRepository.query('select avg(price) from trade where type = \'consumer\';')
    const entitiesToday = await this.tradeRepository.find({
      where: {
        time: Raw(columnAlias => `${columnAlias} > now() - '1 day'::interval`),
        type: 'consumer'
      }
    })
    const entities30Today = await this.tradeRepository.find({
      where: {
        time: Raw(columnAlias => `${columnAlias} > now() - '30 day'::interval`),
        type: 'consumer'
      }
    })

    return {
      minEnergy: minE,
      maxEnergy: maxE,
      averageEnergy: avgE,
      minPrice: minPrice,
      maxPrice: maxPrice,
      averagePrice: avgPrice,
      energy_today: entitiesToday.map(value => {
        if (typeof value.energy != "number")
          throw new Error('energy is null')
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
      price_30_day: entitiesToday.map(value => {
        if (typeof value.price != "number")
          throw new Error('price is null')
        return {
          date: value.time,
          price: value.price
        }
      }),
      consumption_peers: tradeTableConsumers.map(value => {
        if (typeof value.energy != "number")
          throw new Error('null energy')
        return {
          total: value.cell.name,
          id: value.cell.ethAddress,
          balance: value.cell.balance,
          bought: value.energy,
          price: value.price
        }
      })
    }
  }

  async adminProductions(): Promise<AdminProductions> {
    const producers = await this.tradeRepository.find({
      where: {
        type: 'producer'
      },
      relations: ['cell']
    })

    return {
      production_peers: producers.map(value => {
        if (typeof value.energy != "number")
          throw new Error('null energy')
        return {
          total: value.cell.name,
          id: value.cell.ethAddress,
          balance: value.cell.balance,
          sold: value.energy,
          price: value.price
        }
      })
    }
  }

  async adminAnchor(): Promise<AdminAnchor> {
    const anchors = await this.anchorRepository.find({
      relations: ['user']
    })

    return {
      anchors: anchors.map(value => {
        return {
          date: value.time,
          participant: value.user.cell.name,
          id: value.hashId,
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
      margin: data.margin
    }, {
      ethAddress: cellEthAddress
    })
  }

  async userConsumption(cellEthAddress: string): Promise<UserConsumption | {}> {
    const userCell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: cellEthAddress
      }
    })

    const userTradeTable = await this.tradeRepository.find({
      where: {
        type: 'consumer',
        cell: userCell
      },
      relations: ['cell']
    })


    if (!userTradeTable.length) {
      return {

      }
    }

    const userTradeTable1Day = await this.tradeRepository.find({
      where: {
        type: 'consumer',
        cell: userCell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'1 day\'::interval`)
      }
    })
    const userTradeTable30Day = await this.tradeRepository.find({
      where: {
        type: 'consumer',
        cell: userCell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'30 day\'::interval`)
      }
    })


    if (typeof userTradeTable[0].energy != "number")
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
    }, 0)/userTradeTable.length



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
      consumption_peers: userTradeTable.map(value => {
        if (typeof value.energy != "number")
          throw new Error('null energy')
        return {
          total: value.cell.name,
          id: value.cell.ethAddress,
          balance: value.cell.balance,
          bought: value.energy,
          price: value.price
        }
      })
    }
  }

  async userProduction(cellEthAddress: string): Promise<UserProduction | {}> {
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
    if (!userTradeTable.length) {
      return {

      }
    }

    const userTradeTable1Day = await this.tradeRepository.find({
      where: {
        type: 'producer',
        cell: userCell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'1 day\'::interval`)
      }
    })
    const userTradeTable30Day = await this.tradeRepository.find({
      where: {
        type: 'producer',
        cell: userCell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'30 day\'::interval`)
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
    }, 0)/userTradeTable.length


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
    }, 0)/userTradeTable.length



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
      production_peers: userTradeTable.map(value => {
        if (typeof value.energy != "number")
          throw new Error('null energy')
        return {
          total: value.cell.name,
          id: value.cell.ethAddress,
          balance: value.cell.balance,
          sold: value.energy,
          price: value.price
        }
      })
    }
  }

  async userTransactions(cellEthAddress: string): Promise<UserTransactions | {}> {
    const myCell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: cellEthAddress
      }
    })
    const transactions = await this.transactionRepository.find({
      where: `"fromId" = ${myCell.id} or "toId" = ${myCell.id};`,
      relations: ['from', 'to']
    })

    if (!transactions.length) {
      return {

      }
    }

    return {
      transaction: transactions.map(value => {
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
      }
    })

    if (!userAnchors.length) {
      return {

      }
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

  async updateTransactionState(from: string, to: string, approved: boolean) {
    const fromCell = await this.cellRepository.findOneOrFail({
      where: {
        name: from
      }
    })
    const toCell = await this.cellRepository.findOneOrFail({
      where: {
        name: to
      }
    })
    await this.transactionRepository.update({
      from: fromCell,
      to: toCell
    }, {
      approved: approved
    })
  }

  async newTransactionStateFromMQTT() {

    // this.updateTransactionState()
  }

  async sendNewTransactionsToMQTT() {
    const newTransactions = await this.transactionRepository.find({
      where: {
        sentToMqtt: false
      },
      relations: ['from', 'to']
    })
    for (const value of newTransactions) {
      // вытащить данны из переменной value и отправить в publishProgress
      this.db.mqtt.publishProgress(1, 1, 200, "Enode1", "Enode2", 12.5)
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
