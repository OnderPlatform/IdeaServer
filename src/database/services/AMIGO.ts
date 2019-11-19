import axios from "axios";
import { AMIGO_SERVER } from "../../webEndpoints/endpoints/amigoConfig";
import {
  AMIGOCell,
  CellRealData,
  ConsumerData,
  DataFromAMIGO,
  InitDataFromAMIGO,
  ProducerData,
  ProsumerData
} from "../../mockData/interfaces";
import { EthAddresses, initialMockData } from "../../mockData/config";
import { converCellTypeToAMIGOCellType } from "../../utils/mapCellTypes";
import { NodeDatabaseRepositories } from "./NodeDatabaseRepositories";
import { In } from "typeorm";

const DEFAULT_OPCOEF = 3
const DEFAULT_INITPOWER = [0, 3, 5, 7]
const DEFAULT_INITPRICE = [1, 2, 3, 4]
const DEFAULT_MARGIN = 5


export class AMIGO extends NodeDatabaseRepositories {

  constructor() {
    super()
  }

  addSeconds(date: Date, seconds: number): Date {
    let newDate = new Date(date)
    newDate.setSeconds(date.getSeconds() + seconds)
    return newDate
  }

  async start() {
    const cells = await this.cellRepository.find()
    if (!cells.length) {
      await this.fetchInitialDataFromAMIGO()
      await this.initialDataForOperator()
      await this.addAdmin()
      // await this.db.service.initMockData()
    }

  }

