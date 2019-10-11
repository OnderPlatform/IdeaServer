import { EthAddresses } from './config'
import { DataFromAMIGO } from './interfaces'

const mockData: DataFromAMIGO = {
  producers: [
    {
      time: '2019-08-27 16:18:17.91525+03',
      energy: 120.3,
      power: 7.4,
      producerEthAddress: EthAddresses[0]
    },
    {
      time: '2019-08-27 16:18:17.91525+03',
      energy: 192.3,
      power: 3.4,
      producerEthAddress: EthAddresses[1]
    },
    {
      time: '2019-08-27 16:18:17.91525+03',
      energy: 212.3,
      power: 13.4,
      producerEthAddress: EthAddresses[2]
    },
    {
      time: '2019-08-27 16:18:17.91525+03',
      energy: 212.3,
      power: 13.4,
      producerEthAddress: EthAddresses[3]
    }
  ],
  prosumers: [
    {
      time: '2019-08-27 16:18:17.91525+03',
      energyIn: 7.0,
      energyOut: 9.0,
      prosumerEthAddress: EthAddresses[4]
    },
    {
      time: '2019-08-27 16:18:17.91525+03',
      energyIn: 10.0,
      energyOut: 9.0,
      prosumerEthAddress: EthAddresses[5]
    },
    {
      time: '2019-08-27 16:18:17.91525+03',
      energyIn: 7.0,
      energyOut: 9.0,
      prosumerEthAddress: EthAddresses[6]
    },
    {
      time: '2019-08-27 16:18:17.91525+03',
      energyIn: 10.0,
      energyOut: 9.0,
      prosumerEthAddress: EthAddresses[7]
    }
  ],
  consumers: [
    {
      time: '2019-08-27 16:18:17.91525+03',
      energy: 9.0,
      consumerEthAddress: EthAddresses[8]
    },
    {
      time: '2019-08-27 16:18:17.91525+03',
      energy: 12.0,
      consumerEthAddress: EthAddresses[9]
    },
  ],
}
const mockData2: DataFromAMIGO = {
  producers: [
    {
      energy: 1,
      producerEthAddress: EthAddresses[0],
      time: new Date(Date.now()).toISOString(),
      power: 2
    },
    {
      energy: 3,
      producerEthAddress: EthAddresses[1],
      time: new Date(Date.now()).toISOString(),
      power: 4
    },
    {
      energy: 5,
      producerEthAddress: EthAddresses[2],
      time: new Date(Date.now()).toISOString(),
      power: 6
    },
    {
      energy: 7,
      power: 8,
      producerEthAddress: EthAddresses[3],
      time: new Date(Date.now()).toISOString(),
    }
  ],
  prosumers: [
    {
      energyIn: 4,
      energyOut: 3,
      prosumerEthAddress: EthAddresses[4],
      time: new Date(Date.now()).toISOString(),
    },
    {
      energyIn: 6,
      energyOut: 5,
      prosumerEthAddress: EthAddresses[5],
      time: new Date(Date.now()).toISOString(),
    },
    {
      energyIn: 7,
      energyOut: 8,
      prosumerEthAddress: EthAddresses[6],
      time: new Date(Date.now()).toISOString(),
    },
    {
      energyIn: 9,
      energyOut: 10,
      prosumerEthAddress: EthAddresses[7],
      time: new Date(Date.now()).toISOString(),
    },
  ],
  consumers: [
    {
      energy: 1,
      consumerEthAddress: EthAddresses[8],
      time: new Date(Date.now()).toISOString(),
    },
    {
      energy: 2,
      consumerEthAddress: EthAddresses[9],
      time: new Date(Date.now()).toISOString(),
    }
  ]
}

export default function (endpoint: string): Promise<DataFromAMIGO> {
  return new Promise(resolve => {
    let mocks = mockData
    mocks.producers.forEach(value => {
      value.time = new Date(Date.now()).toISOString()
      value.energy = Math.random()
      value.power = Math.random()
    })
    mocks.consumers.forEach(value => {
      value.energy = Math.random()
      value.time = new Date(Date.now()).toISOString()
    })
    mocks.prosumers.forEach(value => {
      value.time = new Date(Date.now()).toISOString()
      value.energyIn = Math.random()
      value.energyOut = Math.random()
    })
    setTimeout(() => resolve(mocks), 1000)
  })
}

// export default function (endpoint: string): Promise<DataFromAMIGO> {
//   return new Promise(resolve => {
//     return resolve(mockData2)
//   })
// }
