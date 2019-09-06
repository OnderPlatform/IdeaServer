import * as yargs from 'yargs'

interface Options {
  port: number
  mnemonic: string
  infuraToken: string
  contract: string
  network: string
  gatheringInterval: number
  gatheringURL: string
}

const parser = yargs
  .config()
  .alias('c', 'config')
  .demandOption('config')

namespace Options {
  export async function build (args: Array<string>): Promise<Options> {
    const options = parser.parse(args)

    return {
      port: Number(options.port),
      mnemonic: options.mnemonic as string,
      infuraToken: options.infuraToken as string,
      contract: options.contract as string,
      network: options.network as string,
      gatheringInterval: Number(options.gatheringInterval),
      gatheringURL: options.gatheringURL as string
    }
  }
}

export default Options
