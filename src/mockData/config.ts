const MAX: number = 2 ** 100
const amountOfEthAddresses = 10
export const EthAddresses: string[] = [
  "0x9e1ff83131ce3000000000000",
  "0xb5d6dc6462065000000000000",
  "0x83153e05ec0ac000000000000",
  "0xeb23446d73299000000000000",
  "0x58329c37e6f25000000000000",
]

export const EthAddressesConsumers: string[] = [
  "0x9e1ff83131ce3000000000000",
  "0xb5d6dc6462065000000000000",
  "0x83153e05ec0ac000000000000",
  "0xeb23446d73299000000000000",
  "0x58329c37e6f25000000000000",
  "0x58329c37e6f25000000000001",
  "0x58329c37e6f25000000000002",
  "0x58329c37e6f25000000000003",
  "0x58329c37e6f25000000000004",
  "0x58329c37e6f25000000000005",
  "0x58329c37e6f25000000000006",
  "0x58329c37e6f25000000000007",
]

export const EthAddressesProsumers: string[] = [
  "0xe57e8d9185dfe000000000000",
  "0x6e4594e52e142000000000000",
  "0x17e0711cdb939000000000000",
  "0xc29b08e2ca18a000000000000",
  "0xbc33473ec8ff3000000000001",
  "0xbc33473ec8ff3000000000002",
  "0xbc33473ec8ff3000000000003",
  "0xbc33473ec8ff3000000000004",
  "0xbc33473ec8ff3000000000005",
  "0xbc33473ec8ff3000000000006",
  "0xbc33473ec8ff3000000000007",
  "0xbc33473ec8ff3000000000008",
  "0xbc33473ec8ff3000000000009",
  "0xbc33473ec8ff3000000000010",
  "0xbc33473ec8ff3000000000011",
]

export const EthAddressesProducers: string[] = [
  "0xbc33473ec8ff3000000000003",
  "0xbc33473ec8ff3000000000004",
  "0xbc33473ec8ff3000000000005",
  "0xbc33473ec8ff3000000000006",
  "0xbc33473ec8ff3000000000007",
]

export const EthAddressOperator = '0xbc33473ec8ff3000000000008'

// for (let i = 0; i < amountOfEthAddresses; i++) {
//   const tmp: string = Math.round(Math.random() * MAX).toString(16)
//   EthAddresses.push(`0x${tmp}`)
// }

export const initialMockData = {
  producers: [
    {
      producerId: EthAddresses[0],
      name: 'Alpha',
      initPower: [0., 20., 30.],
      initPrice: [0., 50., 100.],
      balance: 11
    },
    {
      producerId: EthAddresses[1],
      name: 'Beta',
      initPower: [0., 50., 10.],
      initPrice: [0., 100., 150.],
      balance: 11213
    },
    {
      producerId: EthAddresses[2],
      name: 'Gamma',
      initPower: [0., 100., 200.],
      initPrice: [0., 200., 400.],
      balance: 2123
    }
  ],
  consumers: [
    {
      consumerId: EthAddresses[3],
      name: 'C1',
      balance: 900
    },
    {
      consumerId: EthAddresses[4],
      name: 'C2',
      balance: 200
    },
    {
      consumerId: EthAddresses[5],
      name: 'C3',
      balance: 500
    },
    {
      consumerId: EthAddresses[6],
      name: 'C4',
      balance: 123
    }
  ],
  prosumers: [
    {
      prosumerId: EthAddresses[7],
      name: 'Prosumer1',
      margin: 5,
      energyInAll: 0,
      avPrice: 300,
      balance: 10
    },
    {
      prosumerId: EthAddresses[8],
      name: 'Prosumer2',
      margin: 5,
      energyInAll: 0,
      avPrice: 400,
      balance: 20
    }
  ],
  operator: {
    operatorId: EthAddresses[9],
    name: 'Operator',
    opCoef: 3,
    balance: 1000
  },
  users: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(value => {
    return {
      email: `user${value}@email.com`,
      password: '123456789',
      cellId: EthAddresses[value]
    }
  })
}
