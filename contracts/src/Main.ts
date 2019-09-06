import Options from './config/Options'
import Registry from './Registry'

export default class Main {
  registry: Registry

  constructor (options: Options) {
    this.registry = new Registry(options)
  }

  async run (): Promise<void> {
    // await this.registry.gatheringLoop()
    const httpEndpoint = await this.registry.httpEndpoint()
    await httpEndpoint.listen()
  }
}
