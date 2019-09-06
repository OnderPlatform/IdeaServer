
export class Infura {
  baseUrl: string
  token: string

  constructor (network: string, token: string) {
    if (network === 'main') {
      this.baseUrl = 'https://infura.io/v3'
    } else {
      this.baseUrl = 'https://rinkeby.infura.io/v3'
    }

    this.token = token
  }

  url (): string {
    return `${this.baseUrl}/${this.token}`
  }
}
