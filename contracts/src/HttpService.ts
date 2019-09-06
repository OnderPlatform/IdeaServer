import * as BigNumber from 'bignumber.js'
import { pify } from './pify'
import Notary from './wrappers/Notary'
import { Buffer } from 'safe-buffer'
import * as Web3 from 'web3'
const ethUtil = require('ethereumjs-util')
const got = require('got')

export interface TxInfo {
  blockNumber: number
  txHash: string
  dataHash: string
}

export interface Account {
  account: string
  balance: BigNumber.BigNumber
}

export interface PowerData {
  date: string
  // entries: PowerDataEntry[]
  entries: DataEntry[]
}

export interface DataEntry {
  [key: string]: any
}

export interface PowerDataEntry {
  consumer: string
  meter: string
  timestamp: string
  activePower: string
  reactivePower: string
  fullPower: string
}

export interface SuccessfulTimestampCheck {
  timestampOfNotary: string,
  timestampOfMetering: string
  dataHash: string
}

export class HttpService {
  accountAddress: string
  contract: Notary.Contract
  web3: Web3
  gatheringURL: string

  constructor (accountAddress: string, contract: Notary.Contract, web3: Web3, gatheringURL: string) {
    this.accountAddress = accountAddress
    this.contract = contract
    this.web3 = web3
    this.gatheringURL = gatheringURL
  }

  throwsIfEmpty (name: string, value: string): void {
    if (!!!value) {
      throw Error(`Param ${name} has empty value`)
    }
  }

  prepareAndCheckData (input: any): Buffer {
    let result: Buffer
    this.throwsIfEmpty('date', input.date)

    const dateBuffer = Buffer.from(input.date, 'utf-8')
    result = dateBuffer

    input.entries.forEach((element: any) => {
      Object.keys(element).forEach(key => {
        result = Buffer.concat([
          result,
          Buffer.from(element[key], 'utf-8')
        ])
      })
    })

    return result
  }

  async addTimestampWithCheck (input: any): Promise<TxInfo> {
    const dataBuf = this.prepareAndCheckData(input)
    return this.addTimestamp(dataBuf)
  }

  async addTimestamp (data: Buffer): Promise<TxInfo> {
    const dataHash = ethUtil.bufferToHex(ethUtil.keccak256(data))
    const startOfDay = new Date().setHours(0,0,0,0) / 1000
    const txResult = await this.contract.addTimestamp(dataHash, startOfDay, { from: this.accountAddress, gasPrice: 20000000000 })

    return { txHash: txResult.receipt.transactionHash, blockNumber: txResult.receipt.blockNumber, dataHash }
  }

  async checkTimestampWithCheck (input: any): Promise<SuccessfulTimestampCheck | null> {
    const dataBuf = this.prepareAndCheckData(input)
    return this.checkTimestamp(dataBuf)
  }

  async checkTimestamp (data: Buffer): Promise<SuccessfulTimestampCheck | null> {
    let result = null
    const dataHash = ethUtil.bufferToHex(ethUtil.keccak256(data))
    const filterResults = await this.contract.DidAddTimestamp({ hash: dataHash }, { fromBlock: 0, address: this.accountAddress })

    const filterResultsGet: any[] = await pify<any[]>((cb: (error: Error, data: any[]) => void) => {
      filterResults.get(cb as any)
    })

    if (filterResultsGet.length) {
      const timestampOfNotary = (await pify<any>((cb: (error: Error, blockInfo: any) => void) => {
        this.web3.eth.getBlock(filterResultsGet[0].blockNumber, cb)
      })).timestamp

      const timestampOfMetering = filterResultsGet[0].args.timestamp
      result = {
        timestampOfNotary,
        timestampOfMetering,
        dataHash
      }
    }

    return result
  }

  async account (): Promise<Account> {
    const balance = await pify<BigNumber.BigNumber>((cb: (error: Error, balance: BigNumber.BigNumber) => void) => {
      this.web3.eth.getBalance(this.accountAddress, cb)
    })

    return {
      account: this.accountAddress,
      balance: balance
    }
  }

  async gatherMeteringData (): Promise<PowerData> {
    const response = await got(this.gatheringURL, {
      body: 'query {' +
          '    getMeterDataOfLastDay {' +
          '      consumer' +
          '      meter' +
          '      timestamp' +
          '      activePower' +
          '      reactivePower' +
          '    }' +
          '}'
    })

    return response.body
  }
}
