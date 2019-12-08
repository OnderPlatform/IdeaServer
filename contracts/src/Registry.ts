import HDWalletProvider from '@machinomy/hdwallet-provider'
import Options from './config/Options'
import { memoize } from 'decko'
import HttpEndpoint from './HttpEndpoint'
import { HttpService } from './HttpService'
import { Infura } from './Infura'
import { pify } from './pify'
import Notary from './wrappers/Notary'
import * as Web3 from 'web3'

export default class Registry {
  options: Options

  constructor (options: Options) {
    this.options = options
  }

  @memoize
  async httpEndpoint (): Promise<HttpEndpoint> {
    const port = this.options.port
    const httpService = await this.httpService()
    return new HttpEndpoint(port, httpService)
  }

  @memoize
  async httpService (): Promise<HttpService> {
    const accountAddress = await this.accountAddress()
    const notaryContract = await this.notaryContract()
    const web3 = await this.web3()
    const gatheringURL = this.options.gatheringURL
    return new HttpService(accountAddress, notaryContract, web3, gatheringURL)
  }

  @memoize
  async hdWalletProvider (): Promise<HDWalletProvider> {
    const infuraToken = this.options.infuraToken
    const network = this.options.network
    const infuraURL = new Infura(network, infuraToken).url()
    const mnemonic = this.options.mnemonic
    return HDWalletProvider.mnemonic({ mnemonic: mnemonic, rpc: infuraURL })
  }

  @memoize
  async notaryContract (): Promise<Notary.Contract> {
    const contractAddress = this.options.contract
    const provider = await this.hdWalletProvider()
    const notaryContract = Notary.contract(provider)
    return notaryContract.at(contractAddress)
  }

  @memoize
  async web3 (): Promise<Web3> {
    const provider = await this.hdWalletProvider()
    return new Web3(provider)
  }

  @memoize
  async accountAddress (): Promise<string> {
    const web3 = await this.web3()
    return (await pify<string[]>((cb: (error: Error, accounts: string[]) => void) => {
      web3.eth.getAccounts(cb)
    }))[0]
  }

  @memoize
  async gatheringLoop (): Promise<any> {
    const gatheringInterval = this.options.gatheringInterval * 1000
    const httpService = await this.httpService()
    return setInterval(async () => {
      console.log('Gathering information from gateway...')
      const json = await httpService.gatherMeteringData()
      await httpService.addTimestampWithCheck(json)
    }, gatheringInterval)
  }
}
