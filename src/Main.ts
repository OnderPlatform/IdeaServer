import Application from './Application'

export default class Main {

  async run (): Promise<void> {
    const application = new Application()
    await application.start()
  }
}
