import NodeDatabase from './NodeDatabase'
import { CellRepository } from "./repositories/CellRepository";
import { getCustomRepository, IsNull, Raw } from "typeorm";
import { TradeRepository } from "./repositories/TradeRepository";
import { TransactionRepository } from "./repositories/TransactionRepository";
import { UserRepository } from "./repositories/UserRepository";
import { EthAddresses, initialMockData } from "../mockData/config";

import {
  AdminAnchor,
  AdminConsumptions,
  AdminProductions,
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
import { AMIGO_SERVER } from "../webEndpoints/endpoints/amigoConfig";
import axios from 'axios'
import { User } from "./models";
import { converCellTypeToAMIGOCellType, mapCellTypeToEndpoint, mapCellTypeToPurposeKey } from "../utils/mapCellTypes";
import { NotEquals } from "class-validator";

const DEFAULT_BALANCE = -1
const DEFAULT_MARGIN = 5
const DEFAULT_OPCOEF = 4
const DEFAULT_INITPRICE = [0,	1,	2,	3,	4]
const DEFAULT_INITPOWER = [0,	3,	5,	7,	9]


export class NodeDatabaseService {
  public readonly cellRepository: CellRepository = getCustomRepository(CellRepository)
  public readonly tradeRepository: TradeRepository = getCustomRepository(TradeRepository)
  public readonly transactionRepository: TransactionRepository = getCustomRepository(TransactionRepository)
  public readonly userRepository: UserRepository = getCustomRepository(UserRepository)
  public readonly anchorRepository: AnchorRepository = getCustomRepository(AnchorRepository)
  private readonly db: NodeDatabase

  constructor(db: NodeDatabase) {
    this.db = db
  }

  async initMockData() {
    console.log('Initializing mock data...');
    if (!(await this.cellRepository.find({})).length) {
      await Promise.all(initialMockData.consumers.map(value => {
        return this.cellRepository.insert({
          ethAddress: value.ethAddress,
          name: value.name,
          type: 'consumer'
        })
      }))
      await this.cellRepository.insert({
        name: initialMockData.operator.name,
        ethAddress: initialMockData.operator.ethAddress,
        opCoef: initialMockData.operator.opCoef,
        type: 'operator'
      })

      await Promise.all(initialMockData.producers.map(value => {
        return this.cellRepository.insert({
          ethAddress: value.ethAddress,
          name: value.name,
          initPower: value.initPower,
          initPrice: value.initPrice,
          type: 'producer'
        })
      }))
      initialMockData.prosumers.map(value => {
        return this.cellRepository.insert({
          ethAddress: value.ethAddress,
          name: value.name,
          margin: value.margin,
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


  async fetchAndHandleDataFromAMIGO() {
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

    const prosumerPreparedDatas = await Promise.all(prosumers.map(value => value.mrid).map(async mrid => {
      //getting data from amigo
      const response = await axios.get(`${AMIGO_SERVER}/api/energyStoragingUnit/${mrid}/e`)
      const prosumerData: CellRealData = response.data
      let energyIn = 0
      let energyOut = 0
      if (prosumerData.value < 0) {
        energyIn -= prosumerData.value
      } else {
        energyOut += prosumerData.value
      }
      // console.log("energyIn", energyIn)
      // console.log("energyOut", energyOut)
      // const energyIn = prosumerData.reduce((previousValue, currentValue) => previousValue - currentValue.value * (currentValue.value < 0 ? 1 : 0), 0)
      // const energyOut = prosumerData.reduce((previousValue, currentValue) => previousValue + currentValue.value + (currentValue.value > 0 ? 1 : 0), 0)
      const prosumerEntry = await this.cellRepository.findOneOrFail({
        where: {
          mrid: mrid
        }
      })

      const prosumerPreparedData: ProsumerData = {
        time: prosumerData.timeStamp,
        prosumerEthAddress: prosumerEntry.ethAddress,
        energyIn: energyIn,
        energyOut: energyOut
      }

      return prosumerPreparedData
    }))

    const consumerPreparedDatas = await Promise.all(consumers.map(value => value.mrid).map(async value => {
      const response = await axios.get(`${AMIGO_SERVER}/api/energyConsumer/${value}/e`)
      const consumerData: CellRealData = response.data
      const consumerEntry = await this.cellRepository.findOneOrFail({
        where: {
          mrid: value
        }
      })

      const consumerPreparedData: ConsumerData = {
        time: consumerData.timeStamp,
        energy: consumerData.value,
        consumerEthAddress: consumerEntry.ethAddress
      }

      return consumerPreparedData
    }))

    const producerPreparedDatas = await Promise.all(producers.map(value => value.mrid).map(async value => {
      const powerResponse = await axios.get(`${AMIGO_SERVER}/api/generatingUnit/${value}/p`)
      const energyResponse = await axios.get(`${AMIGO_SERVER}/api/generatingUnit/${value}/e`)
      const producerPowerData: CellRealData = powerResponse.data
      const producerEnergyData: CellRealData = energyResponse.data
      const producerEntry = await this.cellRepository.findOneOrFail({
        where: {
          mrid: value
        }
      })

      const producerPreparedData: ProducerData = {
        power: producerPowerData.value,
        energy: producerEnergyData.value,
        time: producerPowerData.timeStamp,
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

  async sendPricesToAmigo() {
    for (const ethAddress of EthAddresses.slice(0, -1)) {
      await this.postPricesToAMIGOForCell(ethAddress)
    }
  }


  async initialDataForOperator() {
    await this.cellRepository.insert({
      ethAddress: initialMockData.operator.ethAddress,
      mrid: initialMockData.operator.ethAddress,
      name: 'Operator',
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
    const prosumersResponse = await axios.get(`${AMIGO_SERVER}/api/energyStoragingUnit`)
    const consumersResponse = await axios.get(`${AMIGO_SERVER}/api/energyConsumer`)
    const producersResponse = await axios.get(`${AMIGO_SERVER}/api/generatingUnit`)
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
          ethAddress: initialMockData.prosumers[index].ethAddress,
          mrid: value.mrid
        }
      }),
      producers: producers.map((value, index) => {
        return {
          name: value.name,
          ethAddress: initialMockData.producers[index].ethAddress,
          mrid: value.mrid
        }
      }),
      consumers: consumers.map((value, index) => {
        return {
          name: value.name,
          ethAddress: initialMockData.consumers[index].ethAddress,
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
        mrid: value.mrid
      })
    }))

    await Promise.all(data.prosumers.map(async value => {
      await this.cellRepository.insert({
        name: value.name,
        type: 'prosumer',
        ethAddress: value.ethAddress,
        margin: DEFAULT_MARGIN,
        mrid: value.mrid
      })
    }))

  }

  async handleDataFromAMIGO(data: DataFromAMIGO) {
    console.log('Got data: ', data);
    // 1. Inserting new entries
    await Promise.all(data.producers.map(async value => {
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.producerEthAddress
        }
      })
      await this.tradeRepository.insert({
        time: value.time,
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
        time: value.time,
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
        time: value.time,
        energyIn: value.energyIn,
        energyOut: value.energyOut,
        type: 'prosumer',
        energyInAll: (tmp ? (tmp.energyInAll ? tmp.energyInAll : 0) : 0) + value.energyIn,
        price: 0
      })
    }))
    // 2. Pip, avPrice
    await Promise.all(data.prosumers.map(async (value, index) => {
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
      const pip: boolean = false

      const prosumersWithNoPip = await this.tradeRepository.find({
        where: {
          cell: cell,
          pip: false
        }
      })

      let avPrice: number = 0
      if (prosumersWithNoPip.length)
        avPrice = prosumersWithNoPip.reduce((previousValue, currentValue) => previousValue + currentValue.price, 0) / prosumersWithNoPip.length
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


      // let index
      // if (value.power > cell.initPower[-1])
      //   index = -1
      // else
      //   index = cell.initPower.reduce((previousValue, currentValue) => {
      //     return previousValue + (value.power < currentValue ? 1 : 0)
      //   }, 0)
      // const price = cell.initPrice[index]
      let index = cell.initPower.reduce((previousValue, currentValue) => previousValue + (currentValue < value.power ? 1 : 0), 0)
      if (index >= cell.initPower.length)
        index = cell.initPower.length - 1
      const price = cell.initPrice[index]

      await this.tradeRepository.update({
        id: lastProducerEntry.id
      }, {
        price: price
      })
    }))

    // 3. Price: Working with prosumers
    let priceForConsumer: number = 0
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


      if (typeof cell.margin != 'number')
        throw new Error('margin is null')
      const margin = cell.margin

      {
        // Calculating price for consumer
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
        priceForConsumer = (S1 + S2) / (S3 + S4)
        console.log("priceForConsumerAndProsumer: ", priceForConsumer);
      }

      // // calculating pay
      // let pay: number
      // if (typeof lastProsumerTrade.pip !== 'boolean')
      //   throw new Error('pip has type different from boolean')
      // if (lastProsumerTrade.pip) {
      //   pay = 0
      // } else {
      //   if (typeof lastProsumerTrade.energyIn != "number")
      //     throw new Error('energyIn is null')
      //   if (typeof lastProsumerTrade.energyOut != "number")
      //     throw new Error('energyOut is null')
      //
      //   const S5 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
      //     if (typeof currentValue.energyOut != "number")
      //       throw new Error('energuOut is null')
      //     return previousValue + currentValue.energyOut
      //   }, 0)
      //   const S6 = Trade_consumer_table.reduce((previousValue, currentValue) => {
      //     if (typeof currentValue.energy != "number")
      //       throw new Error('energy is null')
      //     return previousValue + currentValue.energy
      //   }, 0)
      //   const S7 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
      //     if (typeof currentValue.energyIn != "number")
      //       throw new Error('energyIn is null')
      //     return previousValue + currentValue.energyIn
      //   }, 0)
      //   pay = priceForConsumerAndProsumer * (Math.abs(lastProsumerTrade.energyIn - lastProsumerTrade.energyOut) + lastProsumerTrade.energyIn * (S3 + S5 - S6 - S7) / (S6 + S7))
      // }


      await this.tradeRepository.update({
        id: lastProsumerTrade.id
      }, {
        price: margin,
        pay: 0
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
      const S6 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
        if (typeof currentValue.energyIn != 'number' || typeof currentValue.energyOut != 'number')
          throw new Error('energuIn or energyOut is null')
        return previousValue + (currentValue.energyIn + currentValue.energyOut)*currentValue.price
      }, 0)
      const S5 = S6*lastConsumerInTradeTable.energy / S3

      const pay = priceForConsumer * (lastConsumerInTradeTable.energy + lastConsumerInTradeTable.energy * (S1 + S2 - S3 - S4) / S3) + S5
      await this.tradeRepository.update({
          id: lastConsumerInTradeTable.id
        },
        {
          price: priceForConsumer,
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
    for (let i = 0; i < data.consumers.length; i++) {
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
        const Trade_consumer_table = await this.tradeRepository.find({
          where: {
            type: 'consumer'
          }
        })
        const lastConsumerInTradeTable = await this.tradeRepository.findOneOrFail(({
          where: {
            type: 'consumer'
          },
          order: {
            time: "DESC"
          }
        }))

        const S1 = producers.reduce((previousValue, currentValue) => {
          if (typeof currentValue.energy != "number")
            throw new Error('energy is null')
          return previousValue + currentValue.energy
        }, 0)

        const Trade_prosumer_table = await this.tradeRepository.find({
          where: {
            type: 'prosumer'
          }
        })
        const S2 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
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

        const S3 = Trade_consumer_table.reduce((previousValue, currentValue) => {
          if (typeof currentValue.energy != "number")
            throw new Error('energy is null')
          return previousValue + currentValue.energy
        }, 0)
        const S6 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
          if (typeof currentValue.energyIn != 'number' || typeof currentValue.energyOut != 'number')
            throw new Error('energuIn or energyOut is null')
          return previousValue + (Math.abs(currentValue.energyIn) + Math.abs(currentValue.energyOut) )*currentValue.price
        }, 0)
        if (typeof lastConsumerInTradeTable.energy != "number")
          throw new Error('energy is null')

        const S5 = S6*lastConsumerInTradeTable.energy / S3

        const cost = (consumerTrade.pay - S5) * (1 - operator.opCoef / 100) * (producerTrade.energy / S1)
        const price = consumerTrade.price

        if (price) {
          await this.transactionRepository.insert({
            cost: cost,
            from: consumer,
            to: producer,
            time: new Date(Date.now()).toISOString(),
            price: price,
            amount: cost / consumerTrade.price,
          })
        }
      }
    }

    // From every consumer to every prosumer
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
        const prosumers = await this.tradeRepository.find({
          where: {
            type: 'prosumer'
          }
        })
        const Trade_consumer_table = await this.tradeRepository.find({
          where: {
            type: 'consumer'
          }
        })
        const lastConsumerInTradeTable = await this.tradeRepository.findOneOrFail(({
          where: {
            type: 'consumer'
          },
          order: {
            time: "DESC"
          }
        }))

        const S1 = prosumers.reduce((previousValue, currentValue) => {
          if (typeof currentValue.energyIn != "number")
            throw new Error('energyIn is null')
          if (typeof currentValue.energyOut != "number")
            throw new Error('energyOut is null')
          return previousValue + Math.abs(currentValue.energyIn) + Math.abs(currentValue.energyOut)
        }, 0)

        const Trade_prosumer_table = await this.tradeRepository.find({
          where: {
            type: 'prosumer'
          }
        })

        if (typeof consumerTrade.pay !== 'number')
          throw new Error("pay is null")
        const S3 = Trade_consumer_table.reduce((previousValue, currentValue) => {
          if (typeof currentValue.energy != "number")
            throw new Error('energy is null')
          return previousValue + currentValue.energy
        }, 0)
        const S6 = Trade_prosumer_table.reduce((previousValue, currentValue) => {
          if (typeof currentValue.energyIn != 'number' || typeof currentValue.energyOut != 'number')
            throw new Error('energyIn or energyOut is null')
          return previousValue + (Math.abs(currentValue.energyIn) + Math.abs(currentValue.energyOut) )*currentValue.price
        }, 0)
        if (typeof lastConsumerInTradeTable.energy != "number")
          throw new Error('energy is null')

        const S5 = S6*lastConsumerInTradeTable.energy / S3

        if (typeof prosumerTrade.energyIn != "number")
          throw new Error('energyIn is null')
        if (typeof prosumerTrade.energyOut != "number")
          throw new Error('energyOut is null')

        const cost = S5 * (1 - operator.opCoef / 100) * ( Math.abs(prosumerTrade.energyIn) + Math.abs(prosumerTrade.energyOut)) / S1
        const price = consumerTrade.price

        if (price) {
          await this.transactionRepository.insert({
            cost: cost,
            from: consumer,
            to: prosumer,
            time: new Date(Date.now()).toISOString(),
            price: price,
            amount: cost / consumerTrade.price,
          })
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

      const cost = consumerTrade.pay * (operator.opCoef / 100)
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
  }

  async getAnchoringInfoToCheck(user: User) {
    const hashingInfo = await this.db.service.userTradeInfoForHashing(user.email)
    const anchoringEntry = await this.db.service.anchorRepository.findOne({
      where: {
        user: user
      },
      order: {
        time: "DESC"
      }
    })
    if (!anchoringEntry) {
      throw new Error('there is no any anchoring info yet')
    }
    return {
      ...hashingInfo,
      time: '' + anchoringEntry.time
    }
  }

  async userTradeInfoForHashing(userEmail: string) {
    const user = await this.userRepository.findOneOrFail({
      where: {
        email: userEmail
      },
      relations: ['cell']
    })

    const tradeTable = await this.tradeRepository.find({
      where: {
        time: Raw(columnAlias => `(${columnAlias})::date = current_date - interval '1 day'`),
        cell: user.cell
      },
      relations: ['cell']
    })
    switch (user.cell.type) {
      case 'prosumer': {
        return {
          data: tradeTable.map(value => {
            return {
              energyIn: "" + value.energyIn,
              energyOut: "" + value.energyOut,
            }
          })
        }
      }
      case "consumer": {
        return {
          data: tradeTable.map(value => {
            return {
              energy: "" + value.energy
            }
          })
        }
      }
      case "producer": {
        return {
          data: tradeTable.map(value => {
            return {
              energy: "" + value.energy,
              power: "" + value.power
            }
          })
        }
      }
      default: {
        throw new Error('unexpected cell type while requesting hashing info')
      }
    }
  }

  async tradeInfoForHashing(): Promise<HashingInfo> {
    const tradeConsumerTableForLastDay = await this.tradeRepository.find({
      where: {
        time: Raw(columnAlias => `(${columnAlias})::date = current_date - interval '1 day'`),
        type: 'consumer'
      },
      relations: ['cell']
    })
    const tradeProducerTableForLastDay = await this.tradeRepository.find({
      where: {
        time: Raw(columnAlias => `(${columnAlias})::date = current_date - interval '1 day'`),
        type: 'producer'
      },
      relations: ['cell']
    })
    const tradeProsumerTableForLastDay = await this.tradeRepository.find({
      where: {
        time: Raw(columnAlias => `(${columnAlias})::date = current_date - interval '1 day'`),
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

  async adminTransactions(): Promise<UserTransactions> {
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
          balance: value.cell.balance || DEFAULT_BALANCE,
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
          balance: value.cell.balance || DEFAULT_BALANCE,
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
        time: Raw(columnAlias => `${columnAlias} > now() - \'1 day\'::interval`)
      }
    })
    const userTradeTable30Day = await this.tradeRepository.find({
      where: {
        type: 'prosumer',
        cell: userCell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'30 day\'::interval`)
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

  async userProsumerProduction(cellEthAddress: string): Promise<UserProduction | {}> {
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
        time: Raw(columnAlias => `${columnAlias} > now() - \'1 day\'::interval`)
      }
    })
    const userTradeTable30Day = await this.tradeRepository.find({
      where: {
        type: 'prosumer',
        cell: userCell,
        time: Raw(columnAlias => `${columnAlias} > now() - \'30 day\'::interval`)
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
      production_peers: userTradeTable.map(value => {
        if (typeof value.energyOut != "number")
          throw new Error('null energy')
        return {
          total: value.cell.name,
          id: value.cell.ethAddress,
          balance: value.cell.balance || DEFAULT_BALANCE,
          sold: value.energyOut,
          price: value.price
        }
      })
    }
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
      return {}
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
      consumption_peers: userTradeTable.map(value => {
        if (typeof value.energy != "number")
          throw new Error('null energy')
        return {
          total: value.cell.name,
          id: value.cell.ethAddress,
          balance: value.cell.balance || DEFAULT_BALANCE,
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
      return {}
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
      production_peers: userTradeTable.map(value => {
        if (typeof value.energy != "number")
          throw new Error('null energy')
        return {
          total: value.cell.name,
          id: value.cell.ethAddress,
          balance: value.cell.balance || DEFAULT_BALANCE,
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
      return {}
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

  /*
  "Раз в 20 секунд

{
   id:""123"",
   port:1,
   mode:1
   amount:300, seller: ""Agent-nodeX"",
   contragent:""Agent365"",
   cost:24.4,
   ""timeStamp"": ""2011-12-03T10:15:30Z"",
   progress: 123.7, #в вт*ч
   delta: 12.5, #в вт*ч - разница между progress
   progress_percent: 0.3 #в о.е.
   payment_state: true | false
}"
  */

  async newTransactionStateFromMQTT(topic: string, message: string) {
    console.log("Receive new message from handler - %o ", message)
    if (topic.endsWith("finance")) {
      console.log("finance - mqtt")
      const splitTopic: string[] = topic.split('/')
      const index: number = splitTopic.findIndex(value => value.includes('enode'))
      const nodeNumerArray: string[] | null = splitTopic[index].match(/\d+/)
      if (nodeNumerArray !== null && nodeNumerArray.length) {
        const nodeNumer = nodeNumerArray[0]
        try {
          await this.cellRepository.update({
            name: `Agent${nodeNumer}`
          }, {
            balance: JSON.parse(message).value
          })
        } catch (e) {
          console.log(e);
        }
      } else {
        throw new Error(`topic format is incorrect: ${topic}`)
      }
    }

    if (topic.endsWith("progress")) {
      console.log("progress - mqtt")
      const splitTopic = topic.split('/')
      const index = splitTopic.findIndex(value => value.includes('enode'))
      const nodeNumerArray = splitTopic[index].match(/\d+/)
      if (nodeNumerArray !== null && nodeNumerArray.length) {
        try {
          const parsedMessage = JSON.parse(message)
          const seller = await this.cellRepository.findOneOrFail({
            where: {
              name: parsedMessage.seller
            }
          })
          const contragent = await this.cellRepository.findOneOrFail({
            where: {
              name: parsedMessage.contragent
            }
          })
          await this.transactionRepository.update({
            from: seller,
            to: contragent,
            sentToMqtt: true,
            approved: IsNull()
          }, {
            approved: parsedMessage.payment_state
          })
        } catch (e) {
          console.log(e);
        }
      } else {
        throw new Error(`topic format is incorrect: ${topic}`)
      }

      // if (topic.includes('enode1')) {
      //   let obj = JSON.parse(message);
      //   for (const value of newTransactions) {
      //     // вытащить данны из переменной value и отправить в publishProgress
      //     if (obj.seller == value.from && obj.contragent == value.to) {
      //       await this.transactionRepository.update({
      //         id: value.id
      //       }, {
      //         approved: obj.payment_state
      //       })
      //     }
      //   }
      // }
    }
  }

  async sendNewTransactionsToMQTT() {
    const newTransaction = await this.transactionRepository.findOne({
      where: {
        sentToMqtt: false
      },
      relations: ['from', 'to']
    })

    if (!newTransaction)
      return
    // вытащить данны из переменной value и отправить в publishProgress
    if (newTransaction.from.name.match(/\d+/) === null || newTransaction.to.name.match(/\d+/) === null)
      throw new Error('no digits in name of node')
    // @ts-ignore
    this.db.mqtt.publishProgress(+newTransaction.from.name.match(/\d+/)[0], 1, newTransaction.amount, newTransaction.from.name, newTransaction.to.name, newTransaction.price, newTransaction.cost)
    // @ts-ignore
    this.db.mqtt.publishProgress(+newTransaction.to.name.match(/\d+/)[0], 1, newTransaction.amount, newTransaction.from.name, newTransaction.to.name, newTransaction.price, newTransaction.cost)

    await this.transactionRepository.update({
      id: newTransaction.id
    }, {
      sentToMqtt: true
    })
  }

  async addAnchoringDataToServer(anchoringData: string, user: User) {
    console.log('Notarizing this one: ', JSON.stringify(anchoringData))
    const response = await axios.post('http://localhost:9505/timestamp/add/', anchoringData, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
    console.log('Response from anchor service: ', response.data)
    try {
      await this.anchorRepository.insert({
        address: response.data.txHash,
        hashId: response.data.dataHash,
        time: +JSON.parse(anchoringData).date,
        user: user,
        lastCheckingDate: (new Date()).toISOString()
      })
    } catch (e) {
      console.log(e);
    }
  }

  async getAnchoringDataForUser(user: User): Promise<string> {
    console.assert(user)
    const u = await this.userRepository.findOneOrFail({
      where: {
        id: user.id
      },
      relations: ['cell']
    })
    const preAnchoring: HashingInfo = await this.tradeInfoForHashing()
    {
      const type = u.cell.type
      let anchoringData
      let time: number

      switch (type) {
        case 'producer': {
          time = preAnchoring.producer.date
          anchoringData = {
            "date": "" + preAnchoring.producer.date,
            "entries": preAnchoring.producer.producer.filter(value => value.email === user.email).map(value => {
              return {
                "energy": "" + value.energy,
                "power": "" + value.power
              }
            })
          }
          break;
        }
        case 'consumer': {
          time = preAnchoring.consumer.date
          anchoringData = {
            "date": "" + preAnchoring.consumer.date,
            "entries": preAnchoring.consumer.consumer.filter(value => value.email === user.email).map(value => {
              return {
                "energy": "" + value.energy
              }
            })
          }
          break;
        }
        case 'prosumer': {
          time = preAnchoring.prosumer.date
          anchoringData = {
            "date": "" + preAnchoring.prosumer.date,
            "entries": preAnchoring.prosumer.prosumer.filter(value => value.email === user.email).map(value => {
              return {
                "energyIn": "" + value.energyIn,
                "energyOut": "" + value.energyOut
              }
            })
          }
          break;
        }
        default: {
          throw new Error('unexpected type of cell')
        }
      }

      return JSON.stringify(anchoringData)


      //
      //time add to anchor (time)
      // add txhash(address), dataHash(hashId) to database anchor


    }
  }

  async makePostRequest() {
    const users = await this.userRepository.find({
      relations: ['cell']
    })
    console.log(users.length)
    for (const user of users) {
      await this.addAnchoringDataToServer(await this.getAnchoringDataForUser(user), user)
    }
  }

  async sendDataToAnchor() {
    //create anchor to appropriete user with appropriete data
  }

  async postPricesToAMIGOForCell(ethAddress: string, purposeKey?: string, timeStamp: string = (new Date()).toISOString()) {
    const cell = await this.cellRepository.findOneOrFail({
      where: {
        ethAddress: ethAddress
      }
    })
    const lastTradeEntry = await this.tradeRepository.findOneOrFail({
      where: {
        cell: cell,
      },
      order: {
        time: "DESC"
      }
    })

    const cellAMIGOType = converCellTypeToAMIGOCellType(cell.type)
    const url = `${AMIGO_SERVER}/api/${cellAMIGOType}/${ethAddress}/${mapCellTypeToEndpoint(cellAMIGOType)}?purposeKey=${purposeKey && mapCellTypeToPurposeKey(cellAMIGOType)}`
    if (typeof cell.initPrice != 'object')
      throw new Error('initPrice is not an object')
    switch (cellAMIGOType) {
      case "generatingUnit": {
        const response = await axios.post(url, cell.initPrice.map(initPriceValue => ({
          timeStamp,
          measurementValueQuality:
            {
              validity: "GOOD",
              source: "DERIVED"
            },
          value: initPriceValue
        })))
        // console.log(response.data);
        break;
      }
      case "energyConsumer":
      case "energyStoragingUnit": {
        const response = await axios.post(url, [{
          timeStamp: lastTradeEntry.time,
          measurementValueQuality:
            {
              validity: "GOOD",
              source: "DERIVED"
            },
          value: lastTradeEntry.price
        }])
        // console.log(response.data);
        break;
      }
    }
  }
}
