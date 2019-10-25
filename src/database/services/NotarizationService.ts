import NodeDatabase from "./NodeDatabase";
import { User } from "../models";
import { Raw } from "typeorm";
import { HashingInfo } from "../../mockData/interfaces";
import axios from "axios";
import { NodeDatabaseRepositories } from "./NodeDatabaseRepositories";

export class NotarizationService extends NodeDatabaseRepositories {

  async getAnchoringInfoToCheck(user: User) {
    const hashingInfo = await this.userTradeInfoForHashing(user.email)
    const anchoringEntry = await this.anchorRepository.findOne({
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

  async addAnchoringDataToServer(anchoringData: string, user: User) {
    try {
      if (JSON.parse(anchoringData).entries.length <= 0) {
        return
      }
      // console.log('Notarizing this one: ', anchoringData)
      const response = await axios.post('http://localhost:9505/timestamp/add/', JSON.parse(anchoringData), {
        headers: {
          'Content-Type': 'application/json',
        }
      })
      // console.log('Response from anchor service: ', response.data)
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
    for (const user of users) {
      if (!user.isAdmin && user.cell.type != 'operator') {
        await this.addAnchoringDataToServer(await this.getAnchoringDataForUser(user), user)
      }
    }
  }
}