  async addAdmin() {
    await this.cellRepository.insert({
      ethAddress: "ADMIN",
      type: "admin",
      mrid: 'admin',
      name: "Admin"
    })

    await this.userRepository.insert({
      isAdmin: true,
      email: 'admin@email.com',
      cell: {
        ethAddress: "ADMIN"
      },
      password: '123456789'
    })
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
      const responses = await Promise.all([
        axios.get(`${AMIGO_SERVER}/api/energyStoragingUnit/${mrid}/e/row?purposeKey=IF15M&length=-1`),
        axios.get(`${AMIGO_SERVER}/api/energyStoragingUnit/${mrid}/e/row?purposeKey=OF15M&length=-1`),
      ])
      const [energyIn, energyOut] = responses.map(value => value.data[0].value)
      const prosumerEntry = await this.cellRepository.findOneOrFail({
        where: {
          mrid: mrid
        }
      })

      const prosumerPreparedData: ProsumerData = {
        time: responses[1].data[0].timeStamp,
        prosumerEthAddress: prosumerEntry.ethAddress,
        energyIn: energyIn,
        energyOut: energyOut,
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
        energy: Math.abs(consumerData.value),
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
        energy: Math.abs(producerEnergyData.value),
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
    //   this.sendNewTransactionToMQTT()
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
          ethAddress: value.mrid,
          mrid: value.mrid
        }
      }),
      producers: producers.map((value, index) => {
        return {
          name: value.name,
          ethAddress: value.mrid,
          mrid: value.mrid
        }
      }),
      consumers: consumers.map((value, index) => {
        return {
          name: value.name,
          ethAddress: value.mrid,
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
        mrid: value.mrid,
      })
    }))

    await Promise.all(data.producers.map(async value => {
      await this.cellRepository.insert({
        name: value.name,
        ethAddress: value.ethAddress,
        type: 'producer',
        initPower: DEFAULT_INITPOWER,
        initPrice: DEFAULT_INITPRICE,
        mrid: value.mrid,
      })
    }))

    await Promise.all(data.prosumers.map(async value => {
      await this.cellRepository.insert({
        name: value.name,
        type: 'prosumer',
        ethAddress: value.ethAddress,
        margin: DEFAULT_MARGIN,
        mrid: value.mrid,
      })
    }))

  }

  round_time(time: string): string {
    const date = new Date(time)
    date.setMinutes( Math.round(date.getMinutes()/15)*15 )
    date.setSeconds(0)
    date.setMilliseconds(0)
    return date.toISOString()
  }

  async handleDataFromAMIGO(data: DataFromAMIGO) {
    console.log('Got data: ', data);
    // 1. Inserting new entries
    const newProducerTradeIds = await Promise.all(data.producers.map(async value => {
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.producerEthAddress
        }
      })
      const insertResult = await this.tradeRepository.insert({
        time: this.round_time(value.time),
        energy: value.energy,
        power: value.power,
        cell: cell,
        type: 'producer',
        price: 0,
        pay: 0
      })
      return insertResult.identifiers[0].id
    }))

    const newConsumerTradeIds = await Promise.all(data.consumers.map(async value => {
      const cell = await this.cellRepository.findOneOrFail({
        where: {
          ethAddress: value.consumerEthAddress
        }
      })

      const insertResult = await this.tradeRepository.insert({
        cell: cell,
        time: this.round_time(value.time),
        energy: value.energy,
        type: 'consumer',
        price: 0
      })
      return insertResult.identifiers[0].id
    }))

    const newProsumerTradeIds = await Promise.all(data.prosumers.map(async value => {
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

      const insertResult = await this.tradeRepository.insert({
        cell: cell,
        time: this.round_time(value.time),
        energyIn: value.energyIn,
        energyOut: value.energyOut,
        energy: value.energyIn+value.energyOut,
        type: 'prosumer',
        energyInAll: (tmp ? (tmp.energyInAll ? tmp.energyInAll : 0) : 0) + value.energyIn,
        price: 0,
        pip: false
      })
      return insertResult.identifiers[0].id
    }))

    // 3. Price: Working with producers
    await Promise.all(newProducerTradeIds.map(async (value: number) => {
      const lastProducerEntry = await this.tradeRepository.findOneOrFail({
        where: {
          id: value,
        },
        relations: ['cell']
      })
      const cell = lastProducerEntry.cell

      if (!cell.initPrice)
        throw new Error('initPrice is null')
      if (!cell.initPower)
        throw new Error('initPower is null')

      const theData = data.producers.find(value1 => value1.producerEthAddress === cell.ethAddress)
      if (!theData)
        throw new Error('fatal error')


      // let index
      // if (value.power > cell.initPower[-1])
      //   index = -1
      // else
      //   index = cell.initPower.reduce((previousValue, currentValue) => {
      //     return previousValue + (value.power < currentValue ? 1 : 0)
      //   }, 0)
      // const price = cell.initPrice[index]
      let index = cell.initPower.reduce((previousValue, currentValue) => previousValue + (currentValue < theData.power ? 1 : 0), 0)
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
    await Promise.all(newProsumerTradeIds.map(async (value: number) => {
      // Finding last entry in trade table
      const lastProsumerTrade = await this.tradeRepository.findOneOrFail({
        where: {
          id: value
        },
        relations: ['cell']
      })
      // Finding prosumer cell in database
      const cell = lastProsumerTrade.cell


      if (typeof cell.margin != 'number')
        throw new Error('margin is null')
      const margin = cell.margin


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

      const S2 = 0

      const S3 = Trade_producer_table.reduce((previousValue, currentValue) => {
        if (typeof currentValue.energy != "number")
          throw new Error('energy is null')
        return previousValue + currentValue.energy
      }, 0)

      const S4 = 0
      const priceForConsumer = (S1 + S2) / (S3 + S4)
      // console.log("priceForConsumerAndProsumer: ", priceForConsumer);



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
    await Promise.all(newConsumerTradeIds.map(async (value: number) => {
      // Finding last entry in trade table
      const lastConsumerInTradeTable = await this.tradeRepository.findOneOrFail({
        where: {
          id: value
        },
        relations: ['cell']
      })

      const Trade_consumer_table = await this.tradeRepository.find({
        id: In(newConsumerTradeIds)
      })
      const Trade_producer_table = await this.tradeRepository.find({
        id: In(newProducerTradeIds)
      })
      const Trade_prosumer_table = await this.tradeRepository.find({
        id: In(newProsumerTradeIds)
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
        return previousValue + (currentValue.energyIn + currentValue.energyOut) * currentValue.price
      }, 0)
      const S5 = S6 * lastConsumerInTradeTable.energy / S3


      const S7 = Trade_producer_table.reduce((previousValue, currentValue) => {
        if (typeof currentValue.energy != 'number')
          throw new Error('producer table consists null \"energy\" field.')
        return previousValue + currentValue.energy * currentValue.price
      }, 0)



      const priceForConsumer = S7/S1

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
    for (const consumerId of newConsumerTradeIds) {
      for (const producerId of newProducerTradeIds) {
        const consumerTrade = await this.tradeRepository.findOneOrFail({
          where: {
            id: consumerId
          },
          relations: ['cell']
        })
        const producerTrade = await this.tradeRepository.findOneOrFail({
          where: {
            id: producerId
          },
          relations: ['cell']
        })
        const producers = await this.tradeRepository.find({
          where: {
            id: In(newProducerTradeIds)
          }
        })
        const Trade_consumer_table = await this.tradeRepository.find({
          where: {
            id: In(newConsumerTradeIds)
          }
        })

        const S1 = producers.reduce((previousValue, currentValue) => {
          if (typeof currentValue.energy != "number")
            throw new Error('energy is null')
          return previousValue + currentValue.energy
        }, 0)

        const Trade_prosumer_table = await this.tradeRepository.find({
          where: {
            id: In(newProsumerTradeIds)
          }
        })

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
          return previousValue + (Math.abs(currentValue.energyIn) + Math.abs(currentValue.energyOut)) * currentValue.price
        }, 0)

        if (typeof consumerTrade.energy !== "number")
          throw new Error('consumer energy is null')

        const S5 = S6 * consumerTrade.energy / S3

        const cost = Math.abs(consumerTrade.pay - S5) * (1 - operator.opCoef / 100) * producerTrade.energy / S1
        const price = consumerTrade.price

        if (price) {
          await this.transactionRepository.insert({
            cost: cost,
            from: consumerTrade.cell,
            to: producerTrade.cell,
            time: new Date(Date.now()).toISOString(),
            price: price,
            amount: cost / consumerTrade.price,
          })
        }
      }
    }

    // From every consumer to every prosumer
    for (const consumerId of newConsumerTradeIds) {
      for (const prosumerId of newProsumerTradeIds) {
        const consumerTrade = await this.tradeRepository.findOneOrFail({
          where: {
            id: consumerId
          },
          relations: ['cell']
        })
        const consumer = consumerTrade.cell
        const prosumerTrade = await this.tradeRepository.findOneOrFail({
          where: {
            id: prosumerId
          },
          relations: ['cell']
        })
        const prosumer = prosumerTrade.cell
        const prosumers = await this.tradeRepository.find({
          where: {
            id: In(newProsumerTradeIds)
          }
        })
        const Trade_consumer_table = await this.tradeRepository.find({
          where: {
            id: In(newConsumerTradeIds)
          }
        })

        const S1 = prosumers.reduce((previousValue, currentValue) => {
          if (typeof currentValue.energyIn != "number")
            throw new Error('energyIn is null')
          if (typeof currentValue.energyOut != "number")
            throw new Error('energyOut is null')
          return previousValue + Math.abs(currentValue.energyIn) + Math.abs(currentValue.energyOut)
        }, 0)

        const Trade_prosumer_table = await this.tradeRepository.find({
          where: {
            id: In(newProsumerTradeIds)
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
          return previousValue + (Math.abs(currentValue.energyIn) + Math.abs(currentValue.energyOut)) * currentValue.price
        }, 0)
        if (typeof consumerTrade.energy !== 'number')
          throw new Error('consumer energy is null')

        const S5 = S6 * consumerTrade.energy / S3

        if (typeof prosumerTrade.energyIn != "number")
          throw new Error('energyIn is null')
        if (typeof prosumerTrade.energyOut != "number")
          throw new Error('energyOut is null')


        const cost = S5 * (1 - operator.opCoef / 100) * (Math.abs(prosumerTrade.energyIn) + Math.abs(prosumerTrade.energyOut)) / S1
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
    await Promise.all(newConsumerTradeIds.map(async (value: number) => {
      const consumerTrade = await this.tradeRepository.findOneOrFail({
        where: {
          id: value
        },
        relations: ['cell']
      })
      const consumer = consumerTrade.cell
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

  async postPricesToAMIGOForCell(ethAddress: string, purposeKey: string = 'FACT', timeStamp: string = (new Date()).toISOString()) {
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
    const url = `${AMIGO_SERVER}/api/${cellAMIGOType}/${ethAddress}/cost/row?purposeKey=${purposeKey}`
    if (typeof cell.initPrice != 'object')
      throw new Error('initPrice is not an object')
    try {
      switch (cellAMIGOType) {
        case "generatingUnit": {
          const newPrices: CellRealData[] = cell.initPrice.map((initPriceValue, index) => ({
            timeStamp: this.addSeconds(new Date(timeStamp), index).toISOString(),
            measurementValueQuality:
              {
                validity: "GOOD",
                source: "DERIVED"
              },
            value: initPriceValue
          }));
          console.log(`Posting price for generatingUnit: ${JSON.stringify(newPrices)}`);
          const response = await axios.post(url, newPrices)
          // console.log(response.data);
          break;
        }
        case "energyConsumer":
        case "energyStoragingUnit": {
          const newPrices: CellRealData[] = [{
            timeStamp: lastTradeEntry.time,
            measurementValueQuality:
              {
                validity: "GOOD",
                source: "DERIVED"
              },
            value: lastTradeEntry.price
          }];
          console.log(`Posting price for ${cellAMIGOType}: ${newPrices}`);
          const response = await axios.post(url, newPrices);
          // console.log(response.data);
          break;
        }
      }
    } catch (e) {
      console.log(e);
    }
  }
}
