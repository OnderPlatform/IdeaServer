import { EthAddresses } from './config'
import { DataFromAMIGO } from './interfaces'
import { Timestamp } from "typeorm";

const mockData: DataFromAMIGO = {
  producers: [
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energy: 120.3,
      power: 7.4,
      producerId: EthAddresses[0]
    },
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energy: 192.3,
      power: 3.4,
      producerId: EthAddresses[1]
    },
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energy: 212.3,
      power: 13.4,
      producerId: EthAddresses[2]
    }
  ],
  consumers: [
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energy: 9.0,
      consumerId: EthAddresses[3]
    },
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energy: 12.0,
      consumerId: EthAddresses[4]
    },
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energy: 15.0,
      consumerId: EthAddresses[5]
    },
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energy: 19.0,
      consumerId: EthAddresses[6]
    }
  ],
  prosumers: [
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energyIn: 7.0,
      energyOut: 9.0,
      prosumerId: EthAddresses[7]
    },
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energyIn: 10.0,
      energyOut: 9.0,
      prosumerId: EthAddresses[8]
    }
  ]
}

export default function (endpoint: string): Promise<DataFromAMIGO> {
  return new Promise(resolve => {
    let mocks = mockData
    mocks.producers.forEach(value => {
      value.time = new Date(Date.now())
      value.energy += value.energy*Math.random()
      value.power += value.power*Math.random()
    })
    mocks.consumers.forEach(value => {
      value.energy += value.energy*Math.random()
      value.time = new Date(Date.now())
    })
    mocks.prosumers.forEach(value => {
      value.time = new Date(Date.now())
      value.energyIn += value.energyIn*Math.random()
      value.energyOut += value.energyOut*Math.random()
    })
    setTimeout(() => resolve(mocks), 1000)
  })
}
