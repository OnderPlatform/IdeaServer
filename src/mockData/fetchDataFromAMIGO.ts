import { EthAddresses } from './config'
import { DataFromAMIGO } from './interfaces'

const mockData: DataFromAMIGO = {
  producers: [
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energy: 120.3,
      power: 7.4,
      producerEthAddress: EthAddresses[0]
    },
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energy: 192.3,
      power: 3.4,
      producerEthAddress: EthAddresses[1]
    },
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energy: 212.3,
      power: 13.4,
      producerEthAddress: EthAddresses[2]
    },
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energy: 212.3,
      power: 13.4,
      producerEthAddress: EthAddresses[3]
    }
  ],
  prosumers: [
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energyIn: 7.0,
      energyOut: 9.0,
      prosumerEthAddress: EthAddresses[4]
    },
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energyIn: 10.0,
      energyOut: 9.0,
      prosumerEthAddress: EthAddresses[5]
    },
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energyIn: 7.0,
      energyOut: 9.0,
      prosumerEthAddress: EthAddresses[6]
    },
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energyIn: 10.0,
      energyOut: 9.0,
      prosumerEthAddress: EthAddresses[7]
    }
  ],
  consumers: [
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energy: 9.0,
      consumerEthAddress: EthAddresses[8]
    },
    {
      time: new Date('2019-08-27 16:18:17.91525+03'),
      energy: 12.0,
      consumerEthAddress: EthAddresses[9]
    },
  ],
}

export default function (endpoint: string): Promise<DataFromAMIGO> {
  return new Promise(resolve => {
    let mocks = mockData
    mocks.producers.forEach(value => {
      value.time = new Date(Date.now())
      value.energy = Math.random()
      value.power = Math.random()
    })
    mocks.consumers.forEach(value => {
      value.energy = Math.random()
      value.time = new Date(Date.now())
    })
    mocks.prosumers.forEach(value => {
      value.time = new Date(Date.now())
      value.energyIn = Math.random()
      value.energyOut = Math.random()
    })
    setTimeout(() => resolve(mocks), 1000)
  })
}
