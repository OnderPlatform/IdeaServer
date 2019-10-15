/*
Список всех наших итоговых аккаунтов и кошельков к ним
Name:
Eth address:
Mnemonic:
Private key:

0x512B41D07C70087A1BaAC4d1A49D55B051B05f4a
0xa7a16fd0664bf75C63Ae4556af7A5e58bFb49194
0x730bf30bFaF0128Bb63d02110678102eB82e2E78
0x3E8Ea707E4C65A29d416FF8Bc2a97C51Bcd837A9
0x2CC9FBbf21cdECa6Fb76Ce81C90529964c88603E
0xdA0f70BF5A3Be4C1310F3938B99e75d168C92B14
0x78e3981907702aF199BF669265F25539129c9001
0x83769BfCEB26ef1fD499131accF7d385E591c247
0xc570f03CbD44e81007A3EaB275B2FB6296c77Ed6
0x1ABE470DdB6609Ba1f4E2e5C54115A359a8dd64a
0xA3Df124E0A6A9555cb9DD35C1Ff0e1e42f70DC6A


Diesel Genset #1
Diesel Genset #2
PV System #1
PV System #2

Energy Storage #1A
Energy Storage #1B
Energy Storage #2A
Energy Storage #2B

Load Bank #1
Load Bank #2
Operator
 */

const amountOfEthAddresses = 11
export const EthAddresses: string[] = [
  "0x512B41D07C70087A1BaAC4d1A49D55B051B05f4a",
  "0xa7a16fd0664bf75C63Ae4556af7A5e58bFb49194",
  "0x730bf30bFaF0128Bb63d02110678102eB82e2E78",
  "0x3E8Ea707E4C65A29d416FF8Bc2a97C51Bcd837A9",
  "0x2CC9FBbf21cdECa6Fb76Ce81C90529964c88603E",
  "0xdA0f70BF5A3Be4C1310F3938B99e75d168C92B14",
  "0x78e3981907702aF199BF669265F25539129c9001",
  "0x83769BfCEB26ef1fD499131accF7d385E591c247",
  "0xc570f03CbD44e81007A3EaB275B2FB6296c77Ed6",
  "0x1ABE470DdB6609Ba1f4E2e5C54115A359a8dd64a",
  "0xA3Df124E0A6A9555cb9DD35C1Ff0e1e42f70DC6A",
]

export const initialMockData = {
  producers: [
    {
      ethAddress: EthAddresses[0],
      name: 'Diesel Genset #1',
      initPower: [0,	3,	5,	7,	9],
      initPrice: [0,	2,	3,	4,	5],
    },
    {
      ethAddress: EthAddresses[1],
      name: 'Diesel Genset #2',
      initPower: [0,	3,	5,	7,	9],
      initPrice: [0,	2,	3,	4,	5],
    },
    {
      ethAddress: EthAddresses[2],
      name: 'PV System #1',
      initPower: [0,	3,	5,	7,	9],
      initPrice: [0,	2,	3,	4,	5],
    },
    {
      ethAddress: EthAddresses[3],
      name: 'PV System #2',
      initPower: [0,	3,	5,	7,	9],
      initPrice: [0,	2,	3,	4,	5],
    }
  ],
  prosumers: [
    {
      ethAddress: EthAddresses[4],
      name: 'Energy Storage #1A',
      margin: 5,
      energyInAll: 0,
      avPrice: 300,
    },
    {
      ethAddress: EthAddresses[5],
      name: 'Energy Storage #1B',
      margin: 5,
      energyInAll: 0,
      avPrice: 400,
    },
    {
      ethAddress: EthAddresses[6],
      name: 'Energy Storage #2A',
      margin: 5,
      energyInAll: 0,
      avPrice: 300,
    },
    {
      ethAddress: EthAddresses[7],
      name: 'Energy Storage #2B',
      margin: 5,
      energyInAll: 0,
      avPrice: 400,
    }
  ],
  consumers: [
    {
      ethAddress: EthAddresses[8],
      name: 'Load Bank #1',
    },
    {
      ethAddress: EthAddresses[9],
      name: 'Load Bank #2',
    },
  ],
  operator: {
    ethAddress: EthAddresses[10],
    name: 'Operator',
    opCoef: 3,
  },
  users: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(value => {
    return {
      email: `user${value}@email.com`,
      password: '123456789',
      cellId: EthAddresses[value]
    }
  })
}
